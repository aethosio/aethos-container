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

  $installDependencies(serviceDetails) {
    let dependencies;
    if (serviceDetails.dependencies) {
      dependencies = serviceDetails.dependencies.map(dependencyName => {
        if (!this.services.has(dependencyName)) {
          const err = `Error!  ${dependencyName} not found while installing ${serviceDetails.name}`;
          console.log(err);
          throw new Error(err);
        }
        return this.$installService(this.services.get(dependencyName));
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
