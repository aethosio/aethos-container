# aethos-container
Service container for AethOS services

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
