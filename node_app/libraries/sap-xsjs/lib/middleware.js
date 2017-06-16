'use strict';

var parseUrl = require('url').parse;
var parseQuery = require('querystring').parse;
var multiparty = require('multiparty');
var rawBody = require('raw-body');
var mediaTyper = require('media-typer');
var fibrous = require('@sap/fibrous');

exports.urlRewrite = function (rt) {
  return function urlRewriteMiddleware(req, res, next) {
    var url = parseUrl(req.url);
    var rule = rt.rewriteRules.reduce(function (previousRule, rule) {
      if (!previousRule && rule.regex.test(url.pathname)) {
        return rule;
      }
      return previousRule;
    }, null);
    if (rule) {
      var newUrl = parseUrl(url.pathname.replace(rule.regex, rule.replacement));
      url.pathname = newUrl.pathname;
      if (newUrl.query) {
        if (url.query) {
          url.query = [newUrl.query, url.query].join('&');
        } else {
          url.query = newUrl.query;
        }
        req.query = parseQuery(url.query);
        url.search = '?' + url.query;
      }
      req.url = url.format();
      req.loggingContext.getTracer().info(
        'Applying rewrite rule: "%s" to "%s" for URL "%s" - result "%s"',
        rule.regex.source, rule.replacement, req.originalUrl, req.url
      );

    }
    next();
  };
};

exports.multipartFormData = function (rt, req, res, next) {
  var form = createFormObject(rt);
  form.parse(req, function (err, fields, files) {
    if (err) {
      return next(err);
    }
    req['form-data'] = {
      fields: fields,
      files: files
    };
    next();
  });
};

function createFormObject(rt) {
  var formData = rt.get('formData');
  return new multiparty.Form({maxFilesSize: formData.maxFilesSizeInBytes});
}

exports.textBody = function (req, res, next) {
  var contentLength = req.headers['content-length'];
  var contentType = req.headers['content-type'] || 'application/octet-stream';
  rawBody(req, {
    length: contentLength,
    limit: '1mb',
    encoding: mediaTyper.parse(contentType).parameters.charset
  }, function (err, body) {
    if (err) {
      return next(err);
    }
    if (req.is(['urlencoded'])) {
      req['form-urlencoded'] = parseQuery(body.toString());
    }
    req.body = body;
    next();
  });
};

exports.anyBody = function(rt) {
  return function (req, res, next) {
    if (req.method !== 'POST' && req.method !== 'PUT') {
      return next();
    }
    if (req.is(['multipart/form-data'])) {
      return exports.multipartFormData(rt, req, res, next);
    }
    exports.textBody(req, res, next);
  };
};

exports.xsjs = function (rt) {
  return function contextMiddleware(req, res, next) {
    rt.attachContext(req, res);
    fibrous.middleware(req, res, next);
  };
};

exports.xsodata = function(rt) {
  return function odataContextMiddleware(req, res, next) {
    rt.attachContext(req, res);
    next();
  };
};

exports.notFound = function (req, res, next) {
  var err = new Error('Not Found');
  err.status = 404;
  next(err);
};
