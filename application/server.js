'use strict';

const hapi = require('hapi'),
  co = require('./common'),
  child = require('child_process'),
  config = require('./configuration'),
  jwt = require('./controllers/jwt');

const server = new hapi.Server();

let port = (!co.isEmpty(process.env.APPLICATION_PORT)) ? process.env.APPLICATION_PORT : 3000;
server.connection({
  port: port
});
let host = (!co.isEmpty(process.env.VIRTUAL_HOST)) ? process.env.VIRTUAL_HOST : server.info.host;

module.exports = server;

let plugins = [
  require('inert'),
  require('vision'), {
    register: require('good'),
    options: {
      ops: {
        interval: 1000
      },
      reporters: {
        console: [{
          module: 'good-squeeze',
          name: 'Squeeze',
          args: [{
            log: '*',
            response: '*',
            request: '*'
          }]
        }, {
          module: 'good-console'
        }, 'stdout']
      }
    }
  }, {
    register: require('hapi-swagger'),
    options: {
      host: host,
      info: {
        title: 'Fileservice API',
        description: 'Powered by node, hapi, joi, hapi-swaggered, hapi-swaggered-ui and swagger-ui',
        version: '0.2.0'
      }
    }
  },
  require('hapi-auth-jwt2')
];

server.register(plugins, (err) => {
  if (err) {
    console.error(err);
    global.process.exit();
  } else {
    server.auth.strategy('jwt', 'jwt', {
      key: config.JWT.SERIAL,
      validateFunc: jwt.validate,
      verifyOptions: {
        algorithms: [ config.JWT.ALGORITHM ],
        ignoreExpiration: true
      },
      headerKey: config.JWT.HEADER
    });

    server.start(() => {
      server.log('info', 'Server started at ' + server.info.uri);
      child.execSync('mkdir -p ' + require('./configuration').fsPath + '/pictures');
      child.execSync('mkdir -p ' + require('./configuration').fsPath + '/pictures/profile');
      child.execSync('mkdir -p ' + require('./configuration').fsPath + '/graphics');
      child.execSync('mkdir -p ' + require('./configuration').fsPath + '/audio');
      child.execSync('mkdir -p ' + require('./configuration').fsPath + '/videos');
      child.execSync('mkdir -p ' + require('./configuration').fsPath + '/slideThumbnails');
      require('./routes.js')(server);
    });
  }
});

function exitHandler(exit = true, cleanup = false) {
  if(cleanup) {
    console.log('Stopping puppeteer processes...');
    require('./controllers/handler').shutDownPuppeteer();
  }
  if(exit){
    console.log('Shutting down...');
    process.exit();
  }
}

process.on('exit', exitHandler.bind(null, false, true));
process.on('SIGINT', exitHandler);
process.on('SIGUSR1', exitHandler);
process.on('SIGUSR2', exitHandler);
process.on('uncaughtException', exitHandler);
