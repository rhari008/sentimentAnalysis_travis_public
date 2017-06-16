'use strict';

var nodemailer = require('nodemailer');
var smtpTransport = require('nodemailer-smtp-transport');
var toNodemailerMail = require('./nodemailer-util').toNodemailerMail;
var assert = require('assert');

module.exports = Mail;

function Mail(settings, mailObjectOpt) {
  assert(settings && settings.host && settings.port, 'Invalid smtp settings. Host and port are mandatory.');
  this._settings = settings;
  this.bcc = mailObjectOpt && mailObjectOpt.bcc || [];
  this.cc = mailObjectOpt && mailObjectOpt.cc || [];
  this.parts = mailObjectOpt && mailObjectOpt.parts || [];
  this.sender = mailObjectOpt && mailObjectOpt.sender || {};
  this.subject = mailObjectOpt && mailObjectOpt.subject || '';
  this.to = mailObjectOpt && mailObjectOpt.to || [];
}

Mail.prototype.send = function () {
  var nodeMail = toNodemailerMail(this);
  var transporter = nodemailer.createTransport(smtpTransport({
    host: this._settings.host,
    port: parseInt(this._settings.port, 10),
    ignoreTLS: this._settings.ignoreTLS,
    secure: this._settings.secure,
    connectionTimeout: this._settings.connectionTimeout || 60000,
    authMethod: this._settings.authMethod,
    auth: this._settings.auth
  }));
  var info;
  try {
    info = transporter.sync.sendMail(nodeMail);
  } finally {
    transporter.close();
  }
  return { finalReply: info.response, messageId: info.messageId };
};
