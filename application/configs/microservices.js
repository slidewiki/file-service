'use strict';

const co = require('../common');

module.exports = {
  'deck': {
    uri: (!co.isEmpty(process.env.SERVICE_URL_DECK)) ? process.env.SERVICE_URL_DECK : 'http://deckservice'
  },
  'platform':{
    uri: (!co.isEmpty(process.env.SERVICE_URL_PLATFORM)) ? process.env.SERVICE_URL_PLATFORM : 'http://platform'
  },
  'user':{
    uri: (!co.isEmpty(process.env.SERVICE_URL_USER)) ? process.env.SERVICE_URL_USER : 'http://user'
  },
};
