/**
 * Service to get the oAuth grant
 */
var request = require("request");

var access = require('../models/authorization');
var config = require('../config/config.json');
var deasync = require('deasync');
var flag = false;
var access_token;
var moment = require('moment');

module.exports.getoAuth = function(callback){

	//First generate the access token by checking the date time - Normally, access tokens expires in 1 hour
	//Check in the DB for the access token
	access.findOne({client_id: config.client_id}, function(err, result){		
		if(!err && (result !== null)){
			var grant_time = moment(result.time);
			var currentTime = moment(new Date());
			//Calculate the hour difference - If the difference is more than 50 minutes, generate a new access token 
			if ((currentTime.diff(grant_time, 'seconds')/60) > 55)
			{
				calloAuth();
			}
			else{ //Use the same access token
				access_token = result.access_token;
				flag = true;
			}
		}
		else if (!err && (result == null)){ //First time access request
			calloAuth();
		}
	});

	require('deasync').loopWhile(function(){return !flag;}); //Just wait for the findOne
	flag = false;
	callback(access_token);
};

function calloAuth(){
	var proxy = null;
	if (config.proxy_enabled === 'true')
		proxy = config.proxy;
	
	var options = { method: 'POST',
			  url: config.oauth_url,
			  proxy:  proxy,
			  headers: 
			   { 
			     'cache-control': 'no-cache',
			     'content-type': 'application/x-www-form-urlencoded' },
			  form: 
			   { grant_type: 'client_credentials',
			     client_id: config.client_id,
			     client_secret: config.client_secret } };

	request(options, function (error, response, body) {
	  if (error) { 
		  console.log(error);
		  access_token = null;
	  }			  
	  access_token = JSON.parse(body).access_token;
	  flag = true;
	 //Update the table
	 access.update({client_id: config.client_id}, {client_secret: config.client_secret, access_token: access_token, time: new Date()}, {upsert: true}, function(err, details){
		//Do nothing
	 });	  
	});	
}