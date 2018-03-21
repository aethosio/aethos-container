# AethOS Service Container
Service container for services running in `Node.js`.

This project is used as the primary JavaScript container for AethOS services, but it has been designed to be flexible enough to work with nearly any `Node.js` architecture.

An advantage of using AethOS Container is that it's designed to be utilized within a traditional Enterprise Service Bus (ESB), or deployed as a for a `micro-service`.

If you follow the traditional `IndieZen` development methodology, your services can be deployed either way, and that decision can be made at deployment time rather than requiring you to commit to a deployment strategy at software design time.

## Installation

Not currently available as a true npm package, so do the following to install it locally on your machine.

```
git clone https://github.com/aethosio/aethos-container.git
cd aethos-container
npm install
gulp build
npm link # may require sudo
```

Once this is done, in a project that requires aethos-container you can install the package using a symlink using:

```
npm link aethos-container
```

The advantage of this is that we can continue developing this library until it's production ready (Grunt - and I'm too lazy to publish it; see #2)


## Usage

```
// Optional app server; does not necessarily have to be express
const app = express();
const container = require('aethos-container');

// Minimal config; more global configuration can be stored here
const config = {
  serviceFolder: path.join(__dirname, 'services')
};

// This will configure the container, which places a servieRegistry entry
// on the config object.
app.container.configure(app, config);

// Use the serviceReistry to install services found in config.serviceFolder.
config.serviceRegistry.installServices(app, config).then(() => {
  // Start your app server
}, (err) => {
  console.log(err);
});

```

## Additonal options in config

By default the container service registry will attempt to load all modules located in the service folder.  `disableModules` will prevent a module in the `serviceFolder` from being loaded.

```
const config = {
  ...
  disableModules: ['index.js']
}
```

By default, all services registered with the service registry will be instantiated, installed and started.  To prevent this from happening, specify services to disable using `disableServices`.

```
const config = {
  ...
  disableServices: ['IndexService']
}
```

## Service Lifecycle

First, all of the modules within the service folder (configured via `config.serviceFolder`) are collected, and each non-disabled module is loaded using `require`, and then the module `configure` function is executed.  Typically this function uses `config.serviceRegistry.register()` to register one or more services.

After loading the modules, the service registry works out dependencies and starts initializing each service by calling the service `constructor`, then calling the service `install(app, config, ...dependencies)`.  The `dependencies` list is the list of service objects identified as dependencies in the call to `serviceRegistry.register` (see below for examples).

After each service has been constructed and installed, each of the services are started by calling its `start(config)` method.

In short this pseudocode:

```
module.configure(app, config)
  # Should call config.serviceRegistry.register()
for each service
  dependencies = getDependencies(service)
  service.install(app, config, dependencies)
for each service
  service.start(config)
```

What's not clear in that pseudocode is that the dependencies are installed first.

Circular references are not allowed.  If you need a service that might depend on your service, during your `service.start(config)` execution, call `config.serviceRegistry.getService(dependencyName)` and check for `unknown`.  The returned service will havealready been installed but not necessarily started.

## Example minimal service

Put this as a file in your 'services' directory (configured in config.serviceFolder, so it can be wherever
you like)

```
const express = require('express');
const path = require('path');

class IndexService {
  constructor() {
  }

  install(app, config) {
    // Install your service, such as app.use

    // Here we're installing a root handler that remaps to a static folder
    app.use(config.root, express.static(path.join(__dirname, '../../static')));
  }
}

module.exports.configure = function configure(app, config) {
  config.serviceRegistry.register({
    name: 'IndexService',
    serviceFactory: () => {
      return new IndexService();
    },
    dependencies: []
  });
};

```

## Example service that depends on another service

Create another file in your services directory.

```
const express = require('express');
const path = require('path');

class DependentService {
  dependencies() {
    return ['IndexService'];
  }

  install(app, config, index) {
    // index is an instance of the IndexService, already instantiated and installed.
  }
}

module.exports.configure = function configure(app, config) {
  config.serviceRegistry.register({
    name: 'DependentService',
    serviceFactory: () => {
      return new DependentService();
    },
    // This service depends on IndexService
    dependencies: ['IndexService']
  });
};
```
