'use strict';

var request = require('request');
var async = require('async');
var constants = require('./constants');

// use environment variable DEBUG with value 'xssec:*' for trace/error messages
var debug = require('debug');
var debugTrace = debug('xssec:securitycontext');
var debugError = debug('xssec:securitycontext');

debugError.log = console.error.bind(console);
debugTrace.log = console.log.bind(console);

exports.createSecurityContext = createSecurityContext;
exports.createSecurityContextCC = createSecurityContextCC;

function createSecurityContext(token, config, cb) {
    var securityContext;

    try {
        securityContext = new SecurityContext(token, config, constants.TOKENTYPE_ENDUSER);
        securityContext.init(done);
    } catch (e) {
        cb(e);
    }

    function done(err) {
        if (err) {
            return cb(err);
        }
        cb(null, securityContext);
    }
}

function createSecurityContextCC(token, config, cb) {
    var securityContext;

    try {
        securityContext = new SecurityContext(token, config, constants.TOKENTYPE_CLIENTCREDENTIALS);
        securityContext.init(done);
    } catch (e) {
        cb(e);
    }

    function done(err) {
        if (err) {
            return cb(err);
        }
        cb(null, securityContext);
    }
}

function SecurityContext(token, config, expectedTokenType) {
    this.token = token;
    this.config = config;
    this.xsappname = '';
    this.isUserInfoInitialized = false;
    this.isForeignMode = false;
    this.tokenContainsAttributes = false;
    this.userInfo = {
        logonName : '',
        firstName : '',
        lastName : '',
        email : ''
    };
    this.scopes = [];
    this.samlToken = '';
    this.identityZone = '';
    this.userAttributes = '';
    this.expectedTokenType = expectedTokenType;
    this.grantType = '';

    // sapssoext
    var ssojwt;
    if (process.sapnodejwtlib) {
        this.ssojwt = process.sapnodejwtlib;
    } else {
        try {
            var jwt = require('@sap/node-jwt');
            this.ssojwt = process.sapnodejwtlib = new jwt("");
        } catch (e) {
			var error = new Error('No jwt.node available. Error: ' + e.message );
			error.statuscode = 500; //No jwt.node
			throw error;
        }
    }

    // validate config input
    debugTrace('\nConfiguration (note: clientsecret might be contained but is not traced): ' + JSON.stringify(config, credentialsReplacer, 4));
    if (!this.ssojwt || this.ssojwt.getLibraryVersion() === -1) {
        debugTrace('\nSSO library path: ' + process.env['SSOEXT_LIB']);
        var error = new Error('JWT validation library could not be loaded. Used '
                + process.env['SSOEXT_LIB']);
        error.statuscode = 500; //lib not found
        throw error;
    }

    // validate config input
    if (!token || token.length === 0) {
        var error = new Error('Invalid token (empty).');
        error.statuscode = 401; //(Token Empty/No Token)
        throw error;
    }
    if (!config) {
        var error = new Error('Invalid config (missing).');
        error.statuscode = 500; //500 (Invalid config)
        throw error;
    }
    if (!this.config.clientid) {
        var error = new Error('Invalid config: Missing clientid.');
        error.statuscode = 500; //500 (Invalid config)
        throw error;
    }
    if (!this.config.clientsecret) {
        var error = new Error('Invalid config: Missing clientsecret.');
        error.statuscode = 500; //500 (Invalid config)
        throw error;
    }
    if (!this.config.url) {
        var error = new Error('Invalid config: Missing url.');
        error.statuscode = 500; //500 (Invalid config)
        throw error;
    }
    if (!this.config.xsappname) {
        if (!process.env.XSAPPNAME) {
            var errorString = 'Invalid config: Missing xsappname.\n'
                    + 'The application name needs to be defined in xs-security.json.';
            debugError('\n' + errorString);
            var error = new Error(errorString);
            error.statuscode = 500; //500 (Invalid config)
            throw error;
        } else {
            this.xsappname = process.env.XSAPPNAME;
            debugTrace('\nXSAPPNAME defined in manifest.yml (legacy).\n'
                    + 'You should switch to defining xsappname in xs-security.json.');
        }
    } else {
        if (!process.env.XSAPPNAME) {
            this.xsappname = this.config.xsappname;
        } else {
            if (process.env.XSAPPNAME == this.config.xsappname) {
                this.xsappname = process.env.XSAPPNAME;
                debugTrace('\nThe application name is defined both in the manifest.yml (legacy) \n'
                        + 'as well as in xs-security.json. Remove it in manifest.yml.');
            } else {
                var errorString = 'Invalid config: Ambiguous xsappname.\n'
                        + 'The application name is defined with different values in the manifest.yml (legacy)\n'
                        + 'as well as in xs-security.json. Remove it in manifest.yml.';
                debugError('\n' + errorString);
                var error = new Error(errorString);
                error.statuscode = 500; //500 (Invalid config)
                throw error;
            }
        }
    }
}

SecurityContext.prototype.init = function init(cb) {
    var self = this;

    offlineValidation(
            self.token,
            self.config,
            self.ssojwt,
            function(error, result) {
                if (error) {
                    debugError(error.message);
                    debugError(error.stack);
                    return cb(error);
                }

                if (!result.cid) {
                    var errorString = 'Client Id not contained in access token. Giving up!';
                    debugError('\n' + errorString);
                    var error = new Error(errorString);
                    error.statuscode = 400; //400 (no clientID)
                    return cb(error, null); 
                }
                if (!result.zid) {
                    var errorString = 'Identity Zone not contained in access token. Giving up!';
                    debugError('\n' + errorString);
                    var error = new Error(errorString);
                    error.statuscode = 400; //400 (wrong idz)
                    return cb(error, null);
                }

                if ((result.cid === self.config.clientid)
                        && (result.zid === self.config.identityzone)) {
                    debugTrace('\nClient Id and Identity Zone of the access token match\n'
                            + 'with the current application\'s Client Id and Zone.');
                    self.isForeignMode = false;
                } else if (process.env.SAP_JWT_TRUST_ACL) {
                    debugTrace('\nClient Id "'
                            + result.cid
                            + '" and/or Identity Zone "'
                            + result.zid
                            + '" of the access token\n'
                            + 'does/do not match with the Client Id "'
                            + self.config.clientid
                            + '" and Identity Zone "'
                            + self.config.identityzone
                            + '"\nof the current application.\n'
                            + 'Validating token against JWT trust ACL (SAP_JWT_TRUST_ACL).');
                    var parsedACL;
                    try {
                        parsedACL = JSON.parse(process.env.SAP_JWT_TRUST_ACL);
                    } catch (er) {
                        var errorString = 'JWT trust ACL (ACL SAP_JWT_TRUST_ACL):\n'
                                + process.env.SAP_JWT_TRUST_ACL
                                + '\ncould not be parsed successfully.\n'
                                + 'Error: ' + er.message;
                        debugError('\n' + errorString);
                        var error = new Error(errorString);
                        error.statuscode = 500; //500 (Internal Server Error)
                        return cb(error, null);
                    }
                    var foundMatch = false;
                    for ( var aclEntry in parsedACL) {
                        if (((result.cid === parsedACL[aclEntry].clientid) || ('*' === parsedACL[aclEntry].clientid))
                                && ((result.zid === parsedACL[aclEntry].identityzone) || ('*' === parsedACL[aclEntry].identityzone))) {
                            foundMatch = true;
                            break;
                        }
                    }
                    if (foundMatch) {
                        debugTrace('\nForeign token received, but matching entry\n'
                                + 'in JWT trust ACL (SAP_JWT_TRUST_ACL) found.');
                        self.isForeignMode = true;
                    } else {
                        var errorString = 'Client Id "'
                                + result.cid
                                + '" and/or Identity Zone "'
                                + result.zid
                                + '" of the access token\n'
                                + 'does/do not match with the Client Id "'
                                + self.config.clientid
                                + '" and Identity Zone "'
                                + self.config.identityzone
                                + '" of the current application.\n'
                                + 'No match found in JWT trust ACL (SAP_JWT_TRUST_ACL):\n'
                                + JSON.stringify(parsedACL, null, 4);
                        debugError('\n' + errorString);
                        var error = new Error(errorString);
                        error.statuscode = 403; //403 Forbidden (as no JWT trust entry)
                        return cb(error, null);
                    }
                } else {
                    if (result.cid !== self.config.clientid) {
                        var errorString = 'Client Id of the access token "'
                                + result.cid
                                + '" does not match with\nthe OAuth Client Id "'
                                + self.config.clientid
                                + '" of the application.\n'
                                + 'No JWT trust ACL (SAP_JWT_TRUST_ACL) specified in environment.';
                        debugError('\n' + errorString);
                        var error = new Error(errorString);
                        error.statuscode = 403; //403 Forbidden (as client IDs do not match and no trust entry exists)
                        return cb(error, null);
                    }
                    if (result.zid !== self.config.identityzone) {
                        var errorString = 'Identity Zone of the access token "'
                                + result.zid
                                + '" does not match\nwith the Identity Zone "'
                                + self.config.identityzone
                                + '" of the application.\n'
                                + 'No JWT trust ACL (SAP_JWT_TRUST_ACL) specified in environment.';
                        debugError('\n' + errorString);
                        var error = new Error(errorString);
                        error.statuscode = 403; //403 Forbidden (as identity zones do not match and no trust entry exists)
                        return cb(error, null);
                    }
                }
                if (self.expectedTokenType === constants.TOKENTYPE_ENDUSER) {
                    if ((result.grant_type === constants.GRANTTYPE_AUTHCODE) ||
                        (result.grant_type === constants.GRANTTYPE_PASSWORD) ||
                        (result.grant_type === constants.GRANTTYPE_SAML2BEARER)) {
                        debugTrace('\nApplication expected an end user token. Received token is of grant type "'
                                + result.grant_type
                                + '". This fits.');
                    } else {
                        var errorString = '\nApplication expected an end user token. Received token is of grant type "'
                            + result.grant_type
                            + '". This does not match. Security Context not created!\n';
                        debugError('\n' + errorString);
                        var error = new Error(errorString);
                        error.statuscode = 400; //400 (wrong grant type)
                        return cb(error, null);
                    }
                } else if (self.expectedTokenType === constants.TOKENTYPE_CLIENTCREDENTIALS) {
                    if (result.grant_type === constants.GRANTTYPE_CLIENTCREDENTIAL) {
                        debugTrace('\nApplication expected a client credentials token. Received token is of grant type "'
                                + result.grant_type
                                + '". This fits.');
                    } else {
                        var errorString = '\nApplication expected a client credentials token. Received token is of grant type "'
                            + result.grant_type
                            + '". This does not match. Security Context not created!\n';
                        debugError('\n' + errorString);
                        var error = new Error(errorString);
                        error.statuscode = 400; //400 (wrong grant type)
                        return cb(error, null);
                    }
                } else {
                    var errorString = 'Unknown token type "'
                        + self.expectedTokenType
                        + '". Security Context not created!\n';
                    debugError('\n' + errorString);
                    var error = new Error(errorString);
                    error.statuscode = 400; //400 (Unknown grant type)
                    return cb(error, null);
                }
                self.identityZone = result.zid;
                self.expirationDate = new Date(result.exp * 1000);
                self.grantType = result.grant_type;
                if (self.grantType !== constants.GRANTTYPE_CLIENTCREDENTIAL) {
                    self.userInfo.logonName = result.user_name; // jshint
                                                                // ignore:line
                    self.userInfo.firstName = result.given_name; // jshint
                                                                    // ignore:line
                    self.userInfo.lastName = result.family_name; // jshint
                                                                    // ignore:line
                    self.userInfo.email = result.email;
                    debugTrace('\nObtained User Information: '
                            + JSON.stringify(self.userInfo, null, 4));
                    self.samlToken = result['hdb.nameduser.saml'];
                    if (result.hasOwnProperty('xs.user.attributes')) {
                        self.userAttributes = result['xs.user.attributes'];
                        self.tokenContainsAttributes = true;
                        debugTrace('\nObtained attributes: '
                                + JSON.stringify(self.userAttributes, null, 4));
                    } else {
                        self.tokenContainsAttributes = false;
                        debugTrace('\nObtained attributes: no XS user attributes in JWT token available.');
                    }
                }
                self.scopes = result.scope;
                debugTrace('\nObtained scopes: '
                        + JSON.stringify(self.scopes, null, 4));
                cb();
            });
};

SecurityContext.prototype.getIdentityZone = function() {
    return this.identityZone;
};

SecurityContext.prototype.getExpirationDate = function() {
    return this.expirationDate;
};

SecurityContext.prototype.getUserInfo = function() {
    forbidClientCredentialsToken('SecurityContext.getUserInfo', this.grantType);
    return this.userInfo;
};

SecurityContext.prototype.getToken = function(namespace, name) {
    forbidClientCredentialsToken('SecurityContext.getToken', this.grantType);
    if (this.tokenContainsAttributes && this.isForeignMode) {
        debugTrace('\nThe SecurityContext has been initialized with an access token of a\n'
                + 'foreign OAuth Client Id and/or Identity Zone. Furthermore, the \n'
                + 'access token contains attributes. Due to the fact that we want to\n'
                + 'restrict attribute access to the application that provided the \n'
                + 'attributes, the getToken function does not return a valid token.\n');
        return null;
    }
    if (namespace === undefined || namespace === null) {
        debugTrace('\nInvalid token namespace (may not be null or undefined).');
        return null;
    } else if (namespace !== constants.SYSTEM) {
        debugTrace('\nNamespace "' + namespace + '" not supported.');
        return null;
    }
    if (name === undefined || name === null) {
        debugTrace('\nInvalid token name (may not be null or undefined).');
        return null;
    }
    switch (name) {
    case constants.JOBSCHEDULER:
        return this.token;
        break;
    case constants.HDB:
        if (this.samlToken === undefined || this.samlToken === null) {
            return this.token;
        } else {
            return this.samlToken;
        }
        break;
    default:
        debugTrace('\nToken name "' + name + '" not supported.');
        return null;
    }
};

SecurityContext.prototype.getHdbToken = function() {
    return this.getToken(constants.SYSTEM, constants.HDB);
}

SecurityContext.prototype.getAttribute = function(name) {
    forbidClientCredentialsToken('SecurityContext.getAttribute', this.grantType);
    if (!this.tokenContainsAttributes) {
        debugTrace('\nThe access token contains no user attributes.\n');
        return null;
    }
    if (this.isForeignMode) {
        debugTrace('\nThe SecurityContext has been initialized with an access token of a\n'
                + 'foreign OAuth Client Id and/or Identity Zone. Furthermore, the \n'
                + 'access token contains attributes. Due to the fact that we want to\n'
                + 'restrict attribute access to the application that provided the \n'
                + 'attributes, the getAttribute function does not return any attributes.\n');
        return null;
    }
    if (name === undefined || name === null || name == "") {
        debugTrace('\nInvalid attribute name (may not be null, empty, or undefined).');
        return null;
    }
    if (!this.userAttributes.hasOwnProperty(name)) {
        debugTrace('\nNo attribute "' + name + '" found for user "'
                + this.userInfo.logonName + '".');
        return null;
    }
    return this.userAttributes[name];
};

SecurityContext.prototype.isInForeignMode = function() {
    return this.isForeignMode;
};

SecurityContext.prototype.hasAttributes = function() {
    forbidClientCredentialsToken('SecurityContext.hasAttributes', this.grantType);
    return this.tokenContainsAttributes;
};

SecurityContext.prototype.checkLocalScope = function(scope) {
    var scopeName = this.xsappname + '.' + scope;
    if ((scope === null) || (scope === undefined)) {
        return false;
    }
    return this.scopes.indexOf(scopeName) !== -1;
};

SecurityContext.prototype.getGrantType = function() {
    return this.grantType;
};

SecurityContext.prototype.checkScope = function(scope) {
    var scopeName = scope;

    if ((scope === null) || (scope === undefined)) {
        return false;
    }
    if (scopeName.substring(0, constants.XSAPPNAMEPREFIX.length) === constants.XSAPPNAMEPREFIX) {
        scopeName = scopeName.replace(constants.XSAPPNAMEPREFIX, this.xsappname + '.');
    }
    return this.scopes.indexOf(scopeName) !== -1;
};

function offlineValidation(accessToken, config, ssojwt, callback) {
    if (config.verificationkey === undefined) {
        var error = new Error('Error in offline validation of access token, because of missing verificationkey', null);
        error.statuscode = 500; //500 (missing verificationkey)
        return callback(error);
    }
    var ssorc = ssojwt.loadPEM(config.verificationkey);
    if ((ssorc !== 0) && (ssorc === 9)) {
        debugTrace('\nSSO library path:    ' + process.env['SSOEXT_LIB']);
        debugTrace('\nCCL library path:    ' + process.env['SSF_LIB']);
        debugTrace('\nSSO library version: ' + ssojwt.getLibraryVersion());
        debugTrace('\nSSO library code:    ' + ssojwt.getErrorRC());
        var error = new Error('Error in sapssoext, version : '
                + ssojwt.getLibraryVersion() + ' . Cannot load CCL from path: '
                + process.env['SSF_LIB'], null);
        error.statuscode = 500; //500 (lib not found)
        return callback(error);
    }
    ssojwt.checkToken(accessToken);
    if (ssojwt.getErrorDescription() !== "") {
        ssorc = ssojwt.getErrorRC();
        debugTrace('\nSSO library path:    ' + process.env['SSOEXT_LIB']);
        debugTrace('\nCCL library path:    ' + process.env['SSF_LIB']);
        debugTrace('\nSSO library version: ' + ssojwt.getLibraryVersion());
        debugTrace('\nSSO library code:    ' + ssojwt.getErrorRC());
        if ((ssorc !== 0) && (ssorc === 5)) {
            // verification key and JWT are not valid, no library error
            debugTrace('\nInvalid JWT:    ' + accessToken);
            var error = new Error(
                    'Invalid access token. Validation error: '
                    + ssojwt.getErrorDescription(), null);
            error.statuscode = 403; //403 (validation error)
            return callback(error);
        } else {
            var error = new Error(
                    'Error in offline validation of access token: '
                    + ssojwt.getErrorDescription(), null);
            error.statuscode = 403; //403 (validation error)
            return callback(error);
        }
    }
    var parsedPayload = null;
    try {
        parsedPayload = JSON.parse(ssojwt.getJWPayload());
    } catch (er) {
        var errorString = 'Access token payload could not be parsed successfully.\n'
                + 'Error: ' + er.message;
        debugError('\n' + errorString);
        var error = new Error(errorString);
        error.statuscode = 400; //400 (parsing error)
        return callback(error, null);
    }
    callback(null, parsedPayload);
}

function credentialsReplacer(key, value) {
    if (key === 'clientsecret') {
        return undefined;
    } else {
        return value;
    }
}

function forbidClientCredentialsToken(functionName, grantType) {
    if (grantType === constants.GRANTTYPE_CLIENTCREDENTIAL) {
        var errorString = '\nCall to '+functionName+' not allowed with a token of grant type '+constants.GRANTTYPE_CLIENTCREDENTIAL+'.';
        debugTrace(errorString);
        throw new Error(errorString);
    }
};
