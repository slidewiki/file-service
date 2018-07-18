'use strict';

const boom = require('boom'),
  co = require('../common'),
  child = require('child_process'),
  conf = require('../configuration'),
  sizeOf = require('image-size'),
  db = require('../database/mediaDatabase'),
  readChunk = require('read-chunk'),
  fileType = require('file-type'),
  is_svg = require('is-svg'),
  fs = require('fs');

module.exports = {
  searchPictureAndProcess: function(request) {
    try {
      let isSVG = false;
      let buffer = readChunk.sync(request.payload.path, 0, 262);
      if(!['image/jpeg', 'image/png', 'image/tiff', 'image/bmp'].includes(!co.isEmpty(fileType(buffer)) ? fileType(buffer).mime : null)){
        //NOTE check for svg as file-type can't check for svg
        let fileContent = fs.readFileSync(request.payload.path, {encoding: 'utf8'});
        isSVG = is_svg(fileContent);
        if(!isSVG)
          return new Promise((resolve, reject) => resolve(boom.unsupportedMediaType()));
      }
      let fileExtension;
      if(!isSVG){
        let hasAlpha = child.execSync('identify -format "%[channels]" ' + request.payload.path)
          .toString()
          .includes('a');
        fileExtension = hasAlpha ? '.png' : '.jpg';
      } else
        fileExtension = '.svg';
      let sum = child.execSync('sha256sum ' + request.payload.path)
        .toString()
        .split(' ')[0];
      return db.get(sum + fileExtension)
        .then((result) => {
          if (co.isEmpty(result)){
            return processPicture(request, sum, fileExtension);
          } else
            return boom.conflict('File already exists and is stored under ' + sum + fileExtension, result);
        });
    } catch (err) {
      request.log(err);
      return new Promise((resolve, reject) => resolve(boom.badImplementation()));
    }
  },

  updateGraphic: function(request) {
    try {
      let fileContent = fs.readFileSync(request.payload.path, {encoding: 'utf8'});
      let isSVG = is_svg(fileContent);
      if(!isSVG)
        return new Promise((resolve, reject) => resolve(boom.unsupportedMediaType()));
      let fileExtension = '.svg';
      let sum = request.params.filename.split('.')[0];
      return db.get(sum + fileExtension, true)
        .then((result) => {
          if (co.isEmpty(result)){
            return boom.NotFound();
          } else {
            if(request.auth.credentials.userid === result.owner)
              return processGraphicUpdate(request, sum, fileExtension, result);
            else
              return boom.unauthorized();
          }
        });
    } catch (err) {
      request.log(err);
      return new Promise((resolve, reject) => resolve(boom.badImplementation()));
    }
  },

  saveProfilepicture: function(request) {
    let dimensions = sizeOf(request.payload.path);
    if (dimensions.height !== dimensions.width)
      return new Promise((resolve, reject) => resolve(boom.notAcceptable()));
    let username = request.auth.credentials.username.toLowerCase();
    let buffer = readChunk.sync(request.payload.path, 0, 262);
    if(!['image/png'].includes(!co.isEmpty(fileType(buffer)) ? fileType(buffer).mime : null))
      return new Promise((resolve, reject) => resolve(boom.unsupportedMediaType()));
    let filetype = '.' + fileType(buffer).ext;

    child.execSync('mv ' + request.payload.path + ' ' + conf.fsPath + 'pictures/profile/' + username + filetype);
    return new Promise((resolve, reject) => resolve('/pictures/profile/' + username + filetype));
  }
};

function processGraphicUpdate(request, sum, fileExtension, dbEntry) {
  try{
    child.execSync('mv ' + request.payload.path + ' ' + conf.fsPath + '/graphics/' + sum + fileExtension);
    let targetPath = conf.fsPath + 'graphics/';
    let title = (request.query.title) ? request.query.title : ((dbEntry.title) ? dbEntry.title : '');
    let altText = (request.query.altText) ? request.query.altText : ((dbEntry.altText) ? dbEntry.altText : '');
    let copyrightHolder = (dbEntry.copyrightHolder) ? dbEntry.copyrightHolder.name : undefined;
    let copyrightHolderURL = (dbEntry.copyrightHolder) ? dbEntry.copyrightHolder.URL : undefined;
    let file = createMediaObject(targetPath, sum, fileExtension, dbEntry.owner, title, altText, dbEntry.license, copyrightHolder, copyrightHolderURL, dbEntry.copyrightAdditions);
    file._id = dbEntry._id;
    return db.update(file)
      .then((result) => {
        if (!co.isEmpty(result[0]))
          return boom.badData('File storage failed because data is wrong: ', co.parseAjvValidationErrors(result));
        else
          return file;
      });
  } catch (err) {
    request.log(err);
    return boom.badImplementation();
  }
}

function processPicture(request, sum, fileExtension) {
  try {
    let targetPath = '';
    if( fileExtension !== '.svg' ){
      optimizePictures(request.payload.path, fileExtension, sum);
      child.execSync('mv ' + conf.tmp + '/' + sum + '* ' + conf.fsPath + '/pictures/');
      targetPath = conf.fsPath + 'pictures/';
    } else {
      child.execSync('mv ' + request.payload.path + ' ' + conf.fsPath + '/graphics/' + sum + fileExtension);
      targetPath = conf.fsPath + 'graphics/';
    }
    let file = createMediaObject(targetPath, sum, fileExtension, request.auth.credentials.userid, request.query.title, request.query.altText, request.query.license, request.query.copyrightHolder, request.query.copyrightHolderURL, request.query.copyrightAdditions, request.query.copyright);
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

//NOTE parameter copyright is used for backward compatibility to an deprecated route
//NOTE currently only used to store pictures, thus thumbnailName is always filled (even though not explicitly required)
function createMediaObject(path, sum, fileExtension, owner, newTitle, altText, license, copyrightHolder, copyrightHolderURL, copyrightAdditions, copyright) {
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
  originalCopyright = !co.isEmpty(originalCopyright) ? originalCopyright.split(': ')[1] : undefined;

  copyrightAdditions = !co.isEmpty(copyright) ? copyright : copyrightAdditions;

  let result = {
    type: mimeType,
    fileName: sum + fileExtension,
    owner: owner,
    license: license,
    metadata: metaObject
  };
  //optional values
  if(mimeType !== 'image/svg+xml') result.thumbnailName = sum + '_thumbnail' + fileExtension;
  if(!co.isEmpty(title)) result.title = title;
  if(!co.isEmpty(altText)) result.altText = altText;
  if(!co.isEmpty(copyrightHolder)) result.copyrightHolder = { name: copyrightHolder};
  if(!co.isEmpty(copyrightHolderURL)) result.copyrightHolder.url = copyrightHolderURL;
  if(!co.isEmpty(copyrightAdditions)) result.copyrightAdditions = copyrightAdditions;
  if(!co.isEmpty(originalCopyright)) result.originalCopyright = originalCopyright;

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
