'use strict';

var assert = require('assert');
var async = require('async');
var hdbext = require('@sap/hdbext');
var connection = require('../xsjs/db/common/connection');

module.exports = SqlScriptJobRunner;


function SqlScriptJobRunner(dbReqOptions) {
  assert(dbReqOptions, 'Valid dbReqOptions expected');
  this._dbReqOptions = dbReqOptions;
}

SqlScriptJobRunner.prototype.run = function(job, inputParams, done) {
  var self = this;
  var hanaOptions;
  var hdbClient;

  async.waterfall([
    function (cb) {
      self._dbReqOptions.getInstanceOptions(cb);
    },
    function (hanaOpts, cb) {
      hanaOptions = hanaOpts;
      connection.connect(hanaOptions, cb);
    },
    function(client, cb) {
      hdbClient = client;
      client.setAutoCommit(true);
      hdbext.loadProcedure(client, hanaOptions.schema, self._defineSqlProcName(job.action), cb);
    },
    function(procedure, cb) {
      procedure(inputParams, cb);
    }
  ], function(err) {
    hdbClient && hdbClient.close();
    done(err);
  });
};

SqlScriptJobRunner.prototype._defineSqlProcName = function(action) {
  if (!action.packagename) {
    return action.funcname;
  }

  return action.packagename + '::' + action.funcname;
};
