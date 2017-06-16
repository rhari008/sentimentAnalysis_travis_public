'use strict';

var assert            = require('assert');
var PreparedStatement = require('./PreparedStatement');
var CallableStatement = require('./CallableStatement');

exports = module.exports = Connection;

function Connection(client) {
  assert(typeof client === 'object', 'Valid hdb.client should be provided to create $.db.Connection');
  this._client = client;
}

/**
 * Prepares a statement for execution
 * @param {string} statement The SQL statement to be prepared
 * @returns {PreparedStatement} PreparedStatement object that represents the prepared statement
 * @throws Throws an error on invalid parameters or if the object the method is being called on is not valid.
 * @throws {SQLException}
 */
Connection.prototype.prepareStatement = function (statement) {
  return new PreparedStatement(this._client.sync.prepare(statement));
};

/**
 * Prepares a stored procedure for execution
 *
 * @example
 * var myCallableStatement = myconnection.prepareCall("{call myprocedure(?)}");
 *
 * @param {string} statement The SQL statement to be prepared
 * @returns {CallableStatement} CallableStatement The object used to represent the callable statement
 * @throws Throws an error on invalid parameters or if the object the method is being called on is not valid.
 * @throws {SQLException}
 */
Connection.prototype.prepareCall = function (statement) {
  return new CallableStatement(this._client.sync.prepare(statement));
};

/**
 * Changes the auto-commit flag of the connection
 * @param {integer} enable An integer value, which can be either 0 (false) or 1 (true)
 * @throws Throws an error if the object the method is being called on is not valid.
 * @throws {SQLException}
 */
Connection.prototype.setAutoCommit = function (enable) {
  this._client.setAutoCommit(enable);
};

/**
 * Commits the changes.
 * @throws Throws an error if the object the method is being called on is not valid.
 * @throws {SQLException}
 */
Connection.prototype.commit = function () {
  this._client.sync.commit();
};

/**
 * Rolls back the changes.
 * @throws Throws an error if the object the method is being called on is not valid.
 * @throws {SQLException}
 */
Connection.prototype.rollback = function () {
  this._client.sync.rollback();
};

/**
 * Closes the connection.
 * @throws Throws an error if the object the method is being called on is not valid.
 * @throws {SQLException}
 */
Connection.prototype.close = function () {
  if (this._client) {
    this._client.close();
    this._client = null;
  }
};

/**
 * Checks if the connection is closed.
 * @returns {boolean} Returns true if the connection is already closed, false if not
 * @throws Throws an error if the object the method is being called on is not valid.
 * @throws {SQLException}
 */
Connection.prototype.isClosed = function () {
  return this._client.readyState !== 'connected';
};
