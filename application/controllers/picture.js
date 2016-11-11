'use strict';

const boom = require('boom'),
  co = require('../common'),
  child = require('child_process'),
  conf = require('../configuration'),
  sizeOf = require('image-size'),
  db = require('../database/mediaDatabase'),
  yaml = require('js-yaml');

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
            return boom.conflict('File already exists and is stored under ' + sum + fileExtension, result);
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
    child.execSync('mv ' + conf.tmp + '/' + sum + '* ' + conf.fsPath + '/pictures/');
    let file = createMediaObject(conf.fsPath + 'pictures/', sum, fileExtension, request.auth.credentials.userid, request.query.license, request.query.copyright, request.query.title);
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
  child.execSync('convert ' + originalPath + ' -resize 360 -quality 95 ' + conf.tmp + '/' + sum + '_thumbnail' + fileExtension);
  if (dimensions.width < 1920 && dimensions.height > 1920 || dimensions.width > 1920 && dimensions.height < 1920 || dimensions.width > 1920 && dimensions.height > 1920)
    child.execSync('convert ' + originalPath + ' -resize 1920 -quality 95 ' + conf.tmp + '/' + sum + fileExtension);
  else
    child.execSync('convert ' + originalPath + ' -quality 95 ' + conf.tmp + '/' + sum + fileExtension);
}

function createMediaObject(path, sum, fileExtension, owner, license, copyright, newTitle) {
  let metadata = child.execSync('identify -verbose ' + path + sum + fileExtension)
    .toString();
  let metaArray = metadata.split('\n').filter((line) => line.includes(':')).filter((_,i) => i !== 0); //exclude first line
  metaArray = metaArray.map((line) => line.replace(/.\../i, '-')); //replace dots in keys (not allowed in json)
  metaArray = metaArray.filter((line) => line.split(': ').length <= 2); //filter all lines that contain more than one ": "
  let metaObject = yaml.safeLoad(metaArray.join('\n'));

  let mimeType = metaObject['Mime type'];
  if (co.isEmpty(mimeType))
    throw 'No Mime-Type found';

  let title = metaArray.filter((line) => line.includes('ImageDescription:'))[0];
  title = !co.isEmpty(title) ? title.split(': ')[1] : newTitle;

  let fileCopyright = metaArray.filter((line) => line.includes('Copyright:'))[0];
  if (!co.isEmpty(copyright)) copyright = copyright.split(': ')[1];

  let result = { type: mimeType, fileName: sum + fileExtension, thumbnailName: sum + '_thumbnail' + fileExtension, owner: owner, license: license, metadata: metaObject };

  if (!co.isEmpty(title)) result.title = title;
  result.copyright = (!co.isEmpty(fileCopyright)) ? fileCopyright : ((!co.isEmpty(copyright)) ? copyright : 'Held by SlideWiki User ' + owner);

  return result;
}
