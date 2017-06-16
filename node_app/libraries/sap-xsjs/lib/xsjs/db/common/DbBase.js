'use strict';

var _ = require('lodash');
var hdbext = require('@sap/hdbext');
var connection = require('./connection');

module.exports = DbBase;

function DbBase(dbReqOptions) {
  this._dbReqOptions = dbReqOptions;
  this._openConnections = new Set();
}

DbBase.prototype.isolation = hdbext.constants.isolation;

DbBase.prototype.types = hdbext.constants.types;

DbBase.prototype._getClient = function (userOptions) {
  var sqlccName = getSqlccName(userOptions);
  sqlccName && this._dbReqOptions.useSqlcc(sqlccName);
  var hanaOptions = this._dbReqOptions.sync.getInstanceOptions();
  hanaOptions = mergeUserOptions(hanaOptions, userOptions);
  this._options = hanaOptions; // used by $.text
  var client = connection.sync.connect(hanaOptions);

  this._openConnections.add(client);
  client.on('release', releaseConnection.bind(null, this._openConnections, client));
  return client;
};

DbBase.prototype._closeAllConnections = function () {
  this._openConnections.forEach(function(client) {
    client.close();
  });
  this._openConnections.clear();
};

function releaseConnection(openConnections, client) {
  openConnections.delete(client);
}

function getSqlccName(userOptions) {
  userOptions = userOptions || {};
  if (!userOptions.sqlcc) {
    return;
  }

  if (!_.isString(userOptions.sqlcc)) {
    throw new TypeError('The provided SQLCC name is not a string');
  }

  var sqlccName = userOptions.sqlcc.trim();
  if (!sqlccName) {
    throw new TypeError('The provided SQLCC name is empty string or contains only whitespaces');
  }
  return sqlccName;
}

function extractUserOptions(userOptions) {
  var acceptedProperties = ['sqlcc', 'isolationLevel', 'locale'];
  return _.pick(userOptions, acceptedProperties);
}

function mergeUserOptions(options, userOptions) {
  userOptions = extractUserOptions(userOptions);
  var opt = _.extend({}, options, userOptions);
  // use options.locale in case userOptions contains property locale with an empty string
  opt.locale = userOptions.locale || options.locale;
  return opt;
}
