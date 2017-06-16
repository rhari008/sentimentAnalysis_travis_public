'use strict';

var util = require('util');
var Statement = require('./Statement');
var ctypes = require('../../../ctypes');

module.exports = CallableStatement;

util.inherits(CallableStatement, Statement);

function CallableStatement(statement) {
  Statement.call(this, statement);
}

/**
 * Returns an integer value of a TINYINT, SMALLINT, INT or BIGINT parameter types
 * An exception will be thrown if the value is bigger than 9007199254740992 (2^53) or smaller than -9007199254740992 (-2^53).
 * @param {integer} index The index of the parameter <b>starting from 1</b>
 * @returns {integer} Integer representation
 * @throws Throws an error if the index parameter is not valid or the SQL type of the queried parameter does not match.
 * @throws {SQLException}
 */
CallableStatement.prototype.getInteger = getValue;
CallableStatement.prototype.getInt = CallableStatement.prototype.getInteger;

/**
 * Returns an Int64 value of a BIGINT parameter
 * @param {integer} index The index of the parameter <b>starting from 1</b>
 * @returns {ctypes.Int64} ctypes.Int64
 * @throws Throws an error if the index parameter is not valid or the SQL type of the queried parameter does not match.
 * @throws {SQLException}
 */
CallableStatement.prototype.getBigInt = function getValue(columnIndex) {
  var value = this._results.parameters[columnIndex - 1];
  return ctypes.Int64(value);
};

/**
 * Returns a string value of a CHAR or VARCHAR parameter; ASCII only, not suitable for strings containing unicode characters.
 * @param {integer} index The index of the parameter <b>starting from 1</b>
 * @returns {string} String representation
 * @throws Throws an error if the index parameter is not valid or the SQL type of the queried parameter does not match.
 * @throws {SQLException}
 */
CallableStatement.prototype.getString = getValue;

/**
 * Returns the string value of an NCHAR, an NVARCHAR, or a SHORTTEXT parameter
 * @param {integer} index The index of the parameter <b>starting from 1</b>
 * @returns {string} String representation
 * @throws Throws an error if the index parameter is not valid or the SQL type of the queried parameter does not match.
 * @throws {SQLException}
 */
CallableStatement.prototype.getNString = getValue;

/**
 * Returns an ArrayBuffer object of the specified column. getBString is used for BINARY and VARBINARY column types.
 * @param {integer} index The index of the parameter <b>starting from 1</b>
 * @returns {ArrayBuffer} value ArrayBuffer object
 * @throws Throws an error if the index parameter is not valid or the SQL type of the queried parameter does not match.
 * @throws {SQLException}
 */
CallableStatement.prototype.getBString = getValue;

/**
 * Returns a number value of the specified column. getReal is used for REAL column types.
 * @param {integer} columnIndex The target column <b>starting from 1</b>
 * @returns {number} Number representation
 * @throws Throws an error if the index parameter is not valid.
 * @throws {SQLException}
 */
CallableStatement.prototype.getReal = getNumber;

/**
 * Returns a number value of the specified column. getFloat is used for FLOAT column types.
 * @param {integer} columnIndex The target column <b>starting from 1</b>
 * @returns {number} Number representation
 * @throws Throws an error if the index parameter is not valid.
 * @throws {SQLException}
 */
CallableStatement.prototype.getFloat = getNumber;

/**
 * Returns a number value of a DOUBLE, FLOAT or REAL parameter
 * @param {integer} index The index of the parameter <b>starting from 1</b>
 * @returns {number} Number representation
 * @throws Throws an error if the index parameter is not valid or the SQL type of the queried parameter does not match.
 * @throws {SQLException}
 */
CallableStatement.prototype.getDouble = getNumber;

/**
 * Returns a number value of a DECIMAL parameter
 * @param {integer} index The index of the parameter <b>starting from 1</b>
 * @returns {number} Number representation
 * @throws Throws an error if the index parameter is not valid or the SQL type of the queried parameter does not match.
 * @throws {SQLException}
 */
CallableStatement.prototype.getDecimal = getNumber;

/**
 * Returns the ArrayBuffer value of a BLOB specified parameter
 * @param {integer} index The index of the parameter <b>starting from 1</b>
 * @returns {ArrayBuffer} Blob representation
 * @throws Throws an error if the index parameter is not valid or the SQL type of the queried parameter does not match.
 * @throws {SQLException}
 */
CallableStatement.prototype.getBlob = getValue;

/**
 * Returns the string value of a CLOB parameter
 * @param {integer} index The index of the parameter <b>starting from 1</b>
 * @returns {string} String representation
 * @throws Throws an error if the index parameter is not valid or the SQL type of the queried parameter does not match.
 * @throws {SQLException}
 */
CallableStatement.prototype.getClob = getValue;

/**
 * Returns the string value of a NCLOB or TEXT parameter
 * @param {integer} index The index of the parameter <b>starting from 1</b>
 * @returns {string} String representation
 * @throws Throws an error if the index parameter is not valid or the SQL type of the queried parameter does not match.
 * @throws {SQLException}
 */
CallableStatement.prototype.getNClob = getValue;

/**
 * Returns the string value of a TEXT parameter
 * @param {integer} index The index of the parameter <b>starting from 1</b>
 * @returns {string} String representation
 * @throws Throws an error if the index parameter is not valid or the SQL type of the queried parameter does not match.
 * @throws {SQLException}
 */
CallableStatement.prototype.getText = getValue;

/**
 * Used to retrieve the value of a DATE parameter
 * @param {integer} index The index of the parameter, <b>starting from 1</b>
 * @returns {Date} A JavaScript date object representing the value
 * @throws Throws an error if the index parameter is not valid or the SQL type of the queried parameter does not match.
 * @throws {SQLException}
 */
CallableStatement.prototype.getDate = getDate;


/**
 * Used to retrieve the value of a TIME parameter
 * @param {integer} index The index of the parameter <b>starting from 1</b>
 * @returns {Date} A JavaScript date object representing the value
 * @throws Throws an error if the index parameter is not valid or the SQL type of the queried parameter does not match.
 * @throws {SQLException}
 */
CallableStatement.prototype.getTime = getDate;


/**
 * Used to retrieve the value of a SECONDDATE parameter
 * @param {integer} index The index of the parameter <b>starting from 1</b>
 * @returns {Date} A JavaScript date object representing the value
 * @throws Throws an error if the index parameter is not valid or the SQL type of the queried parameter does not match.
 * @throws {SQLException}
 */
CallableStatement.prototype.getSeconddate = getDate;

/**
 * Used to retrieve the value of a TIMESTAMP parameter. <br>
 * As this type contains only time information and no date, the JavaScript's date object will always be 1 Jan 1970 plus the time offset.<br>
 * For example: if the stored value is 10:00:00, the JavaScript date object will specify: 1 Jan 1970 10:00:00
 *
 * @param {integer} index The index of the parameter <b>starting from 1</b>
 * @returns {Date} A JavaScript date object representing the value
 * @throws Throws an error if the index parameter is not valid or the SQL type of the queried parameter does not match.
 * @throws {SQLException}
 */
CallableStatement.prototype.getTimestamp = function (columnIndex) {
  return this.getDate(columnIndex);
};

function getValue(columnIndex) {
  return this._results.parameters[columnIndex - 1];
}

function getNumber(columnIndex) {
  return Number(this._results.parameters[columnIndex - 1]);
}

function getDate(columnIndex) {
  return new Date(this._results.parameters[columnIndex - 1]);
}