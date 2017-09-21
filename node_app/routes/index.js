//Index
var express = require('express');
var router = express.Router();
var ratings = require('../models/ratings');
var validator = require('express-validator');
var config = require('../config/config.json');
var oAuth_service = require('../services/oAuth');
var analysis_service = require('../services/analysis_service');

/* GET home page. */
router.get('/', function(req, res, next) {
  res.render('index', { title: 'Feedback' });
});

/* Post the Ratings */
router.post('/updateratings', function(req,res){
	console.log('Ratings: ' + req.body.ratings);
    req.checkBody('ratings', 'Error! Please rate the session').notEmpty();
    var errors = req.validationErrors();
    
    if(errors){
    	res.json(errors);
    } else{
    	var name = req.body.name;
    	var sessionName = req.body.session;
    	var sessionOwner = req.body.owner;
    	var rating = req.body.ratings;
    	var comment = req.body.comments;
    	var empId = req.body.empId;
    	
    	//Perform a sentiment analysis    	
    	//Do the necessary sentiment analysis - First get the oAuth access token
    	if (config.use_yaas === 'true'){ //When you prefer to use YaaS service
	    	 oAuth_service.getoAuth(function(access_token){
	    		 //With the access token fire the sentiment analysis
	    		 analysis_service.sentiment(access_token, empId, sessionName, comment, function(result){
	    		    	//Update the table with the comment and feedback    		    	  
	    		 });    		 
	    	 });
    	} else { //If YaaS is not to be used - Use the ratings to find the Sentiment
    		var sentimentRank = parseInt(rating) - 3;
    		ratings.update({empId: empId, sessionName: sessionName}, {sentiment:sentimentRank}, {upsert: true}, function(err, details){
	    		//Do nothing
	   	 	});	
    	}
    	ratings.update({empId: empId, sessionName: sessionName}, {name: name, sessionOwner: sessionOwner, rating:rating, comment: comment}, {upsert: true}, function(err, details){
    		//Do nothing
   	 	});	
    	 setTimeout(function(){ //Just a temporary wait fix
    		 res.redirect('/summary'); 
    	 }, 3000);    	 
    }
});

/* 
 * View the summary of ratings
 */

router.get('/summary', function(req, res, next) {
	
	//Redirect counter
	var redirect = req.query.flag;
	
	//Get the list of all feedbacks from the DB
	ratings.find(function(err,result){
		if (err)
			res.JSON('Error in Database. Please check the connection and try again');
		
		//Calculate the overall feedback
		var total = 0, counter = 0, nTotal=0, nCount = 0, jTotal=0, jCount = 0, sTotal=0, sCount = 0;
		
		for (var i=0; i<result.length; i++){
			if (result[i].sessionName === 'Nodejs on Cloud Foundry')
			{
				nCount = nCount + 1;
				nTotal = nTotal + result[i].sentiment;
			}
			else if (result[i].sessionName === 'Java on Cloud Foundry')
			{
				jCount = jCount + 1;
				jTotal = jTotal + result[i].sentiment;
			}
			else if (result[i].sessionName === 'SAP HCP Essentials')
			{
				sCount = sCount + 1;
				sTotal = sTotal + result[i].sentiment;
			}			
			total = total + result[i].sentiment;			
			counter = i + 1;			
		}    		   	   
		
		//Summarizing the sentiments per session
		if (nCount !== 0) nTotal = Math.round( nTotal / nCount );		
		if (jCount !== 0) jTotal = Math.round( jTotal / jCount );
		if (sCount !== 0) sTotal = Math.round( sTotal / sCount );
		
		//Backup option
		if (nTotal > 2 ) nTotal =2;
		if (jTotal > 2 ) jTotal =2;
		if (sTotal > 2 ) sTotal =2;
		if (nTotal < -2 ) nTotal =-2;
		if (jTotal < -2 ) jTotal =-2;
		if (sTotal < -2 ) sTotal =-2;
		
		var overallSentiment = Math.round(total / counter);
		console.log('Total : '+ overallSentiment);
		res.render('summary',{ratings: overallSentiment, count: counter, nCount: nCount, nTotal: nTotal, jCount: jCount, jTotal: jTotal, sCount: sCount, sTotal: sTotal});
		
	});
});

module.exports = router;
