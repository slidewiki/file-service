'use strict';
/*eslint promise/no-callback-in-promise: "off"*/

describe('Database', () => {

  let db, helper;

  before((done) => {
    require('chai').should();
    let chai = require('chai');
    let chaiAsPromised = require('chai-as-promised');
    chai.use(chaiAsPromised);
    //expect = require('chai').expect;
    db = require('../database/mediaDatabase.js');
    helper = require('../database/helper.js');
    helper.cleanDatabase()
      .then(() => done())
      .catch((error) => done(error));
  });

  context('when having an empty database', () => {
    it('should return null when requesting a non existant metadata object', () => {
      return db.get('asd7db2daasd').should.be.fulfilled.and.become(null);
    });

    it('should return the metadata object when inserting one', () => {
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
      let res = db.insert(meta);
      let keys = Object.keys(meta);
      keys.push('_id');
      return Promise.all([
        res.should.be.fulfilled.and.eventually.not.be.empty,
        res.should.eventually.have.property('ops').that.is.not.empty,
        res.should.eventually.have.nested.property('ops[0]').that.has.all.keys(keys),
        res.should.eventually.have.nested.property('ops[0]').that.has.property('.title', meta.title)
      ]);
    });

    it('should get an previously inserted slide', () => {
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
      let ins = db.insert(meta);
      let res = ins.then((ins) => db.get(ins.ops[0].fileName));
      return Promise.all([
        res.should.be.fulfilled.and.eventually.not.be.empty,
        res.should.eventually.have.all.keys(Object.keys(meta))
      ]);
    });
  });
});
