'use strict';

var _ = require('lodash');

module.exports.execWithMetadata = execWithMetadata;


function execWithMetadata(client, sql, sqlArgs, cb) {
  if (!_.isString(sql)) {
    return cb(new Error('Invalid sql passed to hdb'));
  }

  function fetchRowsWithMetadata(err, rs) {
    if (err || !rs || !rs.fetch) {
      return cb(err, rs);
    }
    rs.fetch(function (err, rows) {
      if (err) {
        return cb(err);
      }
      rows._metadata = rs.metadata;
      cb(null, rows);
    });
  }

  if (!sqlArgs || (Array.isArray(sqlArgs) && !sqlArgs.length)) {
    return client.execute(sql, fetchRowsWithMetadata);
  }

  client.prepare(sql, function (err, st) {
    if (err) {
      return cb(err);
    }
    if (sqlArgs.length === 1 && Array.isArray(sqlArgs[0])) {
      sqlArgs = sqlArgs[0];
    }
    return st.execute(sqlArgs, fetchRowsWithMetadata);
  });
}
