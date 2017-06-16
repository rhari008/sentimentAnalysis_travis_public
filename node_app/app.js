var express = require('express');
var path = require('path');
var favicon = require('serve-favicon');
var logger = require('morgan');
var cookieParser = require('cookie-parser');
var bodyParser = require('body-parser');
var mongoose = require('mongoose');

var config = require('./config/config.json');

var mongo_ip = config.mongo_ip;
var mongo_dbname = config.mongo_dbname;
var mongo_username = config.mongo_username;
var mongo_password = config.mongo_password;

var index = require('./routes/index');
var validator = require('express-validator');

var passport = require('passport');
var directory = __dirname;
console.log(directory);
//var JWTStrategy = require(directory+'/libraries/sap-xssec').JWTStrategy;
//var xsenv = require(directory+'/libraries/sap-xssec/node_modules/@sap/xsenv');
//var xsjs  = require(directory+'/libraries/sap-xsjs');
//var xssec = require(directory+'/libraries/sap-xsjs/node_modules/@sap/xssec');
var app = express();

var local = false;

// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'jade');

// uncomment after placing your favicon in /public
//app.use(favicon(path.join(__dirname, 'public', 'favicon.ico')));

//passport.use(new JWTStrategy(xsenv.getServices({uaa:{tag:'xsuaa'}}).uaa));
//app.use(passport.initialize());
//app.use(passport.authenticate('JWT', { session: false }));

//passport.use("JWT", new xssec.JWTStrategy(xsenv.getServices({
//	uaa: {
//		tag: "xsuaa"
//	}
//}).uaa));
//
//app.use(passport.initialize());
//app.use(passport.authenticate('JWT', { session: false }));

app.use(logger('dev'));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

app.use(validator());

//app.use('/', 
//		passport.authenticate('JWT', {session: false}),
//		index);

app.use(express.static(directory + '/image'));
app.use('/', index);
var mongo_url = "mongodb://" + mongo_username + ":" + mongo_password + "@" + mongo_ip + "/" + mongo_dbname;
mongo_url = config.mongo_url_local;

//Mongo DB Connection
//var db_options = {
//		pass: config.mongo_password
//};

//XS relates options
//var options = xsjs.extend({
//	//anonymous : true;
//	redirect : directory+"/routes/index.js;"
//});

//configure UAA
//try {
//    options = xsjs.extend(options, xsenv.getServices({ uaa: {tag: "xsuaa"} }));
//} catch (err) {
//    console.error(err);
//}

//var xsjsApp = xsjs(options);
//app.use(xsjsApp);

if (!local){
//Get the Mongo Instance details from the VCAP services
	var vcap_services = JSON.parse(process.env.VCAP_SERVICES);

	mongo_url = vcap_services.mongodb[0].credentials.uri;
	
	var db_options = {
		pass: 	vcap_services.mongodb[0].credentials.password
	};
}
mongoose.Promise = global.Promise;
mongoose.connect(mongo_url, db_options);

// catch 404 and forward to error handler
app.use(function(req, res, next) {
  var err = new Error('Not Found');
  err.status = 404;
  next(err);
});

// error handler
app.use(function(err, req, res, next) {
  // set locals, only providing error in development
  res.locals.message = err.message;
  res.locals.error = req.app.get('env') === 'development' ? err : {};

  // render the error page
  res.status(err.status || 500);
  res.render('error');
});

module.exports = app;
