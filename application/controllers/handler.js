'use strict';

const boom = require('boom'),
  co = require('../common'),
  child = require('child_process');

module.exports = {
  storeFile: function(request, reply) {
    if(request.payload.bytes <= 1){
      child.execSync('rm -f '+ request.payload.path);
      reply(boom.badRequest('A payload is required'));
    } else {
      try{
        let sum = child.execSync('sha256sum '+ request.payload.path).toString().split(' ')[0];
        let hasAlpha = child.execSync('identify -format "%[channels]" ' + request.payload.path).toString().includes('a');
        if(hasAlpha){
          child.execSync('convert '+ request.payload.path +' -resize 360 -quality 95 /tmp/'+sum+'_thumbnail.png');
          child.execSync('convert '+ request.payload.path +' -resize 1920 -quality 95 /tmp/'+sum+'.png');
        } else {
          child.execSync('convert '+ request.payload.path +' -resize 360 -quality 95 /tmp/'+sum+'_thumbnail.jpg');
          child.execSync('convert '+ request.payload.path +' -resize 1920 -quality 95 /tmp/'+sum+'.jpg');
        }
        child.execSync('rm -f '+ request.payload.path);
        reply({filename: sum+(hasAlpha ? '.png': '.jpg'),
          thumbnail: sum+'_thumbnail'+(hasAlpha ? '.png': '.jpg')});
      } catch (err) {
        reply(boom.badImplementation);
      }
    }
  }
};
