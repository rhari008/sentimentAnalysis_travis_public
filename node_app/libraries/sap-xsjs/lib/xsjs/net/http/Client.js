/* ************************************************************************
 * Program:  Client.js
 * Function: Provide a XSJS $.net.http.client environment
 *           http://help.sap.de/hana/SAP_HANA_XS_JavaScript_Reference_en/$.net.http.Client.html
 * Date:     2014-10-08
 * (c) 2014 SAP SE
 * ************************************************************************/

'use strict';

var qs = require('querystring');
var requestLib = require('request');
var _ = require('lodash');
var SAPPassport = require('@sap/e2e-trace').Passport;
var WebResponse = require('../../web/WebResponse');

var methodMapping = {
  // -1: 'INVALID',
  0: 'OPTIONS',
  1: 'GET',
  2: 'HEAD',
  3: 'POST',
  4: 'PUT',
  5: 'DELETE',
  6: 'TRACE',
  7: 'CONNECT',
  8: 'PATCH'
};

function Client(sapPassport) {
  if (!(this instanceof Client)) {
    return new Client(sapPassport);
  }
  this._response = '';
  this._responseIsSet = false;
  this._sapPassport = sapPassport;
}

Client.prototype.getResponse = function () {
  if (!this._responseIsSet) {
    if (!this._response) {
      throw new Error('Make an HTTP request before trying to get the response');
    }
    var internalResponse = this._response.wait();
    this._response = new WebResponse(internalResponse);
    this._responseIsSet = true;
  }
  return this._response;
};

Client.prototype.request = function (arg0, arg1, proxyOpt) {
  var options = {
    headers: {},
    timeout: 10000
  };
  if (this._sapPassport) {
    var passport = new SAPPassport(this._sapPassport);
    passport.update({
      connectionID: '00000000000000000000000000000000',
      connectionCounter: 0
    });
    options.headers[SAPPassport.HEADER_NAME] = passport.serialize();
  }
  if (_.isNumber(arg0)) {
    processWebMethodAndUrl(options, arg0, arg1, proxyOpt);
  } else if (_.isString(arg1)) {
    processWebRequestAndUrl(options, arg0, arg1, proxyOpt);
  } else {
    processWebRequestAndDestination(options, arg0, arg1);
  }

  if (this._timeoutInMilliseconds) {
    options.timeout = this._timeoutInMilliseconds;
  }

  this._response = requestLib.future(options);
  this._responseIsSet = false;
  return this;
};

Client.prototype.setTimeout = function (timeout) {
  this._timeoutInMilliseconds = timeout * 1000;
};

Client.prototype.close = function () {
};

Client.prototype.setTrustStore = function () {
  throw new Error('Feature not supported!');
};

function processWebMethodAndUrl(options, webMethod, url, proxyOpt) {
  options.url = url;
  options.method = methodMapping[webMethod];
  setProxy(options, proxyOpt);
}

function processWebRequestAndUrl(options, webRequest, url, proxyOpt) {
  options.url = url;
  useDataFromWebRequest(options, webRequest);
  setProxy(options, proxyOpt);
}

function processWebRequestAndDestination(options, webRequest, destination) {
  options.url = (destination.useSSL === true ? 'https://' : 'http://') + destination.host + ':' + destination.port;
  if (destination.timeout) {
    options.timeout = destination.timeout;
  }
  addPathPrefix(options, destination);
  useDataFromWebRequest(options, webRequest);
  setProxyFromDestination(options, destination);
  setBasicAuthFromDestination(options, destination);
}

function useDataFromWebRequest(options, webRequest) {
  options.method = methodMapping[webRequest.method];
  addPath(options, webRequest);
  addRequestParameters(options, webRequest);
  addHeaders(options, webRequest);
  addCookies(options, webRequest);
  addBody(options, webRequest);
}

function addPath(options, webRequest) {
  if (webRequest.path) {
    if (options.url.charAt(options.url.length - 1) !== '/' && webRequest.path.charAt(0) !== '/') {
      options.url += '/';
    }
    options.url += webRequest.path;
  }
}

function addRequestParameters(options, webRequest) {
  if (webRequest.parameters.length > 0) {
    if (options.url.indexOf('?') !== -1) {
      options.url += '&';
    } else {
      options.url += '?';
    }
    options.url += qs.encode(webRequest.parameters.reduce(function (p, n) { p[n.name] = n.value; return p; }, {}));
  }
}

function addHeaders(options, webRequest) {
  webRequest.headers.forEach(function (header) {
    options.headers[header.name] = header.value;
  });
}

function addCookies(options, webRequest) {
  options.headers.Cookie = webRequest.cookies.map(function (cookie) {
    return cookie.name + '=' + cookie.value;
  }).join('; ');
}

function addBody(options, webRequest) {
  if (options.method === 'POST' || options.method === 'PUT' || options.method === 'PATCH') {
    options.body = webRequest.body._content;
    options.json = false;
  }
}

function setProxy(options, proxyOpt) {
  if (proxyOpt) {
    options.proxy = proxyOpt;
  }
}

function addPathPrefix(options, destination) {
  if (destination.pathPrefix) {
    if (destination.pathPrefix.charAt(0) !== '/') {
      options.url += '/';
    }
    options.url += destination.pathPrefix;
  }
}

function setProxyFromDestination(options, destination) {
  if (destination.useProxy === true) {
    return options.proxy = 'http://' + destination.proxyHost + ':' + destination.proxyPort;
  }
  // explicitly disable proxy
  if (destination.useProxy === false) {
    options.proxy = null;
  }
}

function setBasicAuthFromDestination(options, destination) {
  if (destination.authType === 'basic') {
    options.auth = { user: destination.username, pass: destination.password };
  }
}

module.exports = Client;
