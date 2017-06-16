'use strict';

var logging = require('../../logging');


exports.createLog = function (req) {
  if (req && req.loggingContext) {
    var logger = req.loggingContext.getLogger('/Application');
    return buildLogObject(logger);
  } else {
    return buildLogObject(logging.logger);
  }
};

function buildLogObject(logger) {
  return {
    info: logger.info.bind(logger),
    warning: logger.warning.bind(logger),
    warn: logger.warning.bind(logger),
    error: logger.error.bind(logger),
    fatal: logger.fatal.bind(logger),

    isInfoEnabled: logger.isEnabled.bind(logger, 'info'),
    isWarningEnabled: logger.isEnabled.bind(logger, 'warning'),
    isErrorEnabled: logger.isEnabled.bind(logger, 'error'),
    isFatalEnabled: logger.isEnabled.bind(logger, 'fatal'),

    _logger: logger
  };
}
