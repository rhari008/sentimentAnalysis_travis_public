'use strict';

var Connection = require('./Connection.js');
var DbBase = require('../common/DbBase');
var util = require('util');

module.exports = HDB;

function HDB(dbReqOptions) {
  DbBase.call(this, dbReqOptions);
}
util.inherits(HDB, DbBase);

/**
 * Returns a database connection.
 * @param {JSON} [options] JSON object specifying the options:
 * <ul>
 * <li>isolationLevel - transaction isolation level. Default is $.hdb.isolation.READ_COMMITTED</li>
 * <li>schema - schema to use</li>
 * </ul>
 * @returns {$.hdb.Connection} Connection - The internal connection to the database with the user of the current session.
 * @example
 *
 * var connection = $.hdb.getConnection({"isolationLevel": $.hdb.isolation.REPEATABLE_READ, "schema": "myschema"});
 */
HDB.prototype.getConnection = function (userOptions) {
  return new Connection(this._getClient(userOptions));
};