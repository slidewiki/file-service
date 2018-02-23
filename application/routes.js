'use strict';

const Joi = require('joi'),
  handlers = require('./controllers/handler'),
  conf = require('./configuration');

const availableThemes = Joi.string().lowercase().trim().replace('.jpeg','').default('default')
  .valid('default', 'sky', 'beige', 'black', 'blood', 'league', 'moon', 'night', 'odimadrid', 'oeg', 'openuniversity', 'simple', 'solarized', 'white')
  .description('Theme to apply to the thumbnail');

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
    path: '/slideThumbnail/{id*}',
    handler: {
      directory: {
        path: conf.fsPath + 'slideThumbnails/'
      }
    },
    config: {
      validate: {
        params: {
          id: Joi.string()
            .trim()
            .required()
            .description('ID of the slide as ID-REVISION')
        },
      },
      plugins: {
        'hapi-swagger': {
          deprecated: true,
          produces: ['image/jpeg'],
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
            .description('Caption of the picture'),
          altText: Joi.string()
            .description('Alt text of the picture'),
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
          .unknown(),
        failAction: handlers.storePicture
      },
      plugins: {
        'hapi-swagger': {
          deprecated: true,
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
      description: 'Store a picture - use /v2/picture instead'
    },
  });

  server.route({
    method: 'POST',
    path: '/v2/picture',
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
          title: Joi.string()
            .description('Caption/Title of the picture'),
          altText: Joi.string()
            .description('Alternative text for the picture'),
          license: Joi.string()
            .required().description('Used license as abbreviation (eg. "CC BY-SA 4.0")'),
          copyrightHolder: Joi.string()
            .description('Name of the copyright holder (e.g. "Jhon Doe")'),
          copyrightHolderURL: Joi.string().uri()
            .description('URL to the homepage (or social profile or ...) of the copyright holder (e.g. "https://doe.github.io"'),
          copyrightAdditions: Joi.string()
            .description('Any additional information to the copyright information, that the license might require')
        },
        headers: Joi.object({
          '----jwt----': Joi.string()
            .required()
            .description('JWT header provided by the user-service or slidwiki-platform'),
          'content-type': Joi.string()
            .required()
            .valid('image/jpeg', 'image/png', 'image/tiff', 'image/bmp')
            .description('Mime-Type of the uploaded image'), //additinally tested in picture.js on the actual file
        }).unknown(),
        failAction: handlers.storePicture
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
    path: '/PRvideo',
    handler: handlers.createPRVideo,
    config: {
    //   auth: 'jwt',
      cors: true,
      payload: {
        output: 'file',
        uploads: '/tmp/',
        maxBytes: 10485760, //100MB
        parse: true,
        allow: 'multipart/form-data',
        failAction: 'log'
      },
      validate: {
        options: { convert: true },
        payload: Joi.object({
          audioFile: Joi.object().required(),
          slideTimings: Joi.string().trim().min(5).required()
        }).required(),
        query: {
          deckID: Joi.number().integer().positive().description('Id of the Deck').required(),
          revision: Joi.number().integer().positive().description('Revision of the deck').required(),
        },
        headers: Joi.object({
          '----jwt----': Joi.string().required()
            .description('JWT header provided by the user-service or slidwiki-platform'),
        }).unknown(),
        failAction: handlers.cleanFailedValidation
      },
      plugins: {
        'hapi-swagger': {
          // consumes: ['image/jpeg', 'image/png', 'image/tiff', 'image/bmp'],
          responses: {
            ' 200 ': {
              'description': 'Successfully uploaded and stored a video, see response',
            },
            ' 401 ': {
              'description': 'Not authorized to store videos',
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
      description: 'Create and store a video of a presentation room recording'
    },
  });

  server.route({
    method: 'GET',
    path: '/video/{filename*}',
    handler: {
      directory: {
        path: conf.fsPath + 'videos/'
      }
    },
    config: {
      validate: {
        params: {
          filename: Joi.string().trim().required()
        },
      },
      plugins: {
        'hapi-swagger': {
          produces: ['video/mp4'],
          responses: {
            ' 200 ': {
              'description': 'A video is provided'
            },
            ' 400 ': {
              'description': 'Probably a parameter is missing or not allowed'
            },
            ' 404 ': {
              'description': 'No video was found'
            }
          }
        }
      },
      tags: ['api'],
      description: 'Get a video by name'
    }
  });

  server.route({
    method: 'POST',
    path: '/slideThumbnail/{id*}',
    handler: handlers.storeThumbnail,
    config: {
      validate: {
        payload: Joi.string()
          .required()
          .description('Actual HTML as string'),
        params: {
          id: Joi.string()
            .lowercase()
            .trim()
            .required()
            .description('ID of the slide as ID-REVISION')
        },
      },
      plugins: {
        'hapi-swagger': {
          deprecated: true,
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
      auth: 'jwt',
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
        }).unknown(),
        failAction: handlers.storeProfilepicture
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


  server.route({
    method: 'POST',
    path: '/thumbnail/slide/{id}/{theme?}',
    handler: handlers.storeThumbnail,
    config: {
      validate: {
        options: { convert: true },
        payload: Joi.string().required().description('HTML of a slide as a string'),
        params: {
          id: Joi.string().lowercase().trim().replace('.jpeg','').required().description('ID of the slide as ID or ID-REVISION'),
          theme: availableThemes,
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
    path: '/thumbnail/slide/{id}/{theme?}',
    handler: {
      file: {
        path: (request) => request.pre.filePath,
        confine: conf.fsPath + 'slideThumbnails/',
      },
    },
    config: {
      pre: [
        {
          method: handlers.findOrCreateThumbnail,
          assign: 'filePath',
        }
      ],
      validate: {
        options: { convert: true },
        params: {
          id: Joi.string().lowercase().trim().replace('.jpeg','').required().description('ID of the slide as ID or ID-REVISION'),
          theme: availableThemes,
        },
      },
      plugins: {
        'hapi-swagger': {
          produces: ['image/jpeg'],
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
      description: 'Get a thumbnail by slide id and theme. e.g. by requesting "1" or "1.jpeg" or "1/beige" or "1/beige.jpeg"'
    }
  });

};
