const fs = require('fs');
const path = require('path');

class ServiceRegistry {
  constructor(app, config) {
    this.app = app;
    this.config = config;
    this.services = new Map();
  }

  installServices() {
    if (!this.config.serviceFolder) {
      throw new Error('aethos-container.installServices config requires serviceFolder entry');
    }
    const normalizedPath = this.config.serviceFolder;

    return new Promise((resolve, reject) => {
        // Get a list of all of the files in the config.serviceFolder directory
        fs.readdir(normalizedPath, (err, files) => {
          if (err) {
            reject(err);
          }
          resolve(files);
        });
      })
      .then(files => {
        // Iterate through the files and get the service factory
        return Promise.all(files.filter((file) => {
          // Disable modules
          if (this.config.disableModules) {
            return !this.config.disableModules.includes(file);
          }
          return true;
        }).map(file => {
          console.log(`Loading module ${file}`);
          const serviceModule = require(path.join(normalizedPath, file));
          if (serviceModule.configure) {
            return Promise.resolve(serviceModule.configure(this.app, this.config));
          }
          console.log(`WARNING: Using deprecated serviceFactory API.  ${file} is disabled.`);
          return Promise.resolve();
        }));
      })
      .then(() => {
        // Install the services
        return Array.from(this.services.values())
          .reduce((promise, serviceDetails) => {
            return promise.then(() => {
              return this.$installService(serviceDetails);
            });
          }, Promise.resolve());
      }).then(() => {
        console.log('Starting services...');
        // Start the services
        this.starting = true;
        return Array.from(this.services.values())
          .reduce((promise, serviceDetails) => {
            if (serviceDetails.service && serviceDetails.service.start) {
              return promise.then(() => {
                return serviceDetails.service.start(this.config);
              });
            }
            return promise;
          }, Promise.resolve());
      });
  }

  $installService(serviceDetails) {
    // Return the service if it's already installed
    if (serviceDetails.service) {
      console.log(`${serviceDetails.name} already installed`);
      return Promise.resolve(serviceDetails.service);
    }
    // Return if the service is disabled
    if (this.config.disableServices) {
      if (this.config.disableServices.includes(serviceDetails.name)) {
        console.log(`Service ${serviceDetails.name} is disabled; not installing`);
        return Promise.resolve();
      }
    }
    if (serviceDetails.installing) {
      throw new Error(`Circular dependency encountered while installing ${serviceDetails.name}`);
    }
    serviceDetails.installing = true;

    return this.$installDependencies(serviceDetails)
      .then((dependencies) => {
        if (!serviceDetails.serviceFactory) {
          throw new Error(`Service factory not found for ${serviceDetails.name}`);
        }
        return Promise.resolve(serviceDetails.serviceFactory())
          .then(service => {
            serviceDetails.service = service;
            if (service.install) {
              return service.install(this.app, this.config, ...dependencies);
            }
          });
      });
  }

  getService(serviceName) {
    if(!this.starting) {
      throw new Error("serviceRegistry.getService() cannot be called except for within (or after) your service start has been called");
    }
    let mappedDependencyName = serviceName;
    if (this.config.serviceMap && this.config.serviceMap[serviceName]) {
      mappedDependencyName = this.config.serviceMap[serviceName];
    }
    if (this.services.has(mappedDependencyName)) {
      return this.services.get(mappedDependencyName).service;
    }
  }

  $installDependencies(serviceDetails) {
    let dependencies;
    if (serviceDetails.dependencies) {
      dependencies = serviceDetails.dependencies.map(dependencyName => {
        let mappedDependencyName = dependencyName;
        if (this.config.serviceMap && this.config.serviceMap[dependencyName]) {
          mappedDependencyName = this.config.serviceMap[dependencyName];
        }
        if (!this.services.has(mappedDependencyName)) {
          const err = `Error!  ${mappedDependencyName} not found while installing ${serviceDetails.name}`;
          throw new Error(err);
        }
        if (this.config.disableServices.includes(mappedDependencyName)) {
          const err = `Error!  ${mappedDependencyName} is disabled, yet is required by ${serviceDetails.name}`;
          throw new Error(err);
        }
        return this.$installService(this.services.get(mappedDependencyName))
          .then(() => {
            return this.services.get(mappedDependencyName).service;
          });
      });
    }
    else {
      dependencies = [];
    }
    return Promise.all(dependencies)
      .then((resolvedDependencies) => {
        return resolvedDependencies;
      });
  }

  register(serviceDetails) {
    this.services.set(serviceDetails.name, serviceDetails);
    return this;
  }
}

module.exports = {
  configure: (app, config) => {
    config.serviceRegistry = new ServiceRegistry(app, config);
  },
};
