'use strict';

var assert = require('assert');
var odata = require('@sap/xsodata');
var createTrace = require('../xsjs/trace').createTrace;
var db = require('../xsjs/db/common/connection');
var Connection = require('../xsjs/db/dbapi/Connection');
var utils = require('../utils');

module.exports = ODataService;


function ODataService(rt, rootUriPath, filePath) {
  assert(rt, 'valid runtime is required');
  assert(rootUriPath, 'valid odata root uri path is required');
  assert(filePath, 'valid xsodata file is required');

  this._rt = rt;
  this._rootUriPath = rootUriPath;
  this._filePath = filePath;
  this._handlers = {};
}

ODataService.prototype.getRootUriPath = function() {
  return this._rootUriPath;
};

ODataService.prototype.handle = function(req, res, callback) {
  assert(req, 'valid request object expected');
  assert(req.$, 'request object should have the XS dollar context');
  assert(res, 'valid response object is expected');

  var self = this;
  var cb = callback || function() {};
  var jsContext = req.$;
  var tenant = req.authInfo && req.authInfo.getIdentityZone();

  var dbReqOptions = this._rt.get('hanaDbOptions').forRequest(req, jsContext.request._locale);
  dbReqOptions.getInstanceOptions(function (err, hanaOptions) {
    if (err) {
      return cb(err);
    }
    db.connect(hanaOptions, function(err, client) {
      if (err) {
        return cb(err);
      }

      var requestOptions = self._createRequestOptions(jsContext, client);
      var handler = self._getHandler(tenant, hanaOptions.schema);
      handler.processRequest(req, res, requestOptions, function(err) {
        client.close();
        cb(err);
      });
    });
  });
};

ODataService.prototype._getHandler = function (tenant, schema) {
  if (this._handlers[tenant]) {
    return this._handlers[tenant];
  }

  var config = {
    serviceConfiguration : this._filePath,
    defaultSchema : schema,
    logger: createTrace()
  };
  var handler = new odata.ODataHandler(config);
  this._handlers[tenant] = handler;
  return handler;
};

ODataService.prototype._createRequestOptions = function(jsContext, client) {
  var rt = this._rt;

  function odataExitRunner(fnDescriptor, param, cb) {
    param.connection = new Connection(client);
    try {
      var libId = utils.toXSObjectId(fnDescriptor.package, fnDescriptor.file);
      var thisArg = utils.createXsFunctionThisArg(jsContext);

      var xsFunctionRunner = new utils.XsJsLibFunctionRunner(rt, libId, jsContext);
      xsFunctionRunner.run(fnDescriptor.functionName, thisArg, [param], cb);
    } catch (err) {
      cb(err);
    }
  }

  var requestOptions = new odata.RequestOptions({
    functionExecutor: odataExitRunner,
    dbClient: client
  });

  return requestOptions;
};

ODataService.prototype.clearCache = function(tenant) {
  if (tenant) {
    delete this._handlers[tenant];
  } else {
    this._handlers = {};
  }
};
