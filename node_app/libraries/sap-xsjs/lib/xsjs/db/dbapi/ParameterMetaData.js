'use strict';

var hdbext    = require('@sap/hdbext');
var constants = hdbext.constants;

module.exports = ParameterMetaData;

function ParameterMetaData(parameters) {
  this._parameters = parameters;
}

/**
 * Returns the number of the parameters in the prepared statement
 * @returns {integer} The number of the parameters in the prepared statement
 * @throws Throws an error if the object the method is being called on is not valid.
 * @throws {SQLException}
 */
ParameterMetaData.prototype.getParameterCount = function () {
  return this._parameters.length;
};

/**
 * Returns the name of the specified parameter
 * @param {integer} columnIndex The index of the parameter in the prepared statement <b>starting from 1</b>
 * @returns {string} The name of the specified parameter
 * @throws Throws an error on invalid parameters or if the object the method is being called on is not valid.
 * @throws {SQLException}
 */
ParameterMetaData.prototype.getParameterName = function (columnIndex) {
  return this._parameters[columnIndex - 1].name;
};

/**
 * Returns the mode of the specified parameter
 * @todo provide an enumeration
 * @param {integer} index The index of the parameter <b>starting from 1</b>
 * @returns {integer} The mode of the specified parameter
 * @throws Throws an error on invalid parameters or if the object the method is being called on is not valid.
 * @throws {SQLException}
 */
ParameterMetaData.prototype.getParameterMode = function (columnIndex) {
  return this._parameters[columnIndex - 1].mode;
};

/**
 * Returns the type (db.types) of the specified parameter
 * @param {integer} columnIndex The index of the parameter in the prepared statement <b>starting from 1</b>
 * @returns {db.types} The type
 * @throws Throws an error on invalid parameters or if the object the method is being called on is not valid.
 * @throws {SQLException}
 * @see types
 */
ParameterMetaData.prototype.getParameterType = function (columnIndex) {
  return this._parameters[columnIndex - 1].dataType;
};

/**
 * Returns the typename of the specified parameter
 * @param {integer} columnIndex is the index of the parameter in the prepared statement <b>starting from 1</b>
 * @returns {string} The typename of the specified parameter
 * @throws Throws an error on invalid parameters or if the object the method is being called on is not valid.
 * @throws {SQLException}
 */
ParameterMetaData.prototype.getParameterTypeName = function (columnIndex) {
  return constants.typeKeys[this.getParameterType(columnIndex)];
};

/**
 * Returns the designated parameter's number of decimal digits
 * @param {integer} columnIndex The index of the parameter in the prepared statement <b>starting from 1</b>
 * @returns {string} The designated parameter's number of decimal digits
 * @throws Throws an error on invalid parameters or if the object the method is being called on is not valid.
 * @throws {SQLException}
 */
ParameterMetaData.prototype.getPrecision = function (columnIndex) {
  return this._parameters[columnIndex - 1].fraction;
};

/**
 * Returns the designated parameter's scale
 * @param {integer} columnIndex The index of the parameter in the prepared statement <b>starting from 1</b>
 * @returns {string} The designated parameter's scale
 * @throws Throws an error on invalid parameters or if the object the method is being called on is not valid.
 * @throws {SQLException}
 */
ParameterMetaData.prototype.getScale = function (columnIndex) {
  return this._parameters[columnIndex - 1].length;
};

/**
 * Checks if the specified parameter is nullable
 * @param {integer} index The index of the parameter, <b>starting from 1</b>
 * @returns {integer} 1: true, 0: false
 * @throws Throws an error on invalid parameters or if the object the method is being called on is not valid.
 * @throws {SQLException}
 */
ParameterMetaData.prototype.isNullable = function (index) { // eslint-disable-line no-unused-vars
  throw new Error('Not implemented yet');
};

/**
 * Checks if the specified parameter is signed
 * @param {integer} index The index of the parameter <b>starting from 1</b>
 * @returns {integer} 1: true, 0: false
 * @throws Throws an error on invalid parameters or if the object the method is being called on is not valid.
 * @throws {SQLException}
 */
ParameterMetaData.prototype.isSigned = function (index) { // eslint-disable-line no-unused-vars
  throw new Error('Not implemented yet');
};

/**
 * Checks if the specified parameter has a default value
 * @param {integer} index The index of the parameter <b>starting from 1</b>
 * @returns {integer} 1: true, 0: false
 * @throws Throws an error on invalid parameters or if the object the method is being called on is not valid.
 * @throws {SQLException}
 */
ParameterMetaData.prototype.hasDefault = function (index) { // eslint-disable-line no-unused-vars
  throw new Error('Not implemented yet');
};
