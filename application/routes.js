'use strict';

const Joi = require('joi'),
  handlers = require('./controllers/handler'),
  conf = require('./configuration');

module.exports = function(server) {
  server.route({
    method: 'GET',
    path: '/{filepath*}',
    handler: {
      directory: {
        path: conf.fsPath
      }
    },
    config: {
      auth: false,
      validate: {
        params: {
          filepath: Joi.string()
            .uri({allowRelative: true})
            .trim()
            .required()
        },
      },
      plugins: {
        'hapi-swagger': {
          deprecated: true,
          responses: {
            ' 200 ': {
              'description': 'A file is provided'
            },
            ' 400 ': {
              'description': 'Probably a parameter is missing or not allowed'
            },
            ' 404 ': {
              'description': 'No file was found'
            }
          }
        }
      },
      tags: ['api'],
      description: 'Get a file by file path - for backward compatibility'
    }
  });

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
            ' 200 ': {
              'description': 'A pictue is provided'
            },
            ' 400 ': {
              'description': 'Probably a parameter is missing or not allowed'
            },
            ' 404 ': {
              'description': 'No picture was found'
            }
          }
        }
      },
      tags: ['api'],
      description: 'Get a picture by name'
    }
  });

  server.route({
    method: 'GET',
    path: '/metadata/{filename*}',
    handler: handlers.getMetaData,
    config: {
      auth: false,
      validate: {
        params: {
          filename: Joi.string()
            .trim()
            .required()
        }
      },
      plugins: {
        'hapi-swagger': {
          responses: {
            ' 200 ': {
              'description': 'A metadata json object is provided',
            },
            ' 400 ': {
              'description': 'Probably a parameter is missing or not allowed'
            },
            ' 404 ': {
              'description': 'No metadata was found'
            },
          }
        }
      },
      tags: ['api'],
      description: 'Get metadata of a file'
    },
  });

  server.route({
    method: 'POST',
    path: '/picture',
    handler: handlers.storePicture,
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
          license: Joi.string().required().description('Used license (eg. Creative Commons 4.0)'),
          copyright: Joi.string().description('Exact copyright and copyright holder (e.g. CC-BY-SA SlideWiki user 33)'),
          title: Joi.string().description('Caption or Alt text of the picture')
        },
        headers: Joi.object({
          '----jwt----': Joi.string().required().description('JWT header provided by the user-service or slidwiki-platform'),
          'content-type':  Joi.string().required().valid('image/jpeg', 'image/png', 'image/tiff', 'image/bmp').description('Mime-Type of the uploaded image'),//additinally tested in picture.js on the actual file
        }).unknown()
      },
      plugins: {
        'hapi-swagger': {
          consumes: ['image/jpeg', 'image/png', 'image/tiff', 'image/bmp'],
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
