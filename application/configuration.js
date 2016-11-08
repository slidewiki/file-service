'use strict';

let host = 'localhost';
const fs = require('fs');
try {
  const lines = fs.readFileSync('/etc/hosts').toString().split('\n');
  for (let i in lines) {
    if (lines[i].includes('mongodb')) {
      const entrys = lines[i].split(' ');
      host = entrys[entrys.length - 1];
      console.log('Found mongodb host. Using ' + host + ' as database host.');
    }
  }
} catch (e) {
  //Windows or no read rights (bad)
}

//read mongo port from ENV
const co = require('./common');
let port = 27017;
if (!co.isEmpty(process.env.DATABASE_PORT)){
  port = process.env.DATABASE_PORT;
}

let fsPath = '/data/files';
if (!co.isEmpty(process.env.APPLICATION_PATH)){
  fsPath = process.env.APPLICATION_PATH;
}

module.exports = {
  MongoDB: {
    PORT: port,
    HOST: host,
    NS: 'local',
    SLIDEWIKIDATABASE: 'slidewiki'
  },
  fsPath
};
