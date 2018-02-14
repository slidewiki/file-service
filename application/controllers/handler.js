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
  fs = require('fs'),
  rp = require('request-promise-native');//QUESTION not used?!

let handlers = module.exports = {
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
      /*eslint-disable promise/always-return*/
      .then((result) => {
        if(co.isEmpty(result))
          reply(boom.notFound());
        else
          reply(result);
      })/*eslint-enable promise/always-return*/
      .catch((err) => {
        request.log(err);
        reply(boom.badImplementation(), err);
      });

  },

  storeThumbnail: (request, response) => {
    try {

      const fileName = request.params.id;
      const fileType = '.jpeg';
      const theme = (request.params.theme) ? request.params.theme : 'default';
      let filePath = path.join(conf.fsPath, 'slideThumbnails', theme, fileName + fileType);
      let html = request.payload;
      let toReturn = { 'filename': fileName + fileType, 'theme': theme, 'id': fileName, 'mimeType': 'image/jpeg', 'extension': fileType};

      if(request.path.startsWith('/slideThumbnail'))//NOTE used to be backward compatible
        filePath = path.join(conf.fsPath, 'slideThumbnails', fileName + fileType);

      if (fs.existsSync(filePath))
        return response(toReturn);

      html = applyThemeToSlideHTML(html, theme);

      let document = cheerio.load(html);
      let pptxheight = 0, pptxwidth = 0;
      try {
        pptxwidth = document('div[class=pptx2html]').css().width.replace('px', '');
        pptxheight = document('div[class=pptx2html]').css().height.replace('px', '');
      } catch (e) {
        //There's probably no css in the slide
      }
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
          response(boom.badImplementation(), err.message);
        } else{
          child.execSync('convert ' + filePath + ' -resize 400 ' + filePath);
          response(toReturn);
        }
      });

    } catch (err) {
      request.log(err);
      response(boom.badImplementation(), err);
    }
  },

  findOrCreateThumbnail: (request, reply) => {
    let filePath = path.join(conf.fsPath, 'slideThumbnails', request.params.theme, request.params.id + '.jpeg');//NOTE all thumbnails are generated as JPEG files

    fs.exists(filePath, (found) => {
      if (found)
        reply(filePath);
      else {//NOTE fetch the slide content to create the thumbnail
        rp.get({
          uri: `${Microservices.deck.uri}/slide/${request.params.id}`,
          json: true,
        /*eslint-disable promise/always-return*/
        }).then((res) => {
          request.payload = res.revisions[0].content;
          handlers.storeThumbnail(request, (response) => {
            if (response.isBoom)
              reply(response); //NOTE end the request by returning the error
            else
              reply(filePath);
          });
        /*eslint-enable promise/always-return*/
        }).catch((err) => {
          if (err.statusCode === 404)
            reply(boom.notFound());
          else {
            request.log('error', err);
            reply(boom.badImplementation());
          }
        });
      }
    });

  },

  getMediaOfUser: (request, reply) => {
    Joi.number().integer().validate(request.params.userid, (err, value) => {
      if(!co.isEmpty(err)){
        request.log(err);
        reply(boom.badRequest('child "userid " fails because ["userid" needs to be a number]","validation":{"source":"params","keys":["userid"]}}'));
      } else {
        switch (request.query.mediaType) {
          case 'pictures':
            /*eslint-disable promise/no-promise-in-callback, promise/always-return*/
            db.search(value, request.query.mediaType)
              .then((result) => {
                if(co.isEmpty(result))
                  reply(boom.notFound());
                else
                  reply(result);
              })/*eslint-enable promise/no-promise-in-callback, promise/always-return*/
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
        .then((url) => {/*eslint-disable promise/always-return*/
          if (typeof url === 'string')
            reply({url: url});
          else
            reply(url);
        })/*eslint-enable promise/always-return*/
        .catch((err) => {
          try {
            child.execSync('rm -f ' + request.payload.path);
          } catch (e) {
            console.log(e);
          }
          request.log(err);
          reply(boom.badImplementation(), err);
        })
        .then(() => child.execSync('rm -f ' + request.payload.path))
        .catch((err) => {
          request.log(err);
        });
    }
  },

  createPRVideo: (request, reply) => {
    let slideTimes = JSON.parse(request.payload.slideTimings);
    // let slideTimes = { 1518009573009: '45070-2', 1518009576983: '45071-2', 1518009581167: '45072-3', 1518009587152: '45072-3' };
    let mimeType = request.payload.audioFile.filename.toLowerCase().includes('webm') ? 'audio/webm' : 'audio/ogg';
    let currentDate = new Date().getTime();
    let path = '/tmp/' + currentDate + '/';
    let pictureListName = 'pics.txt';
    let audioTrackName = 'audioTrack' + ((mimeType === 'audio/webm') ? '.webm' : '.ogg');
    let outputName = 'D' + request.query.deckID + 'R' + request.query.revision + '-' + currentDate + '.mp4';
    fs.mkdirSync(path);
    fs.copyFileSync(request.payload.audioFile.path, path + audioTrackName);
    fs.unlinkSync(request.payload.audioFile.path);
    let timings = Object.keys(slideTimes).sort(); //NOTE timings in order
    let slides = [];
    for (let i in timings) { //NOTE fill array from object in order of timestamps
      slides.push(slideTimes[timings[i]]);
    }
    let slideList = slides.slice(0, slides.length - 1);
    slideList = slideList.map((uri) => uri.split('slide-')[1]);
    console.log(slideList);
    reply('Process started');
    /* eslint-disable promise/catch-or-return,promise/always-return */
    downloadSlidePictures(slideList, 1920, path).
      then((pics) => {//pics: [pathToPicture, pathToPicture, pathToPicture]
        let toPrint = pics.map((pic, i) => {
          let duration = (timings[i + 1] / 1000 - timings[i] / 1000);
          duration = duration < 0 ? 0.1 : duration;
          return ['file \'' + pic + '\'', 'duration ' + duration];
        });
        toPrint = flatten(toPrint);
        fs.writeFileSync(path + pictureListName, toPrint.join('\n'));
        let exec =  require('util').promisify(child.exec);
        return exec('ffmpeg -f concat -safe 0 -i ' + path + pictureListName + ' -i ' + path + audioTrackName + ' -vsync cfr -c:v libx264 -tune stillimage -c:a aac -b:a 64k ' + path + outputName)
          .then(() => {
            fs.copyFileSync(path + outputName, require('../configuration').fsPath + '/videos/' + outputName);
            fs.unlinkSync(path + outputName);
            console.log('Finished Video');
          }).catch((e) => {
            console.log('Error running ffmpeg');
            console.log(e);
          });
      }).catch((err) => console.log(err)).then(() => {
        // fs.rmdirSync(path);//directory not empty
        child.execSync('rm -R ' + path);
      });
    /*eslint-enable promise/always-return*/
  },

  cleanFailedValidation: function(request, reply, query, err) {
    try {
      switch(request.route.path){
        case '/PRvideo':
          child.execSync('rm -f ' + request.payload.audioFile.path);
          break;
      }
    } catch (e) {
      console.log('unable to delete files', request);
    } finally {
      reply(err);
    }
  }
};

function applyThemeToSlideHTML(content, theme){
  let head = `<head>
  <link rel="stylesheet" href="${Microservices.platform.uri}/custom_modules/reveal.js/css/reveal.css" />
  <link rel="stylesheet" href="${Microservices.platform.uri}/custom_modules/reveal.js/css/theme/${theme}.css" />
  </head>`;

  let body = '<body><div class="reveal"><div class="slides"><section class="present">' + content + '</section></div></div></body>';
  let html = '<!DOCTYPE html><html>' + head + body + '</html>';

  html = juice(html);
  return html;
}

function downloadSlidePictures(pictureList, PictureWidth, pathToSaveTo) {//pictureList: [slideID, slideID, ..]
  let promises = pictureList.map((slideID, i) => {
    return rp.get({
      uri: Microservices.deck.uri + '/slide/' + slideID,
      json: true,
    })
      .then((res) => {
        return getPictureFromSlide('' + i, pathToSaveTo, res.revisions[0].content);
      })
      .catch((err) => {
        switch(err.statusCode){
          case 404:
            console.log('Picture not found - ' + slideID);
            break;
          case 500:
            console.log('Server error at requesting slide ' + slideID);
            break;
          default:
            console.log('Another error ', slideID, err);
        }
        let appDir = require('path').dirname(require.main.filename);
        return appDir + '/black_1920x1080.jpg';//TODO if first pic is 16:9, whole video is 16:9
      });
  });

  return Promise.all(promises);
}

function getPictureFromSlide(fileName, pathToSaveTo, html, theme = 'default') {//eslint-disable-line
  return new Promise((resolve, reject) => {
    try {
      const fileType = '.jpeg';
      let filePath = path.join(pathToSaveTo, fileName + fileType);

      if (fs.existsSync(filePath))
        resolve(filePath);

      html = applyThemeToSlideHTML(html, theme);

      let document = cheerio.load(html);
      let pptxheight = 0, pptxwidth = 0;
      try {
        pptxwidth = document('div[class=pptx2html]').css().width.replace('px', '');
        pptxheight = document('div[class=pptx2html]').css().height.replace('px', '');
      } catch (e) {
        //There's probably no css in the slide
      }
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
        phantomPath: require('phantomjs2').path // using phantomjs2 instead of what comes with webshot (PS: README of webshot for this)
      };

      webshot(html, filePath, options, (err) => {
        if (err) {
          reject(err);
        } else {
          resolve(filePath);
        }
      });

    } catch (err) {
      reject(err);
    }
  });
}


function flatten(arr, result = []) {
  for (let i = 0, length = arr.length; i < length; i++) {
    const value = arr[i];
    if (Array.isArray(value)) {
      flatten(value, result);
    } else {
      result.push(value);
    }
  }
  return result;
}
