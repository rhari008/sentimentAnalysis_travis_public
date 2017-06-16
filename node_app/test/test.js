/**
 * Test document
 */


var should = require('should');  
var index = require('../routes/index.js');
var request = require('supertest');
var app = require('../app');

var User = function(name){  
    this.name = name;
};
describe("Checking if the user is created correctly", function(){  
    it("should create the user with the correct name", function(){
        debugger
        var tom = new User("tom");
        tom.name.should.be.equal("tom");
    });
});

describe("#index()", function(){
	 it("should return error incase of invalid or empty rating", function(done){
	        request(app)
	        	.post('/updateratings')
	        	.send("{ratings:''}")
	        	.expect(200)
	        	.end(function(err, res) {
	        		var responseCheck = JSON.stringify(res.body).indexOf('Error');     		
	        		if (err) return done(err);
	        		if (responseCheck != -1)
	        			done();
	        		else
	        			done(new Error('Rating validation failed'));
	        });
	        
	    });
});