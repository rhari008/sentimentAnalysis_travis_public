'use strict';

var LoggingLib = require('@sap/logging');


var CATEGORY = '/CompatibilyLayer';
var appContext = LoggingLib.createAppContext({ csnComponent: 'BC-XS-JS' });
var logger = appContext.getLogger(CATEGORY);
logger.warn = logger.warning;

module.exports = {
  CATEGORY: CATEGORY,
  appContext: appContext,
  logger: logger,
  tracer: appContext.getTracer()
};
