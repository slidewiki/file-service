'use strict';

let Ajv = require('ajv');
let ajv = Ajv({
  verbose: true
}); // options can be passed, e.g. {allErrors: true}

const media = {
  type: 'object',
  properties: {
    _id: {
      type: 'string',
      maxLength: 24,
      minLength: 24
    },
    title: {
      type: 'string'
    },
    type: {
      type: 'string',
      enum: ['image/jpeg', 'image/png', 'audio/ogg', 'audio/mp3', 'audio/opus', 'video/h264', 'video/h265']
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
      type: 'string',
      enum: ['CC0', 'Creative Commons 4.0', 'Creative Commons 3.0']
    },
    originalCopyright: {
      type: 'string'
    },
    slidewikiCopyright: {
      type: 'string'
    },
    metadata: {
      type: 'object'
    }
  },
  required: ['type', 'fileName', 'owner', 'license', 'originalCopyright', 'slidewikiCopyright', 'metadata']
};

module.exports = ajv.compile(media);
