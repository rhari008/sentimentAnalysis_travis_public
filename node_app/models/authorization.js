/**
 * Model that stores the client secret and password along with the authorization
 */
var mongoose = require('mongoose');
var Schema = mongoose.Schema;

var authorization = new Schema({
	client_id: String,
	client_secret: String,
	access_token: String,
	time: Date
});

module.exports = mongoose.model('authorization', authorization);