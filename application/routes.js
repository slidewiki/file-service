'use strict';

const Joi = require('joi'),
  handlers = require('./controllers/handler'),
  conf = require('./configuration');

module.exports = function(server) {
  server.route({
    method: 'GET',
    path: '/picture/{filename*}',
    handler: {
      directory: {
        path: conf.fsPath + 'pictures/'
      }
    },
    config: {
      auth: false,
      validate: {
        params: {
          filename: Joi.string()
            .trim()
            .required()
        },
      },
      plugins: {
        'hapi-swagger': {
          produces: ['image/jpeg', 'image/png'],
          responses: {
            ' 404 ': {
              'description': 'Not picture was found'
            },
            ' 400 ': {
              'description': 'Probably a parameter is missing or not allowed'
            }
          }
        }
      },
      tags: ['api'],
      description: 'Get a file'
    }
  });

  server.route({
    method: 'POST',
    path: '/picture',
    handler: handlers.storeFile,
    config: {
      // auth: false,
      payload: {
        output: 'file',
        uploads: '/tmp/',
        maxBytes: 10485760, //10MB
        failAction: 'log'
      },
      validate: {
        payload: Joi.required(),
        query: {
          license: Joi.string().allow('CC0').required()
        },
        headers: Joi.object({
          '----jwt----': Joi.string().required().description('JWT header provided by /login')
        }).unknown()
      },
      plugins: {
        'hapi-swagger': {
          consumes: ['image/jpeg', 'image/png'],
          responses: {
            ' 200 ': {
              'description': 'Successfully uploaded and stored a picture, see response',
            },
            ' 401 ': {
              'description': 'Not authorized to store pictures',
              'headers': {
                'WWW-Authenticate': {
                  'description': 'Use your JWT token.'
                }
              }
            },
            ' 400 ': {
              'description': 'Probably a parameter is missing or not allowed'
            }
          }
        }
      },
      tags: ['api'],
      description: 'Store a picture'
    },
  });
};
