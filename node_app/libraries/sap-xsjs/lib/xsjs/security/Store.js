'use strict';

var assert = require('assert');
var connection = require('../db/common/connection');
exports.createStore = createStore;

function createStore(dbReqOptions) {
  return function (secureStoreFile) {
    return new Store(dbReqOptions, secureStoreFile);
  };
}

function Store(dbReqOptions, secureStoreFile) {
  this._secureStoreFile = secureStoreFile;
  var hanaOptions = dbReqOptions.sync.getInstanceOptions();
  this._client = connection.sync.connect(hanaOptions);
}

Store.prototype.read = function (parameter) {
  checkParameterHasName(parameter, 'read');
  return read.call(this, parameter, false);
};

Store.prototype.readForUser = function (parameter) {
  checkParameterHasName(parameter, 'readForUser');
  return read.call(this, parameter, true);
};

function read(parameter, isForUser) {
  var stmt = this._client.sync.prepare('CALL "SYS"."USER_SECURESTORE_RETRIEVE"(?, ?, ?, ?)');
  var result = stmt.sync.exec({
    STORE_NAME: this._secureStoreFile,
    FOR_XS_APPLICATIONUSER: isForUser,
    KEY: parameter.name
  });
  return result && result.VALUE ? result.VALUE.toString('utf8') : null;
}

Store.prototype.remove = function (parameter) {
  checkParameterHasName(parameter, 'remove');
  remove.call(this, parameter, false);
};

Store.prototype.removeForUser = function (parameter) {
  checkParameterHasName(parameter, 'removeForUser');
  remove.call(this, parameter, true);
};

function remove(parameter, isForUser) {
  var stmt = this._client.sync.prepare('CALL "SYS"."USER_SECURESTORE_DELETE"(?, ?, ?)');
  stmt.sync.exec({
    STORE_NAME: this._secureStoreFile,
    FOR_XS_APPLICATIONUSER: isForUser,
    KEY: parameter.name
  });
}

Store.prototype.store = function (parameter) {
  checkWriteParameter(parameter, 'store');
  store.call(this, parameter, false);
};

Store.prototype.storeForUser = function (parameter) {
  checkWriteParameter(parameter, 'storeForUser');
  store.call(this, parameter, true);
};

function store(parameter, isForUser) {
  var stmt = this._client.sync.prepare('CALL "SYS"."USER_SECURESTORE_INSERT"(?, ?, ?, ?)');
  stmt.sync.exec({
    STORE_NAME: this._secureStoreFile,
    FOR_XS_APPLICATIONUSER: isForUser,
    KEY: parameter.name,
    VALUE: new Buffer(parameter.value, 'utf8')
  });
}

function checkWriteParameter(parameter, functionName) {
  checkParameterHasName(parameter, functionName);
  assert(typeof parameter.value === 'string', 'Store.' + functionName + ' should be called with object containing property value - string!');
}

function checkParameterHasName(parameter, functionName) {
  assert(parameter && typeof parameter === 'object', 'Store.' + functionName + ' called with invalid parameter');
  assert(parameter.name && typeof parameter.name === 'string', 'Store.' + functionName + ' should be called with object containing property name - non empty string!');
}
