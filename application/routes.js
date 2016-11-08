'use strict';

const Joi = require('joi'),
  handlers = require('./controllers/handler'),
  conf = require('./configuration');

module.exports = function(server) {
  server.route({
    method: 'GET',
    path: '/file/{filename*}',
    handler: {
      directory: {
        path: conf.fsPath
      }
    },
    config: {
      validate: {
        params: {
          filename: Joi.string().trim().uri({allowRelative: true}).required()
        },
      },
      plugins: {
        'hapi-swagger': {
          produces: ['image/jpeg','image/png'],
        }
      },
      tags: ['api'],
      description: 'Get a file'
    }
  });

  server.route({
    method: 'POST',
    path: '/file',
    handler: handlers.storeFile,
    config: {
      payload: {
        output: 'file',
        uploads: '/tmp/',
        maxBytes: 10485760, //10MB
        failAction: 'log'
      },
      validate: {
        payload: Joi.required()
      },
      plugins: {
        'hapi-swagger': {
          consumes: ['image/jpeg','image/png'],
        }
      },
      tags: ['api'],
      description: 'Store a file'
    },
  });
};
