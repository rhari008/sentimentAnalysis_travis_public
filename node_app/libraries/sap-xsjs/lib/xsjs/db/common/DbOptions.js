'use strict';

var _ = require('lodash');
var VError = require('verror');
var HttpError = require('../../../utils/http-error');
var connOptions = require('@sap/hdbext').connectionOptions;
var instanceManager = require('@sap/instance-manager');

var INSTANCE_MANAGER_OPTS = [
  'user', 'password',
  'post_managed_instance_url', 'delete_managed_instance_url',
  'get_managed_instance_url', 'get_all_managed_instances_url',
  'polling_interval_millis', 'polling_timeout_seconds',
  'cache_max_items', 'cache_item_expire_seconds'
];

module.exports = DbOptions;

function DbOptions(globalOptions) {
  this._globalOptions = globalOptions;
  this._instManager = null;
}

DbOptions.prototype._getInstanceManager = function (cb) {
  if (this._instManager) {
    return cb(null, this._instManager);
  }
  var self = this;
  instanceManager.create(this._globalOptions, function (err, instManager) {
    if (err) {
      return cb(err);
    }
    self._instManager = instManager;
    cb(null, instManager);
  });
};

DbOptions.prototype.forRequest = function (req, locale) {
  return new DbRequestOptions(this, req, locale);
};

function DbRequestOptions(dbOptions, req, locale) {
  this._dbOptions = dbOptions;
  this._globalOptions = _.cloneDeep(dbOptions._globalOptions);
  this._req = req;
  this._locale = locale;
}

DbRequestOptions.prototype.useSqlcc = function (sqlccName) {
  if (isInstanceManagerOptions(this._globalOptions)) {
    this._globalOptions = _.omit(this._globalOptions, INSTANCE_MANAGER_OPTS);
  }
  _.merge(this._globalOptions, getSqlccOptions(this._globalOptions, sqlccName));
};

function getSqlccOptions(options, sqlccName) {
  if (!options.sqlcc || !options.sqlcc[sqlccName]) {
    throw new TypeError('SQLCC connection with name "' + sqlccName +
      '" not found in the provided hana configurations');
  }

  return options.sqlcc[sqlccName];
}

DbRequestOptions.prototype.getInstanceOptions = function (callback) {
  if (!isInstanceManagerOptions(this._globalOptions)) {
    var options = addRequestOptions(this._req, this._locale, this._globalOptions);
    return callback(null, options);
  }
  var self = this;
  this._dbOptions._getInstanceManager(function (err, instManager) {
    if (err) {
      return callback(err);
    }
    var tenant = getTenant(self._req.authInfo);
    if (!tenant) {
      return callback(new Error('Could not get HANA service instance as no tenant is available in current context.'));
    }
    instManager.get(tenant, function (err, instance) {
      if (err) {
        return callback(err);
      }

      if (!instance) {
        return callback(new VError("No service instance for tenant '%s'", tenant));
      }
      if (instance.status !== 'CREATION_SUCCEEDED') {
        return callback(new VError("Status of service instance for tenant '%s' is %s", tenant, instance.status));
      }
      var hanaOptions = _.merge(_.omit(self._globalOptions, INSTANCE_MANAGER_OPTS), instance.credentials);
      callback(null, addRequestOptions(self._req, self._locale, hanaOptions));
    });
  });
};

function getTenant(authInfo) {
  return authInfo && authInfo.getIdentityZone();
}

function getUserToken(authInfo) {
  return authInfo && authInfo.getHdbToken();
}

function isInstanceManagerOptions(options) {
  return !!options.get_managed_instance_url;
}

function addRequestOptions(req, locale, hanaSettings) {
  var hana = _.merge({}, hanaSettings,
    connOptions.getRequestOptions(req),
    { locale: locale && locale.dbLocale });

  if (hana.connectWithLoggedUser) {
    var userToken = getUserToken(req.authInfo);
    if (!userToken) {
      throw new HttpError(400, 'No user token in request');
    }
    delete hana.user;
    delete hana.password;
    hana.assertion = userToken;
  }
  delete hana.sqlcc;
  return hana;
}
