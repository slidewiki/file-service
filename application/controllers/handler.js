'use strict';

const boom = require('boom'),
  co = require('../common'),
  child = require('child_process'),
  conf = require('../configuration'),
  sizeOf = require('image-size'),
  db = require('../database/mediaDatabase');

module.exports = {
  storeFile: function(request, reply) {
    if (request.payload.bytes <= 1) {
      child.execSync('rm -f ' + request.payload.path);
      reply(boom.badRequest('A payload is required'));
    } else {
      try {
        let hasAlpha = child.execSync('identify -format "%[channels]" ' + request.payload.path)
          .toString()
          .includes('a');
        let fileExtension = hasAlpha ? '.png' : '.jpg';
        let sum = optimizePictures(request.payload.path, fileExtension);
        moveFiles(request.payload.path, sum);
        let file = createMediaObject(conf.fsPath + 'pictures/', sum, fileExtension, request.auth.credentials.userid, request.query.license);
        db.insert(file).then((result) => {
          if (!co.isEmpty(result[0]))
            return reply(boom.badData('File storage failed because data is wrong: ', co.parseAjvValidationErrors(result)));
          else
            return reply({
              filename: sum + fileExtension,
              thumbnail: sum + '_thumbnail' + fileExtension
            });
        }).catch((err) => {
          request.log(err);
          reply(boom.badImplementation,err);
        });
      } catch (err) {
        request.log(err);
        reply(boom.badImplementation);
      }
    }
  }
};

function optimizePictures(originalPath, fileExtension) {
  let dimensions = sizeOf(originalPath);
  let sum = child.execSync('sha256sum ' + originalPath)
    .toString()
    .split(' ')[0];
  child.execSync('convert ' + originalPath + ' -resize 360 -quality 95 /tmp/' + sum + '_thumbnail' + fileExtension);
  if (dimensions.width < 1920 && dimensions.height > 1920 || dimensions.width > 1920 && dimensions.height < 1920 || dimensions.width > 1920 && dimensions.height > 1920)
    child.execSync('convert ' + originalPath + ' -resize 1920 -quality 95 /tmp/' + sum + fileExtension);
  else
    child.execSync('convert ' + originalPath + ' -quality 95 /tmp/' + sum + fileExtension);
  return sum;
}

function moveFiles(originalPath, sum) {
  child.execSync('mv /tmp/' + sum + '* ' + conf.fsPath + '/pictures/');
  child.execSync('rm -f ' + originalPath);
}

function createMediaObject(path, sum, fileExtension, owner, license) {
  let metadata = child.execSync('identify -verbose ' + path + sum + fileExtension).toString();
  let metaArray = metadata.split('\n');
  let mimeType = metaArray.filter((line) => line.includes('Mime type:'))[0].split(': ')[1];
  if(co.isEmpty(mimeType))
    throw 'No Mime-Type found';
  let title = '';
  return { title: title, type: mimeType, fileName: sum + fileExtension, thumbnailName: sum + '_thumbnail' + fileExtension, owner: owner, license: license, metadata: metadata };
}
