'use strict';

let nodeStatic = require('node-static');

const config = require('./configuration');

let fileServer = new nodeStatic.Server(config.PATH, {});

require('http').createServer(function (request, response) {
  request.addListener('end', function () {
    fileServer.serve(request, response, function (err, result) {
      if (err) { // There was an error serving the file
        console.error('Error serving ' + request.url + ' - ' + err.message);

        // Respond to the client
        response.writeHead(err.status, err.headers);
        response.end();
      }
      console.log(result.message + ' ' + request.url);
    });
  }).resume();
}).listen(config.PORT);
