'use strict';

var util = require('util');

module.exports = Session;

function Session(req, locale) {
  this.user = req.user && req.user.id;
  Object.defineProperty(this, 'language', {
    value: locale.sessionLanguage,
    enumerable: true
  });
  this.xssecSecurityContext = req.authInfo;
}

Session.prototype.getUsername = function () {
  return this.user && this.user.toUpperCase();
};

Session.prototype.assertAppPrivilege = function (privilegeName) {
  if (!this.hasAppPrivilege(privilegeName)) {
    var err = new Error(util.format('User %s has no %s privilege.', this.user, privilegeName));
    err.privilege = privilegeName;
    throw err;
  }
};

Session.prototype.hasAppPrivilege = function (privilegeName) {
  return !!this.xssecSecurityContext && this.xssecSecurityContext.checkLocalScope(privilegeName);
};
