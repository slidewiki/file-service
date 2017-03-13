'use strict';

const boom = require('boom'),
  child = require('child_process'),
  db = require('../database/mediaDatabase'),
  picture = require('./picture'),
  co = require('../common'),
  conf = require('../configuration'),
  path = require('path'),
  webshot = require('webshot');

module.exports = {
  storePicture: function(request, reply) {
    if(co.isEmpty(request.payload)){
      reply(boom.entityTooLarge('Seems like the payload was to large - 10MB max'));
    } else if (request.payload.bytes <= 1) { //no payload
      child.execSync('rm -f ' + request.payload.path); //remove tmp file
      reply(boom.badRequest('A payload is required'));
    } else {
      picture.searchPictureAndProcess(request)
        .then((result) => reply(result))
        .catch((err) => {
          request.log(err);
          reply(boom.badImplementation(), err);
        })
        .then(() => child.execSync('rm -f ' + request.payload.path))
        .catch((err) => request.log(err));
    }
  },

  getMetaData: function(request, reply) {
    db.get(request.params.filename)
      .then((result) => {
        if(co.isEmpty(result))
          reply(boom.notFound());
        else
          reply(result);
      })
      .catch((err) => {
        request.log(err);
        reply(boom.badImplementation(), err);
      });
  },

  storeThumbnail: (request, response) => {
    try {
      let filename = request.payload.slideID;
      let filepath = path.join(conf.fsPath, 'slidethumbnails/' + filename + '.png'); //TODO implement filename
      const html = request.payload.html;
      const options = {
        screenSize: {
          width: '1024',
          height: '900',
        },
        shotSize: {
          width: '1024',
          height: '900',
        },
        shotOffset: {
          left: 0,
          top: 0,
          right: 0,
          bottom: 0,
        },
        timeout: 7000, //in ms
        siteType: 'html',
        phantomPath: require('phantomjs2').path // using phantomjs2 instead of what comes with webshot (PS: README of webshot for this)
      };

      webshot(html, filepath, options, (err) => {
        if (err){
          request.log(err);
          response(boom.badImplementation(), err.message);
        }
      });
      response({'filename': filename});
    }
    catch (err) {
      request.log(err);
      response(boom.badImplementation(), err);
    }
  }
};
