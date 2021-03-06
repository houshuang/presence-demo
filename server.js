var http = require('http');
var express = require('express');
var ShareDB = require('@teamwork/sharedb');
var WebSocket = require('ws');
var WebSocketJSONStream = require('@teamwork/websocket-json-stream');
var ShareDBMongo = require('@teamwork/sharedb-mongo');
var richText = require('rich-text');
var json0 = require('@houshuang/ot-json0');

json0.type.registerSubtype(richText.type);
ShareDB.types.register(json0.type);

const dbUrl = 'mongodb://localhost:27017/cursors';
const db = ShareDBMongo(dbUrl);
var backend = new ShareDB({ db });
createDoc(startServer);

// Create initial document then fire callback
function createDoc(callback) {
  var connection = backend.connect();
  var doc = connection.get('examples', 'stian5');
  doc.fetch(function(err) {
    if (err) throw err;
    if (doc.type === null) {
      doc.create(
        {
          text: { ops: [{ insert: '\n' }] },
          text2: { ops: [{ insert: '\n' }] },
          example: '',example2: '',bike: false, car: false
        },
        'json0',
        callback
      );
      return;
    }
    callback();
  });
}

function startServer() {
  // Create a web server to serve files and listen to WebSocket connections
  var app = express();
  app.use(express.static('static'));
  app.use(express.static('node_modules/quill/dist'));
  var server = http.createServer(app);

  // Connect any incoming WebSocket connection to ShareDB
  var wss = new WebSocket.Server({ server: server });
  wss.on('connection', function(ws, req) {
    var stream = new WebSocketJSONStream(ws);
    backend.listen(stream);
  });

  server.listen(8080);
  console.log('Listening on http://localhost:8080');
}
