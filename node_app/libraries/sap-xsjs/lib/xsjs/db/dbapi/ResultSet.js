'use strict';

var _ = require('lodash');
var VError = require('verror');
var ctypes = require('../../../ctypes');
var bufferUtils = require('../../../utils/buffer-utils');
var argumentsUtil = require('../common/arguments-validation');
var ResultSetMetaData = require('./ResultSetMetaData');

module.exports = ResultSet;

function ResultSet(resultSet) {
  this._resultSet = resultSet;
  this._metaData = new ResultSetMetaData(resultSet.metadata);
  this._columnNames = resultSet.metadata.map(function getColumnName(column) {
    return column.columnDisplayName;
  });
  this._rows = this._resultSet.sync.fetch();
  this._row = null;
}
/**
 * Fetches the next row
 * @returns {boolean} True if successful
 */
ResultSet.prototype.next = function () {
  if (Array.isArray(this._rows) && this._rows.length) {
    this._row = this._rows.shift();
    return true;
  }
  this._row = undefined;
  return false;
};

/**
 * Closes the ResultSet
 * @throws Throws an error if the object the method is being called on is not valid.
 * @throws {SQLException}
 */
ResultSet.prototype.close = function () {
  if (!this.isClosed()) {
    this._resultSet.sync.close();
  }
};

/**
 * Checks if the ResultSet is closed.
 * @returns {boolean} Returns true if the ResultSet is already closed, false if not
 * @throws Throws an error if the object the method is being called on is not valid.
 * @throws {SQLException}
 */
ResultSet.prototype.isClosed = function () {
  return this._resultSet.closed;
};

/**
 * Returns the metadata of the result set
 * @returns {db.ResultSetMetaData} The metadata of the result set
 */
ResultSet.prototype.getMetaData = function () {
  return this._metaData;
};

/**
 * Returns an integer value of the specified column, for TINYINT, SMALLINT, INT, and BIGINT column types.
 * An exception is thrown if the value is bigger than 9007199254740992 (2^53) or smaller than -9007199254740992 (-2^53).
 * @param {integer} columnIndex The target column <b>starting from 1</b>
 * @returns {integer} Integer
 * @throws Throws an error if the index parameter is not valid.
 * @throws {SQLException}
 */
ResultSet.prototype.getInteger = function (columnIndex) {
  argumentsUtil.validateGetterArgs(arguments, 1, this._row);
  var rawValue = this._row[this._columnNames[columnIndex - 1]];
  var parsedValue = parseInt(rawValue);
  argumentsUtil.validateParsedInteger(parsedValue, rawValue);
  argumentsUtil.validateIntegerBoundaries(argumentsUtil.INTEGER_TYPE.BIG_INT, parsedValue);
  return parsedValue;
};
ResultSet.prototype.getInt = ResultSet.prototype.getInteger;

/**
 * Returns a ctypes.Int64 value of the specified column. getBigInt is used for BIGINT column types.
 * @param {integer} columnIndex The target column, <b>starting from 1</b>
 * @returns {ctypes.Int64}
 * @throws Throws an error if the index parameter is not valid.
 * @throws {SQLException}
 */
ResultSet.prototype.getBigInt = function (columnIndex) {
  argumentsUtil.validateGetterArgs(arguments, 1, this._row);
  var rawValue = this._row[this._columnNames[columnIndex - 1]];
  var parsedValue = parseInt(rawValue);
  argumentsUtil.validateParsedInteger(parsedValue, rawValue);
  rawValue = _.isNumber(rawValue) ? parsedValue : rawValue;
  return ctypes.Int64(rawValue);
};

/**
 * Returns a number value of the specified column. getDecimal is used for DECIMAL column types.
 * @param {integer} columnIndex The target column <b>starting from 1</b>
 * @returns {number} Number representation
 * @throws Throws an error if the index parameter is not valid.
 * @throws {SQLException}
 */
ResultSet.prototype.getDecimal = function (columnIndex) {
  argumentsUtil.validateGetterArgs(arguments, 1, this._row);
  var value = this._row[this._columnNames[columnIndex - 1]];
  if (_.isNaN(parseFloat(value))) {
    throw new VError('Unsupported type conversion from %s to number. Not a valid number value: "%s"', typeof value, value);
  }
  return parseFloat(value);
};

/**
 * Returns a number value of the specified column. getDouble is used for DOUBLE column types.
 * @param {integer} columnIndex The target column <b>starting from 1</b>
 * @returns {number} Number representation
 * @throws Throws an error if the index parameter is not valid.
 * @throws {SQLException}
 */
ResultSet.prototype.getDouble = ResultSet.prototype.getDecimal;

/**
 * Returns a number value of the specified column. getReal is used for REAL column types.
 * @param {integer} columnIndex The target column <b>starting from 1</b>
 * @returns {number} Number representation
 * @throws Throws an error if the index parameter is not valid.
 * @throws {SQLException}
 */
ResultSet.prototype.getReal = ResultSet.prototype.getDecimal;

/**
 * Returns a number value of the specified column. getFloat is used for FLOAT column types.
 * @param {integer} columnIndex The target column <b>starting from 1</b>
 * @returns {number} Number representation
 * @throws Throws an error if the index parameter is not valid.
 * @throws {SQLException}
 */
ResultSet.prototype.getFloat = ResultSet.prototype.getDecimal;

/**
 * Returns a ArrayBuffer value of the specified column. getBlob is used for BLOB column types.
 * @param {integer} columnIndex The target column, <b>starting from 1</b>
 * @returns {ArrayBuffer} Blob representation
 * @throws Throws an error if the index parameter is not valid.
 * @throws {SQLException}
 */
ResultSet.prototype.getBlob = function (columnIndex) {
  argumentsUtil.validateGetterArgs(arguments, 1, this._row);
  var value = this._row[this._columnNames[columnIndex - 1]];
  if (!bufferUtils.isBinary(value)) {
    throw new VError('Unsupported type conversion from %s to ArrayBuffer', typeof value);
  }
  return bufferUtils.toArrayBuffer(value);
};

/**
 * Returns a string value of the specified column. getClob is used for CLOB column types.
 * @param {integer} columnIndex The target column <b>starting from 1</b>
 * @returns {string} String representation
 * @throws Throws an error if the index parameter is not valid.
 * @throws {SQLException}
 */
ResultSet.prototype.getClob = function (columnIndex) {
  argumentsUtil.validateGetterArgs(arguments, 1, this._row);
  var value = this._row[this._columnNames[columnIndex - 1]];
  if (!bufferUtils.isBuffer(value) && !_.isString(value)) {
    throw new VError('Unsupported type conversion from %s to string', typeof value);
  }
  return bufferUtils.isBuffer(value) ? value.toString('utf8') : value;
};

/**
 * Returns a string value of the specified column. getNClob is used for NCLOB and TEXT column types.
 * @param {integer} columnIndex The target column <b>starting from 1</b>
 * @returns {string} String representation
 * @throws Throws an error if the index parameter is not valid.
 * @throws {SQLException}
 */
ResultSet.prototype.getNClob = ResultSet.prototype.getClob;

/**
 * Returns a string value of the specified column. getString is used for CHAR and VARCHAR column types. ASCII only, not suitable for strings containing unicode characters.
 * @param {integer} columnIndex The target column <b>starting from 1</b>
 * @returns {string} String representation
 * @throws Throws an error if the index parameter is not valid.
 * @throws {SQLException}
 */
ResultSet.prototype.getString = function (columnIndex) {
  argumentsUtil.validateGetterArgs(arguments, 1, this._row);
  var value = this._row[this._columnNames[columnIndex - 1]];
  if (bufferUtils.isBinary(value)) {
    throw new VError('Unsupported type conversion from %s to string', typeof value);
  }
  return value.toString();
};

/**
 * Returns a string value of the specified column. getText is used for TEXT column types.
 * @param {integer} columnIndex The target column <b>starting from 1</b>
 * @returns {string} String representation
 * @throws Throws an error if the index parameter is not valid.
 * @throws {SQLException}
 */
ResultSet.prototype.getText = ResultSet.prototype.getClob;

/**
 * Returns a string value of the specified column. getNString is used for NCHAR, NVARCHAR, SHORTTEXT column types.
 * @param {integer} columnIndex The target column <b>starting from 1</b>
 * @returns {string} String representation
 * @throws Throws an error if the index parameter is not valid.
 * @throws {SQLException}
 */
ResultSet.prototype.getNString = ResultSet.prototype.getString;

/**
 * Returns an ArrayBuffer object of the specified column. getBString is used for BINARY and VARBINARY column types.
 * @param {integer} columnIndex The target column <b>starting from 1</b>
 * @returns {ArrayBuffer} value ArrayBuffer object
 * @throws Throws an error if the index parameter is not valid or the SQL type of the queried parameter does not match.
 * @throws {SQLException}
 */
ResultSet.prototype.getBString = ResultSet.prototype.getBlob;

/**
 * Used to retrieve the value of a DATE column in a ResultSet.
 * @param {integer} columnIndex The index of the column in the resultset <b>starting from 1</b>
 * @returns {Date} A JavaScript Date object representing the value
 * @throws Throws an error if the index parameter is not valid.
 * @throws {SQLException}
 */
ResultSet.prototype.getDate = function (columnIndex) {
  argumentsUtil.validateGetterArgs(arguments, 1, this._row);
  var value = this._row[this._columnNames[columnIndex - 1]];
  argumentsUtil.validateDateValue(value);
  var date = new Date(value);
  if (_.isNaN(date.getTime())) {
    throw new VError('Unsupported type conversion from string "%s" to a valid date object', value);
  }

  // value string is in ISO 8601 format without time zone, so Date assumes UTC time. We have to correct it to local time
  date.setTime(date.getTime() + date.getTimezoneOffset() * 60000);
  return _.isNull(value) ? null : date;
};

/**
 * Used to retrieve the value of a TIME column in a ResultSet.
 * @param {integer} columnIndex The index of the column in the resultset <b>starting from 1</b>
 * @returns {Date} A JavaScript Date object representing the value
 * @throws Throws an error if the index parameter is not valid.
 * @throws {SQLException}
 */
ResultSet.prototype.getTime = function (columnIndex) {
  argumentsUtil.validateGetterArgs(arguments, 1, this._row);
  var value = this._row[this._columnNames[columnIndex - 1]];
  argumentsUtil.validateDateValue(value);
  var validTimeMatch = !_.isNull(value) && value.match(/(\d{2}):(\d{2}):(\d{2})(\.(\d+))?/);
  if (!validTimeMatch) {
    return this.getDate(columnIndex);
  }
  return new Date(-1, 11, 31, ~~validTimeMatch[1], ~~validTimeMatch[2], ~~validTimeMatch[3], 0);
};

/**
 * Used to retrieve the value of a SECONDDATE column in a ResultSet.
 * @param {integer} columnIndex The index of the column in the resultset <b>starting from 1</b>
 * @returns {Date} A JavaScript Date object representing the value
 * @throws Throws an error if the index parameter is not valid.
 * @throws {SQLException}
 */
ResultSet.prototype.getSeconddate = ResultSet.prototype.getDate;

/**
 * Used to retrieve the value of a TIMESTAMP column in a ResultSet. <br>
 * As this type contains only time information and no date, the JavaScript's date object will always be 1 Jan 1970 plus the time offset.<br>
 * For example: if the stored value is 10:00:00, the JavaScript Date object will be: 1 Jan 1970 10:00:00.
 * @param {integer} columnIndex The index of the column in the resultset <b>starting from 1</b>
 * @returns  {Date} A JavaScript Date object representing the value<br>
 * @throws Throws an error if the index parameter is not valid.
 * @throws {SQLException}
 */
ResultSet.prototype.getTimestamp = ResultSet.prototype.getDate;
