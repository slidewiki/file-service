/*
This script updates all media records of all users - safe to execute it several times
 */

'use strict';

const co = require('./common'),
  helper = require('./database/helper'),
  async = require('async');

console.log('\x1b[31m','This script updates all media records of all users - safe to execute it several times. If it does not count, terminate the script - nothing needs to be migrated.','\x1b[0m');//strange stuff for red color

getPictures({})
  .then((cursor) => {
    cursor.count().then((count) => console.log(count + ' media records found, starting migration ...'));
    //NOTE I haven't found any other way to implement it than this one, maybe except for lazy evaluation via yield
    let q = async.queue((record, callback) => {
      partlyUpdate(
        {'_id': record._id},
        { '$unset': {'slidewikiCopyright': ''},
          '$set': {'copyrightHolder': {'name': 'User ' + record.owner}, 'copyrightAdditions': 'Migrated record, copyright information might be incomplete.'}
        }).then(() => {
          process.stdout.write('\rUpdated record ' + record._id + ' (out of order)');
          callback();
        });
    }, Infinity);

    cursor.forEach((record) => {
      if(!co.isEmpty(record) && record.slidewikiCopyright && record._id){
        q.push(record);
      }
    });
    q.drain = function() {
      if (cursor.isClosed()) {
        console.log('\n');
        console.log('All records have been updated');
        process.exit(0);
      }
    };
  });

function getPictures(query) {
  return helper.connectToDatabase()
    .then((db) => db.collection('media'))
    .then((col) => col.find(query));
}

function partlyUpdate(findQuery, updateQuery, params = undefined) {
  return helper.connectToDatabase()
    .then((db) => db.collection('media'))
    .then((collection) => collection.update(findQuery, updateQuery, params));
}
