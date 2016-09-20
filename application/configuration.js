/* This module is used for confugrating the mongodb connection*/
'use strict';

const co = require('./common');
let port = 8080;
if (!co.isEmpty(process.env.DATABASE_PORT)){
  port = process.env.DATABASE_PORT;
}
let path = '/data/files';
if (!co.isEmpty(process.env.APPLICATION_PATH)){
  path = process.env.APPLICATION_PATH;
}

module.exports = {
  PORT: port,
  PATH: path
};
