var sharedb = require('@teamwork/sharedb/lib/client');
var richText = require('rich-text');
var json0 = require('@houshuang/ot-json0');
var Quill = require('quill');
var QuillCursors = require('quill-cursors');
var Stringify = require('json-stable-stringify');
var HtmlTextCollabExt = require('@convergence/html-text-collab-ext');
var StringBinding = require('sharedb-string-binding');

const { unpackPresence } = json0.type;

Quill.register('modules/cursors', QuillCursors);

presence1 = {};
presence2 = {};

json0.type.registerSubtype(richText.type);
sharedb.types.register(json0.type);

const textarea = document.getElementById('example');
const textinput = document.getElementById('example2');
const car = document.getElementById('car');
const bike = document.getElementById('bike');
const carP = {};
const bikeP = {};

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
textinput.addEventListener('focus', function() {
  window.setTimeout(
    () =>
      updateCursorText(
        [textarea.selectionStart, textarea.selectionStart],
        uid,
        'example2'
      ),
    100
  );
});
const carPresence = document.getElementById('presenceCar');
const bikePresence = document.getElementById('presenceBike');

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
var doc = connection.get('examples', 'stian5');

// can only create when document doesn't yet exist
// doc.create({ text: '', text2: '' });

// Generate a random uid and display it.
var uid = names[Math.floor(Math.random() * 10)];
renderNameplate(uid);
doc.requestReplyPresence = true;

doc.subscribe(function(err) {
  if (err) throw err;
  var quill = new Quill('#editor', {
    theme: 'snow',
    modules: {
      cursors: { hideDelayMs: 999999999 }
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
  //doc.submitPresence(
  //  {
  //    u: uid,
  //    userInfo: { uid }
  //  },
  //  err => {
  //    if (err) {
  //      throw err;
  //    }
  //    doc.requestReplyPresence = false;
  //  }
  //);

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

  bike.addEventListener('change', function() {
    checkboxSubmit('bike', this.checked);
  });
  car.addEventListener('change', function() {
    checkboxSubmit('car', this.checked);
  });

  const binding = new StringBinding(textarea, doc, ['example']);
  binding.setup();

  const textEditor = new HtmlTextCollabExt.CollaborativeTextEditor({
    control: textarea,
    onSelectionChanged: selection =>
      updateCursorText([selection.anchor, selection.target], uid, 'example')
  });
  const binding2 = new StringBinding(textinput, doc, ['example2']);
  binding2.setup();

  const textEditor2 = new HtmlTextCollabExt.CollaborativeTextEditor({
    control: textinput,
    onSelectionChanged: selection =>
      updateCursorText([selection.anchor, selection.target], uid, 'example2')
  });

  const selectionManager = textEditor.selectionManager();
  const selectionManager2 = textEditor2.selectionManager();

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
    document.getElementById('presence').innerHTML = Object.values(doc.presence)
      .map(x => `<li><b>${x.u}</b> - ${Stringify(x)}</li>`)
      .join('');

    srcList.forEach(function(src) {
      if(!doc.presence[src]) return;

      const {
        presencePath,
        presenceType,
        subPresence
      } = unpackPresence(doc.presence[src]);

      if (subPresence.u) {
        var userid = subPresence.u;
        if (
          userid !== uid &&
          subPresence &&
          subPresence.s &&
          subPresence.s.length > 0
        ) {
          // TODO: Can QuillCursors support multiple selections?
          var sel = subPresence.s[0];

          // Use Math.abs because the sharedb presence type
          // supports reverse selections, but I don't think
          // Quill Cursors does.
          var len = Math.abs(sel[1] - sel[0]);
          var min = Math.min(sel[0], sel[1]);

          // Re-creating an existing cursor is a no-op
          if (presencePath && presencePath[0] === 'text') {
            cursors.createCursor(userid, userid, uidColor(userid));
            cursors.moveCursor(userid, { index: min, length: len });
            cursors2.removeCursor(userid);
            if (presence1[userid]) {
              selectionManager.removeCollaborator(userid);
              presence1[userid] = null;
            }
            if (presence2[userid]) {
              selectionManager.removeCollaborator(userid);
              presence1[userid] = null;
            }
          } else if (
            presencePath &&
            presencePath[0] === 'text2'
          ) {
            cursors2.createCursor(userid, userid, uidColor(userid));
            cursors2.moveCursor(userid, { index: min, length: len });
            cursors.removeCursor(userid);
          } else if (
            presencePath &&
            presencePath[0] === 'example'
          ) {
            cursors2.removeCursor(userid);
            cursors.removeCursor(userid);
            if (presence2[userid]) {
              selectionManager2.removeCollaborator(userid);
              presence2[userid] = null;
            }
            if (!presence1[userid]) {
              presence1[userid] = selectionManager.addCollaborator(
                userid,
                userid,
                uidColor(userid)
              );
            }

            presence1[userid].setSelection({ anchor: sel[0], target: sel[1] });
            presence1[userid].flashCursorToolTip(2);
          } else if (
            presencePath &&
            presencePath[0] === 'example2'
          ) {
            cursors2.removeCursor(userid);
            cursors.removeCursor(userid);
            if (presence1[userid]) {
              selectionManager.removeCollaborator(userid);
              presence1[userid] = null;
            }
            if (!presence2[userid]) {
              presence2[userid] = selectionManager2.addCollaborator(
                userid,
                userid,
                uidColor(userid)
              );
            }

            presence2[userid].setSelection({ anchor: sel[0], target: sel[1] });
            presence2[userid].flashCursorToolTip(2);
          }
        }
      }
    });
  });

  doc.on('presence', function(srcList, submitted) {
    srcList.forEach(function(src) {
      if(!doc.presence[src]) return;

      const {
        presencePath,
        presenceType,
        subPresence
      } = unpackPresence(doc.presence[src]);

      var userid = subPresence.u;
      if (presencePath && presencePath[0] === 'car') {
        carP[userid] = true;
        bikeP[userid] = false;
        updateCarBikeP();
        cursors2.removeCursor(userid);
        cursors.removeCursor(userid);
        if (presence1[userid]) {
          selectionManager.removeCollaborator(userid);
          presence1[userid] = null;
        }
        if (presence2[userid]) {
          selectionManager.removeCollaborator(userid);
          presence2[userid] = null;
        }
      } else if (presencePath && presencePath[0] === 'bike') {
        carP[userid] = false;
        bikeP[userid] = true;
        updateCarBikeP();
        cursors2.removeCursor(userid);
        cursors.removeCursor(userid);
        if (presence1[userid]) {
          selectionManager.removeCollaborator(userid);
          presence1[userid] = null;
        }
        if (presence2[userid]) {
          selectionManager.removeCollaborator(userid);
          presence2[userid] = null;
        }
      } else {
        carP[userid] = false;
        bikeP[userid] = false;
      }
    });
    updateCarBikeP();
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

function updateCursorText(range, uid, text) {
  if (range) {
    doc.submitPresence([
      text,
      'rich-text',
      {
        u: uid,
        c: 0,
        s: [range]
      }
    ]);
  }
}

function updateCursor(range, uid, text) {
  if (range) {
    doc.submitPresence([
      text,
      'rich-text',
      {
        u: uid,
        c: 0,
        s: [[range.index, range.index + range.length]]
      }
    ]);
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

const checkboxSubmit = (field, value) => {
  doc.submitPresence({
    u: uid,
    p: [field],
    cursor: { s: [[]] }
  });

  doc.submitOp({ p: [field], oi: value });
};

const updateCarBikeP = () => {
  carPresence.innerText =
    Object.keys(carP)
      .filter(x => carP[x])
      .join(' - ') || '';
  bikePresence.innerText =
    Object.keys(bikeP)
      .filter(x => bikeP[x])
      .join(' - ') || '';
};
