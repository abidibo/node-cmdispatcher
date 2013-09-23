"use strict";

var express = require('express'),
    app = express(),
    server = require('http').createServer(app),
    io = require('socket.io').listen(server),
    MemoryStore = express.session.MemoryStore,
    sessionStore = new MemoryStore(),
    parseCookie = express.cookieParser(),
    cookie = require('express/node_modules/cookie'),
    config = require('./config/config');


app.configure(function () {
  app.use(express.cookieParser());
  // create a session id to allow io connection, checked in io authorization
  // here it will be possible to implement a solution in which the session id
  // is given only if some data (login data) are passed to the server
  // and are the right ones, for example enabling a /login path
  app.use(express.session({store: sessionStore
      , secret: 'secret'
      , key: 'express.sid'}));
  app.use("/static", express.static(__dirname + '/static'));
  app.use("/", function(req, res) {
    res.end('<h2>Hello, your session id is ' + req.sessionID + '</h2>');
  });
});

server.listen(8080, 'nodejs.abidibo.net');

io.set('authorization', function (data, accept) {
  console.log('data sent to authorization: ');
  console.log(data);
  if(data.headers.cookie) {
    data.cookie = cookie.parse(data.headers.cookie);
    data.sessionID = data.cookie['express.sid'].split('.')[0].substring(2);
    // (literally) get the session data from the session store
    sessionStore.load(data.sessionID, function (err, session) {
      if(err || !session) {
        // if we cannot grab a session, turn down the connection
        console.log('connection to socket failed');
        accept('Error', false);
      } else {
        // save the session data and accept the connection
        console.log('connection to socket was successfull');
        data.session = session;
        accept(null, true);
      }
    });
  } else {
     return accept('No cookie transmitted.', false);
  }
});

io.sockets.on('connection', function (socket) {
  console.log('A socket connected!');

  socket.on('join_channel', function(data) {
    var success = false;
    var message = ';'
    console.log('data passed to join channel: '); console.log(data);
    console.log('channels configuration on the server'); console.log(config.channels);
    if(!data.password || typeof config.channels[data.name] === 'undefined' || data.password !== config.channels[data.name]) {
      // authentication error
      console.log('authentication error');
      message = 'authentication error';
    }
    else {
      if(typeof socket.handshake.session.auth_channels === 'undefined') {
        socket.handshake.session.auth_channels = [];
      }
      socket.handshake.session.auth_channels.push(data.name);
      socket.handshake.session.save();
      socket.join(data.name);
      console.log('joined channel ' + data.name);
      success = true;
      message = 'authentication success';
    }
    socket.emit('auth_result', {
      'success': success,
      'message': message
    });
  });

  socket.on('send', function(data) {
    console.log('client want to emit');
    console.log(socket.handshake.session.auth_channels);
    console.log(data.channel);
    var channel = data.channel,
        evt = data.evt,
        d = data.data;
    if(typeof socket.handshake.session.auth_channels != 'undefined' && socket.handshake.session.auth_channels.indexOf(data.channel) !== -1) {
      io.sockets.in(channel).emit(evt, d);
    }
    else {
      console.log('permission denied');
    }
  })

});
