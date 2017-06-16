/**
 * Ratings collection to store all the feedbacks
 */

var mongoose = require('mongoose');
var Schema = mongoose.Schema;

var ratings = new Schema({
	sessionName: String,
	sessionOwner: String,
	name: String,
	rating: Number,
	comment: String,
	sentiment: Number,
	empId: String /* Newly added field */
});

module.exports = mongoose.model('ratings', ratings);