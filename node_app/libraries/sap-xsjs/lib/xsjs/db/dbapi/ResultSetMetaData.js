'use strict';

var hdbext    = require('@sap/hdbext');
var constants = hdbext.constants;

module.exports = ResultSetMetaData;

function ResultSetMetaData(columns) {
  this._columns = columns;
}

/**
 * Returns the number of the columns in the result set
 * @returns {integer} The number of the columns in the result set
 * @throws Throws an error if the object the method is being called on is not valid.
 * @throws {SQLException}
 */
ResultSetMetaData.prototype.getColumnCount = function () {
  return this._columns.length;
};

/**
 * Returns the type of the specified column
 * @param {integer} columnIndex The index of the column in the result set <b>starting from 1</b>
 * @returns {db.types} The type of the column
 * @throws Throws an error on invalid parameters or if the object the method is being called on is not valid.
 * @throws {SQLException}
 */
ResultSetMetaData.prototype.getColumnType = function (columnIndex) {
  return this._columns[columnIndex - 1].dataType;
};

/**
 * Returns the name of the specified column type
 * @param {integer} columnIndex The index of the column in the result set <b>starting from 1</b>
 * @returns {string} The name of the column type
 * @throws Throws an error on invalid parameters or if the object the method is being called on is not valid.
 * @throws {SQLException}
 */
ResultSetMetaData.prototype.getColumnTypeName = function (columnIndex) {
  return constants.typeKeys[this.getColumnType(columnIndex)];
};

/**
 * Returns the name of the specified column
 * @param {integer} columnIndex The index of the column in the result set <b>starting from 1</b>
 * @returns {string} The name of the specified column
 * @throws Throws an error on invalid parameters or if the object the method is being called on is not valid.
 * @throws {SQLException}
 */
ResultSetMetaData.prototype.getColumnName = function (columnIndex) {
  return this._columns[columnIndex - 1].columnName;
};

/**
 * Returns the alias or name of the specified column
 * @param {integer} columnIndex The index of the column in the result set <b>starting from 1</b>
 * @returns {string} The alias or name of the specified column
 * @throws Throws an error on invalid parameters or if the object the method is being called on is not valid.
 * @throws {SQLException}
 */
ResultSetMetaData.prototype.getColumnLabel = function (columnIndex) {
  return this._columns[columnIndex - 1].columnDisplayName;
};

/**
 * Returns the catalog name for the specified column
 * @param {integer} columnIndex The index of the column in the result set <b>starting from 1</b>
 * @returns {string} The catalog name for the specified column
 * @throws Throws an error on invalid parameters or if the object the method is being called on is not valid.
 * @throws {SQLException}
 */
ResultSetMetaData.prototype.getCatalogName = function (columnIndex) {
  return this._columns[columnIndex - 1].schemaName;
};

/**
 * Returns the table name for the specified column
 * @param {integer} columnIndex The index of the column in the result set <b>starting from 1</b>
 * @returns {string} The table name for the specified column
 * @throws Throws an error on invalid parameters or if the object the method is being called on is not valid.
 * @throws {SQLException}
 */
ResultSetMetaData.prototype.getTableName = function (columnIndex) {
  return this._columns[columnIndex - 1].tableName;
};

/**
 * Returns the precision of the specified column
 * @param {integer} columnIndex The index of the column in the result set <b>starting from 1</b>
 * @returns {integer} The precision of the specified column
 * @throws Throws an error on invalid parameters or if the object the method is being called on is not valid.
 * @throws {SQLException}
 */
ResultSetMetaData.prototype.getPrecision = function (columnIndex) {
  return this._columns[columnIndex - 1].fraction;
};

/**
 * Returns the column display size of the specified column
 * @param {integer} columnIndex The index of the column in the result set <b>starting from 1</b>
 * @returns {integer} The column display size of the specified column
 * @throws Throws an error on invalid parameters or if the object the method is being called on is not valid.
 * @throws {SQLException}
 */
ResultSetMetaData.prototype.getColumnDisplaySize = function (columnIndex) {
  return this._columns[columnIndex - 1].length;
};

/**
 * Returns the scale of the specified column
 * @param {integer} columnIndex The index of the column in the result set <b>starting from 1</b>
 * @returns {integer} The scale of the specified column
 * @throws Throws an error on invalid parameters or if the object the method is being called on is not valid.
 * @throws {SQLException}
 */
ResultSetMetaData.prototype.getScale = function (columnIndex) {
  return this._columns[columnIndex - 1].length;
};
