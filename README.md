# aethos-container
Service container for AethOS services

## Installation

```
npm install -S aethos-container
```


## Usage

```
// Optional app server; does not necessarily have to be express
const app = express();
const container = require('aethos-container');

// Minimal config; more global configuration can be stored here
const config = {
  root: '/root/to/my/app',
  serviceFolder: path.join(__dirname, 'services')
};

container.installServices(app, config).then(() => {
  // Start your app server
}, (err) => {
  console.log(err);
});

```

## Example minimal service

Put this as a file in your 'services' directory (configured in config.serviceFolder, so it can be wherever
you like)

```
const express = require('express');
const path = require('path');

class IndexService {
  constructor() {
    this.name = 'Index';
  }
  
  install(app, config) {
    // Install your service, such as app.use
    
    // Here we're installing a root handler that remaps to a static folder
    app.use(config.root, express.static(path.join(__dirname, '../../static')));
  }
}

module.exports.serviceFactory = function() {
  return [new IndexService()];
}

```

## Example service that depends on another service

Create another file in your services directory.

```
const express = require('express');
const path = require('path');

class DependentService {
  dependencies() {
    // This service depends on the Index service
    return ['Index'];
  }
  
  install(app, config, index) {
    // index is an instance of the IndexService, already instantiated and installed.
  }
}

module.exports.serviceFactory = function() {
  return [new DependentService()];
}
```
