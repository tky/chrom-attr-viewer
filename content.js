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

// Extension namespace.
var xh = xh || {};


////////////////////////////////////////////////////////////////////////////////
// Generic helper functions and constants

xh.SHIFT_KEYCODE = 16;
xh.X_KEYCODE = 88;

xh.bind = function(object, method) {
  return function() {
    return method.apply(object, arguments);
  };
};

xh.elementsShareFamily = function(primaryEl, siblingEl) {
  if (primaryEl.tagName === siblingEl.tagName &&
      (!primaryEl.className || primaryEl.className === siblingEl.className) &&
      (!primaryEl.id || primaryEl.id === siblingEl.id)) {
    return true;
  }
  return false;
};

xh.getElementIndex = function(el) {
  var className = el.className;
  var id = el.id;

  var index = 1;  // XPath is one-indexed
  var sib;
  for (sib = el.previousSibling; sib; sib = sib.previousSibling) {
    if (sib.nodeType === Node.ELEMENT_NODE && xh.elementsShareFamily(el, sib)) {
      index++;
    }
  }
  if (index > 1) {
    return index;
  }
  for (sib = el.nextSibling; sib; sib = sib.nextSibling) {
    if (sib.nodeType === Node.ELEMENT_NODE && xh.elementsShareFamily(el, sib)) {
      return 1;
    }
  }
  return 0;
};

xh.makeQueryForElement = function(el) {
  var query = '';
  for (; el && el.nodeType === Node.ELEMENT_NODE; el = el.parentNode) {
    var component = el.tagName.toLowerCase();
    var index = xh.getElementIndex(el);
    if (el.id) {
      component += '[@id=\'' + el.id + '\']';
    } else if (el.className) {
      component += '[@class=\'' + el.className + '\']';
    }
    if (index >= 1) {
      component += '[' + index + ']';
    }
    // If the last tag is an img, the user probably wants img/@src.
    if (query === '' && el.tagName.toLowerCase() === 'img') {
      component += '/@src';
    }
    query = '/' + component + query;
  }
  return query;
};

xh.clearHighlights = function() {
  var els = document.getElementsByClassName('xh-highlight');
  // Note: getElementsByClassName() returns a live NodeList.
  while (els.length) {
    els[0].className = els[0].className.replace(' xh-highlight', '');
  }
};
////////////////////////////////////////////////////////////////////////////////
// xh.Bar class definition

xh.Bar = function() {
  this.boundShowBar_ = xh.bind(this, this.showBar_);
  this.boundHandleRequest_ = xh.bind(this, this.handleRequest_);
  this.boundMouseMove_ = xh.bind(this, this.mouseMove_);
  this.boundKeyDown_ = xh.bind(this, this.keyDown_);

  chrome.extension.onMessage.addListener(this.boundHandleRequest_);

  this.barFrame_ = document.createElement('iframe');
  this.barFrame_.src = chrome.extension.getURL('bar.html');
  this.barFrame_.id = 'xh-bar';
  this.barFrame_.className = 'top';
  this.barFrame_.style.height = '0';
  this.barFrame_.style.top = '0';

  // Temporarily make bar 'hidden' and add it to the DOM. Once the bar's html
  // has loaded, it will send us a message with its height, at which point we'll
  // set this.barHeightInPx_, remove it from the DOM, and make it 'visible'.
  // We'll add it back to the DOM on the first bar request.
  this.barFrame_.style.visibility = 'hidden';
  document.body.appendChild(this.barFrame_);

  document.addEventListener('keydown', this.boundKeyDown_);
};

xh.Bar.prototype.active_ = false;
xh.Bar.prototype.barFrame_ = null;
xh.Bar.prototype.barHeightInPx_ = 0;
xh.Bar.prototype.barTopInPx_ = 0;
xh.Bar.prototype.currEl_ = null;
xh.Bar.prototype.boundHandleRequest_ = null;
xh.Bar.prototype.boundMouseMove_ = null;
xh.Bar.prototype.boundKeyDown_ = null;

/**
 * 表示エリアの更新。
 */
xh.Bar.prototype.updateMessage = function(path, attrs) {
  var request = {
    'type': 'update',
    'path': path,
    'attrs': attrs
  };
  chrome.extension.sendMessage(request);
};

xh.Bar.prototype.updateClipboard = function(message) {
  var request = {
    'type': 'clipboard',
    'message': message
  };
  chrome.extension.sendMessage(request);
};

xh.Bar.prototype.showBar_ = function() {
  this.barFrame_.style.height = this.barHeightInPx_ + 'px';
  this.barFrame_.style.top = this.barTopInPx_ + 'px';
  document.addEventListener('mousemove', this.boundMouseMove_);
};

xh.Bar.prototype.hideBar_ = function() {
  // Note: It's important to set this.active_ to false here rather than in
  // keyDown_() because hideBar_() could be called via handleRequest_().
  this.active_ = false;
  xh.clearHighlights();
  document.removeEventListener('mousemove', this.boundMouseMove_);
  this.barFrame_.style.height = '0';
};

xh.Bar.prototype.handleRequest_ = function(request, sender, callback) {
  if (request['type'] === 'height' && this.barHeightInPx_ === 0) {
    this.barHeightInPx_ = request['height'];
    // Now that we've saved the bar's height, remove it from the DOM and make it
    // 'visible'.
    document.body.removeChild(this.barFrame_);
    this.barFrame_.style.visibility = 'visible';
  } else if (request['type'] === 'evaluate') {
    xh.clearHighlights();
    this.query_ = request['query'];
  } else if (request['type'] === 'relocateBar') {
    // Move iframe to a different part of the screen.
    this.barFrame_.className = (
      this.barFrame_.className === 'top' ? 'middle' : 'top');
  } else if (request['type'] === 'hideBar') {
    this.hideBar_();
    window.focus();
  } else if (request['type'] === 'bottom') {
    this.barTopInPx_ =  window.innerHeight - request['position'] - 20;
    this.barFrame_.style.top = this.barTopInPx_ + 'px';
  } else if (request['type'] === 'top') {
    this.barTopInPx_ =  0;
    this.barFrame_.style.top = this.barTopInPx_ + 'px';
  }
};

xh.Bar.prototype.mouseMove_ = function(e) {
  if (e.target.localName == 'a') {
    var attrs = e.target.attributes;
    var messages = [];
    for (var i = 0; i < attrs.length; i++) {
      messages.push(attrs[i].name + " " + attrs[i].value);
    }
    var path = xh.makeQueryForElement(e.toElement);
    this.updateMessage(path, messages.join('\r\n'));
    this.updateClipboard(path);
  }
};

xh.Bar.prototype.keyDown_ = function(e) {
  if (e.keyCode === xh.X_KEYCODE && e.ctrlKey && e.shiftKey) {
    if (!this.active_) {
      this.active_ = true;
      if (!this.barFrame_.parentNode) {
        // First bar request on this page. Add bar back to DOM.
        document.body.appendChild(this.barFrame_);
        // Use setTimeout so that the transition is visible.
        window.setTimeout(this.boundShowBar_, 0);
      } else {
        this.showBar_();
      }
    } else {
      this.hideBar_();
    }
  }
};


////////////////////////////////////////////////////////////////////////////////
// Initialization code

if (window['xhBarInstance']) {
  window['xhBarInstance'].dispose();
}
if (location.href.indexOf('acid3.acidtests.org') === -1) {
  window['xhBarInstance'] = new xh.Bar();
}
