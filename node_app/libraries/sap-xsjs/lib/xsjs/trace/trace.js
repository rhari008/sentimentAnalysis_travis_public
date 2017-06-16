'use strict';

var logging = require('../../logging');


exports.createTrace = function (req) {
  if (req && req.loggingContext) {
    var tracer = req.loggingContext.getTracer();
    return buildTraceObject(tracer);
  } else {
    return buildTraceObject(logging.tracer);
  }
};

function buildTraceObject(tracer) {
  return {
    debug: tracer.debug.bind(tracer),
    info: tracer.info.bind(tracer),
    warning: tracer.warning.bind(tracer),
    warn: tracer.warning.bind(tracer),
    error: tracer.error.bind(tracer),
    fatal: tracer.fatal.bind(tracer),

    isDebugEnabled: tracer.isEnabled.bind(tracer, 'debug'),
    isInfoEnabled: tracer.isEnabled.bind(tracer, 'info'),
    isWarningEnabled: tracer.isEnabled.bind(tracer, 'warning'),
    isErrorEnabled: tracer.isEnabled.bind(tracer, 'error'),
    isFatalEnabled: tracer.isEnabled.bind(tracer, 'fatal'),

    _tracer: tracer
  };
}
