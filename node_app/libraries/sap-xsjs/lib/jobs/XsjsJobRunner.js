'use strict';

var _ = require('lodash');
var util = require('util');
var fiber = require('@sap/fibers');

module.exports = XsjsJobRunner;

function XsjsJobRunner(rt) {
  if (!rt) {
    throw new Error('Valid xsjs runtime expected');
  }
  this._rt = rt;
  this._sandbox = null;
  this._jsFunction = null;
}

XsjsJobRunner.prototype.prepare = function(job, req) {
  this._cleanup();
  this._assertValidJob(job);

  var rt = this._rt;
  var jsPath = job.action.getScriptPath();
  var script = rt.getScript(jsPath);
  if (!script) {
    throw new Error(util.format('XSJS file "%s" not found for job: %s', jsPath, job.urlPath));
  }

  var sandbox = fiber(function() {
    var context = rt.createBaseContext(req);
    try {
      return rt.runXsjs(jsPath, context);
    } finally {
      if (context.db) {
        context.db._closeAllConnections();
      }
    }
  })
  .run();

  var funcName = job.action.funcname;
  var jsFunction = sandbox[funcName];
  if (!jsFunction) {
    throw new Error(util.format('XSJS "%s" doesn\'t have a function "%s"', jsPath, funcName));
  }
  if (!_.isFunction(jsFunction)) {
    throw new Error(util.format('"%s" is not a function in "%s"', funcName, jsPath));
  }

  this._sandbox = sandbox;
  this._jsFunction = jsFunction;
};

/**
 * Runs asynchronously
 * @param inputParams to be provided to XSJS function
 * @param done callback to notify when job finished
 */
XsjsJobRunner.prototype.run = function(inputParams, done) {
  if (!this._jsFunction) {
    throw new Error('XsjsJobRunner: runner needs to be prepared before run is called');
  }

  var self = this;
  fiber(function() {
    var error = null;
    try {
      self._jsFunction.call(this, inputParams || {});
    } catch (err) {
      error = err;
    }
    finally {
      if (self._sandbox.$.db) {
        self._sandbox.$.db._closeAllConnections();
      }
      self._cleanup();
      if (global.gc) {
        global.gc();
      }
    }

    done(error);
  })
  .run();
};

XsjsJobRunner.prototype._assertValidJob = function(job) {
  if (!job) {
    throw new TypeError('Valid job object should be provided');
  }

  if (!job.action.isJavaScript()) {
    throw new TypeError('Not a handler for SQL procedure based jobs, xsjob: ' + job.urlPath);
  }
};

XsjsJobRunner.prototype._cleanup = function() {
  this._sandbox = null;
  this._jsFunction = null;
};
