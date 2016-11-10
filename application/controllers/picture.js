'use strict';

const boom = require('boom'),
  co = require('../common'),
  child = require('child_process'),
  conf = require('../configuration'),
  sizeOf = require('image-size'),
  db = require('../database/mediaDatabase');

module.exports = {
  searchPictureAndProcess: function(request) {
    try {
      let hasAlpha = child.execSync('identify -format "%[channels]" ' + request.payload.path)
        .toString()
        .includes('a');
      let fileExtension = hasAlpha ? '.png' : '.jpg';
      let sum = child.execSync('sha256sum ' + request.payload.path)
        .toString()
        .split(' ')[0];
      return db.get(sum + fileExtension)
        .then((result) => {
          if (co.isEmpty(result))
            return processPicture(request, sum, fileExtension);
          else
            return boom.conflict('File already exists and is stored under ' + sum + fileExtension);
        });
    } catch (err) {
      request.log(err);
      return boom.badImplementation();
    }
  }
};

function processPicture(request, sum, fileExtension) {
  try {
    optimizePictures(request.payload.path, fileExtension, sum);
    moveFiles(request.payload.path, sum);
    let file = createMediaObject(conf.fsPath + 'pictures/', sum, fileExtension, request.auth.credentials.userid, request.query.license);
    return db.insert(file)
      .then((result) => {
        if (!co.isEmpty(result[0]))
          return boom.badData('File storage failed because data is wrong: ', co.parseAjvValidationErrors(result));
        else
          return db.get(sum + fileExtension);
      });
  } catch (err) {
    request.log(err);
    return boom.badImplementation();
  }
}

function optimizePictures(originalPath, fileExtension, sum) {
  let dimensions = sizeOf(originalPath);
  child.execSync('convert ' + originalPath + ' -resize 360 -quality 95 /tmp/' + sum + '_thumbnail' + fileExtension);
  if (dimensions.width < 1920 && dimensions.height > 1920 || dimensions.width > 1920 && dimensions.height < 1920 || dimensions.width > 1920 && dimensions.height > 1920)
    child.execSync('convert ' + originalPath + ' -resize 1920 -quality 95 /tmp/' + sum + fileExtension);
  else
    child.execSync('convert ' + originalPath + ' -quality 95 /tmp/' + sum + fileExtension);
}

function moveFiles(originalPath, sum) {
  child.execSync('mv /tmp/' + sum + '* ' + conf.fsPath + '/pictures/');
  child.execSync('rm -f ' + originalPath);
}

function createMediaObject(path, sum, fileExtension, owner, license) {
  let metadata = child.execSync('identify -verbose ' + path + sum + fileExtension)
    .toString();
  let metaArray = metadata.split('\n');

  let mimeType = metaArray.filter((line) => line.includes('Mime type:'))[0].split(': ')[1];
  if (co.isEmpty(mimeType))
    throw 'No Mime-Type found';

  let title = metaArray.filter((line) => line.includes('ImageDescription:'))[0];
  if (!co.isEmpty(title)) title = title.split(': ')[1];

  let copyright = metaArray.filter((line) => line.includes('Copyright:'))[0];
  if (!co.isEmpty(copyright)) copyright = copyright.split(': ')[1];

  let result = { type: mimeType, fileName: sum + fileExtension, thumbnailName: sum + '_thumbnail' + fileExtension, owner: owner, license: license, metadata: metadata };

  if (!co.isEmpty(title)) result.title = title;
  result.copyright = (!co.isEmpty(copyright)) ? copyright : 'Held by SlideWiki User ' + owner;
  
  return result;
}
