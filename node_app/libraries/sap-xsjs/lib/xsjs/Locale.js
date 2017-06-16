'use strict';

var AcceptLanguageParser = require('accept-language');

module.exports = Locale;

function Locale(webRequest) {
  this.applicationLanguage = resolveApplicationLanguage(webRequest);
  this.sessionLanguage = resolveSessionLanguage(webRequest);
  this.requestLanguage = resolveRequestLanguage(webRequest, this);
  this.dbLocale = this.requestLanguage.replace(/-/g, '_');
}

// Note: although the official HANA XSEngine docu states that $.application.language is used in the fallback mechanism,
// actually the value of the corresponding cookie is used.
// The same applies to $.session.language as well.

function resolveApplicationLanguage(webRequest) {
  var appLanguage = webRequest.cookies.get('xsAppLanguage');
  return appLanguage ? appLanguage : '';
}

function resolveSessionLanguage(webRequest) {
  // Note: In the XSEngine the $.session.language is taken from the "xsSessionLanguage" cookie.
  // If not present, it fallbacks to the locale of the HANA user
  // (which is not applicable in XS Advanced since we work with a single technical user for HANA db connections).

  var sessionLang = webRequest.cookies.get('xsSessionLanguage');
  return sessionLang ? sessionLang : '';
}

function resolveRequestLanguage(webRequest, locale) {
  var sapLang = webRequest.headers.get('x-sap-request-language');
  if (sapLang) {
    return sapLang;
  }

  if (locale.applicationLanguage) {
    return locale.applicationLanguage;
  }

  if (locale.sessionLanguage) {
    return locale.sessionLanguage;
  }

  var acceptLanguage = webRequest.headers.get('accept-language');
  if (acceptLanguage) {
    var languagesByPreference = AcceptLanguageParser.parse(acceptLanguage);
    if (languagesByPreference && languagesByPreference.length) {
      return languagesByPreference[0].value;
    }
  }

  return '';
}
