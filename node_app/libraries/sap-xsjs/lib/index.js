'use strict';

var assert = require('assert');
var bodyParser = require('body-parser');
var compress = require('compression');
var cookieParser = require('cookie-parser');
var express = require('express');
var _ = require('lodash');
var passport = require('passport');
var path = require('path');
var connOptions = require('@sap/hdbext').connectionOptions;
var xssec = require('@sap/xssec');
var util = require('util');

var AnonymousStrategy = require('./passport-noauth');
var middleware = require('./middleware');
var routes = require('./routes');
var runtime = require('./runtime');
var loggingLib = require('@sap/logging');
var logger = require('./logging').logger;
var odata = require('./odata');
var jobs = require('./jobs');
var cacert = require('./cacert');

exports = module.exports = function (options) {
  options = _.cloneDeep(options);
  options.uaa = options.uaa || options.jwt; // options.jwt is deprecated
  checkOptions(options);

  cacert.loadCertificates(options);

  if (options.hana) {
    _.defaultsDeep(options, {
      hana: connOptions.getGlobalOptions()
    });
  }

  // bootstrap runtime
  var rt = runtime.createRuntime(options);

  // configure passport
  var passportStrategies = [];

  var JWT = 'JWT';
  if (options.uaa) {
    passport.use(JWT, new xssec.JWTStrategy(options.uaa));
    passportStrategies.push(JWT);
  }

  assert(options.anonymous === undefined || typeof options.anonymous === 'boolean',
    'anonymous option should be a boolean');
  if (options.anonymous) {
    passport.use(new AnonymousStrategy());
    passportStrategies.push('anonymous');
  }

  // configure express
  var app = express();
  app.use(loggingLib.expressMiddleware(require('./logging').appContext));
  app.engine('html', require('ejs').__express);
  app.set('view engine', 'html');
  app.set('views', path.join(__dirname, 'views'));
  app.set('query parser', 'simple');
  app.set('runtime', rt);

  app.use(function(req, res, next) {
    if (req.method === 'TRACE') {
      return res.status(403).send('HTTP TRACE Method is not allowed');
    }
    next();
  });

  if (rt.get('compression')) {
    app.use(compress());
  }
  app.use(cookieParser());

  app.use(passport.initialize());
  app.use(function (req, res, next) {
    passport.authenticate(passportStrategies, {
      session: false,
      authInfo: true,
      useClientCredentialsToken: !!req.headers['x-sap-scheduler-host']
    })(req, res, next);
  });
  app.use(middleware.urlRewrite(rt));

  // redirect
  rt.redirectRules.forEach(function (rule) {
    app.get(rule.pathname, function (req, res) {
      res.redirect(rule.status || 302, rule.location);
    });
  });

  addXsjsHandlers(app, rt);

  addOdataHandlers(app, options, rt);

  addJobHandlers(app, options, rt);

  // static content
  rt.staticDirectories.forEach(function (staticDirectory) {
    app.use(staticDirectory.pathname, express.static(staticDirectory.dirname));
  });

  // catch 404 and forward to error handler
  app.use(middleware.notFound);

  // error handlers
  app.use(routes.error);

  return app;
};

function addXsjsHandlers(app, rt) {
  var xsjsPaths = _.map(Object.keys(rt.xsjs), function addWildCard(path) {
    // wildcard needs to be mapped to support $.request.queryPath
    return path + '*';
  });
  if (xsjsPaths.length > 0) {
    app.all(xsjsPaths, middleware.anyBody(rt), middleware.xsjs(rt), routes.xsjs(rt));
  }
}

function addOdataHandlers(app, options, rt) {
  var odataServices = odata.createServices(rt);
  odataServices.forEach(function(odataService) {
    if (!isValidHanaSettings(options)) {
      app.use(odataService.getRootUriPath(), function(req, res, next) {
        next(new Error('Internal Server Error - Invalid HANA settings provided. OData services are disabled.'));
      });
    } else {
      var odataApp = express();
      odataApp.all('*', middleware.anyBody(rt), middleware.xsodata(rt), routes.xsodata(odataService));

      app.use(odataService.getRootUriPath(), odataApp);
    }
  });

  app.clearODataCache = function(tenant) {
    odataServices.forEach(function(svc) {
      svc.clearCache(tenant);
    });
  };
}

function addJobHandlers(app, options, rt) {
  var jobsRt = new jobs.JobsRuntime(rt);
  var validJobs = jobsRt.getValidJobs();
  if (validJobs.length) {
    if (isValidHanaSettings(options)) {
      jobsRt.registerAllJobs();

      validJobs.forEach(function (job) {
        app.post(job.urlPath, bodyParser.json(), routes.startJob(jobsRt, options));
      });
    } else {
      logger.error('Jobs execution requires valid HANA configuration.');
    }
  }
}

function checkOptions(options) {
  if (!isValidHanaSettings(options)) {
    logger.warn('No HANA credentials provided. DB access and OData services will be disabled.');
  }
  if (!options.uaa) {
    logger.warn('No UAA configuration provided. JWT token authentication disabled.');
  }
  if (!options.mail) {
    logger.warn('No Mail options provided. $.net.Mail and $.net.SMTPConnection will be disabled.');
  }
  if (!options.jobs) {
    logger.warn('No Jobs options provided. $.jobs will be disabled.');
  }
  if (!options.secureStore) {
    logger.warn('Secure store not configured. $.security.Store will be disabled.');
  }
}

function isValidHanaSettings(options) {
  return options.hana && options.hana.user && options.hana.password;
}

exports.extend = util.deprecate(_.extend, 'xsjs.extend is deprecated. Use Object.assign, lodash or some other npm package instead.');
