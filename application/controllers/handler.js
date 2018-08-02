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
  fs = require('fs'),
  rp = require('request-promise-native'),//QUESTION not used?!
  AwaitLock = require('await-lock');

  /*
TODO Refactor code
TODO move file validation abort removel to last methode (also in routes)
TODO exchange child.execSync to fs.XYZ
*/

let lock = new AwaitLock();
let browser = null;//NOTE filled on first use

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

  updateGraphic: function(request, reply) {
    if(co.isEmpty(request.payload)){
      reply(boom.entityTooLarge('Seems like the payload was to large - 10MB max'));
    } else if (request.payload.bytes <= 1) { //no payload
      child.execSync('rm -f ' + request.payload.path); //remove tmp file
      reply(boom.badRequest('A payload is required'));
    } else {
      picture.updateGraphic(request)
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
    /*eslint-disable promise/always-return*/
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
    /*eslint-enable promise/always-return*/
  },

  storeThumbnail: (request, response) => {
    const fileName = request.params.id;
    const theme = (request.params.theme) ? request.params.theme : 'default';
    let filePath = getThumbnailFilePath(theme, fileName);

    let folder = path.join(conf.fsPath, 'slideThumbnails', theme);
    const toReturn = { 'filename': fileName + '.jpeg', 'theme': theme, 'id': fileName, 'mimeType': 'image/jpeg', 'extension': '.jpeg'};

    if(request.path.startsWith('/slideThumbnail'))//NOTE used to be backward compatible
      filePath = path.join(conf.fsPath, 'slideThumbnails', fileName + '.jpeg');

    if (fs.existsSync(filePath) && !request.query.force)
      return response(toReturn);

    if (!fs.existsSync(folder))
      fs.mkdirSync(folder);

    /*eslint-disable promise/always-return*/
    getPictureFromSlide(filePath, request.payload, theme, true)
      .then((/*filePath*/) => {
        response(toReturn);
      }).catch((err) => {
        request.log(err);
        response(boom.badImplementation(), err.message);
      });
    /*eslint-enable promise/always-return*/
  },

  findOrCreateThumbnail: (request, reply) => {
    let filePath = getThumbnailFilePath(request.params.theme, request.params.id);

    if(fs.existsSync(filePath) && !request.query.force)
      reply(filePath);
    else {
      /*eslint-disable promise/always-return*/
      rp.get({
        uri: `${Microservices.deck.uri}/slide/${request.params.id}`,
        json: true,
      }).then((result) => {
        request.payload = result.revisions[0].content;
        handlers.storeThumbnail(request, (response) => {
          if (response.isBoom)
            reply(response);//NOTE reply with response of storeThumbnail
          else
            reply(filePath);
        });
      }).catch((err) => {
        if (err.statusCode === 404)
          reply(boom.notFound());
        else {
          request.log('error', err);
          reply(boom.badImplementation());
        }
      });
      /*eslint-enable promise/always-return*/
    }
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
              }).catch((err) => {
                request.log(err);
                reply(boom.badImplementation(), err);
              });
            /*eslint-enable promise/no-promise-in-callback, promise/always-return*/
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
    } else {
      return picture.saveProfilepicture(request)
        .then((url) => {/*eslint-disable promise/always-return*/
          if (typeof url === 'string')
            reply({url: url});
          else
            reply(url);/*eslint-enable promise/always-return*/
        }).catch((err) => {
          try {
            child.execSync('rm -f ' + request.payload.path);
          } catch (e) {
            console.log(e);
          } finally {
            request.log(err);
            reply(boom.badImplementation(), err);
          }/*eslint-disable promise/always-return*/
        }).then(() => {
          child.execSync('rm -f ' + request.payload.path);/*eslint-enable promise/always-return*/
        }).catch((err) => {
          request.log(err);
        });
    }
  },

  createPRVideo: async (request, reply) => {
    let mimeType = request.payload.audioFile.filename.toLowerCase().includes('webm') ? 'audio/webm' : 'audio/ogg';
    let currentDate = new Date().getTime();
    let path = '/tmp/' + currentDate + '/';
    let pictureListName = 'pics.txt';
    let audioTrackName = 'audioTrack' + ((mimeType === 'audio/webm') ? '.webm' : '.ogg');
    let outputName = 'D' + request.query.deckID + 'R' + request.query.revision + '-' + currentDate + '.mp4';
    fs.mkdirSync(path);
    fs.copyFileSync(request.payload.audioFile.path, path + audioTrackName);
    fs.unlinkSync(request.payload.audioFile.path);
    let slideTimes = JSON.parse(request.payload.slideTimings);// let slideTimes = { 1518009573009: '45070-2', 1518009576983: '45071-2', 1518009581167: '45072-3', 1518009587152: '45072-3' };
    let timings = Object.keys(slideTimes).sort(); //NOTE timings in order
    let slideList = getSlideList(timings, slideTimes);//TODO exclude paused times

    reply('Process started');

    let pics = await downloadSlidePictures(slideList, 1920, path);
    createFFmpegTimingsFile(pics, slideTimes, path, pictureListName);
    try {
      let exec =  require('util').promisify(child.exec);
      await exec('ffmpeg -f concat -safe 0 -i ' + path + pictureListName + ' -i ' + path + audioTrackName + ' -vsync cfr -c:v libx264 -tune stillimage -c:a aac -b:a 64k ' + path + outputName);
      fs.copyFileSync(path + outputName, require('../configuration').fsPath + '/videos/' + outputName);
      // fs.unlinkSync(path + outputName);
      console.log('Finished Video, sending mail');
      sendVideoMail(request.auth.credentials.userid, request.query.deckID, request.query.revision, currentDate, outputName);
    } catch (err) {
      console.log(err);
    } finally {
      child.execSync('rm -R ' + path);
    }
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
  },

  shutDownPuppeteer: () => {
    try {
      browser.close();
    } catch (e) {
      console.log('Puppeteeer did not shut down. Close processes manually');
    }
  }
};

function getSlideList(timings, slideTimes) {
  let slides = [];
  for (let i in timings) { //NOTE fill array from object in order of timestamps
    if(!(slideTimes[timings[i]] === 'paused' || slideTimes[timings[i]] === 'resumed')){
      slides.push(slideTimes[timings[i]]);
    }
  }
  slides = slides.map((uri) => uri.split('slide-')[1]);
  return slides;
}

function createFFmpegTimingsFile(pics, slideTimes, path, pictureListName) {//[1,2,3,p,r,4,5,p]
  let filteredSlides = [];
  let filteredTimings = [];

  let timings = Object.keys(slideTimes).sort();
  let slides = timings.map((time) => slideTimes[time]); //NOTE keeps order of slides

  for (let i = 0; i < slides.length; i++) {
    if (slides[i] !== 'paused' && slides[i + 1] !== 'paused') { //[1,2,...] & [1,2,p,r,3,4...] & [1,2,p,r,4,5,p,r,6,7...]
      filteredTimings.push(timings[i + 1] / 1000 - timings[i] / 1000);
      filteredSlides.push(pics[filteredTimings.length - 1]);
    } else if (slides[i] !== 'paused' && slides[i + 1] === 'paused' && slides.length - 1 === i + 1) { //[1,2,3,p] & [1,2,p,r,3,4,p]
      filteredTimings.push(timings[i + 1] / 1000 - timings[i] / 1000);
      filteredSlides.push(pics[filteredTimings.length - 1]);
      break;
    } else if (slides[i] !== 'paused' && slides[i + 1] === 'paused' && slides[i + 2] === 'resumed' && slides[i + 3] !== 'paused') { //[1,2,p,r,4,...] & [1,2,p,r,4,5,p,r,6...]
      filteredTimings.push(timings[i + 1] / 1000 - timings[i] / 1000);
      filteredSlides.push(pics[filteredTimings.length - 1]);
      filteredTimings.push(timings[i + 3] / 1000 - timings[i + 2] / 1000);
      filteredSlides.push(pics[filteredTimings.length - 1]);
      i += 2; //NOTE skip some timings
    } else if (slides[i] !== 'paused' && slides[i + 1] === 'paused' && slides[i + 2] === 'resumed' && slides[i + 3] === 'paused') { //[1,2,p,r,p] & [1,2,p,r,4,5,p,r,p]
      filteredTimings.push(timings[i + 1] / 1000 - timings[i] / 1000);
      filteredSlides.push(pics[filteredTimings.length - 1]);
      break;
    }
  }

  let toPrint = filteredSlides.map((pic, i) => ['file \'' + pic + '\'', 'duration ' + filteredTimings[i]]);
  toPrint = co.flattenArray(toPrint);
  fs.writeFileSync(path + pictureListName, toPrint.join('\n'));
}

function sendVideoMail(userID, deckID, revision, date, fileName) {
  return rp.post({
    uri: Microservices.user.uri + '/user/' + userID + '/sendEmail',//userid
    body: {
      reason: 2,//new video
      data: {fileName: fileName, creationDate: date, deck: deckID, revision: revision}
    },
    json: true
  }).catch((e) => {
    console.log('Error sending mail');
    console.log(e);
  });
}

function applyThemeToSlideHTML(content, theme){
  let head = `<head>
  <link rel="stylesheet" href="${Microservices.platform.uri}/custom_modules/reveal.js/css/reveal.css" />
  <link rel="stylesheet" href="${Microservices.platform.uri}/custom_modules/reveal.js/css/theme/${theme}.css" />
  </head>`;

  let body = '<body><div class="reveal"><div class="slides"><section class="present">' + content + '</section></div></div></body>';
  return '<!DOCTYPE html><html>' + head + body + '</html>';
}

async function screenshot(html, pathToSaveTo, width, height) {

  try {
    console.log('test1');
    if(browser === null){
      await lock.acquireAsync();
      try {
        if(browser === null)
          browser = await puppeteer.launch({args: ['--no-sandbox','--disable-setuid-sandbox', '--disable-dev-shm-usage'], headless: true});//NOTE fill var and keep browser open, closes automatically on process exit
      } finally {
        lock.release();
      }
    }

    let workaround = new Promise(async (resolve, reject) => {//NOTE needed for page.on('error', ...), otherwise these errors are not catched properly
      try {
        console.log('test2');
        const page = await browser.newPage();
        page.on('error', (err) => reject(err));
        console.log('test3');
        page.setViewport({width: Number(width), height: Number(height)});
        page.setJavaScriptEnabled(true);

        await page.goto(`data:text/html;charset=UTF-8,${html}`, { waitUntil: 'load' });//NOTE workaround for https://github.com/GoogleChrome/puppeteer/issues/728
        console.log('test4');
        await page.screenshot({path: pathToSaveTo, type: 'jpeg', quality: 100});//NOTE quality is reduced separately
        console.log('test5');
        await page.close();
      } catch (e) {
        reject(e);
      }
      resolve();
    });
    await workaround.catch(async (err) => {
      console.log(html);
      await browser.close();
      browser = null;
      throw err;
    });

  } catch (e) {
    console.log(e);
    throw e;
  }
}

function downloadSlidePictures(pictureList, PictureWidth, pathToSaveTo) {//pictureList: [slideID, slideID, ..]
  let promises = pictureList.map(async (slideID, i) => {
    try {
      let res = await rp.get({
        uri: Microservices.deck.uri + '/slide/' + slideID,
        json: true,
      });
      const filePath = path.join(pathToSaveTo, '' + i + '.jpeg');
      return await getPictureFromSlide(filePath, res.revisions[0].content);
    } catch(err) {
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
    }
  });

  return Promise.all(promises);
}

async function getPictureFromSlide(pathToSaveTo, html, theme = 'default', thumbnail = false) {

  if (fs.existsSync(pathToSaveTo))
    return pathToSaveTo;

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

  await screenshot(html, pathToSaveTo, width, height);
  if(thumbnail)
    child.execSync('convert ' + pathToSaveTo + ' -resize 400 -quality 75 ' + pathToSaveTo);//NOTE using lower quality to reduce file size, q75 has only minor visual impact
  return pathToSaveTo;
}

function getThumbnailFilePath(theme, fileName) {
  return path.join(conf.fsPath, 'slideThumbnails', theme, fileName + '.jpeg');//NOTE all thumbnails are generated as JPEG files
}
