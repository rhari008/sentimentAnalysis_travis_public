'use strict';

var _ = require('lodash');
var util = require('util');
var hdbext = require('@sap/hdbext');
var constants = hdbext.constants;
var FunctionCode = require('hdb/lib/protocol/common/FunctionCode');
var ctypes = require('../../../ctypes');
var parser = require('../common/parse-time');
var ResultSet = require('./ResultSet');
var bufferUtils = require('../../../utils/buffer-utils');
var xsTypes = require('../../../utils/xs-types');
var ParameterMetaData = require('./ParameterMetaData');
var argumentsUtil = require('../common/arguments-validation');
var INTEGER_TYPE = argumentsUtil.INTEGER_TYPE;

module.exports = Statement;

function Statement(statement) {
  this._statement = statement;
  this._parameters = [];
  this._parameterMetaData = new ParameterMetaData(statement.parameterMetadata);
  this._results = undefined;
  this._resultsIndex = 0;
  this._resultset = undefined;
}

/**
 * Executes a common statement
 * @returns {boolean} True if the execution yielded a result set (i.e. if a SELECT statement was executed), false if not
 * @throws Throws an error if the object the method is being called on is not valid.
 * @throws {SQLException}
 */
Statement.prototype.execute = function () {
  var self = this;

  function executeStatement(cb) {
    self._statement.execute(self._parameters, function (err, arg1) {
      if (err) {
        return cb(err);
      }
      switch (self._statement.functionCode) {
      case FunctionCode.SELECT:
      case FunctionCode.SELECT_FOR_UPDATE:
        return cb(null, {
          resultSets: [arg1]
        });
      case FunctionCode.INSERT:
      case FunctionCode.UPDATE:
      case FunctionCode.DELETE:
        return cb(null, {
          rowsAffected: arg1
        });
      case FunctionCode.NIL:
      case FunctionCode.DDL:
        return cb(null, {});
      case FunctionCode.DB_PROCEDURE_CALL:
      case FunctionCode.DB_PROCEDURE_CALL_WITH_RESULT:
        var parameterMetadata = self._statement.parameterMetadata;
        if (arguments.length < 3) {
          return cb(null, {
            parameters: transformOutputParameters(parameterMetadata, arg1)
          });
        }
        return cb(null, {
          parameters: transformOutputParameters(parameterMetadata, arg1),
          resultSets: Array.prototype.slice.call(arguments, 2)
        });
      default:
        return cb(new Error('Invalid or unsupported FunctionCode ' + self._statement.functionCode));
      }
    });
  }
  this._results = executeStatement.sync();
  this._resultsIndex = 0;
  return !!this._results.resultSets;
};

/**
 * Closes the statement
 * @throws Throws an error if the object the method is being called on is not valid.
 * @throws {SQLException}
 */
Statement.prototype.close = function () {
  if (!this._statement.droped) {
    this._statement.sync.drop();
  }
};

/**
 * Checks if the statement is closed.
 * @returns {boolean} Returns true if the statement is already closed, false if not
 * @throws Throws an error if the object the method is being called on is not valid.
 * @throws {SQLException}
 */
Statement.prototype.isClosed = function () {
  return !!this._statement.droped;
};

/**
 * Returns a resultset representing a table output parameter
 * @returns {db.ResultSet} ResultSet of the next output table parameter
 * @throws Throws an error if the object the method is being called on is not valid.
 * @throws {SQLException}
 */
Statement.prototype.getResultSet = function () {
  if (this._resultset) {
    return this._resultset;
  }
  if (this._results && Array.isArray(this._results.resultSets)) {
    var rs = this._results.resultSets[this._resultsIndex];
    if (rs) {
      this._resultset = new ResultSet(rs);
      return this._resultset;
    }
  }
};

/**
 * Checks if more resultsets are available and prepares the next resultset for retrieval
 * @returns {boolean} True if the next resultset is available
 * @throws Throws an error if the object the method is being called on is not valid.
 * @throws {SQLException}
 */
Statement.prototype.getMoreResults = function () {
  if (this._results && Array.isArray(this._results.resultSets)) {
    this._resultset = undefined;
    return ++this._resultsIndex < this._results.resultSets.length;
  }
  return false;
};

/**
 * Returns the metadata of the prepared statement
 * @returns {db.ParameterMetaData} ParameterMetaData object
 * @throws Throws an error if the object the method is being called on is not valid.
 * @throws {SQLException}
 */
Statement.prototype.getParameterMetaData = function () {
  return this._parameterMetaData;
};

/**
 * Sets an integer parameter used for BIGINT column types
 * @param {integer} columnIndex The index of the parameter in the prepared statement <b>starting from 1</b>
 * @param {integer} value The number value to be set for this parameter
 * @throws Throws an error on invalid parameters.
 * @throws {SQLException}
 */
Statement.prototype.setBigInt = function (columnIndex, value) {
  argumentsUtil.validateSetterArgs(arguments, 2);
  var bigInt;
  if (value === undefined) {
    bigInt = '-9223372036854775808';
  } else if (value === null || value === '') {
    bigInt = 0;
  } else if (value instanceof ctypes.Int64) {
    bigInt = value.toString();
  }
  if (bigInt !== undefined) {
    return this._parameters[columnIndex - 1] = bigInt;
  }

  if (_.isObject(value)) {
    throw new Error('Second argument is not an Int64 object');
  }

  if (_.isString(value)) {
    value = Number.parseFloat(value);
    if (Number.isNaN(value)) {
      throw new Error('Could not convert second argument to double');
    }
  }
  argumentsUtil.validateNumber(value);
  argumentsUtil.validateIntegerBoundaries(INTEGER_TYPE.BIG_INT, value);
  this._parameters[columnIndex - 1] = argumentsUtil.numberToInteger(value);
};

/**
 * Sets an integer parameter used for TINYINT, SMALLINT, INT column types
 * @param {integer} columnIndex The index of the parameter in the prepared statement <b>starting from 1</b>
 * @param {integer} value The integer value to be set for this parameter
 * @throws Throws an error on invalid parameters.
 * @throws {SQLException}
 */
Statement.prototype.setInteger = function (columnIndex, value) {
  argumentsUtil.validateSetterArgs(arguments, 2);
  argumentsUtil.validateNumber(value);
  argumentsUtil.validateIntegerBoundaries(INTEGER_TYPE.INTEGER, value);
  this._parameters[columnIndex - 1] = argumentsUtil.numberToInteger(value);
};
Statement.prototype.setInt = Statement.prototype.setInteger;

/**
 * Sets an integer parameter used for SMALLINT column types
 * @param {integer} columnIndex The index of the parameter in the prepared statement <b>starting from 1</b>
 * @param {integer} value The integer value to be set for this parameter
 * @throws Throws an error on invalid parameters.
 * @throws {SQLException}
 */
Statement.prototype.setSmallInt = function (columnIndex, value) {
  argumentsUtil.validateSetterArgs(arguments, 2);
  argumentsUtil.validateInteger(value);
  argumentsUtil.validateIntegerBoundaries(INTEGER_TYPE.SMALL_INT, value);
  this._parameters[columnIndex - 1] = value;
};

/**
 * Sets an integer parameter used for TINYINT column types
 * @param {integer} columnIndex The index of the parameter in the prepared statement, <b>starting from 1</b>
 * @param {integer} value The integer value to be set for this parameter (unsigned char: min 0, max 255)
 * @throws Throws an error on invalid parameters.
 * @throws {SQLException}
 */
Statement.prototype.setTinyInt = function (columnIndex, value) {
  argumentsUtil.validateSetterArgs(arguments, 2);
  argumentsUtil.validateInteger(value);
  argumentsUtil.validateIntegerBoundaries(INTEGER_TYPE.TINY_INT, value);
  this._parameters[columnIndex - 1] = value;
};

/**
 * setDouble sets a double parameter used for FLOAT and DOUBLE column types.
 * @param {integer} columnIndex The index of the parameter in the prepared statement <b>starting from 1</b>
 * @param {number} value The number value to be set for this parameter
 * @throws Throws an error on invalid parameters.
 * @throws {SQLException}
 */
Statement.prototype.setDouble = function (columnIndex, value) {
  argumentsUtil.validateSetterArgs(arguments, 2);
  argumentsUtil.validateNumber(value);
  if (!Number.isFinite(value)) {
    throw new Error('Second argument is +/-Infinity');
  }
  this._parameters[columnIndex - 1] = value;
};

/**
 * setFloat sets a float parameter used for FLOAT column types.
 * @param {integer} columnIndex The index of the parameter in the prepared statement <b>starting from 1</b>
 * @param {number} value The number value to be set for this parameter
 * @throws Throws an error on invalid parameters.
 * @throws {SQLException}
 */
Statement.prototype.setFloat = Statement.prototype.setDouble;

/**
 * setDecimal sets a decimal parameter used for DECIMAL column types.
 * @param {integer} index The index of the parameter in the prepared statement <b>starting from 1</b>
 * @param {number} value The number value to be set for this parameter
 * @throws Throws an error on invalid parameters.
 * @throws {SQLException}
 */
Statement.prototype.setDecimal = function (columnIndex, value) {
  argumentsUtil.validateSetterArgs(arguments, 2);
  if (!_.isNumber(value) && !_.isString(value)) {
    throw new Error('Expected either a number or a string as second argument');
  }
  if (_.isNumber(value) && !Number.isFinite(value)) {
    throw new Error('Second argument is +/-Infinity');
  }
  this._parameters[columnIndex - 1] = value.toString();
};

/**
 * setReal sets a real parameter used for REAL column types.
 * @param {integer} columnIndex The index of the parameter in the prepared statement <b>starting from 1</b>
 * @param {number} value The number value to be set for this parameter
 * @throws Throws an error on invalid parameters.
 * @throws {SQLException}
 */
Statement.prototype.setReal = Statement.prototype.setDouble;

/**
 * setBlob is used to specify the values for CHAR, VARCHAR, NCHAR, NVARCHAR, BINARY, and VARBINARY column types.
 * @param {integer} columnIndex The index of the parameter in the prepared statement, <b>starting from 1</b>
 * @param {ArrayBuffer} value The ArrayBuffer object to be set for this parameter, can also be an Array of integers or a string.
 * @throws Throws an error on invalid parameters.
 * @throws {SQLException}
 */
Statement.prototype.setBlob = function (columnIndex, value) {
  argumentsUtil.validateSetterArgs(arguments, 2);
  if (bufferUtils.isBinary(value)) {
    value = bufferUtils.toBuffer(value);
  } else if (xsTypes.isWebBody(value)) {
    value = bufferUtils.bodyToBuffer(value);
  } else if (xsTypes.isZip(value)) {
    value = bufferUtils.toBuffer(value.asArrayBuffer());
  } else {
    throw new Error('Expected ArrayBuffer, WebBody or a Zip object as second argument');
  }

  this._parameters[columnIndex - 1] = value;
};

/**
 * setClob is used to specify the values for CLOB column types.
 * @param {integer} columnIndex The index of the parameter in the prepared statement <b>starting from 1</b>
 * @param {string} value The string value to be set for this parameter
 * @throws Throws an error on invalid parameters.
 * @throws {SQLException}
 */
Statement.prototype.setClob = function (columnIndex, value) {
  argumentsUtil.validateSetterArgs(arguments, 2);
  argumentsUtil.validateString(value);
  this._parameters[columnIndex - 1] = value;
};

/**
 * setNClob is used to specify the values for NCLOB column types.
 * @param {integer}  columnIndex The index of the parameter in the prepared statement <b>starting from 1</b>
 * @param {string} value The string value to be set for this parameter
 * @throws Throws an error on invalid parameters.
 * @throws {SQLException}
 */
Statement.prototype.setNClob = Statement.prototype.setClob;

/**
 * Sets a string parameter used for CHAR, VARCHAR column types; ASCII only, not suitable for strings containing Unicode characters <br>
 * This function can be used to store strings containing ASCII and a subset of Unicode (namely BMP; the first 0xFFFF characters). <br>
 * This function does not convert data; to improve performance, it stores data directly in the database. <br>
 * Note that special characters (in Unicode SMP or SIP) can cause the read operation to fail.
 * For more information see {@link http://en.wikipedia.org/wiki/Plane_%28Unicode%29|Plane (Unicode)}. <br>
 * If also need special unicode characters or if you are not sure what this means it is safer to use setNString.
 * @param {integer} columnIndex The index of the parameter in the statement <b>starting from 1</b>
 * @param {string} value The string value to be set for this parameter
 * @throws Throws an error on invalid parameters.
 * @throws {SQLException}
 */
Statement.prototype.setString = function (columnIndex, value) {
  argumentsUtil.validateSetterArgs(arguments, 2);
  if (value !== undefined && !_.isString(value)) {
    throw new Error('Expected undefined or string as second argument');
  }
  this._parameters[columnIndex - 1] = (value === undefined) ? null : value;
};

/**
 * Sets a string parameter used for NCHAR, NVARCHAR parameter types, which should be used for strings containing unicode characters. <br>
 * This function converts the given unicode string into a storable format. Make sure you use getNString to read the data.
 * If you use getString on a column you wrote with setNString, an exception is thrown if the string contains unicode characters lager than 0xFFFF.
 * @param {integer} columnIndex The index of the parameter <b>starting from 1</b>
 * @param {string} value The string value to be set for this parameter
 * @throws Throws an error on invalid parameters.
 * @throws {SQLException}
 */
Statement.prototype.setNString = Statement.prototype.setString;

/**
 * Sets an array buffer parameter used for BINARY, VARBINARY column types. <br> Remark: the BINARY type is deprecated - its behavior in row store and column store differs in that row store may pad with zeros.
 * @param {integer} columnIndex The index of the parameter in the prepared statement <b>starting from 1</b>
 * @param {ArrayBuffer} value The ArrayBuffer object to be set for this parameter.
 * @throws Throws an error on invalid parameters.
 * @throws {SQLException}
 */
Statement.prototype.setBString = function (columnIndex, value) {
  argumentsUtil.validateSetterArgs(arguments, 2);
  if (value === undefined) {
    return this._parameters[columnIndex - 1] = null;
  }
  if (bufferUtils.isBinary(value)) {
    value = bufferUtils.toBuffer(value);
  } else if (xsTypes.isWebBody(value)) {
    value = bufferUtils.bodyToBuffer(value);
  } else {
    throw new Error('Expected undefined, ArrayBuffer or WebBody as second argument');
  }

  this._parameters[columnIndex - 1] = value;
};

/**
 * setText is used to specify the values for TEXT column types.
 * @param {integer} columnIndex The index of the parameter in the prepared statement <b>starting from 1</b>
 * @param {string} value The string value to be set for this parameter
 * @throws Throws an error on invalid parameters.
 * @throws {SQLException}
 */
Statement.prototype.setText = Statement.prototype.setClob;

/**
 * Sets a Date parameter for DATE columns, but works with TIME and TIMESTAMP. It is not possible to set the time with setDate; you can only set the date.
 * @param {integer} columnIndex The index of the parameter in the prepared statement <b>starting from 1</b>
 * @param {Date|string} value The date to be set for this parameter <br/>
 *        The parameter can be either a Date object, a string in default ptime format (YYYY-MM-DD), or a string in the optionally specified format.<br/>
 *        For example: 'yyyymmdd' or 'yyyy-mm-dd' or 'yyyy/mm/dd'
 * <ul>
 * <li>Y,YY,YYY,YYYY-year</li>
 * <li>D-day</li>
 * <li>J-julian day</li>
 * <li>MONTH-by name,MON-abbr.</li>
 * <li>M-month</li>
 * <li>Q-quarter</li>
 * <li>RM-roman numeral month</li>
 * <li>W-week of month</li>
 * <li>WW-week of year.</li>
 * </ul>
 * Note that when you construct a new Date JavaScript object, the month number starts from <b>0</b> (not 1).<br>
 * For example the following statement represents <em>1st of Jan, 2010</em>:<br>
 * <i>new Date(2010,0,1);</i>
 * @param {string} [format=""] One of the following formats: <br/>
 * @throws Throws an error on invalid parameters.
 * @throws {SQLException}
 */
Statement.prototype.setDate = function (columnIndex, value, format) {
  argumentsUtil.validateSetterArgs(arguments, 2);
  argumentsUtil.validateDateTime(value);
  if (!util.isDate(value)) {
    value = parser.parseDateTime(value, format);
  }
  var type = this.getParameterMetaData().getParameterType(columnIndex);
  switch (type) {
  case constants.types.TIMESTAMP:
    value = new Date(value);
    value.setHours(0, 0, 0, 0); // setDate truncates the time
    value = parser.formatDateTime(value);
    break;
  case constants.types.TIME:
    value = '00:00:00';
    break;
  default:
    value = parser.formatDate(value);
  }
  this._parameters[columnIndex - 1] = value;
};

/**
 * Sets a Time parameter used for TIME column types (hour, min, sec). You cannot set milliseconds (mls).
 * @param {integer} columnIndex The index of the parameter in the prepared statement, <b>starting from 1</b>
 * @param {Date|string} value The Date value to be set for this parameter <br>
 * <ul>
 * <li>HH:MI:SS.FF AM</li>
 * <li>HH24:MI:SS.FF</li>
 * <li>HH:MI:SS AM</li>
 * <li>HH24:MI:SS</li>
 * <li>HH:MI AM</li>
 * <li>HH24:MI</li>
 * <li>HH24:MI:SS.FF Z</li>
 * <li>HH24:MI:SS Z</li>
 * </ul>
 * @param {string} [format=""] One of the following formats:<br/>
 * @throws Throws an error on invalid parameters.
 * @throws {SQLException}
 */
Statement.prototype.setTime = function (columnIndex, value, format) {
  argumentsUtil.validateSetterArgs(arguments, 2);
  argumentsUtil.validateDateTime(value);
  if (!util.isDate(value)) {
    value = parser.parseDateTime(value, format);
  }
  var type = this.getParameterMetaData().getParameterType(columnIndex);
  switch (type) {
  case constants.types.TIMESTAMP:
    value = parser.formatDateTime(value);
    break;
  case constants.types.DATE:
    value = '0000-00-00';
    break;
  default:
    value = parser.formatTime(value);
  }
  this._parameters[columnIndex - 1] = value;
};

/**
 * Sets a Timestamp parameter used for TIMESTAMP column types
 * @param {integer} columnIndex The index of the parameter in the prepared statement <b>starting from 1</b>
 * @param {Date|string} value The timestamp value to be set for this parameter
 * The default format is: <b>date</b> <b>separator</b> <b>time</b>, for example, <br>
 * 2001-01-02 01:02:03.123, where <b>date</b> is the format to use for the date value <br>
 * (see setDate), <b>separator</b> can be a space, a comma, or the letter T, and <br>
 * <b>time</b> is the format to use for the time value (see setTime).<br>
 * Examples:<br>
 * 2001-01-02 01:02:03.123<br>
 * 2001-01-02,01:02:03.123<br>
 * 2001-01-02T01:02:03.123<br>
 * <i>st.setTimestamp(4,"01.02.2003 01:02:03.123", "DD.MM.YYYY HH:MI:SS.FF");</i>
 * @param {string} [format=""] Optional, see also setDate and setTime
 * @throws Throws an error on invalid parameters.
 * @throws {SQLException}
 */
Statement.prototype.setTimestamp = function (columnIndex, value, format) {
  argumentsUtil.validateSetterArgs(arguments, 2);
  argumentsUtil.validateDateTime(value);
  if (!util.isDate(value)) {
    value = parser.parseDateTime(value, format);
  }
  var type = this.getParameterMetaData().getParameterType(columnIndex);
  switch (type) {
  case constants.types.TIME:
    value = parser.formatTime(value);
    break;
  case constants.types.DATE:
    value = parser.formatDate(value);
    break;
  default:
    value = parser.formatDateTime(value);
  }
  this._parameters[columnIndex - 1] = value;
};

/**
 * setNull is used to set a Null parameter used for all column types.
 * @param {integer} columnIndex The index of the parameter in the prepared statement <b>starting from 1</b>
 * @throws Throws an error on invalid parameters.
 * @throws {SQLException}
 */
Statement.prototype.setNull = function (columnIndex) {
  argumentsUtil.validateSetterArgs(arguments, 1);
  this._parameters[columnIndex - 1] = null;
};

/*
function isOutputParameter(metadata) {
  return metadata.ioType > 1;
}
*/

function transformOutputParameters(parameterMetadata, outputParameters) {
  return parameterMetadata.map(function (val) {
    return outputParameters[val.name];
  });
}
