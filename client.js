var sharedb = require('@teamwork/sharedb/lib/client');
var richText = require('rich-text');
var json0 = require('@houshuang/ot-json0');
var Quill = require('quill');
var QuillCursors = require('quill-cursors');
var Stringify = require('json-stable-stringify');

Quill.register('modules/cursors', QuillCursors);

json0.type.registerSubtype(richText.type);
sharedb.types.register(json0.type);

// Open WebSocket connection to ShareDB server
var socket = new WebSocket('ws://' + window.location.host);
var connection = new sharedb.Connection(socket);

// For testing reconnection
window.disconnect = function() {
  connection.close();
};
window.connect = function() {
  var socket = new WebSocket('ws://' + window.location.host);
  connection.bindToSocket(socket);
};

var names = [
  'Peter',
  'Anna',
  'John',
  'Ole',
  'Niels',
  'Gregor',
  'Chen Li',
  'Ananda',
  'Rupert',
  'Ben'
];

// Helper functions for nicely displaying uid
function uidColor(uid) {
  var colors = [
    'red',
    'blue',
    'green',
    'purple',
    'orange',
    'olive',
    'maroon',
    'yellow',
    'lime',
    'teal'
  ];
  return colors[names.findIndex(x => x === uid)];
}

function renderNameplate(uid) {
  var css = 'background-color: ' + uidColor(uid) + ';';
  document.getElementById('nameplate').style = css;
  document.getElementById('nameplate').innerText = uid;
}

// Create local Doc instance mapped to 'examples' collection document with id 'richtext'
var doc = connection.get('examples', 'stian2');

// can only create when document doesn't yet exist
// doc.create({ text: '', text2: '' });

// Generate a random uid and display it.
var uid = names[Math.floor(Math.random() * 10)]
renderNameplate(uid);
doc.requestReplyPresence = true;

doc.subscribe(function(err) {
  if (err) throw err;
  var quill = new Quill('#editor', {
    theme: 'snow',
    modules: {
      cursors: {  hideDelayMs: 999999999 }
    }
  });
  var quill2 = new Quill('#editor2', {
    theme: 'snow',
    modules: {
      cursors: { hideDelayMs: 999999999 }
    }
  });
  var cursors = quill.getModule('cursors');
  var cursors2 = quill2.getModule('cursors');
  doc.submitPresence(
    {
      u: uid
    },
    err => {
      if (err) {
        throw err;
      }
      doc.requestReplyPresence = false;
    }
  );

  quill.setContents(doc.data.text);
  quill2.setContents(doc.data.text2);

  quill.on('text-change', function(delta, oldDelta, source) {
    if (source !== 'user') return;
    const op = { p: ['text'], t: 'rich-text', o: delta.ops };
    doc.submitOp(op, { source: quill });
  });

  quill2.on('text-change', function(delta, oldDelta, source) {
    if (source !== 'user') return;
    const op = { p: ['text2'], t: 'rich-text', o: delta.ops };
    doc.submitOp(op, { source: quill });
  });

  doc.on('op', function(ops, source) {
    if (source === quill) return;
    ops.forEach(op => {
      if (op.p[0] === 'text') {
        quill.updateContents(op.o);
      } else {
        quill2.updateContents(op.o);
      }
    });
  });

  // When we receive information about updated presences,
  // update the locall QuillCursor(s).
  doc.on('presence', function(srcList, submitted) {
    document.getElementById('presence').innerHTML = Object.values(doc.presence).map(x => `<li><b>${x.u}</b> - ${Stringify(x)}</li>`).join('')

    srcList.forEach(function(src) {
      if (doc.presence[src] && doc.presence[src].u) {
        var userid = doc.presence[src].u;
        if (
          userid !== uid &&
          doc.presence[src].s &&
          doc.presence[src].s.length > 0
        ) {
          // TODO: Can QuillCursors support multiple selections?
          var sel = doc.presence[src].s[0];

          // Use Math.abs because the sharedb presence type
          // supports reverse selections, but I don't think
          // Quill Cursors does.
          var len = Math.abs(sel[1] - sel[0]);
          var min = Math.min(sel[0], sel[1])

          // Re-creating an existing cursor is a no-op
          if (doc.presence[src].p && doc.presence[src].p[0] === 'text') {
            cursors.createCursor(userid, userid, uidColor(userid));
            cursors.moveCursor(userid, { index: min, length: len });
            cursors2.removeCursor(userid);
          } else {
            cursors2.createCursor(userid, userid, uidColor(userid));
            cursors2.moveCursor(userid, { index: min, length: len });
            cursors.removeCursor(userid);
          }
        }
      }
    });
  });

  // When the local Quill selection changes, publish our new
  // local presence data.
  quill.on('selection-change', function(range, oldRange, source) {
    if (source === 'user') {
      updateCursor(range, uid, 'text');
    } else {
      debouncedUpdate(range, uid, 'text');
    }
  });
  quill2.on('selection-change', function(range, oldRange, source) {
    if (source === 'user') {
      updateCursor(range, uid, 'text2');
    } else {
      debouncedUpdate(range, uid, 'text2');
    }
  });
});

function updateCursor(range, uid, text) {
  if (range) {
    doc.submitPresence({
      u: uid,
      p: [text],
      t: 'rich-text',
      c: 0,
      s: [[range.index, range.index + range.length]]
    });
  }
}

var debouncedUpdate = debounce(updateCursor, 500);

function debounce(func, wait) {
  var timeout;
  return function(...args) {
    var context = this;
    var later = function() {
      timeout = null;
      func.apply(context, args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}
