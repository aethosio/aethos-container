const fs = require('fs');
const path = require('path');

// Install services
const services = [];
const serviceIndex = {};
const installedServices = {};

function installService(app, config, service) {
  if (service.name in installedServices) {
    console.log(`${service.name} already installed`);
  }
  else {
    // Install the dependencies then install the service, passing those dependencies
    // as a list of arguments after app, config
    installedServices[service.name] = installDependencies(app, config, service)
      .then(dependencies => {
        // TODO Make sure service.install is a function
        if (service.install) {
          return Promise.resolve(service.install(app, config, ...dependencies))
            .then(() => {
              return service;
            });
        }
        else {
          let serviceName;
          if (service.name) {
            serviceName = service.name;
          }
          else {
            serviceName = service.constructor.name;
          }
          console.error(`${serviceName} does not have an install function`);
        }
      });
  }

  return Promise.resolve(installedServices[service.name]);
}

function installDependencies(app, config, service) {
  let dependencies;
  // Check to see if the service has any dependencies
  if (service.dependencies) {
    // If so, install those dependencies first.
    dependencies = service.dependencies().map(dependencyName => {
      return installService(app, config, serviceIndex[dependencyName]);
    });
  }
  else {
    dependencies = [];
  }
  return Promise.all(dependencies);
}

function installFactory(app, config, serviceFactory) {
  if (serviceFactory) {
    return Promise.resolve(serviceFactory(config))
      .then(serviceList => {
        for (const service of serviceList) {
          services.push(service);
          // Keep a list of services by name.
          serviceIndex[service.name] = service;
        }
      });
  }
  return Promise.resolve(false);
}

module.exports.installFactory = installFactory;

module.exports.installServices = function installServices(app, config) {
  if (!config.serviceFolder) {
    throw new Error('aethos-container.installServices config requires serviceFolder entry');
  }
  const normalizedPath = config.serviceFolder;

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
      return Promise.all(files.map(file => {
        const serviceFactory = require(path.join(normalizedPath, file)).serviceFactory;
        // serviceFactory() may be a Promise that resolves to a list of services
        return installFactory(app, config, serviceFactory);
      }));
    })
    .then(() => {
      // Install the services
      return Promise.all(services.map((service) => {
        return installService(app, config, service);
      }));
    });
};
