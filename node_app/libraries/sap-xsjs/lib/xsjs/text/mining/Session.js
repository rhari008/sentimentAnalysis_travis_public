'use strict';

var textmining = require('@sap/textmining');

module.exports = Session;

function Session($db, params) {
  this._tm = new textmining({
    client: determineClient($db, params),
    referenceTable: params.referenceTable,
    referenceColumn: params.referenceColumn
  });
}

Session.prototype.categorizeKNN = function (params) {
  return this._tm.sync.categorizeKNN(params);
};

Session.prototype.getRelatedDocuments = function (params) {
  return this._tm.sync.getRelatedDocuments(params);
};

Session.prototype.getRelatedTerms = function (params) {
  return this._tm.sync.getRelatedTerms(params);
};

Session.prototype.getRelevantTerms = function (params) {
  return this._tm.sync.getRelevantTerms(params);
};

Session.prototype.getRelevantDocuments = function (params) {
  return this._tm.sync.getRelevantDocuments(params);
};

Session.prototype.getSuggestedTerms = function (params) {
  return this._tm.sync.getSuggestedTerms(params);
};

Session.prototype.initialize = function (params) {
  this._tm.sync.initialize(params);
};

function determineClient($db, params) {
  var conn = params.connection || $db.getConnection();
  return conn._client;
}
