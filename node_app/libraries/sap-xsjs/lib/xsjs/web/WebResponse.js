'use strict';

var _ = require('lodash');
var util = require('util');
var status = require('statuses');
var utils = require('../../utils');
var CookiesTupelList = require('./TupelLists/CookiesTupelList');
var bufferUtils = require('../../utils/buffer-utils');
var contentTypeParser = require('content-type');
var WebEntityResponse = require('./WebEntityResponse');
var SetCookieParser = require('./utils/SetCookieParser');
var MultipartParser = require('./utils/MultipartParser');
var MultipartResponseBuilder = require('./utils/MultipartResponseBuilder');
var MESSAGE_TYPE = require('../constants').WEB.MESSAGE_TYPE;

module.exports = WebResponse;

function WebResponse(res, followUpContext) {
  WebEntityResponse.call(this, res);

  if (!res) {
    this.cookies = new CookiesTupelList();
    this.status = 200;
  } else {
    normalizeResponseHeaders(this);
    setBodyOrEntities(this, res);
    this.cookies = new CookiesTupelList();
    this.cookies._addData(extractCookies(res));
    this.status = res.statusCode;
    this.statusMessage = status[res.statusCode];
    this._httpVersion = 'HTTP/' + res.httpVersion;
  }


  if (followUpContext) {
    var context = followUpContext.context;
    this.followUp = function (followUpObject) {
      if (typeof followUpObject !== 'object') {
        throw new Error('[$.web.WebResponse].followUp: expected an object as an argument');
      }

      var pathToScript = extractPathToScript(followUpObject.uri);
      var functionName = extractFunctionName(followUpObject.functionName);
      function done(err) {
        if (err) {
          var msg = util.format('Execution of function %s in script %s completed with error: %s',
            functionName, pathToScript, err);
          context.trace.error(msg);
          context.trace.debug(err);
        }
      }
      var thisArg = utils.createXsFunctionThisArg(context);
      var runner = new utils.XsJsFunctionRunner(followUpContext.runtime, pathToScript, context);
      runner.run(functionName, thisArg, [followUpObject.parameter], done);
    };
  } else {
    this.followUp = function () {
      throw new Error('[$.web.WebResponse].followUp: cannot invoke function on current object');
    };
  }
}

util.inherits(WebResponse, WebEntityResponse);

function normalizeResponseHeaders(webResponse) {
  // remove the set-cookie header if exists
  if (webResponse.headers.get('set-cookie')) {
    webResponse.headers.remove('set-cookie');
  }
}

function setBodyOrEntities(webResponse, internalResponse) {
  var boundary = extractBoundaryOfMultipartResponse(webResponse);
  if (boundary) {
    MultipartParser.parseFromBuffer(internalResponse.body, boundary, webResponse, MESSAGE_TYPE.RESPONSE);
    webResponse.body = undefined;
  } else {
    internalResponse.body && webResponse.setBody(internalResponse.body);
  }
}

function extractBoundaryOfMultipartResponse(webResponse) {
  var contentType = webResponse.headers.get('content-type');
  if (!contentType) {
    return '';
  }

  var isMultipart = contentType.indexOf('multipart') > -1;
  if (isMultipart) {
    var boundary = contentTypeParser.parse(contentType).parameters.boundary;
    if (!boundary) {
      throw new Error('Multipart response error. No boundary parameter found on header Content-Type ("' + contentType + '")');
    }
    return boundary;
  }
  return '';
}

function extractCookies(internalResponse) {
  if (!internalResponse.headers) {
    return {};
  }
  var setCookieHeader = internalResponse.headers['set-cookie'];
  if (!setCookieHeader) {
    return {};
  }
  return SetCookieParser.parse(setCookieHeader);
}

function extractPathToScript(uri) {
  if (typeof uri !== 'string') {
    throw new Error('[$.web.WebResponse].followUp argument: uri property missing or not a string');
  }
  uri = uri.trim();
  var result = /([^:]+):([^:]+\.xsjs)/.exec(uri);
  if (!result || result.length !== 3) {
    throw new Error('[$.web.WebResponse].followUp argument uri property got to be in the format: package:script.xsjs');
  }
  var packageName = result[1];
  var fileName = result[2];
  return utils.toPath(packageName, fileName);
}

function extractFunctionName(functionName) {
  if (functionName === null || functionName === undefined || typeof functionName !== 'string') {
    throw new Error('[$.web.WebResponse].followUp argument: functionName missing or not a string');
  }
  functionName = functionName.trim();
  if (!functionName) {
    throw new Error('[$.web.WebResponse].followUp argument: functionName cannot be empty');
  }
  return functionName;
}

function adjustContentType(webResponse) {
  if (webResponse.headers.get('content-type')) {
    return;
  }
  var body = webResponse.body._content;
  var bodyIsJson = _.isObject(body) && !bufferUtils.isBinary(body);
  webResponse.headers.set('content-type', bodyIsJson ? 'application/json' : 'text/html');
}

WebResponse.prototype._pipe = function(res) {
  adjustContentType(this);
  res.status(this.status);
  this.headers.forEach(function (header) {
    res.set(header.name, header.value);
  });
  this.cookies.forEach(function (cookie) {
    res.cookie(cookie.name, cookie.value);
  });
  if (this.entities.length > 0) {
    var boundary = MultipartResponseBuilder.generateBoundary();
    res.set('content-type', 'multipart/mixed; boundary=' + boundary);
    var body = MultipartResponseBuilder.build(this, boundary);
    res.send(body);
  } else {
    res.send(this.body._retrieveContent());
  }
};

Object.defineProperties(WebResponse.prototype, {
  cacheControl: {
    set: function (value) {
      this.headers.set('cache-control', value);
    },
    get: function () {
      return this.headers.get('cache-control');
    },
    enumerable: true
  }
});
