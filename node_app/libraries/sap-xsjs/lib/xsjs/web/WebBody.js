/* ************************************************************************
 * Program:  WebBody.js
 * Function: Provide a XSJS $.web environment
 *           http://help.sap.de/hana/SAP_HANA_XS_JavaScript_Reference_en/$.web.Body.html
 * Date:     2014-10-06
 * (c) 2014 SAP SE
 * ************************************************************************/

'use strict';

var WebRequest = require('./WebRequest');
var WebResponse = require('./WebResponse');
var WebEntityResponse = require('./WebEntityResponse');
var CRLF = require('../constants').WEB.MESSAGES.LINE_BREAK;
var HttpRequestParser = require('./utils/HttpRequestParser');
var MultipartResponseBuilder = require('./utils/MultipartResponseBuilder');
var buffUtils = require('../../utils/buffer-utils');

module.exports = WebBody;

function WebBody(bodyOwner, bodyContent, indexOpt) {
  // a WebBody cannot be used on its own. The body owner is an object that has a property named 'body'
  this._bodyOwner = bodyOwner;

  if (indexOpt) {
    this._content = extractContentOfBlobColumn(bodyContent, indexOpt);
  } else if (isWebResponse(bodyContent)) {
    addSpecificHttpHeadersToBodyOwner(this);
    setBodyFromWebResponse(this, bodyContent);
  } else if (isWebEntityResponse(bodyContent)) {
    addSpecificHttpHeadersToBodyOwner(this);
    setBodyFromWebEntityResponse(this, bodyContent);
  } else {
    this._content = bodyContent;
  }
}

function extractContentOfBlobColumn(resultSet, indexOpt) {
  var columnNameForIndex = resultSet._columnNames[indexOpt - 1];
  if (!columnNameForIndex) {
    throw new Error('No column found for index ' + indexOpt);
  }
  return resultSet._row[columnNameForIndex];
}

function addSpecificHttpHeadersToBodyOwner(webBody) {
  webBody._bodyOwner.headers.set('content-type', 'application/http');
  webBody._bodyOwner.headers.set('content-transfer-encoding', 'binary');
}

function isWebResponse(arg) {
  return arg instanceof WebResponse;
}

function isWebEntityResponse(arg) {
  return arg instanceof WebEntityResponse;
}

function setBodyFromWebResponse(webBody, webResponse) {
  webBody._content = '';
  addStatusLine(webBody, webResponse);
  addHeaders(webBody, webResponse);
  addCookies(webBody, webResponse);
  addTheBody(webBody, webResponse);
}

function addTheBody(webBody, webEntityResponse) {
  if (webEntityResponse.entities.length === 0) {
    webBody._content += CRLF;
    webBody._content += webEntityResponse.body.asString();
  } else {
    var boundary = MultipartResponseBuilder.generateBoundary();
    webBody._content += ('content-type: multipart/mixed; boundary=' + boundary) + CRLF;
    webBody._content += CRLF;
    webBody._content += MultipartResponseBuilder.build(webEntityResponse, boundary);
  }
}

function addStatusLine(webBody, webResponse) {
  webBody._content += webResponse._httpVersion + ' ' + webResponse.status + ' ' + webResponse.statusMessage + CRLF;
}

function isMultipart(name, value) {
  return (name === 'content-type' && value.indexOf('multipart') > -1);
}

function addHeaders(webBody, webEntityResponse) {
  webEntityResponse.headers.forEach(function (singleTupelPair) {
    if (!isMultipart(singleTupelPair.name, singleTupelPair.value)) {
      webBody._content += singleTupelPair.name + ': ' + singleTupelPair.value + CRLF;
    }
  });
}

function addCookies(webBody, webResponse) {
  webResponse.cookies.forEach(function(singleCookie) {
    webBody._content += 'set-cookie: ' + singleCookie.name + '=' + singleCookie.value + CRLF;
  });
}

function setBodyFromWebEntityResponse(webBody, webEntityResponse) {
  webBody._content = '';
  addHeaders(webBody, webEntityResponse);
  addTheBody(webBody, webEntityResponse);
}

WebBody.prototype.asString = function () {
  if (this._content === null || this._content === undefined || typeof this._content === 'number') {
    return '' + this._content;
  }
  if (buffUtils.isBinary(this._content)) {
    return buffUtils.toBuffer(this._content).toString('utf8');
  }
  if (typeof this._content === 'boolean') {
    return this._content ? '1' : '0';
  }
  return this._content;
};

WebBody.prototype._retrieveContent = function () {
  return buffUtils.isBinary(this._content) ? buffUtils.toBuffer(this._content) : this.asString();
};

WebBody.prototype.asArrayBuffer = function () {
  var content = buffUtils.isBinary(this._content) ? this._content : new Buffer(this._content, 'utf8');
  return buffUtils.toArrayBuffer(content);
};

WebBody.prototype.asWebRequest = function() {
  var bodyOwnerHeaders = this._bodyOwner.headers;
  if (!bodyOwnerHeaders) {
    throw new Error('Cannot get Body as WebRequest. The object to which the current body belongs does not have any headers.');
  }
  if (bodyOwnerHeaders.get('Content-Type') !== 'application/http') {
    throw new Error('Cannot get Body as WebRequest. Content-Type header should be equal to "application/http" in order to proceed.');
  }
  if (bodyOwnerHeaders.get('Content-Transfer-Encoding') !== 'binary') {
    throw new Error('Cannot get Body as WebRequest. Content-Transfer-Encoding header should be equal to "binary" in order to proceed.');
  }
  return new WebRequest(HttpRequestParser.parse(this.asString()));
};
