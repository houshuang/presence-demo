(function(){function r(e,n,t){function o(i,f){if(!n[i]){if(!e[i]){var c="function"==typeof require&&require;if(!f&&c)return c(i,!0);if(u)return u(i,!0);var a=new Error("Cannot find module '"+i+"'");throw a.code="MODULE_NOT_FOUND",a}var p=n[i]={exports:{}};e[i][0].call(p.exports,function(r){var n=e[i][1][r];return o(n||r)},p,p.exports,r,e,n,t)}return n[i].exports}for(var u="function"==typeof require&&require,i=0;i<t.length;i++)o(t[i]);return o}return r})()({1:[function(require,module,exports){
var TextDiffBinding = require('text-diff-binding');

module.exports = StringBinding;

function StringBinding(element, doc, path) {
  TextDiffBinding.call(this, element);
  this.doc = doc;
  this.path = path || [];
  this._opListener = null;
  this._inputListener = null;
}
StringBinding.prototype = Object.create(TextDiffBinding.prototype);
StringBinding.prototype.constructor = StringBinding;

StringBinding.prototype.setup = function() {
  this.update();
  this.attachDoc();
  this.attachElement();
};

StringBinding.prototype.destroy = function() {
  this.detachElement();
  this.detachDoc();
};

StringBinding.prototype.attachElement = function() {
  var binding = this;
  this._inputListener = function() {
    binding.onInput();
  };
  this.element.addEventListener('input', this._inputListener, false);
};

StringBinding.prototype.detachElement = function() {
  this.element.removeEventListener('input', this._inputListener, false);
};

StringBinding.prototype.attachDoc = function() {
  var binding = this;
  this._opListener = function(op, source) {
    binding._onOp(op, source);
  };
  this.doc.on('op', this._opListener);
};

StringBinding.prototype.detachDoc = function() {
  this.doc.removeListener('op', this._opListener);
};

StringBinding.prototype._onOp = function(op, source) {
  if (source === this) return;
  if (op.length === 0) return;
  if (op.length > 1) {
    throw new Error('Op with multiple components emitted');
  }
  var component = op[0];
  if (isSubpath(this.path, component.p)) {
    this._parseInsertOp(component);
    this._parseRemoveOp(component);
  } else if (isSubpath(component.p, this.path)) {
    this._parseParentOp();
  }
};

StringBinding.prototype._parseInsertOp = function(component) {
  if (!component.si) return;
  var index = component.p[component.p.length - 1];
  var length = component.si.length;
  this.onInsert(index, length);
};

StringBinding.prototype._parseRemoveOp = function(component) {
  if (!component.sd) return;
  var index = component.p[component.p.length - 1];
  var length = component.sd.length;
  this.onRemove(index, length);
};

StringBinding.prototype._parseParentOp = function() {
  this.update();
};

StringBinding.prototype._get = function() {
  var value = this.doc.data;
  for (var i = 0; i < this.path.length; i++) {
    var segment = this.path[i];
    value = value[segment];
  }
  return value;
};

StringBinding.prototype._insert = function(index, text) {
  var path = this.path.concat(index);
  var op = {p: path, si: text};
  this.doc.submitOp(op, {source: this});
};

StringBinding.prototype._remove = function(index, text) {
  var path = this.path.concat(index);
  var op = {p: path, sd: text};
  this.doc.submitOp(op, {source: this});
};

function isSubpath(path, testPath) {
  for (var i = 0; i < path.length; i++) {
    if (testPath[i] !== path[i]) return false;
  }
  return true;
}

},{"text-diff-binding":37}],2:[function(require,module,exports){
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

},{"@convergence/html-text-collab-ext":8,"@datavis-tech/ot-json0":12,"@teamwork/sharedb/lib/client":17,"sharedb-string-binding":1}],3:[function(require,module,exports){
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.CollaborativeSelectionManager = void 0;

var _CollaboratorSelection = require("./CollaboratorSelection");

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } }

function _createClass(Constructor, protoProps, staticProps) { if (protoProps) _defineProperties(Constructor.prototype, protoProps); if (staticProps) _defineProperties(Constructor, staticProps); return Constructor; }

function _defineProperty(obj, key, value) { if (key in obj) { Object.defineProperty(obj, key, { value: value, enumerable: true, configurable: true, writable: true }); } else { obj[key] = value; } return obj; }

var CollaborativeSelectionManager =
/*#__PURE__*/
function () {
  function CollaborativeSelectionManager(options) {
    var _this = this;

    _classCallCheck(this, CollaborativeSelectionManager);

    _defineProperty(this, "_collaborators", void 0);

    _defineProperty(this, "_textElement", void 0);

    _defineProperty(this, "_overlayContainer", void 0);

    _defineProperty(this, "_scroller", void 0);

    _defineProperty(this, "_onSelection", void 0);

    _defineProperty(this, "_selectionAnchor", void 0);

    _defineProperty(this, "_selectionTarget", void 0);

    _defineProperty(this, "_checkSelection", function () {
      setTimeout(function () {
        var changed = _this._textElement.selectionStart !== _this._selectionAnchor || _this._textElement.selectionEnd !== _this._selectionTarget;

        if (changed) {
          if (_this._selectionAnchor === _this._textElement.selectionStart) {
            _this._selectionAnchor = _this._textElement.selectionStart;
            _this._selectionTarget = _this._textElement.selectionEnd;
          } else {
            _this._selectionAnchor = _this._textElement.selectionEnd;
            _this._selectionTarget = _this._textElement.selectionStart;
          }

          _this._onSelection({
            anchor: _this._selectionAnchor,
            target: _this._selectionTarget
          });
        }
      }, 0);
    });

    _defineProperty(this, "_onMouseMove", function () {
      _this._checkResize();

      _this._checkSelection();
    });

    _defineProperty(this, "_checkResize", function () {
      if (_this._textElement.offsetWidth !== _this._overlayContainer.offsetWidth || _this._textElement.offsetHeight !== _this._overlayContainer.offsetHeight) {
        _this._updateOverlay();

        _this._collaborators.forEach(function (renderer) {
          return renderer.refresh();
        });
      }
    });

    this._collaborators = new Map();
    this._textElement = options.control;
    this._onSelection = options.onSelectionChanged;
    this._selectionAnchor = this._textElement.selectionStart;
    this._selectionTarget = this._textElement.selectionEnd;
    this._overlayContainer = this._textElement.ownerDocument.createElement("div");
    this._overlayContainer.className = "text-collab-ext";

    this._textElement.parentElement.append(this._overlayContainer);

    this._scroller = this._textElement.ownerDocument.createElement("div");
    this._scroller.className = "text-collab-ext-scroller";

    this._overlayContainer.append(this._scroller); // Provide resize handling. After the mose down, we register for mouse
    // movement and check if we have resized. We then listen for a mouse up
    // to unregister.


    this._textElement.addEventListener("mousedown", function () {
      window.addEventListener("mousemove", _this._onMouseMove);
    });

    window.addEventListener("mouseup", function () {
      window.removeEventListener("mousemove", _this._onMouseMove);

      _this._checkResize();
    });

    this._textElement.addEventListener("scroll", function () {
      return _this._updateScroller();
    });

    this._textElement.addEventListener("keydown", this._checkSelection);

    this._textElement.addEventListener("click", this._checkSelection);

    this._textElement.addEventListener("focus", this._checkSelection);

    this._textElement.addEventListener("blur", this._checkSelection);

    this._updateOverlay();
  }

  _createClass(CollaborativeSelectionManager, [{
    key: "addCollaborator",
    value: function addCollaborator(id, label, color, selection) {
      if (this._collaborators.has(id)) {
        throw new Error("A collaborator with the specified id already exists: ".concat(id));
      }

      var collaborator = new _CollaboratorSelection.CollaboratorSelection(this._textElement, this._scroller, color, label, {
        margin: 5
      });

      this._collaborators.set(id, collaborator);

      if (selection !== undefined && selection !== null) {
        collaborator.setSelection(selection);
      }

      return collaborator;
    }
  }, {
    key: "getCollaborator",
    value: function getCollaborator(id) {
      return this._collaborators.get(id);
    }
  }, {
    key: "removeCollaborator",
    value: function removeCollaborator(id) {
      var renderer = this._collaborators.get(id);

      if (renderer !== undefined) {
        renderer.clearSelection();

        this._collaborators.delete(id);
      } else {
        throw new Error("Unknown collaborator: ".concat(id));
      }
    }
  }, {
    key: "getSelection",
    value: function getSelection() {
      return {
        anchor: this._selectionAnchor,
        target: this._selectionTarget
      };
    }
  }, {
    key: "show",
    value: function show() {
      this._overlayContainer.style.visibility = "visible";
    }
  }, {
    key: "hide",
    value: function hide() {
      this._overlayContainer.style.visibility = "hidden";
    }
  }, {
    key: "dispose",
    value: function dispose() {
      this._overlayContainer.parentElement.removeChild(this._overlayContainer);
    }
  }, {
    key: "_updateOverlay",
    value: function _updateOverlay() {
      var top = this._textElement.offsetTop;
      var left = this._textElement.offsetLeft;
      var height = this._textElement.offsetHeight;
      var width = this._textElement.offsetWidth;
      this._overlayContainer.style.top = top + "px";
      this._overlayContainer.style.left = left + "px";
      this._overlayContainer.style.height = height + "px";
      this._overlayContainer.style.width = width + "px";
    }
  }, {
    key: "_updateScroller",
    value: function _updateScroller() {
      this._scroller.style.top = this._textElement.scrollTop * -1 + "px";
      this._scroller.style.left = this._textElement.scrollLeft * -1 + "px";
    }
  }]);

  return CollaborativeSelectionManager;
}();

exports.CollaborativeSelectionManager = CollaborativeSelectionManager;
},{"./CollaboratorSelection":5}],4:[function(require,module,exports){
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.CollaborativeTextEditor = void 0;

var _CollaborativeSelectionManager = require("./CollaborativeSelectionManager");

var _TextInputManager = require("./TextInputManager");

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } }

function _createClass(Constructor, protoProps, staticProps) { if (protoProps) _defineProperties(Constructor.prototype, protoProps); if (staticProps) _defineProperties(Constructor, staticProps); return Constructor; }

function _defineProperty(obj, key, value) { if (key in obj) { Object.defineProperty(obj, key, { value: value, enumerable: true, configurable: true, writable: true }); } else { obj[key] = value; } return obj; }

var CollaborativeTextEditor =
/*#__PURE__*/
function () {
  function CollaborativeTextEditor(options) {
    _classCallCheck(this, CollaborativeTextEditor);

    _defineProperty(this, "_selectionManager", void 0);

    _defineProperty(this, "_inputManager", void 0);

    if (!options) {
      throw new Error("options must be defined.");
    }

    if (!options.control) {
      throw new Error("options.control must be defined.");
    }

    var control = options.control;
    var onInsert = options.onInsert !== undefined ? options.onInsert : function (index, value) {};
    var onDelete = options.onDelete !== undefined ? options.onDelete : function (index, length) {};
    var onSelectionChanged = options.onSelectionChanged !== undefined ? options.onSelectionChanged : function (selection) {};
    this._inputManager = new _TextInputManager.TextInputManager({
      control: control,
      onInsert: onInsert,
      onDelete: onDelete
    });
    this._selectionManager = new _CollaborativeSelectionManager.CollaborativeSelectionManager({
      control: control,
      onSelectionChanged: onSelectionChanged
    });
  }

  _createClass(CollaborativeTextEditor, [{
    key: "insertText",
    value: function insertText(index, value) {
      this._inputManager.insertText(index, value);
    }
  }, {
    key: "deleteText",
    value: function deleteText(index, length) {
      this._inputManager.deleteText(index, length);
    }
  }, {
    key: "setText",
    value: function setText(value) {
      this._inputManager.setText(value);
    }
  }, {
    key: "getText",
    value: function getText() {
      return this._inputManager.getText();
    }
  }, {
    key: "selectionManager",
    value: function selectionManager() {
      return this._selectionManager;
    }
  }]);

  return CollaborativeTextEditor;
}();

exports.CollaborativeTextEditor = CollaborativeTextEditor;
},{"./CollaborativeSelectionManager":3,"./TextInputManager":7}],5:[function(require,module,exports){
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.CollaboratorSelection = void 0;

var _SelectionComputer = require("./SelectionComputer");

var _textareaCaret = _interopRequireDefault(require("textarea-caret"));

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } }

function _createClass(Constructor, protoProps, staticProps) { if (protoProps) _defineProperties(Constructor.prototype, protoProps); if (staticProps) _defineProperties(Constructor, staticProps); return Constructor; }

function _defineProperty(obj, key, value) { if (key in obj) { Object.defineProperty(obj, key, { value: value, enumerable: true, configurable: true, writable: true }); } else { obj[key] = value; } return obj; }

var CollaboratorSelection =
/*#__PURE__*/
function () {
  function CollaboratorSelection(textInput, overlayContainer, color, label, options) {
    _classCallCheck(this, CollaboratorSelection);

    _defineProperty(this, "_rows", void 0);

    _defineProperty(this, "_cursorElement", void 0);

    _defineProperty(this, "_tooltipElement", void 0);

    _defineProperty(this, "_textInput", void 0);

    _defineProperty(this, "_container", void 0);

    _defineProperty(this, "_color", void 0);

    _defineProperty(this, "_selection", void 0);

    _defineProperty(this, "_cursor", void 0);

    _defineProperty(this, "_label", void 0);

    _defineProperty(this, "_margin", void 0);

    _defineProperty(this, "_tooltipTimeout", void 0);

    this._label = label;
    this._textInput = textInput;
    this._color = color;
    this._cursor = null;
    this._selection = null;
    this._rows = [];
    this._container = overlayContainer;
    options = options || {};
    this._margin = options.margin || 5;
    this._tooltipTimeout = null;
    this._cursorElement = this._container.ownerDocument.createElement("div");
    this._cursorElement.className = "collaborator-cursor";
    this._cursorElement.style.backgroundColor = this._color;
    this._tooltipElement = this._container.ownerDocument.createElement("div");
    this._tooltipElement.innerHTML = label;
    this._tooltipElement.className = "collaborator-cursor-tooltip";
    this._tooltipElement.style.backgroundColor = this._color;
    this.hideCursorTooltip();
    this.refresh();
  }

  _createClass(CollaboratorSelection, [{
    key: "showSelection",
    value: function showSelection() {
      this._rows.forEach(function (row) {
        row.element.style.visibility = "visible";
      });
    }
  }, {
    key: "hideSelection",
    value: function hideSelection() {
      this._rows.forEach(function (row) {
        row.element.style.visibility = "hidden";
      });
    }
  }, {
    key: "showCursor",
    value: function showCursor() {
      this._cursorElement.style.visibility = "visible";
    }
  }, {
    key: "hideCursor",
    value: function hideCursor() {
      this._cursorElement.style.visibility = "hidden";
    }
  }, {
    key: "showCursorToolTip",
    value: function showCursorToolTip() {
      this._clearToolTipTimeout();

      this._tooltipElement.style.opacity = "1";
    }
  }, {
    key: "flashCursorToolTip",
    value: function flashCursorToolTip(duration) {
      var _this = this;

      this.showCursorToolTip();

      this._clearToolTipTimeout();

      this._tooltipTimeout = setTimeout(function () {
        return _this.hideCursorTooltip();
      }, duration * 1000);
    }
  }, {
    key: "hideCursorTooltip",
    value: function hideCursorTooltip() {
      this._clearToolTipTimeout();

      this._tooltipElement.style.opacity = "0";
    }
  }, {
    key: "_clearToolTipTimeout",
    value: function _clearToolTipTimeout() {
      if (this._tooltipTimeout !== null) {
        clearTimeout(this._tooltipTimeout);
        this._tooltipTimeout = null;
      }
    }
  }, {
    key: "setColor",
    value: function setColor(color) {
      var _this2 = this;

      this._color = color;

      this._rows.forEach(function (row) {
        row.element.style.background = _this2._color;
      });

      this._cursorElement.style.background = this._color;
      this._tooltipElement.style.background = this._color;
    }
  }, {
    key: "setSelection",
    value: function setSelection(selection) {
      if (selection === null) {
        this._cursor = null;
        this._selection = null;
      } else {
        this._cursor = selection.target;

        var _start = Number(selection.anchor);

        var _end = Number(selection.target);

        if (_start > _end) {
          this._selection = {
            start: _end,
            end: _start
          };
        } else {
          this._selection = {
            start: _start,
            end: _end
          };
        }
      }

      this.refresh();
    }
  }, {
    key: "clearSelection",
    value: function clearSelection() {
      this.setSelection(null);
    }
  }, {
    key: "refresh",
    value: function refresh() {
      this._updateCursor();

      this._updateSelection();
    }
  }, {
    key: "_updateCursor",
    value: function _updateCursor() {
      if (this._cursor === null && this._container.contains(this._cursorElement)) {
        this._container.removeChild(this._cursorElement);

        this._container.removeChild(this._tooltipElement);
      } else {
        if (!this._cursorElement.parentElement) {
          this._container.append(this._cursorElement);

          this._container.append(this._tooltipElement);
        }

        var cursorCoords = (0, _textareaCaret.default)(this._textInput, this._cursor);
        this._cursorElement.style.height = cursorCoords.height + "px";
        this._cursorElement.style.top = cursorCoords.top + "px";
        var cursorLeft = cursorCoords.left - this._cursorElement.offsetWidth / 2;
        this._cursorElement.style.left = cursorLeft + "px";
        var toolTipTop = cursorCoords.top - this._tooltipElement.offsetHeight;

        if (toolTipTop + this._container.offsetTop < this._margin) {
          toolTipTop = cursorCoords.top + cursorCoords.height;
        }

        var toolTipLeft = cursorLeft;

        if (toolTipLeft + this._tooltipElement.offsetWidth > this._container.offsetWidth - this._margin) {
          toolTipLeft = cursorLeft + this._cursorElement.offsetWidth - this._tooltipElement.offsetWidth;
        }

        this._tooltipElement.style.top = toolTipTop + "px";
        this._tooltipElement.style.left = toolTipLeft + "px";
      }
    }
  }, {
    key: "_updateSelection",
    value: function _updateSelection() {
      var _this3 = this;

      if (this._selection === null) {
        this._rows.forEach(function (row) {
          return row.element.parentElement.removeChild(row.element);
        });

        this._rows.splice(0, this._rows.length);
      } else {
        var newRows = _SelectionComputer.SelectionComputer.calculateSelection(this._textInput, this._selection.start, this._selection.end); // Adjust size of rows as needed


        var delta = newRows.length - this._rows.length;

        if (delta > 0) {
          if (this._rows.length === 0 || this._rowsEqual(newRows[0], this._rows[0].rowData)) {
            this._addNewRows(delta, true);
          } else {
            this._addNewRows(delta, false);
          }
        } else if (delta < 0) {
          var removed = null;

          if (this._rowsEqual(newRows[0], this._rows[0].rowData)) {
            // Take from the target.
            removed = this._rows.splice(this._rows.length - 1 + delta, delta * -1);
          } else {
            removed = this._rows.splice(0, delta * -1);
          }

          removed.forEach(function (row) {
            return row.element.parentElement.removeChild(row.element);
          });
        } // Now compare each row and see if we need an update.


        newRows.forEach(function (newRowData, index) {
          var row = _this3._rows[index];

          _this3._updateRow(newRowData, row);
        });
      }
    }
  }, {
    key: "_addNewRows",
    value: function _addNewRows(count, append) {
      for (var i = 0; i < count; i++) {
        var _element = this._container.ownerDocument.createElement("div");

        _element.style.position = "absolute";
        _element.style.backgroundColor = this._color;
        _element.style.opacity = "0.25";

        this._container.append(_element);

        var _rowData = {
          height: 0,
          width: 0,
          top: 0,
          left: 0
        };
        var newRow = {
          element: _element,
          rowData: _rowData
        };

        if (append) {
          this._rows.push(newRow);
        } else {
          this._rows.unshift(newRow);
        }
      }
    }
  }, {
    key: "_rowsEqual",
    value: function _rowsEqual(a, b) {
      return a.height === b.height && a.width === b.width && a.top === b.top && a.left === b.left;
    }
  }, {
    key: "_updateRow",
    value: function _updateRow(newRowData, row) {
      if (newRowData.height !== row.rowData.height) {
        row.rowData.height = newRowData.height;
        row.element.style.height = "".concat(newRowData.height, "px");
      }

      if (newRowData.width !== row.rowData.width) {
        row.rowData.width = newRowData.width;
        row.element.style.width = "".concat(newRowData.width, "px");
      }

      if (newRowData.top !== row.rowData.top) {
        row.rowData.top = newRowData.top;
        row.element.style.top = "".concat(newRowData.top, "px");
      }

      if (newRowData.left !== row.rowData.left) {
        row.rowData.left = newRowData.left;
        row.element.style.left = "".concat(newRowData.left, "px");
      }
    }
  }]);

  return CollaboratorSelection;
}();

exports.CollaboratorSelection = CollaboratorSelection;
},{"./SelectionComputer":6,"textarea-caret":38}],6:[function(require,module,exports){
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.SelectionComputer = void 0;

var _textareaCaret = _interopRequireDefault(require("textarea-caret"));

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _toConsumableArray(arr) { return _arrayWithoutHoles(arr) || _iterableToArray(arr) || _nonIterableSpread(); }

function _nonIterableSpread() { throw new TypeError("Invalid attempt to spread non-iterable instance"); }

function _iterableToArray(iter) { if (Symbol.iterator in Object(iter) || Object.prototype.toString.call(iter) === "[object Arguments]") return Array.from(iter); }

function _arrayWithoutHoles(arr) { if (Array.isArray(arr)) { for (var i = 0, arr2 = new Array(arr.length); i < arr.length; i++) { arr2[i] = arr[i]; } return arr2; } }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } }

function _createClass(Constructor, protoProps, staticProps) { if (protoProps) _defineProperties(Constructor.prototype, protoProps); if (staticProps) _defineProperties(Constructor, staticProps); return Constructor; }

function _defineProperty(obj, key, value) { if (key in obj) { Object.defineProperty(obj, key, { value: value, enumerable: true, configurable: true, writable: true }); } else { obj[key] = value; } return obj; }

/*
 * Computes the dimensions of the text selection.  Each line in the textarea has its own
 * selection dimensions, which are intended to be used to render a div with the specified
 * position, dimensions and background color.
 *
 * This has only been tested on a textarea, but should be able to be adapted to be used
 * in other HTML form elements.
 *
 * TODO unit test, this is pretty brittle
 */
var SelectionComputer =
/*#__PURE__*/
function () {
  _createClass(SelectionComputer, null, [{
    key: "calculateSelection",
    value: function calculateSelection(element, start, end) {
      var computer = new SelectionComputer(element, start, end);
      return computer.selectionRows;
    } // The calculated styles for each row.

  }]);

  function SelectionComputer(element, start, end) {
    _classCallCheck(this, SelectionComputer);

    this.element = element;
    this.start = start;
    this.end = end;

    _defineProperty(this, "selectionRows", void 0);

    _defineProperty(this, "startCoordinates", void 0);

    _defineProperty(this, "endCoordinates", void 0);

    _defineProperty(this, "lineHeight", void 0);

    _defineProperty(this, "elementPaddingLeft", void 0);

    _defineProperty(this, "elementPaddingRight", void 0);

    _defineProperty(this, "elementPaddingX", void 0);

    this.startCoordinates = (0, _textareaCaret.default)(element, start);
    this.endCoordinates = (0, _textareaCaret.default)(element, end);
    this.lineHeight = this.startCoordinates.height;
    this.elementPaddingLeft = parseFloat(element.style.paddingLeft) || 0;
    this.elementPaddingRight = parseFloat(element.style.paddingRight) || 0;
    this.elementPaddingX = this.elementPaddingLeft + this.elementPaddingRight;
    this.selectionRows = []; // Figure out whether this selection spans more than one "row", as determined by
    // the presence of a newline character. The computation of single line selections
    // is slightly different than for multiple line selections.

    var selectedText = element.value.substr(start, end - start);

    if (selectedText.indexOf('\n') < 0) {
      this.appendSingleLineSelection(this.startCoordinates, this.endCoordinates);
    } else {
      this.buildMultiRowSelection();
    }
  }

  _createClass(SelectionComputer, [{
    key: "appendSingleLineSelection",
    value: function appendSingleLineSelection(startCoordinates, endCoordinates) {
      var _this$selectionRows;

      (_this$selectionRows = this.selectionRows).push.apply(_this$selectionRows, _toConsumableArray(this.buildSingleLineSelection(startCoordinates, endCoordinates)));
    }
  }, {
    key: "buildSingleLineSelection",
    value: function buildSingleLineSelection(startCoordinates, endCoordinates) {
      // does this line wrap? If not, we can just calculate the row selection based on
      // the provided coordinates.
      if (startCoordinates.top === endCoordinates.top) {
        return [{
          width: endCoordinates.left - startCoordinates.left,
          top: startCoordinates.top,
          left: startCoordinates.left,
          height: this.lineHeight
        }];
      } else {
        return this.buildWrappedLineSelections(startCoordinates, endCoordinates);
      }
    }
    /**
     * Wrapped lines have a more complex computation since we have to create multiple
     * rows.
     *
     * @param startCoordinates
     * @param endCoordinates
     */

  }, {
    key: "buildWrappedLineSelections",
    value: function buildWrappedLineSelections(startCoordinates, endCoordinates) {
      var rows = []; // the first line just goes the full width of the textarea

      rows.push({
        width: this.element.scrollWidth - this.elementPaddingRight - startCoordinates.left,
        top: startCoordinates.top,
        left: startCoordinates.left,
        height: this.lineHeight
      }); // If the selection contains one or more rows that span the entire textarea,
      // calculate a single selection element, which may actually span multiple rows,
      // but fills the width of the textarea.

      if (endCoordinates.top > startCoordinates.top + this.lineHeight) {
        rows.push({
          width: this.element.scrollWidth - this.elementPaddingX,
          left: this.elementPaddingLeft,
          top: startCoordinates.top + this.lineHeight,
          height: endCoordinates.top - startCoordinates.top - this.lineHeight
        });
      } // The last line starts at the left edge of the textarea and doesn't span the
      // entire width of the textarea


      rows.push({
        width: endCoordinates.left - this.elementPaddingLeft,
        top: endCoordinates.top,
        left: this.elementPaddingLeft,
        height: this.lineHeight
      });
      return rows;
    }
  }, {
    key: "buildMultiRowSelection",
    value: function buildMultiRowSelection() {
      var currentCoordinates = this.startCoordinates;
      var currentIndex = +this.start; // build one or more selection elements for each row (as determined by newline
      // characters)

      while (currentCoordinates.top < this.endCoordinates.top) {
        var nextLineBreakPosition = this.element.value.indexOf('\n', currentIndex);
        var endOfLinePosition = this.element.value.length;

        if (nextLineBreakPosition >= 0) {
          endOfLinePosition = nextLineBreakPosition;
        }

        if (endOfLinePosition > this.end) {
          endOfLinePosition = this.end;
        }

        var endOfLineCoordinates = (0, _textareaCaret.default)(this.element, endOfLinePosition); // console.log('target of line position', endOfLinePosition, 'coords', endOfLineCoordinates);
        // This "single line" may actually wrap multiple lines of the textarea

        this.appendSingleLineSelection(currentCoordinates, endOfLineCoordinates);
        currentIndex = endOfLinePosition + 1;
        currentCoordinates = (0, _textareaCaret.default)(this.element, currentIndex);
      }

      if (currentIndex < this.end) {
        var lastLine = {
          width: this.endCoordinates.left - currentCoordinates.left,
          top: currentCoordinates.top,
          left: currentCoordinates.left,
          height: this.lineHeight
        };
        this.selectionRows.push(lastLine);
      }
    }
  }]);

  return SelectionComputer;
}();

exports.SelectionComputer = SelectionComputer;
},{"textarea-caret":38}],7:[function(require,module,exports){
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.TextInputManager = void 0;

var _stringChangeDetector = _interopRequireDefault(require("@convergence/string-change-detector"));

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } }

function _createClass(Constructor, protoProps, staticProps) { if (protoProps) _defineProperties(Constructor.prototype, protoProps); if (staticProps) _defineProperties(Constructor, staticProps); return Constructor; }

function _defineProperty(obj, key, value) { if (key in obj) { Object.defineProperty(obj, key, { value: value, enumerable: true, configurable: true, writable: true }); } else { obj[key] = value; } return obj; }

var TextInputManager =
/*#__PURE__*/
function () {
  /**
   *
   * @param options
   */
  function TextInputManager(options) {
    var _this = this;

    _classCallCheck(this, TextInputManager);

    _defineProperty(this, "_control", void 0);

    _defineProperty(this, "_onLocalInsert", void 0);

    _defineProperty(this, "_onLocalDelete", void 0);

    _defineProperty(this, "_changeDetector", void 0);

    _defineProperty(this, "_onLocalInput", function () {
      _this._changeDetector.processNewValue(_this._control.value);
    });

    this._control = options.control;
    this._onLocalInsert = options.onInsert;
    this._onLocalDelete = options.onDelete;
    this._changeDetector = null;
    this.bind();
  }

  _createClass(TextInputManager, [{
    key: "bind",
    value: function bind() {
      this._changeDetector = new _stringChangeDetector.default({
        value: this._control.value,
        onInsert: this._onLocalInsert,
        onRemove: this._onLocalDelete
      });

      this._control.addEventListener("input", this._onLocalInput);
    }
  }, {
    key: "unbind",
    value: function unbind() {
      this._control.removeEventListener("input", this._onLocalInput);

      this._changeDetector = null;
    }
  }, {
    key: "insertText",
    value: function insertText(index, value) {
      this._assertBound();

      var _this$_getSelection = this._getSelection(),
          start = _this$_getSelection.start,
          end = _this$_getSelection.end;

      var xStart = TextInputManager._transformIndexOnInsert(start, index, value);

      var xEnd = TextInputManager._transformIndexOnInsert(end, index, value);

      this._changeDetector.insertText(index, value);

      this._updateControl();

      this._setTextSelection(xStart, xEnd);
    }
  }, {
    key: "deleteText",
    value: function deleteText(index, length) {
      this._assertBound();

      var _this$_getSelection2 = this._getSelection(),
          start = _this$_getSelection2.start,
          end = _this$_getSelection2.end;

      var xStart = TextInputManager._transformIndexOnDelete(start, index, length);

      var xEnd = TextInputManager._transformIndexOnDelete(end, index, length);

      this._changeDetector.removeText(index, length);

      this._updateControl();

      this._setTextSelection(xStart, xEnd);
    }
  }, {
    key: "setText",
    value: function setText(value) {
      this._assertBound();

      this._changeDetector.setValue(value);

      this._updateControl();

      this._setTextSelection(0, 0);
    }
  }, {
    key: "getText",
    value: function getText() {
      return this._control.value;
    }
  }, {
    key: "_updateControl",
    value: function _updateControl() {
      this._control.value = this._changeDetector.getValue();
    }
  }, {
    key: "_assertBound",
    value: function _assertBound() {
      if (this._changeDetector === null) {
        throw new Error("The TextInputManager is not bound.");
      }
    }
  }, {
    key: "_getSelection",
    value: function _getSelection() {
      return {
        'start': this._control.selectionStart,
        'end': this._control.selectionEnd
      };
    }
  }, {
    key: "_setTextSelection",
    value: function _setTextSelection(start, end) {
      // this._control.focus();
      this._control.setSelectionRange(start, end);
    }
  }], [{
    key: "_transformIndexOnInsert",
    value: function _transformIndexOnInsert(index, insertIndex, value) {
      if (insertIndex <= index) {
        return index + value.length;
      }

      return index;
    }
  }, {
    key: "_transformIndexOnDelete",
    value: function _transformIndexOnDelete(index, deleteIndex, length) {
      if (index > deleteIndex) {
        return index - Math.min(index - deleteIndex, length);
      }

      return index;
    }
  }]);

  return TextInputManager;
}();

exports.TextInputManager = TextInputManager;
},{"@convergence/string-change-detector":10}],8:[function(require,module,exports){
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _CollaborativeSelectionManager = require("./CollaborativeSelectionManager");

Object.keys(_CollaborativeSelectionManager).forEach(function (key) {
  if (key === "default" || key === "__esModule") return;
  Object.defineProperty(exports, key, {
    enumerable: true,
    get: function get() {
      return _CollaborativeSelectionManager[key];
    }
  });
});

var _CollaboratorSelection = require("./CollaboratorSelection");

Object.keys(_CollaboratorSelection).forEach(function (key) {
  if (key === "default" || key === "__esModule") return;
  Object.defineProperty(exports, key, {
    enumerable: true,
    get: function get() {
      return _CollaboratorSelection[key];
    }
  });
});

var _TextInputManager = require("./TextInputManager");

Object.keys(_TextInputManager).forEach(function (key) {
  if (key === "default" || key === "__esModule") return;
  Object.defineProperty(exports, key, {
    enumerable: true,
    get: function get() {
      return _TextInputManager[key];
    }
  });
});

var _CollaborativeTextEditor = require("./CollaborativeTextEditor");

Object.keys(_CollaborativeTextEditor).forEach(function (key) {
  if (key === "default" || key === "__esModule") return;
  Object.defineProperty(exports, key, {
    enumerable: true,
    get: function get() {
      return _CollaborativeTextEditor[key];
    }
  });
});
},{"./CollaborativeSelectionManager":3,"./CollaborativeTextEditor":4,"./CollaboratorSelection":5,"./TextInputManager":7}],9:[function(require,module,exports){
/**!
© 2017 Convergence Labs, Inc.
@version 0.1.8
@license MIT
*/
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

var StringChangeDetector = exports.StringChangeDetector = function () {
  function StringChangeDetector(options) {
    _classCallCheck(this, StringChangeDetector);

    if (!options) {
      throw new Error("options must be defined");
    }

    if (typeof options.onInsert !== "function") {
      throw new Error("options.onInsert must be a function");
    }

    if (typeof options.onRemove !== "function") {
      throw new Error("options.onRemove must be a function");
    }

    if (typeof options.value !== "string") {
      throw new Error("options.value must be a string");
    }

    this._onInsert = options.onInsert;
    this._onRemove = options.onRemove;
    this._value = options.value;
  }

  /**
   * Inserts a string into the current value at the specified index.
   *
   * @param index {number}
   *    The index in the string to insert into.
   * @param value {string}
   *   The value to insert into the string.
   */


  _createClass(StringChangeDetector, [{
    key: "insertText",
    value: function insertText(index, value) {
      var oldVal = this._value;
      var newVal = oldVal.substring(0, index) + value + oldVal.substring(index, oldVal.length);
      this.setValue(newVal);
    }

    /**
     * Removes a specified number of characters from the current string at
     * a specific location.
     *
     * @param index {number}
     *    The index in the string to remove characters.
     * @param length {number}
     *   The number of characters to remove.
     */

  }, {
    key: "removeText",
    value: function removeText(index, length) {
      var oldVal = this._value;
      var newVal = oldVal.substring(0, index) + oldVal.substring(index + length, oldVal.length);
      this.setValue(newVal);
    }

    /**
     * Sets the current value of the string.
     *
     * @param value {string}
     *   The new value of the string.
     */

  }, {
    key: "setValue",
    value: function setValue(value) {
      this._value = value;
    }

    /**
     * Gets the current value of the string.
     *
     * @returns {string}
     */

  }, {
    key: "getValue",
    value: function getValue() {
      return this._value;
    }

    /**
     * Process the new value of the string after a single edit.
     *
     * @param newValue {string}
     *   The new value to process.
     */

  }, {
    key: "processNewValue",
    value: function processNewValue(newValue) {
      var commonEnd = 0;
      var commonStart = 0;

      if (this._value === newValue) {
        return;
      }

      while (this._value.charAt(commonStart) === newValue.charAt(commonStart)) {
        commonStart++;
      }

      while (this._value.charAt(this._value.length - 1 - commonEnd) === newValue.charAt(newValue.length - 1 - commonEnd) && commonEnd + commonStart < this._value.length && commonEnd + commonStart < newValue.length) {
        commonEnd++;
      }

      // Characters were removed.
      if (this._value.length !== commonStart + commonEnd) {
        if (this._onRemove) {
          this._onRemove(commonStart, this._value.length - commonStart - commonEnd);
        }
      }

      // Characters were added
      if (newValue.length !== commonStart + commonEnd) {
        if (this._onInsert) {
          this._onInsert(commonStart, newValue.slice(commonStart, newValue.length - commonEnd));
        }
      }

      this._value = newValue;
    }
  }]);

  return StringChangeDetector;
}();


},{}],10:[function(require,module,exports){
/**!
© 2017 Convergence Labs, Inc.
@version 0.1.8
@license MIT
*/
'use strict';

module.exports = require('./StringChangeDetector').StringChangeDetector;


},{"./StringChangeDetector":9}],11:[function(require,module,exports){
// These methods let you build a transform function from a transformComponent
// function for OT types like JSON0 in which operations are lists of components
// and transforming them requires N^2 work. I find it kind of nasty that I need
// this, but I'm not really sure what a better solution is. Maybe I should do
// this automatically to types that don't have a compose function defined.

// Add transform and transformX functions for an OT type which has
// transformComponent defined.  transformComponent(destination array,
// component, other component, side)
module.exports = bootstrapTransform
function bootstrapTransform(type, transformComponent, checkValidOp, append) {
  var transformComponentX = function(left, right, destLeft, destRight) {
    transformComponent(destLeft, left, right, 'left');
    transformComponent(destRight, right, left, 'right');
  };

  var transformX = type.transformX = function(leftOp, rightOp) {
    checkValidOp(leftOp);
    checkValidOp(rightOp);
    var newRightOp = [];

    for (var i = 0; i < rightOp.length; i++) {
      var rightComponent = rightOp[i];

      // Generate newLeftOp by composing leftOp by rightComponent
      var newLeftOp = [];
      var k = 0;
      while (k < leftOp.length) {
        var nextC = [];
        transformComponentX(leftOp[k], rightComponent, newLeftOp, nextC);
        k++;

        if (nextC.length === 1) {
          rightComponent = nextC[0];
        } else if (nextC.length === 0) {
          for (var j = k; j < leftOp.length; j++) {
            append(newLeftOp, leftOp[j]);
          }
          rightComponent = null;
          break;
        } else {
          // Recurse.
          var pair = transformX(leftOp.slice(k), nextC);
          for (var l = 0; l < pair[0].length; l++) {
            append(newLeftOp, pair[0][l]);
          }
          for (var r = 0; r < pair[1].length; r++) {
            append(newRightOp, pair[1][r]);
          }
          rightComponent = null;
          break;
        }
      }

      if (rightComponent != null) {
        append(newRightOp, rightComponent);
      }
      leftOp = newLeftOp;
    }
    return [leftOp, newRightOp];
  };

  // Transforms op with specified type ('left' or 'right') by otherOp.
  type.transform = function(op, otherOp, type) {
    if (!(type === 'left' || type === 'right'))
      throw new Error("type must be 'left' or 'right'");

    if (otherOp.length === 0) return op;

    if (op.length === 1 && otherOp.length === 1)
      return transformComponent([], op[0], otherOp[0], type);

    if (type === 'left')
      return transformX(op, otherOp)[0];
    else
      return transformX(otherOp, op)[1];
  };
};

},{}],12:[function(require,module,exports){
// Only the JSON type is exported, because the text type is deprecated
// otherwise. (If you want to use it somewhere, you're welcome to pull it out
// into a separate module that json0 can depend on).

module.exports = {
  type: require('./json0')
};

},{"./json0":13}],13:[function(require,module,exports){
/*
 This is the implementation of the JSON OT type.

 Spec is here: https://github.com/josephg/ShareJS/wiki/JSON-Operations

 Note: This is being made obsolete. It will soon be replaced by the JSON2 type.
*/

/**
 * UTILITY FUNCTIONS
 */

/**
 * Checks if the passed object is an Array instance. Can't use Array.isArray
 * yet because its not supported on IE8.
 *
 * @param obj
 * @returns {boolean}
 */
var isArray = function(obj) {
  return Object.prototype.toString.call(obj) == '[object Array]';
};

/**
 * Checks if the passed object is an Object instance.
 * No function call (fast) version
 *
 * @param obj
 * @returns {boolean}
 */
var isObject = function(obj) {
  return (!!obj) && (obj.constructor === Object);
};

/**
 * Clones the passed object using JSON serialization (which is slow).
 *
 * hax, copied from test/types/json. Apparently this is still the fastest way
 * to deep clone an object, assuming we have browser support for JSON.  @see
 * http://jsperf.com/cloning-an-object/12
 */
var clone = function(o) {
  return JSON.parse(JSON.stringify(o));
};

/**
 * JSON OT Type
 * @type {*}
 */
var json = {
  name: 'json0',
  uri: 'http://sharejs.org/types/JSONv0'
};

// You can register another OT type as a subtype in a JSON document using
// the following function. This allows another type to handle certain
// operations instead of the builtin JSON type.
var subtypes = {};
json.registerSubtype = function(subtype) {
  subtypes[subtype.name] = subtype;
};

json.create = function(data) {
  // Null instead of undefined if you don't pass an argument.
  return data === undefined ? null : clone(data);
};

json.invertComponent = function(c) {
  var c_ = {p: c.p};

  // handle subtype ops
  if (c.t && subtypes[c.t]) {
    c_.t = c.t;
    c_.o = subtypes[c.t].invert(c.o);
  }

  if (c.si !== void 0) c_.sd = c.si;
  if (c.sd !== void 0) c_.si = c.sd;
  if (c.oi !== void 0) c_.od = c.oi;
  if (c.od !== void 0) c_.oi = c.od;
  if (c.li !== void 0) c_.ld = c.li;
  if (c.ld !== void 0) c_.li = c.ld;
  if (c.na !== void 0) c_.na = -c.na;

  if (c.lm !== void 0) {
    c_.lm = c.p[c.p.length-1];
    c_.p = c.p.slice(0,c.p.length-1).concat([c.lm]);
  }

  return c_;
};

json.invert = function(op) {
  var op_ = op.slice().reverse();
  var iop = [];
  for (var i = 0; i < op_.length; i++) {
    iop.push(json.invertComponent(op_[i]));
  }
  return iop;
};

json.checkValidOp = function(op) {
  for (var i = 0; i < op.length; i++) {
    if (!isArray(op[i].p)) throw new Error('Missing path');
  }
};

json.checkList = function(elem) {
  if (!isArray(elem))
    throw new Error('Referenced element not a list');
};

json.checkObj = function(elem) {
  if (!isObject(elem)) {
    throw new Error("Referenced element not an object (it was " + JSON.stringify(elem) + ")");
  }
};

// helper functions to convert old string ops to and from subtype ops
function convertFromText(c) {
  c.t = 'text0';
  var o = {p: c.p.pop()};
  if (c.si != null) o.i = c.si;
  if (c.sd != null) o.d = c.sd;
  c.o = [o];
}

function convertToText(c) {
  c.p.push(c.o[0].p);
  if (c.o[0].i != null) c.si = c.o[0].i;
  if (c.o[0].d != null) c.sd = c.o[0].d;
  delete c.t;
  delete c.o;
}

json.apply = function(snapshot, op) {
  json.checkValidOp(op);

  op = clone(op);

  var container = {
    data: snapshot
  };

  for (var i = 0; i < op.length; i++) {
    var c = op[i];

    // convert old string ops to use subtype for backwards compatibility
    if (c.si != null || c.sd != null)
      convertFromText(c);

    var parent = null;
    var parentKey = null;
    var elem = container;
    var key = 'data';

    for (var j = 0; j < c.p.length; j++) {
      var p = c.p[j];

      parent = elem;
      parentKey = key;
      elem = elem[key];
      key = p;

      if (parent == null)
        throw new Error('Path invalid');
    }

    // handle subtype ops
    if (c.t && c.o !== void 0 && subtypes[c.t]) {
      elem[key] = subtypes[c.t].apply(elem[key], c.o);

    // Number add
    } else if (c.na !== void 0) {
      if (typeof elem[key] != 'number')
        throw new Error('Referenced element not a number');

      elem[key] += c.na;
    }

    // List replace
    else if (c.li !== void 0 && c.ld !== void 0) {
      json.checkList(elem);
      // Should check the list element matches c.ld
      elem[key] = c.li;
    }

    // List insert
    else if (c.li !== void 0) {
      json.checkList(elem);
      elem.splice(key,0, c.li);
    }

    // List delete
    else if (c.ld !== void 0) {
      json.checkList(elem);
      // Should check the list element matches c.ld here too.
      elem.splice(key,1);
    }

    // List move
    else if (c.lm !== void 0) {
      json.checkList(elem);
      if (c.lm != key) {
        var e = elem[key];
        // Remove it...
        elem.splice(key,1);
        // And insert it back.
        elem.splice(c.lm,0,e);
      }
    }

    // Object insert / replace
    else if (c.oi !== void 0) {
      json.checkObj(elem);

      // Should check that elem[key] == c.od
      elem[key] = c.oi;
    }

    // Object delete
    else if (c.od !== void 0) {
      json.checkObj(elem);

      // Should check that elem[key] == c.od
      delete elem[key];
    }

    else {
      throw new Error('invalid / missing instruction in op');
    }
  }

  return container.data;
};

// Helper to break an operation up into a bunch of small ops.
json.shatter = function(op) {
  var results = [];
  for (var i = 0; i < op.length; i++) {
    results.push([op[i]]);
  }
  return results;
};

// Helper for incrementally applying an operation to a snapshot. Calls yield
// after each op component has been applied.
json.incrementalApply = function(snapshot, op, _yield) {
  for (var i = 0; i < op.length; i++) {
    var smallOp = [op[i]];
    snapshot = json.apply(snapshot, smallOp);
    // I'd just call this yield, but thats a reserved keyword. Bah!
    _yield(smallOp, snapshot);
  }

  return snapshot;
};

// Checks if two paths, p1 and p2 match.
var pathMatches = json.pathMatches = function(p1, p2, ignoreLast) {
  if (p1.length != p2.length)
    return false;

  for (var i = 0; i < p1.length; i++) {
    if (p1[i] !== p2[i] && (!ignoreLast || i !== p1.length - 1))
      return false;
  }

  return true;
};

json.append = function(dest,c) {
  c = clone(c);

  if (dest.length === 0) {
    dest.push(c);
    return;
  }

  var last = dest[dest.length - 1];

  // convert old string ops to use subtype for backwards compatibility
  if ((c.si != null || c.sd != null) && (last.si != null || last.sd != null)) {
    convertFromText(c);
    convertFromText(last);
  }

  if (pathMatches(c.p, last.p)) {
    // handle subtype ops
    if (c.t && last.t && c.t === last.t && subtypes[c.t]) {
      last.o = subtypes[c.t].compose(last.o, c.o);

      // convert back to old string ops
      if (c.si != null || c.sd != null) {
        var p = c.p;
        for (var i = 0; i < last.o.length - 1; i++) {
          c.o = [last.o.pop()];
          c.p = p.slice();
          convertToText(c);
          dest.push(c);
        }

        convertToText(last);
      }
    } else if (last.na != null && c.na != null) {
      dest[dest.length - 1] = {p: last.p, na: last.na + c.na};
    } else if (last.li !== undefined && c.li === undefined && c.ld === last.li) {
      // insert immediately followed by delete becomes a noop.
      if (last.ld !== undefined) {
        // leave the delete part of the replace
        delete last.li;
      } else {
        dest.pop();
      }
    } else if (last.od !== undefined && last.oi === undefined && c.oi !== undefined && c.od === undefined) {
      last.oi = c.oi;
    } else if (last.oi !== undefined && c.od !== undefined) {
      // The last path component inserted something that the new component deletes (or replaces).
      // Just merge them.
      if (c.oi !== undefined) {
        last.oi = c.oi;
      } else if (last.od !== undefined) {
        delete last.oi;
      } else {
        // An insert directly followed by a delete turns into a no-op and can be removed.
        dest.pop();
      }
    } else if (c.lm !== undefined && c.p[c.p.length - 1] === c.lm) {
      // don't do anything
    } else {
      dest.push(c);
    }
  } else {
    // convert string ops back
    if ((c.si != null || c.sd != null) && (last.si != null || last.sd != null)) {
      convertToText(c);
      convertToText(last);
    }

    dest.push(c);
  }
};

json.compose = function(op1,op2) {
  json.checkValidOp(op1);
  json.checkValidOp(op2);

  var newOp = clone(op1);

  for (var i = 0; i < op2.length; i++) {
    json.append(newOp,op2[i]);
  }

  return newOp;
};

json.normalize = function(op) {
  var newOp = [];

  op = isArray(op) ? op : [op];

  for (var i = 0; i < op.length; i++) {
    var c = op[i];
    if (c.p == null) c.p = [];

    json.append(newOp,c);
  }

  return newOp;
};

// Returns the common length of the paths of ops a and b
json.commonLengthForOps = function(a, b) {
  var alen = a.p.length;
  var blen = b.p.length;
  if (a.na != null || a.t)
    alen++;

  if (b.na != null || b.t)
    blen++;

  if (alen === 0) return -1;
  if (blen === 0) return null;

  alen--;
  blen--;

  for (var i = 0; i < alen; i++) {
    var p = a.p[i];
    if (i >= blen || p !== b.p[i])
      return null;
  }

  return alen;
};

// Returns true if an op can affect the given path
json.canOpAffectPath = function(op, path) {
  return json.commonLengthForOps({p:path}, op) != null;
};

// transform c so it applies to a document with otherC applied.
json.transformComponent = function(dest, c, otherC, type) {
  c = clone(c);

  var common = json.commonLengthForOps(otherC, c);
  var common2 = json.commonLengthForOps(c, otherC);
  var cplength = c.p.length;
  var otherCplength = otherC.p.length;

  if (c.na != null || c.t)
    cplength++;

  if (otherC.na != null || otherC.t)
    otherCplength++;

  // if c is deleting something, and that thing is changed by otherC, we need to
  // update c to reflect that change for invertibility.
  if (common2 != null && otherCplength > cplength && c.p[common2] == otherC.p[common2]) {
    if (c.ld !== void 0) {
      var oc = clone(otherC);
      oc.p = oc.p.slice(cplength);
      c.ld = json.apply(clone(c.ld),[oc]);
    } else if (c.od !== void 0) {
      var oc = clone(otherC);
      oc.p = oc.p.slice(cplength);
      c.od = json.apply(clone(c.od),[oc]);
    }
  }

  if (common != null) {
    var commonOperand = cplength == otherCplength;

    // backward compatibility for old string ops
    var oc = otherC;
    if ((c.si != null || c.sd != null) && (otherC.si != null || otherC.sd != null)) {
      convertFromText(c);
      oc = clone(otherC);
      convertFromText(oc);
    }

    // handle subtype ops
    if (oc.t && subtypes[oc.t]) {
      if (c.t && c.t === oc.t) {
        var res = subtypes[c.t].transform(c.o, oc.o, type);

        // convert back to old string ops
        if (c.si != null || c.sd != null) {
          var p = c.p;
          for (var i = 0; i < res.length; i++) {
            c.o = [res[i]];
            c.p = p.slice();
            convertToText(c);
            json.append(dest, c);
          }
        } else if (!isArray(res) || res.length > 0) {
          c.o = res;
          json.append(dest, c);
        }

        return dest;
      }
    }

    // transform based on otherC
    else if (otherC.na !== void 0) {
      // this case is handled below
    } else if (otherC.li !== void 0 && otherC.ld !== void 0) {
      if (otherC.p[common] === c.p[common]) {
        // noop

        if (!commonOperand) {
          return dest;
        } else if (c.ld !== void 0) {
          // we're trying to delete the same element, -> noop
          if (c.li !== void 0 && type === 'left') {
            // we're both replacing one element with another. only one can survive
            c.ld = clone(otherC.li);
          } else {
            return dest;
          }
        }
      }
    } else if (otherC.li !== void 0) {
      if (c.li !== void 0 && c.ld === undefined && commonOperand && c.p[common] === otherC.p[common]) {
        // in li vs. li, left wins.
        if (type === 'right')
          c.p[common]++;
      } else if (otherC.p[common] <= c.p[common]) {
        c.p[common]++;
      }

      if (c.lm !== void 0) {
        if (commonOperand) {
          // otherC edits the same list we edit
          if (otherC.p[common] <= c.lm)
            c.lm++;
          // changing c.from is handled above.
        }
      }
    } else if (otherC.ld !== void 0) {
      if (c.lm !== void 0) {
        if (commonOperand) {
          if (otherC.p[common] === c.p[common]) {
            // they deleted the thing we're trying to move
            return dest;
          }
          // otherC edits the same list we edit
          var p = otherC.p[common];
          var from = c.p[common];
          var to = c.lm;
          if (p < to || (p === to && from < to))
            c.lm--;

        }
      }

      if (otherC.p[common] < c.p[common]) {
        c.p[common]--;
      } else if (otherC.p[common] === c.p[common]) {
        if (otherCplength < cplength) {
          // we're below the deleted element, so -> noop
          return dest;
        } else if (c.ld !== void 0) {
          if (c.li !== void 0) {
            // we're replacing, they're deleting. we become an insert.
            delete c.ld;
          } else {
            // we're trying to delete the same element, -> noop
            return dest;
          }
        }
      }

    } else if (otherC.lm !== void 0) {
      if (c.lm !== void 0 && cplength === otherCplength) {
        // lm vs lm, here we go!
        var from = c.p[common];
        var to = c.lm;
        var otherFrom = otherC.p[common];
        var otherTo = otherC.lm;
        if (otherFrom !== otherTo) {
          // if otherFrom == otherTo, we don't need to change our op.

          // where did my thing go?
          if (from === otherFrom) {
            // they moved it! tie break.
            if (type === 'left') {
              c.p[common] = otherTo;
              if (from === to) // ugh
                c.lm = otherTo;
            } else {
              return dest;
            }
          } else {
            // they moved around it
            if (from > otherFrom) c.p[common]--;
            if (from > otherTo) c.p[common]++;
            else if (from === otherTo) {
              if (otherFrom > otherTo) {
                c.p[common]++;
                if (from === to) // ugh, again
                  c.lm++;
              }
            }

            // step 2: where am i going to put it?
            if (to > otherFrom) {
              c.lm--;
            } else if (to === otherFrom) {
              if (to > from)
                c.lm--;
            }
            if (to > otherTo) {
              c.lm++;
            } else if (to === otherTo) {
              // if we're both moving in the same direction, tie break
              if ((otherTo > otherFrom && to > from) ||
                  (otherTo < otherFrom && to < from)) {
                if (type === 'right') c.lm++;
              } else {
                if (to > from) c.lm++;
                else if (to === otherFrom) c.lm--;
              }
            }
          }
        }
      } else if (c.li !== void 0 && c.ld === undefined && commonOperand) {
        // li
        var from = otherC.p[common];
        var to = otherC.lm;
        p = c.p[common];
        if (p > from) c.p[common]--;
        if (p > to) c.p[common]++;
      } else {
        // ld, ld+li, si, sd, na, oi, od, oi+od, any li on an element beneath
        // the lm
        //
        // i.e. things care about where their item is after the move.
        var from = otherC.p[common];
        var to = otherC.lm;
        p = c.p[common];
        if (p === from) {
          c.p[common] = to;
        } else {
          if (p > from) c.p[common]--;
          if (p > to) c.p[common]++;
          else if (p === to && from > to) c.p[common]++;
        }
      }
    }
    else if (otherC.oi !== void 0 && otherC.od !== void 0) {
      if (c.p[common] === otherC.p[common]) {
        if (c.oi !== void 0 && commonOperand) {
          // we inserted where someone else replaced
          if (type === 'right') {
            // left wins
            return dest;
          } else {
            // we win, make our op replace what they inserted
            c.od = otherC.oi;
          }
        } else {
          // -> noop if the other component is deleting the same object (or any parent)
          return dest;
        }
      }
    } else if (otherC.oi !== void 0) {
      if (c.oi !== void 0 && c.p[common] === otherC.p[common]) {
        // left wins if we try to insert at the same place
        if (type === 'left') {
          json.append(dest,{p: c.p, od:otherC.oi});
        } else {
          return dest;
        }
      }
    } else if (otherC.od !== void 0) {
      if (c.p[common] == otherC.p[common]) {
        if (!commonOperand)
          return dest;
        if (c.oi !== void 0) {
          delete c.od;
        } else {
          return dest;
        }
      }
    }
  }

  json.append(dest,c);
  return dest;
};

json.createPresence = function(presenceData) {
  return presenceData;
};

json.comparePresence = function(pres1, pres2) {
  return JSON.stringify(pres1) === JSON.stringify(pres2);
};

json.transformPresence = function(presence, op, isOwnOp) {
  // Don't transform path-only presence objects.
  if(!presence.t) return presence;

  for (var i = 0; i < op.length; i++) {
    var c = op[i];

    // convert old string ops to use subtype for backwards compatibility
    if (c.si != null || c.sd != null) {
      convertFromText(c);
    }

    // Transform against subtype ops.
    if (c.t && c.t === presence.t && json.pathMatches(c.p, presence.p)) {
      presence = Object.assign({}, presence, {
        s: subtypes[presence.t].transformPresence(presence.s, c.o, isOwnOp)
      });
    }

    // convert back to old string ops
    if (c.t === 'text0') {
      convertToText(c);
    }

    // TODO transform against non-subtype ops.
  };
  return presence;
};

require('./bootstrapTransform')(json, json.transformComponent, json.checkValidOp, json.append);

/**
 * Register a subtype for string operations, using the text0 type.
 */
var text = require('./text0');

json.registerSubtype(text);
module.exports = json;


},{"./bootstrapTransform":11,"./text0":14}],14:[function(require,module,exports){
// DEPRECATED!
//
// This type works, but is not exported. Its included here because the JSON0
// embedded string operations use this library.


// A simple text implementation
//
// Operations are lists of components. Each component either inserts or deletes
// at a specified position in the document.
//
// Components are either:
//  {i:'str', p:100}: Insert 'str' at position 100 in the document
//  {d:'str', p:100}: Delete 'str' at position 100 in the document
//
// Components in an operation are executed sequentially, so the position of components
// assumes previous components have already executed.
//
// Eg: This op:
//   [{i:'abc', p:0}]
// is equivalent to this op:
//   [{i:'a', p:0}, {i:'b', p:1}, {i:'c', p:2}]

var text = module.exports = {
  name: 'text0',
  uri: 'http://sharejs.org/types/textv0',
  create: function(initial) {
    if ((initial != null) && typeof initial !== 'string') {
      throw new Error('Initial data must be a string');
    }
    return initial || '';
  }
};

/** Insert s2 into s1 at pos. */
var strInject = function(s1, pos, s2) {
  return s1.slice(0, pos) + s2 + s1.slice(pos);
};

/** Check that an operation component is valid. Throws if its invalid. */
var checkValidComponent = function(c) {
  if (typeof c.p !== 'number')
    throw new Error('component missing position field');

  if ((typeof c.i === 'string') === (typeof c.d === 'string'))
    throw new Error('component needs an i or d field');

  if (c.p < 0)
    throw new Error('position cannot be negative');
};

/** Check that an operation is valid */
var checkValidOp = function(op) {
  for (var i = 0; i < op.length; i++) {
    checkValidComponent(op[i]);
  }
};

/** Apply op to snapshot */
text.apply = function(snapshot, op) {
  var deleted;

  checkValidOp(op);
  for (var i = 0; i < op.length; i++) {
    var component = op[i];
    if (component.i != null) {
      snapshot = strInject(snapshot, component.p, component.i);
    } else {
      deleted = snapshot.slice(component.p, component.p + component.d.length);
      if (component.d !== deleted)
        throw new Error("Delete component '" + component.d + "' does not match deleted text '" + deleted + "'");

      snapshot = snapshot.slice(0, component.p) + snapshot.slice(component.p + component.d.length);
    }
  }
  return snapshot;
};

/**
 * Append a component to the end of newOp. Exported for use by the random op
 * generator and the JSON0 type.
 */
var append = text._append = function(newOp, c) {
  if (c.i === '' || c.d === '') return;

  if (newOp.length === 0) {
    newOp.push(c);
  } else {
    var last = newOp[newOp.length - 1];

    if (last.i != null && c.i != null && last.p <= c.p && c.p <= last.p + last.i.length) {
      // Compose the insert into the previous insert
      newOp[newOp.length - 1] = {i:strInject(last.i, c.p - last.p, c.i), p:last.p};

    } else if (last.d != null && c.d != null && c.p <= last.p && last.p <= c.p + c.d.length) {
      // Compose the deletes together
      newOp[newOp.length - 1] = {d:strInject(c.d, last.p - c.p, last.d), p:c.p};

    } else {
      newOp.push(c);
    }
  }
};

/** Compose op1 and op2 together */
text.compose = function(op1, op2) {
  checkValidOp(op1);
  checkValidOp(op2);
  var newOp = op1.slice();
  for (var i = 0; i < op2.length; i++) {
    append(newOp, op2[i]);
  }
  return newOp;
};

/** Clean up an op */
text.normalize = function(op) {
  var newOp = [];

  // Normalize should allow ops which are a single (unwrapped) component:
  // {i:'asdf', p:23}.
  // There's no good way to test if something is an array:
  // http://perfectionkills.com/instanceof-considered-harmful-or-how-to-write-a-robust-isarray/
  // so this is probably the least bad solution.
  if (op.i != null || op.p != null) op = [op];

  for (var i = 0; i < op.length; i++) {
    var c = op[i];
    if (c.p == null) c.p = 0;

    append(newOp, c);
  }

  return newOp;
};

// This helper method transforms a position by an op component.
//
// If c is an insert, insertAfter specifies whether the transform
// is pushed after the insert (true) or before it (false).
//
// insertAfter is optional for deletes.
var transformPosition = function(pos, c, insertAfter) {
  // This will get collapsed into a giant ternary by uglify.
  if (c.i != null) {
    if (c.p < pos || (c.p === pos && insertAfter)) {
      return pos + c.i.length;
    } else {
      return pos;
    }
  } else {
    // I think this could also be written as: Math.min(c.p, Math.min(c.p -
    // otherC.p, otherC.d.length)) but I think its harder to read that way, and
    // it compiles using ternary operators anyway so its no slower written like
    // this.
    if (pos <= c.p) {
      return pos;
    } else if (pos <= c.p + c.d.length) {
      return c.p;
    } else {
      return pos - c.d.length;
    }
  }
};

// Helper method to transform a cursor position as a result of an op.
//
// Like transformPosition above, if c is an insert, insertAfter specifies
// whether the cursor position is pushed after an insert (true) or before it
// (false).
text.transformCursor = function(position, op, side) {
  var insertAfter = side === 'right';
  for (var i = 0; i < op.length; i++) {
    position = transformPosition(position, op[i], insertAfter);
  }

  return position;
};

// Transform an op component by another op component. Asymmetric.
// The result will be appended to destination.
//
// exported for use in JSON type
var transformComponent = text._tc = function(dest, c, otherC, side) {
  //var cIntersect, intersectEnd, intersectStart, newC, otherIntersect, s;

  checkValidComponent(c);
  checkValidComponent(otherC);

  if (c.i != null) {
    // Insert.
    append(dest, {i:c.i, p:transformPosition(c.p, otherC, side === 'right')});
  } else {
    // Delete
    if (otherC.i != null) {
      // Delete vs insert
      var s = c.d;
      if (c.p < otherC.p) {
        append(dest, {d:s.slice(0, otherC.p - c.p), p:c.p});
        s = s.slice(otherC.p - c.p);
      }
      if (s !== '')
        append(dest, {d: s, p: c.p + otherC.i.length});

    } else {
      // Delete vs delete
      if (c.p >= otherC.p + otherC.d.length)
        append(dest, {d: c.d, p: c.p - otherC.d.length});
      else if (c.p + c.d.length <= otherC.p)
        append(dest, c);
      else {
        // They overlap somewhere.
        var newC = {d: '', p: c.p};

        if (c.p < otherC.p)
          newC.d = c.d.slice(0, otherC.p - c.p);

        if (c.p + c.d.length > otherC.p + otherC.d.length)
          newC.d += c.d.slice(otherC.p + otherC.d.length - c.p);

        // This is entirely optional - I'm just checking the deleted text in
        // the two ops matches
        var intersectStart = Math.max(c.p, otherC.p);
        var intersectEnd = Math.min(c.p + c.d.length, otherC.p + otherC.d.length);
        var cIntersect = c.d.slice(intersectStart - c.p, intersectEnd - c.p);
        var otherIntersect = otherC.d.slice(intersectStart - otherC.p, intersectEnd - otherC.p);
        if (cIntersect !== otherIntersect)
          throw new Error('Delete ops delete different text in the same region of the document');

        if (newC.d !== '') {
          newC.p = transformPosition(newC.p, otherC);
          append(dest, newC);
        }
      }
    }
  }

  return dest;
};

var invertComponent = function(c) {
  return (c.i != null) ? {d:c.i, p:c.p} : {i:c.d, p:c.p};
};

// No need to use append for invert, because the components won't be able to
// cancel one another.
text.invert = function(op) {
  // Shallow copy & reverse that sucka.
  op = op.slice().reverse();
  for (var i = 0; i < op.length; i++) {
    op[i] = invertComponent(op[i]);
  }
  return op;
};

text.createPresence = function(presenceData) {
  return presenceData;
};

// Draws from https://github.com/Teamwork/ot-rich-text/blob/master/src/Operation.js
text.transformPresence = function(presence, operation, isOwnOperation) {
  var user = presence.u;
  var change = presence.c;
  var selections = presence.s;
  var side = isOwnOperation ? 'right' : 'left';
  var newSelections = new Array(selections.length);

  for (var i = 0, l = selections.length; i < l; ++i) {
    newSelections[i] = [
      text.transformCursor(selections[i][0], operation, side),
      text.transformCursor(selections[i][1], operation, side)
    ];
  }

  return {
    u: user,
    c: change,
    s: newSelections
  }
}

text.comparePresence = function(pres1, pres2) {
  return JSON.stringify(pres1) === JSON.stringify(pres2);
};

require('./bootstrapTransform')(text, transformComponent, checkValidOp, append);

},{"./bootstrapTransform":11}],15:[function(require,module,exports){
(function (process){
var Doc = require('./doc');
var Query = require('./query');
var UndoManager = require('./undoManager');
var SnapshotVersionRequest = require('./snapshot-request/snapshot-version-request');
var SnapshotTimestampRequest = require('./snapshot-request/snapshot-timestamp-request');
var emitter = require('../emitter');
var ShareDBError = require('../error');
var types = require('../types');
var util = require('../util');
var logger = require('../logger');

function connectionState(socket) {
  if (socket.readyState === 0 || socket.readyState === 1) return 'connecting';
  return 'disconnected';
}

/**
 * Handles communication with the sharejs server and provides queries and
 * documents.
 *
 * We create a connection with a socket object
 *   connection = new sharejs.Connection(sockset)
 * The socket may be any object handling the websocket protocol. See the
 * documentation of bindToSocket() for details. We then wait for the connection
 * to connect
 *   connection.on('connected', ...)
 * and are finally able to work with shared documents
 *   connection.get('food', 'steak') // Doc
 *
 * @param socket @see bindToSocket
 */
module.exports = Connection;
function Connection(socket) {
  emitter.EventEmitter.call(this);

  // Map of collection -> id -> doc object for created documents.
  // (created documents MUST BE UNIQUE)
  this.collections = {};

  // A list of active UndoManagers.
  this.undoManagers = [];

  // Each query and snapshot request is created with an id that the server uses when it sends us
  // info about the request (updates, etc)
  this.nextQueryId = 1;
  this.nextSnapshotRequestId = 1;

  // Map from query ID -> query object.
  this.queries = {};

  // Map from snapshot request ID -> snapshot request
  this._snapshotRequests = {};

  // A unique message number for the given id
  this.seq = 1;

  // Equals agent.clientId on the server
  this.id = null;

  // This direct reference from connection to agent is not used internal to
  // ShareDB, but it is handy for server-side only user code that may cache
  // state on the agent and read it in middleware
  this.agent = null;

  this.debug = false;

  this.state = connectionState(socket);

  this.bindToSocket(socket);
}
emitter.mixin(Connection);


/**
 * Use socket to communicate with server
 *
 * Socket is an object that can handle the websocket protocol. This method
 * installs the onopen, onclose, onmessage and onerror handlers on the socket to
 * handle communication and sends messages by calling socket.send(message). The
 * sockets `readyState` property is used to determine the initaial state.
 *
 * @param socket Handles the websocket protocol
 * @param socket.readyState
 * @param socket.close
 * @param socket.send
 * @param socket.onopen
 * @param socket.onclose
 * @param socket.onmessage
 * @param socket.onerror
 */
Connection.prototype.bindToSocket = function(socket) {
  if (this.socket) {
    this.socket.close();
    this.socket.onmessage = null;
    this.socket.onopen = null;
    this.socket.onerror = null;
    this.socket.onclose = null;
  }

  this.socket = socket;

  // State of the connection. The corresponding events are emitted when this changes
  //
  // - 'connecting'   The connection is still being established, or we are still
  //                    waiting on the server to send us the initialization message
  // - 'connected'    The connection is open and we have connected to a server
  //                    and recieved the initialization message
  // - 'disconnected' Connection is closed, but it will reconnect automatically
  // - 'closed'       The connection was closed by the client, and will not reconnect
  // - 'stopped'      The connection was closed by the server, and will not reconnect
  var newState = connectionState(socket);
  this._setState(newState);

  // This is a helper variable the document uses to see whether we're
  // currently in a 'live' state. It is true if and only if we're connected
  this.canSend = false;

  var connection = this;

  socket.onmessage = function(event) {
    try {
      var data = (typeof event.data === 'string') ?
        JSON.parse(event.data) : event.data;
    } catch (err) {
      logger.warn('Failed to parse message', event);
      return;
    }

    if (connection.debug) logger.info('RECV', JSON.stringify(data));

    var request = {data: data};
    connection.emit('receive', request);
    if (!request.data) return;

    try {
      connection.handleMessage(request.data);
    } catch (err) {
      process.nextTick(function() {
        connection.emit('error', err);
      });
    }
  };

  socket.onopen = function() {
    connection._setState('connecting');
  };

  socket.onerror = function(err) {
    // This isn't the same as a regular error, because it will happen normally
    // from time to time. Your connection should probably automatically
    // reconnect anyway, but that should be triggered off onclose not onerror.
    // (onclose happens when onerror gets called anyway).
    connection.emit('connection error', err);
  };

  socket.onclose = function(reason) {
    // node-browserchannel reason values:
    //   'Closed' - The socket was manually closed by calling socket.close()
    //   'Stopped by server' - The server sent the stop message to tell the client not to try connecting
    //   'Request failed' - Server didn't respond to request (temporary, usually offline)
    //   'Unknown session ID' - Server session for client is missing (temporary, will immediately reestablish)

    if (reason === 'closed' || reason === 'Closed') {
      connection._setState('closed', reason);

    } else if (reason === 'stopped' || reason === 'Stopped by server') {
      connection._setState('stopped', reason);

    } else {
      connection._setState('disconnected', reason);
    }
  };
};

/**
 * @param {object} message
 * @param {String} message.a action
 */
Connection.prototype.handleMessage = function(message) {
  var err = null;
  if (message.error) {
    // wrap in Error object so can be passed through event emitters
    err = new Error(message.error.message);
    err.code = message.error.code;
    // Add the message data to the error object for more context
    err.data = message;
    delete message.error;
  }
  // Switch on the message action. Most messages are for documents and are
  // handled in the doc class.
  switch (message.a) {
    case 'init':
      // Client initialization packet
      if (message.protocol !== 1) {
        err = new ShareDBError(4019, 'Invalid protocol version');
        return this.emit('error', err);
      }
      if (types.map[message.type] !== types.defaultType) {
        err = new ShareDBError(4020, 'Invalid default type');
        return this.emit('error', err);
      }
      if (typeof message.id !== 'string') {
        err = new ShareDBError(4021, 'Invalid client id');
        return this.emit('error', err);
      }
      this.id = message.id;

      this._setState('connected');
      return;

    case 'qf':
      var query = this.queries[message.id];
      if (query) query._handleFetch(err, message.data, message.extra);
      return;
    case 'qs':
      var query = this.queries[message.id];
      if (query) query._handleSubscribe(err, message.data, message.extra);
      return;
    case 'qu':
      // Queries are removed immediately on calls to destroy, so we ignore
      // replies to query unsubscribes. Perhaps there should be a callback for
      // destroy, but this is currently unimplemented
      return;
    case 'q':
      // Query message. Pass this to the appropriate query object.
      var query = this.queries[message.id];
      if (!query) return;
      if (err) return query._handleError(err);
      if (message.diff) query._handleDiff(message.diff);
      if (message.hasOwnProperty('extra')) query._handleExtra(message.extra);
      return;

    case 'bf':
      return this._handleBulkMessage(message, '_handleFetch');
    case 'bs':
      return this._handleBulkMessage(message, '_handleSubscribe');
    case 'bu':
      return this._handleBulkMessage(message, '_handleUnsubscribe');

    case 'nf':
    case 'nt':
      return this._handleSnapshotFetch(err, message);

    case 'f':
      var doc = this.getExisting(message.c, message.d);
      if (doc) doc._handleFetch(err, message.data);
      return;
    case 's':
      var doc = this.getExisting(message.c, message.d);
      if (doc) doc._handleSubscribe(err, message.data);
      return;
    case 'u':
      var doc = this.getExisting(message.c, message.d);
      if (doc) doc._handleUnsubscribe(err);
      return;
    case 'op':
      var doc = this.getExisting(message.c, message.d);
      if (doc) doc._handleOp(err, message);
      return;

    case 'p':
      var doc = this.getExisting(message.c, message.d);
      if (doc) doc._handlePresence(err, message);
      return;

    default:
      logger.warn('Ignoring unrecognized message', message);
  }
};

Connection.prototype._handleBulkMessage = function(message, method) {
  if (message.data) {
    for (var id in message.data) {
      var doc = this.getExisting(message.c, id);
      if (doc) doc[method](message.error, message.data[id]);
    }
  } else if (Array.isArray(message.b)) {
    for (var i = 0; i < message.b.length; i++) {
      var id = message.b[i];
      var doc = this.getExisting(message.c, id);
      if (doc) doc[method](message.error);
    }
  } else if (message.b) {
    for (var id in message.b) {
      var doc = this.getExisting(message.c, id);
      if (doc) doc[method](message.error);
    }
  } else {
    logger.error('Invalid bulk message', message);
  }
};

Connection.prototype._reset = function() {
  this.seq = 1;
  this.id = null;
  this.agent = null;
};

// Set the connection's state. The connection is basically a state machine.
Connection.prototype._setState = function(newState, reason) {
  if (this.state === newState) return;

  // I made a state diagram. The only invalid transitions are getting to
  // 'connecting' from anywhere other than 'disconnected' and getting to
  // 'connected' from anywhere other than 'connecting'.
  if (
    (newState === 'connecting' && this.state !== 'disconnected' && this.state !== 'stopped' && this.state !== 'closed') ||
    (newState === 'connected' && this.state !== 'connecting')
  ) {
    var err = new ShareDBError(5007, 'Cannot transition directly from ' + this.state + ' to ' + newState);
    return this.emit('error', err);
  }

  this.state = newState;
  this.canSend = (newState === 'connected');

  if (newState === 'disconnected' || newState === 'stopped' || newState === 'closed') this._reset();

  // Group subscribes together to help server make more efficient calls
  this.startBulk();
  // Emit the event to all queries
  for (var id in this.queries) {
    var query = this.queries[id];
    query._onConnectionStateChanged();
  }
  // Emit the event to all documents
  for (var collection in this.collections) {
    var docs = this.collections[collection];
    for (var id in docs) {
      docs[id]._onConnectionStateChanged();
    }
  }
  // Emit the event to all snapshots
  for (var id in this._snapshotRequests) {
    var snapshotRequest = this._snapshotRequests[id];
    snapshotRequest._onConnectionStateChanged();
  }
  this.endBulk();

  this.emit(newState, reason);
  this.emit('state', newState, reason);
};

Connection.prototype.startBulk = function() {
  if (!this.bulk) this.bulk = {};
};

Connection.prototype.endBulk = function() {
  if (this.bulk) {
    for (var collection in this.bulk) {
      var actions = this.bulk[collection];
      this._sendBulk('f', collection, actions.f);
      this._sendBulk('s', collection, actions.s);
      this._sendBulk('u', collection, actions.u);
    }
  }
  this.bulk = null;
};

Connection.prototype._sendBulk = function(action, collection, values) {
  if (!values) return;
  var ids = [];
  var versions = {};
  var versionsCount = 0;
  var versionId;
  for (var id in values) {
    var value = values[id];
    if (value == null) {
      ids.push(id);
    } else {
      versions[id] = value;
      versionId = id;
      versionsCount++;
    }
  }
  if (ids.length === 1) {
    var id = ids[0];
    this.send({a: action, c: collection, d: id});
  } else if (ids.length) {
    this.send({a: 'b' + action, c: collection, b: ids});
  }
  if (versionsCount === 1) {
    var version = versions[versionId];
    this.send({a: action, c: collection, d: versionId, v: version});
  } else if (versionsCount) {
    this.send({a: 'b' + action, c: collection, b: versions});
  }
};

Connection.prototype._sendAction = function(action, doc, version) {
  // Ensure the doc is registered so that it receives the reply message
  this._addDoc(doc);
  if (this.bulk) {
    // Bulk subscribe
    var actions = this.bulk[doc.collection] || (this.bulk[doc.collection] = {});
    var versions = actions[action] || (actions[action] = {});
    var isDuplicate = versions.hasOwnProperty(doc.id);
    versions[doc.id] = version;
    return isDuplicate;
  } else {
    // Send single doc subscribe message
    var message = {a: action, c: doc.collection, d: doc.id, v: version};
    this.send(message);
  }
};

Connection.prototype.sendFetch = function(doc) {
  return this._sendAction('f', doc, doc.version);
};

Connection.prototype.sendSubscribe = function(doc) {
  return this._sendAction('s', doc, doc.version);
};

Connection.prototype.sendUnsubscribe = function(doc) {
  return this._sendAction('u', doc);
};

Connection.prototype.sendOp = function(doc, op) {
  // Ensure the doc is registered so that it receives the reply message
  this._addDoc(doc);
  var message = {
    a: 'op',
    c: doc.collection,
    d: doc.id,
    v: doc.version,
    src: op.src,
    seq: op.seq
  };
  if (op.op) message.op = op.op;
  if (op.create) message.create = op.create;
  if (op.del) message.del = op.del;
  this.send(message);
};

Connection.prototype.sendPresence = function(doc, data, requestReply) {
  // Ensure the doc is registered so that it receives the reply message
  this._addDoc(doc);
  var message = {
    a: 'p',
    c: doc.collection,
    d: doc.id,
    p: data,
    v: doc.version || 0,
    seq: this.seq++
  };
  if (requestReply) {
    message.r = true;
  }
  this.send(message);
};


/**
 * Sends a message down the socket
 */
Connection.prototype.send = function(message) {
  if (this.debug) logger.info('SEND', JSON.stringify(message));

  this.emit('send', message);
  this.socket.send(JSON.stringify(message));
};


/**
 * Closes the socket and emits 'closed'
 */
Connection.prototype.close = function() {
  this.socket.close();
};

Connection.prototype.getExisting = function(collection, id) {
  if (this.collections[collection]) return this.collections[collection][id];
};


/**
 * Get or create a document.
 *
 * @param collection
 * @param id
 * @return {Doc}
 */
Connection.prototype.get = function(collection, id) {
  var docs = this.collections[collection] ||
    (this.collections[collection] = {});

  var doc = docs[id];
  if (!doc) {
    doc = docs[id] = new Doc(this, collection, id);
    this.emit('doc', doc);
  }

  return doc;
};


/**
 * Remove document from this.collections
 *
 * @private
 */
Connection.prototype._destroyDoc = function(doc) {
  var docs = this.collections[doc.collection];
  if (!docs) return;

  delete docs[doc.id];

  // Delete the collection container if its empty. This could be a source of
  // memory leaks if you slowly make a billion collections, which you probably
  // won't do anyway, but whatever.
  if (!util.hasKeys(docs)) {
    delete this.collections[doc.collection];
  }
};

Connection.prototype._addDoc = function(doc) {
  var docs = this.collections[doc.collection];
  if (!docs) {
    docs = this.collections[doc.collection] = {};
  }
  if (docs[doc.id] !== doc) {
    docs[doc.id] = doc;
  }
};

// Helper for createFetchQuery and createSubscribeQuery, below.
Connection.prototype._createQuery = function(action, collection, q, options, callback) {
  var id = this.nextQueryId++;
  var query = new Query(action, this, id, collection, q, options, callback);
  this.queries[id] = query;
  query.send();
  return query;
};

// Internal function. Use query.destroy() to remove queries.
Connection.prototype._destroyQuery = function(query) {
  delete this.queries[query.id];
};

// The query options object can contain the following fields:
//
// db: Name of the db for the query. You can attach extraDbs to ShareDB and
//   pick which one the query should hit using this parameter.

// Create a fetch query. Fetch queries are only issued once, returning the
// results directly into the callback.
//
// The callback should have the signature function(error, results, extra)
// where results is a list of Doc objects.
Connection.prototype.createFetchQuery = function(collection, q, options, callback) {
  return this._createQuery('qf', collection, q, options, callback);
};

// Create a subscribe query. Subscribe queries return with the initial data
// through the callback, then update themselves whenever the query result set
// changes via their own event emitter.
//
// If present, the callback should have the signature function(error, results, extra)
// where results is a list of Doc objects.
Connection.prototype.createSubscribeQuery = function(collection, q, options, callback) {
  return this._createQuery('qs', collection, q, options, callback);
};

Connection.prototype.hasPending = function() {
  return !!(
    this._firstDoc(hasPending) ||
    this._firstQuery(hasPending) ||
    this._firstSnapshotRequest()
  );
};
function hasPending(object) {
  return object.hasPending();
}

Connection.prototype.hasWritePending = function() {
  return !!this._firstDoc(hasWritePending);
};
function hasWritePending(object) {
  return object.hasWritePending();
}

Connection.prototype.whenNothingPending = function(callback) {
  var doc = this._firstDoc(hasPending);
  if (doc) {
    // If a document is found with a pending operation, wait for it to emit
    // that nothing is pending anymore, and then recheck all documents again.
    // We have to recheck all documents, just in case another mutation has
    // been made in the meantime as a result of an event callback
    doc.once('nothing pending', this._nothingPendingRetry(callback));
    return;
  }
  var query = this._firstQuery(hasPending);
  if (query) {
    query.once('ready', this._nothingPendingRetry(callback));
    return;
  }
  var snapshotRequest = this._firstSnapshotRequest();
  if (snapshotRequest) {
    snapshotRequest.once('ready', this._nothingPendingRetry(callback));
    return;
  }
  // Call back when no pending operations
  process.nextTick(callback);
};
Connection.prototype._nothingPendingRetry = function(callback) {
  var connection = this;
  return function() {
    process.nextTick(function() {
      connection.whenNothingPending(callback);
    });
  };
};

Connection.prototype._firstDoc = function(fn) {
  for (var collection in this.collections) {
    var docs = this.collections[collection];
    for (var id in docs) {
      var doc = docs[id];
      if (fn(doc)) {
        return doc;
      }
    }
  }
};

Connection.prototype._firstQuery = function(fn) {
  for (var id in this.queries) {
    var query = this.queries[id];
    if (fn(query)) {
      return query;
    }
  }
};

Connection.prototype.createUndoManager = function(options) {
  var undoManager = new UndoManager(this, options);
  this.undoManagers.push(undoManager);
  return undoManager;
};

Connection.prototype.removeUndoManager = function(undoManager) {
  var index = this.undoManagers.indexOf(undoManager);
  if (index >= 0) {
    this.undoManagers.splice(index, 1);
  }
};

Connection.prototype.onDocLoad = function(doc) {
  for (var i = 0; i < this.undoManagers.length; i++) {
    this.undoManagers[i].onDocLoad(doc);
  }
};

Connection.prototype.onDocDestroy = function(doc) {
  for (var i = 0; i < this.undoManagers.length; i++) {
    this.undoManagers[i].onDocDestroy(doc);
  }
};

Connection.prototype.onDocCreate = function(doc) {
  for (var i = 0; i < this.undoManagers.length; i++) {
    this.undoManagers[i].onDocCreate(doc);
  }
};

Connection.prototype.onDocDelete = function(doc) {
  for (var i = 0; i < this.undoManagers.length; i++) {
    this.undoManagers[i].onDocDelete(doc);
  }
};

Connection.prototype.onDocOp = function(doc, op, undoOp, source, undoable, fixUp) {
  for (var i = 0; i < this.undoManagers.length; i++) {
    this.undoManagers[i].onDocOp(doc, op, undoOp, source, undoable, fixUp);
  }
};

Connection.prototype._firstSnapshotRequest = function () {
  for (var id in this._snapshotRequests) {
    return this._snapshotRequests[id];
  }
};

/**
 * Fetch a read-only snapshot at a given version
 *
 * @param collection - the collection name of the snapshot
 * @param id - the ID of the snapshot
 * @param version (optional) - the version number to fetch. If null, the latest version is fetched.
 * @param callback - (error, snapshot) => void, where snapshot takes the following schema:
 *
 * {
 *   id: string;         // ID of the snapshot
 *   v: number;          // version number of the snapshot
 *   type: string;       // the OT type of the snapshot, or null if it doesn't exist or is deleted
 *   data: any;          // the snapshot
 * }
 *
 */
Connection.prototype.fetchSnapshot = function(collection, id, version, callback) {
  if (typeof version === 'function') {
    callback = version;
    version = null;
  }

  var requestId = this.nextSnapshotRequestId++;
  var snapshotRequest = new SnapshotVersionRequest(this, requestId, collection, id, version, callback);
  this._snapshotRequests[snapshotRequest.requestId] = snapshotRequest;
  snapshotRequest.send();
};

/**
 * Fetch a read-only snapshot at a given timestamp
 *
 * @param collection - the collection name of the snapshot
 * @param id - the ID of the snapshot
 * @param timestamp (optional) - the timestamp to fetch. If null, the latest version is fetched.
 * @param callback - (error, snapshot) => void, where snapshot takes the following schema:
 *
 * {
 *   id: string;         // ID of the snapshot
 *   v: number;          // version number of the snapshot
 *   type: string;       // the OT type of the snapshot, or null if it doesn't exist or is deleted
 *   data: any;          // the snapshot
 * }
 *
 */
Connection.prototype.fetchSnapshotByTimestamp = function (collection, id, timestamp, callback) {
  if (typeof timestamp === 'function') {
    callback = timestamp;
    timestamp = null;
  }

  var requestId = this.nextSnapshotRequestId++;
  var snapshotRequest = new SnapshotTimestampRequest(this, requestId, collection, id, timestamp, callback);
  this._snapshotRequests[snapshotRequest.requestId] = snapshotRequest;
  snapshotRequest.send();
};

Connection.prototype._handleSnapshotFetch = function (error, message) {
  var snapshotRequest = this._snapshotRequests[message.id];
  if (!snapshotRequest) return;
  delete this._snapshotRequests[message.id];
  snapshotRequest._handleResponse(error, message);
};

}).call(this,require('_process'))
},{"../emitter":23,"../error":24,"../logger":25,"../types":28,"../util":29,"./doc":16,"./query":18,"./snapshot-request/snapshot-timestamp-request":20,"./snapshot-request/snapshot-version-request":21,"./undoManager":22,"_process":36}],16:[function(require,module,exports){
(function (process){
var emitter = require('../emitter');
var logger = require('../logger');
var ShareDBError = require('../error');
var types = require('../types');

/**
 * A Doc is a client's view on a sharejs document.
 *
 * It is is uniquely identified by its `id` and `collection`.  Documents
 * should not be created directly. Create them with connection.get()
 *
 *
 * Subscriptions
 * -------------
 *
 * We can subscribe a document to stay in sync with the server.
 *   doc.subscribe(function(error) {
 *     doc.subscribed // = true
 *   })
 * The server now sends us all changes concerning this document and these are
 * applied to our data. If the subscription was successful the initial
 * data and version sent by the server are loaded into the document.
 *
 * To stop listening to the changes we call `doc.unsubscribe()`.
 *
 * If we just want to load the data but not stay up-to-date, we call
 *   doc.fetch(function(error) {
 *     doc.data // sent by server
 *   })
 *
 *
 * Presence
 * --------
 *
 * We can associate transient "presence" data with a document, eg caret position, etc.
 * The presence data is synchronized on the best-effort basis between clients subscribed to the same document.
 * Each client has their own presence data which is read-write. Other clients' data is read-only.
 *
 *
 * Events
 * ------
 *
 * You can use doc.on(eventName, callback) to subscribe to the following events:
 * - `before op (op, source)` Fired before a partial operation is applied to the data.
 *   It may be used to read the old data just before applying an operation
 * - `op (op, source)` Fired after every partial operation with this operation as the
 *   first argument
 * - `create (source)` The document was created. That means its type was
 *   set and it has some initial data.
 * - `del (data, source)` Fired after the document is deleted, that is
 *   the data is null. It is passed the data before delteion as an
 *   arguments
 * - `load ()` Fired when a new snapshot is ingested from a fetch, subscribe, or query
 * - `presence ([src])` Fired after the presence data has changed.
 */

module.exports = Doc;
function Doc(connection, collection, id) {
  emitter.EventEmitter.call(this);

  this.connection = connection;

  this.collection = collection;
  this.id = id;

  this.version = null;
  this.type = null;
  this.data = undefined;

  // The current presence data
  // Map of src -> presence data
  // Local src === ''
  this.presence = Object.create(null);
  // The presence objects received from the server
  // Map of src -> presence
  this.receivedPresence = Object.create(null);
  // The minimum amount of time to wait before removing processed presence from this.receivedPresence.
  // The processed presence is removed to avoid leaking memory, in case peers keep connecting and disconnecting a lot.
  // The processed presence is not removed immediately to enable avoiding race conditions, where messages with lower
  // sequence number arrive after messages with higher sequence numbers.
  this.receivedPresenceTimeout = 60000;
  // If set to true, then the next time the local presence is sent,
  // all other clients will be asked to reply with their own presence data.
  this.requestReplyPresence = true;
  // A list of ops sent by the server. These are needed for transforming presence data,
  // if we get that presence data for an older version of the document.
  // The ops are cached for at least 1 minute by default, which should be lots, considering that the presence
  // data is supposed to be synced in real-time.
  this.cachedOps = [];
  this.cachedOpsTimeout = 60000;
  // The sequence number of the inflight presence request.
  this.inflightPresenceSeq = 0;

  // Array of callbacks or nulls as placeholders
  this.inflightFetch = [];
  this.inflightSubscribe = [];
  this.inflightUnsubscribe = [];
  this.inflightPresence = null;
  this.pendingFetch = [];
  this.pendingPresence = null;

  // Whether we think we are subscribed on the server. Synchronously set to
  // false on calls to unsubscribe and disconnect. Should never be true when
  // this.wantSubscribe is false
  this.subscribed = false;
  // Whether to re-establish the subscription on reconnect
  this.wantSubscribe = false;

  // The op that is currently roundtripping to the server, or null.
  //
  // When the connection reconnects, the inflight op is resubmitted.
  //
  // This has the same format as an entry in pendingOps
  this.inflightOp = null;

  // All ops that are waiting for the server to acknowledge this.inflightOp
  // This used to just be a single operation, but creates & deletes can't be
  // composed with regular operations.
  //
  // This is a list of {[create:{...}], [del:true], [op:...], callbacks:[...]}
  this.pendingOps = [];

  // The OT type of this document. An uncreated document has type `null`
  this.type = null;

  // The applyStack enables us to track any ops submitted while we are
  // applying an op incrementally. This value is an array when we are
  // performing an incremental apply and null otherwise. When it is an array,
  // all submitted ops should be pushed onto it. The `_otApply` method will
  // reset it back to null when all incremental apply loops are complete.
  this.applyStack = null;

  // Disable the default behavior of composing submitted ops. This is read at
  // the time of op submit, so it may be toggled on before submitting a
  // specifc op and toggled off afterward
  this.preventCompose = false;
}
emitter.mixin(Doc);

Doc.prototype.destroy = function(callback) {
  var doc = this;
  doc.whenNothingPending(function() {
    if (doc.wantSubscribe) {
      doc.unsubscribe(function(err) {
        if (err) {
          if (callback) return callback(err);
          return doc.emit('error', err);
        }
        doc.receivedPresence = Object.create(null);
        doc.cachedOps.length = 0;
        doc.connection._destroyDoc(doc);
        doc.connection.onDocDestroy(doc);
        if (callback) callback();
      });
    } else {
      doc.receivedPresence = Object.create(null);
      doc.cachedOps.length = 0;
      doc.connection._destroyDoc(doc);
      doc.connection.onDocDestroy(doc);
      if (callback) callback();
    }
  });
};


// ****** Manipulating the document data, version and type.

// Set the document's type, and associated properties. Most of the logic in
// this function exists to update the document based on any added & removed API
// methods.
//
// @param newType OT type provided by the ottypes library or its name or uri
Doc.prototype._setType = function(newType) {
  if (typeof newType === 'string') {
    newType = types.map[newType];
  }

  if (newType) {
    this.type = newType;

  } else if (newType === null) {
    this.type = newType;
    // If we removed the type from the object, also remove its data
    this.data = undefined;

  } else {
    var err = new ShareDBError(4008, 'Missing type ' + newType);
    return this.emit('error', err);
  }
};

// Ingest snapshot data. This data must include a version, snapshot and type.
// This is used both to ingest data that was exported with a webpage and data
// that was received from the server during a fetch.
//
// @param snapshot.v    version
// @param snapshot.data
// @param snapshot.type
// @param callback
Doc.prototype.ingestSnapshot = function(snapshot, callback) {
  if (!snapshot) return callback && callback();

  if (typeof snapshot.v !== 'number') {
    var err = new ShareDBError(5008, 'Missing version in ingested snapshot. ' + this.collection + '.' + this.id);
    if (callback) return callback(err);
    return this.emit('error', err);
  }

  // If the doc is already created or there are ops pending, we cannot use the
  // ingested snapshot and need ops in order to update the document
  if (this.type || this.hasWritePending()) {
    // The version should only be null on a created document when it was
    // created locally without fetching
    if (this.version == null) {
      if (this.hasWritePending()) {
        // If we have pending ops and we get a snapshot for a locally created
        // document, we have to wait for the pending ops to complete, because
        // we don't know what version to fetch ops from. It is possible that
        // the snapshot came from our local op, but it is also possible that
        // the doc was created remotely (which would conflict and be an error)
        return callback && this.once('no write pending', callback);
      }
      // Otherwise, we've encounted an error state
      var err = new ShareDBError(5009, 'Cannot ingest snapshot in doc with null version. ' + this.collection + '.' + this.id);
      if (callback) return callback(err);
      return this.emit('error', err);
    }
    // If we got a snapshot for a version further along than the document is
    // currently, issue a fetch to get the latest ops and catch us up
    if (snapshot.v > this.version) return this.fetch(callback);
    return callback && callback();
  }

  // Ignore the snapshot if we are already at a newer version. Under no
  // circumstance should we ever set the current version backward
  if (this.version > snapshot.v) return callback && callback();

  this.version = snapshot.v;
  this.cachedOps.length = 0;
  var type = (snapshot.type === undefined) ? types.defaultType : snapshot.type;
  this._setType(type);
  this.data = (this.type && this.type.deserialize) ?
    this.type.deserialize(snapshot.data) :
    snapshot.data;
  this.connection.onDocLoad(this);
  this.emit('load');
  this._processAllReceivedPresence();
  callback && callback();
};

Doc.prototype.whenNothingPending = function(callback) {
  var doc = this;
  process.nextTick(function() {
    if (doc.hasPending()) {
      doc.once('nothing pending', callback);
      return;
    }
    callback();
  });
};

Doc.prototype.hasPending = function() {
  return !!(
    this.inflightOp ||
    this.pendingOps.length ||
    this.inflightFetch.length ||
    this.inflightSubscribe.length ||
    this.inflightUnsubscribe.length ||
    this.pendingFetch.length ||
    this.inflightPresence ||
    this.pendingPresence
  );
};

Doc.prototype.hasWritePending = function() {
  return !!(this.inflightOp || this.pendingOps.length);
};

Doc.prototype._emitNothingPending = function() {
  if (this.hasWritePending()) return;
  this.emit('no write pending');
  if (this.hasPending()) return;
  this.emit('nothing pending');
};

// **** Helpers for network messages

Doc.prototype._emitResponseError = function(err, callback) {
  if (callback) {
    callback(err);
    this._emitNothingPending();
    return;
  }
  this._emitNothingPending();
  this.emit('error', err);
};

Doc.prototype._handleFetch = function(err, snapshot) {
  var callback = this.inflightFetch.shift();
  if (err) return this._emitResponseError(err, callback);
  this.ingestSnapshot(snapshot, callback);
  this._emitNothingPending();
};

Doc.prototype._handleSubscribe = function(err, snapshot) {
  var callback = this.inflightSubscribe.shift();
  if (err) return this._emitResponseError(err, callback);
  // Indicate we are subscribed only if the client still wants to be. In the
  // time since calling subscribe and receiving a response from the server,
  // unsubscribe could have been called and we might already be unsubscribed
  // but not have received the response. Also, because requests from the
  // client are not serialized and may take different async time to process,
  // it is possible that we could hear responses back in a different order
  // from the order originally sent
  if (this.wantSubscribe) this.subscribed = true;
  this.ingestSnapshot(snapshot, callback);
  this._emitNothingPending();
  this.flush();
};

Doc.prototype._handleUnsubscribe = function(err) {
  var callback = this.inflightUnsubscribe.shift();
  if (err) return this._emitResponseError(err, callback);
  if (callback) callback();
  this._emitNothingPending();
};

Doc.prototype._handleOp = function(err, message) {
  if (err) {
    if (this.inflightOp) {
      // The server has rejected submission of the current operation. If we get
      // an error code 4002 "Op submit rejected", this was done intentionally
      // and we should roll back but not return an error to the user.
      if (err.code === 4002) err = null;
      return this._rollback(err);
    }
    return this.emit('error', err);
  }

  if (this.inflightOp &&
      message.src === this.inflightOp.src &&
      message.seq === this.inflightOp.seq) {
    // The op has already been applied locally. Just update the version
    // and pending state appropriately
    this._opAcknowledged(message);
    return;
  }

  if (this.version == null || message.v > this.version) {
    // This will happen in normal operation if we become subscribed to a
    // new document via a query. It can also happen if we get an op for
    // a future version beyond the version we are expecting next. This
    // could happen if the server doesn't publish an op for whatever reason
    // or because of a race condition. In any case, we can send a fetch
    // command to catch back up.
    //
    // Fetch only sends a new fetch command if no fetches are inflight, which
    // will act as a natural debouncing so we don't send multiple fetch
    // requests for many ops received at once.
    this.fetch();
    return;
  }

  if (message.v < this.version) {
    // We can safely ignore the old (duplicate) operation.
    return;
  }

  var serverOp = {
    src: message.src,
    time: Date.now(),
    create: !!message.create,
    op: message.op,
    del: !!message.del
  };

  if (this.inflightOp) {
    var transformErr = transformX(this.inflightOp, message);
    if (transformErr) return this._hardRollback(transformErr);
  }

  for (var i = 0; i < this.pendingOps.length; i++) {
    var transformErr = transformX(this.pendingOps[i], message);
    if (transformErr) return this._hardRollback(transformErr);
  }

  this.version++;
  try {
    this._cacheOp(serverOp);
    this._otApply(message);
    this._processAllReceivedPresence();
  } catch (error) {
    return this._hardRollback(error);
  }
  return;
};

// Called whenever (you guessed it!) the connection state changes. This will
// happen when we get disconnected & reconnect.
Doc.prototype._onConnectionStateChanged = function() {
  if (this.connection.canSend) {
    this.flush();
    this._resubscribe();
  } else {
    if (this.inflightOp) {
      this.pendingOps.unshift(this.inflightOp);
      this.inflightOp = null;
    }
    this.subscribed = false;
    if (this.inflightFetch.length || this.inflightSubscribe.length) {
      this.pendingFetch = this.pendingFetch.concat(this.inflightFetch, this.inflightSubscribe);
      this.inflightFetch.length = 0;
      this.inflightSubscribe.length = 0;
    }
    if (this.inflightUnsubscribe.length) {
      var callbacks = this.inflightUnsubscribe;
      this.inflightUnsubscribe = [];
      this._pausePresence();
      callEach(callbacks);
    } else {
      this._pausePresence();
    }
  }
};

Doc.prototype._resubscribe = function() {
  var doc = this;
  var callbacks = this.pendingFetch;
  this.pendingFetch = [];

  if (this.wantSubscribe) {
    if (callbacks.length) {
      this.subscribe(function(err) {
        var called = callEach(callbacks, err);
        if (err && !called) doc.emit('error', err);
      });
      return;
    }
    this.subscribe();
    return;
  }

  if (callbacks.length) {
    this.fetch(function(err) {
      var called = callEach(callbacks, err);
      if (err && !called) doc.emit('error', err);
    });
  }
};

// Request the current document snapshot or ops that bring us up to date
Doc.prototype.fetch = function(callback) {
  if (this.connection.canSend) {
    var isDuplicate = this.connection.sendFetch(this);
    pushActionCallback(this.inflightFetch, isDuplicate, callback);
    return;
  }
  this.pendingFetch.push(callback);
};

// Fetch the initial document and keep receiving updates
Doc.prototype.subscribe = function(callback) {
  this.wantSubscribe = true;
  if (this.connection.canSend) {
    var isDuplicate = this.connection.sendSubscribe(this);
    pushActionCallback(this.inflightSubscribe, isDuplicate, callback);
    return;
  }
  this.pendingFetch.push(callback);
};

// Unsubscribe. The data will stay around in local memory, but we'll stop
// receiving updates
Doc.prototype.unsubscribe = function(callback) {
  this.wantSubscribe = false;
  // The subscribed state should be conservative in indicating when we are
  // subscribed on the server. We'll actually be unsubscribed some time
  // between sending the message and hearing back, but we cannot know exactly
  // when. Thus, immediately mark us as not subscribed
  this.subscribed = false;
  if (this.connection.canSend) {
    var isDuplicate = this.connection.sendUnsubscribe(this);
    pushActionCallback(this.inflightUnsubscribe, isDuplicate, callback);
    this._pausePresence();
    return;
  }
  this._pausePresence();
  if (callback) process.nextTick(callback);
};

function pushActionCallback(inflight, isDuplicate, callback) {
  if (isDuplicate) {
    var lastCallback = inflight.pop();
    inflight.push(function(err) {
      lastCallback && lastCallback(err);
      callback && callback(err);
    });
  } else {
    inflight.push(callback);
  }
}


// Operations //

// Send the next pending op to the server, if we can.
//
// Only one operation can be in-flight at a time. If an operation is already on
// its way, or we're not currently connected, this method does nothing.
//
// If there are no pending ops, this method sends the pending presence data, if possible.
Doc.prototype.flush = function() {
  if (this.paused) return;

  if (this.connection.canSend && !this.inflightOp && this.pendingOps.length) {
    this._sendOp();
  }

  if (this.subscribed && !this.inflightPresence && this.pendingPresence && !this.hasWritePending()) {
    this.inflightPresence = this.pendingPresence;
    this.inflightPresenceSeq = this.connection.seq;
    this.pendingPresence = null;
    this.connection.sendPresence(this, this.presence[''], this.requestReplyPresence);
    this.requestReplyPresence = false;
  }
};

// Helper function to set op to contain a no-op.
function setNoOp(op) {
  delete op.op;
  delete op.create;
  delete op.del;
}

// Transform server op data by a client op, and vice versa. Ops are edited in place.
function transformX(client, server) {
  // Order of statements in this function matters. Be especially careful if
  // refactoring this function

  // A client delete op should dominate if both the server and the client
  // delete the document. Thus, any ops following the client delete (such as a
  // subsequent create) will be maintained, since the server op is transformed
  // to a no-op
  if (client.del) return setNoOp(server);

  if (server.del) {
    return new ShareDBError(4017, 'Document was deleted');
  }
  if (server.create) {
    return new ShareDBError(4018, 'Document alredy created');
  }

  // Ignore no-op coming from server
  if (!server.op) return;

  // I believe that this should not occur, but check just in case
  if (client.create) {
    return new ShareDBError(4018, 'Document already created');
  }

  // They both edited the document. This is the normal case for this function -
  // as in, most of the time we'll end up down here.
  //
  // You should be wondering why I'm using client.type instead of this.type.
  // The reason is, if we get ops at an old version of the document, this.type
  // might be undefined or a totally different type. By pinning the type to the
  // op data, we make sure the right type has its transform function called.
  if (client.type.transformX) {
    var result = client.type.transformX(client.op, server.op);
    client.op = result[0];
    server.op = result[1];
  } else {
    var clientOp = client.type.transform(client.op, server.op, 'left');
    var serverOp = client.type.transform(server.op, client.op, 'right');
    client.op = clientOp;
    server.op = serverOp;
  }
};

/**
 * Applies the operation to the snapshot
 *
 * If the operation is create or delete it emits `create` or `del`. Then the
 * operation is applied to the snapshot and `op` and `after op` are emitted.
 * If the type supports incremental updates and `this.incremental` is true we
 * fire `op` after every small operation.
 *
 * This is the only function to fire the above mentioned events.
 *
 * @private
 */
Doc.prototype._otApply = function(op, options) {
  var source = options && options.source || false;
  if (op.op) {
    if (!this.type) {
      // Throw here, because all usage of _otApply should be wrapped with a try/catch
      throw new ShareDBError(4015, 'Cannot apply op to uncreated document. ' + this.collection + '.' + this.id);
    }
    var undoOp = options && options.undoOp || null;
    var undoable = options && options.undoable || false;
    var fixUp = options && options.fixUp || false;

    // Iteratively apply multi-component remote operations and rollback ops
    // (source === false) for the default JSON0 OT type. It could use
    // type.shatter(), but since this code is so specific to use cases for the
    // JSON0 type and ShareDB explicitly bundles the default type, we might as
    // well write it this way and save needing to iterate through the op
    // components twice.
    //
    // Ideally, we would not need this extra complexity. However, it is
    // helpful for implementing bindings that update DOM nodes and other
    // stateful objects by translating op events directly into corresponding
    // mutations. Such bindings are most easily written as responding to
    // individual op components one at a time in order, and it is important
    // that the snapshot only include updates from the particular op component
    // at the time of emission. Eliminating this would require rethinking how
    // such external bindings are implemented.
    if (!source && this.type === types.defaultType && op.op.length > 1) {
      if (!this.applyStack) this.applyStack = [];
      var stackLength = this.applyStack.length;
      for (var i = 0; i < op.op.length; i++) {
        var component = op.op[i];
        var componentOp = {op: [component]};
        // Transform componentOp against any ops that have been submitted
        // sychronously inside of an op event handler since we began apply of
        // our operation
        for (var j = stackLength; j < this.applyStack.length; j++) {
          var transformErr = transformX(this.applyStack[j], componentOp);
          if (transformErr) return this._hardRollback(transformErr);
        }
        // Apply the individual op component
        this.emit('before op', componentOp.op, source);
        this._applyOp(componentOp, undoOp, source, undoable, fixUp);
        this._transformAllPresence(componentOp);
        this.emit('op', componentOp.op, source);
      }
      // Pop whatever was submitted since we started applying this op
      this._popApplyStack(stackLength);
      return;
    }

    // The 'before op' event enables clients to pull any necessary data out of
    // the snapshot before it gets changed
    this.emit('before op', op.op, source);
    // Apply the operation to the local data, mutating it in place
    this._applyOp(op, undoOp, source, undoable, fixUp);
    this._transformAllPresence(op);
    // Emit an 'op' event once the local data includes the changes from the
    // op. For locally submitted ops, this will be synchronously with
    // submission and before the server or other clients have received the op.
    // For ops from other clients, this will be after the op has been
    // committed to the database and published
    this.emit('op', op.op, source);
    return;
  }

  if (op.create) {
    this._setType(op.create.type);
    this.data = (this.type.deserialize) ?
      (this.type.createDeserialized) ?
        this.type.createDeserialized(op.create.data) :
        this.type.deserialize(this.type.create(op.create.data)) :
      this.type.create(op.create.data);
    this._transformAllPresence(op);
    this.connection.onDocCreate(this);
    this.emit('create', source);
    return;
  }

  if (op.del) {
    var oldData = this.data;
    this._setType(null);
    this._transformAllPresence(op);
    this.connection.onDocDelete(this);
    this.emit('del', oldData, source);
    return;
  }
};

// Applies `op` to `this.data` and updates the undo/redo stacks.
Doc.prototype._applyOp = function(op, undoOp, source, undoable, fixUp) {
  if (undoOp == null && (undoable || fixUp || op.needsUndoOp)) {
    if (this.type.applyAndInvert) {
      var result = this.type.applyAndInvert(this.data, op.op);
      this.data = result[0];
      undoOp = { op: result[1] };
    } else {
      this.data = this.type.apply(this.data, op.op);
      undoOp = { op: this.type.invert(op.op) };
    }
  } else {
    this.data = this.type.apply(this.data, op.op);
  }

  this.connection.onDocOp(this, op, undoOp, source, undoable, fixUp);
};

// ***** Sending operations

// Actually send op to the server.
Doc.prototype._sendOp = function() {
  // Wait until we have a src id from the server
  var src = this.connection.id;
  if (!src) return;

  // When there is no inflightOp, send the first item in pendingOps. If
  // there is inflightOp, try sending it again
  if (!this.inflightOp) {
    // Send first pending op
    this.inflightOp = this.pendingOps.shift();
  }
  var op = this.inflightOp;
  if (!op) {
    var err = new ShareDBError(5010, 'No op to send on call to _sendOp');
    return this.emit('error', err);
  }

  // Track data for retrying ops
  op.sentAt = Date.now();
  op.retries = (op.retries == null) ? 0 : op.retries + 1;

  // The src + seq number is a unique ID representing this operation. This tuple
  // is used on the server to detect when ops have been sent multiple times and
  // on the client to match acknowledgement of an op back to the inflightOp.
  // Note that the src could be different from this.connection.id after a
  // reconnect, since an op may still be pending after the reconnection and
  // this.connection.id will change. In case an op is sent multiple times, we
  // also need to be careful not to override the original seq value.
  if (op.seq == null) op.seq = this.connection.seq++;

  this.connection.sendOp(this, op);

  // src isn't needed on the first try, since the server session will have the
  // same id, but it must be set on the inflightOp in case it is sent again
  // after a reconnect and the connection's id has changed by then
  if (op.src == null) op.src = src;
};


// Queues the operation for submission to the server and applies it locally.
//
// Internal method called to do the actual work for submit(), create() and del().
// @private
//
// @param op
// @param [op.op]
// @param [op.del]
// @param [op.create]
// @param options { source, skipNoop, undoable, undoOp, fixUp }
// @param [callback] called when operation is submitted
Doc.prototype._submit = function(op, options, callback) {
  if (!options) options = {};

  // Locally submitted ops must always have a truthy source
  if (!options.source) options.source = true;

  // The op contains either op, create, delete, or none of the above (a no-op).
  if (op.op) {
    if (!this.type) {
      var err = new ShareDBError(4015, 'Cannot submit op. Document has not been created. ' + this.collection + '.' + this.id);
      if (callback) return callback(err);
      return this.emit('error', err);
    }
    var needsUndoOp = options.undoable || options.fixUp || op.needsUndoOp;
    if (needsUndoOp && !this.type.invert && !this.type.applyAndInvert) {
      var err = new ShareDBError(4028, 'Cannot submit op. OT type does not support invert not applyAndInvert. ' + this.collection + '.' + this.id);
      if (callback) return callback(err);
      return this.emit('error', err);
    }
    // Try to normalize the op. This removes trailing skip:0's and things like that.
    if (this.type.normalize) op.op = this.type.normalize(op.op);
    // Try to skip processing no-ops.
    if (options.skipNoop && this.type.isNoop && this.type.isNoop(op.op)) {
      if (callback) process.nextTick(callback);
      return;
    }
  }

  try {
    this._pushOp(op, callback);
    this._otApply(op, options);
  } catch (error) {
    return this._hardRollback(error);
  }

  // The call to flush is delayed so if submit() is called multiple times
  // synchronously, all the ops are combined before being sent to the server.
  var doc = this;
  process.nextTick(function() {
    doc.flush();
  });
};

Doc.prototype._pushOp = function(op, callback) {
  if (this.applyStack) {
    // If we are in the process of incrementally applying an operation, don't
    // compose the op and push it onto the applyStack so it can be transformed
    // against other components from the op or ops being applied
    this.applyStack.push(op);
  } else {
    // If the type supports composes, try to compose the operation onto the
    // end of the last pending operation.
    var composed = this._tryCompose(op);
    if (composed) {
      composed.callbacks.push(callback);
      return;
    }
  }
  // Push on to the pendingOps queue of ops to submit if we didn't compose
  op.type = this.type;
  op.callbacks = [callback];
  this.pendingOps.push(op);
};

Doc.prototype._popApplyStack = function(to) {
  if (to > 0) {
    this.applyStack.length = to;
    return;
  }
  // Once we have completed the outermost apply loop, reset to null and no
  // longer add ops to the applyStack as they are submitted
  var op = this.applyStack[0];
  this.applyStack = null;
  if (!op) return;
  // Compose the ops added since the beginning of the apply stack, since we
  // had to skip compose when they were originally pushed
  var i = this.pendingOps.indexOf(op);
  if (i === -1) return;
  var ops = this.pendingOps.splice(i);
  for (var i = 0; i < ops.length; i++) {
    var op = ops[i];
    var composed = this._tryCompose(op);
    if (composed) {
      composed.callbacks = composed.callbacks.concat(op.callbacks);
    } else {
      this.pendingOps.push(op);
    }
  }
};

// Try to compose a submitted op into the last pending op. Returns the
// composed op if it succeeds, undefined otherwise
Doc.prototype._tryCompose = function(op) {
  if (this.preventCompose) return;

  // We can only compose into the last pending op. Inflight ops have already
  // been sent to the server, so we can't modify them
  var last = this.pendingOps[this.pendingOps.length - 1];
  if (!last) return;

  // Compose two ops into a single op if supported by the type. Types that
  // support compose must be able to compose any two ops together
  if (last.op && op.op && this.type.compose) {
    last.op = this.type.compose(last.op, op.op);
    return last;
  }
};

// *** Client OT entrypoints.

// Submit an operation to the document.
//
// @param component operation handled by the OT type
// @param options.source passed into 'op' event handler
// @param options.skipNoop should processing be skipped entirely, if `component` is a no-op.
// @param options.undoable should the operation be undoable
// @param options.fixUp If true, this operation is meant to fix the current invalid state of the snapshot.
//   It also updates UndoManagers accordingly. This feature requires the OT type to implement `compose`.
// @param [callback] called after operation submitted
//
// @fires before op, op
Doc.prototype.submitOp = function(component, options, callback) {
  if (typeof options === 'function') {
    callback = options;
    options = null;
  }
  var op = {op: component};
  var submitOptions = {
    source: options && options.source,
    skipNoop: options && options.skipNoop,
    undoable: options && options.undoable,
    fixUp: options && options.fixUp
  };
  this._submit(op, submitOptions, callback);
};

// Submits new content for the document.
//
// This function works only if the type supports `diff` or `diffX`.
// It diffs the current and new snapshot to generate an operation,
// which is then submitted as usual.
//
// @param snapshot new snapshot data
// @param options.source passed into 'op' event handler
// @param options.skipNoop should processing be skipped entirely, if the generated operation is a no-op.
// @param options.undoable should the operation be undoable
// @param options.fixUp If true, this operation is meant to fix the current invalid state of the snapshot.
//   It also updates UndoManagers accordingly. This feature requires the OT type to implement `compose`.
// @param options.diffHint a hint passed into diff/diffX
// @param [callback] called after operation submitted

// @fires before op, op
Doc.prototype.submitSnapshot = function(snapshot, options, callback) {
  if (typeof options === 'function') {
    callback = options;
    options = null;
  }
  if (!this.type) {
    var err = new ShareDBError(4015, 'Cannot submit snapshot. Document has not been created. ' + this.collection + '.' + this.id);
    if (callback) return callback(err);
    return this.emit('error', err);
  }
  if (!this.type.diff && !this.type.diffX) {
    var err = new ShareDBError(4027, 'Cannot submit snapshot. Document type does not support diff nor diffX. ' + this.collection + '.' + this.id);
    if (callback) return callback(err);
    return this.emit('error', err);
  }

  var undoable = !!(options && options.undoable);
  var fixUp = options && options.fixUp;
  var diffHint = options && options.diffHint;
  var needsUndoOp = undoable || fixUp;
  var op, undoOp;

  if ((needsUndoOp && this.type.diffX) || !this.type.diff) {
    var diffs = this.type.diffX(this.data, snapshot, diffHint);
    undoOp = { op: diffs[0] };
    op = { op: diffs[1] };
  } else {
    undoOp = null;
    op = { op: this.type.diff(this.data, snapshot, diffHint) };
  }

  var submitOptions = {
    source: options && options.source,
    skipNoop: options && options.skipNoop,
    undoable: undoable,
    undoOp: undoOp,
    fixUp: fixUp
  };
  this._submit(op, submitOptions, callback);
};

// Create the document, which in ShareJS semantics means to set its type. Every
// object implicitly exists in the database but has no data and no type. Create
// sets the type of the object and can optionally set some initial data on the
// object, depending on the type.
//
// @param data  initial
// @param type  OT type
// @param options  {source: ...}
// @param callback  called when operation submitted
Doc.prototype.create = function(data, type, options, callback) {
  if (typeof type === 'function') {
    callback = type;
    options = null;
    type = null;
  } else if (typeof options === 'function') {
    callback = options;
    options = null;
  }
  if (!type) {
    type = types.defaultType.uri;
  }
  if (this.type) {
    var err = new ShareDBError(4016, 'Document already exists');
    if (callback) return callback(err);
    return this.emit('error', err);
  }
  var op = {create: {type: type, data: data}};
  var source = options && options.source;
  this._submit(op, { source: source }, callback);
};

// Delete the document. This creates and submits a delete operation to the
// server. Deleting resets the object's type to null and deletes its data. The
// document still exists, and still has the version it used to have before you
// deleted it (well, old version +1).
//
// @param options  {source: ...}
// @param callback  called when operation submitted
Doc.prototype.del = function(options, callback) {
  if (typeof options === 'function') {
    callback = options;
    options = null;
  }
  if (!this.type) {
    var err = new ShareDBError(4015, 'Document does not exist');
    if (callback) return callback(err);
    return this.emit('error', err);
  }
  var op = {del: true};
  var source = options && options.source;
  this._submit(op, { source: source }, callback);
};


// Stops the document from sending any operations to the server.
Doc.prototype.pause = function() {
  this.paused = true;
};

// Continue sending operations to the server
Doc.prototype.resume = function() {
  this.paused = false;
  this.flush();
};


// *** Receiving operations

// This is called when the server acknowledges an operation from the client.
Doc.prototype._opAcknowledged = function(message) {
  if (this.inflightOp.create) {
    this.version = message.v;
    this.cachedOps.length = 0;

  } else if (message.v !== this.version) {
    // We should already be at the same version, because the server should
    // have sent all the ops that have happened before acknowledging our op
    logger.warn('Invalid version from server. Expected: ' + this.version + ' Received: ' + message.v, message);

    // Fetching should get us back to a working document state
    return this.fetch();
  }

  // The op was committed successfully. Increment the version number
  this.version++;
  this._cacheOp({
    src: this.inflightOp.src,
    time: Date.now(),
    create: !!this.inflightOp.create,
    op: this.inflightOp.op,
    del: !!this.inflightOp.del
  });

  this._clearInflightOp();
  this._processAllReceivedPresence();
};

Doc.prototype._rollback = function(err) {
  // The server has rejected submission of the current operation. Invert by
  // just the inflight op if possible. If not possible to invert, cancel all
  // pending ops and fetch the latest from the server to get us back into a
  // working state, then call back
  var op = this.inflightOp;

  if (op.op && op.type.invert) {
    op.op = op.type.invert(op.op);

    // Transform the undo operation by any pending ops.
    for (var i = 0; i < this.pendingOps.length; i++) {
      var transformErr = transformX(this.pendingOps[i], op);
      if (transformErr) return this._hardRollback(transformErr);
    }

    // ... and apply it locally, reverting the changes.
    //
    // This operation is applied to look like it comes from a remote source.
    // I'm still not 100% sure about this functionality, because its really a
    // local op. Basically, the problem is that if the client's op is rejected
    // by the server, the editor window should update to reflect the undo.
    try {
      this._otApply(op);
    } catch (error) {
      return this._hardRollback(error);
    }

    this._clearInflightOp(err);
    return;
  }

  this._hardRollback(err);
};

Doc.prototype._hardRollback = function(err) {
  var callbacks = [];
  if (this.inflightPresence) {
    callbacks.push.apply(callbacks, this.inflightPresence);
    this.inflightPresence = null;
    this.inflightPresenceSeq = 0;
  }
  if (this.pendingPresence) {
    callbacks.push.apply(callbacks, this.pendingPresence);
    this.pendingPresence = null;
  }
  if (this.inflightOp) {
    callbacks.push.apply(callbacks, this.inflightOp.callbacks);
  }
  for (var i = 0; i < this.pendingOps.length; i++) {
    callbacks.push.apply(callbacks, this.pendingOps[i].callbacks);
  }

  this._setType(null);
  this.version = null;
  this.inflightOp = null;
  this.pendingOps = [];
  this.cachedOps.length = 0;
  this.receivedPresence = Object.create(null);
  this.requestReplyPresence = true;

  var srcList = Object.keys(this.presence);
  var changedSrcList = [];
  for (var i = 0; i < srcList.length; i++) {
    var src = srcList[i];
    if (this._setPresence(src, null)) {
      changedSrcList.push(src);
    }
  }
  this._emitPresence(changedSrcList, false);

  // Fetch the latest version from the server to get us back into a working state
  var doc = this;
  this.fetch(function() {
    var called = callEach(callbacks, err);
    if (err && !called) return doc.emit('error', err);
  });
};

Doc.prototype._clearInflightOp = function(err) {
  var callbacks = this.inflightOp && this.inflightOp.callbacks;
  this.inflightOp = null;
  var called = callbacks && callEach(callbacks, err);

  this.flush();
  this._emitNothingPending();

  if (err && !called) return this.emit('error', err);
};

function callEach(callbacks, err) {
  var called = false;
  for (var i = 0; i < callbacks.length; i++) {
    var callback = callbacks[i];
    if (callback) {
      callback(err);
      called = true;
    }
  }
  return called;
}

// *** Presence

Doc.prototype.submitPresence = function (data, callback) {
  if (data != null) {
    if (!this.type) {
      var doc = this;
      return process.nextTick(function() {
        var err = new ShareDBError(4015, 'Cannot submit presence. Document has not been created. ' + doc.collection + '.' + doc.id);
        if (callback) return callback(err);
        doc.emit('error', err);
      });
    }

    if (!this.type.createPresence || !this.type.transformPresence) {
      var doc = this;
      return process.nextTick(function() {
        var err = new ShareDBError(4029, 'Cannot submit presence. Document\'s type does not support presence. ' + doc.collection + '.' + doc.id);
        if (callback) return callback(err);
        doc.emit('error', err);
      });
    }

    data = this.type.createPresence(data);
  }

  if (this._setPresence('', data, true) || this.pendingPresence || this.inflightPresence) {
    if (!this.pendingPresence) {
      this.pendingPresence = [];
    }
    if (callback) {
      this.pendingPresence.push(callback);
    }

  } else if (callback) {
    process.nextTick(callback);
  }

  var doc = this;
  process.nextTick(function() {
    doc.flush();
  });
};

Doc.prototype._handlePresence = function(err, presence) {
  if (!this.subscribed) return;

  var src = presence.src;
  if (!src) {
    // Handle the ACK for the presence data we submitted.
    // this.inflightPresenceSeq would not equal presence.seq after a hard rollback,
    // when all callbacks are flushed with an error.
    if (this.inflightPresenceSeq === presence.seq) {
      var callbacks = this.inflightPresence;
      this.inflightPresence = null;
      this.inflightPresenceSeq = 0;
      var called = callbacks && callEach(callbacks, err);
      if (err && !called) this.emit('error', err);
      this.flush();
      this._emitNothingPending();
    }
    return;
  }

  // This shouldn't happen but check just in case.
  if (err) return this.emit('error', err);

  if (presence.r && !this.pendingPresence) {
    // Another client requested us to share our current presence data
    this.pendingPresence = [];
    this.flush();
  }

  // Ignore older messages which arrived out of order
  if (
    this.receivedPresence[src] && (
      this.receivedPresence[src].seq > presence.seq ||
      (this.receivedPresence[src].seq === presence.seq && presence.v != null)
    )
  ) return;

  this.receivedPresence[src] = presence;

  if (presence.v == null) {
      // null version should happen only when the server automatically sends
      // null presence for an unsubscribed client
      presence.processedAt = Date.now();
      return this._setPresence(src, null, true);
  }

  // Get missing ops first, if necessary
  if (this.version == null || this.version < presence.v) return this.fetch();

  this._processReceivedPresence(src, true);
};

// If emit is true and presence has changed, emits a presence event.
// Returns true, if presence has changed for src. Otherwise false.
Doc.prototype._processReceivedPresence = function(src, emit) {
  if (!src) return false;
  var presence = this.receivedPresence[src];
  if (!presence) return false;

  if (presence.processedAt != null) {
    if (Date.now() >= presence.processedAt + this.receivedPresenceTimeout) {
        // Remove old received and processed presence
        delete this.receivedPresence[src];
    }
    return false;
  }

  if (this.version == null || this.version < presence.v) return false; // keep waiting for the missing snapshot or ops

  if (presence.p == null) {
    // Remove presence data as requested
    presence.processedAt = Date.now();
    return this._setPresence(src, null, emit);
  }

  if (!this.type || !this.type.createPresence || !this.type.transformPresence) {
    // Remove presence data because the document is not created or its type does not support presence
    presence.processedAt = Date.now();
    return this._setPresence(src, null, emit);
  }

  if (this.inflightOp && this.inflightOp.op == null) {
    // Remove presence data because receivedPresence can be transformed only against "op", not "create" nor "del"
    presence.processedAt = Date.now();
    return this._setPresence(src, null, emit);
  }

  for (var i = 0; i < this.pendingOps.length; i++) {
    if (this.pendingOps[i].op == null) {
      // Remove presence data because receivedPresence can be transformed only against "op", not "create" nor "del"
      presence.processedAt = Date.now();
      return this._setPresence(src, null, emit);
    }
  }

  var startIndex = this.cachedOps.length - (this.version - presence.v);
  if (startIndex < 0) {
    // Remove presence data because we can't transform receivedPresence
    presence.processedAt = Date.now();
    return this._setPresence(src, null, emit);
  }

  for (var i = startIndex; i < this.cachedOps.length; i++) {
    if (this.cachedOps[i].op == null) {
      // Remove presence data because receivedPresence can be transformed only against "op", not "create" nor "del"
      presence.processedAt = Date.now();
      return this._setPresence(src, null, emit);
    }
  }

  // Make sure the format of the data is correct
  var data = this.type.createPresence(presence.p);

  // Transform against past ops
  for (var i = startIndex; i < this.cachedOps.length; i++) {
    var op = this.cachedOps[i];
    data = this.type.transformPresence(data, op.op, presence.src === op.src);
  }

  // Transform against pending ops
  if (this.inflightOp) {
    data = this.type.transformPresence(data, this.inflightOp.op, false);
  }

  for (var i = 0; i < this.pendingOps.length; i++) {
    data = this.type.transformPresence(data, this.pendingOps[i].op, false);
  }

  // Set presence data
  presence.processedAt = Date.now();
  return this._setPresence(src, data, emit);
};

Doc.prototype._processAllReceivedPresence = function() {
  var srcList = Object.keys(this.receivedPresence);
  var changedSrcList = [];
  for (var i = 0; i < srcList.length; i++) {
    var src = srcList[i];
    if (this._processReceivedPresence(src)) {
        changedSrcList.push(src);
    }
  }
  this._emitPresence(changedSrcList, true);
};

Doc.prototype._transformPresence = function(src, op) {
  var presenceData = this.presence[src];
  if (op.op != null) {
    var isOwnOperation = src === (op.src || '');
    presenceData = this.type.transformPresence(presenceData, op.op, isOwnOperation);
  } else {
    presenceData = null;
  }
  return this._setPresence(src, presenceData);
};

Doc.prototype._transformAllPresence = function(op) {
  var srcList = Object.keys(this.presence);
  var changedSrcList = [];
  for (var i = 0; i < srcList.length; i++) {
    var src = srcList[i];
    if (this._transformPresence(src, op)) {
      changedSrcList.push(src);
    }
  }
  this._emitPresence(changedSrcList, false);
};

Doc.prototype._pausePresence = function() {
  if (this.inflightPresence) {
    this.pendingPresence =
      this.pendingPresence ?
        this.inflightPresence.concat(this.pendingPresence) :
        this.inflightPresence;
    this.inflightPresence = null;
    this.inflightPresenceSeq = 0;
  } else if (!this.pendingPresence && this.presence[''] != null) {
    this.pendingPresence = [];
  }
  this.receivedPresence = Object.create(null);
  this.requestReplyPresence = true;
  var srcList = Object.keys(this.presence);
  var changedSrcList = [];
  for (var i = 0; i < srcList.length; i++) {
    var src = srcList[i];
    if (src && this._setPresence(src, null)) {
      changedSrcList.push(src);
    }
  }
  this._emitPresence(changedSrcList, false);
};

// If emit is true and presence has changed, emits a presence event.
// Returns true, if presence has changed. Otherwise false.
Doc.prototype._setPresence = function(src, data, emit) {
  if (data == null) {
    if (this.presence[src] == null) return false;
    delete this.presence[src];
  } else {
    var isPresenceEqual =
      this.presence[src] === data ||
      (this.type.comparePresence && this.type.comparePresence(this.presence[src], data));
    if (isPresenceEqual) return false;
    this.presence[src] = data;
  }
  if (emit) this._emitPresence([ src ], true);
  return true;
};

Doc.prototype._emitPresence = function(srcList, submitted) {
  if (srcList && srcList.length > 0) {
    var doc = this;
    process.nextTick(function() {
      doc.emit('presence', srcList, submitted);
    });
  }
};

Doc.prototype._cacheOp = function(op) {
  // Remove the old ops.
  var oldOpTime = Date.now() - this.cachedOpsTimeout;
  var i;
  for (i = 0; i < this.cachedOps.length; i++) {
    if (this.cachedOps[i].time >= oldOpTime) {
      break;
    }
  }
  if (i > 0) {
    this.cachedOps.splice(0, i);
  }

  // Cache the new op.
  this.cachedOps.push(op);
};

}).call(this,require('_process'))
},{"../emitter":23,"../error":24,"../logger":25,"../types":28,"_process":36}],17:[function(require,module,exports){
exports.Connection = require('./connection');
exports.Doc = require('./doc');
exports.Error = require('../error');
exports.Query = require('./query');
exports.types = require('../types');
exports.logger = require('../logger');

},{"../error":24,"../logger":25,"../types":28,"./connection":15,"./doc":16,"./query":18}],18:[function(require,module,exports){
(function (process){
var emitter = require('../emitter');

// Queries are live requests to the database for particular sets of fields.
//
// The server actively tells the client when there's new data that matches
// a set of conditions.
module.exports = Query;
function Query(action, connection, id, collection, query, options, callback) {
  emitter.EventEmitter.call(this);

  // 'qf' or 'qs'
  this.action = action;

  this.connection = connection;
  this.id = id;
  this.collection = collection;

  // The query itself. For mongo, this should look something like {"data.x":5}
  this.query = query;

  // A list of resulting documents. These are actual documents, complete with
  // data and all the rest. It is possible to pass in an initial results set,
  // so that a query can be serialized and then re-established
  this.results = null;
  if (options && options.results) {
    this.results = options.results;
    delete options.results;
  }
  this.extra = undefined;

  // Options to pass through with the query
  this.options = options;

  this.callback = callback;
  this.ready = false;
  this.sent = false;
}
emitter.mixin(Query);

Query.prototype.hasPending = function() {
  return !this.ready;
};

// Helper for subscribe & fetch, since they share the same message format.
//
// This function actually issues the query.
Query.prototype.send = function() {
  if (!this.connection.canSend) return;

  var message = {
    a: this.action,
    id: this.id,
    c: this.collection,
    q: this.query
  };
  if (this.options) {
    message.o = this.options;
  }
  if (this.results) {
    // Collect the version of all the documents in the current result set so we
    // don't need to be sent their snapshots again.
    var results = [];
    for (var i = 0; i < this.results.length; i++) {
      var doc = this.results[i];
      results.push([doc.id, doc.version]);
    }
    message.r = results;
  }

  this.connection.send(message);
  this.sent = true;
};

// Destroy the query object. Any subsequent messages for the query will be
// ignored by the connection.
Query.prototype.destroy = function(callback) {
  if (this.connection.canSend && this.action === 'qs') {
    this.connection.send({a: 'qu', id: this.id});
  }
  this.connection._destroyQuery(this);
  // There is a callback for consistency, but we don't actually wait for the
  // server's unsubscribe message currently
  if (callback) process.nextTick(callback);
};

Query.prototype._onConnectionStateChanged = function() {
  if (this.connection.canSend && !this.sent) {
    this.send();
  } else {
    this.sent = false;
  }
};

Query.prototype._handleFetch = function(err, data, extra) {
  // Once a fetch query gets its data, it is destroyed.
  this.connection._destroyQuery(this);
  this._handleResponse(err, data, extra);
};

Query.prototype._handleSubscribe = function(err, data, extra) {
  this._handleResponse(err, data, extra);
};

Query.prototype._handleResponse = function(err, data, extra) {
  var callback = this.callback;
  this.callback = null;
  if (err) return this._finishResponse(err, callback);
  if (!data) return this._finishResponse(null, callback);

  var query = this;
  var wait = 1;
  var finish = function(err) {
    if (err) return query._finishResponse(err, callback);
    if (--wait) return;
    query._finishResponse(null, callback);
  };

  if (Array.isArray(data)) {
    wait += data.length;
    this.results = this._ingestSnapshots(data, finish);
    this.extra = extra;

  } else {
    for (var id in data) {
      wait++;
      var snapshot = data[id];
      var doc = this.connection.get(snapshot.c || this.collection, id);
      doc.ingestSnapshot(snapshot, finish);
    }
  }

  finish();
};

Query.prototype._ingestSnapshots = function(snapshots, finish) {
  var results = [];
  for (var i = 0; i < snapshots.length; i++) {
    var snapshot = snapshots[i];
    var doc = this.connection.get(snapshot.c || this.collection, snapshot.d);
    doc.ingestSnapshot(snapshot, finish);
    results.push(doc);
  }
  return results;
};

Query.prototype._finishResponse = function(err, callback) {
  this.emit('ready');
  this.ready = true;
  if (err) {
    this.connection._destroyQuery(this);
    if (callback) return callback(err);
    return this.emit('error', err);
  }
  if (callback) callback(null, this.results, this.extra);
};

Query.prototype._handleError = function(err) {
  this.emit('error', err);
};

Query.prototype._handleDiff = function(diff) {
  // We need to go through the list twice. First, we'll ingest all the new
  // documents. After that we'll emit events and actually update our list.
  // This avoids race conditions around setting documents to be subscribed &
  // unsubscribing documents in event callbacks.
  for (var i = 0; i < diff.length; i++) {
    var d = diff[i];
    if (d.type === 'insert') d.values = this._ingestSnapshots(d.values);
  }

  for (var i = 0; i < diff.length; i++) {
    var d = diff[i];
    switch (d.type) {
      case 'insert':
        var newDocs = d.values;
        Array.prototype.splice.apply(this.results, [d.index, 0].concat(newDocs));
        this.emit('insert', newDocs, d.index);
        break;
      case 'remove':
        var howMany = d.howMany || 1;
        var removed = this.results.splice(d.index, howMany);
        this.emit('remove', removed, d.index);
        break;
      case 'move':
        var howMany = d.howMany || 1;
        var docs = this.results.splice(d.from, howMany);
        Array.prototype.splice.apply(this.results, [d.to, 0].concat(docs));
        this.emit('move', docs, d.from, d.to);
        break;
    }
  }

  this.emit('changed', this.results);
};

Query.prototype._handleExtra = function(extra) {
  this.extra = extra;
  this.emit('extra', extra);
};

}).call(this,require('_process'))
},{"../emitter":23,"_process":36}],19:[function(require,module,exports){
var Snapshot = require('../../snapshot');
var emitter = require('../../emitter');

module.exports = SnapshotRequest;

function SnapshotRequest(connection, requestId, collection, id, callback) {
  emitter.EventEmitter.call(this);

  if (typeof callback !== 'function') {
    throw new Error('Callback is required for SnapshotRequest');
  }

  this.requestId = requestId;
  this.connection = connection;
  this.id = id;
  this.collection = collection;
  this.callback = callback;

  this.sent = false;
}
emitter.mixin(SnapshotRequest);

SnapshotRequest.prototype.send = function () {
  if (!this.connection.canSend) {
    return;
  }

  this.connection.send(this._message());
  this.sent = true;
};

SnapshotRequest.prototype._onConnectionStateChanged = function () {
  if (this.connection.canSend) {
    if (!this.sent) this.send();
  } else {
    // If the connection can't send, then we've had a disconnection, and even if we've already sent
    // the request previously, we need to re-send it over this reconnected client, so reset the
    // sent flag to false.
    this.sent = false;
  }
};

SnapshotRequest.prototype._handleResponse = function (error, message) {
  this.emit('ready');

  if (error) {
    return this.callback(error);
  }

  var metadata = message.meta ? message.meta : null;
  var snapshot = new Snapshot(this.id, message.v, message.type, message.data, metadata);

  this.callback(null, snapshot);
};

},{"../../emitter":23,"../../snapshot":27}],20:[function(require,module,exports){
var SnapshotRequest = require('./snapshot-request');
var util = require('../../util');

module.exports = SnapshotTimestampRequest;

function SnapshotTimestampRequest(connection, requestId, collection, id, timestamp, callback) {
  SnapshotRequest.call(this, connection, requestId, collection, id, callback);

  if (!util.isValidTimestamp(timestamp)) {
    throw new Error('Snapshot timestamp must be a positive integer or null');
  }

  this.timestamp = timestamp;
}

SnapshotTimestampRequest.prototype = Object.create(SnapshotRequest.prototype);

SnapshotTimestampRequest.prototype._message = function () {
  return {
    a: 'nt',
    id: this.requestId,
    c: this.collection,
    d: this.id,
    ts: this.timestamp,
  };
};

},{"../../util":29,"./snapshot-request":19}],21:[function(require,module,exports){
var SnapshotRequest = require('./snapshot-request');
var util = require('../../util');

module.exports = SnapshotVersionRequest;

function SnapshotVersionRequest (connection, requestId, collection, id, version, callback) {
  SnapshotRequest.call(this, connection, requestId, collection, id, callback);

  if (!util.isValidVersion(version)) {
    throw new Error('Snapshot version must be a positive integer or null');
  }

  this.version = version;
}

SnapshotVersionRequest.prototype = Object.create(SnapshotRequest.prototype);

SnapshotVersionRequest.prototype._message = function () {
  return {
    a: 'nf',
    id: this.requestId,
    c: this.collection,
    d: this.id,
    v: this.version,
  };
};

},{"../../util":29,"./snapshot-request":19}],22:[function(require,module,exports){
(function (process){
function findLastIndex(stack, doc) {
  var index = stack.length - 1;
  while (index >= 0) {
    if (stack[index].doc === doc) break;
    index--;
  }
  return index;
}

function getLast(list) {
  var lastIndex = list.length - 1;
  /* istanbul ignore if */
  if (lastIndex < 0) throw new Error('List empty');
  return list[lastIndex];
}

function setLast(list, item) {
  var lastIndex = list.length - 1;
  /* istanbul ignore if */
  if (lastIndex < 0) throw new Error('List empty');
  list[lastIndex] = item;
}

function Op(op, doc) {
  this.op = op;
  this.doc = doc;
  this.needsUndoOp = true;
}

// Manages an undo/redo stack for all operations from the specified `source`.
module.exports = UndoManager;
function UndoManager(connection, options) {
  // The Connection which created this UndoManager.
  this._connection = connection;

  // If != null, only ops from this "source" will be undoable.
  this._source = options && options.source;

  // The max number of undo operations to keep on the stack.
  this._limit = options && typeof options.limit === 'number' ? options.limit : 100;

  // The max time difference between operations in milliseconds,
  // which still allows the operations to be composed on the undoStack.
  this._composeInterval = options && typeof options.composeInterval === 'number' ? options.composeInterval : 1000;

  // Undo stack for local operations.
  this._undoStack = [];

  // Redo stack for local operations.
  this._redoStack = [];

  // The timestamp of the previous reversible operation. Used to determine if
  // the next reversible operation can be composed on the undoStack.
  this._previousUndoableOperationTime = -Infinity;
}

UndoManager.prototype.destroy = function() {
  this._connection.removeUndoManager(this);
  this.clear();
};

// Clear the undo and redo stack.
//
// @param doc If specified, clear only the ops belonging to this doc.
UndoManager.prototype.clear = function(doc) {
  if (doc) {
    var filter = function(item) { return item.doc !== doc; };
    this._undoStack = this._undoStack.filter(filter);
    this._redoStack = this._redoStack.filter(filter);
  } else {
    this._undoStack.length = 0;
    this._redoStack.length = 0;
  }
};

// Returns true, if there are any operations on the undo stack, otherwise false.
UndoManager.prototype.canUndo = function() {
  return this._undoStack.length > 0
};

// Undoes a submitted operation.
//
// @param options {source: ...}
// @param [callback] called after operation submitted
// @fires before op, op
UndoManager.prototype.undo = function(options, callback) {
  if (typeof options === 'function') {
    callback = options;
    options = null;
  }

  if (!this.canUndo()) {
    if (callback) process.nextTick(callback);
    return;
  }

  var op = getLast(this._undoStack);
  var submitOptions = { source: options && options.source };
  op.doc._submit(op, submitOptions, callback);
};

// Returns true, if there are any operations on the redo stack, otherwise false.
UndoManager.prototype.canRedo = function() {
  return this._redoStack.length > 0;
};

// Redoes an undone operation.
//
// @param options {source: ...}
// @param [callback] called after operation submitted
// @fires before op, op
UndoManager.prototype.redo = function(options, callback) {
  if (typeof options === 'function') {
    callback = options;
    options = null;
  }

  if (!this.canRedo()) {
    if (callback) process.nextTick(callback);
    return;
  }

  var op = getLast(this._redoStack);
  var submitOptions = { source: options && options.source };
  op.doc._submit(op, submitOptions, callback);
};

UndoManager.prototype.onDocLoad = function(doc) {
  this.clear(doc);
};

UndoManager.prototype.onDocDestroy = function(doc) {
  this.clear(doc);
};

UndoManager.prototype.onDocCreate = function(doc) {
  // NOTE We don't support undo on create because we can't support undo on delete.
};

UndoManager.prototype.onDocDelete = function(doc) {
  // NOTE We can't support undo on delete because we can't generate `initialData` required for `create`.
  // See https://github.com/ottypes/docs#standard-properties.
  //
  // We could support undo on delete and create in the future but that would require some breaking changes to ShareDB.
  // Here's what we could do:
  //
  // 1. Do NOT call `create` in ShareDB - ShareDB would get a valid snapshot from the client code.
  // 2. Add `validate` to OT types.
  // 3. Call `validate` in ShareDB to ensure that the snapshot from the client is valid.
  // 4. The `create` ops would contain serialized snapshots instead of `initialData`.
  this.clear(doc);
};

UndoManager.prototype.onDocOp = function(doc, op, undoOp, source, undoable, fixUp) {
  if (this.canUndo() && getLast(this._undoStack) === op) {
    this._undoStack.pop();
    this._updateStacksUndo(doc, op.op, undoOp.op);

  } else if (this.canRedo() && getLast(this._redoStack) === op) {
    this._redoStack.pop();
    this._updateStacksRedo(doc, op.op, undoOp.op);

  } else if (!fixUp && undoable && (this._source == null || this._source === source)) {
    this._updateStacksUndoable(doc, op.op, undoOp.op);

  } else {
    this._updateStacksFixed(doc, op.op, undoOp && undoOp.op, fixUp);
  }
};

UndoManager.prototype._updateStacksUndoable = function(doc, op, undoOp) {
  var isNoop = doc.type.isNoop;

  if (isNoop && isNoop(undoOp)) {
    return
  }

  var now = Date.now();

  if (
    this._undoStack.length === 0 ||
    getLast(this._undoStack).doc !== doc ||
    now - this._previousUndoableOperationTime > this._composeInterval
  ) {
    this._undoStack.push(new Op(undoOp, doc));

  } else if (doc.type.composeSimilar) {
    var lastOp = getLast(this._undoStack);
    var composedOp = doc.type.composeSimilar(undoOp, lastOp.op);
    if (composedOp != null) {
      setLast(this._undoStack, new Op(composedOp, doc));
    } else {
      this._undoStack.push(new Op(undoOp, doc));
    }

  } else if (doc.type.compose) {
    var lastOp = getLast(this._undoStack);
    var composedOp = doc.type.compose(undoOp, lastOp.op);
    setLast(this._undoStack, new Op(composedOp, doc));

  } else {
    this._undoStack.push(new Op(undoOp, doc));
  }

  this._redoStack.length = 0;
  this._previousUndoableOperationTime = now;

  if (isNoop && isNoop(getLast(this._undoStack).op)) {
    this._undoStack.pop();
  }

  var itemsToRemove = this._undoStack.length - this._limit;
  if (itemsToRemove > 0) {
    this._undoStack.splice(0, itemsToRemove);
  }
};

UndoManager.prototype._updateStacksUndo = function(doc, op, undoOp) {
  /* istanbul ignore else */
  if (!doc.type.isNoop || !doc.type.isNoop(undoOp)) {
    this._redoStack.push(new Op(undoOp, doc));
  }
  this._previousUndoableOperationTime = -Infinity;
};

UndoManager.prototype._updateStacksRedo = function(doc, op, undoOp) {
  /* istanbul ignore else */
  if (!doc.type.isNoop || !doc.type.isNoop(undoOp)) {
    this._undoStack.push(new Op(undoOp, doc));
  }
  this._previousUndoableOperationTime = -Infinity;
};

UndoManager.prototype._updateStacksFixed = function(doc, op, undoOp, fixUp) {
  if (fixUp && undoOp != null && doc.type.compose) {
    var lastUndoIndex = findLastIndex(this._undoStack, doc);
    if (lastUndoIndex >= 0) {
      var lastOp = this._undoStack[lastUndoIndex];
      var composedOp = doc.type.compose(undoOp, lastOp.op);
      if (!doc.type.isNoop || !doc.type.isNoop(composedOp)) {
        this._undoStack[lastUndoIndex] = new Op(composedOp, doc);
      } else {
        this._undoStack.splice(lastUndoIndex, 1);
      }
    }

    var lastRedoIndex = findLastIndex(this._redoStack, doc);
    if (lastRedoIndex >= 0) {
      var lastOp = this._redoStack[lastRedoIndex];
      var composedOp = doc.type.compose(undoOp, lastOp.op);
      if (!doc.type.isNoop || !doc.type.isNoop(composedOp)) {
        this._redoStack[lastRedoIndex] = new Op(composedOp, doc);
      } else {
        this._redoStack.splice(lastRedoIndex, 1);
      }
    }

  } else {
    this._undoStack = this._transformStack(this._undoStack, doc, op);
    this._redoStack = this._transformStack(this._redoStack, doc, op);
  }
};

UndoManager.prototype._transformStack = function(stack, doc, op) {
  var transform = doc.type.transform;
  var transformX = doc.type.transformX;
  var isNoop = doc.type.isNoop;
  var newStack = [];
  var newStackIndex = 0;

  for (var i = stack.length - 1; i >= 0; --i) {
    var item = stack[i];
    if (item.doc !== doc) {
      newStack[newStackIndex++] = item;
      continue;
    }
    var stackOp = item.op;
    var transformedStackOp;
    var transformedOp;

    if (transformX) {
      var result = transformX(op, stackOp);
      transformedOp = result[0];
      transformedStackOp = result[1];
    } else {
      transformedOp = transform(op, stackOp, 'left');
      transformedStackOp = transform(stackOp, op, 'right');
    }

    if (!isNoop || !isNoop(transformedStackOp)) {
      newStack[newStackIndex++] = new Op(transformedStackOp, doc);
    }

    op = transformedOp;
  }

  return newStack.reverse();
};

}).call(this,require('_process'))
},{"_process":36}],23:[function(require,module,exports){
var EventEmitter = require('events').EventEmitter;

exports.EventEmitter = EventEmitter;
exports.mixin = mixin;

function mixin(Constructor) {
  for (var key in EventEmitter.prototype) {
    Constructor.prototype[key] = EventEmitter.prototype[key];
  }
}

},{"events":30}],24:[function(require,module,exports){
var makeError = require('make-error');

function ShareDBError(code, message) {
  ShareDBError.super.call(this, message);
  this.code = code;
}

makeError(ShareDBError);

module.exports = ShareDBError;

},{"make-error":31}],25:[function(require,module,exports){
var Logger = require('./logger');
var logger = new Logger();
module.exports = logger;

},{"./logger":26}],26:[function(require,module,exports){
var SUPPORTED_METHODS = [
  'info',
  'warn',
  'error'
];

function Logger() {
  this.setMethods(console);
}
module.exports = Logger;

Logger.prototype.setMethods = function (overrides) {
  overrides = overrides || {};
  var logger = this;

  SUPPORTED_METHODS.forEach(function (method) {
    if (typeof overrides[method] === 'function') {
      logger[method] = overrides[method];
    }
  });
};

},{}],27:[function(require,module,exports){
module.exports = Snapshot;
function Snapshot(id, version, type, data, meta) {
  this.id = id;
  this.v = version;
  this.type = type;
  this.data = data;
  this.m = meta;
}

},{}],28:[function(require,module,exports){

exports.defaultType = require('ot-json0').type;

exports.map = {};

exports.register = function(type) {
  if (type.name) exports.map[type.name] = type;
  if (type.uri) exports.map[type.uri] = type;
};

exports.register(exports.defaultType);

},{"ot-json0":33}],29:[function(require,module,exports){

exports.doNothing = doNothing;
function doNothing() {}

exports.hasKeys = function(object) {
  for (var key in object) return true;
  return false;
};

// https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Number/isInteger#Polyfill
exports.isInteger = Number.isInteger || function (value) {
  return typeof value === 'number' &&
    isFinite(value) &&
    Math.floor(value) === value;
};

exports.isValidVersion = function (version) {
  if (version === null) return true;
  return exports.isInteger(version) && version >= 0;
};

exports.isValidTimestamp = function (timestamp) {
  return exports.isValidVersion(timestamp);
};

},{}],30:[function(require,module,exports){
// Copyright Joyent, Inc. and other Node contributors.
//
// Permission is hereby granted, free of charge, to any person obtaining a
// copy of this software and associated documentation files (the
// "Software"), to deal in the Software without restriction, including
// without limitation the rights to use, copy, modify, merge, publish,
// distribute, sublicense, and/or sell copies of the Software, and to permit
// persons to whom the Software is furnished to do so, subject to the
// following conditions:
//
// The above copyright notice and this permission notice shall be included
// in all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
// OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
// MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN
// NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
// DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR
// OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE
// USE OR OTHER DEALINGS IN THE SOFTWARE.

function EventEmitter() {
  this._events = this._events || {};
  this._maxListeners = this._maxListeners || undefined;
}
module.exports = EventEmitter;

// Backwards-compat with node 0.10.x
EventEmitter.EventEmitter = EventEmitter;

EventEmitter.prototype._events = undefined;
EventEmitter.prototype._maxListeners = undefined;

// By default EventEmitters will print a warning if more than 10 listeners are
// added to it. This is a useful default which helps finding memory leaks.
EventEmitter.defaultMaxListeners = 10;

// Obviously not all Emitters should be limited to 10. This function allows
// that to be increased. Set to zero for unlimited.
EventEmitter.prototype.setMaxListeners = function(n) {
  if (!isNumber(n) || n < 0 || isNaN(n))
    throw TypeError('n must be a positive number');
  this._maxListeners = n;
  return this;
};

EventEmitter.prototype.emit = function(type) {
  var er, handler, len, args, i, listeners;

  if (!this._events)
    this._events = {};

  // If there is no 'error' event listener then throw.
  if (type === 'error') {
    if (!this._events.error ||
        (isObject(this._events.error) && !this._events.error.length)) {
      er = arguments[1];
      if (er instanceof Error) {
        throw er; // Unhandled 'error' event
      } else {
        // At least give some kind of context to the user
        var err = new Error('Uncaught, unspecified "error" event. (' + er + ')');
        err.context = er;
        throw err;
      }
    }
  }

  handler = this._events[type];

  if (isUndefined(handler))
    return false;

  if (isFunction(handler)) {
    switch (arguments.length) {
      // fast cases
      case 1:
        handler.call(this);
        break;
      case 2:
        handler.call(this, arguments[1]);
        break;
      case 3:
        handler.call(this, arguments[1], arguments[2]);
        break;
      // slower
      default:
        args = Array.prototype.slice.call(arguments, 1);
        handler.apply(this, args);
    }
  } else if (isObject(handler)) {
    args = Array.prototype.slice.call(arguments, 1);
    listeners = handler.slice();
    len = listeners.length;
    for (i = 0; i < len; i++)
      listeners[i].apply(this, args);
  }

  return true;
};

EventEmitter.prototype.addListener = function(type, listener) {
  var m;

  if (!isFunction(listener))
    throw TypeError('listener must be a function');

  if (!this._events)
    this._events = {};

  // To avoid recursion in the case that type === "newListener"! Before
  // adding it to the listeners, first emit "newListener".
  if (this._events.newListener)
    this.emit('newListener', type,
              isFunction(listener.listener) ?
              listener.listener : listener);

  if (!this._events[type])
    // Optimize the case of one listener. Don't need the extra array object.
    this._events[type] = listener;
  else if (isObject(this._events[type]))
    // If we've already got an array, just append.
    this._events[type].push(listener);
  else
    // Adding the second element, need to change to array.
    this._events[type] = [this._events[type], listener];

  // Check for listener leak
  if (isObject(this._events[type]) && !this._events[type].warned) {
    if (!isUndefined(this._maxListeners)) {
      m = this._maxListeners;
    } else {
      m = EventEmitter.defaultMaxListeners;
    }

    if (m && m > 0 && this._events[type].length > m) {
      this._events[type].warned = true;
      console.error('(node) warning: possible EventEmitter memory ' +
                    'leak detected. %d listeners added. ' +
                    'Use emitter.setMaxListeners() to increase limit.',
                    this._events[type].length);
      if (typeof console.trace === 'function') {
        // not supported in IE 10
        console.trace();
      }
    }
  }

  return this;
};

EventEmitter.prototype.on = EventEmitter.prototype.addListener;

EventEmitter.prototype.once = function(type, listener) {
  if (!isFunction(listener))
    throw TypeError('listener must be a function');

  var fired = false;

  function g() {
    this.removeListener(type, g);

    if (!fired) {
      fired = true;
      listener.apply(this, arguments);
    }
  }

  g.listener = listener;
  this.on(type, g);

  return this;
};

// emits a 'removeListener' event iff the listener was removed
EventEmitter.prototype.removeListener = function(type, listener) {
  var list, position, length, i;

  if (!isFunction(listener))
    throw TypeError('listener must be a function');

  if (!this._events || !this._events[type])
    return this;

  list = this._events[type];
  length = list.length;
  position = -1;

  if (list === listener ||
      (isFunction(list.listener) && list.listener === listener)) {
    delete this._events[type];
    if (this._events.removeListener)
      this.emit('removeListener', type, listener);

  } else if (isObject(list)) {
    for (i = length; i-- > 0;) {
      if (list[i] === listener ||
          (list[i].listener && list[i].listener === listener)) {
        position = i;
        break;
      }
    }

    if (position < 0)
      return this;

    if (list.length === 1) {
      list.length = 0;
      delete this._events[type];
    } else {
      list.splice(position, 1);
    }

    if (this._events.removeListener)
      this.emit('removeListener', type, listener);
  }

  return this;
};

EventEmitter.prototype.removeAllListeners = function(type) {
  var key, listeners;

  if (!this._events)
    return this;

  // not listening for removeListener, no need to emit
  if (!this._events.removeListener) {
    if (arguments.length === 0)
      this._events = {};
    else if (this._events[type])
      delete this._events[type];
    return this;
  }

  // emit removeListener for all listeners on all events
  if (arguments.length === 0) {
    for (key in this._events) {
      if (key === 'removeListener') continue;
      this.removeAllListeners(key);
    }
    this.removeAllListeners('removeListener');
    this._events = {};
    return this;
  }

  listeners = this._events[type];

  if (isFunction(listeners)) {
    this.removeListener(type, listeners);
  } else if (listeners) {
    // LIFO order
    while (listeners.length)
      this.removeListener(type, listeners[listeners.length - 1]);
  }
  delete this._events[type];

  return this;
};

EventEmitter.prototype.listeners = function(type) {
  var ret;
  if (!this._events || !this._events[type])
    ret = [];
  else if (isFunction(this._events[type]))
    ret = [this._events[type]];
  else
    ret = this._events[type].slice();
  return ret;
};

EventEmitter.prototype.listenerCount = function(type) {
  if (this._events) {
    var evlistener = this._events[type];

    if (isFunction(evlistener))
      return 1;
    else if (evlistener)
      return evlistener.length;
  }
  return 0;
};

EventEmitter.listenerCount = function(emitter, type) {
  return emitter.listenerCount(type);
};

function isFunction(arg) {
  return typeof arg === 'function';
}

function isNumber(arg) {
  return typeof arg === 'number';
}

function isObject(arg) {
  return typeof arg === 'object' && arg !== null;
}

function isUndefined(arg) {
  return arg === void 0;
}

},{}],31:[function(require,module,exports){
// ISC @ Julien Fontanet

'use strict'

// ===================================================================

var construct = typeof Reflect !== 'undefined' ? Reflect.construct : undefined
var defineProperty = Object.defineProperty

// -------------------------------------------------------------------

var captureStackTrace = Error.captureStackTrace
if (captureStackTrace === undefined) {
  captureStackTrace = function captureStackTrace (error) {
    var container = new Error()

    defineProperty(error, 'stack', {
      configurable: true,
      get: function getStack () {
        var stack = container.stack

        // Replace property with value for faster future accesses.
        defineProperty(this, 'stack', {
          configurable: true,
          value: stack,
          writable: true
        })

        return stack
      },
      set: function setStack (stack) {
        defineProperty(error, 'stack', {
          configurable: true,
          value: stack,
          writable: true
        })
      }
    })
  }
}

// -------------------------------------------------------------------

function BaseError (message) {
  if (message !== undefined) {
    defineProperty(this, 'message', {
      configurable: true,
      value: message,
      writable: true
    })
  }

  var cname = this.constructor.name
  if (
    cname !== undefined &&
    cname !== this.name
  ) {
    defineProperty(this, 'name', {
      configurable: true,
      value: cname,
      writable: true
    })
  }

  captureStackTrace(this, this.constructor)
}

BaseError.prototype = Object.create(Error.prototype, {
  // See: https://github.com/JsCommunity/make-error/issues/4
  constructor: {
    configurable: true,
    value: BaseError,
    writable: true
  }
})

// -------------------------------------------------------------------

// Sets the name of a function if possible (depends of the JS engine).
var setFunctionName = (function () {
  function setFunctionName (fn, name) {
    return defineProperty(fn, 'name', {
      configurable: true,
      value: name
    })
  }
  try {
    var f = function () {}
    setFunctionName(f, 'foo')
    if (f.name === 'foo') {
      return setFunctionName
    }
  } catch (_) {}
})()

// -------------------------------------------------------------------

function makeError (constructor, super_) {
  if (super_ == null || super_ === Error) {
    super_ = BaseError
  } else if (typeof super_ !== 'function') {
    throw new TypeError('super_ should be a function')
  }

  var name
  if (typeof constructor === 'string') {
    name = constructor
    constructor = construct !== undefined
      ? function () { return construct(super_, arguments, this.constructor) }
      : function () { super_.apply(this, arguments) }

    // If the name can be set, do it once and for all.
    if (setFunctionName !== undefined) {
      setFunctionName(constructor, name)
      name = undefined
    }
  } else if (typeof constructor !== 'function') {
    throw new TypeError('constructor should be either a string or a function')
  }

  // Also register the super constructor also as `constructor.super_` just
  // like Node's `util.inherits()`.
  constructor.super_ = constructor['super'] = super_

  var properties = {
    constructor: {
      configurable: true,
      value: constructor,
      writable: true
    }
  }

  // If the name could not be set on the constructor, set it on the
  // prototype.
  if (name !== undefined) {
    properties.name = {
      configurable: true,
      value: name,
      writable: true
    }
  }
  constructor.prototype = Object.create(super_.prototype, properties)

  return constructor
}
exports = module.exports = makeError
exports.BaseError = BaseError

},{}],32:[function(require,module,exports){
arguments[4][11][0].apply(exports,arguments)
},{"dup":11}],33:[function(require,module,exports){
arguments[4][12][0].apply(exports,arguments)
},{"./json0":34,"dup":12}],34:[function(require,module,exports){
/*
 This is the implementation of the JSON OT type.

 Spec is here: https://github.com/josephg/ShareJS/wiki/JSON-Operations

 Note: This is being made obsolete. It will soon be replaced by the JSON2 type.
*/

/**
 * UTILITY FUNCTIONS
 */

/**
 * Checks if the passed object is an Array instance. Can't use Array.isArray
 * yet because its not supported on IE8.
 *
 * @param obj
 * @returns {boolean}
 */
var isArray = function(obj) {
  return Object.prototype.toString.call(obj) == '[object Array]';
};

/**
 * Checks if the passed object is an Object instance.
 * No function call (fast) version
 *
 * @param obj
 * @returns {boolean}
 */
var isObject = function(obj) {
  return (!!obj) && (obj.constructor === Object);
};

/**
 * Clones the passed object using JSON serialization (which is slow).
 *
 * hax, copied from test/types/json. Apparently this is still the fastest way
 * to deep clone an object, assuming we have browser support for JSON.  @see
 * http://jsperf.com/cloning-an-object/12
 */
var clone = function(o) {
  return JSON.parse(JSON.stringify(o));
};

/**
 * JSON OT Type
 * @type {*}
 */
var json = {
  name: 'json0',
  uri: 'http://sharejs.org/types/JSONv0'
};

// You can register another OT type as a subtype in a JSON document using
// the following function. This allows another type to handle certain
// operations instead of the builtin JSON type.
var subtypes = {};
json.registerSubtype = function(subtype) {
  subtypes[subtype.name] = subtype;
};

json.create = function(data) {
  // Null instead of undefined if you don't pass an argument.
  return data === undefined ? null : clone(data);
};

json.invertComponent = function(c) {
  var c_ = {p: c.p};

  // handle subtype ops
  if (c.t && subtypes[c.t]) {
    c_.t = c.t;
    c_.o = subtypes[c.t].invert(c.o);
  }

  if (c.si !== void 0) c_.sd = c.si;
  if (c.sd !== void 0) c_.si = c.sd;
  if (c.oi !== void 0) c_.od = c.oi;
  if (c.od !== void 0) c_.oi = c.od;
  if (c.li !== void 0) c_.ld = c.li;
  if (c.ld !== void 0) c_.li = c.ld;
  if (c.na !== void 0) c_.na = -c.na;

  if (c.lm !== void 0) {
    c_.lm = c.p[c.p.length-1];
    c_.p = c.p.slice(0,c.p.length-1).concat([c.lm]);
  }

  return c_;
};

json.invert = function(op) {
  var op_ = op.slice().reverse();
  var iop = [];
  for (var i = 0; i < op_.length; i++) {
    iop.push(json.invertComponent(op_[i]));
  }
  return iop;
};

json.checkValidOp = function(op) {
  for (var i = 0; i < op.length; i++) {
    if (!isArray(op[i].p)) throw new Error('Missing path');
  }
};

json.checkList = function(elem) {
  if (!isArray(elem))
    throw new Error('Referenced element not a list');
};

json.checkObj = function(elem) {
  if (!isObject(elem)) {
    throw new Error("Referenced element not an object (it was " + JSON.stringify(elem) + ")");
  }
};

// helper functions to convert old string ops to and from subtype ops
function convertFromText(c) {
  c.t = 'text0';
  var o = {p: c.p.pop()};
  if (c.si != null) o.i = c.si;
  if (c.sd != null) o.d = c.sd;
  c.o = [o];
}

function convertToText(c) {
  c.p.push(c.o[0].p);
  if (c.o[0].i != null) c.si = c.o[0].i;
  if (c.o[0].d != null) c.sd = c.o[0].d;
  delete c.t;
  delete c.o;
}

json.apply = function(snapshot, op) {
  json.checkValidOp(op);

  op = clone(op);

  var container = {
    data: snapshot
  };

  for (var i = 0; i < op.length; i++) {
    var c = op[i];

    // convert old string ops to use subtype for backwards compatibility
    if (c.si != null || c.sd != null)
      convertFromText(c);

    var parent = null;
    var parentKey = null;
    var elem = container;
    var key = 'data';

    for (var j = 0; j < c.p.length; j++) {
      var p = c.p[j];

      parent = elem;
      parentKey = key;
      elem = elem[key];
      key = p;

      if (parent == null)
        throw new Error('Path invalid');
    }

    // handle subtype ops
    if (c.t && c.o !== void 0 && subtypes[c.t]) {
      elem[key] = subtypes[c.t].apply(elem[key], c.o);

    // Number add
    } else if (c.na !== void 0) {
      if (typeof elem[key] != 'number')
        throw new Error('Referenced element not a number');

      elem[key] += c.na;
    }

    // List replace
    else if (c.li !== void 0 && c.ld !== void 0) {
      json.checkList(elem);
      // Should check the list element matches c.ld
      elem[key] = c.li;
    }

    // List insert
    else if (c.li !== void 0) {
      json.checkList(elem);
      elem.splice(key,0, c.li);
    }

    // List delete
    else if (c.ld !== void 0) {
      json.checkList(elem);
      // Should check the list element matches c.ld here too.
      elem.splice(key,1);
    }

    // List move
    else if (c.lm !== void 0) {
      json.checkList(elem);
      if (c.lm != key) {
        var e = elem[key];
        // Remove it...
        elem.splice(key,1);
        // And insert it back.
        elem.splice(c.lm,0,e);
      }
    }

    // Object insert / replace
    else if (c.oi !== void 0) {
      json.checkObj(elem);

      // Should check that elem[key] == c.od
      elem[key] = c.oi;
    }

    // Object delete
    else if (c.od !== void 0) {
      json.checkObj(elem);

      // Should check that elem[key] == c.od
      delete elem[key];
    }

    else {
      throw new Error('invalid / missing instruction in op');
    }
  }

  return container.data;
};

// Helper to break an operation up into a bunch of small ops.
json.shatter = function(op) {
  var results = [];
  for (var i = 0; i < op.length; i++) {
    results.push([op[i]]);
  }
  return results;
};

// Helper for incrementally applying an operation to a snapshot. Calls yield
// after each op component has been applied.
json.incrementalApply = function(snapshot, op, _yield) {
  for (var i = 0; i < op.length; i++) {
    var smallOp = [op[i]];
    snapshot = json.apply(snapshot, smallOp);
    // I'd just call this yield, but thats a reserved keyword. Bah!
    _yield(smallOp, snapshot);
  }

  return snapshot;
};

// Checks if two paths, p1 and p2 match.
var pathMatches = json.pathMatches = function(p1, p2, ignoreLast) {
  if (p1.length != p2.length)
    return false;

  for (var i = 0; i < p1.length; i++) {
    if (p1[i] !== p2[i] && (!ignoreLast || i !== p1.length - 1))
      return false;
  }

  return true;
};

json.append = function(dest,c) {
  c = clone(c);

  if (dest.length === 0) {
    dest.push(c);
    return;
  }

  var last = dest[dest.length - 1];

  // convert old string ops to use subtype for backwards compatibility
  if ((c.si != null || c.sd != null) && (last.si != null || last.sd != null)) {
    convertFromText(c);
    convertFromText(last);
  }

  if (pathMatches(c.p, last.p)) {
    // handle subtype ops
    if (c.t && last.t && c.t === last.t && subtypes[c.t]) {
      last.o = subtypes[c.t].compose(last.o, c.o);

      // convert back to old string ops
      if (c.si != null || c.sd != null) {
        var p = c.p;
        for (var i = 0; i < last.o.length - 1; i++) {
          c.o = [last.o.pop()];
          c.p = p.slice();
          convertToText(c);
          dest.push(c);
        }

        convertToText(last);
      }
    } else if (last.na != null && c.na != null) {
      dest[dest.length - 1] = {p: last.p, na: last.na + c.na};
    } else if (last.li !== undefined && c.li === undefined && c.ld === last.li) {
      // insert immediately followed by delete becomes a noop.
      if (last.ld !== undefined) {
        // leave the delete part of the replace
        delete last.li;
      } else {
        dest.pop();
      }
    } else if (last.od !== undefined && last.oi === undefined && c.oi !== undefined && c.od === undefined) {
      last.oi = c.oi;
    } else if (last.oi !== undefined && c.od !== undefined) {
      // The last path component inserted something that the new component deletes (or replaces).
      // Just merge them.
      if (c.oi !== undefined) {
        last.oi = c.oi;
      } else if (last.od !== undefined) {
        delete last.oi;
      } else {
        // An insert directly followed by a delete turns into a no-op and can be removed.
        dest.pop();
      }
    } else if (c.lm !== undefined && c.p[c.p.length - 1] === c.lm) {
      // don't do anything
    } else {
      dest.push(c);
    }
  } else {
    // convert string ops back
    if ((c.si != null || c.sd != null) && (last.si != null || last.sd != null)) {
      convertToText(c);
      convertToText(last);
    }

    dest.push(c);
  }
};

json.compose = function(op1,op2) {
  json.checkValidOp(op1);
  json.checkValidOp(op2);

  var newOp = clone(op1);

  for (var i = 0; i < op2.length; i++) {
    json.append(newOp,op2[i]);
  }

  return newOp;
};

json.normalize = function(op) {
  var newOp = [];

  op = isArray(op) ? op : [op];

  for (var i = 0; i < op.length; i++) {
    var c = op[i];
    if (c.p == null) c.p = [];

    json.append(newOp,c);
  }

  return newOp;
};

// Returns the common length of the paths of ops a and b
json.commonLengthForOps = function(a, b) {
  var alen = a.p.length;
  var blen = b.p.length;
  if (a.na != null || a.t)
    alen++;

  if (b.na != null || b.t)
    blen++;

  if (alen === 0) return -1;
  if (blen === 0) return null;

  alen--;
  blen--;

  for (var i = 0; i < alen; i++) {
    var p = a.p[i];
    if (i >= blen || p !== b.p[i])
      return null;
  }

  return alen;
};

// Returns true if an op can affect the given path
json.canOpAffectPath = function(op, path) {
  return json.commonLengthForOps({p:path}, op) != null;
};

// transform c so it applies to a document with otherC applied.
json.transformComponent = function(dest, c, otherC, type) {
  c = clone(c);

  var common = json.commonLengthForOps(otherC, c);
  var common2 = json.commonLengthForOps(c, otherC);
  var cplength = c.p.length;
  var otherCplength = otherC.p.length;

  if (c.na != null || c.t)
    cplength++;

  if (otherC.na != null || otherC.t)
    otherCplength++;

  // if c is deleting something, and that thing is changed by otherC, we need to
  // update c to reflect that change for invertibility.
  if (common2 != null && otherCplength > cplength && c.p[common2] == otherC.p[common2]) {
    if (c.ld !== void 0) {
      var oc = clone(otherC);
      oc.p = oc.p.slice(cplength);
      c.ld = json.apply(clone(c.ld),[oc]);
    } else if (c.od !== void 0) {
      var oc = clone(otherC);
      oc.p = oc.p.slice(cplength);
      c.od = json.apply(clone(c.od),[oc]);
    }
  }

  if (common != null) {
    var commonOperand = cplength == otherCplength;

    // backward compatibility for old string ops
    var oc = otherC;
    if ((c.si != null || c.sd != null) && (otherC.si != null || otherC.sd != null)) {
      convertFromText(c);
      oc = clone(otherC);
      convertFromText(oc);
    }

    // handle subtype ops
    if (oc.t && subtypes[oc.t]) {
      if (c.t && c.t === oc.t) {
        var res = subtypes[c.t].transform(c.o, oc.o, type);

        // convert back to old string ops
        if (c.si != null || c.sd != null) {
          var p = c.p;
          for (var i = 0; i < res.length; i++) {
            c.o = [res[i]];
            c.p = p.slice();
            convertToText(c);
            json.append(dest, c);
          }
        } else if (!isArray(res) || res.length > 0) {
          c.o = res;
          json.append(dest, c);
        }

        return dest;
      }
    }

    // transform based on otherC
    else if (otherC.na !== void 0) {
      // this case is handled below
    } else if (otherC.li !== void 0 && otherC.ld !== void 0) {
      if (otherC.p[common] === c.p[common]) {
        // noop

        if (!commonOperand) {
          return dest;
        } else if (c.ld !== void 0) {
          // we're trying to delete the same element, -> noop
          if (c.li !== void 0 && type === 'left') {
            // we're both replacing one element with another. only one can survive
            c.ld = clone(otherC.li);
          } else {
            return dest;
          }
        }
      }
    } else if (otherC.li !== void 0) {
      if (c.li !== void 0 && c.ld === undefined && commonOperand && c.p[common] === otherC.p[common]) {
        // in li vs. li, left wins.
        if (type === 'right')
          c.p[common]++;
      } else if (otherC.p[common] <= c.p[common]) {
        c.p[common]++;
      }

      if (c.lm !== void 0) {
        if (commonOperand) {
          // otherC edits the same list we edit
          if (otherC.p[common] <= c.lm)
            c.lm++;
          // changing c.from is handled above.
        }
      }
    } else if (otherC.ld !== void 0) {
      if (c.lm !== void 0) {
        if (commonOperand) {
          if (otherC.p[common] === c.p[common]) {
            // they deleted the thing we're trying to move
            return dest;
          }
          // otherC edits the same list we edit
          var p = otherC.p[common];
          var from = c.p[common];
          var to = c.lm;
          if (p < to || (p === to && from < to))
            c.lm--;

        }
      }

      if (otherC.p[common] < c.p[common]) {
        c.p[common]--;
      } else if (otherC.p[common] === c.p[common]) {
        if (otherCplength < cplength) {
          // we're below the deleted element, so -> noop
          return dest;
        } else if (c.ld !== void 0) {
          if (c.li !== void 0) {
            // we're replacing, they're deleting. we become an insert.
            delete c.ld;
          } else {
            // we're trying to delete the same element, -> noop
            return dest;
          }
        }
      }

    } else if (otherC.lm !== void 0) {
      if (c.lm !== void 0 && cplength === otherCplength) {
        // lm vs lm, here we go!
        var from = c.p[common];
        var to = c.lm;
        var otherFrom = otherC.p[common];
        var otherTo = otherC.lm;
        if (otherFrom !== otherTo) {
          // if otherFrom == otherTo, we don't need to change our op.

          // where did my thing go?
          if (from === otherFrom) {
            // they moved it! tie break.
            if (type === 'left') {
              c.p[common] = otherTo;
              if (from === to) // ugh
                c.lm = otherTo;
            } else {
              return dest;
            }
          } else {
            // they moved around it
            if (from > otherFrom) c.p[common]--;
            if (from > otherTo) c.p[common]++;
            else if (from === otherTo) {
              if (otherFrom > otherTo) {
                c.p[common]++;
                if (from === to) // ugh, again
                  c.lm++;
              }
            }

            // step 2: where am i going to put it?
            if (to > otherFrom) {
              c.lm--;
            } else if (to === otherFrom) {
              if (to > from)
                c.lm--;
            }
            if (to > otherTo) {
              c.lm++;
            } else if (to === otherTo) {
              // if we're both moving in the same direction, tie break
              if ((otherTo > otherFrom && to > from) ||
                  (otherTo < otherFrom && to < from)) {
                if (type === 'right') c.lm++;
              } else {
                if (to > from) c.lm++;
                else if (to === otherFrom) c.lm--;
              }
            }
          }
        }
      } else if (c.li !== void 0 && c.ld === undefined && commonOperand) {
        // li
        var from = otherC.p[common];
        var to = otherC.lm;
        p = c.p[common];
        if (p > from) c.p[common]--;
        if (p > to) c.p[common]++;
      } else {
        // ld, ld+li, si, sd, na, oi, od, oi+od, any li on an element beneath
        // the lm
        //
        // i.e. things care about where their item is after the move.
        var from = otherC.p[common];
        var to = otherC.lm;
        p = c.p[common];
        if (p === from) {
          c.p[common] = to;
        } else {
          if (p > from) c.p[common]--;
          if (p > to) c.p[common]++;
          else if (p === to && from > to) c.p[common]++;
        }
      }
    }
    else if (otherC.oi !== void 0 && otherC.od !== void 0) {
      if (c.p[common] === otherC.p[common]) {
        if (c.oi !== void 0 && commonOperand) {
          // we inserted where someone else replaced
          if (type === 'right') {
            // left wins
            return dest;
          } else {
            // we win, make our op replace what they inserted
            c.od = otherC.oi;
          }
        } else {
          // -> noop if the other component is deleting the same object (or any parent)
          return dest;
        }
      }
    } else if (otherC.oi !== void 0) {
      if (c.oi !== void 0 && c.p[common] === otherC.p[common]) {
        // left wins if we try to insert at the same place
        if (type === 'left') {
          json.append(dest,{p: c.p, od:otherC.oi});
        } else {
          return dest;
        }
      }
    } else if (otherC.od !== void 0) {
      if (c.p[common] == otherC.p[common]) {
        if (!commonOperand)
          return dest;
        if (c.oi !== void 0) {
          delete c.od;
        } else {
          return dest;
        }
      }
    }
  }

  json.append(dest,c);
  return dest;
};

require('./bootstrapTransform')(json, json.transformComponent, json.checkValidOp, json.append);

/**
 * Register a subtype for string operations, using the text0 type.
 */
var text = require('./text0');

json.registerSubtype(text);
module.exports = json;


},{"./bootstrapTransform":32,"./text0":35}],35:[function(require,module,exports){
// DEPRECATED!
//
// This type works, but is not exported. Its included here because the JSON0
// embedded string operations use this library.


// A simple text implementation
//
// Operations are lists of components. Each component either inserts or deletes
// at a specified position in the document.
//
// Components are either:
//  {i:'str', p:100}: Insert 'str' at position 100 in the document
//  {d:'str', p:100}: Delete 'str' at position 100 in the document
//
// Components in an operation are executed sequentially, so the position of components
// assumes previous components have already executed.
//
// Eg: This op:
//   [{i:'abc', p:0}]
// is equivalent to this op:
//   [{i:'a', p:0}, {i:'b', p:1}, {i:'c', p:2}]

var text = module.exports = {
  name: 'text0',
  uri: 'http://sharejs.org/types/textv0',
  create: function(initial) {
    if ((initial != null) && typeof initial !== 'string') {
      throw new Error('Initial data must be a string');
    }
    return initial || '';
  }
};

/** Insert s2 into s1 at pos. */
var strInject = function(s1, pos, s2) {
  return s1.slice(0, pos) + s2 + s1.slice(pos);
};

/** Check that an operation component is valid. Throws if its invalid. */
var checkValidComponent = function(c) {
  if (typeof c.p !== 'number')
    throw new Error('component missing position field');

  if ((typeof c.i === 'string') === (typeof c.d === 'string'))
    throw new Error('component needs an i or d field');

  if (c.p < 0)
    throw new Error('position cannot be negative');
};

/** Check that an operation is valid */
var checkValidOp = function(op) {
  for (var i = 0; i < op.length; i++) {
    checkValidComponent(op[i]);
  }
};

/** Apply op to snapshot */
text.apply = function(snapshot, op) {
  var deleted;

  checkValidOp(op);
  for (var i = 0; i < op.length; i++) {
    var component = op[i];
    if (component.i != null) {
      snapshot = strInject(snapshot, component.p, component.i);
    } else {
      deleted = snapshot.slice(component.p, component.p + component.d.length);
      if (component.d !== deleted)
        throw new Error("Delete component '" + component.d + "' does not match deleted text '" + deleted + "'");

      snapshot = snapshot.slice(0, component.p) + snapshot.slice(component.p + component.d.length);
    }
  }
  return snapshot;
};

/**
 * Append a component to the end of newOp. Exported for use by the random op
 * generator and the JSON0 type.
 */
var append = text._append = function(newOp, c) {
  if (c.i === '' || c.d === '') return;

  if (newOp.length === 0) {
    newOp.push(c);
  } else {
    var last = newOp[newOp.length - 1];

    if (last.i != null && c.i != null && last.p <= c.p && c.p <= last.p + last.i.length) {
      // Compose the insert into the previous insert
      newOp[newOp.length - 1] = {i:strInject(last.i, c.p - last.p, c.i), p:last.p};

    } else if (last.d != null && c.d != null && c.p <= last.p && last.p <= c.p + c.d.length) {
      // Compose the deletes together
      newOp[newOp.length - 1] = {d:strInject(c.d, last.p - c.p, last.d), p:c.p};

    } else {
      newOp.push(c);
    }
  }
};

/** Compose op1 and op2 together */
text.compose = function(op1, op2) {
  checkValidOp(op1);
  checkValidOp(op2);
  var newOp = op1.slice();
  for (var i = 0; i < op2.length; i++) {
    append(newOp, op2[i]);
  }
  return newOp;
};

/** Clean up an op */
text.normalize = function(op) {
  var newOp = [];

  // Normalize should allow ops which are a single (unwrapped) component:
  // {i:'asdf', p:23}.
  // There's no good way to test if something is an array:
  // http://perfectionkills.com/instanceof-considered-harmful-or-how-to-write-a-robust-isarray/
  // so this is probably the least bad solution.
  if (op.i != null || op.p != null) op = [op];

  for (var i = 0; i < op.length; i++) {
    var c = op[i];
    if (c.p == null) c.p = 0;

    append(newOp, c);
  }

  return newOp;
};

// This helper method transforms a position by an op component.
//
// If c is an insert, insertAfter specifies whether the transform
// is pushed after the insert (true) or before it (false).
//
// insertAfter is optional for deletes.
var transformPosition = function(pos, c, insertAfter) {
  // This will get collapsed into a giant ternary by uglify.
  if (c.i != null) {
    if (c.p < pos || (c.p === pos && insertAfter)) {
      return pos + c.i.length;
    } else {
      return pos;
    }
  } else {
    // I think this could also be written as: Math.min(c.p, Math.min(c.p -
    // otherC.p, otherC.d.length)) but I think its harder to read that way, and
    // it compiles using ternary operators anyway so its no slower written like
    // this.
    if (pos <= c.p) {
      return pos;
    } else if (pos <= c.p + c.d.length) {
      return c.p;
    } else {
      return pos - c.d.length;
    }
  }
};

// Helper method to transform a cursor position as a result of an op.
//
// Like transformPosition above, if c is an insert, insertAfter specifies
// whether the cursor position is pushed after an insert (true) or before it
// (false).
text.transformCursor = function(position, op, side) {
  var insertAfter = side === 'right';
  for (var i = 0; i < op.length; i++) {
    position = transformPosition(position, op[i], insertAfter);
  }

  return position;
};

// Transform an op component by another op component. Asymmetric.
// The result will be appended to destination.
//
// exported for use in JSON type
var transformComponent = text._tc = function(dest, c, otherC, side) {
  //var cIntersect, intersectEnd, intersectStart, newC, otherIntersect, s;

  checkValidComponent(c);
  checkValidComponent(otherC);

  if (c.i != null) {
    // Insert.
    append(dest, {i:c.i, p:transformPosition(c.p, otherC, side === 'right')});
  } else {
    // Delete
    if (otherC.i != null) {
      // Delete vs insert
      var s = c.d;
      if (c.p < otherC.p) {
        append(dest, {d:s.slice(0, otherC.p - c.p), p:c.p});
        s = s.slice(otherC.p - c.p);
      }
      if (s !== '')
        append(dest, {d: s, p: c.p + otherC.i.length});

    } else {
      // Delete vs delete
      if (c.p >= otherC.p + otherC.d.length)
        append(dest, {d: c.d, p: c.p - otherC.d.length});
      else if (c.p + c.d.length <= otherC.p)
        append(dest, c);
      else {
        // They overlap somewhere.
        var newC = {d: '', p: c.p};

        if (c.p < otherC.p)
          newC.d = c.d.slice(0, otherC.p - c.p);

        if (c.p + c.d.length > otherC.p + otherC.d.length)
          newC.d += c.d.slice(otherC.p + otherC.d.length - c.p);

        // This is entirely optional - I'm just checking the deleted text in
        // the two ops matches
        var intersectStart = Math.max(c.p, otherC.p);
        var intersectEnd = Math.min(c.p + c.d.length, otherC.p + otherC.d.length);
        var cIntersect = c.d.slice(intersectStart - c.p, intersectEnd - c.p);
        var otherIntersect = otherC.d.slice(intersectStart - otherC.p, intersectEnd - otherC.p);
        if (cIntersect !== otherIntersect)
          throw new Error('Delete ops delete different text in the same region of the document');

        if (newC.d !== '') {
          newC.p = transformPosition(newC.p, otherC);
          append(dest, newC);
        }
      }
    }
  }

  return dest;
};

var invertComponent = function(c) {
  return (c.i != null) ? {d:c.i, p:c.p} : {i:c.d, p:c.p};
};

// No need to use append for invert, because the components won't be able to
// cancel one another.
text.invert = function(op) {
  // Shallow copy & reverse that sucka.
  op = op.slice().reverse();
  for (var i = 0; i < op.length; i++) {
    op[i] = invertComponent(op[i]);
  }
  return op;
};

require('./bootstrapTransform')(text, transformComponent, checkValidOp, append);

},{"./bootstrapTransform":32}],36:[function(require,module,exports){
// shim for using process in browser
var process = module.exports = {};

// cached from whatever global is present so that test runners that stub it
// don't break things.  But we need to wrap it in a try catch in case it is
// wrapped in strict mode code which doesn't define any globals.  It's inside a
// function because try/catches deoptimize in certain engines.

var cachedSetTimeout;
var cachedClearTimeout;

function defaultSetTimout() {
    throw new Error('setTimeout has not been defined');
}
function defaultClearTimeout () {
    throw new Error('clearTimeout has not been defined');
}
(function () {
    try {
        if (typeof setTimeout === 'function') {
            cachedSetTimeout = setTimeout;
        } else {
            cachedSetTimeout = defaultSetTimout;
        }
    } catch (e) {
        cachedSetTimeout = defaultSetTimout;
    }
    try {
        if (typeof clearTimeout === 'function') {
            cachedClearTimeout = clearTimeout;
        } else {
            cachedClearTimeout = defaultClearTimeout;
        }
    } catch (e) {
        cachedClearTimeout = defaultClearTimeout;
    }
} ())
function runTimeout(fun) {
    if (cachedSetTimeout === setTimeout) {
        //normal enviroments in sane situations
        return setTimeout(fun, 0);
    }
    // if setTimeout wasn't available but was latter defined
    if ((cachedSetTimeout === defaultSetTimout || !cachedSetTimeout) && setTimeout) {
        cachedSetTimeout = setTimeout;
        return setTimeout(fun, 0);
    }
    try {
        // when when somebody has screwed with setTimeout but no I.E. maddness
        return cachedSetTimeout(fun, 0);
    } catch(e){
        try {
            // When we are in I.E. but the script has been evaled so I.E. doesn't trust the global object when called normally
            return cachedSetTimeout.call(null, fun, 0);
        } catch(e){
            // same as above but when it's a version of I.E. that must have the global object for 'this', hopfully our context correct otherwise it will throw a global error
            return cachedSetTimeout.call(this, fun, 0);
        }
    }


}
function runClearTimeout(marker) {
    if (cachedClearTimeout === clearTimeout) {
        //normal enviroments in sane situations
        return clearTimeout(marker);
    }
    // if clearTimeout wasn't available but was latter defined
    if ((cachedClearTimeout === defaultClearTimeout || !cachedClearTimeout) && clearTimeout) {
        cachedClearTimeout = clearTimeout;
        return clearTimeout(marker);
    }
    try {
        // when when somebody has screwed with setTimeout but no I.E. maddness
        return cachedClearTimeout(marker);
    } catch (e){
        try {
            // When we are in I.E. but the script has been evaled so I.E. doesn't  trust the global object when called normally
            return cachedClearTimeout.call(null, marker);
        } catch (e){
            // same as above but when it's a version of I.E. that must have the global object for 'this', hopfully our context correct otherwise it will throw a global error.
            // Some versions of I.E. have different rules for clearTimeout vs setTimeout
            return cachedClearTimeout.call(this, marker);
        }
    }



}
var queue = [];
var draining = false;
var currentQueue;
var queueIndex = -1;

function cleanUpNextTick() {
    if (!draining || !currentQueue) {
        return;
    }
    draining = false;
    if (currentQueue.length) {
        queue = currentQueue.concat(queue);
    } else {
        queueIndex = -1;
    }
    if (queue.length) {
        drainQueue();
    }
}

function drainQueue() {
    if (draining) {
        return;
    }
    var timeout = runTimeout(cleanUpNextTick);
    draining = true;

    var len = queue.length;
    while(len) {
        currentQueue = queue;
        queue = [];
        while (++queueIndex < len) {
            if (currentQueue) {
                currentQueue[queueIndex].run();
            }
        }
        queueIndex = -1;
        len = queue.length;
    }
    currentQueue = null;
    draining = false;
    runClearTimeout(timeout);
}

process.nextTick = function (fun) {
    var args = new Array(arguments.length - 1);
    if (arguments.length > 1) {
        for (var i = 1; i < arguments.length; i++) {
            args[i - 1] = arguments[i];
        }
    }
    queue.push(new Item(fun, args));
    if (queue.length === 1 && !draining) {
        runTimeout(drainQueue);
    }
};

// v8 likes predictible objects
function Item(fun, array) {
    this.fun = fun;
    this.array = array;
}
Item.prototype.run = function () {
    this.fun.apply(null, this.array);
};
process.title = 'browser';
process.browser = true;
process.env = {};
process.argv = [];
process.version = ''; // empty string to avoid regexp issues
process.versions = {};

function noop() {}

process.on = noop;
process.addListener = noop;
process.once = noop;
process.off = noop;
process.removeListener = noop;
process.removeAllListeners = noop;
process.emit = noop;
process.prependListener = noop;
process.prependOnceListener = noop;

process.listeners = function (name) { return [] }

process.binding = function (name) {
    throw new Error('process.binding is not supported');
};

process.cwd = function () { return '/' };
process.chdir = function (dir) {
    throw new Error('process.chdir is not supported');
};
process.umask = function() { return 0; };

},{}],37:[function(require,module,exports){
module.exports = TextDiffBinding;

function TextDiffBinding(element) {
  this.element = element;
}

TextDiffBinding.prototype._get =
TextDiffBinding.prototype._insert =
TextDiffBinding.prototype._remove = function() {
  throw new Error('`_get()`, `_insert(index, length)`, and `_remove(index, length)` prototype methods must be defined.');
};

TextDiffBinding.prototype._getElementValue = function() {
  var value = this.element.value;
  // IE and Opera replace \n with \r\n. Always store strings as \n
  return value.replace(/\r\n/g, '\n');
};

TextDiffBinding.prototype._getInputEnd = function(previous, value) {
  if (this.element !== document.activeElement) return null;
  var end = value.length - this.element.selectionStart;
  if (end === 0) return end;
  if (previous.slice(previous.length - end) !== value.slice(value.length - end)) return null;
  return end;
};

TextDiffBinding.prototype.onInput = function() {
  var previous = this._get();
  var value = this._getElementValue();
  if (previous === value) return;

  var start = 0;
  // Attempt to use the DOM cursor position to find the end
  var end = this._getInputEnd(previous, value);
  if (end === null) {
    // If we failed to find the end based on the cursor, do a diff. When
    // ambiguous, prefer to locate ops at the end of the string, since users
    // more frequently add or remove from the end of a text input
    while (previous.charAt(start) === value.charAt(start)) {
      start++;
    }
    end = 0;
    while (
      previous.charAt(previous.length - 1 - end) === value.charAt(value.length - 1 - end) &&
      end + start < previous.length &&
      end + start < value.length
    ) {
      end++;
    }
  } else {
    while (
      previous.charAt(start) === value.charAt(start) &&
      start + end < previous.length &&
      start + end < value.length
    ) {
      start++;
    }
  }

  if (previous.length !== start + end) {
    var removed = previous.slice(start, previous.length - end);
    this._remove(start, removed);
  }
  if (value.length !== start + end) {
    var inserted = value.slice(start, value.length - end);
    this._insert(start, inserted);
  }
};

TextDiffBinding.prototype.onInsert = function(index, length) {
  this._transformSelectionAndUpdate(index, length, insertCursorTransform);
};
function insertCursorTransform(index, length, cursor) {
  return (index < cursor) ? cursor + length : cursor;
}

TextDiffBinding.prototype.onRemove = function(index, length) {
  this._transformSelectionAndUpdate(index, length, removeCursorTransform);
};
function removeCursorTransform(index, length, cursor) {
  return (index < cursor) ? cursor - Math.min(length, cursor - index) : cursor;
}

TextDiffBinding.prototype._transformSelectionAndUpdate = function(index, length, transformCursor) {
  if (document.activeElement === this.element) {
    var selectionStart = transformCursor(index, length, this.element.selectionStart);
    var selectionEnd = transformCursor(index, length, this.element.selectionEnd);
    var selectionDirection = this.element.selectionDirection;
    this.update();
    this.element.setSelectionRange(selectionStart, selectionEnd, selectionDirection);
  } else {
    this.update();
  }
};

TextDiffBinding.prototype.update = function() {
  var value = this._get();
  if (this._getElementValue() === value) return;
  this.element.value = value;
};

},{}],38:[function(require,module,exports){
/* jshint browser: true */

(function () {

// We'll copy the properties below into the mirror div.
// Note that some browsers, such as Firefox, do not concatenate properties
// into their shorthand (e.g. padding-top, padding-bottom etc. -> padding),
// so we have to list every single property explicitly.
var properties = [
  'direction',  // RTL support
  'boxSizing',
  'width',  // on Chrome and IE, exclude the scrollbar, so the mirror div wraps exactly as the textarea does
  'height',
  'overflowX',
  'overflowY',  // copy the scrollbar for IE

  'borderTopWidth',
  'borderRightWidth',
  'borderBottomWidth',
  'borderLeftWidth',
  'borderStyle',

  'paddingTop',
  'paddingRight',
  'paddingBottom',
  'paddingLeft',

  // https://developer.mozilla.org/en-US/docs/Web/CSS/font
  'fontStyle',
  'fontVariant',
  'fontWeight',
  'fontStretch',
  'fontSize',
  'fontSizeAdjust',
  'lineHeight',
  'fontFamily',

  'textAlign',
  'textTransform',
  'textIndent',
  'textDecoration',  // might not make a difference, but better be safe

  'letterSpacing',
  'wordSpacing',

  'tabSize',
  'MozTabSize'

];

var isBrowser = (typeof window !== 'undefined');
var isFirefox = (isBrowser && window.mozInnerScreenX != null);

function getCaretCoordinates(element, position, options) {
  if (!isBrowser) {
    throw new Error('textarea-caret-position#getCaretCoordinates should only be called in a browser');
  }

  var debug = options && options.debug || false;
  if (debug) {
    var el = document.querySelector('#input-textarea-caret-position-mirror-div');
    if (el) el.parentNode.removeChild(el);
  }

  // The mirror div will replicate the textarea's style
  var div = document.createElement('div');
  div.id = 'input-textarea-caret-position-mirror-div';
  document.body.appendChild(div);

  var style = div.style;
  var computed = window.getComputedStyle ? window.getComputedStyle(element) : element.currentStyle;  // currentStyle for IE < 9
  var isInput = element.nodeName === 'INPUT';

  // Default textarea styles
  style.whiteSpace = 'pre-wrap';
  if (!isInput)
    style.wordWrap = 'break-word';  // only for textarea-s

  // Position off-screen
  style.position = 'absolute';  // required to return coordinates properly
  if (!debug)
    style.visibility = 'hidden';  // not 'display: none' because we want rendering

  // Transfer the element's properties to the div
  properties.forEach(function (prop) {
    if (isInput && prop === 'lineHeight') {
      // Special case for <input>s because text is rendered centered and line height may be != height
      style.lineHeight = computed.height;
    } else {
      style[prop] = computed[prop];
    }
  });

  if (isFirefox) {
    // Firefox lies about the overflow property for textareas: https://bugzilla.mozilla.org/show_bug.cgi?id=984275
    if (element.scrollHeight > parseInt(computed.height))
      style.overflowY = 'scroll';
  } else {
    style.overflow = 'hidden';  // for Chrome to not render a scrollbar; IE keeps overflowY = 'scroll'
  }

  div.textContent = element.value.substring(0, position);
  // The second special handling for input type="text" vs textarea:
  // spaces need to be replaced with non-breaking spaces - http://stackoverflow.com/a/13402035/1269037
  if (isInput)
    div.textContent = div.textContent.replace(/\s/g, '\u00a0');

  var span = document.createElement('span');
  // Wrapping must be replicated *exactly*, including when a long word gets
  // onto the next line, with whitespace at the end of the line before (#7).
  // The  *only* reliable way to do that is to copy the *entire* rest of the
  // textarea's content into the <span> created at the caret position.
  // For inputs, just '.' would be enough, but no need to bother.
  span.textContent = element.value.substring(position) || '.';  // || because a completely empty faux span doesn't render at all
  div.appendChild(span);

  var coordinates = {
    top: span.offsetTop + parseInt(computed['borderTopWidth']),
    left: span.offsetLeft + parseInt(computed['borderLeftWidth']),
    height: parseInt(computed['lineHeight'])
  };

  if (debug) {
    span.style.backgroundColor = '#aaa';
  } else {
    document.body.removeChild(div);
  }

  return coordinates;
}

if (typeof module != 'undefined' && typeof module.exports != 'undefined') {
  module.exports = getCaretCoordinates;
} else if(isBrowser) {
  window.getCaretCoordinates = getCaretCoordinates;
}

}());

},{}]},{},[2]);
