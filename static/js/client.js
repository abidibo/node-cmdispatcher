"use strict";

/**
 * node-cmdispatcher namespace
 * @namespace
 */
var ncd;
if (!ncd) ncd = {};
else if( typeof ncd != 'object') {
	throw new Error('ncd already exists and is not an object');
}

/**
 * @summary Client library loader
 * @description Loads the socket.io client library, initializes the ncd Client class and when raedy calls the given callback function
 * @memberof ncd
 * @param {Function} callback The function to execute when the library is ready
 * @example 
 *  ncd.load(function() {
 *    // the library is ready
 *    var client = new ncd.Client();
 *    // do something with it
 *  })
 */
ncd.load = function(callback) {
  // first of all, let's load socket.io client library
  var scripts = document.head.getElementsByTagName('script');
  var socketio_src = null;
  for(var i = 0, l = scripts.length; i < l; i++ ) {
    var match = /(.*)\/static\/js\/client.js$/.exec(scripts[i].src);
    if(match) {
      socketio_src = match[1] + '/socket.io/socket.io.js';
    }
  }

  if(socketio_src) {
    var socketio_script = document.createElement('script');
    socketio_script.type = 'text/javascript';
    socketio_script.src = socketio_src;
    document.head.appendChild(socketio_script);

    if(socketio_script.readyState) {  //IE
      socketio_script.onreadystatechange = function(){
        if(socketio_script.readyState == "loaded" || socketio_script.readyState == "complete") {
          socketio_script.onreadystatechange = null;
          initialize();
          callback.call();
        }
      };
    }
    else {  //Others
      socketio_script.onload = function() {
        initialize();
        callback.call();
      };
    }
  }
  else {
    throw new Error('can\'t get the node-cmdispatcher server url');
  }

  /**
   * @summary Initializes the client class
   */
  function initialize() {

    console.log('socket.io is ready');

    /**
     * @summary Client library object
     * @description This is the client object used to interact with the server through socket
     * @memberof ncd
     */
    ncd.Client = function() {
      // binding
      var self = this;
      // connection
      this.connection = false;
      // connected channels
      this.channels = [];
      // socket.io instance
      this.io = io;
      // socket
      this.socket = null;

      /** 
       * @summary Connects the client to the socket
       * @description Connects the client to the socket, calls the given callback function if succesfull, throw an error otherwise
       *              To the callback function is passed the client class as this keyword
       * @memberof ncd
       * @param {String} server the server url
       * @param {Function} callback function to be executed if connection is succesfull
       */
      this.connect = function connect(server, callback) {
        // connect to socket
        this.socket = this.io.connect(server);
        // if connection is succesfull call the callback function
        this.socket.on('connect', function() {
          self.connection = true;
          console.log('connected to socket on ' + server);
          callback.call(self);
        })
        this.socket.on('error', function() {
          var e = 'connection to socket on ' + server + ' failed';
          console.log(e);
          throw new Error(e);
        })
      };

      /**
       * @summary Decorator function to check for connection
       * @description Checks for the socket connection, if the client is connected to socket executes the decorated function, otherwise throws an error
       * @memberof ncd
       * @param {Function} The function to decorate
       */
      this.connectDecorator = function(fn) {
        return function() {
          if(self.connection) {
            fn.apply(self, arguments);
          }
          else {
            console.log('socket is not connected');
            throw new Error('socket is not connected');
          }
        }
      }

      this.joinChannel = this.connectDecorator(
        function(channel, passwd, callback, callback_error) {
          var args = arguments;
          // join the channel
          this.socket.emit('join_channel', {name: args[0], password: args[1]});
          this.socket.on('auth_result', function(data) {
            if(data.success) {
              self.channels.push(channel);
              args[2].call(self);
            }
            else {
              args[3].call(self, data.message);
            }
          });
        }
      )

      this.listen = function(evt, callback) {
        this.socket.on(evt, function(data) { callback.call(this, data); });
      }

      this.send = function(evt, channel, data) {
        this.socket.emit('send', {channel: channel, evt: evt, data: data});
      }
    }
  }
}
