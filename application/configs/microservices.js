'use strict';

const co = require('../common');

module.exports = {
  'platform':{
    uri: (!co.isEmpty(process.env.SERVICE_URL_PLATFORM)) ? process.env.SERVICE_URL_PLATFORM : 'http://platform'
  },
};
