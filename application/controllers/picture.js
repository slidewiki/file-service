'use strict';

const boom = require('boom'),
  co = require('../common'),
  child = require('child_process'),
  conf = require('../configuration'),
  sizeOf = require('image-size'),
  db = require('../database/mediaDatabase'),
  readChunk = require('read-chunk'),
  fileType = require('file-type');

module.exports = {
  searchPictureAndProcess: function(request) {
    try {
      let buffer = readChunk.sync(request.payload.path, 0, 262);
      if(!['image/jpeg', 'image/png', 'image/tiff', 'image/bmp'].includes(!co.isEmpty(fileType(buffer)) ? fileType(buffer).mime : null))
        return new Promise((resolve, reject) => resolve(boom.unsupportedMediaType()));
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
      return new Promise((resolve, reject) => resolve(boom.badImplementation()));
    }
  },

  saveProfilepicture: function(request) {
    let username = request.auth.credentials.username.toLowerCase();
    let buffer = readChunk.sync(request.payload.path, 0, 262);
    if(!['image/png'].includes(!co.isEmpty(fileType(buffer)) ? fileType(buffer).mime : null))
      return new Promise((resolve, reject) => resolve(boom.unsupportedMediaType()));
    let filetype = '.' + fileType(buffer).ext;

    child.execSync('mv ' + request.payload.path + ' ' + conf.fsPath + 'pictures/profile/' + username + filetype);
    return new Promise((resolve, reject) => resolve('/pictures/profile/' + username + filetype));
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
  metaArray = metaArray.filter((line) => line.split(': ').length <= 2); //exclude all lines that contain more than one ": "
  metaArray = metaArray.filter((line) => line.search(/\S/) % 2 === 0); //exclude all lines with wrong indention
  //metaArray = metaArray.map((line) => line.replace(/.\../i, '-')); //replace dots in possible keys (not allowed in json)
  let metaObject = parse(metaArray)[0];

  let mimeType = metaObject.Mime_type;
  if (co.isEmpty(mimeType))
    throw 'No Mime-Type found';

  let title = metaArray.filter((line) => line.includes('ImageDescription:'))[0];
  title = !co.isEmpty(newTitle) ? newTitle : (!co.isEmpty(title) ? title.split(': ')[1] : undefined); //prefer submitted title

  let originalCopyright = metaArray.filter((line) => line.includes('Copyright:'))[0];
  originalCopyright = !co.isEmpty(originalCopyright) ? originalCopyright.split(': ')[1] : '';
  let slidewikiCopyright = !co.isEmpty(copyright) ? copyright : 'Held by SlideWiki User ' + owner;

  let result = {type: mimeType, fileName: sum + fileExtension, thumbnailName: sum + '_thumbnail' + fileExtension, owner: owner, license: license, slidewikiCopyright: slidewikiCopyright, originalCopyright: originalCopyright, metadata: metaObject };

  if(!co.isEmpty(title)) result.title = title;

  return result;
}

function parse(lines, level = 1, i = 0, z = {}) {

  for ( i; i < lines.length; i++) {
    let line = lines[i];
    let isHeader = line[line.length - 1] === ':';
    let lineLevel = line.search(/\S/) / 2;
    let levelDecreased = level > lineLevel;

    if (levelDecreased)
      break;

    if (isHeader) {
      let tmp = parse(lines, lineLevel + 1, i + 1, {});
      z[cleanKey(line.substring(0, line.length - 1))] = tmp[0];
      i = tmp[1];
      continue;
    }

    Object.assign(z, parseValueLine(line, {}), z);
  }

  return [z, i-1];
}

function parseValueLine(line, tmp) {
  let contentArray = line.split(': ');
  tmp[cleanKey(contentArray[0])] = contentArray[1];
  return tmp;
}

function cleanKey(toclean) {
  return toclean.toString()
    .trim()
    .replace(' ', '_')
    .replace('.', '-')
    .replace(':', '-');
}
