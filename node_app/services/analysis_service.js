/**
 * Sentiment analysis service - Uses the YaaS service that is publicly available
 */

//strong positive, weak positive, neutral, weak negative, and strong negative

var request = require("request");
var config = require('../config/config.json');
var ratings = require('../models/ratings');

module.exports.sentiment = function(access_token, empId, sessionName, text, callback){
	var proxy = null;
	var sentimentRank = 0;
	if (config.proxy_enabled === 'true')
		proxy = config.proxy;
	var options = { method: 'POST',
			  url: config.sentiment_service,
			  proxy:  proxy,
			  qs: { languageCodes: 'en' },
			  headers: 
			   { 
			     'cache-control': 'no-cache',
			     'content-type': 'application/json',
			     authorization: 'Bearer '+access_token },
			  body: { text: text },
			  json: true };

			request(options, function (error, response, body) {
			  if (error) throw new Error(error);			  
			  //Take all the sentiments
			  var items = body.entities;
			  var counter = 0;
			 items.forEach(function(item){
				switch (item.labelPath){
					case 'StrongPositiveSentiment':
						sentimentRank = sentimentRank + 2;
						counter = counter + 1;
						break;
					case 'WeakPositiveSentiment':
						sentimentRank = sentimentRank + 1;
						counter = counter + 1;
						break;
					case 'NeutralSentiment':
						counter = counter + 1;
						break; //Nothing to add
					case 'WeakNegativeSentiment':
						sentimentRank = sentimentRank - 1;
						counter = counter + 1;
						break;
					case 'StrongNegativeSentiment':
						sentimentRank = sentimentRank - 2;
						counter = counter + 1;
						break;
				}				 
			 });
			 
			 //Cummulate the sentiment Rank based on the number of statements
			 var overallSentiment = Math.round(sentimentRank/counter); //Average out the sentiments
			 console.log('Overall Sentiments : ' + overallSentiment);
			 //Update the DB with the sentiment ranking
			 ratings.update({empId: empId, sessionName: sessionName}, {sentiment:sentimentRank}, {upsert: true}, function(err, details){
		    		//Do nothing
		   	 	});	 
			});
	
}