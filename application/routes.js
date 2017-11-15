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
      validate: {
        params: {
          filepath: Joi.string()
            .uri({ allowRelative: true })
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
    path: '/slideThumbnail/{slideID*}',
    handler: {
      directory: {
        path: conf.fsPath + 'slideThumbnails/'
      }
    },
    config: {
      validate: {
        params: {
          slideID: Joi.string()
            .trim()
            .required()
            .description('ID of the slide as ID-REVISION')
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
      description: 'Get a thumbnail by name'
    }
  });

  server.route({
    method: 'GET',
    path: '/metadata/{filename*}',
    handler: handlers.getMetaData,
    config: {
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
      auth: 'jwt',
      payload: {
        output: 'file',
        uploads: '/tmp/',
        maxBytes: 10485760, //10MB
        failAction: 'log'
      },
      validate: {
        payload: Joi.required(),
        query: {
          license: Joi.string()
            .required()
            .description('Used license (eg. Creative Commons 4.0)'),
          copyright: Joi.string()
            .description('Exact copyright and copyright holder (e.g. CC-BY-SA SlideWiki user 33)'),
          title: Joi.string()
            .description('Caption or Alt text of the picture')
        },
        headers: Joi.object({
          '----jwt----': Joi.string()
              .required()
              .description('JWT header provided by the user-service or slidwiki-platform'),
          'content-type': Joi.string()
              .required()
              .valid('image/jpeg', 'image/png', 'image/tiff', 'image/bmp')
              .description('Mime-Type of the uploaded image'), //additinally tested in picture.js on the actual file
        })
          .unknown()
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

  server.route({
    method: 'POST',
    path: '/slideThumbnail/{slideID}/{theme*}',
    handler: handlers.storeThumbnail,
    config: {
      validate: {
        payload: Joi.string()
          .required()
          .description('Actual HTML as string'),
        params: {
          slideID: Joi.string()
            .lowercase()
            .trim()
            .required()
            .description('ID of the slide as ID-REVISION'),
          theme: Joi.string()
            .default('default')
            .valid('default', 'beige', 'black', 'blood', 'league', 'moon', 'night', 'odimadrid', 'oeg', 'openuniversity', 'simple', 'solarized', 'white')
            .description('Theme to apply to the thumbnail')
        },
      },
      plugins: {
        'hapi-swagger': {
          consumes: ['text/plain'],
          responses: {
            ' 200 ': {
              'description': 'Successfully processed the HTML and stored a thumbnail, see response',
            },
            ' 400 ': {
              'description': 'Probably a parameter is missing or not allowed'
            }
          }
        }
      },
      tags: ['api'],
      description: 'Create thumbnail of a slide from html'
    }
  });

  server.route({
    method: 'GET',
    path: '/search/media/{userid}',
    handler: handlers.getMediaOfUser,
    config: {
      validate: {
        params: {
          userid: Joi.string().required().description('Identifier of a user'),
        },
        query: {
          mediaType: Joi.string().valid('pictures', 'video', 'audio').required()
        }
      },
      plugins: {
        'hapi-swagger': {
          responses: {
            ' 200 ': {
              'description': 'A json array is provided, containing all media that was found',
            },
            ' 400 ': {
              'description': 'Probably a parameter is missing or not allowed'
            },
            ' 404 ': {
              'description': 'No media for user with userid found'
            },
          }
        }
      },
      tags: ['api'],
      description: 'Get all media of a user by media type',
      response: {
        schema: Joi.array().items(Joi.object().keys({
          type: Joi.string(),
          fileName: Joi.string(),
          thumbnailName: Joi.string(),
          license: Joi.string(),
          slidewikiCopyright: Joi.string(),
          originalCopyright: Joi.string().allow('')
        })),
      }
    },
  });

  server.route({
    method: 'PUT',
    path: '/profilepicture/{username}',
    handler: handlers.storeProfilepicture,
    config: {
      payload: {
        output: 'file',
        uploads: '/tmp/',
        maxBytes: 153600, //150KB
        failAction: 'log'
      },
      validate: {
        params: {
          username: Joi.string().required()
        },
        payload: Joi.required(),
        headers: Joi.object({
          '----jwt----': Joi.string()
              .required()
              .description('JWT header provided by the user-service or slidwiki-platform'),
          'content-type': Joi.string()
              .required()
              .valid('image/png')
              .description('Mime-Type of the uploaded image')
        })
          .unknown()
      },
      plugins: {
        'hapi-swagger': {
          consumes: ['image/png'],
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
            ' 403 ': {
              'description': 'You are not allowed to exchange the picture of another user',
            },
            ' 406 ': {
              'description': 'The images has the wrong dimensions. It should be in a ratio one to one.',
            },
            ' 413 ': {
              'description': 'The image is too large. Images have to be less than 2MB',
            }
          }
        }
      },
      tags: ['api'],
      description: 'Store your profile picture'
    },
  });
};
