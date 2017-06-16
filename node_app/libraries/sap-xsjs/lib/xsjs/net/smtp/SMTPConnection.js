'use strict';

var assert = require('assert');
var nodemailer = require('nodemailer');
var smtpPool = require('nodemailer-smtp-pool');
var toNodemailerMail = require('./nodemailer-util').toNodemailerMail;

module.exports = SMTPConnection;

function SMTPConnection(settings) {
  assert(settings && settings.host && settings.port, 'Invalid smtp settings. Host and port are mandatory.');
  this._transporter = nodemailer.createTransport(smtpPool({
    host: settings.host,
    port: parseInt(settings.port, 10),
    ignoreTLS: settings.ignoreTLS,
    secure: settings.secure,
    connectionTimeout: settings.connectionTimeout || 60000,
    authMethod: settings.authMethod,
    auth: settings.auth,
    maxConnections: 1
  }));
  this._isClosed = true;
}

SMTPConnection.prototype.send = function (mail) {
  var nodeMail = toNodemailerMail(mail);
  var info = this._transporter.sync.sendMail(nodeMail);
  this._isClosed = false;
  return { finalReply: info.response, messageId: info.messageId };
};

SMTPConnection.prototype.close = function () {
  this._transporter.close();
  this._isClosed = true;
};

SMTPConnection.prototype.isClosed = function () {
  return this._isClosed;
};
