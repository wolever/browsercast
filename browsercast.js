"use strict";

function log() {
  if (window.console)
    window.console.log.apply(window.console, arguments);
}

var debounce = function(func, wait, immediate) {
  var timeout, result;
  return function() {
    var context = this, args = arguments;
    var later = function() {
      timeout = null;
      if (!immediate) result = func.apply(context, args);
    };
    var callNow = immediate && !timeout;
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
    if (callNow) result = func.apply(context, args);
    return result;
  };
};

function timeToStr(seconds) {
  if (Math.abs(seconds) < 0.01)
    seconds = 0;
  var isNeg = seconds < 0;
  if (isNeg)
    seconds *= -1;
  var microsStr = ("0" + parseInt((seconds * 100) % 100)).slice(-2);
  var secondsStr = ("0" + parseInt(seconds % 60)).slice(-2);
  var minutesStr = ("0" + parseInt(seconds / 60)).slice(-2);
  if (isNeg)
    minutesStr = "-" + minutesStr.replace(/^0/, "");
  return minutesStr + ":" + secondsStr + "." + microsStr;
}

function strToTime(str) {
  // Parse a time from a str
  // strToTime("1") -> 1.0
  // strToTime("1.5") -> 1.5
  // strToTime("1:05") -> 65.0
  // strToTime("1:5") -> 110.0
  // strToTime("-1:5") -> -110.0
  var isNeg = false;
  var time = 0;
  var multipliers = [1, 60, 60 * 60];
  var split = str.split(":");
  for (var i = split.length - 1; i >= 0; i -= 1) {
    var part = split[split.length - i - 1];
    if (part.slice(0, 1) == "-") {
      isNeg = !isNeg;
      part = part.slice(1);
    }
    if (part.length == 0)
      continue;
    time += parseFloat(part) * (multipliers[i] || 0);
  }
  return (isNeg? -1 : 1) * time;
}

function toggleClassPrefix(elems, prefix, toAdd) {
  return elems.each(function() {
    var newClass = $.grep(this.className.split(/\s+/), function(cls) {
      return cls.indexOf(prefix) != 0;
    });
    if (toAdd)
      newClass.push(toAdd);
    this.className = newClass.join(" ");
  });
}

function toggleVisible(elems, commonClass, toShow) {
  elems.find("." + commonClass).hide();
  elems.find("." + toShow).show();
}

function BrowserCastCellOptions(browsercast, cell) {
  var self = {
    browsercast: browsercast,
    cell: cell,
    cellID: cell.cell_id,
    cellDom: $(cell.element),
    time: 0,
    timeInput: null,
    duration: null,
    durationInput: null,
    controls: null
  };

  self.setupCell = function() {
    if (!self.cell.metadata.browsercast)
      self.cell.metadata.browsercast = {};
    self.meta = cell.metadata.browsercast;
  };

  self.setupCell();
  return self;
};

BrowserCastCellOptions.getForCell = function(browsercast, cell) {
  if (!cell._browsercastOptions)
    cell._browsercastOptions = BrowserCastCellOptions(browsercast, cell);
  return cell._browsercastOptions;
};


function BaseBrowserCastMode() {
  var self = {};
  self.keyboardShortcuts = {};

  self.activate = function(browsercast) {
    self.browsercast = browsercast;
    self._activate();
  };

  self._activate = function() {};

  self.deactivate = function() {
    self._deactivate();
    self.browsercast = null;
  }

  self._deactivate = function() {};

  self.loadFromNotebook = function() {
    if (self._didLoadFromNotebook)
      return;
    self._loadFromNotebook();
    self._didLoadFromNotebook = true;
  };

  self._loadFromNotebook = function() {};

  return self;
}

function BrowserCastEditing() {
  var self = BaseBrowserCastMode();

  self.keyboardShortcuts = {
    m: {
      help: "Mark current cell",
      action: function() {
        var active = self.browsercast.getActiveCells()[0];
        self.browsercast.markCellEnd(active.cell);
      }
    }
  };

  self._activate = function() {
    // Add the 'pick audio' button
    self.pickAudioBtn = $(
      "<button class='set-audio-url button'>Pick audio URL</button>"
    );
    self.pickAudioBtn.button({
      icons: { primary: "ui-icon-folder-open" },
      text: "Pick audio URL",
    });
    self.pickAudioBtn.click(self.pickAudioURL);
    self.browsercast.audioContainer.after(self.pickAudioBtn);

    // Setup the cell timings
    if (self._didLoadFromNotebook) {
      self._loadFromNotebook();
    }
    
    self.browsercast.updateActiveCells();
    self.browsercast.events.on("lazyAudioProgress", self.onLazyAudioProgress);
    self.browsercast.events.on("cellTimingInputChange", self.recalculateTimings);
    self.browsercast.events.on("audioPaused", self.onAudioPaused);
  };

  self._deactivate = function() {
    self.pickAudioBtn.remove();
    self.pickAudioBtn = null;
    self.browsercast.events.off("audioPaused", self.recalculateTimings);
    self.browsercast.events.off("cellTimingInputChange", self.recalculateTimings);
    self.browsercast.events.off("lazyAudioProgress", self.onAudioPaused);
  };

  self.onAudioPaused = function(event, paused) {
    if (paused) {
      self.recalculateTimings();
    }
    toggleClassPrefix($(".pause-icon"), "ui-icon-",
                      "ui-icon-" + (paused? "play" : "pause"));
  };

  self.onLazyAudioProgress = function(event, curTime) {
    var allActive = self.browsercast.getActiveCells();
    var activeOpts = allActive[allActive.length - 1];
    if (!activeOpts)
      return;
    var offset = curTime - activeOpts.time;
    log(curTime, activeOpts.time, offset);
    activeOpts.durationInput.val(timeToStr(offset));
  };

  self.pickAudioURL = function() {
    var dialog = $(
      "<div class='browsercast-pick-audio-url'>" +
        "<p>Enter a URL to use for audio:</p>" +
        "<input type='text' name='audio-url' />" +
      "</div>"
    );
    dialog.find("[name=audio-url]").val(self.browsercast.audioURL || "");
    dialog.dialog({
      buttons: {
        Save: function() {
          self.browsercast.setAudioURL($(this).find("[name=audio-url]").val());
          IPython.notebook.save_notebook();
          $(this).dialog("close");
        },
        Cancel: function() {
          $(this).dialog("close");
        }
      }
    });
  };

  /**
   * Recalculates the cell times and durations, updating the input fields, meta
   * fields, and cellOpts fields.
   * Assumes that:
   * - If the input field is empty, the time needs to be calculated from the
   *   meta time.
   * - If the time input field is different from the meta time, subsequent
   *   cells should be shifted by the difference.
   * - If the duration input field is different from the value calculated
   *   from the meta time, subsequent cells should be shifted by the
   *   difference.
   * Or, intutively: if an input field changes, subsequent timings should be
   * shifted so that change "makes sense".
   * No guarantees are made about the sensibility of the result if multiple
   * input fields are changed.
   */
  self.recalculateTimings = function() {
    log("Recalculating times...");
    var audio = self.browsercast.audio;
    var cells = IPython.notebook.get_cells();
    var lastOpts = null;
    var curTime = 0;
    var curOffset = 0;
    var timeOffset = 0;
    for (var i = 0; i < cells.length; i += 1) {
      var cell = cells[i];
      var cellOpts = BrowserCastCellOptions.getForCell(self.browsercast, cell);
      var curTimeStr = cellOpts.timeInput.val();
      log("cur cell:", curTimeStr, cellOpts.durationInput.val());

      // This cell's timing, according to it's metadata (the "saved time").
      var metaTime = cellOpts.meta.time || 0;

      // The time that will be used for this cell, before 'timeOffset' has been
      // applied (if the last cell's duration was changed, 'timeOffset' may be
      // adjusted)
      curTime = curTimeStr.length? strToTime(curTimeStr) : metaTime;

      // The offset introduced by this cell. Will be applied to 'timeOffset'
      // after this cell's time has been saved.
      curOffset = curTime - metaTime;
      if (curOffset != 0) {
        self.browsercast.showLog(
          "Adjusting time from " + timeToStr(metaTime) + " " +
          "to " + timeToStr(curTime) + "."
        );
      }

      if (lastOpts) {
        if (!lastOpts.duration)
          lastOpts.durationInput.parent().show();

        var durationStr = lastOpts.durationInput.val();
        // The duration that will be used for the previous cell, before
        // adjusting for the time offset that may be introduced by 'curOffset'.
        var duration = durationStr.length? strToTime(durationStr) : curTime - lastOpts.time;
        duration = Math.max(duration, 0);

        if (curOffset) {
          // If the time of the current cell was changed, adjust the duration
          // accordingly.
          duration += curOffset;
          duration = Math.max(duration, 0);
        } else if (lastOpts.duration !== null && lastOpts.duration !== undefined) {
          // If the time of the current cell was not changed *and* if we have
          // previously seen a duration for the last cell, update the time
          // offset that will be applied to the current cell and all subsequent
          // cells (ex, if the last cell's duration was changed from '1.0' to
          // '2.0', all subsequent cells will be shifted forward 1 second).
          timeOffset = (lastOpts.time + duration) - curTime;
        }
        lastOpts.duration = duration;
        lastOpts.durationInput.val(timeToStr(lastOpts.duration));
      }
      // Things are straight forward from here on: update the current cell's
      // time, adjusting for any offset that may have been introduced by
      // 'timeOffset'.
      cellOpts.time = Math.max(lastOpts? lastOpts.time : 0, curTime + timeOffset);
      cellOpts.meta.time = cellOpts.time;
      cellOpts.timeInput.val(timeToStr(cellOpts.time));
      lastOpts = cellOpts;
      timeOffset += curOffset;
      log("timeOffset:", timeToStr(timeOffset), "(curOffset: " + timeToStr(curOffset) + ")");
    }

    if (lastOpts) {
      // Hide the duration input for the last cell, because it doesn't make
      // sense to either show or edit it.
      lastOpts.duration = null;
      cellOpts.durationInput.parents(".duration-input-container").hide();
    }
  };

  return self;
}

function BrowserCastPopcornPlugin(browsercast) {
  var self = {
    browsercast: browsercast,
  };

  // General stuff
  self.cellClassPrefix = "browsercast-cell-";
  self.toggleCellClass = function(cellDom, newClassSuffix) {
    var newClass = newClassSuffix? self.cellClassPrefix + newClassSuffix : "";
    toggleClassPrefix(cellDom, self.cellClassPrefix, newClass);
  };

  // Popcorn plugin stuff
  self._setup = function(options){
    log("_setup", options.cellIndex);
    self.toggleCellClass(options.cellDom, "hidden");
    self.browsercast.updateActiveCells();
  };

  self._teardown = function() {
    log("_teardown", options.cellIndex);
    self.browsercast.updateActiveCells();
  };

  self.start = function(event, options){
    log("showing", options.cellIndex, "at t =", self.browsercast.getCurrentTime());
    self.toggleCellClass(options.cellDom, "visible");
    self.browsercast.updateActiveCells();
  };

  self.end = function(event, options){
    log("hiding", options.cellIndex, "at t =", self.browsercast.getCurrentTime());
    self.toggleCellClass(options.cellDom, "inactive");
    self.browsercast.updateActiveCells();
  };

  self.toString = function(options){
    return "[browsercastPopcornPlugin start=" + options.start + "]";
  };

  return self;
}

function BrowserCastPlayback() {
  var self = BaseBrowserCastMode();

  self._activate = function(browsercast) {
    self.audio = self.browsercast.audio;
    self.activatePopcorn();
    $(".browsercast-start-time-input").attr("disabled", true);
  };

  self._deactivate = function() {
    $(".browsercast-start-time-input").attr("disabled", false);
    self.deactivatePopcorn();
    self.audio = null;
  };

  self.activatePopcorn = function() {
    if (!Popcorn.registryByName["browsercastCell"])
      Popcorn.plugin("browsercastCell", BrowserCastPopcornPlugin(browsercast));
    var cells = IPython.notebook.get_cells();
    var audioEnd = self.audio.duration() + 1;
    cells.forEach(function(cell, i) {
      var cellOpts = BrowserCastCellOptions.getForCell(self.browsercast, cell);
      self.audio.browsercastCell("bc-" + cellOpts.cellID, {
        start: cellOpts.time - 0.001,
        end: audioEnd,
        cellIndex: i,
        cellOpts: cellOpts,
        cellDom: cellOpts.cellDom
      });
    });
  };

  self.deactivatePopcorn = function() {
    self.audio.removePlugin("browsercastCell");
  };
  return self;
}

function BrowserCastCellControlsManager(browsercast) {
  var self = {
    browsercast: browsercast
  };

  self.setup = function() {
    browsercast.events.on({
      notebookLoaded: self.onNotebookLoaded,
      cellAdded: self.onCellAdded,
    });
  };

  self.onNotebookLoaded = function() {
    var cells = IPython.notebook.get_cells();
    for (var i = 0; i < cells.length; i += 1) {
      self.setupCellControls(cells[i], { noTimingInputChange: true });
    }
    self.browsercast.events.trigger("cellTimingInputChange");
  };

  self.onCellAdded = function(event, cell) {
    self.setupCellControls(cell);
    self.browsercast.events.trigger("cellTimingInputChange");
  };

  self.setupCellControls = function(cell) {
    var cellOpts = BrowserCastCellOptions.getForCell(self.browsercast, cell);
    if (cellOpts.controls)
      return;
    cellOpts.controls = self.createCellControls(cell);
    cellOpts.timeInput = cellOpts.controls.find(".browsercast-start-time-input");
    cellOpts.durationInput = cellOpts.controls.find(".browsercast-duration-input");
    var elem = $(cell.element);
    elem.prepend(cellOpts.controls);
    var controlsWidth = cellOpts.controls.children().width();
    var elemPaddingLeft = 5;
    elem.css({
      "padding-left": (controlsWidth + elemPaddingLeft) + ".px",
      "min-height": cellOpts.controls.children().height() + 10 + ".px"
    });
    cellOpts.controls.css({
      "margin-left": -controlsWidth + ".px",
    });
  };

  self.createCellControls = function(cell) {
    var controls = $(
      "<div class='browsercast-controls-container'>" +
        "<div class='browsercast-controls'>" +
          "<div class='start-time-input-container'>" +
            "<div class='input-container'>" +
              "<span class='ui-icon ui-icon-arrowstop-1-n'></span>" +
              "<input class='browsercast-start-time-input' placeholder='Start' title='Cell start time' />" +
            "</div>" +
            "<div class='jump-to-time ui-button ui-widget ui-state-default ui-corner-right ui-button-icon-only bc-button-flushleft' title='Jump to time' data-action='jump'><span class='ui-icon ui-icon-arrowreturnthick-1-w'></span></div>" +
          "</div>" +
          "<div class='duration-input-container'>" +
            "<div class='input-container'>" +
              "<span class='ui-icon ui-icon-arrowstop-1-e'></span>" +
              "<input class='browsercast-duration-input' placeholder='Duration' title='Cell duration'/>" +
            "</div>" +
            "<div class='ui-buttonset edit-controls'>" +
              "<div class='ui-button ui-widget ui-state-default ui-button-icon-only bc-corner-none bc-button-flushleft' title='Play/Pause playback' data-action='pause'><span class='pause-icon ui-icon ui-icon-play'></span></div>" +
              "<div class='ui-button ui-widget ui-state-default ui-button-icon-only ui-corner-right' title='Mark and move to next cell' data-action='mark'><span class='ui-icon ui-icon-check'></span></div>" +
            "</div>" +
          "</div>" +
        "</div>" +
      "</div>"
    );

    controls.find("input").on("keypress blur", function(event) {
      if (event.type == "keypress" && event.which != 13) // enter
        return;
      self.browsercast.events.trigger("cellTimingInputChange");
    });

    controls.find(".ui-button").each(function() {
      var $this = $(this);
      var oldClass = $this.attr("class");
      $this.button();
      $this.attr("class", oldClass);
    });

    controls.on("click", ".ui-button[data-action]", function(event) {
      var action = $(this).attr("data-action");
      var handler = self["onCellClick_" + action];
      if (!handler) {
        alert("Error: no BrowserCastCellControlsManager handler for " + action);
        return;
      }
      handler(cell);
      event.preventDefault();
      event.stopImmediatePropagation();
    });
    return controls;
  };

  self.onCellClick_jump = function(cell) {
    var cellOpts = BrowserCastCellOptions.getForCell(self.browsercast, cell);
    self.browsercast.setCurrentTime(cellOpts.time || 0);
    self.browsercast.setActiveCells([cellOpts]);
  };

  self.onCellClick_mark = function(cell) {
    self.browsercast.markCellEnd(cell);
  };

  self.onCellClick_pause = function(cell) {
    self.browsercast.togglePlayPause();
  };

  return self;
};

function BrowserCast() {
  var self = {};
  self = $.extend(self, {
    events: $(self),
    modes: {
      editing: BrowserCastEditing(),
      playback: BrowserCastPlayback(),
    },
    // New marks will be offset backwards by MARK_JITTER to compensate for
    // reaction time.
    MARK_JITTER: 0.08,
    LAZY_AUDIO_PROGRESS_INTERVAL: 100,
    ACTIVE_CELL_CLASS: "browsercast-active-cell"
  });

  self.keyboardShortcuts = {
    j: {
      help: "Select next cell",
      action: function() {
        self.moveSelection(+1);
      }
    },
    k: {
      help: "Select previous cell",
      action: function() {
        self.moveSelection(-1);
      }
    },
    p: {
      help: "Play/pause audio",
      action: function() {
        self.togglePlayPause();
      }
    },
    r: {
      help: "Resume audio playback",
      action: function() {
        self.togglePlayPause(true);
      }
    },
    b: {
      help: "Back 3 seconds",
      action: function() {
        self.audioJump(-3);
      }
    },
    s: {
      help: "Stop audio playback",
      action: function() {
        self.togglePlayPause(false);
      }
    },
    h: {
      help: "Show help",
      action: function() {
        self.showKeyboardShortcuts();
      }
    }
  };

  self.setup = function() {
    self.injectHTML();
    self.setupCellControlsManager();
    self.updateMode();
    self.setupEvents();
  };

  self.injectHTML = function() {
    self.view = $(
      "<div class='browsercast-container'>" +
        "<div class='mode-select'>" +
          "<input type='radio' id='browsercast-mode-edit' name='mode' value='editing' checked />" +
          "<label for='browsercast-mode-edit'>Editing</label>" +
          "<input type='radio' id='browsercast-mode-playback' name='mode' value='playback' />" +
          "<label for='browsercast-mode-playback'>Playback</label>" +
        "</div>" +
        "<div class='audio-container'>" +
          "<span class='state state-empty'>No audio loaded&hellip;</span>" +
          "<span class='state state-loading'>Loading&hellip;</span>" +
          "<span class='state state-error'>Error loading audio.</span>" +
        "</div>" +
        "<div class='log'></div>" +
      "</div>"
    );
    $("body").append(self.view);
    self.view.find(".mode-select").buttonset();
    self.audioContainer = self.view.find(".audio-container");
    self.audioContainer.attr("id", "browsercast-audio-container")
    self.setAudioURL();
    self.log = self.view.find(".log");
  };

  self.setupCellControlsManager = function() {
    self.cellControlsManager = BrowserCastCellControlsManager(self);
    self.cellControlsManager.setup();
  };

  self.setupEvents = function() {
    // IPython save/load events
    self.view.find(".mode-select input").change(self.updateMode);
    $([IPython.events]).on('notebook_saving.Notebook', function() {
      self.saveToNotebook();
    });
    $([IPython.events]).on('notebook_loaded.Notebook', function() {
      self.loadFromNotebook();
    });
    if (IPython.notebook && IPython.notebook.metadata) {
      self.loadFromNotebook();
    };

    // IPython cellSeleted + cellAdded events
    $([IPython.events]).on("selected_cell_type_changed.Notebook", function() {
      // Because the Notebook doesn't currently trigger any explicit event when
      // a cell is created, we need to check to see if the current cell needs
      // controls each time the selection is changed.
      var cell = IPython.notebook.get_selected_cell();
      if (!cell._browsercastDidTriggerNew && self._didLoadFromNotebook) {
        cell._browsercastDidTriggerNew = true;
        self.events.trigger("cellAdded", [cell]);
      }
      // DW: well... This is where the 'cellSeleted' event could go if we
      // needed it...
      //self.events.trigger("cellSelected", [cell]);
    });

    self.events.on("cellTimingInputChange", debounce(function() {
      IPython.notebook.save_notebook();
    }, 250));
    self.events.on("audioPaused", self.updateLazyAudioProgress);

    // Browser keyboard shortcuts
    $(document).keydown(function (event) {
      if (event.which === 76 && event.ctrlKey && !self._keyboard_active) {
        // ctrl-l to begin browsercast-mode commands
        self._keyboard_active = true;
        return false;
      } else if (self._keyboard_active) {
        var chr = String.fromCharCode(event.which).toLowerCase();
        var handler = self.keyboardShortcuts[chr];
        if (!handler)
          handler = self.activeMode.keyboardShortcuts[chr];
        if (handler) {
          handler.action();
        }
        self._keyboard_active = false;
        return false;
      };
      return true;
    });
  };

  self.updateMode = function() {
    var name = self.view.find("input[name=mode]:checked").val();
    self.setMode(name);
  }

  self.setMode = function(name) {
    var newMode = self.modes[name];
    if (!newMode) {
      alert("Error: invalid mode: " + name);
      return;
    }
    if (newMode === self.activeMode)
      return;
    if (self.activeMode)
      self.activeMode.deactivate();
    self.activeMode = newMode;
    if (self._didLoadFromNotebook)
      self.activeMode.loadFromNotebook();
    self.activeMode.activate(self);
    toggleClassPrefix($(document.body), "browsercast-mode-",
                      "browsercast-mode-" + name);
  };

  self._activeCells = [];
  self.setActiveCells = function(activeCells) {
    self._activeCells.forEach(function(cellOpts) {
      cellOpts.cellDom.removeClass(self.ACTIVE_CELL_CLASS);
    });
    self._activeCells = activeCells;
    self._activeCells.forEach(function(cellOpts) {
      cellOpts.cellDom.addClass(self.ACTIVE_CELL_CLASS);
    });
  };

  self.updateActiveCells = function() {
    if (!self.audio) {
      self.setActiveCells([]);
      return;
    }

    // todo: this could be sped up quite a bit...
    var curTime = self.getCurrentTime();
    var cells = IPython.notebook.get_cells();
    var lastCell = null;
    var newActiveCell = null;
    log("Updating... Cur time:", curTime);
    for (var i = cells.length - 1; i >= 0; i -= 1) {
      var cellOpts = BrowserCastCellOptions.getForCell(self, cells[i]);
      if (lastCell && cellOpts.time !== lastCell.time)
        break;
      log("curcell time:", cellOpts.time);
      if (cellOpts.time <= curTime + 0.001) {
        lastCell = cellOpts;
        newActiveCell = cellOpts;
      }
    }
    self.setActiveCells(newActiveCell? [newActiveCell] : []);
  };

  self.getActiveCells = function() {
    return self._activeCells;
  };

  self.showLog = function(msg) {
    self.log.text(msg);
  };

  self.saveToNotebook = function() {
    var browsercast = {};
    ["audioURL"].forEach(function(key) {
      browsercast[key] = self[key];
    });
    IPython.notebook.metadata.browsercast = browsercast;
  };

  self.loadFromNotebook = function() {
    if (self._didLoadFromNotebook)
      return;
    var browsercast = IPython.notebook.metadata.browsercast || {};
    self.setAudioURL(browsercast.audioURL);
    self.activeMode.loadFromNotebook();
    self._didLoadFromNotebook = true;
    var cells = IPython.notebook.get_cells();
    for (var i = 0; i < cells.length; i += 1) {
      cells[i]._browsercastDidTriggerNew = true;
    };
    self.events.trigger("notebookLoaded");
  };

  self.moveSelection = function(delta) {
    while (delta > 0) {
      IPython.notebook.select_next();
      delta -= 1;
    }

    while (delta < 0) {
      IPython.notebook.select_prev();
      delta += 1;
    }
  };

  self.togglePlayPause = function(forcePlay) {
    if (forcePlay === undefined)
      forcePlay = self.audio.paused();
    if (forcePlay) {
      self.audio.play();
      self.showLog("Playing...");
    } else {
      self.audio.pause();
      self.showLog("Paused.");
    }
  };

  self.showKeyboardShortcuts = function() {
    var shortcutsHTML = [];
    var shortcuts = $.extend({},
      self.keyboardShortcuts,
      self.activeMode.keyboardShortcuts
    );
    for (var key in shortcuts) {
      if (shortcuts.hasOwnProperty(key)) {
        var handler = shortcuts[key];
        shortcutsHTML.push(
          "<div>" +
            "<span class='shortcut_key'>Ctrl-l " + key + "</span>" +
            "<span class='shortcut_descr'>: " + handler.help + "</span>" +
          "</div>"
        );
      }
    }
    var dialog = $(
      "<div class='browsercast-shortcut-help'>" +
        shortcutsHTML.join("\n") +
      "</div>"
    );
    dialog.dialog({
      title: "BrowserCast Mode Keyboard Shortcuts"
    });
  };

  self.setAudioURL = function(value) {
    if (self.audio)
      $(self.audio.media).remove();
    self.audioURL = value;
    self.audio = null;
    toggleVisible(self.audioContainer, "state", "state-empty");
    if (!value)
      return;
    toggleVisible(self.audioContainer, "state", "state-loading");
    self.audio = Popcorn.smart("#" + self.audioContainer.attr("id"), [value]);
    self.audio.on("canplay", function() {
      self.updateActiveCells();
      $(self.audio.media).css({ "display": "inline" });
      toggleVisible(self.audioContainer, "state", "state-loaded");
    });
    self.audio.on("error", function(e) {
      toggleVisible(self.audioContainer, "state", "state-error");
      var msg = self.friendlyMediaError(self.audio.error);
      self.audioContainer.find(".state-error").text("Error loading media: " + msg + ".");
      self.audio = null;
    });
    "playing pause ended seeked abort".split(" ").forEach(function(evName) {
      self.audio.on(evName, function() {
        self.triggerAudioPaused();
      });
    });
  };

  self._lastAudioPaused = null;
  self.triggerAudioPaused = function() {
    var paused = self.audio.paused();
    if (paused === self._lastAudioPaused)
      return;
    self._lastAudioPaused = paused;
    self.events.trigger("audioPaused", [paused]);
  };

  self._lazyAudioProgressInterval = null;
  self._triggerLazyAudioProgress = function() {
    self.events.trigger("lazyAudioProgress", [self.getCurrentTime()]);
  };
  self.updateLazyAudioProgress = function() {
    if (self._lazyAudioProgressInterval !== null) {
      clearTimeout(self._lazyAudioProgressInterval);
      self._lazyAudioProgressInterval = null;
    }
    self._triggerLazyAudioProgress();
    if (!self.audio.paused()) {
      self._lazyAudioProgressInterval = setInterval(
        self._triggerLazyAudioProgress, self.LAZY_AUDIO_PROGRESS_INTERVAL
      );
    }
  };

  self.friendlyMediaError = function(err) {
    err = err || {};
    switch (err.code) {
      case MediaError.MEDIA_ERR_ABORTED:
        return "load was aborted";
      case MediaError.MEDIA_ERR_DECODE:
        return "error decoding media";
      case MediaError.MEDIA_ERR_NETWORK:
        return "network error";
      case MediaError.MEDIA_ERR_SRC_NOT_SUPPORTED:
        return "source format not supported";
    }
    return "unknown error (code: '" + err.code + "')";
  };

  self.getCurrentTime = function() {
    return self.audio.currentTime();
  };

  self.setCurrentTime = function(newTime) {
    self.audio.currentTime(newTime);
    self.updateActiveCells();
  };

  self.audioJump = function(offset) {
    self.setCurrentTime(self.getCurrentTime() + offset);
  };

  self.markCellEnd = function(cell) {
    var cellOpts = BrowserCastCellOptions.getForCell(self, cell);
    var curTime = self.getCurrentTime();
    var duration = Math.max(
      0,
      curTime - (cellOpts.time || 0) - self.MARK_JITTER
    );
    var durationStr = timeToStr(duration);
    cellOpts.durationInput.val(durationStr);
    self.events.trigger("cellTimingInputChange");

    var nextCellOpts = null;
    var cells = IPython.notebook.get_cells();
    var wasLast = false;
    for (var i = 0; i < cells.length; i += 1) {
      var thisCellOpts = BrowserCastCellOptions.getForCell(self, cells[i]);
      if (wasLast) {
        nextCellOpts = thisCellOpts;
        break;
      }
      wasLast = (thisCellOpts === cellOpts);
    }
    if (nextCellOpts) {
      self.setActiveCells([nextCellOpts]);
    }
  };

  return self;
};

var browsercast = BrowserCast();
browsercast.setup();
