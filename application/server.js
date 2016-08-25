/*
This is a demo application implementing some interfaces as described in https://docs.google.com/document/d/1337m6i7Y0GPULKLsKpyHR4NRzRwhoxJnAZNnDFCigkc/edit#
This application demonstrates a service which returns previously inserted data from a MongoDB database.
 */

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
      console.log(result);
    });
  }).resume();
}).listen(config.PORT);
