'use strict';

describe('REST API', () => {

  let server,db;

  const secret = 'NeverShareYourSecret';

  beforeEach((done) => {
    //Clean everything up before doing new tests
    Object.keys(require.cache).forEach((key) => delete require.cache[key]);
    require('chai').should();
    db = require('../database/mediaDatabase.js');
    let hapi = require('hapi');
    server = new hapi.Server();
    server.connection({
      host: 'localhost',
      port: 3000
    });

    server.register([require('inert'), require('hapi-auth-jwt2')], (err) => {
      if (err) {
        console.error(err);
        global.process.exit();
      } else {
        server.auth.strategy('jwt', 'jwt', {
          key: secret,
          validateFunc: (decoded, request, callback) => {callback(null, true);},
          headerKey: '----jwt----',
        });
      }

      require('../routes.js')(server);
      done();
    });

  });

  let meta = {
    title: 'Dummy',
    type: 'image/jpeg',
    fileName: 'abc.jpg',
    thumbnailName: 'abc_thumbnail.jpg',
    owner: 33,
    license: 'CC0',
    originalCopyright: 'Held by no one',
    slidewikiCopyright: 'Held by no one',
    metadata: {}
  };

  let options1 = {
    method: 'GET',
    url: '/metadata/abc.jpg',
    headers: {
      'Content-Type': 'application/json'
    }
  };

  let options2 = {
    method: 'GET',
    url: '/metadata/abc_thumbnail.jpg',
    headers: {
      'Content-Type': 'application/json'
    }
  };

  let options3 = {
    method: 'GET',
    url: '/metadata/xyz.jpg',
    headers: {
      'Content-Type': 'application/json'
    }
  };

  context('when metadata is available', () => {
    it('should reply it by the filename', (done) => {
      let tmp = Object.assign({}, meta);
      db.insert(tmp).then(
        server.inject(options1, (response) => {() =>
          response.should.be.an('object').and.contain.keys('statusCode','payload');
          response.statusCode.should.equal(200);
          response.payload.should.be.an('string');
          let payload = JSON.parse(response.payload);
          payload.should.be.an('object').and.contain.keys(Object.keys(meta));
          payload.title.should.equal(meta.title);
          done();
        })
      );
    });

    it('should reply it by the thumbnailname', (done) => {
      let tmp = Object.assign({}, meta);
      db.insert(tmp).then(
        server.inject(options2, (response) => {() =>
          response.should.be.an('object').and.contain.keys('statusCode','payload');
          response.statusCode.should.equal(200);
          response.payload.should.be.an('string');
          let payload = JSON.parse(response.payload);
          payload.should.be.an('object').and.contain.keys(Object.keys(meta));
          payload.title.should.equal(meta.title);
          done();
        })
      );
    });
    context('when metadata is not available', () => {
      it('should reply with 404', (done) => {
        server.inject(options3, (response) => {() =>
          response.should.be.an('object').and.contain.keys('statusCode','payload');
          response.statusCode.should.equal(404);
          response.payload.should.be.an('string');
          let payload = JSON.parse(response.payload);
          payload.should.be.an('object').and.contain.keys('error', 'statusCode');
          payload.statusCode.should.equal(404);
          done();
        });
      });
    });
  });
});
