/**
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

'use strict';

// Constants.
var RELOCATE_COOLDOWN_PERIOD_MS = 400;
var X_KEYCODE = 88;

// Global variables.
var pathEl = document.getElementById('path');
var attrsEl = document.getElementById('attrs');

// Used by handleMouseMove() to enforce a cooldown period on relocate.
var mostRecentRelocateTimeInMs = 0;

var handleRequest = function(request, sender, callback) {
  // Note: Setting textarea's value and text node's nodeValue is XSS-safe.
  if (request['type'] === 'update') {
    if (request['path'] !== null) {
      pathEl.value = request['path'];
    }
    if (request['attrs'] !== null) {
      attrsEl.value = request['attrs'];
    }
  } else if (request['type'] === 'clipboard') {
    if($("#enable-clipboard").prop('checked')) {
       $("#path").select();
       document.execCommand("copy");
       document.getSelection().removeAllRanges();
     }
  }
};

var handleMouseMove = function(e) {
  if (e.shiftKey) {
    // Only relocate if we aren't in the cooldown period. Note, the cooldown
    // duration should take CSS transition time into consideration.
    var timeInMs = new Date().getTime();
    if (timeInMs - mostRecentRelocateTimeInMs < RELOCATE_COOLDOWN_PERIOD_MS) {
      return;
    }
    mostRecentRelocateTimeInMs = timeInMs;

    // Tell content script to move iframe to a different part of the screen.
    chrome.extension.sendMessage({'type': 'relocateBar'});
  }
};

var handleKeyDown = function(e) {
  if (e.keyCode === X_KEYCODE && e.ctrlKey && e.shiftKey) {
    chrome.extension.sendMessage({'type': 'hideBar'});
  }
};

var handleMoveBottom = function(e) {
  var height = $('#body').height();
  var request = {
    'type': 'bottom',
    'position': height
  };
  chrome.extension.sendMessage(request);
};

var handleMoveTop = function(e) {
  var request = {
    'type': 'top'
  };
  chrome.extension.sendMessage(request);
}

// Add mousemove listener so we can detect Shift + mousemove inside iframe.
document.addEventListener('mousemove', handleMouseMove);
// Add keydown listener so we can detect Ctrl-Shift-X and tell content script to
// steal focus and hide bar.
document.addEventListener('keydown', handleKeyDown);

document.getElementById('move-bottom').addEventListener('click', handleMoveBottom);
document.getElementById('move-top').addEventListener('click', handleMoveTop);

chrome.extension.onMessage.addListener(handleRequest);

var request = {
  'type': 'height',
  'height': document.documentElement.offsetHeight
};
chrome.extension.sendMessage(request);

var toClipBoard =  function(str, mimetype) {
  document.oncopy = function(event) {
    event.clipboardData.setData(mimetype, str);
    event.preventDefault();
  };
  document.execCommand("Copy", false, null);
};
