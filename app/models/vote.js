// load the things we need
var mongoose = require('mongoose');
var bcrypt   = require('bcrypt-nodejs');

// define the schema for our user model
var voteSchema = mongoose.Schema({
    collectionId : String,
    userId       : String,
    tweetId      : String,
    vote         : String
});

module.exports = mongoose.model('Vote', voteSchema);
