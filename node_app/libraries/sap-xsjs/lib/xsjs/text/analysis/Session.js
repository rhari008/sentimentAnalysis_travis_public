'use strict';

var ta = require('@sap/textanalysis');
var bufferUtils = require('../../../utils/buffer-utils');

module.exports = Session;

function Session($db, params) {
  this.configuration = params.configuration;
  this.client = $db.getConnection()._client;
  this.schema = $db._options.schema;
}

Session.prototype.analyze = function (params) {
  return analyze.sync(this, params);
};

function analyze(session, params, cb) {
  var values = {
    DOCUMENT_TEXT: params.inputDocumentText,
    DOCUMENT_BINARY: params.inputDocumentBinaryContent && extractBinary(params.inputDocumentBinaryContent),
    LANGUAGE_CODE: params.language,
    MIME_TYPE: params.mimeType,
    TOKEN_SEPARATORS: params.tokenSeparators,
    LANGUAGE_DETECTION: params.languageDetection,
    // There is no way to specify a custom schema in XS1
    CONFIGURATION_SCHEMA_NAME: session.schema,
    CONFIGURATION: session.configuration,
    RETURN_PLAINTEXT: params.includePlainText ? 1 : 0
  };

  ta.analyze(values, session.client, function done(err, parameters, rows) {
    if (err) {
      return cb(err);
    }
    var tokens = [], entities = [], metadata = [], grammaticalRoles = [];
    if (rows) {
      for (var i = 0; i < rows.length; i++) {
        var row = rows[i];
        if (row.RULE === 'Entity Extraction') {
          var entity = {
            id: row.COUNTER,
            text: row.TOKEN,
            normalizedForm: row.NORMALIZED,
            labelPath: row.TYPE,
            offset: row.OFFSET,
            paragraph: row.PARAGRAPH,
            sentence: row.SENTENCE,
            parent: row.PARENT
          };
          entities.push(entity);
        }
        else if (row.RULE === 'LXP') {
          var token = {
            token: row.TOKEN,
            normalizedToken: row.NORMALIZED,
            partOfSpeech: row.TYPE,
            offset: row.OFFSET,
            paragraph: row.PARAGRAPH,
            sentence: row.SENTENCE
            // TODO: stems
          };
          tokens.push(token);
        }
        else if (row.RULE === 'Grammatical Role') {
          var grammaticalRoleGovernor = {
            id: row.PARENT,
            dependencyType: row.TYPE
          };
          var grammaticalRole = {
            id: row.COUNTER,
            offset: row.OFFSET,
            paragraph: row.PARAGRAPH,
            sentence: row.SENTENCE,
            text: row.TOKEN,
            governors: [grammaticalRoleGovernor]
          };
          grammaticalRoles.push(grammaticalRole);
        }
        else if (row.RULE === 'Metadata') {
          var meta = {
            id: row.COUNTER,
            token: row.TOKEN,
            tokenType: row.TYPE,
            offset: row.OFFSET,
            paragraph: row.PARAGRAPH,
            parent: row.PARENT
          };
          metadata.push(meta);
        }
      }
    }
    return cb(null, {
      language: parameters.LANGUAGE_CODE,
      mimeType: parameters.MIME_TYPE,
      textSize: 0, // not returned by TA_ANALYZE
      plaintext: parameters.PLAINTEXT.toString('utf8'),
      tokens: tokens,
      entities: entities,
      metadata: metadata,
      grammaticalRoles: grammaticalRoles
    });
  });
}

function extractBinary(binContent) {
  return bufferUtils.isBinary(binContent) ? bufferUtils.toBuffer(binContent) : new Buffer(binContent);
}
