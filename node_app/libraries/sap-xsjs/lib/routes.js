'use strict';

var logging = require('./logging');
var http = require('http');

// ------------------------------------------------------------------

exports.xsjs = function(rt) {
  return function xsjsHandler(req, res, next) {
    var endOfScriptName = req.path.indexOf('.xsjs') + '.xsjs'.length;
    var pathToScript = req.path.substring(0, endOfScriptName);
    req.loggingContext.getTracer().info('Running script "%s"', pathToScript);
    try {
      var script = rt.getScript(pathToScript);
      if (!script) {
        throw createError('Script not found (maybe compilation failed)');
      }

      rt.runXsjs(pathToScript, req.$);
      req.$.response._pipe(res);
    } catch (err) {
      next(err);
    } finally {
      cleanUp(req);
    }
  };
};

// ------------------------------------------------------------------

exports.xsodata = function(odataService) {
  return function _odataRouteHandler(req, res, next) {
    var odataPath = odataService.getRootUriPath();
    var tracer = req.loggingContext.getTracer();
    tracer.info('Starting OData handling for request "%s%s"', odataPath, req.path);
    try {
      odataService.handle(req, res, function(err) {
        if (err) {
          return next(err);
        }
        tracer.info('Finished OData handling for request "%s%s"', odataPath, req.path);
      });
    } catch (err) {
      next(err);
    } finally {
      cleanUp(req);
    }
  };
};

// ------------------------------------------------------------------

exports.startJob = function (rt, options) {
  return function (req, res, next) { // eslint-disable-line no-unused-vars
    var logger = req.loggingContext.getLogger(logging.CATEGORY);
    var tracer = req.loggingContext.getTracer();
    if (!options.anonymous && options.uaa) {
      var scope = options.uaa.xsappname + '.JOBSCHEDULER';
      if (req.authInfo && !req.authInfo.checkScope(scope)) {
        tracer.error('Required scope `%s` is missing', scope);
        return res.status(403).end();
      }
    }

    tracer.info('Starting job "%s"', req.path);
    try {
      rt.startJobAsync(req);
      res.status(202).json({ success: true });
      tracer.info('Job "%s" started', req.path);
    } catch (err) {
      var message = errMessage(err);
      logger.error('Failed to start job "%s". %s', req.path, message);
      res.status(500).json({ error: message });
    }
  };
};

// ------------------------------------------------------------------

exports.error = function (err, req, res, next) { // eslint-disable-line no-unused-vars
  var status = http.STATUS_CODES[err.status] ? err.status : 500;
  var logger = req.loggingContext.getLogger(logging.CATEGORY);

  if (status >= 400 && status < 500) {
    logger.info('%s %s returning status %d (%s)', req.method, req.originalUrl, status, err.message);
  } else {
    logger.error(err, '%s %s returning status %d', req.method, req.originalUrl, status);
  }

  var devMode = (process.env.NODE_ENV === 'development');
  var title;
  if (devMode) {
    title = status + ' ' + err.message;
  } else {
    // do not reveal internal details to the client
    title = status + ' ' + http.STATUS_CODES[status];
  }

  var stacktrace = '';
  if (devMode) {
    stacktrace = err.stack;
  }

  res.status(status).render('error', {
    title: title,
    stacktrace: stacktrace
  });
};

function createError(message, status) {
  var err = new Error(message);
  err.status = status || 500;
  return err;
}

function errMessage(err) {
  if (err.message) { return err.message; }
  return err;
}

function cleanUp(req) {
  if (req.$.db) {
    req.$.db._closeAllConnections();
  }
  if (req.$.hdb) {
    req.$.hdb._closeAllConnections();
  }
  req.$ = undefined;
  if (global.gc) {
    global.gc();
  }
}
