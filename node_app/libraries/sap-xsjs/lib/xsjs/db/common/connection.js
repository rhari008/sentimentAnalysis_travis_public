'use strict';

var hdbext = require('@sap/hdbext');
var util = require('util');
var logger = require('../../../logging').logger;

exports = module.exports;
exports.connect = connect;

function connect(hanaOptions, cb) {
  var pool = hdbext.getPool(hanaOptions);
  pool.acquire(hanaOptions, function (err, client) {
    if (err) {
      return cb(err);
    }

    client.setAutoCommit(false);
    client.on('error', function onerror(err) {
      logger.error('HANA connection error:\t' + util.inspect(err));
    });
    cb(null, client);
  });
}
