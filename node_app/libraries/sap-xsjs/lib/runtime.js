'use strict';

var assert       = require('assert');
var dive         = require('diveSync');
var fs           = require('fs');
var path         = require('path');
var vm           = require('vm');
var _            = require('lodash');
var jobs         = require('./jobs');
var logger       = require('./logging').logger;
var sandbox      = require('./sandbox');
var xs           = require('./xsjs');
var utils        = require('./utils');
var util         = require('util');
var VError       = require('verror');
var AppConfig    = require('./AppConfig');
var suppLibs     = require('./xsjslib');
var destProvider = require('./destinations/dest-provider');
var Store        = require('./xsjs/security/Store');
var SAPPassport  = require('@sap/e2e-trace').Passport;
var DbOptions    = require('./xsjs/db/common/DbOptions');

var globalLibraryCache = {
  store: function (libName, library, location) {
    if (location === 'global') {
      this.global[libName] = library;
    } else {
      logger.warn('Unsupported library cache mode: ' + location);
    }
  },
  restore: function (context) {
    var parentPackage = context;
    Object.keys(globalLibraryCache.global).forEach(function (libName) {
      libName.split('.').forEach(function (name, index, array) {
        if (index === array.length - 1) {
          context.libs[libName] = parentPackage[name] = globalLibraryCache.global[libName];
        } else {
          parentPackage = parentPackage[name] = parentPackage[name] || {};
        }
      });
    });
  },
  global: {}
};

// # section Exports

module.exports.createRuntime = createRuntime;
module.exports.Runtime = Runtime;

// # Runtime class definition {

function Runtime() {
  this.xsapp = {};
  this.xsaccess = {};
  this.xsjs = {};
  this.xsjslib = {};
  this.xsjobs = {};
  this.xscfgd = {};
  this.xshttpdest = {};
  this.xsprivileges = {};
  this.xsodata = [];
  this.rewriteRules = [];
  this.redirectRules = [];
  this.staticDirectories = [];
  this.settings = {};
  this._sandBoxHook = null;
}

Runtime.prototype.get = function (key) {
  if (typeof key === 'undefined') {
    return this.settings;
  }
  return this.settings[key];
};

Runtime.prototype.set = function (key, value) {
  if (!value && key && typeof key === 'object') {
    _.extend(this.settings, key);
  } else {
    this.settings[key] = value;
  }
};

Runtime.prototype.getScript = function (pathname) {
  return this.xsjs[pathname];
};

Runtime.prototype.getLibrary = function (libId) {
  return this.xsjslib[libId];
};

/**
 * Executes XSJS script by getting it by <code>pathname</code> from the list of prepared
 * scripts collected in <code>this.xsjs</code>
 *
 * @param pathname XSJS path - something like /my/script/location/file.xsjs
 * @param xsruntime context that will be attached to the global context under '$' property
 * @returns result context after execution
 */
Runtime.prototype.runXsjs = function (pathname, xsruntime) {
  var script = this.getScript(pathname);
  assert(script, util.format('missing script for XSJS on path "%s"', pathname));
  return this._runScript(script, xsruntime);
};

/**
 * Executes XSJSLIB script by getting it by <code>pathname</code> from the list of prepared
 * library scripts collected in <code>this.xsjslib</code>
 *
 * @param libId XSJSLIB package and name according to XS1 - something like my.script.location.file.xsjslib
 * @param xsruntime context that will be attached to the global context under '$' property
 * @returns result context after execution
 */
Runtime.prototype.runXsjslib = function (libId, xsruntime) {
  var script = this.getLibrary(libId);
  assert(script, util.format('missing script for XSJSLIB with packagename "%s"', libId));
  return this._runScript(script, xsruntime);
};

Runtime.prototype._runScript = function (script, xsruntime) {
  var context = this.createSandbox(xsruntime);
  script.runInContext(context);

  return context;
};

/**
 * This method is provided for internal runtime stakeholders like XSUnit and provides
 * possibility for consumers to enrich the sandbox with additional API provided in the global
 * context.
 *
 * How it works: while executing some of run* methods like <code>runXsjslib</code>, <code>createSandbox</code> is called
 * which prepares the base sandbox, calls the hook (if provided) and expects the hook to return valid sandbox.
 * Finally script is executed using returned sandbox.
 *
 * @param hook function that will be called while sandbox is prepared
 * @throws TypeError in case provided <code>hook</code> is not a function
 */
Runtime.prototype.setSandboxHook = function (hook) {
  assert(hook, 'valid hook function expected');
  if (!_.isFunction(hook)) {
    throw new TypeError('valid sandbox hook expected');
  }
  this._sandBoxHook = hook;
};

Runtime.prototype.createSandbox = function (xsruntime) {
  var sbox = sandbox.create(xsruntime, this.get('context'));
  if (this._sandBoxHook) {
    sbox = this._sandBoxHook(sbox);
    assert(sbox, 'valid sandbox should be returned by the sandbox hook');
  }

  return sbox;
};

Runtime.prototype.importLibrary = function (packagename, objectname, xsruntime) {
  var libId;
  if (objectname) {
    libId = packagename + '.' + objectname;
  } else if (packagename) {
    if (path.extname(packagename) !== '.xsjslib') {
      throw new VError('Library "%s" does not have ".xsjslib" extention', packagename);
    }
    var libPath;
    if (packagename[0] === '/') {
      libPath = packagename;
    } else {
      var callingXsjs = utils.getCallingXsjsRelativePath(this.get('rootDirs'));
      var dir = path.dirname(callingXsjs);
      libPath = path.normalize('/' + dir + '/' + packagename);
    }
    libId = utils.toResourceId(libPath);
  } else {
    throw new VError('Import library failed. No name specified.');
  }

  // check library cache
  if (xsruntime.libs[libId]) {
    return xsruntime.libs[libId];
  }

  var script = this.getLibrary(libId);
  if (!script) {
    var xsjslib = suppLibs(this)[libId];
    if (xsjslib) {
      return xsjslib;
    }
    throw new VError('Library "%s" not found', libId);
  }

  // create package structure on sandbox
  var sandbox = this.createSandbox(xsruntime);
  var parentPackage = sandbox.$;
  libId.split('.').forEach(function (name) {
    parentPackage = parentPackage[name] = parentPackage[name] || {};
  });

  var library = parentPackage;
  // cache library
  xsruntime.libs[libId] = library;
  // get all keys from the sandbox
  var keys = Object.getOwnPropertyNames(sandbox);
  // run library script
  script.runInNewContext(sandbox);
  // add new properties to library
  Object.getOwnPropertyNames(sandbox).filter(function (key) {
    return keys.indexOf(key) === -1;
  }).forEach(function (key) {
    Object.defineProperty(library, key, {
      get: function() {
        return sandbox[key];
      },
      set: function(val) {
        sandbox[key] = val;
      }
    });
  });
  if (this.settings.libraryCache[libId]) {
    globalLibraryCache.store(libId, library, this.settings.libraryCache[libId]);
  }
  return library;
};

Runtime.prototype.getDestination = function (packagename, objectname) {
  return this.xshttpdest[packagename + '.' + objectname];
};

Runtime.prototype.getConfig = function (packagename, objectname) {
  return this.xscfgd[packagename + '.' + objectname];
};

Runtime.prototype.encodeUser = function (user) {
  var buffer = new Buffer([user.id, user.pass].join(':'), 'utf8');
  return buffer.toString('base64');
};

Runtime.prototype.decodeUser = function (encodedUser) {
  var auth = new Buffer(encodedUser, 'base64').toString('utf8').split(':');
  return {
    id: auth[0],
    pass: auth[1]
  };
};

// # Creating and attaching runtime context
Runtime.prototype.attachContext = function (req, res) {
  var webRequest = new xs.web.WebRequest(req);
  adjustRequestBody(req, webRequest);
  var locale = webRequest._localeObject;
  var baseContext = this.createBaseContext(req, locale);
  var webResponse = new xs.web.WebResponse(res, { runtime: this, context: baseContext });

  req.$ = _.extend(baseContext, {
    session: new xs.Session(req, locale),
    application: new xs.Application(locale, webResponse),
    request: webRequest,
    response: webResponse
  });
};

function adjustRequestBody(req, webRequest) {
  // only applicable for $.request
  if (!req.body || !req.body.length) {
    webRequest.body = undefined;
  }
}

Runtime.prototype.createBaseContext = function (req, locale) {
  var self = this;
  var sapPassport = req.headers[SAPPassport.HEADER_NAME];
  var context = {
    import: function (packagename, objectname) {
      return self.importLibrary(packagename, objectname, this);
    },
    require: function (packagename) {
      return xs.require(packagename, self.get('rootDirs'));
    },
    log: xs.trace.createLog(req),
    trace: xs.trace.createTrace(req),
    config: {
      getObject: function (packagename, objectname) {
        return self.getConfig(packagename, objectname);
      }
    },
    net: {
      http: new xs.net.HTTP(self.xshttpdest, destProvider.defineDestinationProviderFunction(self), sapPassport)
    },
    web: {
      WebRequest: xs.web.WebRequest,
      TupelList: xs.web.TupelList,
      Body: xs.web.WebBody
    },
    libs: {}, // library cache
    security: xs.security,
    util: xs.util
  };
  var mailOptions = this.get('mail');
  if (mailOptions) {
    context.net.Mail = xs.net.createMail(mailOptions);
    context.net.SMTPConnection = xs.net.createSMTPConnection(mailOptions);
  }

  var hanaDbOptions = this.get('hanaDbOptions');
  if (hanaDbOptions) {
    var dbReqOptions = hanaDbOptions.forRequest(req, locale);
    context.db = new xs.db.DB(dbReqOptions);
    context.hdb = new xs.db.HDB(dbReqOptions);
    context.text = xs.text.create(context.db);
  }

  var secStoreDbOptions = this.get('secureStoreDbOptions');
  if (secStoreDbOptions) {
    var ssDbOptions = secStoreDbOptions.forRequest(req, locale);
    context.security.Store = Store.createStore(ssDbOptions);
  }

  if (this.get('jobs')) {
    context.jobs = new xs.Jobs(self);
  }

  globalLibraryCache.restore(context);

  return context;
};

// # Jobs handling

Runtime.prototype.getJob = function (pathname) {
  return this.xsjobs[pathname];
};

Runtime.prototype.getJobName = function(jobPath) {
  var appConfig = this.get('appConfig');
  return jobs.Job.buildName(appConfig.host, jobPath);
};
// } Runtime class definition

function normalizeFormData(formData) {
  var result = _.defaults({}, formData, {
    maxFilesSizeInBytes: 10485760 // default: 10MB
  });
  assert(typeof result.maxFilesSizeInBytes === 'number' && result.maxFilesSizeInBytes > 0);
  return result;
}

function getSecStoreDbOptions(options) {
  if (options) {
    delete options.connectWithLoggedUser;
    delete options.sqlcc;
    return new DbOptions(options);
  }
}

function createRuntime(options) {
  var rt = new Runtime();

  options = options || {};
  var appConfig = new AppConfig(options.port);

  rt.set('hanaDbOptions', options.hana && new DbOptions(options.hana));
  rt.set('jobs', options.jobs);
  rt.set('appConfig', appConfig);
  rt.set('compression', options.compression === undefined || !!options.compression);
  rt.set('libraryCache', options.libraryCache || {});
  rt.set('mail', options.mail || {});
  rt.set('formData', normalizeFormData(options.formData));
  rt.set('destinationProvider', options.destinationProvider);
  rt.set('secureStoreDbOptions', getSecStoreDbOptions(options.secureStore));
  rt.set('context', options.context);

  if (options.redirectUrl) {
    rt.redirectRules.push({
      pathname: '/',
      location: options.redirectUrl
    });
  }

  var directories = options.rootDirs || [];
  directories = directories.filter(function (dirPath) {
    return !!dirPath;
  }).map(function (unresolvedPath) {
    return path.resolve(unresolvedPath);
  });
  if (!directories.length) {
    directories.push(path.resolve(options.rootDir || 'lib'));
  }
  rt.set('rootDirs', directories);

  function filter(path, dir) { // eslint-disable-line no-unused-vars
    return true;
  }

  directories.forEach(function (directory) {
    dive(directory, {
      recursive: true,
      all: true,
      directories: false,
      filter: filter
    }, function (err, file) {
      if (err) {
        return logger.warn(err.message);
      }
      var pathname = file.substring(directory.length);
      var basename = path.basename(pathname);
      if (basename === '.xsapp') {
        xsapp.call(rt, pathname, file);
      } else if (basename === '.xsaccess') {
        xsaccess.call(rt, pathname, file);
      } else if (basename === '.xsprivileges') {
        xsprivileges.call(rt, pathname, file);
      } else if (/\.xsjs$/.test(basename)) {
        xsjs.call(rt, pathname, file);
      } else if (/\.xsjslib$/.test(basename)) {
        xsjslib.call(rt, pathname, file);
      } else if (/\.xsodata$/.test(basename)) {
        xsodata.call(rt, pathname, file);
      } else if (/\.xscfgd$/.test(basename)) {
        xscfgd.call(rt, pathname, file);
      } else if (/\.xshttpdest$/.test(basename)) {
        xshttpdest.call(rt, pathname, file);
      } else if (/\.xsjob$/.test(basename)) {
        xsjob.call(rt, pathname, file);
      }
    });
  });

  // all files have been processed, check jobs can be executed
  validateJobs.call(rt);

  return rt;
}

function readFile(filename) {
  return fs.readFileSync(filename, 'utf8');
}

function readJson(filename) {
  try {
    return JSON.parse(readFile(filename));
  } catch (err) {
    logger.warn('Could not parse JSON file "%s": %s', filename, err.message);
  }
}

function readScript(filename) {
  try {
    return new vm.Script(readFile(filename), filename);
  } catch (err) {
    logger.warn('Could not create script file "%s": %s', filename, err.message);
  }
}

function readXScfgd(filename) {
  var sConfig = readFile(filename);
  var lines = sConfig.split(/;\s*[\r\n]/);

  if (/implements \S+/.test(lines[0])) {
    lines.shift();
  }

  var sandbox = {};
  var it;

  for (var lnn in lines) {
    var line = lines[lnn];
    line = line.trim();
    if (line === '') {
      continue;
    }
    if (line[0] === '/' && line[1] === '/') {
      continue;
    }

    var aProp = line.split('=');
    if (aProp.length > 1) {
      var key = aProp[0].trim();
      var akey = key.split('.');
      akey.pop();

      var o = sandbox;
      for (it = 0; it < akey.length; ++it) {
        o = o[akey[it]] = o[akey[it]] || {};
      }
    }
  }

  var newScript = lines.join(';\r\n');
  try {
    var script = new vm.Script(newScript);
    script.runInNewContext(sandbox);

    return sandbox;
  } catch (err) {
    logger.warn('Could not read .xscfgd file "%s": %s', filename, err.message);
  }
}

function readHTTPDestination(filename) {
  var sandbox = {
    none: null,
    basic: 'basic',
    AssertionTicket: 'AssertionTicket'
  };

  var properties = Object.getOwnPropertyNames(sandbox);
  try {
    var script = new vm.Script(readFile(filename));
    script.runInNewContext(sandbox);

    properties.forEach(function(property) {
      delete sandbox[property];
    });

    return sandbox;
  } catch (err) {
    logger.warn('Cannot parse .xshttpdest file "%s": %s', filename, err.message);
  }
}

function xsapp(pathname, filename) {
  pathname = path.dirname(pathname);
  if (this.xsapp[pathname]) {
    return logger.warn(getExistingFileWarning.call(this, '.xsapp', pathname));
  }
  var data = readJson(filename);
  if (!data) {
    return;
  }
  this.xsapp[pathname] = data;
}

function xsaccess(pathname, filename) {
  pathname = path.dirname(pathname);
  if (this.xsaccess[pathname]) {
    return logger.warn(getExistingFileWarning.call(this, '.xsaccess', pathname));
  }
  var data = readJson(filename);
  if (!data) {
    return;
  }
  this.xsaccess[pathname] = data;
  var dirname = path.dirname(filename);
  if (data.exposed) {
    logger.info('Adding static handler for "%s" in "%s"', pathname,
      dirname);
    this.staticDirectories.push({
      pathname: pathname,
      dirname: dirname
    });
  }
  var rewriteRules = data.rewrite_rules;
  if (rewriteRules) {
    rewriteRules.forEach(function (rule) {
      logger.info('Adding rewrite rule from "%s" to "%s"', rule.source, rule.target);
      this.rewriteRules.push({
        regex: new RegExp(rule.source + '$'),
        replacement: rule.target
      });
    }, this);
  }
  if (data.authentication) {
    logger.warn('Authentication not yet supported');
  }
}

function xsprivileges(pathname, filename) {
  pathname = path.dirname(pathname);
  if (this.xsprivileges[pathname]) {
    return logger.warn(getExistingFileWarning.call(this, '.xsprivileges', pathname));
  }
  var data = readJson(filename);
  if (!data) {
    return;
  }
  this.xsprivileges[pathname] = data;
}

function xsodata(pathname, filename) {
  if (this.xsodata[pathname]) {
    return logger.warn(getExistingFileWarning.call(this, 'xsodata', pathname));
  }
  this.xsodata[pathname] = filename;
}

function xsjs(pathname, filename) {
  if (this.xsjs[pathname]) {
    return logger.warn(getExistingFileWarning.call(this, 'xsjs', pathname));
  }
  this.xsjs[pathname] = readScript(filename);
}

function xsjslib(pathname, filename) {
  if (this.xsjslib[utils.toResourceId(pathname)]) {
    return logger.warn(getExistingFileWarning.call(this, 'xsjslib', pathname));
  }
  this.xsjslib[utils.toResourceId(pathname)] = readScript(filename);
}

function xscfgd(pathname, filename) {
  if (this.xscfgd[utils.toResourceId(pathname)]) {
    return logger.warn(getExistingFileWarning.call(this, 'xscfgd', pathname));
  }
  this.xscfgd[utils.toResourceId(pathname)] = readXScfgd(filename);
}

function xshttpdest(pathname, filename) {
  if (this.xshttpdest[utils.toResourceId(pathname)]) {
    return logger.warn(getExistingFileWarning.call(this, 'xshttpdest', pathname));
  }
  this.xshttpdest[utils.toResourceId(pathname)] = readHTTPDestination(filename);
}

function xsjob(pathname, filename) {
  if (this.xsjobs[pathname]) {
    return logger.warn(getExistingFileWarning.call(this, 'xsjob', pathname));
  }
  try {
    var data = readJson(filename);
    if (!data) {
      return;
    }

    this.xsjobs[pathname] = new jobs.Job(data, pathname, this.get('rootDirs'));
  } catch (err) {
    logger.error('Invalid .xsjob file "%s": %s', pathname, err.message);
  }
}

function getExistingFileWarning(fileType, pathname) {
  return fileType + ' file with path ' + pathname + ' already exists in other working directory: ' + this.get('rootDirs')[0];
}

function validateJobs() {
  var self = this;

  Object.keys(self.xsjobs).forEach(function(key) {
    var job = self.xsjobs[key];
    job.active = true;
    if (!job.action.isJavaScript()) {
      return;
    }
    var pathname = job.action.getScriptPath();
    if (!self.getScript(pathname)) {
      job.active = false;
      logger.error('XSJS file "%s" required by job "%s", was not found', pathname, job.urlPath);
    }
  });
}
