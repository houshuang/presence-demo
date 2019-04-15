const ShareDB = require('@teamwork/sharedb/lib/client');
const json0 = require('@datavis-tech/ot-json0');
const HtmlTextCollabExt = require('@convergence/html-text-collab-ext');
const StringBinding = require('sharedb-string-binding');

ShareDB.types.register(json0.type);
ShareDB.types.defaultType = json0.type;

// Open WebSocket connection to ShareDB server
var socket = new WebSocket('ws://' + window.location.host);
var connection = new ShareDB.Connection(socket);

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

const textarea = document.getElementById('example');

textarea.addEventListener('focus', function() {
  window.setTimeout(
    () =>
      updateCursorText(
        [textarea.selectionStart, textarea.selectionStart],
        uid,
        'example'
      ),
    100
  );
});

// Create local Doc instance.
var doc = connection.get('examples', 'example');

// Generate a random uid and display it.
var uid = names[Math.floor(Math.random() * 10)];
renderNameplate(uid);
doc.requestReplyPresence = true;

const collaborators = {};

doc.subscribe(function(err) {
  if (err) throw err;

  console.log('doc.data');
  console.log(doc.data);

  const binding = new StringBinding(textarea, doc, ['example']);
  binding.setup();

  const textEditor = new HtmlTextCollabExt.CollaborativeTextEditor({
    control: textarea,
    onSelectionChanged: selection =>
      updateCursorText([selection.anchor, selection.target], uid, 'example')
  });

  const selectionManager = textEditor.selectionManager();

  // When we receive information about updated presences, update the ui.
  doc.on('presence', function(srcList, submitted) {

    srcList.forEach(function(src) {
      if(!doc.presence[src]) return;

      const presence = doc.presence[src];

      const presencePath = presence.p;
      const presenceType = presence.t;
      const subPresence = presence.s;

      if (subPresence.u) {
        var userid = subPresence.u;
        if (
          userid !== uid &&
          subPresence &&
          subPresence.s &&
          subPresence.s.length > 0
        ) {
          var sel = subPresence.s[0];

          if (!collaborators[userid]) {
            collaborators[userid] = selectionManager.addCollaborator(
              userid,
              userid,
              uidColor(userid)
            );
          }

          collaborators[userid].setSelection({ anchor: sel[0], target: sel[1] });
          collaborators[userid].flashCursorToolTip(2);
        }
      }
    });
  });
});

function updateCursorText(range, uid, text) {
  if (range) {
    doc.submitPresence({
      p: [text],
      t: 'rich-text',
      s: {
        u: uid,
        c: 0,
        s: [range]
      }
    });
  }
}
