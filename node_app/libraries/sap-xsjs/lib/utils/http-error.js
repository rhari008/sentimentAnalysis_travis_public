'use strict';

var util = require('util');
var http = require('http');

module.exports = HttpError;

function HttpError(status, msg) {
  if (typeof status === 'string' && !msg) {
    msg = status;
    status = undefined;
  }
  this.status = status || 500;
  this.message = msg || http.STATUS_CODES[this.status] || (this.status + '');
  Error.captureStackTrace(this, HttpError);
}

util.inherits(HttpError, Error);

HttpError.prototype.name = 'HttpError';


