// TODO: move this all out
var Twitter = require('twitter');
var Async = require('async');
var mongoose = require('mongoose');


var Vote = require("../app/models/vote");
 
var client = new Twitter({
  consumer_key: 'yVYj7h1C96LWASLfChOjhwde0',
  consumer_secret: '6hW9qYIcGw3c3GtuXSi8SDXDSrgQ5hWEEth2Npoe3kbMfAVsDa',
  access_token_key: '8253682-w6mKrSEpwAqD8TjxttL8b6ODXVv8UwYRRClVCCsdr9',
  access_token_secret: '1FEiWlxBXiTakgs3wxxvVYUTtW07ppAEfQZv2FW0KXsne'
});

module.exports = function(app, passport) {
// route middleware to ensure user is logged in
function isLoggedIn(req, res, next) {
  if (req.isAuthenticated())
    return next();

  req.session.returnTo = req.path; 

  res.redirect('/auth/twitter');

  // passport.authenticate('twitter', { 
  //   scope : 'email' ,
  //   returnURL: req.url
  // })
}


// normal routes ===============================================================

  // show the home page (will also have our login links)
  app.get('/', function(req, res) {
    res.render('index.ejs');
  });

  // PROFILE SECTION =========================
  app.get('/profile', isLoggedIn, function(req, res) {
    res.render('profile.ejs', {
      user : req.user
    });
  });

  app.get('/save_votes', isLoggedIn, function(req, res) {
    var id = req.param.collectionId;
    console.log(req.query);
    var params = req.query;
    var collectionId = req.query.collectionId;

    var record_save_cbs = Object.keys(params).map(function processParam(paramName) {
      if (paramName.indexOf('quality-') == 0){
        value = params[paramName];
        valueParts = value.split('-');
        tweetId = valueParts[0];
        quality = valueParts[1];

        query = Vote.findOneAndUpdate({
          'userId': req.user.twitter.id,
          'collectionId': collectionId,
          'tweetId': tweetId
        }, {
          'userId': req.user.twitter.id,
          'collectionId': collectionId,
          'tweetId': tweetId,
          'vote': quality
        }, {'upsert': true});
        console.log(query);

        return mongoose.Query.prototype.exec.bind(query);
      }
    }).filter(Boolean);

    console.log(record_save_cbs);
    // res.redirect('/collection_eval/' + id);

    Async.parallel(record_save_cbs, function() {
      console.log('finished inserts');
    });
  });

   function display_collection_page(req, res, isShowPage) {
    console.log(req.params)
    id = req.params.id
    if (id.indexOf('custom-') == -1) {
      id = 'custom-' + id
    }

    params = {'id': id}
    console.log(params)
    votes = Vote.find({ collectionId: id }, function(err, votes) {
      if (err) return console.error(err);
      console.log(votes);

      var voteCounts = {}
      var myVotes = {}

      function make_default_vote_dict() { return {
        'meh': 0,
        'good': 0,
        'bad': 0
      } }

      votes.forEach(function(vote) {
        if (!(vote.tweetId in voteCounts)) {
          voteCounts[vote.tweetId] = make_default_vote_dict()
        }

        voteCounts[vote.tweetId][vote.vote] = voteCounts[vote.tweetId][vote.vote] + 1
        
        if (vote.userId == req.user.twitter.id) {
          myVotes['tweetId'] = vote.vote;
        }
      })

      client.get('collections/entries.json', params, function(error, response, unknown){
        console.log(error);
        console.log(tweets);

        var tweetIds = Object.keys(response['objects']['tweets']);

        var tweets = tweetIds.map(function(tweetId) {
          console.log(voteCounts);
          console.log(voteCounts[tweetId])

          return {
            id: tweetId,
            vote: myVotes[tweetId] || 'none',
            counts: voteCounts[tweetId] || make_default_vote_dict()
          }
        });

        res.render('collection_eval.ejs', {
          user : req.user,
          tweets : tweets,
          collectionId: id,
          bareCollectionId: id.split('-')[1],
          isShowPage: isShowPage,
          name: response['objects']['timelines'][id]['name'],
          description: response['objects']['timelines'][id]['description']
        });
      })
    })
  }

  // colllection eval tool SECTION =========================
  app.get('/collection_eval/:id/rate', isLoggedIn, function(req, res) {
    display_collection_page(req, res, false)
  });

  app.get('/collection_eval/:id/show', isLoggedIn, function(req, res) {
    display_collection_page(req, res, true)
  });


  // LOGOUT ==============================
  app.get('/logout', function(req, res) {
    req.logout();
    res.redirect('/');
  });

  // =============================================================================
  // AUTHENTICATE (FIRST LOGIN) ==================================================
  // =============================================================================

  // locally --------------------------------
    // LOGIN ===============================
    // show the login form
    app.get('/login', function(req, res) {
      res.render('login.ejs', { message: req.flash('loginMessage') });
    });

    // process the login form
    app.post('/login', passport.authenticate('local-login', {
      successRedirect : '/profile', // redirect to the secure profile section
      failureRedirect : '/login', // redirect back to the signup page if there is an error
      failureFlash : true // allow flash messages
    }));

    // SIGNUP =================================
    // show the signup form
    app.get('/signup', function(req, res) {
      res.render('signup.ejs', { message: req.flash('signupMessage') });
    });

    // process the signup form
    app.post('/signup', passport.authenticate('local-signup', {
      successRedirect : '/profile', // redirect to the secure profile section
      failureRedirect : '/signup', // redirect back to the signup page if there is an error
      failureFlash : true // allow flash messages
    }));

  // facebook -------------------------------

    // send to facebook to do the authentication
    app.get('/auth/facebook', passport.authenticate('facebook', { scope : 'email' }));

    // handle the callback after facebook has authenticated the user
    app.get('/auth/facebook/callback',
      passport.authenticate('facebook', {
        successRedirect : '/profile',
        failureRedirect : '/'
      }));

  // twitter --------------------------------

    // send to twitter to do the authentication
    app.get('/auth/twitter', passport.authenticate('twitter', { scope : 'email' }));

    // handle the callback after twitter has authenticated the user
    app.get('/auth/twitter/callback', passport.authenticate('twitter'), function(req, res) {
      res.redirect(req.session.returnTo || '/');
      delete req.session.returnTo;
     });

  // google ---------------------------------

    // send to google to do the authentication
    app.get('/auth/google', passport.authenticate('google', { scope : ['profile', 'email'] }));

    // the callback after google has authenticated the user
    app.get('/auth/google/callback',
      passport.authenticate('google', {
        successRedirect : '/profile',
        failureRedirect : '/'
      }));

  // =============================================================================
  // AUTHORIZE (ALREADY LOGGED IN / CONNECTING OTHER SOCIAL ACCOUNT) =============
  // =============================================================================

  // locally --------------------------------
    app.get('/connect/local', function(req, res) {
      res.render('connect-local.ejs', { message: req.flash('loginMessage') });
    });
    app.post('/connect/local', passport.authenticate('local-signup', {
      successRedirect : '/profile', // redirect to the secure profile section
      failureRedirect : '/connect/local', // redirect back to the signup page if there is an error
      failureFlash : true // allow flash messages
    }));

  // facebook -------------------------------

    // send to facebook to do the authentication
    app.get('/connect/facebook', passport.authorize('facebook', { scope : 'email' }));

    // handle the callback after facebook has authorized the user
    app.get('/connect/facebook/callback',
      passport.authorize('facebook', {
        successRedirect : '/profile',
        failureRedirect : '/'
      }));

  // twitter --------------------------------

    // send to twitter to do the authentication
    app.get('/connect/twitter', passport.authorize('twitter', { scope : 'email' }));

    // handle the callback after twitter has authorized the user
    app.get('/connect/twitter/callback',
      passport.authorize('twitter', {
        successRedirect : '/profile',
        failureRedirect : '/'
      }));


  // google ---------------------------------

    // send to google to do the authentication
    app.get('/connect/google', passport.authorize('google', { scope : ['profile', 'email'] }));

    // the callback after google has authorized the user
    app.get('/connect/google/callback',
      passport.authorize('google', {
        successRedirect : '/profile',
        failureRedirect : '/'
      }));

  // =============================================================================
  // UNLINK ACCOUNTS =============================================================
  // =============================================================================
  // used to unlink accounts. for social accounts, just remove the token
  // for local account, remove email and password
  // user account will stay active in case they want to reconnect in the future

  // local -----------------------------------
  app.get('/unlink/local', isLoggedIn, function(req, res) {
    var user      = req.user;
    user.local.email  = undefined;
    user.local.password = undefined;
    user.save(function(err) {
      res.redirect('/profile');
    });
  });

  // facebook -------------------------------
  app.get('/unlink/facebook', isLoggedIn, function(req, res) {
    var user      = req.user;
    user.facebook.token = undefined;
    user.save(function(err) {
      res.redirect('/profile');
    });
  });

  // twitter --------------------------------
  app.get('/unlink/twitter', isLoggedIn, function(req, res) {
    var user       = req.user;
    user.twitter.token = undefined;
    user.save(function(err) {
      res.redirect('/profile');
    });
  });

  // google ---------------------------------
  app.get('/unlink/google', isLoggedIn, function(req, res) {
    var user      = req.user;
    user.google.token = undefined;
    user.save(function(err) {
      res.redirect('/profile');
    });
  });
};
