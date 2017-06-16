'use strict';

var assert = require('assert');
var util = require('util');
var fibrous = require('@sap/fibrous');

exports.runXsFunction = runXsFunction;
exports.createXsFunctionThisArg = createXsFunctionThisArg;

/**
 * Executes the given function from the xsjs script provided in the constructor.
 *
 * Note that although xsjs code is executed in a fiber, this function will run it asynchronously,
 * i.e. it will return when xsjs code executes the first async/blocking operation.
 *
 * @param {scriptRunner} object of type <code>{ pathToScript: '', runScript: function() {} }</code>.
 * Will be used to get the executed script where function with name 'functionName'
 * should exist and will be executed.
 * @param {string} functionName name of the function to execute
 * @param {object} thisArg the value of `this` provided to the function, can be null or undefined
 * @param {array} argsArray function arguments, can be null or undefined
 * @param {function} cb callback that will be called the xsjs function completes, callback arguments:
 *        @param {Error} err exception thrown by xsjs function, null if none
 *        @param {any} result the value returned by xsjs function
 */
function runXsFunction(scriptRunner, functionName, thisArg, argsArray, cb) {
  assert(typeof scriptRunner === 'object', 'Valid script runner should to be provided');
  assert(functionName && typeof functionName === 'string', 'Invalid function name');
  assert(!argsArray || Array.isArray(argsArray), 'Pass function arguments as an array');
  assert(typeof cb === 'function', 'Invalid callback function');

  function runXsjs() {
    var sandbox = null;
    try {
      sandbox = scriptRunner.runScript();
      var jsFunction = sandbox[functionName];
      if (!jsFunction) {
        throw new Error(util.format('Function "%s" not found in script "%s"', functionName, scriptRunner.pathToScript));
      }
      if (typeof jsFunction !== 'function') {
        throw new Error(util.format('"%s" is not a function', functionName));
      }
      return jsFunction.apply(thisArg, argsArray);
    } finally {
      if (sandbox && sandbox.$.db) {
        sandbox.$.db._closeAllConnections();
      }
      if (global.gc) {
        global.gc();
      }
    }
  }

  fibrous.run(runXsjs, cb);
}

function createXsFunctionThisArg(context) {
  return {
    $: context,
    xsengine: context
  };
}
