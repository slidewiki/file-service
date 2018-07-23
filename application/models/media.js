'use strict';

let Ajv = require('ajv');
let ajv = Ajv({
  verbose: true
}); // options can be passed, e.g. {allErrors: true}

const media = {
  type: 'object',
  properties: {
    title: {
      type: 'string'
    },
    altText: {
      type: 'string'
    },
    type: {
      type: 'string',
      enum: ['image/jpeg', 'image/png', 'image/svg+xml', 'audio/ogg', 'audio/mp3', 'audio/opus', 'video/h264', 'video/h265']
    },
    fileName: {
      type: 'string'
    },
    thumbnailName: {
      type: 'string'
    },
    owner: { //userid
      type: 'number'
    },
    license: {
      type: 'string'
    },
    copyrightHolder: {
      type: 'object',
      properties: {
        name: {
          type: 'string'
        },
        url: {
          type: 'string',
          format: 'uri'
        },
      }
    },
    copyrightAdditions: {
      type: 'string'
    },
    originalCopyright: {
      type: 'string'
    },
    metadata: {
      type: 'object'
    }
  },
  required: ['type', 'fileName', 'owner', 'license', 'metadata']
};

module.exports = ajv.compile(media);
