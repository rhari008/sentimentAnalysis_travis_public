'use strict';

var assert = require('assert');
var EntityList = require('./EntityList');
var HeadersTupelList = require('./TupelLists/HeadersTupelList');
var ResultSet = require('../db/dbapi/ResultSet');

module.exports = BasicWebEntity;

function BasicWebEntity(arg) {
  this.headers = new HeadersTupelList();
  this.entities = new EntityList();
  this.setBody('');

  if (arg) {
    this.headers._addData(arg.headers);
  }
}

BasicWebEntity.prototype.setBody = function(bodyContent, indexOpt) {
  if (indexOpt !== null && indexOpt !== undefined) {
    assert(bodyContent.constructor === ResultSet, 'First argument should be a $.db.ResultSet');
    assert(indexOpt > 0, 'Second argument should be greater than 0');
  }
  var WebBody = require('./WebBody');
  var isZip = require('../../utils/xs-types').isZip;
  bodyContent = isZip(bodyContent) ? bodyContent.asArrayBuffer() : bodyContent;
  this.body = new WebBody(this, bodyContent, indexOpt);
};

Object.defineProperties(BasicWebEntity.prototype, {
  contentType: {
    set: function(type) {
      this.headers.set('content-type', type);
    },
    get: function() {
      return this.headers.get('content-type');
    },
    enumerable: true
  }
});
