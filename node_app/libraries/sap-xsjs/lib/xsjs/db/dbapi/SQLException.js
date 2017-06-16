'use strict';

var util = require('util');

module.exports = SQLException;

util.inherits(SQLException, Error);

function SQLException(message, code) {
  Error.call(this, message);
  Error.captureStackTrace(this, arguments['callee']);
  this.code = code || 0;
}