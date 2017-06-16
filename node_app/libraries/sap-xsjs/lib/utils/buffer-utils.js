'use strict';

var _ = require('lodash');

module.exports = {

  isArrayBuffer: function (arg) {
    return Object.prototype.toString.call(arg) === '[object ArrayBuffer]';
  },

  isBuffer: function (arg) {
    return Buffer.isBuffer(arg);
  },

  isBinary: function(arg) {
    return module.exports.isBuffer(arg) || module.exports.isArrayBuffer(arg);
  },

  toArrayBuffer: function (data) {
    if (module.exports.isArrayBuffer(data)) {
      return data;
    }

    var ab = new ArrayBuffer(data.length); // eslint-disable-line no-undef
    var view = new Uint8Array(ab); // eslint-disable-line no-undef
    for (var i = 0; i < data.length; ++i) {
      view[i] = data[i];
    }
    return ab;
  },

  toBuffer: function (data) {
    if (module.exports.isBuffer(data)) {
      return data;
    }

    if (parseInt(process.versions.node) >= 6) {
      return Buffer.from(data);
    }

    var array = new Uint8Array(data); // eslint-disable-line no-undef
    return new Buffer(array);
  },

  bodyToBuffer: function (webBody) {
    var rawContent = webBody._retrieveContent();
    return _.isString(rawContent) ? new Buffer(rawContent, 'utf8') : rawContent;
  },

  toBufferEncoding: function (encoding) {
    encoding = encoding.toLowerCase();
    switch (encoding) {
    case 'utf-8': return 'utf8';
    case 'utf-16': return 'utf16le';
    case 'us-ascii': return 'ascii';
    default: return Buffer.isEncoding(encoding) ? encoding : null;
    }
  },

  getData: function(data) {
    if (!_.isString(data) && !module.exports.isArrayBuffer(data)) {
      throw new Error('First argument must be string or ArrayBuffer.');
    }

    return module.exports.isArrayBuffer(data) ? module.exports.toBuffer(data) : data;
  }

};
