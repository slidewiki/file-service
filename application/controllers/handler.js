'use strict';

const boom = require('boom'),
  child = require('child_process'),
  db = require('../database/mediaDatabase'),
  picture = require('./picture'),
  co = require('../common'),
  conf = require('../configuration'),
  path = require('path'),
  cheerio = require('cheerio'),
  puppeteer = require('puppeteer'),
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
      let folder = path.join(conf.fsPath, 'slideThumbnails', theme);
      let html = request.payload;
      let toReturn = { 'filename': fileName + fileType, 'theme': theme, 'id': fileName, 'mimeType': 'image/jpeg', 'extension': fileType};

      if(request.path.startsWith('/slideThumbnail'))//NOTE used to be backward compatible
        filePath = path.join(conf.fsPath, 'slideThumbnails', fileName + fileType);

      if (fs.existsSync(filePath))
        return response(toReturn);

      if (!fs.existsSync(folder))
        fs.mkdirSync(folder);

      html = applyThemeToSlideHTML(html, theme);

      let document = cheerio.load(html);
      let width = 0, height = 0;
      try {
        width = document('div[class=pptx2html]').css().width.replace('px', '');
        height = document('div[class=pptx2html]').css().height.replace('px', '');
      } catch (e) {
        //There's probably no css in the slide
      }
      width = width ? width : 0;
      height = height ? height : 0;
      if (width === 0 || height === 0) {
        width = '1920';
        height = '1080';
      }

      /*eslint-disable promise/always-return*/
      screenshot(html, filePath, width, height)
        .then( () => {
          child.execSync('convert ' + filePath + ' -resize 400 -quality 75 ' + filePath);//NOTE using lower quality to reduce file size, q75 has only minor visual impact
          response(toReturn);
        }).catch((err) => {
          request.log(err);
          response(boom.badImplementation(), err.message);
        });
      /*eslint-enable promise/always-return*/

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

async function screenshot(html, pathToSaveTo, width, height) {
  let browser = await puppeteer.launch();
  let page = await browser.newPage();
  page.setViewport({width: Number(width), height: Number(height)});
  page.setJavaScriptEnabled(true);

  // let loaded = page.waitForNavigation({waitUntil: 'domcontentloaded'});
  await page.setContent(html);
  // await loaded;//NOTE is not working, that's why a timeout is used TODO find better way
  await page.waitFor(500);
  await page.screenshot({path: pathToSaveTo, type: 'jpeg', quality: 100});//NOTE quality is reduced separately

  await browser.close();
}
