'use strict';

var util = require('util');
var Statement = require('./Statement');
var ResultSetMetaData = require('./ResultSetMetaData');

module.exports = PreparedStatement;

util.inherits(PreparedStatement, Statement);

function PreparedStatement(statement) {
  Statement.call(this, statement);
  this._batchParameters = [];
}

/**
 * Executes an SQL statement
 * @returns {db.ResultSet} ResultSet Holds the result of the executed SQL statement
 * @throws Throws an error if the object the method is being called on is not valid.
 * @throws {SQLException}
 */
PreparedStatement.prototype.executeQuery = function () {
  this.execute();
  return this.getResultSet();
};

/**
 * Executes an update statement
 * @returns {integer} The number of changed rows resulting from the update statement
 * @throws Throws an error if the object the method is being called on is not valid.
 * @throws {SQLException}
 */
PreparedStatement.prototype.executeUpdate = function () {
  this.execute();
  return this._results.rowsAffected;
};


/**
 * Reserves space for batch insertion
 * @param {integer} size The number (count) of batch insertions that will be performed
 * @throws Throws an error on invalid parameters or if the object the method is being called on is not valid.
 * @throws {SQLException}
 */
PreparedStatement.prototype.setBatchSize = function (size) { // eslint-disable-line no-unused-vars

};


/**
 * Adds last parameter values and iterates to the next batch slot
 * @throws Throws an error if the statement if setBatchSize has not been called successfully or if the object the method is being called on is not valid.
 * @throws {SQLException}
 */
PreparedStatement.prototype.addBatch = function () {
  this._batchParameters.push(this._parameters);
  this._parameters = [];
};


/**
 * Executes a batch insertion. Use setBatchSize and addBatch to prepare for batch execution.
 * @returns {array} Array with integers representing the number of updated rows per batch
 * @throws Throws an error if the object the method is being called on is not valid.
 * @throws {SQLException}
 */
PreparedStatement.prototype.executeBatch = function () {
  this._statement.sync.exec(this._batchParameters);
  this._batchParameters = [];
};


/**
 * Returns the metadata of the ResultSet
 * @returns {db.ResultSetMetaData} ResultSetMetaData object
 * @deprecated Use getMetaData on ResultSet.
 * @see ResultSet#getMetaData
 */
PreparedStatement.prototype.getMetaData = function () {
  return new ResultSetMetaData(this._statement.resultSetMetadata);
};