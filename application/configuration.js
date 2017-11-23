'use strict';

const co = require('./common');

let host = 'localhost';
//read mongo URL from /etc/hosts
const fs = require('fs');
try {
  const lines = fs.readFileSync('/etc/hosts').toString().split('\n');
  lines.filter((line) => line.includes('mongodb')).forEach((line) => {
    const entries = line.split(' ');
    host = entries[entries.length - 1];
    console.log('Using ' + host + ' as database host.');
  });
} catch (e) {
  console.log('Exception: Windows or no read rights to read /etc/hosts (bad)');
}
//read mongo URL from ENV
host = (!co.isEmpty(process.env.DATABASE_URL)) ? process.env.DATABASE_URL : host;
if(host !== 'localhost')
  console.log('Using ' + host + ' as database host.');

let port = 27017;
if (!co.isEmpty(process.env.DATABASE_PORT)){
  port = process.env.DATABASE_PORT;
  console.log('Using ' + port + ' as database port.');
}

let fsPath = './';
if (!co.isEmpty(process.env.APPLICATION_PATH)) {
  fsPath = process.env.APPLICATION_PATH;
}
fsPath = fsPath.endsWith('/') ? fsPath : fsPath + '/';

let JWTSerial = '69aac7f95a9152cd4ae7667c80557c284e413d748cca4c5715b3f02020a5ae1b';
if (!co.isEmpty(process.env.JWT_SERIAL)){
  JWTSerial = process.env.JWT_SERIAL;
}

let slidewikiDbName = 'slidewiki';
if (process.env.NODE_ENV === 'test') {
  slidewikiDbName = 'slidewiki_test';
}

module.exports = {
  MongoDB: {
    PORT: port,
    HOST: host,
    NS: 'local',
    SLIDEWIKIDATABASE: slidewikiDbName
  },
  fsPath: fsPath,
  tmp: require('os').tmpdir(),
  JWT: {
    SERIAL: JWTSerial,
    HEADER: '----jwt----',
    ALGORITHM:  'HS512'
  },
};
