'use strict';

const helper = require('./helper'),
  mediaModel = require('../models/media.js');

module.exports = {
  get: function(filename) {
    return helper.connectToDatabase()
      .then((db) => db.collection('media'))
      .then((col) => col.findOne({ $or: [{ fileName: filename }, { thumbnailName: filename }] }, { _id: 0 }));
  },

  insert: function(media) {
    return helper.connectToDatabase()
      .then((db) => db.collection('media'))
      .then((col) => {
        try {
          if (!mediaModel(media))
            return mediaModel.errors;
          return col.insertOne(media);
        } catch (e) {
          console.log('validation failed', e);
          return e;
        }
      });
  },

  search: function(userID) {
    return helper.connectToDatabase()
      .then((db) => db.collection('media'))
      .then((col) => col.find({ 'owner': userID }, {_id: 0, title: 1, type: 1, fileName: 1, thumbnailName: 1, license: 1, originalCopyright: 1, slidewikiCopyright: 1}).toArray());
  },
};
