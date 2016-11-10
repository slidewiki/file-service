'use strict';

const boom = require('boom'),
  child = require('child_process'),
  db = require('../database/mediaDatabase'),
  picture = require('./picture');

module.exports = {
  storeFile: function(request, reply) {
    if (request.payload.bytes <= 1) {
      child.execSync('rm -f ' + request.payload.path);
      reply(boom.badRequest('A payload is required'));
    } else {
      picture.searchPictureAndProcess(request)
        .then((result) => reply(result))
        .catch((err) => {
          request.log(err);
          reply(boom.badImplementation(), err);
        });
    }
  },

  getMetaData: function(request, reply) {
    db.get(request.params.filename)
      .then((result) => {
        if(co.isEmpty(resut))
          reply(boom.notFound());
        else
          reply(result);
      })
      .catch((err) => {
        request.log(err);
        reply(boom.badImplementation(), err);
      });
  }
};
