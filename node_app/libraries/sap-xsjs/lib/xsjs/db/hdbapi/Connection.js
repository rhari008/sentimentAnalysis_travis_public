'use strict';

var assert = require('assert');
var hdbext = require('@sap/hdbext');
var ResultSetIterator = require('./ResultSetIterator.js');
var ctypes = require('../../../ctypes');
var execSql = require('../common/exec-sql');
var constants = hdbext.constants;


module.exports = Connection;

/**
 * @class $.hdb.Connection
 * @classdesc HANA database connection.
 * @constructor
 */
function Connection(client) {
  assert(typeof client === 'object', 'A valid client object should be provided to create $.hdb.Connection');
  this._client = client;
}

/**
 * Returns the hdb client (ref: https://github.com/SAP/node-hdb)
 */
Connection.prototype.getClient = function () {
  return this._client;
};

/**
 * Closes the connection
 * @throws Throws an error if the operation fails.
 */
Connection.prototype.close = function () {
  if (this._client) {
    this._client.close();
    this._client = null;
  }
};

/**
 * Commits the changes and ends the current transaction. <b>By default autocommit mode is disabled, which means all database changes must be explicitly commited.</b>
 * @throws Throws an error if the operation fails.
 * @example
 *
 * var connection = $.hdb.getConnection();
 * connection.executeUpdate('UPDATE "DB_EXAMPLE"."ICECREAM" SET QUANTITY=? WHERE FLAVOR=?', 9, 'CHOCOLATE');
 * connection.commit();
 */
Connection.prototype.commit = function () {
  this._client.sync.commit();
};

/**
 * Reverts the changes and ends the current transaction.
 * @throws Throws an error if the operation fails.
 * @example
 *
 * var connection = $.hdb.getConnection();
 * connection.executeUpdate('UPDATE "DB_EXAMPLE"."ICECREAM" SET QUANTITY=? WHERE FLAVOR=?', 9, 'CHOCOLATE');
 * connection.rollback();
 */
Connection.prototype.rollback = function () {
  this._client.rollback();
};

/**
 * Changes the auto-commit flag of the connection.
 * @param {bool} autoCommit A bool value, which can be true or false
 */
Connection.prototype.setAutoCommit = function (autoCommit) {
  this._client.setAutoCommit(autoCommit);
};

/**
 * Executes a database query.
 * @param {string} query The query string to be executed.
 * @param {...varArgs} [arguments] Variable number of arguments to be bound to the query parameters.
 * @returns {$.hdb.ResultSet}
 * @throws Throws an error if the statement cannot be executed.
 * @example
 * var connection = $.hdb.getConnection();
 * connection.executeQuery('SELECT * FROM "DB_EXAMPLE"."ICECREAM"');
 * connection.executeQuery('SELECT * FROM "DB_EXAMPLE"."ICECREAM" WHERE FLAVOR = ?', 'CHOCOLATE');
 * connection.executeQuery('SELECT * FROM "DB_EXAMPLE"."ICECREAM" WHERE FLAVOR = ? AND PRICE < ?', 'STRAWBERRY', 2.50);
 */
Connection.prototype.executeQuery = function () {
  var args = Array.prototype.slice.apply(arguments);
  var sql = args.shift();
  var sqlArgs = args;
  var data = execSql.sync.execWithMetadata(this._client, sql, sqlArgs);
  if (data._metadata) {
    var bigIntColumnNames = getBigIntColumnNames(data._metadata);

    for (var r = 0; r < data.length; r++) {
      var row = data[r];
      var c;
      if (bigIntColumnNames.length > 0) {
        for (c = 0; c < bigIntColumnNames.length; c++) {
          row[bigIntColumnNames[c]] = ctypes.Int64(row[bigIntColumnNames[c]]);
        }
      }

      // in XSC column indices take precedence over column names
      for (c = 0; c < data._metadata.length; c++) {
        var columnName = data._metadata[c].columnName;
        // Using defineProperty because we don't want to iterate twice the columns.
        Object.defineProperty(row, c, { enumerable: false, value: row[columnName] });
      }
    }
  }

  Object.defineProperty(data, 'getIterator', { enumerable: false, value: function () { return new ResultSetIterator(data); } });
  return data;
};

/**
 * Executes a SQL statement, which changes the database state. SELECT and CALL statements are not allowed here.
 * @param {string} statement The statement to be executed.
 * @param {...varArgs} [arguments] Variable number of arguments to be bound to the query parameters.
 * @returns {number|array} Number of affected rows | Array of numbers in case of batch update.
 * @throws Throws an error if the statement cannot be executed.
 * @example
 *
 * var connection = $.hdb.getConnection();
 * connection.executeUpdate('INSERT INTO "DB_EXAMPLE"."ICECREAM" VALUES (?,?,?)','STRAWBERRY', 2.50, 64.18);
 * connection.executeUpdate('UPDATE "DB_EXAMPLE"."CASH" SET INCOME=?', 64.18);
 * connection.executeUpdate('DELETE FROM "DB_EXAMPLE"."ICECREAM" WHERE FLAVOR = ?', 'STRAWBERRY');
 *
 * //Batch Insert
 * var argsArray = [["MINT", 3.50, 34.5], ["VANILLA", 2.50, 23.6], ["CHERRY", 4.50, 67.9]];
 * connection.executeUpdate('INSERT INTO "DB_EXAMPLE"."ICECREAM" VALUES (?,?,?)', argsArray)
 * connection.commit();
 */
Connection.prototype.executeUpdate = function (sql) { // eslint-disable-line no-unused-vars
  var args = Array.prototype.slice.apply(arguments);
  return execSql.sync.execWithMetadata(this._client, args.shift(), args);
};

/**
 * Returns a JavaScript function representing the stored procedure being loaded.
 * @param {string} [schema] The schema to which the procedure belongs.
 * @param {string} procedure The name of the procedure.
 * @returns {function}
 * @example
 *
 * var connection = $.hdb.getConnection();
 * // looks for the stored procedure in the current schema
 * var fnSell = connection.loadProcedure('icecream.shop::sell');
 * // the procedure has signature 'DB_EXAMPLE'.'icecream.shop::sell'(IN flavor VARCHAR, IN quantity INTEGER, IN payment DECIMAL, OUT change DECIMAL)
 * var fnSell = connection.loadProcedure('DB_EXAMPLE', 'icecream.shop::sell');
 * // call the procedure just like calling a javascript function
 * // sell three ice cream cups with chocolate flavor for 20 bucks each
 * var result = fnSell('CHOCOLATE', 3, 20.00);
 * // alternatively use named parameters
 * var result = fnSell({FLAVOR: 'CHOCOLATE', QUANTITY: 3, PAYMENT: 20.00});
 * // result is a $.hdb.ProcedureResult object
 *
 * @example
 * <b><font size="4">Table Parameter Support For Stored Procedures</font></b>
 *
 * // the procedure has signature 'DB_EXAMPLE'.'icecream.shop::lower_price_by'(IN ice_cream_prices prices_table_type, IN lower_price_by DOUBLE, OUT new_ice_cream_prices prices_table_type)
 * var fnlowerPrice = connection.loadProcedure('DB_EXAMPLE', 'icecream.shop::lower_price_by');
 *
 * // passing a $.hdb.ResultSet object
 * var price_list = connection.executeQuery('SELECT * FROM "DB_EXAMPLE"."SOLD_FLAVORS_PRICES"');
 * var result = fnlowerPrice(price_list, 1.50);
 *
 * // passing a string containing the name of existing table in the database
 * var result = fnlowerPrice('"DB_EXAMPLE"."SOLD_FLAVORS_PRICES"', 1.50);
 *
 * // passing an array of JSON objects representing the rows in the table
 * var price_list = [{FLAVOR: 'STRAWBERRY', PRICE: 4.50}, {FLAVOR : 'VANILLA', PRICE: 3.50}, {FLAVOR: 'CHOCOLATE', PRICE: 5.50}];
 * var result = fnlowerPrice(price_list, 1.50);
 *
 * // We can get the table output parameter "new_ice_cream_prices" like any other output parameter:
 * var new_price_list = result.NEW_ICE_CREAM_PRICES;
 * // new_price_list is a $.hdb.ResultSet object
 */
Connection.prototype.loadProcedure = function (schema, name) {
  if (arguments.length === 1) {
    name = arguments[0];
    schema = undefined;
  }

  var storedProc = hdbext.sync.loadProcedure(this._client, schema, name);

  return callsp.sync.bind(this);

  function callsp() {
    var inargs = Array.prototype.slice.call(arguments);
    var cb = inargs.pop();

    inargs.forEach(function (i, index) {
      if (i instanceof ctypes.Int64) {
        inargs[index] = i.valueOf();
      }
    });

    var ondone = function (err, parameters) {
      if (err) {
        return cb(err);
      }
      var args = Array.prototype.slice.call(arguments);
      var metadata = storedProc.paramsMetadata;
      var at = 2;
      parameters = parameters || {};
      var resultSetIteratorFunction = function () { return new ResultSetIterator(this); };

      metadata.forEach(function (i) {
        if (i.DATA_TYPE_NAME === 'TABLE_TYPE' && i.PARAMETER_TYPE === 'OUT') {
          parameters[i.PARAMETER_NAME] = args[at++];
          Object.defineProperty(parameters[i.PARAMETER_NAME], 'getIterator', { enumerable: false, value: resultSetIteratorFunction });
        }
        if (i.DATA_TYPE_NAME === 'BIGINT' && i.PARAMETER_TYPE === 'OUT') {
          parameters[i.PARAMETER_NAME] = ctypes.Int64(parameters[i.PARAMETER_NAME]);
        }
      });

      var spResultSets = [];
      while (at < args.length) {
        Object.defineProperty(args[at], 'getIterator', { enumerable: false, value: resultSetIteratorFunction });
        spResultSets.push(args[at++]);
      }
      Object.defineProperty(parameters, '$resultSets', { enumerable: false, value: spResultSets });
      cb(null, parameters);
    };
    inargs.push(ondone);
    storedProc.apply(null, inargs);
  }
};

function getBigIntColumnNames(resultSetMetadata) {
  var bigIntColumnNames = [];
  for (var i = 0; i < resultSetMetadata.length; i++) {
    if (resultSetMetadata[i].dataType === constants.types.BIGINT) {
      bigIntColumnNames.push(resultSetMetadata[i].columnDisplayName);
    }
  }
  return bigIntColumnNames;
}
