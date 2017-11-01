'use strict';

const boom = require('boom'),
  child = require('child_process'),
  db = require('../database/mediaDatabase'),
  picture = require('./picture'),
  co = require('../common'),
  conf = require('../configuration'),
  path = require('path'),
  cheerio = require('cheerio'),
  webshot = require('webshot'),
  Joi = require('joi'),
  Microservices = require('../configs/microservices'),
  juice = require('juice'),
  rp = require('request-promise-native');

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
      console.log('storeThumbnail', request);
      const fileName = request.params.slideID;
      const fileType = '.jpeg';
      const filePath = path.join(conf.fsPath, 'slideThumbnails/' + fileName + fileType);
      let html = request.payload;
      let theme = 'sky';
      // let theme = (request.params.theme && request.params.theme !== '' && typeof request.params.theme !== 'undefined')
      //   ? request.params.theme : 'default';
      //   // if{
      //
      //       reveal.getCSS(request.query.theme).then((css) => {
      //           console.log(css);
      //           for(let i=0; i < deckTree.children.length; i++){
      //               deckTree.children[i].content = reveal.applyThemeToSlideHTML(html, css);
      //           }
      //           reply(deckTree);
      //       // });
      //
      getCss(theme).then((css) => {

        html = applyThemeToSlideHTML(html, css);

        let document = cheerio.load(html);
        let pptxwidth = document('div[class=pptx2html]').css().width.replace('px', '');
        let pptxheight = document('div[class=pptx2html]').css().height.replace('px', '');
        pptxwidth = pptxwidth ? pptxwidth : 0;
        pptxheight = pptxheight ? pptxheight : 0;
        let width = 0;
        let height = 0;
        if (pptxwidth !== 0 && pptxheight !== 0) {
          width = pptxwidth;
          height = pptxheight;
        } else {
          width = 'all';
          height = 'all';
        }
        const options = {
          shotSize: {
            width: width,
            height: height,
          },
          shotOffset: {
            left: 9,
            right: 64,
            top: 9,
            bottom: 48
          },
          defaultWhiteBackground: true,
          streamType: 'jpeg',
          timeout: 7000, //in ms
          siteType: 'html',
          phantomPath: require('phantomjs2')
            .path // using phantomjs2 instead of what comes with webshot (PS: README of webshot for this)
        };

        webshot(html, filePath, options, (err) => {
          if (err) {
            request.log(err);
            request.log(html);
            response(boom.badImplementation(), err.message);
          } else{
            child.execSync('convert ' + filePath + ' -resize 400 ' + filePath);
            response({ 'filename': fileName + fileType });
          }
        });


        // console.log(css);
      }).catch((err) => {
        request.log('Error getting theme', err);
        reply(boom.badImplementation());
      });


    } catch (err) {
      request.log(err);
      //request.log(html);
      response(boom.badImplementation(), err);
    }
  },

  getMediaOfUser: (request, reply) => {
    Joi.number().integer().validate(request.params.userid, (err, value) => {
      if(!co.isEmpty(err)){
        request.log(err);
        reply(boom.badRequest('child \"userid\" fails because [\"userid\" needs to be a number]","validation":{"source":"params","keys":["userid"]}}'));
      } else {
        switch (request.query.mediaType) {
          case 'pictures':
            db.search(value, request.query.mediaType)
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
            break;
          default:
            reply(boom.notFound());
        }
      }
    });
  },

  storeProfilepicture: (request, reply) => {
    console.log(request.auth.credentials.username, 'tries to upload the profile picture');
    if(co.isEmpty(request.payload)){
      child.execSync('rm -f ' + request.payload.path);
      reply(boom.entityTooLarge('Seems like the payload was to large - 2MB max'));
    } else if (request.payload.bytes <= 1) { //no payload
      child.execSync('rm -f ' + request.payload.path); //remove tmp file
      reply(boom.badRequest('A payload is required'));
    } else if (request.params.username !== request.auth.credentials.username) {
      child.execSync('rm -f ' + request.payload.path);
      reply(boom.forbidden());
    }
    else {
      return picture.saveProfilepicture(request)
        .then((url) => {
          if (typeof url === 'string')
            reply({url: url});
          else
            reply(url);
        })
        .catch((err) => {
          try {
            child.execSync('rm -f ' + request.payload.path);
          } catch (e) {

          }
          request.log(err);
          reply(boom.badImplementation(), err);
        })
        .then(() => child.execSync('rm -f ' + request.payload.path))
        .catch((err) => {
          request.log(err);
        });
    }
  }
};



// This is needed for the thumbnail generation
function applyThemeToSlideHTML(content, css){
  // console.log(content, '\n\n\n');
  let head = '<head><style type="text/css">' + css + '</style></head>';
  let body = '<body><div class="reveal"><div class="slides"><section class="present">' + content + '</section></div></div></body>';
  let html = '<!DOCTYPE html><html>' + head + body + '</html>';
  html = juice(html);
  return html;
}

function getCss(theme){
  let req_path = Microservices.platform.uri + '/custom_modules/reveal.js/css/theme/' + theme + '.css';
  return rp(req_path);
}
