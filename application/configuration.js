'use strict';

let host = 'localhost';
const fs = require('fs');
try {
  const lines = fs.readFileSync('/etc/hosts')
    .toString()
    .split('\n');
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

const co = require('./common');
let port = 27017;
if (!co.isEmpty(process.env.DATABASE_PORT)) {
  port = process.env.DATABASE_PORT;
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

module.exports = {
  MongoDB: {
    PORT: port,
    HOST: host,
    NS: 'local',
    SLIDEWIKIDATABASE: 'slidewiki'
  },
  fsPath: fsPath,
  tmp: require('os').tmpdir(),
  JWT: {
    SERIAL: JWTSerial,
    HEADER: '----jwt----',
    ALGORITHM:  'HS512'
  },
};
