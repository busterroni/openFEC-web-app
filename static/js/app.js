(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({"/home/vagrant/openfec-web-app/node_modules/eventemitter2/lib/eventemitter2.js":[function(require,module,exports){
/*!
 * EventEmitter2
 * https://github.com/hij1nx/EventEmitter2
 *
 * Copyright (c) 2013 hij1nx
 * Licensed under the MIT license.
 */
;!function(undefined) {

  var isArray = Array.isArray ? Array.isArray : function _isArray(obj) {
    return Object.prototype.toString.call(obj) === "[object Array]";
  };
  var defaultMaxListeners = 10;

  function init() {
    this._events = {};
    if (this._conf) {
      configure.call(this, this._conf);
    }
  }

  function configure(conf) {
    if (conf) {

      this._conf = conf;

      conf.delimiter && (this.delimiter = conf.delimiter);
      conf.maxListeners && (this._events.maxListeners = conf.maxListeners);
      conf.wildcard && (this.wildcard = conf.wildcard);
      conf.newListener && (this.newListener = conf.newListener);

      if (this.wildcard) {
        this.listenerTree = {};
      }
    }
  }

  function EventEmitter(conf) {
    this._events = {};
    this.newListener = false;
    configure.call(this, conf);
  }

  //
  // Attention, function return type now is array, always !
  // It has zero elements if no any matches found and one or more
  // elements (leafs) if there are matches
  //
  function searchListenerTree(handlers, type, tree, i) {
    if (!tree) {
      return [];
    }
    var listeners=[], leaf, len, branch, xTree, xxTree, isolatedBranch, endReached,
        typeLength = type.length, currentType = type[i], nextType = type[i+1];
    if (i === typeLength && tree._listeners) {
      //
      // If at the end of the event(s) list and the tree has listeners
      // invoke those listeners.
      //
      if (typeof tree._listeners === 'function') {
        handlers && handlers.push(tree._listeners);
        return [tree];
      } else {
        for (leaf = 0, len = tree._listeners.length; leaf < len; leaf++) {
          handlers && handlers.push(tree._listeners[leaf]);
        }
        return [tree];
      }
    }

    if ((currentType === '*' || currentType === '**') || tree[currentType]) {
      //
      // If the event emitted is '*' at this part
      // or there is a concrete match at this patch
      //
      if (currentType === '*') {
        for (branch in tree) {
          if (branch !== '_listeners' && tree.hasOwnProperty(branch)) {
            listeners = listeners.concat(searchListenerTree(handlers, type, tree[branch], i+1));
          }
        }
        return listeners;
      } else if(currentType === '**') {
        endReached = (i+1 === typeLength || (i+2 === typeLength && nextType === '*'));
        if(endReached && tree._listeners) {
          // The next element has a _listeners, add it to the handlers.
          listeners = listeners.concat(searchListenerTree(handlers, type, tree, typeLength));
        }

        for (branch in tree) {
          if (branch !== '_listeners' && tree.hasOwnProperty(branch)) {
            if(branch === '*' || branch === '**') {
              if(tree[branch]._listeners && !endReached) {
                listeners = listeners.concat(searchListenerTree(handlers, type, tree[branch], typeLength));
              }
              listeners = listeners.concat(searchListenerTree(handlers, type, tree[branch], i));
            } else if(branch === nextType) {
              listeners = listeners.concat(searchListenerTree(handlers, type, tree[branch], i+2));
            } else {
              // No match on this one, shift into the tree but not in the type array.
              listeners = listeners.concat(searchListenerTree(handlers, type, tree[branch], i));
            }
          }
        }
        return listeners;
      }

      listeners = listeners.concat(searchListenerTree(handlers, type, tree[currentType], i+1));
    }

    xTree = tree['*'];
    if (xTree) {
      //
      // If the listener tree will allow any match for this part,
      // then recursively explore all branches of the tree
      //
      searchListenerTree(handlers, type, xTree, i+1);
    }

    xxTree = tree['**'];
    if(xxTree) {
      if(i < typeLength) {
        if(xxTree._listeners) {
          // If we have a listener on a '**', it will catch all, so add its handler.
          searchListenerTree(handlers, type, xxTree, typeLength);
        }

        // Build arrays of matching next branches and others.
        for(branch in xxTree) {
          if(branch !== '_listeners' && xxTree.hasOwnProperty(branch)) {
            if(branch === nextType) {
              // We know the next element will match, so jump twice.
              searchListenerTree(handlers, type, xxTree[branch], i+2);
            } else if(branch === currentType) {
              // Current node matches, move into the tree.
              searchListenerTree(handlers, type, xxTree[branch], i+1);
            } else {
              isolatedBranch = {};
              isolatedBranch[branch] = xxTree[branch];
              searchListenerTree(handlers, type, { '**': isolatedBranch }, i+1);
            }
          }
        }
      } else if(xxTree._listeners) {
        // We have reached the end and still on a '**'
        searchListenerTree(handlers, type, xxTree, typeLength);
      } else if(xxTree['*'] && xxTree['*']._listeners) {
        searchListenerTree(handlers, type, xxTree['*'], typeLength);
      }
    }

    return listeners;
  }

  function growListenerTree(type, listener) {

    type = typeof type === 'string' ? type.split(this.delimiter) : type.slice();

    //
    // Looks for two consecutive '**', if so, don't add the event at all.
    //
    for(var i = 0, len = type.length; i+1 < len; i++) {
      if(type[i] === '**' && type[i+1] === '**') {
        return;
      }
    }

    var tree = this.listenerTree;
    var name = type.shift();

    while (name) {

      if (!tree[name]) {
        tree[name] = {};
      }

      tree = tree[name];

      if (type.length === 0) {

        if (!tree._listeners) {
          tree._listeners = listener;
        }
        else if(typeof tree._listeners === 'function') {
          tree._listeners = [tree._listeners, listener];
        }
        else if (isArray(tree._listeners)) {

          tree._listeners.push(listener);

          if (!tree._listeners.warned) {

            var m = defaultMaxListeners;

            if (typeof this._events.maxListeners !== 'undefined') {
              m = this._events.maxListeners;
            }

            if (m > 0 && tree._listeners.length > m) {

              tree._listeners.warned = true;
              console.error('(node) warning: possible EventEmitter memory ' +
                            'leak detected. %d listeners added. ' +
                            'Use emitter.setMaxListeners() to increase limit.',
                            tree._listeners.length);
              console.trace();
            }
          }
        }
        return true;
      }
      name = type.shift();
    }
    return true;
  }

  // By default EventEmitters will print a warning if more than
  // 10 listeners are added to it. This is a useful default which
  // helps finding memory leaks.
  //
  // Obviously not all Emitters should be limited to 10. This function allows
  // that to be increased. Set to zero for unlimited.

  EventEmitter.prototype.delimiter = '.';

  EventEmitter.prototype.setMaxListeners = function(n) {
    this._events || init.call(this);
    this._events.maxListeners = n;
    if (!this._conf) this._conf = {};
    this._conf.maxListeners = n;
  };

  EventEmitter.prototype.event = '';

  EventEmitter.prototype.once = function(event, fn) {
    this.many(event, 1, fn);
    return this;
  };

  EventEmitter.prototype.many = function(event, ttl, fn) {
    var self = this;

    if (typeof fn !== 'function') {
      throw new Error('many only accepts instances of Function');
    }

    function listener() {
      if (--ttl === 0) {
        self.off(event, listener);
      }
      fn.apply(this, arguments);
    }

    listener._origin = fn;

    this.on(event, listener);

    return self;
  };

  EventEmitter.prototype.emit = function() {

    this._events || init.call(this);

    var type = arguments[0];

    if (type === 'newListener' && !this.newListener) {
      if (!this._events.newListener) { return false; }
    }

    // Loop through the *_all* functions and invoke them.
    if (this._all) {
      var l = arguments.length;
      var args = new Array(l - 1);
      for (var i = 1; i < l; i++) args[i - 1] = arguments[i];
      for (i = 0, l = this._all.length; i < l; i++) {
        this.event = type;
        this._all[i].apply(this, args);
      }
    }

    // If there is no 'error' event listener then throw.
    if (type === 'error') {

      if (!this._all &&
        !this._events.error &&
        !(this.wildcard && this.listenerTree.error)) {

        if (arguments[1] instanceof Error) {
          throw arguments[1]; // Unhandled 'error' event
        } else {
          throw new Error("Uncaught, unspecified 'error' event.");
        }
        return false;
      }
    }

    var handler;

    if(this.wildcard) {
      handler = [];
      var ns = typeof type === 'string' ? type.split(this.delimiter) : type.slice();
      searchListenerTree.call(this, handler, ns, this.listenerTree, 0);
    }
    else {
      handler = this._events[type];
    }

    if (typeof handler === 'function') {
      this.event = type;
      if (arguments.length === 1) {
        handler.call(this);
      }
      else if (arguments.length > 1)
        switch (arguments.length) {
          case 2:
            handler.call(this, arguments[1]);
            break;
          case 3:
            handler.call(this, arguments[1], arguments[2]);
            break;
          // slower
          default:
            var l = arguments.length;
            var args = new Array(l - 1);
            for (var i = 1; i < l; i++) args[i - 1] = arguments[i];
            handler.apply(this, args);
        }
      return true;
    }
    else if (handler) {
      var l = arguments.length;
      var args = new Array(l - 1);
      for (var i = 1; i < l; i++) args[i - 1] = arguments[i];

      var listeners = handler.slice();
      for (var i = 0, l = listeners.length; i < l; i++) {
        this.event = type;
        listeners[i].apply(this, args);
      }
      return (listeners.length > 0) || !!this._all;
    }
    else {
      return !!this._all;
    }

  };

  EventEmitter.prototype.on = function(type, listener) {

    if (typeof type === 'function') {
      this.onAny(type);
      return this;
    }

    if (typeof listener !== 'function') {
      throw new Error('on only accepts instances of Function');
    }
    this._events || init.call(this);

    // To avoid recursion in the case that type == "newListeners"! Before
    // adding it to the listeners, first emit "newListeners".
    this.emit('newListener', type, listener);

    if(this.wildcard) {
      growListenerTree.call(this, type, listener);
      return this;
    }

    if (!this._events[type]) {
      // Optimize the case of one listener. Don't need the extra array object.
      this._events[type] = listener;
    }
    else if(typeof this._events[type] === 'function') {
      // Adding the second element, need to change to array.
      this._events[type] = [this._events[type], listener];
    }
    else if (isArray(this._events[type])) {
      // If we've already got an array, just append.
      this._events[type].push(listener);

      // Check for listener leak
      if (!this._events[type].warned) {

        var m = defaultMaxListeners;

        if (typeof this._events.maxListeners !== 'undefined') {
          m = this._events.maxListeners;
        }

        if (m > 0 && this._events[type].length > m) {

          this._events[type].warned = true;
          console.error('(node) warning: possible EventEmitter memory ' +
                        'leak detected. %d listeners added. ' +
                        'Use emitter.setMaxListeners() to increase limit.',
                        this._events[type].length);
          console.trace();
        }
      }
    }
    return this;
  };

  EventEmitter.prototype.onAny = function(fn) {

    if (typeof fn !== 'function') {
      throw new Error('onAny only accepts instances of Function');
    }

    if(!this._all) {
      this._all = [];
    }

    // Add the function to the event listener collection.
    this._all.push(fn);
    return this;
  };

  EventEmitter.prototype.addListener = EventEmitter.prototype.on;

  EventEmitter.prototype.off = function(type, listener) {
    if (typeof listener !== 'function') {
      throw new Error('removeListener only takes instances of Function');
    }

    var handlers,leafs=[];

    if(this.wildcard) {
      var ns = typeof type === 'string' ? type.split(this.delimiter) : type.slice();
      leafs = searchListenerTree.call(this, null, ns, this.listenerTree, 0);
    }
    else {
      // does not use listeners(), so no side effect of creating _events[type]
      if (!this._events[type]) return this;
      handlers = this._events[type];
      leafs.push({_listeners:handlers});
    }

    for (var iLeaf=0; iLeaf<leafs.length; iLeaf++) {
      var leaf = leafs[iLeaf];
      handlers = leaf._listeners;
      if (isArray(handlers)) {

        var position = -1;

        for (var i = 0, length = handlers.length; i < length; i++) {
          if (handlers[i] === listener ||
            (handlers[i].listener && handlers[i].listener === listener) ||
            (handlers[i]._origin && handlers[i]._origin === listener)) {
            position = i;
            break;
          }
        }

        if (position < 0) {
          continue;
        }

        if(this.wildcard) {
          leaf._listeners.splice(position, 1);
        }
        else {
          this._events[type].splice(position, 1);
        }

        if (handlers.length === 0) {
          if(this.wildcard) {
            delete leaf._listeners;
          }
          else {
            delete this._events[type];
          }
        }
        return this;
      }
      else if (handlers === listener ||
        (handlers.listener && handlers.listener === listener) ||
        (handlers._origin && handlers._origin === listener)) {
        if(this.wildcard) {
          delete leaf._listeners;
        }
        else {
          delete this._events[type];
        }
      }
    }

    return this;
  };

  EventEmitter.prototype.offAny = function(fn) {
    var i = 0, l = 0, fns;
    if (fn && this._all && this._all.length > 0) {
      fns = this._all;
      for(i = 0, l = fns.length; i < l; i++) {
        if(fn === fns[i]) {
          fns.splice(i, 1);
          return this;
        }
      }
    } else {
      this._all = [];
    }
    return this;
  };

  EventEmitter.prototype.removeListener = EventEmitter.prototype.off;

  EventEmitter.prototype.removeAllListeners = function(type) {
    if (arguments.length === 0) {
      !this._events || init.call(this);
      return this;
    }

    if(this.wildcard) {
      var ns = typeof type === 'string' ? type.split(this.delimiter) : type.slice();
      var leafs = searchListenerTree.call(this, null, ns, this.listenerTree, 0);

      for (var iLeaf=0; iLeaf<leafs.length; iLeaf++) {
        var leaf = leafs[iLeaf];
        leaf._listeners = null;
      }
    }
    else {
      if (!this._events[type]) return this;
      this._events[type] = null;
    }
    return this;
  };

  EventEmitter.prototype.listeners = function(type) {
    if(this.wildcard) {
      var handlers = [];
      var ns = typeof type === 'string' ? type.split(this.delimiter) : type.slice();
      searchListenerTree.call(this, handlers, ns, this.listenerTree, 0);
      return handlers;
    }

    this._events || init.call(this);

    if (!this._events[type]) this._events[type] = [];
    if (!isArray(this._events[type])) {
      this._events[type] = [this._events[type]];
    }
    return this._events[type];
  };

  EventEmitter.prototype.listenersAny = function() {

    if(this._all) {
      return this._all;
    }
    else {
      return [];
    }

  };

  if (typeof define === 'function' && define.amd) {
     // AMD. Register as an anonymous module.
    define(function() {
      return EventEmitter;
    });
  } else if (typeof exports === 'object') {
    // CommonJS
    exports.EventEmitter2 = EventEmitter;
  }
  else {
    // Browser global.
    window.EventEmitter2 = EventEmitter;
  }
}();

},{}],"/home/vagrant/openfec-web-app/node_modules/handlebars/dist/cjs/handlebars.js":[function(require,module,exports){
"use strict";
/*globals Handlebars: true */
var Handlebars = require("./handlebars.runtime")["default"];

// Compiler imports
var AST = require("./handlebars/compiler/ast")["default"];
var Parser = require("./handlebars/compiler/base").parser;
var parse = require("./handlebars/compiler/base").parse;
var Compiler = require("./handlebars/compiler/compiler").Compiler;
var compile = require("./handlebars/compiler/compiler").compile;
var precompile = require("./handlebars/compiler/compiler").precompile;
var JavaScriptCompiler = require("./handlebars/compiler/javascript-compiler")["default"];

var _create = Handlebars.create;
var create = function() {
  var hb = _create();

  hb.compile = function(input, options) {
    return compile(input, options, hb);
  };
  hb.precompile = function (input, options) {
    return precompile(input, options, hb);
  };

  hb.AST = AST;
  hb.Compiler = Compiler;
  hb.JavaScriptCompiler = JavaScriptCompiler;
  hb.Parser = Parser;
  hb.parse = parse;

  return hb;
};

Handlebars = create();
Handlebars.create = create;

Handlebars['default'] = Handlebars;

exports["default"] = Handlebars;
},{"./handlebars.runtime":"/home/vagrant/openfec-web-app/node_modules/handlebars/dist/cjs/handlebars.runtime.js","./handlebars/compiler/ast":"/home/vagrant/openfec-web-app/node_modules/handlebars/dist/cjs/handlebars/compiler/ast.js","./handlebars/compiler/base":"/home/vagrant/openfec-web-app/node_modules/handlebars/dist/cjs/handlebars/compiler/base.js","./handlebars/compiler/compiler":"/home/vagrant/openfec-web-app/node_modules/handlebars/dist/cjs/handlebars/compiler/compiler.js","./handlebars/compiler/javascript-compiler":"/home/vagrant/openfec-web-app/node_modules/handlebars/dist/cjs/handlebars/compiler/javascript-compiler.js"}],"/home/vagrant/openfec-web-app/node_modules/handlebars/dist/cjs/handlebars.runtime.js":[function(require,module,exports){
"use strict";
/*globals Handlebars: true */
var base = require("./handlebars/base");

// Each of these augment the Handlebars object. No need to setup here.
// (This is done to easily share code between commonjs and browse envs)
var SafeString = require("./handlebars/safe-string")["default"];
var Exception = require("./handlebars/exception")["default"];
var Utils = require("./handlebars/utils");
var runtime = require("./handlebars/runtime");

// For compatibility and usage outside of module systems, make the Handlebars object a namespace
var create = function() {
  var hb = new base.HandlebarsEnvironment();

  Utils.extend(hb, base);
  hb.SafeString = SafeString;
  hb.Exception = Exception;
  hb.Utils = Utils;
  hb.escapeExpression = Utils.escapeExpression;

  hb.VM = runtime;
  hb.template = function(spec) {
    return runtime.template(spec, hb);
  };

  return hb;
};

var Handlebars = create();
Handlebars.create = create;

Handlebars['default'] = Handlebars;

exports["default"] = Handlebars;
},{"./handlebars/base":"/home/vagrant/openfec-web-app/node_modules/handlebars/dist/cjs/handlebars/base.js","./handlebars/exception":"/home/vagrant/openfec-web-app/node_modules/handlebars/dist/cjs/handlebars/exception.js","./handlebars/runtime":"/home/vagrant/openfec-web-app/node_modules/handlebars/dist/cjs/handlebars/runtime.js","./handlebars/safe-string":"/home/vagrant/openfec-web-app/node_modules/handlebars/dist/cjs/handlebars/safe-string.js","./handlebars/utils":"/home/vagrant/openfec-web-app/node_modules/handlebars/dist/cjs/handlebars/utils.js"}],"/home/vagrant/openfec-web-app/node_modules/handlebars/dist/cjs/handlebars/base.js":[function(require,module,exports){
"use strict";
var Utils = require("./utils");
var Exception = require("./exception")["default"];

var VERSION = "2.0.0";
exports.VERSION = VERSION;var COMPILER_REVISION = 6;
exports.COMPILER_REVISION = COMPILER_REVISION;
var REVISION_CHANGES = {
  1: '<= 1.0.rc.2', // 1.0.rc.2 is actually rev2 but doesn't report it
  2: '== 1.0.0-rc.3',
  3: '== 1.0.0-rc.4',
  4: '== 1.x.x',
  5: '== 2.0.0-alpha.x',
  6: '>= 2.0.0-beta.1'
};
exports.REVISION_CHANGES = REVISION_CHANGES;
var isArray = Utils.isArray,
    isFunction = Utils.isFunction,
    toString = Utils.toString,
    objectType = '[object Object]';

function HandlebarsEnvironment(helpers, partials) {
  this.helpers = helpers || {};
  this.partials = partials || {};

  registerDefaultHelpers(this);
}

exports.HandlebarsEnvironment = HandlebarsEnvironment;HandlebarsEnvironment.prototype = {
  constructor: HandlebarsEnvironment,

  logger: logger,
  log: log,

  registerHelper: function(name, fn) {
    if (toString.call(name) === objectType) {
      if (fn) { throw new Exception('Arg not supported with multiple helpers'); }
      Utils.extend(this.helpers, name);
    } else {
      this.helpers[name] = fn;
    }
  },
  unregisterHelper: function(name) {
    delete this.helpers[name];
  },

  registerPartial: function(name, partial) {
    if (toString.call(name) === objectType) {
      Utils.extend(this.partials,  name);
    } else {
      this.partials[name] = partial;
    }
  },
  unregisterPartial: function(name) {
    delete this.partials[name];
  }
};

function registerDefaultHelpers(instance) {
  instance.registerHelper('helperMissing', function(/* [args, ]options */) {
    if(arguments.length === 1) {
      // A missing field in a {{foo}} constuct.
      return undefined;
    } else {
      // Someone is actually trying to call something, blow up.
      throw new Exception("Missing helper: '" + arguments[arguments.length-1].name + "'");
    }
  });

  instance.registerHelper('blockHelperMissing', function(context, options) {
    var inverse = options.inverse,
        fn = options.fn;

    if(context === true) {
      return fn(this);
    } else if(context === false || context == null) {
      return inverse(this);
    } else if (isArray(context)) {
      if(context.length > 0) {
        if (options.ids) {
          options.ids = [options.name];
        }

        return instance.helpers.each(context, options);
      } else {
        return inverse(this);
      }
    } else {
      if (options.data && options.ids) {
        var data = createFrame(options.data);
        data.contextPath = Utils.appendContextPath(options.data.contextPath, options.name);
        options = {data: data};
      }

      return fn(context, options);
    }
  });

  instance.registerHelper('each', function(context, options) {
    if (!options) {
      throw new Exception('Must pass iterator to #each');
    }

    var fn = options.fn, inverse = options.inverse;
    var i = 0, ret = "", data;

    var contextPath;
    if (options.data && options.ids) {
      contextPath = Utils.appendContextPath(options.data.contextPath, options.ids[0]) + '.';
    }

    if (isFunction(context)) { context = context.call(this); }

    if (options.data) {
      data = createFrame(options.data);
    }

    if(context && typeof context === 'object') {
      if (isArray(context)) {
        for(var j = context.length; i<j; i++) {
          if (data) {
            data.index = i;
            data.first = (i === 0);
            data.last  = (i === (context.length-1));

            if (contextPath) {
              data.contextPath = contextPath + i;
            }
          }
          ret = ret + fn(context[i], { data: data });
        }
      } else {
        for(var key in context) {
          if(context.hasOwnProperty(key)) {
            if(data) {
              data.key = key;
              data.index = i;
              data.first = (i === 0);

              if (contextPath) {
                data.contextPath = contextPath + key;
              }
            }
            ret = ret + fn(context[key], {data: data});
            i++;
          }
        }
      }
    }

    if(i === 0){
      ret = inverse(this);
    }

    return ret;
  });

  instance.registerHelper('if', function(conditional, options) {
    if (isFunction(conditional)) { conditional = conditional.call(this); }

    // Default behavior is to render the positive path if the value is truthy and not empty.
    // The `includeZero` option may be set to treat the condtional as purely not empty based on the
    // behavior of isEmpty. Effectively this determines if 0 is handled by the positive path or negative.
    if ((!options.hash.includeZero && !conditional) || Utils.isEmpty(conditional)) {
      return options.inverse(this);
    } else {
      return options.fn(this);
    }
  });

  instance.registerHelper('unless', function(conditional, options) {
    return instance.helpers['if'].call(this, conditional, {fn: options.inverse, inverse: options.fn, hash: options.hash});
  });

  instance.registerHelper('with', function(context, options) {
    if (isFunction(context)) { context = context.call(this); }

    var fn = options.fn;

    if (!Utils.isEmpty(context)) {
      if (options.data && options.ids) {
        var data = createFrame(options.data);
        data.contextPath = Utils.appendContextPath(options.data.contextPath, options.ids[0]);
        options = {data:data};
      }

      return fn(context, options);
    } else {
      return options.inverse(this);
    }
  });

  instance.registerHelper('log', function(message, options) {
    var level = options.data && options.data.level != null ? parseInt(options.data.level, 10) : 1;
    instance.log(level, message);
  });

  instance.registerHelper('lookup', function(obj, field) {
    return obj && obj[field];
  });
}

var logger = {
  methodMap: { 0: 'debug', 1: 'info', 2: 'warn', 3: 'error' },

  // State enum
  DEBUG: 0,
  INFO: 1,
  WARN: 2,
  ERROR: 3,
  level: 3,

  // can be overridden in the host environment
  log: function(level, message) {
    if (logger.level <= level) {
      var method = logger.methodMap[level];
      if (typeof console !== 'undefined' && console[method]) {
        console[method].call(console, message);
      }
    }
  }
};
exports.logger = logger;
var log = logger.log;
exports.log = log;
var createFrame = function(object) {
  var frame = Utils.extend({}, object);
  frame._parent = object;
  return frame;
};
exports.createFrame = createFrame;
},{"./exception":"/home/vagrant/openfec-web-app/node_modules/handlebars/dist/cjs/handlebars/exception.js","./utils":"/home/vagrant/openfec-web-app/node_modules/handlebars/dist/cjs/handlebars/utils.js"}],"/home/vagrant/openfec-web-app/node_modules/handlebars/dist/cjs/handlebars/compiler/ast.js":[function(require,module,exports){
"use strict";
var Exception = require("../exception")["default"];

function LocationInfo(locInfo) {
  locInfo = locInfo || {};
  this.firstLine   = locInfo.first_line;
  this.firstColumn = locInfo.first_column;
  this.lastColumn  = locInfo.last_column;
  this.lastLine    = locInfo.last_line;
}

var AST = {
  ProgramNode: function(statements, strip, locInfo) {
    LocationInfo.call(this, locInfo);
    this.type = "program";
    this.statements = statements;
    this.strip = strip;
  },

  MustacheNode: function(rawParams, hash, open, strip, locInfo) {
    LocationInfo.call(this, locInfo);
    this.type = "mustache";
    this.strip = strip;

    // Open may be a string parsed from the parser or a passed boolean flag
    if (open != null && open.charAt) {
      // Must use charAt to support IE pre-10
      var escapeFlag = open.charAt(3) || open.charAt(2);
      this.escaped = escapeFlag !== '{' && escapeFlag !== '&';
    } else {
      this.escaped = !!open;
    }

    if (rawParams instanceof AST.SexprNode) {
      this.sexpr = rawParams;
    } else {
      // Support old AST API
      this.sexpr = new AST.SexprNode(rawParams, hash);
    }

    // Support old AST API that stored this info in MustacheNode
    this.id = this.sexpr.id;
    this.params = this.sexpr.params;
    this.hash = this.sexpr.hash;
    this.eligibleHelper = this.sexpr.eligibleHelper;
    this.isHelper = this.sexpr.isHelper;
  },

  SexprNode: function(rawParams, hash, locInfo) {
    LocationInfo.call(this, locInfo);

    this.type = "sexpr";
    this.hash = hash;

    var id = this.id = rawParams[0];
    var params = this.params = rawParams.slice(1);

    // a mustache is definitely a helper if:
    // * it is an eligible helper, and
    // * it has at least one parameter or hash segment
    this.isHelper = !!(params.length || hash);

    // a mustache is an eligible helper if:
    // * its id is simple (a single part, not `this` or `..`)
    this.eligibleHelper = this.isHelper || id.isSimple;

    // if a mustache is an eligible helper but not a definite
    // helper, it is ambiguous, and will be resolved in a later
    // pass or at runtime.
  },

  PartialNode: function(partialName, context, hash, strip, locInfo) {
    LocationInfo.call(this, locInfo);
    this.type         = "partial";
    this.partialName  = partialName;
    this.context      = context;
    this.hash = hash;
    this.strip = strip;

    this.strip.inlineStandalone = true;
  },

  BlockNode: function(mustache, program, inverse, strip, locInfo) {
    LocationInfo.call(this, locInfo);

    this.type = 'block';
    this.mustache = mustache;
    this.program  = program;
    this.inverse  = inverse;
    this.strip = strip;

    if (inverse && !program) {
      this.isInverse = true;
    }
  },

  RawBlockNode: function(mustache, content, close, locInfo) {
    LocationInfo.call(this, locInfo);

    if (mustache.sexpr.id.original !== close) {
      throw new Exception(mustache.sexpr.id.original + " doesn't match " + close, this);
    }

    content = new AST.ContentNode(content, locInfo);

    this.type = 'block';
    this.mustache = mustache;
    this.program = new AST.ProgramNode([content], {}, locInfo);
  },

  ContentNode: function(string, locInfo) {
    LocationInfo.call(this, locInfo);
    this.type = "content";
    this.original = this.string = string;
  },

  HashNode: function(pairs, locInfo) {
    LocationInfo.call(this, locInfo);
    this.type = "hash";
    this.pairs = pairs;
  },

  IdNode: function(parts, locInfo) {
    LocationInfo.call(this, locInfo);
    this.type = "ID";

    var original = "",
        dig = [],
        depth = 0,
        depthString = '';

    for(var i=0,l=parts.length; i<l; i++) {
      var part = parts[i].part;
      original += (parts[i].separator || '') + part;

      if (part === ".." || part === "." || part === "this") {
        if (dig.length > 0) {
          throw new Exception("Invalid path: " + original, this);
        } else if (part === "..") {
          depth++;
          depthString += '../';
        } else {
          this.isScoped = true;
        }
      } else {
        dig.push(part);
      }
    }

    this.original = original;
    this.parts    = dig;
    this.string   = dig.join('.');
    this.depth    = depth;
    this.idName   = depthString + this.string;

    // an ID is simple if it only has one part, and that part is not
    // `..` or `this`.
    this.isSimple = parts.length === 1 && !this.isScoped && depth === 0;

    this.stringModeValue = this.string;
  },

  PartialNameNode: function(name, locInfo) {
    LocationInfo.call(this, locInfo);
    this.type = "PARTIAL_NAME";
    this.name = name.original;
  },

  DataNode: function(id, locInfo) {
    LocationInfo.call(this, locInfo);
    this.type = "DATA";
    this.id = id;
    this.stringModeValue = id.stringModeValue;
    this.idName = '@' + id.stringModeValue;
  },

  StringNode: function(string, locInfo) {
    LocationInfo.call(this, locInfo);
    this.type = "STRING";
    this.original =
      this.string =
      this.stringModeValue = string;
  },

  NumberNode: function(number, locInfo) {
    LocationInfo.call(this, locInfo);
    this.type = "NUMBER";
    this.original =
      this.number = number;
    this.stringModeValue = Number(number);
  },

  BooleanNode: function(bool, locInfo) {
    LocationInfo.call(this, locInfo);
    this.type = "BOOLEAN";
    this.bool = bool;
    this.stringModeValue = bool === "true";
  },

  CommentNode: function(comment, locInfo) {
    LocationInfo.call(this, locInfo);
    this.type = "comment";
    this.comment = comment;

    this.strip = {
      inlineStandalone: true
    };
  }
};


// Must be exported as an object rather than the root of the module as the jison lexer
// most modify the object to operate properly.
exports["default"] = AST;
},{"../exception":"/home/vagrant/openfec-web-app/node_modules/handlebars/dist/cjs/handlebars/exception.js"}],"/home/vagrant/openfec-web-app/node_modules/handlebars/dist/cjs/handlebars/compiler/base.js":[function(require,module,exports){
"use strict";
var parser = require("./parser")["default"];
var AST = require("./ast")["default"];
var Helpers = require("./helpers");
var extend = require("../utils").extend;

exports.parser = parser;

var yy = {};
extend(yy, Helpers, AST);

function parse(input) {
  // Just return if an already-compile AST was passed in.
  if (input.constructor === AST.ProgramNode) { return input; }

  parser.yy = yy;

  return parser.parse(input);
}

exports.parse = parse;
},{"../utils":"/home/vagrant/openfec-web-app/node_modules/handlebars/dist/cjs/handlebars/utils.js","./ast":"/home/vagrant/openfec-web-app/node_modules/handlebars/dist/cjs/handlebars/compiler/ast.js","./helpers":"/home/vagrant/openfec-web-app/node_modules/handlebars/dist/cjs/handlebars/compiler/helpers.js","./parser":"/home/vagrant/openfec-web-app/node_modules/handlebars/dist/cjs/handlebars/compiler/parser.js"}],"/home/vagrant/openfec-web-app/node_modules/handlebars/dist/cjs/handlebars/compiler/compiler.js":[function(require,module,exports){
"use strict";
var Exception = require("../exception")["default"];
var isArray = require("../utils").isArray;

var slice = [].slice;

function Compiler() {}

exports.Compiler = Compiler;// the foundHelper register will disambiguate helper lookup from finding a
// function in a context. This is necessary for mustache compatibility, which
// requires that context functions in blocks are evaluated by blockHelperMissing,
// and then proceed as if the resulting value was provided to blockHelperMissing.

Compiler.prototype = {
  compiler: Compiler,

  equals: function(other) {
    var len = this.opcodes.length;
    if (other.opcodes.length !== len) {
      return false;
    }

    for (var i = 0; i < len; i++) {
      var opcode = this.opcodes[i],
          otherOpcode = other.opcodes[i];
      if (opcode.opcode !== otherOpcode.opcode || !argEquals(opcode.args, otherOpcode.args)) {
        return false;
      }
    }

    // We know that length is the same between the two arrays because they are directly tied
    // to the opcode behavior above.
    len = this.children.length;
    for (i = 0; i < len; i++) {
      if (!this.children[i].equals(other.children[i])) {
        return false;
      }
    }

    return true;
  },

  guid: 0,

  compile: function(program, options) {
    this.opcodes = [];
    this.children = [];
    this.depths = {list: []};
    this.options = options;
    this.stringParams = options.stringParams;
    this.trackIds = options.trackIds;

    // These changes will propagate to the other compiler components
    var knownHelpers = this.options.knownHelpers;
    this.options.knownHelpers = {
      'helperMissing': true,
      'blockHelperMissing': true,
      'each': true,
      'if': true,
      'unless': true,
      'with': true,
      'log': true,
      'lookup': true
    };
    if (knownHelpers) {
      for (var name in knownHelpers) {
        this.options.knownHelpers[name] = knownHelpers[name];
      }
    }

    return this.accept(program);
  },

  accept: function(node) {
    return this[node.type](node);
  },

  program: function(program) {
    var statements = program.statements;

    for(var i=0, l=statements.length; i<l; i++) {
      this.accept(statements[i]);
    }
    this.isSimple = l === 1;

    this.depths.list = this.depths.list.sort(function(a, b) {
      return a - b;
    });

    return this;
  },

  compileProgram: function(program) {
    var result = new this.compiler().compile(program, this.options);
    var guid = this.guid++, depth;

    this.usePartial = this.usePartial || result.usePartial;

    this.children[guid] = result;

    for(var i=0, l=result.depths.list.length; i<l; i++) {
      depth = result.depths.list[i];

      if(depth < 2) { continue; }
      else { this.addDepth(depth - 1); }
    }

    return guid;
  },

  block: function(block) {
    var mustache = block.mustache,
        program = block.program,
        inverse = block.inverse;

    if (program) {
      program = this.compileProgram(program);
    }

    if (inverse) {
      inverse = this.compileProgram(inverse);
    }

    var sexpr = mustache.sexpr;
    var type = this.classifySexpr(sexpr);

    if (type === "helper") {
      this.helperSexpr(sexpr, program, inverse);
    } else if (type === "simple") {
      this.simpleSexpr(sexpr);

      // now that the simple mustache is resolved, we need to
      // evaluate it by executing `blockHelperMissing`
      this.opcode('pushProgram', program);
      this.opcode('pushProgram', inverse);
      this.opcode('emptyHash');
      this.opcode('blockValue', sexpr.id.original);
    } else {
      this.ambiguousSexpr(sexpr, program, inverse);

      // now that the simple mustache is resolved, we need to
      // evaluate it by executing `blockHelperMissing`
      this.opcode('pushProgram', program);
      this.opcode('pushProgram', inverse);
      this.opcode('emptyHash');
      this.opcode('ambiguousBlockValue');
    }

    this.opcode('append');
  },

  hash: function(hash) {
    var pairs = hash.pairs, i, l;

    this.opcode('pushHash');

    for(i=0, l=pairs.length; i<l; i++) {
      this.pushParam(pairs[i][1]);
    }
    while(i--) {
      this.opcode('assignToHash', pairs[i][0]);
    }
    this.opcode('popHash');
  },

  partial: function(partial) {
    var partialName = partial.partialName;
    this.usePartial = true;

    if (partial.hash) {
      this.accept(partial.hash);
    } else {
      this.opcode('push', 'undefined');
    }

    if (partial.context) {
      this.accept(partial.context);
    } else {
      this.opcode('getContext', 0);
      this.opcode('pushContext');
    }

    this.opcode('invokePartial', partialName.name, partial.indent || '');
    this.opcode('append');
  },

  content: function(content) {
    if (content.string) {
      this.opcode('appendContent', content.string);
    }
  },

  mustache: function(mustache) {
    this.sexpr(mustache.sexpr);

    if(mustache.escaped && !this.options.noEscape) {
      this.opcode('appendEscaped');
    } else {
      this.opcode('append');
    }
  },

  ambiguousSexpr: function(sexpr, program, inverse) {
    var id = sexpr.id,
        name = id.parts[0],
        isBlock = program != null || inverse != null;

    this.opcode('getContext', id.depth);

    this.opcode('pushProgram', program);
    this.opcode('pushProgram', inverse);

    this.ID(id);

    this.opcode('invokeAmbiguous', name, isBlock);
  },

  simpleSexpr: function(sexpr) {
    var id = sexpr.id;

    if (id.type === 'DATA') {
      this.DATA(id);
    } else if (id.parts.length) {
      this.ID(id);
    } else {
      // Simplified ID for `this`
      this.addDepth(id.depth);
      this.opcode('getContext', id.depth);
      this.opcode('pushContext');
    }

    this.opcode('resolvePossibleLambda');
  },

  helperSexpr: function(sexpr, program, inverse) {
    var params = this.setupFullMustacheParams(sexpr, program, inverse),
        id = sexpr.id,
        name = id.parts[0];

    if (this.options.knownHelpers[name]) {
      this.opcode('invokeKnownHelper', params.length, name);
    } else if (this.options.knownHelpersOnly) {
      throw new Exception("You specified knownHelpersOnly, but used the unknown helper " + name, sexpr);
    } else {
      id.falsy = true;

      this.ID(id);
      this.opcode('invokeHelper', params.length, id.original, id.isSimple);
    }
  },

  sexpr: function(sexpr) {
    var type = this.classifySexpr(sexpr);

    if (type === "simple") {
      this.simpleSexpr(sexpr);
    } else if (type === "helper") {
      this.helperSexpr(sexpr);
    } else {
      this.ambiguousSexpr(sexpr);
    }
  },

  ID: function(id) {
    this.addDepth(id.depth);
    this.opcode('getContext', id.depth);

    var name = id.parts[0];
    if (!name) {
      // Context reference, i.e. `{{foo .}}` or `{{foo ..}}`
      this.opcode('pushContext');
    } else {
      this.opcode('lookupOnContext', id.parts, id.falsy, id.isScoped);
    }
  },

  DATA: function(data) {
    this.options.data = true;
    this.opcode('lookupData', data.id.depth, data.id.parts);
  },

  STRING: function(string) {
    this.opcode('pushString', string.string);
  },

  NUMBER: function(number) {
    this.opcode('pushLiteral', number.number);
  },

  BOOLEAN: function(bool) {
    this.opcode('pushLiteral', bool.bool);
  },

  comment: function() {},

  // HELPERS
  opcode: function(name) {
    this.opcodes.push({ opcode: name, args: slice.call(arguments, 1) });
  },

  addDepth: function(depth) {
    if(depth === 0) { return; }

    if(!this.depths[depth]) {
      this.depths[depth] = true;
      this.depths.list.push(depth);
    }
  },

  classifySexpr: function(sexpr) {
    var isHelper   = sexpr.isHelper;
    var isEligible = sexpr.eligibleHelper;
    var options    = this.options;

    // if ambiguous, we can possibly resolve the ambiguity now
    // An eligible helper is one that does not have a complex path, i.e. `this.foo`, `../foo` etc.
    if (isEligible && !isHelper) {
      var name = sexpr.id.parts[0];

      if (options.knownHelpers[name]) {
        isHelper = true;
      } else if (options.knownHelpersOnly) {
        isEligible = false;
      }
    }

    if (isHelper) { return "helper"; }
    else if (isEligible) { return "ambiguous"; }
    else { return "simple"; }
  },

  pushParams: function(params) {
    for(var i=0, l=params.length; i<l; i++) {
      this.pushParam(params[i]);
    }
  },

  pushParam: function(val) {
    if (this.stringParams) {
      if(val.depth) {
        this.addDepth(val.depth);
      }
      this.opcode('getContext', val.depth || 0);
      this.opcode('pushStringParam', val.stringModeValue, val.type);

      if (val.type === 'sexpr') {
        // Subexpressions get evaluated and passed in
        // in string params mode.
        this.sexpr(val);
      }
    } else {
      if (this.trackIds) {
        this.opcode('pushId', val.type, val.idName || val.stringModeValue);
      }
      this.accept(val);
    }
  },

  setupFullMustacheParams: function(sexpr, program, inverse) {
    var params = sexpr.params;
    this.pushParams(params);

    this.opcode('pushProgram', program);
    this.opcode('pushProgram', inverse);

    if (sexpr.hash) {
      this.hash(sexpr.hash);
    } else {
      this.opcode('emptyHash');
    }

    return params;
  }
};

function precompile(input, options, env) {
  if (input == null || (typeof input !== 'string' && input.constructor !== env.AST.ProgramNode)) {
    throw new Exception("You must pass a string or Handlebars AST to Handlebars.precompile. You passed " + input);
  }

  options = options || {};
  if (!('data' in options)) {
    options.data = true;
  }
  if (options.compat) {
    options.useDepths = true;
  }

  var ast = env.parse(input);
  var environment = new env.Compiler().compile(ast, options);
  return new env.JavaScriptCompiler().compile(environment, options);
}

exports.precompile = precompile;function compile(input, options, env) {
  if (input == null || (typeof input !== 'string' && input.constructor !== env.AST.ProgramNode)) {
    throw new Exception("You must pass a string or Handlebars AST to Handlebars.compile. You passed " + input);
  }

  options = options || {};

  if (!('data' in options)) {
    options.data = true;
  }
  if (options.compat) {
    options.useDepths = true;
  }

  var compiled;

  function compileInput() {
    var ast = env.parse(input);
    var environment = new env.Compiler().compile(ast, options);
    var templateSpec = new env.JavaScriptCompiler().compile(environment, options, undefined, true);
    return env.template(templateSpec);
  }

  // Template is only compiled on first use and cached after that point.
  var ret = function(context, options) {
    if (!compiled) {
      compiled = compileInput();
    }
    return compiled.call(this, context, options);
  };
  ret._setup = function(options) {
    if (!compiled) {
      compiled = compileInput();
    }
    return compiled._setup(options);
  };
  ret._child = function(i, data, depths) {
    if (!compiled) {
      compiled = compileInput();
    }
    return compiled._child(i, data, depths);
  };
  return ret;
}

exports.compile = compile;function argEquals(a, b) {
  if (a === b) {
    return true;
  }

  if (isArray(a) && isArray(b) && a.length === b.length) {
    for (var i = 0; i < a.length; i++) {
      if (!argEquals(a[i], b[i])) {
        return false;
      }
    }
    return true;
  }
}
},{"../exception":"/home/vagrant/openfec-web-app/node_modules/handlebars/dist/cjs/handlebars/exception.js","../utils":"/home/vagrant/openfec-web-app/node_modules/handlebars/dist/cjs/handlebars/utils.js"}],"/home/vagrant/openfec-web-app/node_modules/handlebars/dist/cjs/handlebars/compiler/helpers.js":[function(require,module,exports){
"use strict";
var Exception = require("../exception")["default"];

function stripFlags(open, close) {
  return {
    left: open.charAt(2) === '~',
    right: close.charAt(close.length-3) === '~'
  };
}

exports.stripFlags = stripFlags;
function prepareBlock(mustache, program, inverseAndProgram, close, inverted, locInfo) {
  /*jshint -W040 */
  if (mustache.sexpr.id.original !== close.path.original) {
    throw new Exception(mustache.sexpr.id.original + ' doesn\'t match ' + close.path.original, mustache);
  }

  var inverse = inverseAndProgram && inverseAndProgram.program;

  var strip = {
    left: mustache.strip.left,
    right: close.strip.right,

    // Determine the standalone candiacy. Basically flag our content as being possibly standalone
    // so our parent can determine if we actually are standalone
    openStandalone: isNextWhitespace(program.statements),
    closeStandalone: isPrevWhitespace((inverse || program).statements)
  };

  if (mustache.strip.right) {
    omitRight(program.statements, null, true);
  }

  if (inverse) {
    var inverseStrip = inverseAndProgram.strip;

    if (inverseStrip.left) {
      omitLeft(program.statements, null, true);
    }
    if (inverseStrip.right) {
      omitRight(inverse.statements, null, true);
    }
    if (close.strip.left) {
      omitLeft(inverse.statements, null, true);
    }

    // Find standalone else statments
    if (isPrevWhitespace(program.statements)
        && isNextWhitespace(inverse.statements)) {

      omitLeft(program.statements);
      omitRight(inverse.statements);
    }
  } else {
    if (close.strip.left) {
      omitLeft(program.statements, null, true);
    }
  }

  if (inverted) {
    return new this.BlockNode(mustache, inverse, program, strip, locInfo);
  } else {
    return new this.BlockNode(mustache, program, inverse, strip, locInfo);
  }
}

exports.prepareBlock = prepareBlock;
function prepareProgram(statements, isRoot) {
  for (var i = 0, l = statements.length; i < l; i++) {
    var current = statements[i],
        strip = current.strip;

    if (!strip) {
      continue;
    }

    var _isPrevWhitespace = isPrevWhitespace(statements, i, isRoot, current.type === 'partial'),
        _isNextWhitespace = isNextWhitespace(statements, i, isRoot),

        openStandalone = strip.openStandalone && _isPrevWhitespace,
        closeStandalone = strip.closeStandalone && _isNextWhitespace,
        inlineStandalone = strip.inlineStandalone && _isPrevWhitespace && _isNextWhitespace;

    if (strip.right) {
      omitRight(statements, i, true);
    }
    if (strip.left) {
      omitLeft(statements, i, true);
    }

    if (inlineStandalone) {
      omitRight(statements, i);

      if (omitLeft(statements, i)) {
        // If we are on a standalone node, save the indent info for partials
        if (current.type === 'partial') {
          current.indent = (/([ \t]+$)/).exec(statements[i-1].original) ? RegExp.$1 : '';
        }
      }
    }
    if (openStandalone) {
      omitRight((current.program || current.inverse).statements);

      // Strip out the previous content node if it's whitespace only
      omitLeft(statements, i);
    }
    if (closeStandalone) {
      // Always strip the next node
      omitRight(statements, i);

      omitLeft((current.inverse || current.program).statements);
    }
  }

  return statements;
}

exports.prepareProgram = prepareProgram;function isPrevWhitespace(statements, i, isRoot) {
  if (i === undefined) {
    i = statements.length;
  }

  // Nodes that end with newlines are considered whitespace (but are special
  // cased for strip operations)
  var prev = statements[i-1],
      sibling = statements[i-2];
  if (!prev) {
    return isRoot;
  }

  if (prev.type === 'content') {
    return (sibling || !isRoot ? (/\r?\n\s*?$/) : (/(^|\r?\n)\s*?$/)).test(prev.original);
  }
}
function isNextWhitespace(statements, i, isRoot) {
  if (i === undefined) {
    i = -1;
  }

  var next = statements[i+1],
      sibling = statements[i+2];
  if (!next) {
    return isRoot;
  }

  if (next.type === 'content') {
    return (sibling || !isRoot ? (/^\s*?\r?\n/) : (/^\s*?(\r?\n|$)/)).test(next.original);
  }
}

// Marks the node to the right of the position as omitted.
// I.e. {{foo}}' ' will mark the ' ' node as omitted.
//
// If i is undefined, then the first child will be marked as such.
//
// If mulitple is truthy then all whitespace will be stripped out until non-whitespace
// content is met.
function omitRight(statements, i, multiple) {
  var current = statements[i == null ? 0 : i + 1];
  if (!current || current.type !== 'content' || (!multiple && current.rightStripped)) {
    return;
  }

  var original = current.string;
  current.string = current.string.replace(multiple ? (/^\s+/) : (/^[ \t]*\r?\n?/), '');
  current.rightStripped = current.string !== original;
}

// Marks the node to the left of the position as omitted.
// I.e. ' '{{foo}} will mark the ' ' node as omitted.
//
// If i is undefined then the last child will be marked as such.
//
// If mulitple is truthy then all whitespace will be stripped out until non-whitespace
// content is met.
function omitLeft(statements, i, multiple) {
  var current = statements[i == null ? statements.length - 1 : i - 1];
  if (!current || current.type !== 'content' || (!multiple && current.leftStripped)) {
    return;
  }

  // We omit the last node if it's whitespace only and not preceeded by a non-content node.
  var original = current.string;
  current.string = current.string.replace(multiple ? (/\s+$/) : (/[ \t]+$/), '');
  current.leftStripped = current.string !== original;
  return current.leftStripped;
}
},{"../exception":"/home/vagrant/openfec-web-app/node_modules/handlebars/dist/cjs/handlebars/exception.js"}],"/home/vagrant/openfec-web-app/node_modules/handlebars/dist/cjs/handlebars/compiler/javascript-compiler.js":[function(require,module,exports){
"use strict";
var COMPILER_REVISION = require("../base").COMPILER_REVISION;
var REVISION_CHANGES = require("../base").REVISION_CHANGES;
var Exception = require("../exception")["default"];

function Literal(value) {
  this.value = value;
}

function JavaScriptCompiler() {}

JavaScriptCompiler.prototype = {
  // PUBLIC API: You can override these methods in a subclass to provide
  // alternative compiled forms for name lookup and buffering semantics
  nameLookup: function(parent, name /* , type*/) {
    if (JavaScriptCompiler.isValidJavaScriptVariableName(name)) {
      return parent + "." + name;
    } else {
      return parent + "['" + name + "']";
    }
  },
  depthedLookup: function(name) {
    this.aliases.lookup = 'this.lookup';

    return 'lookup(depths, "' + name + '")';
  },

  compilerInfo: function() {
    var revision = COMPILER_REVISION,
        versions = REVISION_CHANGES[revision];
    return [revision, versions];
  },

  appendToBuffer: function(string) {
    if (this.environment.isSimple) {
      return "return " + string + ";";
    } else {
      return {
        appendToBuffer: true,
        content: string,
        toString: function() { return "buffer += " + string + ";"; }
      };
    }
  },

  initializeBuffer: function() {
    return this.quotedString("");
  },

  namespace: "Handlebars",
  // END PUBLIC API

  compile: function(environment, options, context, asObject) {
    this.environment = environment;
    this.options = options;
    this.stringParams = this.options.stringParams;
    this.trackIds = this.options.trackIds;
    this.precompile = !asObject;

    this.name = this.environment.name;
    this.isChild = !!context;
    this.context = context || {
      programs: [],
      environments: []
    };

    this.preamble();

    this.stackSlot = 0;
    this.stackVars = [];
    this.aliases = {};
    this.registers = { list: [] };
    this.hashes = [];
    this.compileStack = [];
    this.inlineStack = [];

    this.compileChildren(environment, options);

    this.useDepths = this.useDepths || environment.depths.list.length || this.options.compat;

    var opcodes = environment.opcodes,
        opcode,
        i,
        l;

    for (i = 0, l = opcodes.length; i < l; i++) {
      opcode = opcodes[i];

      this[opcode.opcode].apply(this, opcode.args);
    }

    // Flush any trailing content that might be pending.
    this.pushSource('');

    /* istanbul ignore next */
    if (this.stackSlot || this.inlineStack.length || this.compileStack.length) {
      throw new Exception('Compile completed with content left on stack');
    }

    var fn = this.createFunctionContext(asObject);
    if (!this.isChild) {
      var ret = {
        compiler: this.compilerInfo(),
        main: fn
      };
      var programs = this.context.programs;
      for (i = 0, l = programs.length; i < l; i++) {
        if (programs[i]) {
          ret[i] = programs[i];
        }
      }

      if (this.environment.usePartial) {
        ret.usePartial = true;
      }
      if (this.options.data) {
        ret.useData = true;
      }
      if (this.useDepths) {
        ret.useDepths = true;
      }
      if (this.options.compat) {
        ret.compat = true;
      }

      if (!asObject) {
        ret.compiler = JSON.stringify(ret.compiler);
        ret = this.objectLiteral(ret);
      }

      return ret;
    } else {
      return fn;
    }
  },

  preamble: function() {
    // track the last context pushed into place to allow skipping the
    // getContext opcode when it would be a noop
    this.lastContext = 0;
    this.source = [];
  },

  createFunctionContext: function(asObject) {
    var varDeclarations = '';

    var locals = this.stackVars.concat(this.registers.list);
    if(locals.length > 0) {
      varDeclarations += ", " + locals.join(", ");
    }

    // Generate minimizer alias mappings
    for (var alias in this.aliases) {
      if (this.aliases.hasOwnProperty(alias)) {
        varDeclarations += ', ' + alias + '=' + this.aliases[alias];
      }
    }

    var params = ["depth0", "helpers", "partials", "data"];

    if (this.useDepths) {
      params.push('depths');
    }

    // Perform a second pass over the output to merge content when possible
    var source = this.mergeSource(varDeclarations);

    if (asObject) {
      params.push(source);

      return Function.apply(this, params);
    } else {
      return 'function(' + params.join(',') + ') {\n  ' + source + '}';
    }
  },
  mergeSource: function(varDeclarations) {
    var source = '',
        buffer,
        appendOnly = !this.forceBuffer,
        appendFirst;

    for (var i = 0, len = this.source.length; i < len; i++) {
      var line = this.source[i];
      if (line.appendToBuffer) {
        if (buffer) {
          buffer = buffer + '\n    + ' + line.content;
        } else {
          buffer = line.content;
        }
      } else {
        if (buffer) {
          if (!source) {
            appendFirst = true;
            source = buffer + ';\n  ';
          } else {
            source += 'buffer += ' + buffer + ';\n  ';
          }
          buffer = undefined;
        }
        source += line + '\n  ';

        if (!this.environment.isSimple) {
          appendOnly = false;
        }
      }
    }

    if (appendOnly) {
      if (buffer || !source) {
        source += 'return ' + (buffer || '""') + ';\n';
      }
    } else {
      varDeclarations += ", buffer = " + (appendFirst ? '' : this.initializeBuffer());
      if (buffer) {
        source += 'return buffer + ' + buffer + ';\n';
      } else {
        source += 'return buffer;\n';
      }
    }

    if (varDeclarations) {
      source = 'var ' + varDeclarations.substring(2) + (appendFirst ? '' : ';\n  ') + source;
    }

    return source;
  },

  // [blockValue]
  //
  // On stack, before: hash, inverse, program, value
  // On stack, after: return value of blockHelperMissing
  //
  // The purpose of this opcode is to take a block of the form
  // `{{#this.foo}}...{{/this.foo}}`, resolve the value of `foo`, and
  // replace it on the stack with the result of properly
  // invoking blockHelperMissing.
  blockValue: function(name) {
    this.aliases.blockHelperMissing = 'helpers.blockHelperMissing';

    var params = [this.contextName(0)];
    this.setupParams(name, 0, params);

    var blockName = this.popStack();
    params.splice(1, 0, blockName);

    this.push('blockHelperMissing.call(' + params.join(', ') + ')');
  },

  // [ambiguousBlockValue]
  //
  // On stack, before: hash, inverse, program, value
  // Compiler value, before: lastHelper=value of last found helper, if any
  // On stack, after, if no lastHelper: same as [blockValue]
  // On stack, after, if lastHelper: value
  ambiguousBlockValue: function() {
    this.aliases.blockHelperMissing = 'helpers.blockHelperMissing';

    // We're being a bit cheeky and reusing the options value from the prior exec
    var params = [this.contextName(0)];
    this.setupParams('', 0, params, true);

    this.flushInline();

    var current = this.topStack();
    params.splice(1, 0, current);

    this.pushSource("if (!" + this.lastHelper + ") { " + current + " = blockHelperMissing.call(" + params.join(", ") + "); }");
  },

  // [appendContent]
  //
  // On stack, before: ...
  // On stack, after: ...
  //
  // Appends the string value of `content` to the current buffer
  appendContent: function(content) {
    if (this.pendingContent) {
      content = this.pendingContent + content;
    }

    this.pendingContent = content;
  },

  // [append]
  //
  // On stack, before: value, ...
  // On stack, after: ...
  //
  // Coerces `value` to a String and appends it to the current buffer.
  //
  // If `value` is truthy, or 0, it is coerced into a string and appended
  // Otherwise, the empty string is appended
  append: function() {
    // Force anything that is inlined onto the stack so we don't have duplication
    // when we examine local
    this.flushInline();
    var local = this.popStack();
    this.pushSource('if (' + local + ' != null) { ' + this.appendToBuffer(local) + ' }');
    if (this.environment.isSimple) {
      this.pushSource("else { " + this.appendToBuffer("''") + " }");
    }
  },

  // [appendEscaped]
  //
  // On stack, before: value, ...
  // On stack, after: ...
  //
  // Escape `value` and append it to the buffer
  appendEscaped: function() {
    this.aliases.escapeExpression = 'this.escapeExpression';

    this.pushSource(this.appendToBuffer("escapeExpression(" + this.popStack() + ")"));
  },

  // [getContext]
  //
  // On stack, before: ...
  // On stack, after: ...
  // Compiler value, after: lastContext=depth
  //
  // Set the value of the `lastContext` compiler value to the depth
  getContext: function(depth) {
    this.lastContext = depth;
  },

  // [pushContext]
  //
  // On stack, before: ...
  // On stack, after: currentContext, ...
  //
  // Pushes the value of the current context onto the stack.
  pushContext: function() {
    this.pushStackLiteral(this.contextName(this.lastContext));
  },

  // [lookupOnContext]
  //
  // On stack, before: ...
  // On stack, after: currentContext[name], ...
  //
  // Looks up the value of `name` on the current context and pushes
  // it onto the stack.
  lookupOnContext: function(parts, falsy, scoped) {
    /*jshint -W083 */
    var i = 0,
        len = parts.length;

    if (!scoped && this.options.compat && !this.lastContext) {
      // The depthed query is expected to handle the undefined logic for the root level that
      // is implemented below, so we evaluate that directly in compat mode
      this.push(this.depthedLookup(parts[i++]));
    } else {
      this.pushContext();
    }

    for (; i < len; i++) {
      this.replaceStack(function(current) {
        var lookup = this.nameLookup(current, parts[i], 'context');
        // We want to ensure that zero and false are handled properly if the context (falsy flag)
        // needs to have the special handling for these values.
        if (!falsy) {
          return ' != null ? ' + lookup + ' : ' + current;
        } else {
          // Otherwise we can use generic falsy handling
          return ' && ' + lookup;
        }
      });
    }
  },

  // [lookupData]
  //
  // On stack, before: ...
  // On stack, after: data, ...
  //
  // Push the data lookup operator
  lookupData: function(depth, parts) {
    /*jshint -W083 */
    if (!depth) {
      this.pushStackLiteral('data');
    } else {
      this.pushStackLiteral('this.data(data, ' + depth + ')');
    }

    var len = parts.length;
    for (var i = 0; i < len; i++) {
      this.replaceStack(function(current) {
        return ' && ' + this.nameLookup(current, parts[i], 'data');
      });
    }
  },

  // [resolvePossibleLambda]
  //
  // On stack, before: value, ...
  // On stack, after: resolved value, ...
  //
  // If the `value` is a lambda, replace it on the stack by
  // the return value of the lambda
  resolvePossibleLambda: function() {
    this.aliases.lambda = 'this.lambda';

    this.push('lambda(' + this.popStack() + ', ' + this.contextName(0) + ')');
  },

  // [pushStringParam]
  //
  // On stack, before: ...
  // On stack, after: string, currentContext, ...
  //
  // This opcode is designed for use in string mode, which
  // provides the string value of a parameter along with its
  // depth rather than resolving it immediately.
  pushStringParam: function(string, type) {
    this.pushContext();
    this.pushString(type);

    // If it's a subexpression, the string result
    // will be pushed after this opcode.
    if (type !== 'sexpr') {
      if (typeof string === 'string') {
        this.pushString(string);
      } else {
        this.pushStackLiteral(string);
      }
    }
  },

  emptyHash: function() {
    this.pushStackLiteral('{}');

    if (this.trackIds) {
      this.push('{}'); // hashIds
    }
    if (this.stringParams) {
      this.push('{}'); // hashContexts
      this.push('{}'); // hashTypes
    }
  },
  pushHash: function() {
    if (this.hash) {
      this.hashes.push(this.hash);
    }
    this.hash = {values: [], types: [], contexts: [], ids: []};
  },
  popHash: function() {
    var hash = this.hash;
    this.hash = this.hashes.pop();

    if (this.trackIds) {
      this.push('{' + hash.ids.join(',') + '}');
    }
    if (this.stringParams) {
      this.push('{' + hash.contexts.join(',') + '}');
      this.push('{' + hash.types.join(',') + '}');
    }

    this.push('{\n    ' + hash.values.join(',\n    ') + '\n  }');
  },

  // [pushString]
  //
  // On stack, before: ...
  // On stack, after: quotedString(string), ...
  //
  // Push a quoted version of `string` onto the stack
  pushString: function(string) {
    this.pushStackLiteral(this.quotedString(string));
  },

  // [push]
  //
  // On stack, before: ...
  // On stack, after: expr, ...
  //
  // Push an expression onto the stack
  push: function(expr) {
    this.inlineStack.push(expr);
    return expr;
  },

  // [pushLiteral]
  //
  // On stack, before: ...
  // On stack, after: value, ...
  //
  // Pushes a value onto the stack. This operation prevents
  // the compiler from creating a temporary variable to hold
  // it.
  pushLiteral: function(value) {
    this.pushStackLiteral(value);
  },

  // [pushProgram]
  //
  // On stack, before: ...
  // On stack, after: program(guid), ...
  //
  // Push a program expression onto the stack. This takes
  // a compile-time guid and converts it into a runtime-accessible
  // expression.
  pushProgram: function(guid) {
    if (guid != null) {
      this.pushStackLiteral(this.programExpression(guid));
    } else {
      this.pushStackLiteral(null);
    }
  },

  // [invokeHelper]
  //
  // On stack, before: hash, inverse, program, params..., ...
  // On stack, after: result of helper invocation
  //
  // Pops off the helper's parameters, invokes the helper,
  // and pushes the helper's return value onto the stack.
  //
  // If the helper is not found, `helperMissing` is called.
  invokeHelper: function(paramSize, name, isSimple) {
    this.aliases.helperMissing = 'helpers.helperMissing';

    var nonHelper = this.popStack();
    var helper = this.setupHelper(paramSize, name);

    var lookup = (isSimple ? helper.name + ' || ' : '') + nonHelper + ' || helperMissing';
    this.push('((' + lookup + ').call(' + helper.callParams + '))');
  },

  // [invokeKnownHelper]
  //
  // On stack, before: hash, inverse, program, params..., ...
  // On stack, after: result of helper invocation
  //
  // This operation is used when the helper is known to exist,
  // so a `helperMissing` fallback is not required.
  invokeKnownHelper: function(paramSize, name) {
    var helper = this.setupHelper(paramSize, name);
    this.push(helper.name + ".call(" + helper.callParams + ")");
  },

  // [invokeAmbiguous]
  //
  // On stack, before: hash, inverse, program, params..., ...
  // On stack, after: result of disambiguation
  //
  // This operation is used when an expression like `{{foo}}`
  // is provided, but we don't know at compile-time whether it
  // is a helper or a path.
  //
  // This operation emits more code than the other options,
  // and can be avoided by passing the `knownHelpers` and
  // `knownHelpersOnly` flags at compile-time.
  invokeAmbiguous: function(name, helperCall) {
    this.aliases.functionType = '"function"';
    this.aliases.helperMissing = 'helpers.helperMissing';
    this.useRegister('helper');

    var nonHelper = this.popStack();

    this.emptyHash();
    var helper = this.setupHelper(0, name, helperCall);

    var helperName = this.lastHelper = this.nameLookup('helpers', name, 'helper');

    this.push(
      '((helper = (helper = ' + helperName + ' || ' + nonHelper + ') != null ? helper : helperMissing'
        + (helper.paramsInit ? '),(' + helper.paramsInit : '') + '),'
      + '(typeof helper === functionType ? helper.call(' + helper.callParams + ') : helper))');
  },

  // [invokePartial]
  //
  // On stack, before: context, ...
  // On stack after: result of partial invocation
  //
  // This operation pops off a context, invokes a partial with that context,
  // and pushes the result of the invocation back.
  invokePartial: function(name, indent) {
    var params = [this.nameLookup('partials', name, 'partial'), "'" + indent + "'", "'" + name + "'", this.popStack(), this.popStack(), "helpers", "partials"];

    if (this.options.data) {
      params.push("data");
    } else if (this.options.compat) {
      params.push('undefined');
    }
    if (this.options.compat) {
      params.push('depths');
    }

    this.push("this.invokePartial(" + params.join(", ") + ")");
  },

  // [assignToHash]
  //
  // On stack, before: value, ..., hash, ...
  // On stack, after: ..., hash, ...
  //
  // Pops a value off the stack and assigns it to the current hash
  assignToHash: function(key) {
    var value = this.popStack(),
        context,
        type,
        id;

    if (this.trackIds) {
      id = this.popStack();
    }
    if (this.stringParams) {
      type = this.popStack();
      context = this.popStack();
    }

    var hash = this.hash;
    if (context) {
      hash.contexts.push("'" + key + "': " + context);
    }
    if (type) {
      hash.types.push("'" + key + "': " + type);
    }
    if (id) {
      hash.ids.push("'" + key + "': " + id);
    }
    hash.values.push("'" + key + "': (" + value + ")");
  },

  pushId: function(type, name) {
    if (type === 'ID' || type === 'DATA') {
      this.pushString(name);
    } else if (type === 'sexpr') {
      this.pushStackLiteral('true');
    } else {
      this.pushStackLiteral('null');
    }
  },

  // HELPERS

  compiler: JavaScriptCompiler,

  compileChildren: function(environment, options) {
    var children = environment.children, child, compiler;

    for(var i=0, l=children.length; i<l; i++) {
      child = children[i];
      compiler = new this.compiler();

      var index = this.matchExistingProgram(child);

      if (index == null) {
        this.context.programs.push('');     // Placeholder to prevent name conflicts for nested children
        index = this.context.programs.length;
        child.index = index;
        child.name = 'program' + index;
        this.context.programs[index] = compiler.compile(child, options, this.context, !this.precompile);
        this.context.environments[index] = child;

        this.useDepths = this.useDepths || compiler.useDepths;
      } else {
        child.index = index;
        child.name = 'program' + index;
      }
    }
  },
  matchExistingProgram: function(child) {
    for (var i = 0, len = this.context.environments.length; i < len; i++) {
      var environment = this.context.environments[i];
      if (environment && environment.equals(child)) {
        return i;
      }
    }
  },

  programExpression: function(guid) {
    var child = this.environment.children[guid],
        depths = child.depths.list,
        useDepths = this.useDepths,
        depth;

    var programParams = [child.index, 'data'];

    if (useDepths) {
      programParams.push('depths');
    }

    return 'this.program(' + programParams.join(', ') + ')';
  },

  useRegister: function(name) {
    if(!this.registers[name]) {
      this.registers[name] = true;
      this.registers.list.push(name);
    }
  },

  pushStackLiteral: function(item) {
    return this.push(new Literal(item));
  },

  pushSource: function(source) {
    if (this.pendingContent) {
      this.source.push(this.appendToBuffer(this.quotedString(this.pendingContent)));
      this.pendingContent = undefined;
    }

    if (source) {
      this.source.push(source);
    }
  },

  pushStack: function(item) {
    this.flushInline();

    var stack = this.incrStack();
    this.pushSource(stack + " = " + item + ";");
    this.compileStack.push(stack);
    return stack;
  },

  replaceStack: function(callback) {
    var prefix = '',
        inline = this.isInline(),
        stack,
        createdStack,
        usedLiteral;

    /* istanbul ignore next */
    if (!this.isInline()) {
      throw new Exception('replaceStack on non-inline');
    }

    // We want to merge the inline statement into the replacement statement via ','
    var top = this.popStack(true);

    if (top instanceof Literal) {
      // Literals do not need to be inlined
      prefix = stack = top.value;
      usedLiteral = true;
    } else {
      // Get or create the current stack name for use by the inline
      createdStack = !this.stackSlot;
      var name = !createdStack ? this.topStackName() : this.incrStack();

      prefix = '(' + this.push(name) + ' = ' + top + ')';
      stack = this.topStack();
    }

    var item = callback.call(this, stack);

    if (!usedLiteral) {
      this.popStack();
    }
    if (createdStack) {
      this.stackSlot--;
    }
    this.push('(' + prefix + item + ')');
  },

  incrStack: function() {
    this.stackSlot++;
    if(this.stackSlot > this.stackVars.length) { this.stackVars.push("stack" + this.stackSlot); }
    return this.topStackName();
  },
  topStackName: function() {
    return "stack" + this.stackSlot;
  },
  flushInline: function() {
    var inlineStack = this.inlineStack;
    if (inlineStack.length) {
      this.inlineStack = [];
      for (var i = 0, len = inlineStack.length; i < len; i++) {
        var entry = inlineStack[i];
        if (entry instanceof Literal) {
          this.compileStack.push(entry);
        } else {
          this.pushStack(entry);
        }
      }
    }
  },
  isInline: function() {
    return this.inlineStack.length;
  },

  popStack: function(wrapped) {
    var inline = this.isInline(),
        item = (inline ? this.inlineStack : this.compileStack).pop();

    if (!wrapped && (item instanceof Literal)) {
      return item.value;
    } else {
      if (!inline) {
        /* istanbul ignore next */
        if (!this.stackSlot) {
          throw new Exception('Invalid stack pop');
        }
        this.stackSlot--;
      }
      return item;
    }
  },

  topStack: function() {
    var stack = (this.isInline() ? this.inlineStack : this.compileStack),
        item = stack[stack.length - 1];

    if (item instanceof Literal) {
      return item.value;
    } else {
      return item;
    }
  },

  contextName: function(context) {
    if (this.useDepths && context) {
      return 'depths[' + context + ']';
    } else {
      return 'depth' + context;
    }
  },

  quotedString: function(str) {
    return '"' + str
      .replace(/\\/g, '\\\\')
      .replace(/"/g, '\\"')
      .replace(/\n/g, '\\n')
      .replace(/\r/g, '\\r')
      .replace(/\u2028/g, '\\u2028')   // Per Ecma-262 7.3 + 7.8.4
      .replace(/\u2029/g, '\\u2029') + '"';
  },

  objectLiteral: function(obj) {
    var pairs = [];

    for (var key in obj) {
      if (obj.hasOwnProperty(key)) {
        pairs.push(this.quotedString(key) + ':' + obj[key]);
      }
    }

    return '{' + pairs.join(',') + '}';
  },

  setupHelper: function(paramSize, name, blockHelper) {
    var params = [],
        paramsInit = this.setupParams(name, paramSize, params, blockHelper);
    var foundHelper = this.nameLookup('helpers', name, 'helper');

    return {
      params: params,
      paramsInit: paramsInit,
      name: foundHelper,
      callParams: [this.contextName(0)].concat(params).join(", ")
    };
  },

  setupOptions: function(helper, paramSize, params) {
    var options = {}, contexts = [], types = [], ids = [], param, inverse, program;

    options.name = this.quotedString(helper);
    options.hash = this.popStack();

    if (this.trackIds) {
      options.hashIds = this.popStack();
    }
    if (this.stringParams) {
      options.hashTypes = this.popStack();
      options.hashContexts = this.popStack();
    }

    inverse = this.popStack();
    program = this.popStack();

    // Avoid setting fn and inverse if neither are set. This allows
    // helpers to do a check for `if (options.fn)`
    if (program || inverse) {
      if (!program) {
        program = 'this.noop';
      }

      if (!inverse) {
        inverse = 'this.noop';
      }

      options.fn = program;
      options.inverse = inverse;
    }

    // The parameters go on to the stack in order (making sure that they are evaluated in order)
    // so we need to pop them off the stack in reverse order
    var i = paramSize;
    while (i--) {
      param = this.popStack();
      params[i] = param;

      if (this.trackIds) {
        ids[i] = this.popStack();
      }
      if (this.stringParams) {
        types[i] = this.popStack();
        contexts[i] = this.popStack();
      }
    }

    if (this.trackIds) {
      options.ids = "[" + ids.join(",") + "]";
    }
    if (this.stringParams) {
      options.types = "[" + types.join(",") + "]";
      options.contexts = "[" + contexts.join(",") + "]";
    }

    if (this.options.data) {
      options.data = "data";
    }

    return options;
  },

  // the params and contexts arguments are passed in arrays
  // to fill in
  setupParams: function(helperName, paramSize, params, useRegister) {
    var options = this.objectLiteral(this.setupOptions(helperName, paramSize, params));

    if (useRegister) {
      this.useRegister('options');
      params.push('options');
      return 'options=' + options;
    } else {
      params.push(options);
      return '';
    }
  }
};

var reservedWords = (
  "break else new var" +
  " case finally return void" +
  " catch for switch while" +
  " continue function this with" +
  " default if throw" +
  " delete in try" +
  " do instanceof typeof" +
  " abstract enum int short" +
  " boolean export interface static" +
  " byte extends long super" +
  " char final native synchronized" +
  " class float package throws" +
  " const goto private transient" +
  " debugger implements protected volatile" +
  " double import public let yield"
).split(" ");

var compilerWords = JavaScriptCompiler.RESERVED_WORDS = {};

for(var i=0, l=reservedWords.length; i<l; i++) {
  compilerWords[reservedWords[i]] = true;
}

JavaScriptCompiler.isValidJavaScriptVariableName = function(name) {
  return !JavaScriptCompiler.RESERVED_WORDS[name] && /^[a-zA-Z_$][0-9a-zA-Z_$]*$/.test(name);
};

exports["default"] = JavaScriptCompiler;
},{"../base":"/home/vagrant/openfec-web-app/node_modules/handlebars/dist/cjs/handlebars/base.js","../exception":"/home/vagrant/openfec-web-app/node_modules/handlebars/dist/cjs/handlebars/exception.js"}],"/home/vagrant/openfec-web-app/node_modules/handlebars/dist/cjs/handlebars/compiler/parser.js":[function(require,module,exports){
"use strict";
/* jshint ignore:start */
/* istanbul ignore next */
/* Jison generated parser */
var handlebars = (function(){
var parser = {trace: function trace() { },
yy: {},
symbols_: {"error":2,"root":3,"program":4,"EOF":5,"program_repetition0":6,"statement":7,"mustache":8,"block":9,"rawBlock":10,"partial":11,"CONTENT":12,"COMMENT":13,"openRawBlock":14,"END_RAW_BLOCK":15,"OPEN_RAW_BLOCK":16,"sexpr":17,"CLOSE_RAW_BLOCK":18,"openBlock":19,"block_option0":20,"closeBlock":21,"openInverse":22,"block_option1":23,"OPEN_BLOCK":24,"CLOSE":25,"OPEN_INVERSE":26,"inverseAndProgram":27,"INVERSE":28,"OPEN_ENDBLOCK":29,"path":30,"OPEN":31,"OPEN_UNESCAPED":32,"CLOSE_UNESCAPED":33,"OPEN_PARTIAL":34,"partialName":35,"param":36,"partial_option0":37,"partial_option1":38,"sexpr_repetition0":39,"sexpr_option0":40,"dataName":41,"STRING":42,"NUMBER":43,"BOOLEAN":44,"OPEN_SEXPR":45,"CLOSE_SEXPR":46,"hash":47,"hash_repetition_plus0":48,"hashSegment":49,"ID":50,"EQUALS":51,"DATA":52,"pathSegments":53,"SEP":54,"$accept":0,"$end":1},
terminals_: {2:"error",5:"EOF",12:"CONTENT",13:"COMMENT",15:"END_RAW_BLOCK",16:"OPEN_RAW_BLOCK",18:"CLOSE_RAW_BLOCK",24:"OPEN_BLOCK",25:"CLOSE",26:"OPEN_INVERSE",28:"INVERSE",29:"OPEN_ENDBLOCK",31:"OPEN",32:"OPEN_UNESCAPED",33:"CLOSE_UNESCAPED",34:"OPEN_PARTIAL",42:"STRING",43:"NUMBER",44:"BOOLEAN",45:"OPEN_SEXPR",46:"CLOSE_SEXPR",50:"ID",51:"EQUALS",52:"DATA",54:"SEP"},
productions_: [0,[3,2],[4,1],[7,1],[7,1],[7,1],[7,1],[7,1],[7,1],[10,3],[14,3],[9,4],[9,4],[19,3],[22,3],[27,2],[21,3],[8,3],[8,3],[11,5],[11,4],[17,3],[17,1],[36,1],[36,1],[36,1],[36,1],[36,1],[36,3],[47,1],[49,3],[35,1],[35,1],[35,1],[41,2],[30,1],[53,3],[53,1],[6,0],[6,2],[20,0],[20,1],[23,0],[23,1],[37,0],[37,1],[38,0],[38,1],[39,0],[39,2],[40,0],[40,1],[48,1],[48,2]],
performAction: function anonymous(yytext,yyleng,yylineno,yy,yystate,$$,_$) {

var $0 = $$.length - 1;
switch (yystate) {
case 1: yy.prepareProgram($$[$0-1].statements, true); return $$[$0-1]; 
break;
case 2:this.$ = new yy.ProgramNode(yy.prepareProgram($$[$0]), {}, this._$);
break;
case 3:this.$ = $$[$0];
break;
case 4:this.$ = $$[$0];
break;
case 5:this.$ = $$[$0];
break;
case 6:this.$ = $$[$0];
break;
case 7:this.$ = new yy.ContentNode($$[$0], this._$);
break;
case 8:this.$ = new yy.CommentNode($$[$0], this._$);
break;
case 9:this.$ = new yy.RawBlockNode($$[$0-2], $$[$0-1], $$[$0], this._$);
break;
case 10:this.$ = new yy.MustacheNode($$[$0-1], null, '', '', this._$);
break;
case 11:this.$ = yy.prepareBlock($$[$0-3], $$[$0-2], $$[$0-1], $$[$0], false, this._$);
break;
case 12:this.$ = yy.prepareBlock($$[$0-3], $$[$0-2], $$[$0-1], $$[$0], true, this._$);
break;
case 13:this.$ = new yy.MustacheNode($$[$0-1], null, $$[$0-2], yy.stripFlags($$[$0-2], $$[$0]), this._$);
break;
case 14:this.$ = new yy.MustacheNode($$[$0-1], null, $$[$0-2], yy.stripFlags($$[$0-2], $$[$0]), this._$);
break;
case 15:this.$ = { strip: yy.stripFlags($$[$0-1], $$[$0-1]), program: $$[$0] };
break;
case 16:this.$ = {path: $$[$0-1], strip: yy.stripFlags($$[$0-2], $$[$0])};
break;
case 17:this.$ = new yy.MustacheNode($$[$0-1], null, $$[$0-2], yy.stripFlags($$[$0-2], $$[$0]), this._$);
break;
case 18:this.$ = new yy.MustacheNode($$[$0-1], null, $$[$0-2], yy.stripFlags($$[$0-2], $$[$0]), this._$);
break;
case 19:this.$ = new yy.PartialNode($$[$0-3], $$[$0-2], $$[$0-1], yy.stripFlags($$[$0-4], $$[$0]), this._$);
break;
case 20:this.$ = new yy.PartialNode($$[$0-2], undefined, $$[$0-1], yy.stripFlags($$[$0-3], $$[$0]), this._$);
break;
case 21:this.$ = new yy.SexprNode([$$[$0-2]].concat($$[$0-1]), $$[$0], this._$);
break;
case 22:this.$ = new yy.SexprNode([$$[$0]], null, this._$);
break;
case 23:this.$ = $$[$0];
break;
case 24:this.$ = new yy.StringNode($$[$0], this._$);
break;
case 25:this.$ = new yy.NumberNode($$[$0], this._$);
break;
case 26:this.$ = new yy.BooleanNode($$[$0], this._$);
break;
case 27:this.$ = $$[$0];
break;
case 28:$$[$0-1].isHelper = true; this.$ = $$[$0-1];
break;
case 29:this.$ = new yy.HashNode($$[$0], this._$);
break;
case 30:this.$ = [$$[$0-2], $$[$0]];
break;
case 31:this.$ = new yy.PartialNameNode($$[$0], this._$);
break;
case 32:this.$ = new yy.PartialNameNode(new yy.StringNode($$[$0], this._$), this._$);
break;
case 33:this.$ = new yy.PartialNameNode(new yy.NumberNode($$[$0], this._$));
break;
case 34:this.$ = new yy.DataNode($$[$0], this._$);
break;
case 35:this.$ = new yy.IdNode($$[$0], this._$);
break;
case 36: $$[$0-2].push({part: $$[$0], separator: $$[$0-1]}); this.$ = $$[$0-2]; 
break;
case 37:this.$ = [{part: $$[$0]}];
break;
case 38:this.$ = [];
break;
case 39:$$[$0-1].push($$[$0]);
break;
case 48:this.$ = [];
break;
case 49:$$[$0-1].push($$[$0]);
break;
case 52:this.$ = [$$[$0]];
break;
case 53:$$[$0-1].push($$[$0]);
break;
}
},
table: [{3:1,4:2,5:[2,38],6:3,12:[2,38],13:[2,38],16:[2,38],24:[2,38],26:[2,38],31:[2,38],32:[2,38],34:[2,38]},{1:[3]},{5:[1,4]},{5:[2,2],7:5,8:6,9:7,10:8,11:9,12:[1,10],13:[1,11],14:16,16:[1,20],19:14,22:15,24:[1,18],26:[1,19],28:[2,2],29:[2,2],31:[1,12],32:[1,13],34:[1,17]},{1:[2,1]},{5:[2,39],12:[2,39],13:[2,39],16:[2,39],24:[2,39],26:[2,39],28:[2,39],29:[2,39],31:[2,39],32:[2,39],34:[2,39]},{5:[2,3],12:[2,3],13:[2,3],16:[2,3],24:[2,3],26:[2,3],28:[2,3],29:[2,3],31:[2,3],32:[2,3],34:[2,3]},{5:[2,4],12:[2,4],13:[2,4],16:[2,4],24:[2,4],26:[2,4],28:[2,4],29:[2,4],31:[2,4],32:[2,4],34:[2,4]},{5:[2,5],12:[2,5],13:[2,5],16:[2,5],24:[2,5],26:[2,5],28:[2,5],29:[2,5],31:[2,5],32:[2,5],34:[2,5]},{5:[2,6],12:[2,6],13:[2,6],16:[2,6],24:[2,6],26:[2,6],28:[2,6],29:[2,6],31:[2,6],32:[2,6],34:[2,6]},{5:[2,7],12:[2,7],13:[2,7],16:[2,7],24:[2,7],26:[2,7],28:[2,7],29:[2,7],31:[2,7],32:[2,7],34:[2,7]},{5:[2,8],12:[2,8],13:[2,8],16:[2,8],24:[2,8],26:[2,8],28:[2,8],29:[2,8],31:[2,8],32:[2,8],34:[2,8]},{17:21,30:22,41:23,50:[1,26],52:[1,25],53:24},{17:27,30:22,41:23,50:[1,26],52:[1,25],53:24},{4:28,6:3,12:[2,38],13:[2,38],16:[2,38],24:[2,38],26:[2,38],28:[2,38],29:[2,38],31:[2,38],32:[2,38],34:[2,38]},{4:29,6:3,12:[2,38],13:[2,38],16:[2,38],24:[2,38],26:[2,38],28:[2,38],29:[2,38],31:[2,38],32:[2,38],34:[2,38]},{12:[1,30]},{30:32,35:31,42:[1,33],43:[1,34],50:[1,26],53:24},{17:35,30:22,41:23,50:[1,26],52:[1,25],53:24},{17:36,30:22,41:23,50:[1,26],52:[1,25],53:24},{17:37,30:22,41:23,50:[1,26],52:[1,25],53:24},{25:[1,38]},{18:[2,48],25:[2,48],33:[2,48],39:39,42:[2,48],43:[2,48],44:[2,48],45:[2,48],46:[2,48],50:[2,48],52:[2,48]},{18:[2,22],25:[2,22],33:[2,22],46:[2,22]},{18:[2,35],25:[2,35],33:[2,35],42:[2,35],43:[2,35],44:[2,35],45:[2,35],46:[2,35],50:[2,35],52:[2,35],54:[1,40]},{30:41,50:[1,26],53:24},{18:[2,37],25:[2,37],33:[2,37],42:[2,37],43:[2,37],44:[2,37],45:[2,37],46:[2,37],50:[2,37],52:[2,37],54:[2,37]},{33:[1,42]},{20:43,27:44,28:[1,45],29:[2,40]},{23:46,27:47,28:[1,45],29:[2,42]},{15:[1,48]},{25:[2,46],30:51,36:49,38:50,41:55,42:[1,52],43:[1,53],44:[1,54],45:[1,56],47:57,48:58,49:60,50:[1,59],52:[1,25],53:24},{25:[2,31],42:[2,31],43:[2,31],44:[2,31],45:[2,31],50:[2,31],52:[2,31]},{25:[2,32],42:[2,32],43:[2,32],44:[2,32],45:[2,32],50:[2,32],52:[2,32]},{25:[2,33],42:[2,33],43:[2,33],44:[2,33],45:[2,33],50:[2,33],52:[2,33]},{25:[1,61]},{25:[1,62]},{18:[1,63]},{5:[2,17],12:[2,17],13:[2,17],16:[2,17],24:[2,17],26:[2,17],28:[2,17],29:[2,17],31:[2,17],32:[2,17],34:[2,17]},{18:[2,50],25:[2,50],30:51,33:[2,50],36:65,40:64,41:55,42:[1,52],43:[1,53],44:[1,54],45:[1,56],46:[2,50],47:66,48:58,49:60,50:[1,59],52:[1,25],53:24},{50:[1,67]},{18:[2,34],25:[2,34],33:[2,34],42:[2,34],43:[2,34],44:[2,34],45:[2,34],46:[2,34],50:[2,34],52:[2,34]},{5:[2,18],12:[2,18],13:[2,18],16:[2,18],24:[2,18],26:[2,18],28:[2,18],29:[2,18],31:[2,18],32:[2,18],34:[2,18]},{21:68,29:[1,69]},{29:[2,41]},{4:70,6:3,12:[2,38],13:[2,38],16:[2,38],24:[2,38],26:[2,38],29:[2,38],31:[2,38],32:[2,38],34:[2,38]},{21:71,29:[1,69]},{29:[2,43]},{5:[2,9],12:[2,9],13:[2,9],16:[2,9],24:[2,9],26:[2,9],28:[2,9],29:[2,9],31:[2,9],32:[2,9],34:[2,9]},{25:[2,44],37:72,47:73,48:58,49:60,50:[1,74]},{25:[1,75]},{18:[2,23],25:[2,23],33:[2,23],42:[2,23],43:[2,23],44:[2,23],45:[2,23],46:[2,23],50:[2,23],52:[2,23]},{18:[2,24],25:[2,24],33:[2,24],42:[2,24],43:[2,24],44:[2,24],45:[2,24],46:[2,24],50:[2,24],52:[2,24]},{18:[2,25],25:[2,25],33:[2,25],42:[2,25],43:[2,25],44:[2,25],45:[2,25],46:[2,25],50:[2,25],52:[2,25]},{18:[2,26],25:[2,26],33:[2,26],42:[2,26],43:[2,26],44:[2,26],45:[2,26],46:[2,26],50:[2,26],52:[2,26]},{18:[2,27],25:[2,27],33:[2,27],42:[2,27],43:[2,27],44:[2,27],45:[2,27],46:[2,27],50:[2,27],52:[2,27]},{17:76,30:22,41:23,50:[1,26],52:[1,25],53:24},{25:[2,47]},{18:[2,29],25:[2,29],33:[2,29],46:[2,29],49:77,50:[1,74]},{18:[2,37],25:[2,37],33:[2,37],42:[2,37],43:[2,37],44:[2,37],45:[2,37],46:[2,37],50:[2,37],51:[1,78],52:[2,37],54:[2,37]},{18:[2,52],25:[2,52],33:[2,52],46:[2,52],50:[2,52]},{12:[2,13],13:[2,13],16:[2,13],24:[2,13],26:[2,13],28:[2,13],29:[2,13],31:[2,13],32:[2,13],34:[2,13]},{12:[2,14],13:[2,14],16:[2,14],24:[2,14],26:[2,14],28:[2,14],29:[2,14],31:[2,14],32:[2,14],34:[2,14]},{12:[2,10]},{18:[2,21],25:[2,21],33:[2,21],46:[2,21]},{18:[2,49],25:[2,49],33:[2,49],42:[2,49],43:[2,49],44:[2,49],45:[2,49],46:[2,49],50:[2,49],52:[2,49]},{18:[2,51],25:[2,51],33:[2,51],46:[2,51]},{18:[2,36],25:[2,36],33:[2,36],42:[2,36],43:[2,36],44:[2,36],45:[2,36],46:[2,36],50:[2,36],52:[2,36],54:[2,36]},{5:[2,11],12:[2,11],13:[2,11],16:[2,11],24:[2,11],26:[2,11],28:[2,11],29:[2,11],31:[2,11],32:[2,11],34:[2,11]},{30:79,50:[1,26],53:24},{29:[2,15]},{5:[2,12],12:[2,12],13:[2,12],16:[2,12],24:[2,12],26:[2,12],28:[2,12],29:[2,12],31:[2,12],32:[2,12],34:[2,12]},{25:[1,80]},{25:[2,45]},{51:[1,78]},{5:[2,20],12:[2,20],13:[2,20],16:[2,20],24:[2,20],26:[2,20],28:[2,20],29:[2,20],31:[2,20],32:[2,20],34:[2,20]},{46:[1,81]},{18:[2,53],25:[2,53],33:[2,53],46:[2,53],50:[2,53]},{30:51,36:82,41:55,42:[1,52],43:[1,53],44:[1,54],45:[1,56],50:[1,26],52:[1,25],53:24},{25:[1,83]},{5:[2,19],12:[2,19],13:[2,19],16:[2,19],24:[2,19],26:[2,19],28:[2,19],29:[2,19],31:[2,19],32:[2,19],34:[2,19]},{18:[2,28],25:[2,28],33:[2,28],42:[2,28],43:[2,28],44:[2,28],45:[2,28],46:[2,28],50:[2,28],52:[2,28]},{18:[2,30],25:[2,30],33:[2,30],46:[2,30],50:[2,30]},{5:[2,16],12:[2,16],13:[2,16],16:[2,16],24:[2,16],26:[2,16],28:[2,16],29:[2,16],31:[2,16],32:[2,16],34:[2,16]}],
defaultActions: {4:[2,1],44:[2,41],47:[2,43],57:[2,47],63:[2,10],70:[2,15],73:[2,45]},
parseError: function parseError(str, hash) {
    throw new Error(str);
},
parse: function parse(input) {
    var self = this, stack = [0], vstack = [null], lstack = [], table = this.table, yytext = "", yylineno = 0, yyleng = 0, recovering = 0, TERROR = 2, EOF = 1;
    this.lexer.setInput(input);
    this.lexer.yy = this.yy;
    this.yy.lexer = this.lexer;
    this.yy.parser = this;
    if (typeof this.lexer.yylloc == "undefined")
        this.lexer.yylloc = {};
    var yyloc = this.lexer.yylloc;
    lstack.push(yyloc);
    var ranges = this.lexer.options && this.lexer.options.ranges;
    if (typeof this.yy.parseError === "function")
        this.parseError = this.yy.parseError;
    function popStack(n) {
        stack.length = stack.length - 2 * n;
        vstack.length = vstack.length - n;
        lstack.length = lstack.length - n;
    }
    function lex() {
        var token;
        token = self.lexer.lex() || 1;
        if (typeof token !== "number") {
            token = self.symbols_[token] || token;
        }
        return token;
    }
    var symbol, preErrorSymbol, state, action, a, r, yyval = {}, p, len, newState, expected;
    while (true) {
        state = stack[stack.length - 1];
        if (this.defaultActions[state]) {
            action = this.defaultActions[state];
        } else {
            if (symbol === null || typeof symbol == "undefined") {
                symbol = lex();
            }
            action = table[state] && table[state][symbol];
        }
        if (typeof action === "undefined" || !action.length || !action[0]) {
            var errStr = "";
            if (!recovering) {
                expected = [];
                for (p in table[state])
                    if (this.terminals_[p] && p > 2) {
                        expected.push("'" + this.terminals_[p] + "'");
                    }
                if (this.lexer.showPosition) {
                    errStr = "Parse error on line " + (yylineno + 1) + ":\n" + this.lexer.showPosition() + "\nExpecting " + expected.join(", ") + ", got '" + (this.terminals_[symbol] || symbol) + "'";
                } else {
                    errStr = "Parse error on line " + (yylineno + 1) + ": Unexpected " + (symbol == 1?"end of input":"'" + (this.terminals_[symbol] || symbol) + "'");
                }
                this.parseError(errStr, {text: this.lexer.match, token: this.terminals_[symbol] || symbol, line: this.lexer.yylineno, loc: yyloc, expected: expected});
            }
        }
        if (action[0] instanceof Array && action.length > 1) {
            throw new Error("Parse Error: multiple actions possible at state: " + state + ", token: " + symbol);
        }
        switch (action[0]) {
        case 1:
            stack.push(symbol);
            vstack.push(this.lexer.yytext);
            lstack.push(this.lexer.yylloc);
            stack.push(action[1]);
            symbol = null;
            if (!preErrorSymbol) {
                yyleng = this.lexer.yyleng;
                yytext = this.lexer.yytext;
                yylineno = this.lexer.yylineno;
                yyloc = this.lexer.yylloc;
                if (recovering > 0)
                    recovering--;
            } else {
                symbol = preErrorSymbol;
                preErrorSymbol = null;
            }
            break;
        case 2:
            len = this.productions_[action[1]][1];
            yyval.$ = vstack[vstack.length - len];
            yyval._$ = {first_line: lstack[lstack.length - (len || 1)].first_line, last_line: lstack[lstack.length - 1].last_line, first_column: lstack[lstack.length - (len || 1)].first_column, last_column: lstack[lstack.length - 1].last_column};
            if (ranges) {
                yyval._$.range = [lstack[lstack.length - (len || 1)].range[0], lstack[lstack.length - 1].range[1]];
            }
            r = this.performAction.call(yyval, yytext, yyleng, yylineno, this.yy, action[1], vstack, lstack);
            if (typeof r !== "undefined") {
                return r;
            }
            if (len) {
                stack = stack.slice(0, -1 * len * 2);
                vstack = vstack.slice(0, -1 * len);
                lstack = lstack.slice(0, -1 * len);
            }
            stack.push(this.productions_[action[1]][0]);
            vstack.push(yyval.$);
            lstack.push(yyval._$);
            newState = table[stack[stack.length - 2]][stack[stack.length - 1]];
            stack.push(newState);
            break;
        case 3:
            return true;
        }
    }
    return true;
}
};
/* Jison generated lexer */
var lexer = (function(){
var lexer = ({EOF:1,
parseError:function parseError(str, hash) {
        if (this.yy.parser) {
            this.yy.parser.parseError(str, hash);
        } else {
            throw new Error(str);
        }
    },
setInput:function (input) {
        this._input = input;
        this._more = this._less = this.done = false;
        this.yylineno = this.yyleng = 0;
        this.yytext = this.matched = this.match = '';
        this.conditionStack = ['INITIAL'];
        this.yylloc = {first_line:1,first_column:0,last_line:1,last_column:0};
        if (this.options.ranges) this.yylloc.range = [0,0];
        this.offset = 0;
        return this;
    },
input:function () {
        var ch = this._input[0];
        this.yytext += ch;
        this.yyleng++;
        this.offset++;
        this.match += ch;
        this.matched += ch;
        var lines = ch.match(/(?:\r\n?|\n).*/g);
        if (lines) {
            this.yylineno++;
            this.yylloc.last_line++;
        } else {
            this.yylloc.last_column++;
        }
        if (this.options.ranges) this.yylloc.range[1]++;

        this._input = this._input.slice(1);
        return ch;
    },
unput:function (ch) {
        var len = ch.length;
        var lines = ch.split(/(?:\r\n?|\n)/g);

        this._input = ch + this._input;
        this.yytext = this.yytext.substr(0, this.yytext.length-len-1);
        //this.yyleng -= len;
        this.offset -= len;
        var oldLines = this.match.split(/(?:\r\n?|\n)/g);
        this.match = this.match.substr(0, this.match.length-1);
        this.matched = this.matched.substr(0, this.matched.length-1);

        if (lines.length-1) this.yylineno -= lines.length-1;
        var r = this.yylloc.range;

        this.yylloc = {first_line: this.yylloc.first_line,
          last_line: this.yylineno+1,
          first_column: this.yylloc.first_column,
          last_column: lines ?
              (lines.length === oldLines.length ? this.yylloc.first_column : 0) + oldLines[oldLines.length - lines.length].length - lines[0].length:
              this.yylloc.first_column - len
          };

        if (this.options.ranges) {
            this.yylloc.range = [r[0], r[0] + this.yyleng - len];
        }
        return this;
    },
more:function () {
        this._more = true;
        return this;
    },
less:function (n) {
        this.unput(this.match.slice(n));
    },
pastInput:function () {
        var past = this.matched.substr(0, this.matched.length - this.match.length);
        return (past.length > 20 ? '...':'') + past.substr(-20).replace(/\n/g, "");
    },
upcomingInput:function () {
        var next = this.match;
        if (next.length < 20) {
            next += this._input.substr(0, 20-next.length);
        }
        return (next.substr(0,20)+(next.length > 20 ? '...':'')).replace(/\n/g, "");
    },
showPosition:function () {
        var pre = this.pastInput();
        var c = new Array(pre.length + 1).join("-");
        return pre + this.upcomingInput() + "\n" + c+"^";
    },
next:function () {
        if (this.done) {
            return this.EOF;
        }
        if (!this._input) this.done = true;

        var token,
            match,
            tempMatch,
            index,
            col,
            lines;
        if (!this._more) {
            this.yytext = '';
            this.match = '';
        }
        var rules = this._currentRules();
        for (var i=0;i < rules.length; i++) {
            tempMatch = this._input.match(this.rules[rules[i]]);
            if (tempMatch && (!match || tempMatch[0].length > match[0].length)) {
                match = tempMatch;
                index = i;
                if (!this.options.flex) break;
            }
        }
        if (match) {
            lines = match[0].match(/(?:\r\n?|\n).*/g);
            if (lines) this.yylineno += lines.length;
            this.yylloc = {first_line: this.yylloc.last_line,
                           last_line: this.yylineno+1,
                           first_column: this.yylloc.last_column,
                           last_column: lines ? lines[lines.length-1].length-lines[lines.length-1].match(/\r?\n?/)[0].length : this.yylloc.last_column + match[0].length};
            this.yytext += match[0];
            this.match += match[0];
            this.matches = match;
            this.yyleng = this.yytext.length;
            if (this.options.ranges) {
                this.yylloc.range = [this.offset, this.offset += this.yyleng];
            }
            this._more = false;
            this._input = this._input.slice(match[0].length);
            this.matched += match[0];
            token = this.performAction.call(this, this.yy, this, rules[index],this.conditionStack[this.conditionStack.length-1]);
            if (this.done && this._input) this.done = false;
            if (token) return token;
            else return;
        }
        if (this._input === "") {
            return this.EOF;
        } else {
            return this.parseError('Lexical error on line '+(this.yylineno+1)+'. Unrecognized text.\n'+this.showPosition(),
                    {text: "", token: null, line: this.yylineno});
        }
    },
lex:function lex() {
        var r = this.next();
        if (typeof r !== 'undefined') {
            return r;
        } else {
            return this.lex();
        }
    },
begin:function begin(condition) {
        this.conditionStack.push(condition);
    },
popState:function popState() {
        return this.conditionStack.pop();
    },
_currentRules:function _currentRules() {
        return this.conditions[this.conditionStack[this.conditionStack.length-1]].rules;
    },
topState:function () {
        return this.conditionStack[this.conditionStack.length-2];
    },
pushState:function begin(condition) {
        this.begin(condition);
    }});
lexer.options = {};
lexer.performAction = function anonymous(yy,yy_,$avoiding_name_collisions,YY_START) {


function strip(start, end) {
  return yy_.yytext = yy_.yytext.substr(start, yy_.yyleng-end);
}


var YYSTATE=YY_START
switch($avoiding_name_collisions) {
case 0:
                                   if(yy_.yytext.slice(-2) === "\\\\") {
                                     strip(0,1);
                                     this.begin("mu");
                                   } else if(yy_.yytext.slice(-1) === "\\") {
                                     strip(0,1);
                                     this.begin("emu");
                                   } else {
                                     this.begin("mu");
                                   }
                                   if(yy_.yytext) return 12;
                                 
break;
case 1:return 12;
break;
case 2:
                                   this.popState();
                                   return 12;
                                 
break;
case 3:
                                  yy_.yytext = yy_.yytext.substr(5, yy_.yyleng-9);
                                  this.popState();
                                  return 15;
                                 
break;
case 4: return 12; 
break;
case 5:strip(0,4); this.popState(); return 13;
break;
case 6:return 45;
break;
case 7:return 46;
break;
case 8: return 16; 
break;
case 9:
                                  this.popState();
                                  this.begin('raw');
                                  return 18;
                                 
break;
case 10:return 34;
break;
case 11:return 24;
break;
case 12:return 29;
break;
case 13:this.popState(); return 28;
break;
case 14:this.popState(); return 28;
break;
case 15:return 26;
break;
case 16:return 26;
break;
case 17:return 32;
break;
case 18:return 31;
break;
case 19:this.popState(); this.begin('com');
break;
case 20:strip(3,5); this.popState(); return 13;
break;
case 21:return 31;
break;
case 22:return 51;
break;
case 23:return 50;
break;
case 24:return 50;
break;
case 25:return 54;
break;
case 26:// ignore whitespace
break;
case 27:this.popState(); return 33;
break;
case 28:this.popState(); return 25;
break;
case 29:yy_.yytext = strip(1,2).replace(/\\"/g,'"'); return 42;
break;
case 30:yy_.yytext = strip(1,2).replace(/\\'/g,"'"); return 42;
break;
case 31:return 52;
break;
case 32:return 44;
break;
case 33:return 44;
break;
case 34:return 43;
break;
case 35:return 50;
break;
case 36:yy_.yytext = strip(1,2); return 50;
break;
case 37:return 'INVALID';
break;
case 38:return 5;
break;
}
};
lexer.rules = [/^(?:[^\x00]*?(?=(\{\{)))/,/^(?:[^\x00]+)/,/^(?:[^\x00]{2,}?(?=(\{\{|\\\{\{|\\\\\{\{|$)))/,/^(?:\{\{\{\{\/[^\s!"#%-,\.\/;->@\[-\^`\{-~]+(?=[=}\s\/.])\}\}\}\})/,/^(?:[^\x00]*?(?=(\{\{\{\{\/)))/,/^(?:[\s\S]*?--\}\})/,/^(?:\()/,/^(?:\))/,/^(?:\{\{\{\{)/,/^(?:\}\}\}\})/,/^(?:\{\{(~)?>)/,/^(?:\{\{(~)?#)/,/^(?:\{\{(~)?\/)/,/^(?:\{\{(~)?\^\s*(~)?\}\})/,/^(?:\{\{(~)?\s*else\s*(~)?\}\})/,/^(?:\{\{(~)?\^)/,/^(?:\{\{(~)?\s*else\b)/,/^(?:\{\{(~)?\{)/,/^(?:\{\{(~)?&)/,/^(?:\{\{!--)/,/^(?:\{\{![\s\S]*?\}\})/,/^(?:\{\{(~)?)/,/^(?:=)/,/^(?:\.\.)/,/^(?:\.(?=([=~}\s\/.)])))/,/^(?:[\/.])/,/^(?:\s+)/,/^(?:\}(~)?\}\})/,/^(?:(~)?\}\})/,/^(?:"(\\["]|[^"])*")/,/^(?:'(\\[']|[^'])*')/,/^(?:@)/,/^(?:true(?=([~}\s)])))/,/^(?:false(?=([~}\s)])))/,/^(?:-?[0-9]+(?:\.[0-9]+)?(?=([~}\s)])))/,/^(?:([^\s!"#%-,\.\/;->@\[-\^`\{-~]+(?=([=~}\s\/.)]))))/,/^(?:\[[^\]]*\])/,/^(?:.)/,/^(?:$)/];
lexer.conditions = {"mu":{"rules":[6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,21,22,23,24,25,26,27,28,29,30,31,32,33,34,35,36,37,38],"inclusive":false},"emu":{"rules":[2],"inclusive":false},"com":{"rules":[5],"inclusive":false},"raw":{"rules":[3,4],"inclusive":false},"INITIAL":{"rules":[0,1,38],"inclusive":true}};
return lexer;})()
parser.lexer = lexer;
function Parser () { this.yy = {}; }Parser.prototype = parser;parser.Parser = Parser;
return new Parser;
})();exports["default"] = handlebars;
/* jshint ignore:end */
},{}],"/home/vagrant/openfec-web-app/node_modules/handlebars/dist/cjs/handlebars/compiler/printer.js":[function(require,module,exports){
"use strict";
var Visitor = require("./visitor")["default"];

function print(ast) {
  return new PrintVisitor().accept(ast);
}

exports.print = print;function PrintVisitor() {
  this.padding = 0;
}

exports.PrintVisitor = PrintVisitor;PrintVisitor.prototype = new Visitor();

PrintVisitor.prototype.pad = function(string) {
  var out = "";

  for(var i=0,l=this.padding; i<l; i++) {
    out = out + "  ";
  }

  out = out + string + "\n";
  return out;
};

PrintVisitor.prototype.program = function(program) {
  var out = "",
      statements = program.statements,
      i, l;

  for(i=0, l=statements.length; i<l; i++) {
    out = out + this.accept(statements[i]);
  }

  this.padding--;

  return out;
};

PrintVisitor.prototype.block = function(block) {
  var out = "";

  out = out + this.pad("BLOCK:");
  this.padding++;
  out = out + this.accept(block.mustache);
  if (block.program) {
    out = out + this.pad("PROGRAM:");
    this.padding++;
    out = out + this.accept(block.program);
    this.padding--;
  }
  if (block.inverse) {
    if (block.program) { this.padding++; }
    out = out + this.pad("{{^}}");
    this.padding++;
    out = out + this.accept(block.inverse);
    this.padding--;
    if (block.program) { this.padding--; }
  }
  this.padding--;

  return out;
};

PrintVisitor.prototype.sexpr = function(sexpr) {
  var params = sexpr.params, paramStrings = [], hash;

  for(var i=0, l=params.length; i<l; i++) {
    paramStrings.push(this.accept(params[i]));
  }

  params = "[" + paramStrings.join(", ") + "]";

  hash = sexpr.hash ? " " + this.accept(sexpr.hash) : "";

  return this.accept(sexpr.id) + " " + params + hash;
};

PrintVisitor.prototype.mustache = function(mustache) {
  return this.pad("{{ " + this.accept(mustache.sexpr) + " }}");
};

PrintVisitor.prototype.partial = function(partial) {
  var content = this.accept(partial.partialName);
  if(partial.context) {
    content += " " + this.accept(partial.context);
  }
  if (partial.hash) {
    content += " " + this.accept(partial.hash);
  }
  return this.pad("{{> " + content + " }}");
};

PrintVisitor.prototype.hash = function(hash) {
  var pairs = hash.pairs;
  var joinedPairs = [], left, right;

  for(var i=0, l=pairs.length; i<l; i++) {
    left = pairs[i][0];
    right = this.accept(pairs[i][1]);
    joinedPairs.push( left + "=" + right );
  }

  return "HASH{" + joinedPairs.join(", ") + "}";
};

PrintVisitor.prototype.STRING = function(string) {
  return '"' + string.string + '"';
};

PrintVisitor.prototype.NUMBER = function(number) {
  return "NUMBER{" + number.number + "}";
};

PrintVisitor.prototype.BOOLEAN = function(bool) {
  return "BOOLEAN{" + bool.bool + "}";
};

PrintVisitor.prototype.ID = function(id) {
  var path = id.parts.join("/");
  if(id.parts.length > 1) {
    return "PATH:" + path;
  } else {
    return "ID:" + path;
  }
};

PrintVisitor.prototype.PARTIAL_NAME = function(partialName) {
    return "PARTIAL:" + partialName.name;
};

PrintVisitor.prototype.DATA = function(data) {
  return "@" + this.accept(data.id);
};

PrintVisitor.prototype.content = function(content) {
  return this.pad("CONTENT[ '" + content.string + "' ]");
};

PrintVisitor.prototype.comment = function(comment) {
  return this.pad("{{! '" + comment.comment + "' }}");
};
},{"./visitor":"/home/vagrant/openfec-web-app/node_modules/handlebars/dist/cjs/handlebars/compiler/visitor.js"}],"/home/vagrant/openfec-web-app/node_modules/handlebars/dist/cjs/handlebars/compiler/visitor.js":[function(require,module,exports){
"use strict";
function Visitor() {}

Visitor.prototype = {
  constructor: Visitor,

  accept: function(object) {
    return this[object.type](object);
  }
};

exports["default"] = Visitor;
},{}],"/home/vagrant/openfec-web-app/node_modules/handlebars/dist/cjs/handlebars/exception.js":[function(require,module,exports){
"use strict";

var errorProps = ['description', 'fileName', 'lineNumber', 'message', 'name', 'number', 'stack'];

function Exception(message, node) {
  var line;
  if (node && node.firstLine) {
    line = node.firstLine;

    message += ' - ' + line + ':' + node.firstColumn;
  }

  var tmp = Error.prototype.constructor.call(this, message);

  // Unfortunately errors are not enumerable in Chrome (at least), so `for prop in tmp` doesn't work.
  for (var idx = 0; idx < errorProps.length; idx++) {
    this[errorProps[idx]] = tmp[errorProps[idx]];
  }

  if (line) {
    this.lineNumber = line;
    this.column = node.firstColumn;
  }
}

Exception.prototype = new Error();

exports["default"] = Exception;
},{}],"/home/vagrant/openfec-web-app/node_modules/handlebars/dist/cjs/handlebars/runtime.js":[function(require,module,exports){
"use strict";
var Utils = require("./utils");
var Exception = require("./exception")["default"];
var COMPILER_REVISION = require("./base").COMPILER_REVISION;
var REVISION_CHANGES = require("./base").REVISION_CHANGES;
var createFrame = require("./base").createFrame;

function checkRevision(compilerInfo) {
  var compilerRevision = compilerInfo && compilerInfo[0] || 1,
      currentRevision = COMPILER_REVISION;

  if (compilerRevision !== currentRevision) {
    if (compilerRevision < currentRevision) {
      var runtimeVersions = REVISION_CHANGES[currentRevision],
          compilerVersions = REVISION_CHANGES[compilerRevision];
      throw new Exception("Template was precompiled with an older version of Handlebars than the current runtime. "+
            "Please update your precompiler to a newer version ("+runtimeVersions+") or downgrade your runtime to an older version ("+compilerVersions+").");
    } else {
      // Use the embedded version info since the runtime doesn't know about this revision yet
      throw new Exception("Template was precompiled with a newer version of Handlebars than the current runtime. "+
            "Please update your runtime to a newer version ("+compilerInfo[1]+").");
    }
  }
}

exports.checkRevision = checkRevision;// TODO: Remove this line and break up compilePartial

function template(templateSpec, env) {
  /* istanbul ignore next */
  if (!env) {
    throw new Exception("No environment passed to template");
  }
  if (!templateSpec || !templateSpec.main) {
    throw new Exception('Unknown template object: ' + typeof templateSpec);
  }

  // Note: Using env.VM references rather than local var references throughout this section to allow
  // for external users to override these as psuedo-supported APIs.
  env.VM.checkRevision(templateSpec.compiler);

  var invokePartialWrapper = function(partial, indent, name, context, hash, helpers, partials, data, depths) {
    if (hash) {
      context = Utils.extend({}, context, hash);
    }

    var result = env.VM.invokePartial.call(this, partial, name, context, helpers, partials, data, depths);

    if (result == null && env.compile) {
      var options = { helpers: helpers, partials: partials, data: data, depths: depths };
      partials[name] = env.compile(partial, { data: data !== undefined, compat: templateSpec.compat }, env);
      result = partials[name](context, options);
    }
    if (result != null) {
      if (indent) {
        var lines = result.split('\n');
        for (var i = 0, l = lines.length; i < l; i++) {
          if (!lines[i] && i + 1 === l) {
            break;
          }

          lines[i] = indent + lines[i];
        }
        result = lines.join('\n');
      }
      return result;
    } else {
      throw new Exception("The partial " + name + " could not be compiled when running in runtime-only mode");
    }
  };

  // Just add water
  var container = {
    lookup: function(depths, name) {
      var len = depths.length;
      for (var i = 0; i < len; i++) {
        if (depths[i] && depths[i][name] != null) {
          return depths[i][name];
        }
      }
    },
    lambda: function(current, context) {
      return typeof current === 'function' ? current.call(context) : current;
    },

    escapeExpression: Utils.escapeExpression,
    invokePartial: invokePartialWrapper,

    fn: function(i) {
      return templateSpec[i];
    },

    programs: [],
    program: function(i, data, depths) {
      var programWrapper = this.programs[i],
          fn = this.fn(i);
      if (data || depths) {
        programWrapper = program(this, i, fn, data, depths);
      } else if (!programWrapper) {
        programWrapper = this.programs[i] = program(this, i, fn);
      }
      return programWrapper;
    },

    data: function(data, depth) {
      while (data && depth--) {
        data = data._parent;
      }
      return data;
    },
    merge: function(param, common) {
      var ret = param || common;

      if (param && common && (param !== common)) {
        ret = Utils.extend({}, common, param);
      }

      return ret;
    },

    noop: env.VM.noop,
    compilerInfo: templateSpec.compiler
  };

  var ret = function(context, options) {
    options = options || {};
    var data = options.data;

    ret._setup(options);
    if (!options.partial && templateSpec.useData) {
      data = initData(context, data);
    }
    var depths;
    if (templateSpec.useDepths) {
      depths = options.depths ? [context].concat(options.depths) : [context];
    }

    return templateSpec.main.call(container, context, container.helpers, container.partials, data, depths);
  };
  ret.isTop = true;

  ret._setup = function(options) {
    if (!options.partial) {
      container.helpers = container.merge(options.helpers, env.helpers);

      if (templateSpec.usePartial) {
        container.partials = container.merge(options.partials, env.partials);
      }
    } else {
      container.helpers = options.helpers;
      container.partials = options.partials;
    }
  };

  ret._child = function(i, data, depths) {
    if (templateSpec.useDepths && !depths) {
      throw new Exception('must pass parent depths');
    }

    return program(container, i, templateSpec[i], data, depths);
  };
  return ret;
}

exports.template = template;function program(container, i, fn, data, depths) {
  var prog = function(context, options) {
    options = options || {};

    return fn.call(container, context, container.helpers, container.partials, options.data || data, depths && [context].concat(depths));
  };
  prog.program = i;
  prog.depth = depths ? depths.length : 0;
  return prog;
}

exports.program = program;function invokePartial(partial, name, context, helpers, partials, data, depths) {
  var options = { partial: true, helpers: helpers, partials: partials, data: data, depths: depths };

  if(partial === undefined) {
    throw new Exception("The partial " + name + " could not be found");
  } else if(partial instanceof Function) {
    return partial(context, options);
  }
}

exports.invokePartial = invokePartial;function noop() { return ""; }

exports.noop = noop;function initData(context, data) {
  if (!data || !('root' in data)) {
    data = data ? createFrame(data) : {};
    data.root = context;
  }
  return data;
}
},{"./base":"/home/vagrant/openfec-web-app/node_modules/handlebars/dist/cjs/handlebars/base.js","./exception":"/home/vagrant/openfec-web-app/node_modules/handlebars/dist/cjs/handlebars/exception.js","./utils":"/home/vagrant/openfec-web-app/node_modules/handlebars/dist/cjs/handlebars/utils.js"}],"/home/vagrant/openfec-web-app/node_modules/handlebars/dist/cjs/handlebars/safe-string.js":[function(require,module,exports){
"use strict";
// Build out our basic SafeString type
function SafeString(string) {
  this.string = string;
}

SafeString.prototype.toString = function() {
  return "" + this.string;
};

exports["default"] = SafeString;
},{}],"/home/vagrant/openfec-web-app/node_modules/handlebars/dist/cjs/handlebars/utils.js":[function(require,module,exports){
"use strict";
/*jshint -W004 */
var SafeString = require("./safe-string")["default"];

var escape = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#x27;",
  "`": "&#x60;"
};

var badChars = /[&<>"'`]/g;
var possible = /[&<>"'`]/;

function escapeChar(chr) {
  return escape[chr];
}

function extend(obj /* , ...source */) {
  for (var i = 1; i < arguments.length; i++) {
    for (var key in arguments[i]) {
      if (Object.prototype.hasOwnProperty.call(arguments[i], key)) {
        obj[key] = arguments[i][key];
      }
    }
  }

  return obj;
}

exports.extend = extend;var toString = Object.prototype.toString;
exports.toString = toString;
// Sourced from lodash
// https://github.com/bestiejs/lodash/blob/master/LICENSE.txt
var isFunction = function(value) {
  return typeof value === 'function';
};
// fallback for older versions of Chrome and Safari
/* istanbul ignore next */
if (isFunction(/x/)) {
  isFunction = function(value) {
    return typeof value === 'function' && toString.call(value) === '[object Function]';
  };
}
var isFunction;
exports.isFunction = isFunction;
/* istanbul ignore next */
var isArray = Array.isArray || function(value) {
  return (value && typeof value === 'object') ? toString.call(value) === '[object Array]' : false;
};
exports.isArray = isArray;

function escapeExpression(string) {
  // don't escape SafeStrings, since they're already safe
  if (string instanceof SafeString) {
    return string.toString();
  } else if (string == null) {
    return "";
  } else if (!string) {
    return string + '';
  }

  // Force a string conversion as this will be done by the append regardless and
  // the regex test will do this transparently behind the scenes, causing issues if
  // an object's to string has escaped characters in it.
  string = "" + string;

  if(!possible.test(string)) { return string; }
  return string.replace(badChars, escapeChar);
}

exports.escapeExpression = escapeExpression;function isEmpty(value) {
  if (!value && value !== 0) {
    return true;
  } else if (isArray(value) && value.length === 0) {
    return true;
  } else {
    return false;
  }
}

exports.isEmpty = isEmpty;function appendContextPath(contextPath, id) {
  return (contextPath ? contextPath + '.' : '') + id;
}

exports.appendContextPath = appendContextPath;
},{"./safe-string":"/home/vagrant/openfec-web-app/node_modules/handlebars/dist/cjs/handlebars/safe-string.js"}],"/home/vagrant/openfec-web-app/node_modules/handlebars/lib/index.js":[function(require,module,exports){
// USAGE:
// var handlebars = require('handlebars');

// var local = handlebars.create();

var handlebars = require('../dist/cjs/handlebars')["default"];

handlebars.Visitor = require('../dist/cjs/handlebars/compiler/visitor')["default"];

var printer = require('../dist/cjs/handlebars/compiler/printer');
handlebars.PrintVisitor = printer.PrintVisitor;
handlebars.print = printer.print;

module.exports = handlebars;

// Publish a Node.js require() handler for .handlebars and .hbs files
/* istanbul ignore else */
if (typeof require !== 'undefined' && require.extensions) {
  var extension = function(module, filename) {
    var fs = require("fs");
    var templateString = fs.readFileSync(filename, "utf8");
    module.exports = handlebars.compile(templateString);
  };
  require.extensions[".handlebars"] = extension;
  require.extensions[".hbs"] = extension;
}

},{"../dist/cjs/handlebars":"/home/vagrant/openfec-web-app/node_modules/handlebars/dist/cjs/handlebars.js","../dist/cjs/handlebars/compiler/printer":"/home/vagrant/openfec-web-app/node_modules/handlebars/dist/cjs/handlebars/compiler/printer.js","../dist/cjs/handlebars/compiler/visitor":"/home/vagrant/openfec-web-app/node_modules/handlebars/dist/cjs/handlebars/compiler/visitor.js","fs":"/home/vagrant/openfec-web-app/node_modules/watchify/node_modules/browserify/lib/_empty.js"}],"/home/vagrant/openfec-web-app/node_modules/watchify/node_modules/browserify/lib/_empty.js":[function(require,module,exports){

},{}],"/home/vagrant/openfec-web-app/static/js/init.js":[function(require,module,exports){
var search = require('./modules/search.js');
var api = require('./modules/api.js');
var navs = require('./modules/navs.js');
var tables = require('./modules/tables.js');
var tmpls = require('./modules/tmpls.js');
var filters = require('./modules/filters.js');
var urls = require('./modules/urls.js');

api.init();
search.init();
navs.init();
tables.init();
tmpls.init();
filters.init();
urls.init();

},{"./modules/api.js":"/home/vagrant/openfec-web-app/static/js/modules/api.js","./modules/filters.js":"/home/vagrant/openfec-web-app/static/js/modules/filters.js","./modules/navs.js":"/home/vagrant/openfec-web-app/static/js/modules/navs.js","./modules/search.js":"/home/vagrant/openfec-web-app/static/js/modules/search.js","./modules/tables.js":"/home/vagrant/openfec-web-app/static/js/modules/tables.js","./modules/tmpls.js":"/home/vagrant/openfec-web-app/static/js/modules/tmpls.js","./modules/urls.js":"/home/vagrant/openfec-web-app/static/js/modules/urls.js"}],"/home/vagrant/openfec-web-app/static/js/modules/api.js":[function(require,module,exports){
var singularize = function(category) {
    return category.split('').slice(0, -1).join('');
};

var callAPI = function(url) {
    return $.ajax({
        url: url,
        success: function(data) {
            console.log(data);
        }
    });
};

module.exports = {
    init: function() {
        var events = require('./events.js');

        events.on('search:submitted', function(e) {
            console.log(e.query);
        });

        events.on('load:browse', function(e) {
            var promise = callAPI('rest/' + singularize(e.category));

            promise.done(function(data) {
                e.data = data;
                events.emit('render:browse', e);
            });
        });
    }
};

},{"./events.js":"/home/vagrant/openfec-web-app/static/js/modules/events.js"}],"/home/vagrant/openfec-web-app/static/js/modules/events.js":[function(require,module,exports){
var EventEmitter2 = require('eventemitter2').EventEmitter2;
this.cache = this.cache || new EventEmitter2();

module.exports = this.cache;

},{"eventemitter2":"/home/vagrant/openfec-web-app/node_modules/eventemitter2/lib/eventemitter2.js"}],"/home/vagrant/openfec-web-app/static/js/modules/filters.js":[function(require,module,exports){
var events = require('./events.js');

var renderFilters = function(e) {
    $('#candidate-filters select').chosen({width: "100%"});
};

module.exports = {
    init: function() {
        events.on('bind:browse', renderFilters);
        $('.filter-header-bar').on('click', function() {
            $('.filter-field-container').slideToggle();
        });

        // if loaded on a page with filters, init chosen
        $('#candidate-filters select').chosen({width: "100%"});
    }
};

},{"./events.js":"/home/vagrant/openfec-web-app/static/js/modules/events.js"}],"/home/vagrant/openfec-web-app/static/js/modules/navs.js":[function(require,module,exports){
var events = require('./events.js');

var navClickHandler = function(e) {
    e.preventDefault();

    events.emit('load:browse', {
        'category': e.target.name
    });

    changeActiveNavLink(e.target.name);
};

var changeActiveNavLink = function(category) {
    $('.header-nav-bar a').removeClass('active');
    $('.header-nav-bar a[name=' + category + ']').addClass('active');
};

module.exports = {
    init: function() {
        var section = $('#main').data('section');
        $('.header-nav-bar a').on('click', navClickHandler);
        $('.browse-links a').on('click', navClickHandler);

        if (typeof section !== 'undefined') {
            changeActiveNavLink(section);
        }
    }
};


},{"./events.js":"/home/vagrant/openfec-web-app/static/js/modules/events.js"}],"/home/vagrant/openfec-web-app/static/js/modules/search.js":[function(require,module,exports){
module.exports = {
    init: function() {
        $('#search').on('submit', function(e) {
            e.preventDefault();
            var events = require('./events.js');
            var searchQuery = $(e.target).find('input[name=search]').val();

            events.emit('search:submitted', {'query': searchQuery});
        });
    }
};

},{"./events.js":"/home/vagrant/openfec-web-app/static/js/modules/events.js"}],"/home/vagrant/openfec-web-app/static/js/modules/tables.js":[function(require,module,exports){
var events = require('./events.js');

var renderTable = function(e) {
    console.log(e.category);
};

module.exports = {
    init: function() {
        events.on('render:browse', renderTable);
    }
};

},{"./events.js":"/home/vagrant/openfec-web-app/static/js/modules/events.js"}],"/home/vagrant/openfec-web-app/static/js/modules/tmpls.js":[function(require,module,exports){
var events = require('./events.js');
var Handlebars = require('handlebars');
var templates = {};

var renderBrowse = function(e) {
    var tmplName = e.category,
        promise = loadTemplate('views/' + tmplName + '.handlebars');

        promise.done(function(data) {
            var context = {};
            context.candidates = buildCandidateContext(e.data[2].results);
            templates[tmplName] = Handlebars.compile(data);
            $('#main').html(templates[tmplName](context));
            events.emit('bind:browse');
        }.bind(e));
};

var loadTemplate = function(url) {
    return $.ajax({
        url: url,
        dataType: 'text'
    });
};

var buildCandidateContext = function(results) {
    var candidates = [],
        i = 0,
        len = results.length,
        elections,
        election,
        year;

    for (i; i < len; i++) {
        elections = results[i].elections;
        year = Object.keys(elections)[0];
        election = elections[year];

        candidates[i] = {
            'name': results[i].name.full_name,
            'office': election.office_sought,
            'election': year,
            'party': election.party_affiliation,
            'state': election.state,
            'district': election.district
        }
    }

    return candidates;
};

module.exports = {
    init: function() {
        events.on('render:browse', renderBrowse);
    }
};

},{"./events.js":"/home/vagrant/openfec-web-app/static/js/modules/events.js","handlebars":"/home/vagrant/openfec-web-app/node_modules/handlebars/lib/index.js"}],"/home/vagrant/openfec-web-app/static/js/modules/urls.js":[function(require,module,exports){
var events = require('./events.js');

var changeURL = function(context) {
    window.history.pushState('', '', '/' + context.category);
};

module.exports = {
    init: function() {
        events.on('render:browse', changeURL);
    }
};

},{"./events.js":"/home/vagrant/openfec-web-app/static/js/modules/events.js"}]},{},["/home/vagrant/openfec-web-app/static/js/init.js"])
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy93YXRjaGlmeS9ub2RlX21vZHVsZXMvYnJvd3NlcmlmeS9ub2RlX21vZHVsZXMvYnJvd3Nlci1wYWNrL19wcmVsdWRlLmpzIiwiL2hvbWUvdmFncmFudC9vcGVuZmVjLXdlYi1hcHAvbm9kZV9tb2R1bGVzL2V2ZW50ZW1pdHRlcjIvbGliL2V2ZW50ZW1pdHRlcjIuanMiLCIvaG9tZS92YWdyYW50L29wZW5mZWMtd2ViLWFwcC9ub2RlX21vZHVsZXMvaGFuZGxlYmFycy9kaXN0L2Nqcy9oYW5kbGViYXJzLmpzIiwiL2hvbWUvdmFncmFudC9vcGVuZmVjLXdlYi1hcHAvbm9kZV9tb2R1bGVzL2hhbmRsZWJhcnMvZGlzdC9janMvaGFuZGxlYmFycy5ydW50aW1lLmpzIiwiL2hvbWUvdmFncmFudC9vcGVuZmVjLXdlYi1hcHAvbm9kZV9tb2R1bGVzL2hhbmRsZWJhcnMvZGlzdC9janMvaGFuZGxlYmFycy9iYXNlLmpzIiwiL2hvbWUvdmFncmFudC9vcGVuZmVjLXdlYi1hcHAvbm9kZV9tb2R1bGVzL2hhbmRsZWJhcnMvZGlzdC9janMvaGFuZGxlYmFycy9jb21waWxlci9hc3QuanMiLCIvaG9tZS92YWdyYW50L29wZW5mZWMtd2ViLWFwcC9ub2RlX21vZHVsZXMvaGFuZGxlYmFycy9kaXN0L2Nqcy9oYW5kbGViYXJzL2NvbXBpbGVyL2Jhc2UuanMiLCIvaG9tZS92YWdyYW50L29wZW5mZWMtd2ViLWFwcC9ub2RlX21vZHVsZXMvaGFuZGxlYmFycy9kaXN0L2Nqcy9oYW5kbGViYXJzL2NvbXBpbGVyL2NvbXBpbGVyLmpzIiwiL2hvbWUvdmFncmFudC9vcGVuZmVjLXdlYi1hcHAvbm9kZV9tb2R1bGVzL2hhbmRsZWJhcnMvZGlzdC9janMvaGFuZGxlYmFycy9jb21waWxlci9oZWxwZXJzLmpzIiwiL2hvbWUvdmFncmFudC9vcGVuZmVjLXdlYi1hcHAvbm9kZV9tb2R1bGVzL2hhbmRsZWJhcnMvZGlzdC9janMvaGFuZGxlYmFycy9jb21waWxlci9qYXZhc2NyaXB0LWNvbXBpbGVyLmpzIiwiL2hvbWUvdmFncmFudC9vcGVuZmVjLXdlYi1hcHAvbm9kZV9tb2R1bGVzL2hhbmRsZWJhcnMvZGlzdC9janMvaGFuZGxlYmFycy9jb21waWxlci9wYXJzZXIuanMiLCIvaG9tZS92YWdyYW50L29wZW5mZWMtd2ViLWFwcC9ub2RlX21vZHVsZXMvaGFuZGxlYmFycy9kaXN0L2Nqcy9oYW5kbGViYXJzL2NvbXBpbGVyL3ByaW50ZXIuanMiLCIvaG9tZS92YWdyYW50L29wZW5mZWMtd2ViLWFwcC9ub2RlX21vZHVsZXMvaGFuZGxlYmFycy9kaXN0L2Nqcy9oYW5kbGViYXJzL2NvbXBpbGVyL3Zpc2l0b3IuanMiLCIvaG9tZS92YWdyYW50L29wZW5mZWMtd2ViLWFwcC9ub2RlX21vZHVsZXMvaGFuZGxlYmFycy9kaXN0L2Nqcy9oYW5kbGViYXJzL2V4Y2VwdGlvbi5qcyIsIi9ob21lL3ZhZ3JhbnQvb3BlbmZlYy13ZWItYXBwL25vZGVfbW9kdWxlcy9oYW5kbGViYXJzL2Rpc3QvY2pzL2hhbmRsZWJhcnMvcnVudGltZS5qcyIsIi9ob21lL3ZhZ3JhbnQvb3BlbmZlYy13ZWItYXBwL25vZGVfbW9kdWxlcy9oYW5kbGViYXJzL2Rpc3QvY2pzL2hhbmRsZWJhcnMvc2FmZS1zdHJpbmcuanMiLCIvaG9tZS92YWdyYW50L29wZW5mZWMtd2ViLWFwcC9ub2RlX21vZHVsZXMvaGFuZGxlYmFycy9kaXN0L2Nqcy9oYW5kbGViYXJzL3V0aWxzLmpzIiwiL2hvbWUvdmFncmFudC9vcGVuZmVjLXdlYi1hcHAvbm9kZV9tb2R1bGVzL2hhbmRsZWJhcnMvbGliL2luZGV4LmpzIiwiL2hvbWUvdmFncmFudC9vcGVuZmVjLXdlYi1hcHAvbm9kZV9tb2R1bGVzL3dhdGNoaWZ5L25vZGVfbW9kdWxlcy9icm93c2VyaWZ5L2xpYi9fZW1wdHkuanMiLCIvaG9tZS92YWdyYW50L29wZW5mZWMtd2ViLWFwcC9zdGF0aWMvanMvaW5pdC5qcyIsIi9ob21lL3ZhZ3JhbnQvb3BlbmZlYy13ZWItYXBwL3N0YXRpYy9qcy9tb2R1bGVzL2FwaS5qcyIsIi9ob21lL3ZhZ3JhbnQvb3BlbmZlYy13ZWItYXBwL3N0YXRpYy9qcy9tb2R1bGVzL2V2ZW50cy5qcyIsIi9ob21lL3ZhZ3JhbnQvb3BlbmZlYy13ZWItYXBwL3N0YXRpYy9qcy9tb2R1bGVzL2ZpbHRlcnMuanMiLCIvaG9tZS92YWdyYW50L29wZW5mZWMtd2ViLWFwcC9zdGF0aWMvanMvbW9kdWxlcy9uYXZzLmpzIiwiL2hvbWUvdmFncmFudC9vcGVuZmVjLXdlYi1hcHAvc3RhdGljL2pzL21vZHVsZXMvc2VhcmNoLmpzIiwiL2hvbWUvdmFncmFudC9vcGVuZmVjLXdlYi1hcHAvc3RhdGljL2pzL21vZHVsZXMvdGFibGVzLmpzIiwiL2hvbWUvdmFncmFudC9vcGVuZmVjLXdlYi1hcHAvc3RhdGljL2pzL21vZHVsZXMvdG1wbHMuanMiLCIvaG9tZS92YWdyYW50L29wZW5mZWMtd2ViLWFwcC9zdGF0aWMvanMvbW9kdWxlcy91cmxzLmpzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBO0FDQUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDN2pCQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDdENBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDbENBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUN0T0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDck5BO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNwQkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNuY0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDMUxBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ244QkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNuZkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzVJQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDWEE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDM0JBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ2hNQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ1ZBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3ZGQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDMUJBOztBQ0FBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ2ZBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDL0JBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDSkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ2pCQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDN0JBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNYQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDWEE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUN2REE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBIiwiZmlsZSI6ImdlbmVyYXRlZC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzQ29udGVudCI6WyIoZnVuY3Rpb24gZSh0LG4scil7ZnVuY3Rpb24gcyhvLHUpe2lmKCFuW29dKXtpZighdFtvXSl7dmFyIGE9dHlwZW9mIHJlcXVpcmU9PVwiZnVuY3Rpb25cIiYmcmVxdWlyZTtpZighdSYmYSlyZXR1cm4gYShvLCEwKTtpZihpKXJldHVybiBpKG8sITApO3ZhciBmPW5ldyBFcnJvcihcIkNhbm5vdCBmaW5kIG1vZHVsZSAnXCIrbytcIidcIik7dGhyb3cgZi5jb2RlPVwiTU9EVUxFX05PVF9GT1VORFwiLGZ9dmFyIGw9bltvXT17ZXhwb3J0czp7fX07dFtvXVswXS5jYWxsKGwuZXhwb3J0cyxmdW5jdGlvbihlKXt2YXIgbj10W29dWzFdW2VdO3JldHVybiBzKG4/bjplKX0sbCxsLmV4cG9ydHMsZSx0LG4scil9cmV0dXJuIG5bb10uZXhwb3J0c312YXIgaT10eXBlb2YgcmVxdWlyZT09XCJmdW5jdGlvblwiJiZyZXF1aXJlO2Zvcih2YXIgbz0wO288ci5sZW5ndGg7bysrKXMocltvXSk7cmV0dXJuIHN9KSIsIi8qIVxuICogRXZlbnRFbWl0dGVyMlxuICogaHR0cHM6Ly9naXRodWIuY29tL2hpajFueC9FdmVudEVtaXR0ZXIyXG4gKlxuICogQ29weXJpZ2h0IChjKSAyMDEzIGhpajFueFxuICogTGljZW5zZWQgdW5kZXIgdGhlIE1JVCBsaWNlbnNlLlxuICovXG47IWZ1bmN0aW9uKHVuZGVmaW5lZCkge1xuXG4gIHZhciBpc0FycmF5ID0gQXJyYXkuaXNBcnJheSA/IEFycmF5LmlzQXJyYXkgOiBmdW5jdGlvbiBfaXNBcnJheShvYmopIHtcbiAgICByZXR1cm4gT2JqZWN0LnByb3RvdHlwZS50b1N0cmluZy5jYWxsKG9iaikgPT09IFwiW29iamVjdCBBcnJheV1cIjtcbiAgfTtcbiAgdmFyIGRlZmF1bHRNYXhMaXN0ZW5lcnMgPSAxMDtcblxuICBmdW5jdGlvbiBpbml0KCkge1xuICAgIHRoaXMuX2V2ZW50cyA9IHt9O1xuICAgIGlmICh0aGlzLl9jb25mKSB7XG4gICAgICBjb25maWd1cmUuY2FsbCh0aGlzLCB0aGlzLl9jb25mKTtcbiAgICB9XG4gIH1cblxuICBmdW5jdGlvbiBjb25maWd1cmUoY29uZikge1xuICAgIGlmIChjb25mKSB7XG5cbiAgICAgIHRoaXMuX2NvbmYgPSBjb25mO1xuXG4gICAgICBjb25mLmRlbGltaXRlciAmJiAodGhpcy5kZWxpbWl0ZXIgPSBjb25mLmRlbGltaXRlcik7XG4gICAgICBjb25mLm1heExpc3RlbmVycyAmJiAodGhpcy5fZXZlbnRzLm1heExpc3RlbmVycyA9IGNvbmYubWF4TGlzdGVuZXJzKTtcbiAgICAgIGNvbmYud2lsZGNhcmQgJiYgKHRoaXMud2lsZGNhcmQgPSBjb25mLndpbGRjYXJkKTtcbiAgICAgIGNvbmYubmV3TGlzdGVuZXIgJiYgKHRoaXMubmV3TGlzdGVuZXIgPSBjb25mLm5ld0xpc3RlbmVyKTtcblxuICAgICAgaWYgKHRoaXMud2lsZGNhcmQpIHtcbiAgICAgICAgdGhpcy5saXN0ZW5lclRyZWUgPSB7fTtcbiAgICAgIH1cbiAgICB9XG4gIH1cblxuICBmdW5jdGlvbiBFdmVudEVtaXR0ZXIoY29uZikge1xuICAgIHRoaXMuX2V2ZW50cyA9IHt9O1xuICAgIHRoaXMubmV3TGlzdGVuZXIgPSBmYWxzZTtcbiAgICBjb25maWd1cmUuY2FsbCh0aGlzLCBjb25mKTtcbiAgfVxuXG4gIC8vXG4gIC8vIEF0dGVudGlvbiwgZnVuY3Rpb24gcmV0dXJuIHR5cGUgbm93IGlzIGFycmF5LCBhbHdheXMgIVxuICAvLyBJdCBoYXMgemVybyBlbGVtZW50cyBpZiBubyBhbnkgbWF0Y2hlcyBmb3VuZCBhbmQgb25lIG9yIG1vcmVcbiAgLy8gZWxlbWVudHMgKGxlYWZzKSBpZiB0aGVyZSBhcmUgbWF0Y2hlc1xuICAvL1xuICBmdW5jdGlvbiBzZWFyY2hMaXN0ZW5lclRyZWUoaGFuZGxlcnMsIHR5cGUsIHRyZWUsIGkpIHtcbiAgICBpZiAoIXRyZWUpIHtcbiAgICAgIHJldHVybiBbXTtcbiAgICB9XG4gICAgdmFyIGxpc3RlbmVycz1bXSwgbGVhZiwgbGVuLCBicmFuY2gsIHhUcmVlLCB4eFRyZWUsIGlzb2xhdGVkQnJhbmNoLCBlbmRSZWFjaGVkLFxuICAgICAgICB0eXBlTGVuZ3RoID0gdHlwZS5sZW5ndGgsIGN1cnJlbnRUeXBlID0gdHlwZVtpXSwgbmV4dFR5cGUgPSB0eXBlW2krMV07XG4gICAgaWYgKGkgPT09IHR5cGVMZW5ndGggJiYgdHJlZS5fbGlzdGVuZXJzKSB7XG4gICAgICAvL1xuICAgICAgLy8gSWYgYXQgdGhlIGVuZCBvZiB0aGUgZXZlbnQocykgbGlzdCBhbmQgdGhlIHRyZWUgaGFzIGxpc3RlbmVyc1xuICAgICAgLy8gaW52b2tlIHRob3NlIGxpc3RlbmVycy5cbiAgICAgIC8vXG4gICAgICBpZiAodHlwZW9mIHRyZWUuX2xpc3RlbmVycyA9PT0gJ2Z1bmN0aW9uJykge1xuICAgICAgICBoYW5kbGVycyAmJiBoYW5kbGVycy5wdXNoKHRyZWUuX2xpc3RlbmVycyk7XG4gICAgICAgIHJldHVybiBbdHJlZV07XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBmb3IgKGxlYWYgPSAwLCBsZW4gPSB0cmVlLl9saXN0ZW5lcnMubGVuZ3RoOyBsZWFmIDwgbGVuOyBsZWFmKyspIHtcbiAgICAgICAgICBoYW5kbGVycyAmJiBoYW5kbGVycy5wdXNoKHRyZWUuX2xpc3RlbmVyc1tsZWFmXSk7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIFt0cmVlXTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICBpZiAoKGN1cnJlbnRUeXBlID09PSAnKicgfHwgY3VycmVudFR5cGUgPT09ICcqKicpIHx8IHRyZWVbY3VycmVudFR5cGVdKSB7XG4gICAgICAvL1xuICAgICAgLy8gSWYgdGhlIGV2ZW50IGVtaXR0ZWQgaXMgJyonIGF0IHRoaXMgcGFydFxuICAgICAgLy8gb3IgdGhlcmUgaXMgYSBjb25jcmV0ZSBtYXRjaCBhdCB0aGlzIHBhdGNoXG4gICAgICAvL1xuICAgICAgaWYgKGN1cnJlbnRUeXBlID09PSAnKicpIHtcbiAgICAgICAgZm9yIChicmFuY2ggaW4gdHJlZSkge1xuICAgICAgICAgIGlmIChicmFuY2ggIT09ICdfbGlzdGVuZXJzJyAmJiB0cmVlLmhhc093blByb3BlcnR5KGJyYW5jaCkpIHtcbiAgICAgICAgICAgIGxpc3RlbmVycyA9IGxpc3RlbmVycy5jb25jYXQoc2VhcmNoTGlzdGVuZXJUcmVlKGhhbmRsZXJzLCB0eXBlLCB0cmVlW2JyYW5jaF0sIGkrMSkpO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gbGlzdGVuZXJzO1xuICAgICAgfSBlbHNlIGlmKGN1cnJlbnRUeXBlID09PSAnKionKSB7XG4gICAgICAgIGVuZFJlYWNoZWQgPSAoaSsxID09PSB0eXBlTGVuZ3RoIHx8IChpKzIgPT09IHR5cGVMZW5ndGggJiYgbmV4dFR5cGUgPT09ICcqJykpO1xuICAgICAgICBpZihlbmRSZWFjaGVkICYmIHRyZWUuX2xpc3RlbmVycykge1xuICAgICAgICAgIC8vIFRoZSBuZXh0IGVsZW1lbnQgaGFzIGEgX2xpc3RlbmVycywgYWRkIGl0IHRvIHRoZSBoYW5kbGVycy5cbiAgICAgICAgICBsaXN0ZW5lcnMgPSBsaXN0ZW5lcnMuY29uY2F0KHNlYXJjaExpc3RlbmVyVHJlZShoYW5kbGVycywgdHlwZSwgdHJlZSwgdHlwZUxlbmd0aCkpO1xuICAgICAgICB9XG5cbiAgICAgICAgZm9yIChicmFuY2ggaW4gdHJlZSkge1xuICAgICAgICAgIGlmIChicmFuY2ggIT09ICdfbGlzdGVuZXJzJyAmJiB0cmVlLmhhc093blByb3BlcnR5KGJyYW5jaCkpIHtcbiAgICAgICAgICAgIGlmKGJyYW5jaCA9PT0gJyonIHx8IGJyYW5jaCA9PT0gJyoqJykge1xuICAgICAgICAgICAgICBpZih0cmVlW2JyYW5jaF0uX2xpc3RlbmVycyAmJiAhZW5kUmVhY2hlZCkge1xuICAgICAgICAgICAgICAgIGxpc3RlbmVycyA9IGxpc3RlbmVycy5jb25jYXQoc2VhcmNoTGlzdGVuZXJUcmVlKGhhbmRsZXJzLCB0eXBlLCB0cmVlW2JyYW5jaF0sIHR5cGVMZW5ndGgpKTtcbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICBsaXN0ZW5lcnMgPSBsaXN0ZW5lcnMuY29uY2F0KHNlYXJjaExpc3RlbmVyVHJlZShoYW5kbGVycywgdHlwZSwgdHJlZVticmFuY2hdLCBpKSk7XG4gICAgICAgICAgICB9IGVsc2UgaWYoYnJhbmNoID09PSBuZXh0VHlwZSkge1xuICAgICAgICAgICAgICBsaXN0ZW5lcnMgPSBsaXN0ZW5lcnMuY29uY2F0KHNlYXJjaExpc3RlbmVyVHJlZShoYW5kbGVycywgdHlwZSwgdHJlZVticmFuY2hdLCBpKzIpKTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgIC8vIE5vIG1hdGNoIG9uIHRoaXMgb25lLCBzaGlmdCBpbnRvIHRoZSB0cmVlIGJ1dCBub3QgaW4gdGhlIHR5cGUgYXJyYXkuXG4gICAgICAgICAgICAgIGxpc3RlbmVycyA9IGxpc3RlbmVycy5jb25jYXQoc2VhcmNoTGlzdGVuZXJUcmVlKGhhbmRsZXJzLCB0eXBlLCB0cmVlW2JyYW5jaF0sIGkpKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIGxpc3RlbmVycztcbiAgICAgIH1cblxuICAgICAgbGlzdGVuZXJzID0gbGlzdGVuZXJzLmNvbmNhdChzZWFyY2hMaXN0ZW5lclRyZWUoaGFuZGxlcnMsIHR5cGUsIHRyZWVbY3VycmVudFR5cGVdLCBpKzEpKTtcbiAgICB9XG5cbiAgICB4VHJlZSA9IHRyZWVbJyonXTtcbiAgICBpZiAoeFRyZWUpIHtcbiAgICAgIC8vXG4gICAgICAvLyBJZiB0aGUgbGlzdGVuZXIgdHJlZSB3aWxsIGFsbG93IGFueSBtYXRjaCBmb3IgdGhpcyBwYXJ0LFxuICAgICAgLy8gdGhlbiByZWN1cnNpdmVseSBleHBsb3JlIGFsbCBicmFuY2hlcyBvZiB0aGUgdHJlZVxuICAgICAgLy9cbiAgICAgIHNlYXJjaExpc3RlbmVyVHJlZShoYW5kbGVycywgdHlwZSwgeFRyZWUsIGkrMSk7XG4gICAgfVxuXG4gICAgeHhUcmVlID0gdHJlZVsnKionXTtcbiAgICBpZih4eFRyZWUpIHtcbiAgICAgIGlmKGkgPCB0eXBlTGVuZ3RoKSB7XG4gICAgICAgIGlmKHh4VHJlZS5fbGlzdGVuZXJzKSB7XG4gICAgICAgICAgLy8gSWYgd2UgaGF2ZSBhIGxpc3RlbmVyIG9uIGEgJyoqJywgaXQgd2lsbCBjYXRjaCBhbGwsIHNvIGFkZCBpdHMgaGFuZGxlci5cbiAgICAgICAgICBzZWFyY2hMaXN0ZW5lclRyZWUoaGFuZGxlcnMsIHR5cGUsIHh4VHJlZSwgdHlwZUxlbmd0aCk7XG4gICAgICAgIH1cblxuICAgICAgICAvLyBCdWlsZCBhcnJheXMgb2YgbWF0Y2hpbmcgbmV4dCBicmFuY2hlcyBhbmQgb3RoZXJzLlxuICAgICAgICBmb3IoYnJhbmNoIGluIHh4VHJlZSkge1xuICAgICAgICAgIGlmKGJyYW5jaCAhPT0gJ19saXN0ZW5lcnMnICYmIHh4VHJlZS5oYXNPd25Qcm9wZXJ0eShicmFuY2gpKSB7XG4gICAgICAgICAgICBpZihicmFuY2ggPT09IG5leHRUeXBlKSB7XG4gICAgICAgICAgICAgIC8vIFdlIGtub3cgdGhlIG5leHQgZWxlbWVudCB3aWxsIG1hdGNoLCBzbyBqdW1wIHR3aWNlLlxuICAgICAgICAgICAgICBzZWFyY2hMaXN0ZW5lclRyZWUoaGFuZGxlcnMsIHR5cGUsIHh4VHJlZVticmFuY2hdLCBpKzIpO1xuICAgICAgICAgICAgfSBlbHNlIGlmKGJyYW5jaCA9PT0gY3VycmVudFR5cGUpIHtcbiAgICAgICAgICAgICAgLy8gQ3VycmVudCBub2RlIG1hdGNoZXMsIG1vdmUgaW50byB0aGUgdHJlZS5cbiAgICAgICAgICAgICAgc2VhcmNoTGlzdGVuZXJUcmVlKGhhbmRsZXJzLCB0eXBlLCB4eFRyZWVbYnJhbmNoXSwgaSsxKTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgIGlzb2xhdGVkQnJhbmNoID0ge307XG4gICAgICAgICAgICAgIGlzb2xhdGVkQnJhbmNoW2JyYW5jaF0gPSB4eFRyZWVbYnJhbmNoXTtcbiAgICAgICAgICAgICAgc2VhcmNoTGlzdGVuZXJUcmVlKGhhbmRsZXJzLCB0eXBlLCB7ICcqKic6IGlzb2xhdGVkQnJhbmNoIH0sIGkrMSk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICB9IGVsc2UgaWYoeHhUcmVlLl9saXN0ZW5lcnMpIHtcbiAgICAgICAgLy8gV2UgaGF2ZSByZWFjaGVkIHRoZSBlbmQgYW5kIHN0aWxsIG9uIGEgJyoqJ1xuICAgICAgICBzZWFyY2hMaXN0ZW5lclRyZWUoaGFuZGxlcnMsIHR5cGUsIHh4VHJlZSwgdHlwZUxlbmd0aCk7XG4gICAgICB9IGVsc2UgaWYoeHhUcmVlWycqJ10gJiYgeHhUcmVlWycqJ10uX2xpc3RlbmVycykge1xuICAgICAgICBzZWFyY2hMaXN0ZW5lclRyZWUoaGFuZGxlcnMsIHR5cGUsIHh4VHJlZVsnKiddLCB0eXBlTGVuZ3RoKTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICByZXR1cm4gbGlzdGVuZXJzO1xuICB9XG5cbiAgZnVuY3Rpb24gZ3Jvd0xpc3RlbmVyVHJlZSh0eXBlLCBsaXN0ZW5lcikge1xuXG4gICAgdHlwZSA9IHR5cGVvZiB0eXBlID09PSAnc3RyaW5nJyA/IHR5cGUuc3BsaXQodGhpcy5kZWxpbWl0ZXIpIDogdHlwZS5zbGljZSgpO1xuXG4gICAgLy9cbiAgICAvLyBMb29rcyBmb3IgdHdvIGNvbnNlY3V0aXZlICcqKicsIGlmIHNvLCBkb24ndCBhZGQgdGhlIGV2ZW50IGF0IGFsbC5cbiAgICAvL1xuICAgIGZvcih2YXIgaSA9IDAsIGxlbiA9IHR5cGUubGVuZ3RoOyBpKzEgPCBsZW47IGkrKykge1xuICAgICAgaWYodHlwZVtpXSA9PT0gJyoqJyAmJiB0eXBlW2krMV0gPT09ICcqKicpIHtcbiAgICAgICAgcmV0dXJuO1xuICAgICAgfVxuICAgIH1cblxuICAgIHZhciB0cmVlID0gdGhpcy5saXN0ZW5lclRyZWU7XG4gICAgdmFyIG5hbWUgPSB0eXBlLnNoaWZ0KCk7XG5cbiAgICB3aGlsZSAobmFtZSkge1xuXG4gICAgICBpZiAoIXRyZWVbbmFtZV0pIHtcbiAgICAgICAgdHJlZVtuYW1lXSA9IHt9O1xuICAgICAgfVxuXG4gICAgICB0cmVlID0gdHJlZVtuYW1lXTtcblxuICAgICAgaWYgKHR5cGUubGVuZ3RoID09PSAwKSB7XG5cbiAgICAgICAgaWYgKCF0cmVlLl9saXN0ZW5lcnMpIHtcbiAgICAgICAgICB0cmVlLl9saXN0ZW5lcnMgPSBsaXN0ZW5lcjtcbiAgICAgICAgfVxuICAgICAgICBlbHNlIGlmKHR5cGVvZiB0cmVlLl9saXN0ZW5lcnMgPT09ICdmdW5jdGlvbicpIHtcbiAgICAgICAgICB0cmVlLl9saXN0ZW5lcnMgPSBbdHJlZS5fbGlzdGVuZXJzLCBsaXN0ZW5lcl07XG4gICAgICAgIH1cbiAgICAgICAgZWxzZSBpZiAoaXNBcnJheSh0cmVlLl9saXN0ZW5lcnMpKSB7XG5cbiAgICAgICAgICB0cmVlLl9saXN0ZW5lcnMucHVzaChsaXN0ZW5lcik7XG5cbiAgICAgICAgICBpZiAoIXRyZWUuX2xpc3RlbmVycy53YXJuZWQpIHtcblxuICAgICAgICAgICAgdmFyIG0gPSBkZWZhdWx0TWF4TGlzdGVuZXJzO1xuXG4gICAgICAgICAgICBpZiAodHlwZW9mIHRoaXMuX2V2ZW50cy5tYXhMaXN0ZW5lcnMgIT09ICd1bmRlZmluZWQnKSB7XG4gICAgICAgICAgICAgIG0gPSB0aGlzLl9ldmVudHMubWF4TGlzdGVuZXJzO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBpZiAobSA+IDAgJiYgdHJlZS5fbGlzdGVuZXJzLmxlbmd0aCA+IG0pIHtcblxuICAgICAgICAgICAgICB0cmVlLl9saXN0ZW5lcnMud2FybmVkID0gdHJ1ZTtcbiAgICAgICAgICAgICAgY29uc29sZS5lcnJvcignKG5vZGUpIHdhcm5pbmc6IHBvc3NpYmxlIEV2ZW50RW1pdHRlciBtZW1vcnkgJyArXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgJ2xlYWsgZGV0ZWN0ZWQuICVkIGxpc3RlbmVycyBhZGRlZC4gJyArXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgJ1VzZSBlbWl0dGVyLnNldE1heExpc3RlbmVycygpIHRvIGluY3JlYXNlIGxpbWl0LicsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgdHJlZS5fbGlzdGVuZXJzLmxlbmd0aCk7XG4gICAgICAgICAgICAgIGNvbnNvbGUudHJhY2UoKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgICB9XG4gICAgICBuYW1lID0gdHlwZS5zaGlmdCgpO1xuICAgIH1cbiAgICByZXR1cm4gdHJ1ZTtcbiAgfVxuXG4gIC8vIEJ5IGRlZmF1bHQgRXZlbnRFbWl0dGVycyB3aWxsIHByaW50IGEgd2FybmluZyBpZiBtb3JlIHRoYW5cbiAgLy8gMTAgbGlzdGVuZXJzIGFyZSBhZGRlZCB0byBpdC4gVGhpcyBpcyBhIHVzZWZ1bCBkZWZhdWx0IHdoaWNoXG4gIC8vIGhlbHBzIGZpbmRpbmcgbWVtb3J5IGxlYWtzLlxuICAvL1xuICAvLyBPYnZpb3VzbHkgbm90IGFsbCBFbWl0dGVycyBzaG91bGQgYmUgbGltaXRlZCB0byAxMC4gVGhpcyBmdW5jdGlvbiBhbGxvd3NcbiAgLy8gdGhhdCB0byBiZSBpbmNyZWFzZWQuIFNldCB0byB6ZXJvIGZvciB1bmxpbWl0ZWQuXG5cbiAgRXZlbnRFbWl0dGVyLnByb3RvdHlwZS5kZWxpbWl0ZXIgPSAnLic7XG5cbiAgRXZlbnRFbWl0dGVyLnByb3RvdHlwZS5zZXRNYXhMaXN0ZW5lcnMgPSBmdW5jdGlvbihuKSB7XG4gICAgdGhpcy5fZXZlbnRzIHx8IGluaXQuY2FsbCh0aGlzKTtcbiAgICB0aGlzLl9ldmVudHMubWF4TGlzdGVuZXJzID0gbjtcbiAgICBpZiAoIXRoaXMuX2NvbmYpIHRoaXMuX2NvbmYgPSB7fTtcbiAgICB0aGlzLl9jb25mLm1heExpc3RlbmVycyA9IG47XG4gIH07XG5cbiAgRXZlbnRFbWl0dGVyLnByb3RvdHlwZS5ldmVudCA9ICcnO1xuXG4gIEV2ZW50RW1pdHRlci5wcm90b3R5cGUub25jZSA9IGZ1bmN0aW9uKGV2ZW50LCBmbikge1xuICAgIHRoaXMubWFueShldmVudCwgMSwgZm4pO1xuICAgIHJldHVybiB0aGlzO1xuICB9O1xuXG4gIEV2ZW50RW1pdHRlci5wcm90b3R5cGUubWFueSA9IGZ1bmN0aW9uKGV2ZW50LCB0dGwsIGZuKSB7XG4gICAgdmFyIHNlbGYgPSB0aGlzO1xuXG4gICAgaWYgKHR5cGVvZiBmbiAhPT0gJ2Z1bmN0aW9uJykge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKCdtYW55IG9ubHkgYWNjZXB0cyBpbnN0YW5jZXMgb2YgRnVuY3Rpb24nKTtcbiAgICB9XG5cbiAgICBmdW5jdGlvbiBsaXN0ZW5lcigpIHtcbiAgICAgIGlmICgtLXR0bCA9PT0gMCkge1xuICAgICAgICBzZWxmLm9mZihldmVudCwgbGlzdGVuZXIpO1xuICAgICAgfVxuICAgICAgZm4uYXBwbHkodGhpcywgYXJndW1lbnRzKTtcbiAgICB9XG5cbiAgICBsaXN0ZW5lci5fb3JpZ2luID0gZm47XG5cbiAgICB0aGlzLm9uKGV2ZW50LCBsaXN0ZW5lcik7XG5cbiAgICByZXR1cm4gc2VsZjtcbiAgfTtcblxuICBFdmVudEVtaXR0ZXIucHJvdG90eXBlLmVtaXQgPSBmdW5jdGlvbigpIHtcblxuICAgIHRoaXMuX2V2ZW50cyB8fCBpbml0LmNhbGwodGhpcyk7XG5cbiAgICB2YXIgdHlwZSA9IGFyZ3VtZW50c1swXTtcblxuICAgIGlmICh0eXBlID09PSAnbmV3TGlzdGVuZXInICYmICF0aGlzLm5ld0xpc3RlbmVyKSB7XG4gICAgICBpZiAoIXRoaXMuX2V2ZW50cy5uZXdMaXN0ZW5lcikgeyByZXR1cm4gZmFsc2U7IH1cbiAgICB9XG5cbiAgICAvLyBMb29wIHRocm91Z2ggdGhlICpfYWxsKiBmdW5jdGlvbnMgYW5kIGludm9rZSB0aGVtLlxuICAgIGlmICh0aGlzLl9hbGwpIHtcbiAgICAgIHZhciBsID0gYXJndW1lbnRzLmxlbmd0aDtcbiAgICAgIHZhciBhcmdzID0gbmV3IEFycmF5KGwgLSAxKTtcbiAgICAgIGZvciAodmFyIGkgPSAxOyBpIDwgbDsgaSsrKSBhcmdzW2kgLSAxXSA9IGFyZ3VtZW50c1tpXTtcbiAgICAgIGZvciAoaSA9IDAsIGwgPSB0aGlzLl9hbGwubGVuZ3RoOyBpIDwgbDsgaSsrKSB7XG4gICAgICAgIHRoaXMuZXZlbnQgPSB0eXBlO1xuICAgICAgICB0aGlzLl9hbGxbaV0uYXBwbHkodGhpcywgYXJncyk7XG4gICAgICB9XG4gICAgfVxuXG4gICAgLy8gSWYgdGhlcmUgaXMgbm8gJ2Vycm9yJyBldmVudCBsaXN0ZW5lciB0aGVuIHRocm93LlxuICAgIGlmICh0eXBlID09PSAnZXJyb3InKSB7XG5cbiAgICAgIGlmICghdGhpcy5fYWxsICYmXG4gICAgICAgICF0aGlzLl9ldmVudHMuZXJyb3IgJiZcbiAgICAgICAgISh0aGlzLndpbGRjYXJkICYmIHRoaXMubGlzdGVuZXJUcmVlLmVycm9yKSkge1xuXG4gICAgICAgIGlmIChhcmd1bWVudHNbMV0gaW5zdGFuY2VvZiBFcnJvcikge1xuICAgICAgICAgIHRocm93IGFyZ3VtZW50c1sxXTsgLy8gVW5oYW5kbGVkICdlcnJvcicgZXZlbnRcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoXCJVbmNhdWdodCwgdW5zcGVjaWZpZWQgJ2Vycm9yJyBldmVudC5cIik7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgfVxuICAgIH1cblxuICAgIHZhciBoYW5kbGVyO1xuXG4gICAgaWYodGhpcy53aWxkY2FyZCkge1xuICAgICAgaGFuZGxlciA9IFtdO1xuICAgICAgdmFyIG5zID0gdHlwZW9mIHR5cGUgPT09ICdzdHJpbmcnID8gdHlwZS5zcGxpdCh0aGlzLmRlbGltaXRlcikgOiB0eXBlLnNsaWNlKCk7XG4gICAgICBzZWFyY2hMaXN0ZW5lclRyZWUuY2FsbCh0aGlzLCBoYW5kbGVyLCBucywgdGhpcy5saXN0ZW5lclRyZWUsIDApO1xuICAgIH1cbiAgICBlbHNlIHtcbiAgICAgIGhhbmRsZXIgPSB0aGlzLl9ldmVudHNbdHlwZV07XG4gICAgfVxuXG4gICAgaWYgKHR5cGVvZiBoYW5kbGVyID09PSAnZnVuY3Rpb24nKSB7XG4gICAgICB0aGlzLmV2ZW50ID0gdHlwZTtcbiAgICAgIGlmIChhcmd1bWVudHMubGVuZ3RoID09PSAxKSB7XG4gICAgICAgIGhhbmRsZXIuY2FsbCh0aGlzKTtcbiAgICAgIH1cbiAgICAgIGVsc2UgaWYgKGFyZ3VtZW50cy5sZW5ndGggPiAxKVxuICAgICAgICBzd2l0Y2ggKGFyZ3VtZW50cy5sZW5ndGgpIHtcbiAgICAgICAgICBjYXNlIDI6XG4gICAgICAgICAgICBoYW5kbGVyLmNhbGwodGhpcywgYXJndW1lbnRzWzFdKTtcbiAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgIGNhc2UgMzpcbiAgICAgICAgICAgIGhhbmRsZXIuY2FsbCh0aGlzLCBhcmd1bWVudHNbMV0sIGFyZ3VtZW50c1syXSk7XG4gICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAvLyBzbG93ZXJcbiAgICAgICAgICBkZWZhdWx0OlxuICAgICAgICAgICAgdmFyIGwgPSBhcmd1bWVudHMubGVuZ3RoO1xuICAgICAgICAgICAgdmFyIGFyZ3MgPSBuZXcgQXJyYXkobCAtIDEpO1xuICAgICAgICAgICAgZm9yICh2YXIgaSA9IDE7IGkgPCBsOyBpKyspIGFyZ3NbaSAtIDFdID0gYXJndW1lbnRzW2ldO1xuICAgICAgICAgICAgaGFuZGxlci5hcHBseSh0aGlzLCBhcmdzKTtcbiAgICAgICAgfVxuICAgICAgcmV0dXJuIHRydWU7XG4gICAgfVxuICAgIGVsc2UgaWYgKGhhbmRsZXIpIHtcbiAgICAgIHZhciBsID0gYXJndW1lbnRzLmxlbmd0aDtcbiAgICAgIHZhciBhcmdzID0gbmV3IEFycmF5KGwgLSAxKTtcbiAgICAgIGZvciAodmFyIGkgPSAxOyBpIDwgbDsgaSsrKSBhcmdzW2kgLSAxXSA9IGFyZ3VtZW50c1tpXTtcblxuICAgICAgdmFyIGxpc3RlbmVycyA9IGhhbmRsZXIuc2xpY2UoKTtcbiAgICAgIGZvciAodmFyIGkgPSAwLCBsID0gbGlzdGVuZXJzLmxlbmd0aDsgaSA8IGw7IGkrKykge1xuICAgICAgICB0aGlzLmV2ZW50ID0gdHlwZTtcbiAgICAgICAgbGlzdGVuZXJzW2ldLmFwcGx5KHRoaXMsIGFyZ3MpO1xuICAgICAgfVxuICAgICAgcmV0dXJuIChsaXN0ZW5lcnMubGVuZ3RoID4gMCkgfHwgISF0aGlzLl9hbGw7XG4gICAgfVxuICAgIGVsc2Uge1xuICAgICAgcmV0dXJuICEhdGhpcy5fYWxsO1xuICAgIH1cblxuICB9O1xuXG4gIEV2ZW50RW1pdHRlci5wcm90b3R5cGUub24gPSBmdW5jdGlvbih0eXBlLCBsaXN0ZW5lcikge1xuXG4gICAgaWYgKHR5cGVvZiB0eXBlID09PSAnZnVuY3Rpb24nKSB7XG4gICAgICB0aGlzLm9uQW55KHR5cGUpO1xuICAgICAgcmV0dXJuIHRoaXM7XG4gICAgfVxuXG4gICAgaWYgKHR5cGVvZiBsaXN0ZW5lciAhPT0gJ2Z1bmN0aW9uJykge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKCdvbiBvbmx5IGFjY2VwdHMgaW5zdGFuY2VzIG9mIEZ1bmN0aW9uJyk7XG4gICAgfVxuICAgIHRoaXMuX2V2ZW50cyB8fCBpbml0LmNhbGwodGhpcyk7XG5cbiAgICAvLyBUbyBhdm9pZCByZWN1cnNpb24gaW4gdGhlIGNhc2UgdGhhdCB0eXBlID09IFwibmV3TGlzdGVuZXJzXCIhIEJlZm9yZVxuICAgIC8vIGFkZGluZyBpdCB0byB0aGUgbGlzdGVuZXJzLCBmaXJzdCBlbWl0IFwibmV3TGlzdGVuZXJzXCIuXG4gICAgdGhpcy5lbWl0KCduZXdMaXN0ZW5lcicsIHR5cGUsIGxpc3RlbmVyKTtcblxuICAgIGlmKHRoaXMud2lsZGNhcmQpIHtcbiAgICAgIGdyb3dMaXN0ZW5lclRyZWUuY2FsbCh0aGlzLCB0eXBlLCBsaXN0ZW5lcik7XG4gICAgICByZXR1cm4gdGhpcztcbiAgICB9XG5cbiAgICBpZiAoIXRoaXMuX2V2ZW50c1t0eXBlXSkge1xuICAgICAgLy8gT3B0aW1pemUgdGhlIGNhc2Ugb2Ygb25lIGxpc3RlbmVyLiBEb24ndCBuZWVkIHRoZSBleHRyYSBhcnJheSBvYmplY3QuXG4gICAgICB0aGlzLl9ldmVudHNbdHlwZV0gPSBsaXN0ZW5lcjtcbiAgICB9XG4gICAgZWxzZSBpZih0eXBlb2YgdGhpcy5fZXZlbnRzW3R5cGVdID09PSAnZnVuY3Rpb24nKSB7XG4gICAgICAvLyBBZGRpbmcgdGhlIHNlY29uZCBlbGVtZW50LCBuZWVkIHRvIGNoYW5nZSB0byBhcnJheS5cbiAgICAgIHRoaXMuX2V2ZW50c1t0eXBlXSA9IFt0aGlzLl9ldmVudHNbdHlwZV0sIGxpc3RlbmVyXTtcbiAgICB9XG4gICAgZWxzZSBpZiAoaXNBcnJheSh0aGlzLl9ldmVudHNbdHlwZV0pKSB7XG4gICAgICAvLyBJZiB3ZSd2ZSBhbHJlYWR5IGdvdCBhbiBhcnJheSwganVzdCBhcHBlbmQuXG4gICAgICB0aGlzLl9ldmVudHNbdHlwZV0ucHVzaChsaXN0ZW5lcik7XG5cbiAgICAgIC8vIENoZWNrIGZvciBsaXN0ZW5lciBsZWFrXG4gICAgICBpZiAoIXRoaXMuX2V2ZW50c1t0eXBlXS53YXJuZWQpIHtcblxuICAgICAgICB2YXIgbSA9IGRlZmF1bHRNYXhMaXN0ZW5lcnM7XG5cbiAgICAgICAgaWYgKHR5cGVvZiB0aGlzLl9ldmVudHMubWF4TGlzdGVuZXJzICE9PSAndW5kZWZpbmVkJykge1xuICAgICAgICAgIG0gPSB0aGlzLl9ldmVudHMubWF4TGlzdGVuZXJzO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKG0gPiAwICYmIHRoaXMuX2V2ZW50c1t0eXBlXS5sZW5ndGggPiBtKSB7XG5cbiAgICAgICAgICB0aGlzLl9ldmVudHNbdHlwZV0ud2FybmVkID0gdHJ1ZTtcbiAgICAgICAgICBjb25zb2xlLmVycm9yKCcobm9kZSkgd2FybmluZzogcG9zc2libGUgRXZlbnRFbWl0dGVyIG1lbW9yeSAnICtcbiAgICAgICAgICAgICAgICAgICAgICAgICdsZWFrIGRldGVjdGVkLiAlZCBsaXN0ZW5lcnMgYWRkZWQuICcgK1xuICAgICAgICAgICAgICAgICAgICAgICAgJ1VzZSBlbWl0dGVyLnNldE1heExpc3RlbmVycygpIHRvIGluY3JlYXNlIGxpbWl0LicsXG4gICAgICAgICAgICAgICAgICAgICAgICB0aGlzLl9ldmVudHNbdHlwZV0ubGVuZ3RoKTtcbiAgICAgICAgICBjb25zb2xlLnRyYWNlKCk7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG4gICAgcmV0dXJuIHRoaXM7XG4gIH07XG5cbiAgRXZlbnRFbWl0dGVyLnByb3RvdHlwZS5vbkFueSA9IGZ1bmN0aW9uKGZuKSB7XG5cbiAgICBpZiAodHlwZW9mIGZuICE9PSAnZnVuY3Rpb24nKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoJ29uQW55IG9ubHkgYWNjZXB0cyBpbnN0YW5jZXMgb2YgRnVuY3Rpb24nKTtcbiAgICB9XG5cbiAgICBpZighdGhpcy5fYWxsKSB7XG4gICAgICB0aGlzLl9hbGwgPSBbXTtcbiAgICB9XG5cbiAgICAvLyBBZGQgdGhlIGZ1bmN0aW9uIHRvIHRoZSBldmVudCBsaXN0ZW5lciBjb2xsZWN0aW9uLlxuICAgIHRoaXMuX2FsbC5wdXNoKGZuKTtcbiAgICByZXR1cm4gdGhpcztcbiAgfTtcblxuICBFdmVudEVtaXR0ZXIucHJvdG90eXBlLmFkZExpc3RlbmVyID0gRXZlbnRFbWl0dGVyLnByb3RvdHlwZS5vbjtcblxuICBFdmVudEVtaXR0ZXIucHJvdG90eXBlLm9mZiA9IGZ1bmN0aW9uKHR5cGUsIGxpc3RlbmVyKSB7XG4gICAgaWYgKHR5cGVvZiBsaXN0ZW5lciAhPT0gJ2Z1bmN0aW9uJykge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKCdyZW1vdmVMaXN0ZW5lciBvbmx5IHRha2VzIGluc3RhbmNlcyBvZiBGdW5jdGlvbicpO1xuICAgIH1cblxuICAgIHZhciBoYW5kbGVycyxsZWFmcz1bXTtcblxuICAgIGlmKHRoaXMud2lsZGNhcmQpIHtcbiAgICAgIHZhciBucyA9IHR5cGVvZiB0eXBlID09PSAnc3RyaW5nJyA/IHR5cGUuc3BsaXQodGhpcy5kZWxpbWl0ZXIpIDogdHlwZS5zbGljZSgpO1xuICAgICAgbGVhZnMgPSBzZWFyY2hMaXN0ZW5lclRyZWUuY2FsbCh0aGlzLCBudWxsLCBucywgdGhpcy5saXN0ZW5lclRyZWUsIDApO1xuICAgIH1cbiAgICBlbHNlIHtcbiAgICAgIC8vIGRvZXMgbm90IHVzZSBsaXN0ZW5lcnMoKSwgc28gbm8gc2lkZSBlZmZlY3Qgb2YgY3JlYXRpbmcgX2V2ZW50c1t0eXBlXVxuICAgICAgaWYgKCF0aGlzLl9ldmVudHNbdHlwZV0pIHJldHVybiB0aGlzO1xuICAgICAgaGFuZGxlcnMgPSB0aGlzLl9ldmVudHNbdHlwZV07XG4gICAgICBsZWFmcy5wdXNoKHtfbGlzdGVuZXJzOmhhbmRsZXJzfSk7XG4gICAgfVxuXG4gICAgZm9yICh2YXIgaUxlYWY9MDsgaUxlYWY8bGVhZnMubGVuZ3RoOyBpTGVhZisrKSB7XG4gICAgICB2YXIgbGVhZiA9IGxlYWZzW2lMZWFmXTtcbiAgICAgIGhhbmRsZXJzID0gbGVhZi5fbGlzdGVuZXJzO1xuICAgICAgaWYgKGlzQXJyYXkoaGFuZGxlcnMpKSB7XG5cbiAgICAgICAgdmFyIHBvc2l0aW9uID0gLTE7XG5cbiAgICAgICAgZm9yICh2YXIgaSA9IDAsIGxlbmd0aCA9IGhhbmRsZXJzLmxlbmd0aDsgaSA8IGxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgaWYgKGhhbmRsZXJzW2ldID09PSBsaXN0ZW5lciB8fFxuICAgICAgICAgICAgKGhhbmRsZXJzW2ldLmxpc3RlbmVyICYmIGhhbmRsZXJzW2ldLmxpc3RlbmVyID09PSBsaXN0ZW5lcikgfHxcbiAgICAgICAgICAgIChoYW5kbGVyc1tpXS5fb3JpZ2luICYmIGhhbmRsZXJzW2ldLl9vcmlnaW4gPT09IGxpc3RlbmVyKSkge1xuICAgICAgICAgICAgcG9zaXRpb24gPSBpO1xuICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgaWYgKHBvc2l0aW9uIDwgMCkge1xuICAgICAgICAgIGNvbnRpbnVlO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYodGhpcy53aWxkY2FyZCkge1xuICAgICAgICAgIGxlYWYuX2xpc3RlbmVycy5zcGxpY2UocG9zaXRpb24sIDEpO1xuICAgICAgICB9XG4gICAgICAgIGVsc2Uge1xuICAgICAgICAgIHRoaXMuX2V2ZW50c1t0eXBlXS5zcGxpY2UocG9zaXRpb24sIDEpO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKGhhbmRsZXJzLmxlbmd0aCA9PT0gMCkge1xuICAgICAgICAgIGlmKHRoaXMud2lsZGNhcmQpIHtcbiAgICAgICAgICAgIGRlbGV0ZSBsZWFmLl9saXN0ZW5lcnM7XG4gICAgICAgICAgfVxuICAgICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgZGVsZXRlIHRoaXMuX2V2ZW50c1t0eXBlXTtcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIHRoaXM7XG4gICAgICB9XG4gICAgICBlbHNlIGlmIChoYW5kbGVycyA9PT0gbGlzdGVuZXIgfHxcbiAgICAgICAgKGhhbmRsZXJzLmxpc3RlbmVyICYmIGhhbmRsZXJzLmxpc3RlbmVyID09PSBsaXN0ZW5lcikgfHxcbiAgICAgICAgKGhhbmRsZXJzLl9vcmlnaW4gJiYgaGFuZGxlcnMuX29yaWdpbiA9PT0gbGlzdGVuZXIpKSB7XG4gICAgICAgIGlmKHRoaXMud2lsZGNhcmQpIHtcbiAgICAgICAgICBkZWxldGUgbGVhZi5fbGlzdGVuZXJzO1xuICAgICAgICB9XG4gICAgICAgIGVsc2Uge1xuICAgICAgICAgIGRlbGV0ZSB0aGlzLl9ldmVudHNbdHlwZV07XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG5cbiAgICByZXR1cm4gdGhpcztcbiAgfTtcblxuICBFdmVudEVtaXR0ZXIucHJvdG90eXBlLm9mZkFueSA9IGZ1bmN0aW9uKGZuKSB7XG4gICAgdmFyIGkgPSAwLCBsID0gMCwgZm5zO1xuICAgIGlmIChmbiAmJiB0aGlzLl9hbGwgJiYgdGhpcy5fYWxsLmxlbmd0aCA+IDApIHtcbiAgICAgIGZucyA9IHRoaXMuX2FsbDtcbiAgICAgIGZvcihpID0gMCwgbCA9IGZucy5sZW5ndGg7IGkgPCBsOyBpKyspIHtcbiAgICAgICAgaWYoZm4gPT09IGZuc1tpXSkge1xuICAgICAgICAgIGZucy5zcGxpY2UoaSwgMSk7XG4gICAgICAgICAgcmV0dXJuIHRoaXM7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9IGVsc2Uge1xuICAgICAgdGhpcy5fYWxsID0gW107XG4gICAgfVxuICAgIHJldHVybiB0aGlzO1xuICB9O1xuXG4gIEV2ZW50RW1pdHRlci5wcm90b3R5cGUucmVtb3ZlTGlzdGVuZXIgPSBFdmVudEVtaXR0ZXIucHJvdG90eXBlLm9mZjtcblxuICBFdmVudEVtaXR0ZXIucHJvdG90eXBlLnJlbW92ZUFsbExpc3RlbmVycyA9IGZ1bmN0aW9uKHR5cGUpIHtcbiAgICBpZiAoYXJndW1lbnRzLmxlbmd0aCA9PT0gMCkge1xuICAgICAgIXRoaXMuX2V2ZW50cyB8fCBpbml0LmNhbGwodGhpcyk7XG4gICAgICByZXR1cm4gdGhpcztcbiAgICB9XG5cbiAgICBpZih0aGlzLndpbGRjYXJkKSB7XG4gICAgICB2YXIgbnMgPSB0eXBlb2YgdHlwZSA9PT0gJ3N0cmluZycgPyB0eXBlLnNwbGl0KHRoaXMuZGVsaW1pdGVyKSA6IHR5cGUuc2xpY2UoKTtcbiAgICAgIHZhciBsZWFmcyA9IHNlYXJjaExpc3RlbmVyVHJlZS5jYWxsKHRoaXMsIG51bGwsIG5zLCB0aGlzLmxpc3RlbmVyVHJlZSwgMCk7XG5cbiAgICAgIGZvciAodmFyIGlMZWFmPTA7IGlMZWFmPGxlYWZzLmxlbmd0aDsgaUxlYWYrKykge1xuICAgICAgICB2YXIgbGVhZiA9IGxlYWZzW2lMZWFmXTtcbiAgICAgICAgbGVhZi5fbGlzdGVuZXJzID0gbnVsbDtcbiAgICAgIH1cbiAgICB9XG4gICAgZWxzZSB7XG4gICAgICBpZiAoIXRoaXMuX2V2ZW50c1t0eXBlXSkgcmV0dXJuIHRoaXM7XG4gICAgICB0aGlzLl9ldmVudHNbdHlwZV0gPSBudWxsO1xuICAgIH1cbiAgICByZXR1cm4gdGhpcztcbiAgfTtcblxuICBFdmVudEVtaXR0ZXIucHJvdG90eXBlLmxpc3RlbmVycyA9IGZ1bmN0aW9uKHR5cGUpIHtcbiAgICBpZih0aGlzLndpbGRjYXJkKSB7XG4gICAgICB2YXIgaGFuZGxlcnMgPSBbXTtcbiAgICAgIHZhciBucyA9IHR5cGVvZiB0eXBlID09PSAnc3RyaW5nJyA/IHR5cGUuc3BsaXQodGhpcy5kZWxpbWl0ZXIpIDogdHlwZS5zbGljZSgpO1xuICAgICAgc2VhcmNoTGlzdGVuZXJUcmVlLmNhbGwodGhpcywgaGFuZGxlcnMsIG5zLCB0aGlzLmxpc3RlbmVyVHJlZSwgMCk7XG4gICAgICByZXR1cm4gaGFuZGxlcnM7XG4gICAgfVxuXG4gICAgdGhpcy5fZXZlbnRzIHx8IGluaXQuY2FsbCh0aGlzKTtcblxuICAgIGlmICghdGhpcy5fZXZlbnRzW3R5cGVdKSB0aGlzLl9ldmVudHNbdHlwZV0gPSBbXTtcbiAgICBpZiAoIWlzQXJyYXkodGhpcy5fZXZlbnRzW3R5cGVdKSkge1xuICAgICAgdGhpcy5fZXZlbnRzW3R5cGVdID0gW3RoaXMuX2V2ZW50c1t0eXBlXV07XG4gICAgfVxuICAgIHJldHVybiB0aGlzLl9ldmVudHNbdHlwZV07XG4gIH07XG5cbiAgRXZlbnRFbWl0dGVyLnByb3RvdHlwZS5saXN0ZW5lcnNBbnkgPSBmdW5jdGlvbigpIHtcblxuICAgIGlmKHRoaXMuX2FsbCkge1xuICAgICAgcmV0dXJuIHRoaXMuX2FsbDtcbiAgICB9XG4gICAgZWxzZSB7XG4gICAgICByZXR1cm4gW107XG4gICAgfVxuXG4gIH07XG5cbiAgaWYgKHR5cGVvZiBkZWZpbmUgPT09ICdmdW5jdGlvbicgJiYgZGVmaW5lLmFtZCkge1xuICAgICAvLyBBTUQuIFJlZ2lzdGVyIGFzIGFuIGFub255bW91cyBtb2R1bGUuXG4gICAgZGVmaW5lKGZ1bmN0aW9uKCkge1xuICAgICAgcmV0dXJuIEV2ZW50RW1pdHRlcjtcbiAgICB9KTtcbiAgfSBlbHNlIGlmICh0eXBlb2YgZXhwb3J0cyA9PT0gJ29iamVjdCcpIHtcbiAgICAvLyBDb21tb25KU1xuICAgIGV4cG9ydHMuRXZlbnRFbWl0dGVyMiA9IEV2ZW50RW1pdHRlcjtcbiAgfVxuICBlbHNlIHtcbiAgICAvLyBCcm93c2VyIGdsb2JhbC5cbiAgICB3aW5kb3cuRXZlbnRFbWl0dGVyMiA9IEV2ZW50RW1pdHRlcjtcbiAgfVxufSgpO1xuIiwiXCJ1c2Ugc3RyaWN0XCI7XG4vKmdsb2JhbHMgSGFuZGxlYmFyczogdHJ1ZSAqL1xudmFyIEhhbmRsZWJhcnMgPSByZXF1aXJlKFwiLi9oYW5kbGViYXJzLnJ1bnRpbWVcIilbXCJkZWZhdWx0XCJdO1xuXG4vLyBDb21waWxlciBpbXBvcnRzXG52YXIgQVNUID0gcmVxdWlyZShcIi4vaGFuZGxlYmFycy9jb21waWxlci9hc3RcIilbXCJkZWZhdWx0XCJdO1xudmFyIFBhcnNlciA9IHJlcXVpcmUoXCIuL2hhbmRsZWJhcnMvY29tcGlsZXIvYmFzZVwiKS5wYXJzZXI7XG52YXIgcGFyc2UgPSByZXF1aXJlKFwiLi9oYW5kbGViYXJzL2NvbXBpbGVyL2Jhc2VcIikucGFyc2U7XG52YXIgQ29tcGlsZXIgPSByZXF1aXJlKFwiLi9oYW5kbGViYXJzL2NvbXBpbGVyL2NvbXBpbGVyXCIpLkNvbXBpbGVyO1xudmFyIGNvbXBpbGUgPSByZXF1aXJlKFwiLi9oYW5kbGViYXJzL2NvbXBpbGVyL2NvbXBpbGVyXCIpLmNvbXBpbGU7XG52YXIgcHJlY29tcGlsZSA9IHJlcXVpcmUoXCIuL2hhbmRsZWJhcnMvY29tcGlsZXIvY29tcGlsZXJcIikucHJlY29tcGlsZTtcbnZhciBKYXZhU2NyaXB0Q29tcGlsZXIgPSByZXF1aXJlKFwiLi9oYW5kbGViYXJzL2NvbXBpbGVyL2phdmFzY3JpcHQtY29tcGlsZXJcIilbXCJkZWZhdWx0XCJdO1xuXG52YXIgX2NyZWF0ZSA9IEhhbmRsZWJhcnMuY3JlYXRlO1xudmFyIGNyZWF0ZSA9IGZ1bmN0aW9uKCkge1xuICB2YXIgaGIgPSBfY3JlYXRlKCk7XG5cbiAgaGIuY29tcGlsZSA9IGZ1bmN0aW9uKGlucHV0LCBvcHRpb25zKSB7XG4gICAgcmV0dXJuIGNvbXBpbGUoaW5wdXQsIG9wdGlvbnMsIGhiKTtcbiAgfTtcbiAgaGIucHJlY29tcGlsZSA9IGZ1bmN0aW9uIChpbnB1dCwgb3B0aW9ucykge1xuICAgIHJldHVybiBwcmVjb21waWxlKGlucHV0LCBvcHRpb25zLCBoYik7XG4gIH07XG5cbiAgaGIuQVNUID0gQVNUO1xuICBoYi5Db21waWxlciA9IENvbXBpbGVyO1xuICBoYi5KYXZhU2NyaXB0Q29tcGlsZXIgPSBKYXZhU2NyaXB0Q29tcGlsZXI7XG4gIGhiLlBhcnNlciA9IFBhcnNlcjtcbiAgaGIucGFyc2UgPSBwYXJzZTtcblxuICByZXR1cm4gaGI7XG59O1xuXG5IYW5kbGViYXJzID0gY3JlYXRlKCk7XG5IYW5kbGViYXJzLmNyZWF0ZSA9IGNyZWF0ZTtcblxuSGFuZGxlYmFyc1snZGVmYXVsdCddID0gSGFuZGxlYmFycztcblxuZXhwb3J0c1tcImRlZmF1bHRcIl0gPSBIYW5kbGViYXJzOyIsIlwidXNlIHN0cmljdFwiO1xuLypnbG9iYWxzIEhhbmRsZWJhcnM6IHRydWUgKi9cbnZhciBiYXNlID0gcmVxdWlyZShcIi4vaGFuZGxlYmFycy9iYXNlXCIpO1xuXG4vLyBFYWNoIG9mIHRoZXNlIGF1Z21lbnQgdGhlIEhhbmRsZWJhcnMgb2JqZWN0LiBObyBuZWVkIHRvIHNldHVwIGhlcmUuXG4vLyAoVGhpcyBpcyBkb25lIHRvIGVhc2lseSBzaGFyZSBjb2RlIGJldHdlZW4gY29tbW9uanMgYW5kIGJyb3dzZSBlbnZzKVxudmFyIFNhZmVTdHJpbmcgPSByZXF1aXJlKFwiLi9oYW5kbGViYXJzL3NhZmUtc3RyaW5nXCIpW1wiZGVmYXVsdFwiXTtcbnZhciBFeGNlcHRpb24gPSByZXF1aXJlKFwiLi9oYW5kbGViYXJzL2V4Y2VwdGlvblwiKVtcImRlZmF1bHRcIl07XG52YXIgVXRpbHMgPSByZXF1aXJlKFwiLi9oYW5kbGViYXJzL3V0aWxzXCIpO1xudmFyIHJ1bnRpbWUgPSByZXF1aXJlKFwiLi9oYW5kbGViYXJzL3J1bnRpbWVcIik7XG5cbi8vIEZvciBjb21wYXRpYmlsaXR5IGFuZCB1c2FnZSBvdXRzaWRlIG9mIG1vZHVsZSBzeXN0ZW1zLCBtYWtlIHRoZSBIYW5kbGViYXJzIG9iamVjdCBhIG5hbWVzcGFjZVxudmFyIGNyZWF0ZSA9IGZ1bmN0aW9uKCkge1xuICB2YXIgaGIgPSBuZXcgYmFzZS5IYW5kbGViYXJzRW52aXJvbm1lbnQoKTtcblxuICBVdGlscy5leHRlbmQoaGIsIGJhc2UpO1xuICBoYi5TYWZlU3RyaW5nID0gU2FmZVN0cmluZztcbiAgaGIuRXhjZXB0aW9uID0gRXhjZXB0aW9uO1xuICBoYi5VdGlscyA9IFV0aWxzO1xuICBoYi5lc2NhcGVFeHByZXNzaW9uID0gVXRpbHMuZXNjYXBlRXhwcmVzc2lvbjtcblxuICBoYi5WTSA9IHJ1bnRpbWU7XG4gIGhiLnRlbXBsYXRlID0gZnVuY3Rpb24oc3BlYykge1xuICAgIHJldHVybiBydW50aW1lLnRlbXBsYXRlKHNwZWMsIGhiKTtcbiAgfTtcblxuICByZXR1cm4gaGI7XG59O1xuXG52YXIgSGFuZGxlYmFycyA9IGNyZWF0ZSgpO1xuSGFuZGxlYmFycy5jcmVhdGUgPSBjcmVhdGU7XG5cbkhhbmRsZWJhcnNbJ2RlZmF1bHQnXSA9IEhhbmRsZWJhcnM7XG5cbmV4cG9ydHNbXCJkZWZhdWx0XCJdID0gSGFuZGxlYmFyczsiLCJcInVzZSBzdHJpY3RcIjtcbnZhciBVdGlscyA9IHJlcXVpcmUoXCIuL3V0aWxzXCIpO1xudmFyIEV4Y2VwdGlvbiA9IHJlcXVpcmUoXCIuL2V4Y2VwdGlvblwiKVtcImRlZmF1bHRcIl07XG5cbnZhciBWRVJTSU9OID0gXCIyLjAuMFwiO1xuZXhwb3J0cy5WRVJTSU9OID0gVkVSU0lPTjt2YXIgQ09NUElMRVJfUkVWSVNJT04gPSA2O1xuZXhwb3J0cy5DT01QSUxFUl9SRVZJU0lPTiA9IENPTVBJTEVSX1JFVklTSU9OO1xudmFyIFJFVklTSU9OX0NIQU5HRVMgPSB7XG4gIDE6ICc8PSAxLjAucmMuMicsIC8vIDEuMC5yYy4yIGlzIGFjdHVhbGx5IHJldjIgYnV0IGRvZXNuJ3QgcmVwb3J0IGl0XG4gIDI6ICc9PSAxLjAuMC1yYy4zJyxcbiAgMzogJz09IDEuMC4wLXJjLjQnLFxuICA0OiAnPT0gMS54LngnLFxuICA1OiAnPT0gMi4wLjAtYWxwaGEueCcsXG4gIDY6ICc+PSAyLjAuMC1iZXRhLjEnXG59O1xuZXhwb3J0cy5SRVZJU0lPTl9DSEFOR0VTID0gUkVWSVNJT05fQ0hBTkdFUztcbnZhciBpc0FycmF5ID0gVXRpbHMuaXNBcnJheSxcbiAgICBpc0Z1bmN0aW9uID0gVXRpbHMuaXNGdW5jdGlvbixcbiAgICB0b1N0cmluZyA9IFV0aWxzLnRvU3RyaW5nLFxuICAgIG9iamVjdFR5cGUgPSAnW29iamVjdCBPYmplY3RdJztcblxuZnVuY3Rpb24gSGFuZGxlYmFyc0Vudmlyb25tZW50KGhlbHBlcnMsIHBhcnRpYWxzKSB7XG4gIHRoaXMuaGVscGVycyA9IGhlbHBlcnMgfHwge307XG4gIHRoaXMucGFydGlhbHMgPSBwYXJ0aWFscyB8fCB7fTtcblxuICByZWdpc3RlckRlZmF1bHRIZWxwZXJzKHRoaXMpO1xufVxuXG5leHBvcnRzLkhhbmRsZWJhcnNFbnZpcm9ubWVudCA9IEhhbmRsZWJhcnNFbnZpcm9ubWVudDtIYW5kbGViYXJzRW52aXJvbm1lbnQucHJvdG90eXBlID0ge1xuICBjb25zdHJ1Y3RvcjogSGFuZGxlYmFyc0Vudmlyb25tZW50LFxuXG4gIGxvZ2dlcjogbG9nZ2VyLFxuICBsb2c6IGxvZyxcblxuICByZWdpc3RlckhlbHBlcjogZnVuY3Rpb24obmFtZSwgZm4pIHtcbiAgICBpZiAodG9TdHJpbmcuY2FsbChuYW1lKSA9PT0gb2JqZWN0VHlwZSkge1xuICAgICAgaWYgKGZuKSB7IHRocm93IG5ldyBFeGNlcHRpb24oJ0FyZyBub3Qgc3VwcG9ydGVkIHdpdGggbXVsdGlwbGUgaGVscGVycycpOyB9XG4gICAgICBVdGlscy5leHRlbmQodGhpcy5oZWxwZXJzLCBuYW1lKTtcbiAgICB9IGVsc2Uge1xuICAgICAgdGhpcy5oZWxwZXJzW25hbWVdID0gZm47XG4gICAgfVxuICB9LFxuICB1bnJlZ2lzdGVySGVscGVyOiBmdW5jdGlvbihuYW1lKSB7XG4gICAgZGVsZXRlIHRoaXMuaGVscGVyc1tuYW1lXTtcbiAgfSxcblxuICByZWdpc3RlclBhcnRpYWw6IGZ1bmN0aW9uKG5hbWUsIHBhcnRpYWwpIHtcbiAgICBpZiAodG9TdHJpbmcuY2FsbChuYW1lKSA9PT0gb2JqZWN0VHlwZSkge1xuICAgICAgVXRpbHMuZXh0ZW5kKHRoaXMucGFydGlhbHMsICBuYW1lKTtcbiAgICB9IGVsc2Uge1xuICAgICAgdGhpcy5wYXJ0aWFsc1tuYW1lXSA9IHBhcnRpYWw7XG4gICAgfVxuICB9LFxuICB1bnJlZ2lzdGVyUGFydGlhbDogZnVuY3Rpb24obmFtZSkge1xuICAgIGRlbGV0ZSB0aGlzLnBhcnRpYWxzW25hbWVdO1xuICB9XG59O1xuXG5mdW5jdGlvbiByZWdpc3RlckRlZmF1bHRIZWxwZXJzKGluc3RhbmNlKSB7XG4gIGluc3RhbmNlLnJlZ2lzdGVySGVscGVyKCdoZWxwZXJNaXNzaW5nJywgZnVuY3Rpb24oLyogW2FyZ3MsIF1vcHRpb25zICovKSB7XG4gICAgaWYoYXJndW1lbnRzLmxlbmd0aCA9PT0gMSkge1xuICAgICAgLy8gQSBtaXNzaW5nIGZpZWxkIGluIGEge3tmb299fSBjb25zdHVjdC5cbiAgICAgIHJldHVybiB1bmRlZmluZWQ7XG4gICAgfSBlbHNlIHtcbiAgICAgIC8vIFNvbWVvbmUgaXMgYWN0dWFsbHkgdHJ5aW5nIHRvIGNhbGwgc29tZXRoaW5nLCBibG93IHVwLlxuICAgICAgdGhyb3cgbmV3IEV4Y2VwdGlvbihcIk1pc3NpbmcgaGVscGVyOiAnXCIgKyBhcmd1bWVudHNbYXJndW1lbnRzLmxlbmd0aC0xXS5uYW1lICsgXCInXCIpO1xuICAgIH1cbiAgfSk7XG5cbiAgaW5zdGFuY2UucmVnaXN0ZXJIZWxwZXIoJ2Jsb2NrSGVscGVyTWlzc2luZycsIGZ1bmN0aW9uKGNvbnRleHQsIG9wdGlvbnMpIHtcbiAgICB2YXIgaW52ZXJzZSA9IG9wdGlvbnMuaW52ZXJzZSxcbiAgICAgICAgZm4gPSBvcHRpb25zLmZuO1xuXG4gICAgaWYoY29udGV4dCA9PT0gdHJ1ZSkge1xuICAgICAgcmV0dXJuIGZuKHRoaXMpO1xuICAgIH0gZWxzZSBpZihjb250ZXh0ID09PSBmYWxzZSB8fCBjb250ZXh0ID09IG51bGwpIHtcbiAgICAgIHJldHVybiBpbnZlcnNlKHRoaXMpO1xuICAgIH0gZWxzZSBpZiAoaXNBcnJheShjb250ZXh0KSkge1xuICAgICAgaWYoY29udGV4dC5sZW5ndGggPiAwKSB7XG4gICAgICAgIGlmIChvcHRpb25zLmlkcykge1xuICAgICAgICAgIG9wdGlvbnMuaWRzID0gW29wdGlvbnMubmFtZV07XG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm4gaW5zdGFuY2UuaGVscGVycy5lYWNoKGNvbnRleHQsIG9wdGlvbnMpO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgcmV0dXJuIGludmVyc2UodGhpcyk7XG4gICAgICB9XG4gICAgfSBlbHNlIHtcbiAgICAgIGlmIChvcHRpb25zLmRhdGEgJiYgb3B0aW9ucy5pZHMpIHtcbiAgICAgICAgdmFyIGRhdGEgPSBjcmVhdGVGcmFtZShvcHRpb25zLmRhdGEpO1xuICAgICAgICBkYXRhLmNvbnRleHRQYXRoID0gVXRpbHMuYXBwZW5kQ29udGV4dFBhdGgob3B0aW9ucy5kYXRhLmNvbnRleHRQYXRoLCBvcHRpb25zLm5hbWUpO1xuICAgICAgICBvcHRpb25zID0ge2RhdGE6IGRhdGF9O1xuICAgICAgfVxuXG4gICAgICByZXR1cm4gZm4oY29udGV4dCwgb3B0aW9ucyk7XG4gICAgfVxuICB9KTtcblxuICBpbnN0YW5jZS5yZWdpc3RlckhlbHBlcignZWFjaCcsIGZ1bmN0aW9uKGNvbnRleHQsIG9wdGlvbnMpIHtcbiAgICBpZiAoIW9wdGlvbnMpIHtcbiAgICAgIHRocm93IG5ldyBFeGNlcHRpb24oJ011c3QgcGFzcyBpdGVyYXRvciB0byAjZWFjaCcpO1xuICAgIH1cblxuICAgIHZhciBmbiA9IG9wdGlvbnMuZm4sIGludmVyc2UgPSBvcHRpb25zLmludmVyc2U7XG4gICAgdmFyIGkgPSAwLCByZXQgPSBcIlwiLCBkYXRhO1xuXG4gICAgdmFyIGNvbnRleHRQYXRoO1xuICAgIGlmIChvcHRpb25zLmRhdGEgJiYgb3B0aW9ucy5pZHMpIHtcbiAgICAgIGNvbnRleHRQYXRoID0gVXRpbHMuYXBwZW5kQ29udGV4dFBhdGgob3B0aW9ucy5kYXRhLmNvbnRleHRQYXRoLCBvcHRpb25zLmlkc1swXSkgKyAnLic7XG4gICAgfVxuXG4gICAgaWYgKGlzRnVuY3Rpb24oY29udGV4dCkpIHsgY29udGV4dCA9IGNvbnRleHQuY2FsbCh0aGlzKTsgfVxuXG4gICAgaWYgKG9wdGlvbnMuZGF0YSkge1xuICAgICAgZGF0YSA9IGNyZWF0ZUZyYW1lKG9wdGlvbnMuZGF0YSk7XG4gICAgfVxuXG4gICAgaWYoY29udGV4dCAmJiB0eXBlb2YgY29udGV4dCA9PT0gJ29iamVjdCcpIHtcbiAgICAgIGlmIChpc0FycmF5KGNvbnRleHQpKSB7XG4gICAgICAgIGZvcih2YXIgaiA9IGNvbnRleHQubGVuZ3RoOyBpPGo7IGkrKykge1xuICAgICAgICAgIGlmIChkYXRhKSB7XG4gICAgICAgICAgICBkYXRhLmluZGV4ID0gaTtcbiAgICAgICAgICAgIGRhdGEuZmlyc3QgPSAoaSA9PT0gMCk7XG4gICAgICAgICAgICBkYXRhLmxhc3QgID0gKGkgPT09IChjb250ZXh0Lmxlbmd0aC0xKSk7XG5cbiAgICAgICAgICAgIGlmIChjb250ZXh0UGF0aCkge1xuICAgICAgICAgICAgICBkYXRhLmNvbnRleHRQYXRoID0gY29udGV4dFBhdGggKyBpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgIH1cbiAgICAgICAgICByZXQgPSByZXQgKyBmbihjb250ZXh0W2ldLCB7IGRhdGE6IGRhdGEgfSk7XG4gICAgICAgIH1cbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIGZvcih2YXIga2V5IGluIGNvbnRleHQpIHtcbiAgICAgICAgICBpZihjb250ZXh0Lmhhc093blByb3BlcnR5KGtleSkpIHtcbiAgICAgICAgICAgIGlmKGRhdGEpIHtcbiAgICAgICAgICAgICAgZGF0YS5rZXkgPSBrZXk7XG4gICAgICAgICAgICAgIGRhdGEuaW5kZXggPSBpO1xuICAgICAgICAgICAgICBkYXRhLmZpcnN0ID0gKGkgPT09IDApO1xuXG4gICAgICAgICAgICAgIGlmIChjb250ZXh0UGF0aCkge1xuICAgICAgICAgICAgICAgIGRhdGEuY29udGV4dFBhdGggPSBjb250ZXh0UGF0aCArIGtleTtcbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgcmV0ID0gcmV0ICsgZm4oY29udGV4dFtrZXldLCB7ZGF0YTogZGF0YX0pO1xuICAgICAgICAgICAgaSsrO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cblxuICAgIGlmKGkgPT09IDApe1xuICAgICAgcmV0ID0gaW52ZXJzZSh0aGlzKTtcbiAgICB9XG5cbiAgICByZXR1cm4gcmV0O1xuICB9KTtcblxuICBpbnN0YW5jZS5yZWdpc3RlckhlbHBlcignaWYnLCBmdW5jdGlvbihjb25kaXRpb25hbCwgb3B0aW9ucykge1xuICAgIGlmIChpc0Z1bmN0aW9uKGNvbmRpdGlvbmFsKSkgeyBjb25kaXRpb25hbCA9IGNvbmRpdGlvbmFsLmNhbGwodGhpcyk7IH1cblxuICAgIC8vIERlZmF1bHQgYmVoYXZpb3IgaXMgdG8gcmVuZGVyIHRoZSBwb3NpdGl2ZSBwYXRoIGlmIHRoZSB2YWx1ZSBpcyB0cnV0aHkgYW5kIG5vdCBlbXB0eS5cbiAgICAvLyBUaGUgYGluY2x1ZGVaZXJvYCBvcHRpb24gbWF5IGJlIHNldCB0byB0cmVhdCB0aGUgY29uZHRpb25hbCBhcyBwdXJlbHkgbm90IGVtcHR5IGJhc2VkIG9uIHRoZVxuICAgIC8vIGJlaGF2aW9yIG9mIGlzRW1wdHkuIEVmZmVjdGl2ZWx5IHRoaXMgZGV0ZXJtaW5lcyBpZiAwIGlzIGhhbmRsZWQgYnkgdGhlIHBvc2l0aXZlIHBhdGggb3IgbmVnYXRpdmUuXG4gICAgaWYgKCghb3B0aW9ucy5oYXNoLmluY2x1ZGVaZXJvICYmICFjb25kaXRpb25hbCkgfHwgVXRpbHMuaXNFbXB0eShjb25kaXRpb25hbCkpIHtcbiAgICAgIHJldHVybiBvcHRpb25zLmludmVyc2UodGhpcyk7XG4gICAgfSBlbHNlIHtcbiAgICAgIHJldHVybiBvcHRpb25zLmZuKHRoaXMpO1xuICAgIH1cbiAgfSk7XG5cbiAgaW5zdGFuY2UucmVnaXN0ZXJIZWxwZXIoJ3VubGVzcycsIGZ1bmN0aW9uKGNvbmRpdGlvbmFsLCBvcHRpb25zKSB7XG4gICAgcmV0dXJuIGluc3RhbmNlLmhlbHBlcnNbJ2lmJ10uY2FsbCh0aGlzLCBjb25kaXRpb25hbCwge2ZuOiBvcHRpb25zLmludmVyc2UsIGludmVyc2U6IG9wdGlvbnMuZm4sIGhhc2g6IG9wdGlvbnMuaGFzaH0pO1xuICB9KTtcblxuICBpbnN0YW5jZS5yZWdpc3RlckhlbHBlcignd2l0aCcsIGZ1bmN0aW9uKGNvbnRleHQsIG9wdGlvbnMpIHtcbiAgICBpZiAoaXNGdW5jdGlvbihjb250ZXh0KSkgeyBjb250ZXh0ID0gY29udGV4dC5jYWxsKHRoaXMpOyB9XG5cbiAgICB2YXIgZm4gPSBvcHRpb25zLmZuO1xuXG4gICAgaWYgKCFVdGlscy5pc0VtcHR5KGNvbnRleHQpKSB7XG4gICAgICBpZiAob3B0aW9ucy5kYXRhICYmIG9wdGlvbnMuaWRzKSB7XG4gICAgICAgIHZhciBkYXRhID0gY3JlYXRlRnJhbWUob3B0aW9ucy5kYXRhKTtcbiAgICAgICAgZGF0YS5jb250ZXh0UGF0aCA9IFV0aWxzLmFwcGVuZENvbnRleHRQYXRoKG9wdGlvbnMuZGF0YS5jb250ZXh0UGF0aCwgb3B0aW9ucy5pZHNbMF0pO1xuICAgICAgICBvcHRpb25zID0ge2RhdGE6ZGF0YX07XG4gICAgICB9XG5cbiAgICAgIHJldHVybiBmbihjb250ZXh0LCBvcHRpb25zKTtcbiAgICB9IGVsc2Uge1xuICAgICAgcmV0dXJuIG9wdGlvbnMuaW52ZXJzZSh0aGlzKTtcbiAgICB9XG4gIH0pO1xuXG4gIGluc3RhbmNlLnJlZ2lzdGVySGVscGVyKCdsb2cnLCBmdW5jdGlvbihtZXNzYWdlLCBvcHRpb25zKSB7XG4gICAgdmFyIGxldmVsID0gb3B0aW9ucy5kYXRhICYmIG9wdGlvbnMuZGF0YS5sZXZlbCAhPSBudWxsID8gcGFyc2VJbnQob3B0aW9ucy5kYXRhLmxldmVsLCAxMCkgOiAxO1xuICAgIGluc3RhbmNlLmxvZyhsZXZlbCwgbWVzc2FnZSk7XG4gIH0pO1xuXG4gIGluc3RhbmNlLnJlZ2lzdGVySGVscGVyKCdsb29rdXAnLCBmdW5jdGlvbihvYmosIGZpZWxkKSB7XG4gICAgcmV0dXJuIG9iaiAmJiBvYmpbZmllbGRdO1xuICB9KTtcbn1cblxudmFyIGxvZ2dlciA9IHtcbiAgbWV0aG9kTWFwOiB7IDA6ICdkZWJ1ZycsIDE6ICdpbmZvJywgMjogJ3dhcm4nLCAzOiAnZXJyb3InIH0sXG5cbiAgLy8gU3RhdGUgZW51bVxuICBERUJVRzogMCxcbiAgSU5GTzogMSxcbiAgV0FSTjogMixcbiAgRVJST1I6IDMsXG4gIGxldmVsOiAzLFxuXG4gIC8vIGNhbiBiZSBvdmVycmlkZGVuIGluIHRoZSBob3N0IGVudmlyb25tZW50XG4gIGxvZzogZnVuY3Rpb24obGV2ZWwsIG1lc3NhZ2UpIHtcbiAgICBpZiAobG9nZ2VyLmxldmVsIDw9IGxldmVsKSB7XG4gICAgICB2YXIgbWV0aG9kID0gbG9nZ2VyLm1ldGhvZE1hcFtsZXZlbF07XG4gICAgICBpZiAodHlwZW9mIGNvbnNvbGUgIT09ICd1bmRlZmluZWQnICYmIGNvbnNvbGVbbWV0aG9kXSkge1xuICAgICAgICBjb25zb2xlW21ldGhvZF0uY2FsbChjb25zb2xlLCBtZXNzYWdlKTtcbiAgICAgIH1cbiAgICB9XG4gIH1cbn07XG5leHBvcnRzLmxvZ2dlciA9IGxvZ2dlcjtcbnZhciBsb2cgPSBsb2dnZXIubG9nO1xuZXhwb3J0cy5sb2cgPSBsb2c7XG52YXIgY3JlYXRlRnJhbWUgPSBmdW5jdGlvbihvYmplY3QpIHtcbiAgdmFyIGZyYW1lID0gVXRpbHMuZXh0ZW5kKHt9LCBvYmplY3QpO1xuICBmcmFtZS5fcGFyZW50ID0gb2JqZWN0O1xuICByZXR1cm4gZnJhbWU7XG59O1xuZXhwb3J0cy5jcmVhdGVGcmFtZSA9IGNyZWF0ZUZyYW1lOyIsIlwidXNlIHN0cmljdFwiO1xudmFyIEV4Y2VwdGlvbiA9IHJlcXVpcmUoXCIuLi9leGNlcHRpb25cIilbXCJkZWZhdWx0XCJdO1xuXG5mdW5jdGlvbiBMb2NhdGlvbkluZm8obG9jSW5mbykge1xuICBsb2NJbmZvID0gbG9jSW5mbyB8fCB7fTtcbiAgdGhpcy5maXJzdExpbmUgICA9IGxvY0luZm8uZmlyc3RfbGluZTtcbiAgdGhpcy5maXJzdENvbHVtbiA9IGxvY0luZm8uZmlyc3RfY29sdW1uO1xuICB0aGlzLmxhc3RDb2x1bW4gID0gbG9jSW5mby5sYXN0X2NvbHVtbjtcbiAgdGhpcy5sYXN0TGluZSAgICA9IGxvY0luZm8ubGFzdF9saW5lO1xufVxuXG52YXIgQVNUID0ge1xuICBQcm9ncmFtTm9kZTogZnVuY3Rpb24oc3RhdGVtZW50cywgc3RyaXAsIGxvY0luZm8pIHtcbiAgICBMb2NhdGlvbkluZm8uY2FsbCh0aGlzLCBsb2NJbmZvKTtcbiAgICB0aGlzLnR5cGUgPSBcInByb2dyYW1cIjtcbiAgICB0aGlzLnN0YXRlbWVudHMgPSBzdGF0ZW1lbnRzO1xuICAgIHRoaXMuc3RyaXAgPSBzdHJpcDtcbiAgfSxcblxuICBNdXN0YWNoZU5vZGU6IGZ1bmN0aW9uKHJhd1BhcmFtcywgaGFzaCwgb3Blbiwgc3RyaXAsIGxvY0luZm8pIHtcbiAgICBMb2NhdGlvbkluZm8uY2FsbCh0aGlzLCBsb2NJbmZvKTtcbiAgICB0aGlzLnR5cGUgPSBcIm11c3RhY2hlXCI7XG4gICAgdGhpcy5zdHJpcCA9IHN0cmlwO1xuXG4gICAgLy8gT3BlbiBtYXkgYmUgYSBzdHJpbmcgcGFyc2VkIGZyb20gdGhlIHBhcnNlciBvciBhIHBhc3NlZCBib29sZWFuIGZsYWdcbiAgICBpZiAob3BlbiAhPSBudWxsICYmIG9wZW4uY2hhckF0KSB7XG4gICAgICAvLyBNdXN0IHVzZSBjaGFyQXQgdG8gc3VwcG9ydCBJRSBwcmUtMTBcbiAgICAgIHZhciBlc2NhcGVGbGFnID0gb3Blbi5jaGFyQXQoMykgfHwgb3Blbi5jaGFyQXQoMik7XG4gICAgICB0aGlzLmVzY2FwZWQgPSBlc2NhcGVGbGFnICE9PSAneycgJiYgZXNjYXBlRmxhZyAhPT0gJyYnO1xuICAgIH0gZWxzZSB7XG4gICAgICB0aGlzLmVzY2FwZWQgPSAhIW9wZW47XG4gICAgfVxuXG4gICAgaWYgKHJhd1BhcmFtcyBpbnN0YW5jZW9mIEFTVC5TZXhwck5vZGUpIHtcbiAgICAgIHRoaXMuc2V4cHIgPSByYXdQYXJhbXM7XG4gICAgfSBlbHNlIHtcbiAgICAgIC8vIFN1cHBvcnQgb2xkIEFTVCBBUElcbiAgICAgIHRoaXMuc2V4cHIgPSBuZXcgQVNULlNleHByTm9kZShyYXdQYXJhbXMsIGhhc2gpO1xuICAgIH1cblxuICAgIC8vIFN1cHBvcnQgb2xkIEFTVCBBUEkgdGhhdCBzdG9yZWQgdGhpcyBpbmZvIGluIE11c3RhY2hlTm9kZVxuICAgIHRoaXMuaWQgPSB0aGlzLnNleHByLmlkO1xuICAgIHRoaXMucGFyYW1zID0gdGhpcy5zZXhwci5wYXJhbXM7XG4gICAgdGhpcy5oYXNoID0gdGhpcy5zZXhwci5oYXNoO1xuICAgIHRoaXMuZWxpZ2libGVIZWxwZXIgPSB0aGlzLnNleHByLmVsaWdpYmxlSGVscGVyO1xuICAgIHRoaXMuaXNIZWxwZXIgPSB0aGlzLnNleHByLmlzSGVscGVyO1xuICB9LFxuXG4gIFNleHByTm9kZTogZnVuY3Rpb24ocmF3UGFyYW1zLCBoYXNoLCBsb2NJbmZvKSB7XG4gICAgTG9jYXRpb25JbmZvLmNhbGwodGhpcywgbG9jSW5mbyk7XG5cbiAgICB0aGlzLnR5cGUgPSBcInNleHByXCI7XG4gICAgdGhpcy5oYXNoID0gaGFzaDtcblxuICAgIHZhciBpZCA9IHRoaXMuaWQgPSByYXdQYXJhbXNbMF07XG4gICAgdmFyIHBhcmFtcyA9IHRoaXMucGFyYW1zID0gcmF3UGFyYW1zLnNsaWNlKDEpO1xuXG4gICAgLy8gYSBtdXN0YWNoZSBpcyBkZWZpbml0ZWx5IGEgaGVscGVyIGlmOlxuICAgIC8vICogaXQgaXMgYW4gZWxpZ2libGUgaGVscGVyLCBhbmRcbiAgICAvLyAqIGl0IGhhcyBhdCBsZWFzdCBvbmUgcGFyYW1ldGVyIG9yIGhhc2ggc2VnbWVudFxuICAgIHRoaXMuaXNIZWxwZXIgPSAhIShwYXJhbXMubGVuZ3RoIHx8IGhhc2gpO1xuXG4gICAgLy8gYSBtdXN0YWNoZSBpcyBhbiBlbGlnaWJsZSBoZWxwZXIgaWY6XG4gICAgLy8gKiBpdHMgaWQgaXMgc2ltcGxlIChhIHNpbmdsZSBwYXJ0LCBub3QgYHRoaXNgIG9yIGAuLmApXG4gICAgdGhpcy5lbGlnaWJsZUhlbHBlciA9IHRoaXMuaXNIZWxwZXIgfHwgaWQuaXNTaW1wbGU7XG5cbiAgICAvLyBpZiBhIG11c3RhY2hlIGlzIGFuIGVsaWdpYmxlIGhlbHBlciBidXQgbm90IGEgZGVmaW5pdGVcbiAgICAvLyBoZWxwZXIsIGl0IGlzIGFtYmlndW91cywgYW5kIHdpbGwgYmUgcmVzb2x2ZWQgaW4gYSBsYXRlclxuICAgIC8vIHBhc3Mgb3IgYXQgcnVudGltZS5cbiAgfSxcblxuICBQYXJ0aWFsTm9kZTogZnVuY3Rpb24ocGFydGlhbE5hbWUsIGNvbnRleHQsIGhhc2gsIHN0cmlwLCBsb2NJbmZvKSB7XG4gICAgTG9jYXRpb25JbmZvLmNhbGwodGhpcywgbG9jSW5mbyk7XG4gICAgdGhpcy50eXBlICAgICAgICAgPSBcInBhcnRpYWxcIjtcbiAgICB0aGlzLnBhcnRpYWxOYW1lICA9IHBhcnRpYWxOYW1lO1xuICAgIHRoaXMuY29udGV4dCAgICAgID0gY29udGV4dDtcbiAgICB0aGlzLmhhc2ggPSBoYXNoO1xuICAgIHRoaXMuc3RyaXAgPSBzdHJpcDtcblxuICAgIHRoaXMuc3RyaXAuaW5saW5lU3RhbmRhbG9uZSA9IHRydWU7XG4gIH0sXG5cbiAgQmxvY2tOb2RlOiBmdW5jdGlvbihtdXN0YWNoZSwgcHJvZ3JhbSwgaW52ZXJzZSwgc3RyaXAsIGxvY0luZm8pIHtcbiAgICBMb2NhdGlvbkluZm8uY2FsbCh0aGlzLCBsb2NJbmZvKTtcblxuICAgIHRoaXMudHlwZSA9ICdibG9jayc7XG4gICAgdGhpcy5tdXN0YWNoZSA9IG11c3RhY2hlO1xuICAgIHRoaXMucHJvZ3JhbSAgPSBwcm9ncmFtO1xuICAgIHRoaXMuaW52ZXJzZSAgPSBpbnZlcnNlO1xuICAgIHRoaXMuc3RyaXAgPSBzdHJpcDtcblxuICAgIGlmIChpbnZlcnNlICYmICFwcm9ncmFtKSB7XG4gICAgICB0aGlzLmlzSW52ZXJzZSA9IHRydWU7XG4gICAgfVxuICB9LFxuXG4gIFJhd0Jsb2NrTm9kZTogZnVuY3Rpb24obXVzdGFjaGUsIGNvbnRlbnQsIGNsb3NlLCBsb2NJbmZvKSB7XG4gICAgTG9jYXRpb25JbmZvLmNhbGwodGhpcywgbG9jSW5mbyk7XG5cbiAgICBpZiAobXVzdGFjaGUuc2V4cHIuaWQub3JpZ2luYWwgIT09IGNsb3NlKSB7XG4gICAgICB0aHJvdyBuZXcgRXhjZXB0aW9uKG11c3RhY2hlLnNleHByLmlkLm9yaWdpbmFsICsgXCIgZG9lc24ndCBtYXRjaCBcIiArIGNsb3NlLCB0aGlzKTtcbiAgICB9XG5cbiAgICBjb250ZW50ID0gbmV3IEFTVC5Db250ZW50Tm9kZShjb250ZW50LCBsb2NJbmZvKTtcblxuICAgIHRoaXMudHlwZSA9ICdibG9jayc7XG4gICAgdGhpcy5tdXN0YWNoZSA9IG11c3RhY2hlO1xuICAgIHRoaXMucHJvZ3JhbSA9IG5ldyBBU1QuUHJvZ3JhbU5vZGUoW2NvbnRlbnRdLCB7fSwgbG9jSW5mbyk7XG4gIH0sXG5cbiAgQ29udGVudE5vZGU6IGZ1bmN0aW9uKHN0cmluZywgbG9jSW5mbykge1xuICAgIExvY2F0aW9uSW5mby5jYWxsKHRoaXMsIGxvY0luZm8pO1xuICAgIHRoaXMudHlwZSA9IFwiY29udGVudFwiO1xuICAgIHRoaXMub3JpZ2luYWwgPSB0aGlzLnN0cmluZyA9IHN0cmluZztcbiAgfSxcblxuICBIYXNoTm9kZTogZnVuY3Rpb24ocGFpcnMsIGxvY0luZm8pIHtcbiAgICBMb2NhdGlvbkluZm8uY2FsbCh0aGlzLCBsb2NJbmZvKTtcbiAgICB0aGlzLnR5cGUgPSBcImhhc2hcIjtcbiAgICB0aGlzLnBhaXJzID0gcGFpcnM7XG4gIH0sXG5cbiAgSWROb2RlOiBmdW5jdGlvbihwYXJ0cywgbG9jSW5mbykge1xuICAgIExvY2F0aW9uSW5mby5jYWxsKHRoaXMsIGxvY0luZm8pO1xuICAgIHRoaXMudHlwZSA9IFwiSURcIjtcblxuICAgIHZhciBvcmlnaW5hbCA9IFwiXCIsXG4gICAgICAgIGRpZyA9IFtdLFxuICAgICAgICBkZXB0aCA9IDAsXG4gICAgICAgIGRlcHRoU3RyaW5nID0gJyc7XG5cbiAgICBmb3IodmFyIGk9MCxsPXBhcnRzLmxlbmd0aDsgaTxsOyBpKyspIHtcbiAgICAgIHZhciBwYXJ0ID0gcGFydHNbaV0ucGFydDtcbiAgICAgIG9yaWdpbmFsICs9IChwYXJ0c1tpXS5zZXBhcmF0b3IgfHwgJycpICsgcGFydDtcblxuICAgICAgaWYgKHBhcnQgPT09IFwiLi5cIiB8fCBwYXJ0ID09PSBcIi5cIiB8fCBwYXJ0ID09PSBcInRoaXNcIikge1xuICAgICAgICBpZiAoZGlnLmxlbmd0aCA+IDApIHtcbiAgICAgICAgICB0aHJvdyBuZXcgRXhjZXB0aW9uKFwiSW52YWxpZCBwYXRoOiBcIiArIG9yaWdpbmFsLCB0aGlzKTtcbiAgICAgICAgfSBlbHNlIGlmIChwYXJ0ID09PSBcIi4uXCIpIHtcbiAgICAgICAgICBkZXB0aCsrO1xuICAgICAgICAgIGRlcHRoU3RyaW5nICs9ICcuLi8nO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIHRoaXMuaXNTY29wZWQgPSB0cnVlO1xuICAgICAgICB9XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBkaWcucHVzaChwYXJ0KTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICB0aGlzLm9yaWdpbmFsID0gb3JpZ2luYWw7XG4gICAgdGhpcy5wYXJ0cyAgICA9IGRpZztcbiAgICB0aGlzLnN0cmluZyAgID0gZGlnLmpvaW4oJy4nKTtcbiAgICB0aGlzLmRlcHRoICAgID0gZGVwdGg7XG4gICAgdGhpcy5pZE5hbWUgICA9IGRlcHRoU3RyaW5nICsgdGhpcy5zdHJpbmc7XG5cbiAgICAvLyBhbiBJRCBpcyBzaW1wbGUgaWYgaXQgb25seSBoYXMgb25lIHBhcnQsIGFuZCB0aGF0IHBhcnQgaXMgbm90XG4gICAgLy8gYC4uYCBvciBgdGhpc2AuXG4gICAgdGhpcy5pc1NpbXBsZSA9IHBhcnRzLmxlbmd0aCA9PT0gMSAmJiAhdGhpcy5pc1Njb3BlZCAmJiBkZXB0aCA9PT0gMDtcblxuICAgIHRoaXMuc3RyaW5nTW9kZVZhbHVlID0gdGhpcy5zdHJpbmc7XG4gIH0sXG5cbiAgUGFydGlhbE5hbWVOb2RlOiBmdW5jdGlvbihuYW1lLCBsb2NJbmZvKSB7XG4gICAgTG9jYXRpb25JbmZvLmNhbGwodGhpcywgbG9jSW5mbyk7XG4gICAgdGhpcy50eXBlID0gXCJQQVJUSUFMX05BTUVcIjtcbiAgICB0aGlzLm5hbWUgPSBuYW1lLm9yaWdpbmFsO1xuICB9LFxuXG4gIERhdGFOb2RlOiBmdW5jdGlvbihpZCwgbG9jSW5mbykge1xuICAgIExvY2F0aW9uSW5mby5jYWxsKHRoaXMsIGxvY0luZm8pO1xuICAgIHRoaXMudHlwZSA9IFwiREFUQVwiO1xuICAgIHRoaXMuaWQgPSBpZDtcbiAgICB0aGlzLnN0cmluZ01vZGVWYWx1ZSA9IGlkLnN0cmluZ01vZGVWYWx1ZTtcbiAgICB0aGlzLmlkTmFtZSA9ICdAJyArIGlkLnN0cmluZ01vZGVWYWx1ZTtcbiAgfSxcblxuICBTdHJpbmdOb2RlOiBmdW5jdGlvbihzdHJpbmcsIGxvY0luZm8pIHtcbiAgICBMb2NhdGlvbkluZm8uY2FsbCh0aGlzLCBsb2NJbmZvKTtcbiAgICB0aGlzLnR5cGUgPSBcIlNUUklOR1wiO1xuICAgIHRoaXMub3JpZ2luYWwgPVxuICAgICAgdGhpcy5zdHJpbmcgPVxuICAgICAgdGhpcy5zdHJpbmdNb2RlVmFsdWUgPSBzdHJpbmc7XG4gIH0sXG5cbiAgTnVtYmVyTm9kZTogZnVuY3Rpb24obnVtYmVyLCBsb2NJbmZvKSB7XG4gICAgTG9jYXRpb25JbmZvLmNhbGwodGhpcywgbG9jSW5mbyk7XG4gICAgdGhpcy50eXBlID0gXCJOVU1CRVJcIjtcbiAgICB0aGlzLm9yaWdpbmFsID1cbiAgICAgIHRoaXMubnVtYmVyID0gbnVtYmVyO1xuICAgIHRoaXMuc3RyaW5nTW9kZVZhbHVlID0gTnVtYmVyKG51bWJlcik7XG4gIH0sXG5cbiAgQm9vbGVhbk5vZGU6IGZ1bmN0aW9uKGJvb2wsIGxvY0luZm8pIHtcbiAgICBMb2NhdGlvbkluZm8uY2FsbCh0aGlzLCBsb2NJbmZvKTtcbiAgICB0aGlzLnR5cGUgPSBcIkJPT0xFQU5cIjtcbiAgICB0aGlzLmJvb2wgPSBib29sO1xuICAgIHRoaXMuc3RyaW5nTW9kZVZhbHVlID0gYm9vbCA9PT0gXCJ0cnVlXCI7XG4gIH0sXG5cbiAgQ29tbWVudE5vZGU6IGZ1bmN0aW9uKGNvbW1lbnQsIGxvY0luZm8pIHtcbiAgICBMb2NhdGlvbkluZm8uY2FsbCh0aGlzLCBsb2NJbmZvKTtcbiAgICB0aGlzLnR5cGUgPSBcImNvbW1lbnRcIjtcbiAgICB0aGlzLmNvbW1lbnQgPSBjb21tZW50O1xuXG4gICAgdGhpcy5zdHJpcCA9IHtcbiAgICAgIGlubGluZVN0YW5kYWxvbmU6IHRydWVcbiAgICB9O1xuICB9XG59O1xuXG5cbi8vIE11c3QgYmUgZXhwb3J0ZWQgYXMgYW4gb2JqZWN0IHJhdGhlciB0aGFuIHRoZSByb290IG9mIHRoZSBtb2R1bGUgYXMgdGhlIGppc29uIGxleGVyXG4vLyBtb3N0IG1vZGlmeSB0aGUgb2JqZWN0IHRvIG9wZXJhdGUgcHJvcGVybHkuXG5leHBvcnRzW1wiZGVmYXVsdFwiXSA9IEFTVDsiLCJcInVzZSBzdHJpY3RcIjtcbnZhciBwYXJzZXIgPSByZXF1aXJlKFwiLi9wYXJzZXJcIilbXCJkZWZhdWx0XCJdO1xudmFyIEFTVCA9IHJlcXVpcmUoXCIuL2FzdFwiKVtcImRlZmF1bHRcIl07XG52YXIgSGVscGVycyA9IHJlcXVpcmUoXCIuL2hlbHBlcnNcIik7XG52YXIgZXh0ZW5kID0gcmVxdWlyZShcIi4uL3V0aWxzXCIpLmV4dGVuZDtcblxuZXhwb3J0cy5wYXJzZXIgPSBwYXJzZXI7XG5cbnZhciB5eSA9IHt9O1xuZXh0ZW5kKHl5LCBIZWxwZXJzLCBBU1QpO1xuXG5mdW5jdGlvbiBwYXJzZShpbnB1dCkge1xuICAvLyBKdXN0IHJldHVybiBpZiBhbiBhbHJlYWR5LWNvbXBpbGUgQVNUIHdhcyBwYXNzZWQgaW4uXG4gIGlmIChpbnB1dC5jb25zdHJ1Y3RvciA9PT0gQVNULlByb2dyYW1Ob2RlKSB7IHJldHVybiBpbnB1dDsgfVxuXG4gIHBhcnNlci55eSA9IHl5O1xuXG4gIHJldHVybiBwYXJzZXIucGFyc2UoaW5wdXQpO1xufVxuXG5leHBvcnRzLnBhcnNlID0gcGFyc2U7IiwiXCJ1c2Ugc3RyaWN0XCI7XG52YXIgRXhjZXB0aW9uID0gcmVxdWlyZShcIi4uL2V4Y2VwdGlvblwiKVtcImRlZmF1bHRcIl07XG52YXIgaXNBcnJheSA9IHJlcXVpcmUoXCIuLi91dGlsc1wiKS5pc0FycmF5O1xuXG52YXIgc2xpY2UgPSBbXS5zbGljZTtcblxuZnVuY3Rpb24gQ29tcGlsZXIoKSB7fVxuXG5leHBvcnRzLkNvbXBpbGVyID0gQ29tcGlsZXI7Ly8gdGhlIGZvdW5kSGVscGVyIHJlZ2lzdGVyIHdpbGwgZGlzYW1iaWd1YXRlIGhlbHBlciBsb29rdXAgZnJvbSBmaW5kaW5nIGFcbi8vIGZ1bmN0aW9uIGluIGEgY29udGV4dC4gVGhpcyBpcyBuZWNlc3NhcnkgZm9yIG11c3RhY2hlIGNvbXBhdGliaWxpdHksIHdoaWNoXG4vLyByZXF1aXJlcyB0aGF0IGNvbnRleHQgZnVuY3Rpb25zIGluIGJsb2NrcyBhcmUgZXZhbHVhdGVkIGJ5IGJsb2NrSGVscGVyTWlzc2luZyxcbi8vIGFuZCB0aGVuIHByb2NlZWQgYXMgaWYgdGhlIHJlc3VsdGluZyB2YWx1ZSB3YXMgcHJvdmlkZWQgdG8gYmxvY2tIZWxwZXJNaXNzaW5nLlxuXG5Db21waWxlci5wcm90b3R5cGUgPSB7XG4gIGNvbXBpbGVyOiBDb21waWxlcixcblxuICBlcXVhbHM6IGZ1bmN0aW9uKG90aGVyKSB7XG4gICAgdmFyIGxlbiA9IHRoaXMub3Bjb2Rlcy5sZW5ndGg7XG4gICAgaWYgKG90aGVyLm9wY29kZXMubGVuZ3RoICE9PSBsZW4pIHtcbiAgICAgIHJldHVybiBmYWxzZTtcbiAgICB9XG5cbiAgICBmb3IgKHZhciBpID0gMDsgaSA8IGxlbjsgaSsrKSB7XG4gICAgICB2YXIgb3Bjb2RlID0gdGhpcy5vcGNvZGVzW2ldLFxuICAgICAgICAgIG90aGVyT3Bjb2RlID0gb3RoZXIub3Bjb2Rlc1tpXTtcbiAgICAgIGlmIChvcGNvZGUub3Bjb2RlICE9PSBvdGhlck9wY29kZS5vcGNvZGUgfHwgIWFyZ0VxdWFscyhvcGNvZGUuYXJncywgb3RoZXJPcGNvZGUuYXJncykpIHtcbiAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgfVxuICAgIH1cblxuICAgIC8vIFdlIGtub3cgdGhhdCBsZW5ndGggaXMgdGhlIHNhbWUgYmV0d2VlbiB0aGUgdHdvIGFycmF5cyBiZWNhdXNlIHRoZXkgYXJlIGRpcmVjdGx5IHRpZWRcbiAgICAvLyB0byB0aGUgb3Bjb2RlIGJlaGF2aW9yIGFib3ZlLlxuICAgIGxlbiA9IHRoaXMuY2hpbGRyZW4ubGVuZ3RoO1xuICAgIGZvciAoaSA9IDA7IGkgPCBsZW47IGkrKykge1xuICAgICAgaWYgKCF0aGlzLmNoaWxkcmVuW2ldLmVxdWFscyhvdGhlci5jaGlsZHJlbltpXSkpIHtcbiAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgfVxuICAgIH1cblxuICAgIHJldHVybiB0cnVlO1xuICB9LFxuXG4gIGd1aWQ6IDAsXG5cbiAgY29tcGlsZTogZnVuY3Rpb24ocHJvZ3JhbSwgb3B0aW9ucykge1xuICAgIHRoaXMub3Bjb2RlcyA9IFtdO1xuICAgIHRoaXMuY2hpbGRyZW4gPSBbXTtcbiAgICB0aGlzLmRlcHRocyA9IHtsaXN0OiBbXX07XG4gICAgdGhpcy5vcHRpb25zID0gb3B0aW9ucztcbiAgICB0aGlzLnN0cmluZ1BhcmFtcyA9IG9wdGlvbnMuc3RyaW5nUGFyYW1zO1xuICAgIHRoaXMudHJhY2tJZHMgPSBvcHRpb25zLnRyYWNrSWRzO1xuXG4gICAgLy8gVGhlc2UgY2hhbmdlcyB3aWxsIHByb3BhZ2F0ZSB0byB0aGUgb3RoZXIgY29tcGlsZXIgY29tcG9uZW50c1xuICAgIHZhciBrbm93bkhlbHBlcnMgPSB0aGlzLm9wdGlvbnMua25vd25IZWxwZXJzO1xuICAgIHRoaXMub3B0aW9ucy5rbm93bkhlbHBlcnMgPSB7XG4gICAgICAnaGVscGVyTWlzc2luZyc6IHRydWUsXG4gICAgICAnYmxvY2tIZWxwZXJNaXNzaW5nJzogdHJ1ZSxcbiAgICAgICdlYWNoJzogdHJ1ZSxcbiAgICAgICdpZic6IHRydWUsXG4gICAgICAndW5sZXNzJzogdHJ1ZSxcbiAgICAgICd3aXRoJzogdHJ1ZSxcbiAgICAgICdsb2cnOiB0cnVlLFxuICAgICAgJ2xvb2t1cCc6IHRydWVcbiAgICB9O1xuICAgIGlmIChrbm93bkhlbHBlcnMpIHtcbiAgICAgIGZvciAodmFyIG5hbWUgaW4ga25vd25IZWxwZXJzKSB7XG4gICAgICAgIHRoaXMub3B0aW9ucy5rbm93bkhlbHBlcnNbbmFtZV0gPSBrbm93bkhlbHBlcnNbbmFtZV07XG4gICAgICB9XG4gICAgfVxuXG4gICAgcmV0dXJuIHRoaXMuYWNjZXB0KHByb2dyYW0pO1xuICB9LFxuXG4gIGFjY2VwdDogZnVuY3Rpb24obm9kZSkge1xuICAgIHJldHVybiB0aGlzW25vZGUudHlwZV0obm9kZSk7XG4gIH0sXG5cbiAgcHJvZ3JhbTogZnVuY3Rpb24ocHJvZ3JhbSkge1xuICAgIHZhciBzdGF0ZW1lbnRzID0gcHJvZ3JhbS5zdGF0ZW1lbnRzO1xuXG4gICAgZm9yKHZhciBpPTAsIGw9c3RhdGVtZW50cy5sZW5ndGg7IGk8bDsgaSsrKSB7XG4gICAgICB0aGlzLmFjY2VwdChzdGF0ZW1lbnRzW2ldKTtcbiAgICB9XG4gICAgdGhpcy5pc1NpbXBsZSA9IGwgPT09IDE7XG5cbiAgICB0aGlzLmRlcHRocy5saXN0ID0gdGhpcy5kZXB0aHMubGlzdC5zb3J0KGZ1bmN0aW9uKGEsIGIpIHtcbiAgICAgIHJldHVybiBhIC0gYjtcbiAgICB9KTtcblxuICAgIHJldHVybiB0aGlzO1xuICB9LFxuXG4gIGNvbXBpbGVQcm9ncmFtOiBmdW5jdGlvbihwcm9ncmFtKSB7XG4gICAgdmFyIHJlc3VsdCA9IG5ldyB0aGlzLmNvbXBpbGVyKCkuY29tcGlsZShwcm9ncmFtLCB0aGlzLm9wdGlvbnMpO1xuICAgIHZhciBndWlkID0gdGhpcy5ndWlkKyssIGRlcHRoO1xuXG4gICAgdGhpcy51c2VQYXJ0aWFsID0gdGhpcy51c2VQYXJ0aWFsIHx8IHJlc3VsdC51c2VQYXJ0aWFsO1xuXG4gICAgdGhpcy5jaGlsZHJlbltndWlkXSA9IHJlc3VsdDtcblxuICAgIGZvcih2YXIgaT0wLCBsPXJlc3VsdC5kZXB0aHMubGlzdC5sZW5ndGg7IGk8bDsgaSsrKSB7XG4gICAgICBkZXB0aCA9IHJlc3VsdC5kZXB0aHMubGlzdFtpXTtcblxuICAgICAgaWYoZGVwdGggPCAyKSB7IGNvbnRpbnVlOyB9XG4gICAgICBlbHNlIHsgdGhpcy5hZGREZXB0aChkZXB0aCAtIDEpOyB9XG4gICAgfVxuXG4gICAgcmV0dXJuIGd1aWQ7XG4gIH0sXG5cbiAgYmxvY2s6IGZ1bmN0aW9uKGJsb2NrKSB7XG4gICAgdmFyIG11c3RhY2hlID0gYmxvY2subXVzdGFjaGUsXG4gICAgICAgIHByb2dyYW0gPSBibG9jay5wcm9ncmFtLFxuICAgICAgICBpbnZlcnNlID0gYmxvY2suaW52ZXJzZTtcblxuICAgIGlmIChwcm9ncmFtKSB7XG4gICAgICBwcm9ncmFtID0gdGhpcy5jb21waWxlUHJvZ3JhbShwcm9ncmFtKTtcbiAgICB9XG5cbiAgICBpZiAoaW52ZXJzZSkge1xuICAgICAgaW52ZXJzZSA9IHRoaXMuY29tcGlsZVByb2dyYW0oaW52ZXJzZSk7XG4gICAgfVxuXG4gICAgdmFyIHNleHByID0gbXVzdGFjaGUuc2V4cHI7XG4gICAgdmFyIHR5cGUgPSB0aGlzLmNsYXNzaWZ5U2V4cHIoc2V4cHIpO1xuXG4gICAgaWYgKHR5cGUgPT09IFwiaGVscGVyXCIpIHtcbiAgICAgIHRoaXMuaGVscGVyU2V4cHIoc2V4cHIsIHByb2dyYW0sIGludmVyc2UpO1xuICAgIH0gZWxzZSBpZiAodHlwZSA9PT0gXCJzaW1wbGVcIikge1xuICAgICAgdGhpcy5zaW1wbGVTZXhwcihzZXhwcik7XG5cbiAgICAgIC8vIG5vdyB0aGF0IHRoZSBzaW1wbGUgbXVzdGFjaGUgaXMgcmVzb2x2ZWQsIHdlIG5lZWQgdG9cbiAgICAgIC8vIGV2YWx1YXRlIGl0IGJ5IGV4ZWN1dGluZyBgYmxvY2tIZWxwZXJNaXNzaW5nYFxuICAgICAgdGhpcy5vcGNvZGUoJ3B1c2hQcm9ncmFtJywgcHJvZ3JhbSk7XG4gICAgICB0aGlzLm9wY29kZSgncHVzaFByb2dyYW0nLCBpbnZlcnNlKTtcbiAgICAgIHRoaXMub3Bjb2RlKCdlbXB0eUhhc2gnKTtcbiAgICAgIHRoaXMub3Bjb2RlKCdibG9ja1ZhbHVlJywgc2V4cHIuaWQub3JpZ2luYWwpO1xuICAgIH0gZWxzZSB7XG4gICAgICB0aGlzLmFtYmlndW91c1NleHByKHNleHByLCBwcm9ncmFtLCBpbnZlcnNlKTtcblxuICAgICAgLy8gbm93IHRoYXQgdGhlIHNpbXBsZSBtdXN0YWNoZSBpcyByZXNvbHZlZCwgd2UgbmVlZCB0b1xuICAgICAgLy8gZXZhbHVhdGUgaXQgYnkgZXhlY3V0aW5nIGBibG9ja0hlbHBlck1pc3NpbmdgXG4gICAgICB0aGlzLm9wY29kZSgncHVzaFByb2dyYW0nLCBwcm9ncmFtKTtcbiAgICAgIHRoaXMub3Bjb2RlKCdwdXNoUHJvZ3JhbScsIGludmVyc2UpO1xuICAgICAgdGhpcy5vcGNvZGUoJ2VtcHR5SGFzaCcpO1xuICAgICAgdGhpcy5vcGNvZGUoJ2FtYmlndW91c0Jsb2NrVmFsdWUnKTtcbiAgICB9XG5cbiAgICB0aGlzLm9wY29kZSgnYXBwZW5kJyk7XG4gIH0sXG5cbiAgaGFzaDogZnVuY3Rpb24oaGFzaCkge1xuICAgIHZhciBwYWlycyA9IGhhc2gucGFpcnMsIGksIGw7XG5cbiAgICB0aGlzLm9wY29kZSgncHVzaEhhc2gnKTtcblxuICAgIGZvcihpPTAsIGw9cGFpcnMubGVuZ3RoOyBpPGw7IGkrKykge1xuICAgICAgdGhpcy5wdXNoUGFyYW0ocGFpcnNbaV1bMV0pO1xuICAgIH1cbiAgICB3aGlsZShpLS0pIHtcbiAgICAgIHRoaXMub3Bjb2RlKCdhc3NpZ25Ub0hhc2gnLCBwYWlyc1tpXVswXSk7XG4gICAgfVxuICAgIHRoaXMub3Bjb2RlKCdwb3BIYXNoJyk7XG4gIH0sXG5cbiAgcGFydGlhbDogZnVuY3Rpb24ocGFydGlhbCkge1xuICAgIHZhciBwYXJ0aWFsTmFtZSA9IHBhcnRpYWwucGFydGlhbE5hbWU7XG4gICAgdGhpcy51c2VQYXJ0aWFsID0gdHJ1ZTtcblxuICAgIGlmIChwYXJ0aWFsLmhhc2gpIHtcbiAgICAgIHRoaXMuYWNjZXB0KHBhcnRpYWwuaGFzaCk7XG4gICAgfSBlbHNlIHtcbiAgICAgIHRoaXMub3Bjb2RlKCdwdXNoJywgJ3VuZGVmaW5lZCcpO1xuICAgIH1cblxuICAgIGlmIChwYXJ0aWFsLmNvbnRleHQpIHtcbiAgICAgIHRoaXMuYWNjZXB0KHBhcnRpYWwuY29udGV4dCk7XG4gICAgfSBlbHNlIHtcbiAgICAgIHRoaXMub3Bjb2RlKCdnZXRDb250ZXh0JywgMCk7XG4gICAgICB0aGlzLm9wY29kZSgncHVzaENvbnRleHQnKTtcbiAgICB9XG5cbiAgICB0aGlzLm9wY29kZSgnaW52b2tlUGFydGlhbCcsIHBhcnRpYWxOYW1lLm5hbWUsIHBhcnRpYWwuaW5kZW50IHx8ICcnKTtcbiAgICB0aGlzLm9wY29kZSgnYXBwZW5kJyk7XG4gIH0sXG5cbiAgY29udGVudDogZnVuY3Rpb24oY29udGVudCkge1xuICAgIGlmIChjb250ZW50LnN0cmluZykge1xuICAgICAgdGhpcy5vcGNvZGUoJ2FwcGVuZENvbnRlbnQnLCBjb250ZW50LnN0cmluZyk7XG4gICAgfVxuICB9LFxuXG4gIG11c3RhY2hlOiBmdW5jdGlvbihtdXN0YWNoZSkge1xuICAgIHRoaXMuc2V4cHIobXVzdGFjaGUuc2V4cHIpO1xuXG4gICAgaWYobXVzdGFjaGUuZXNjYXBlZCAmJiAhdGhpcy5vcHRpb25zLm5vRXNjYXBlKSB7XG4gICAgICB0aGlzLm9wY29kZSgnYXBwZW5kRXNjYXBlZCcpO1xuICAgIH0gZWxzZSB7XG4gICAgICB0aGlzLm9wY29kZSgnYXBwZW5kJyk7XG4gICAgfVxuICB9LFxuXG4gIGFtYmlndW91c1NleHByOiBmdW5jdGlvbihzZXhwciwgcHJvZ3JhbSwgaW52ZXJzZSkge1xuICAgIHZhciBpZCA9IHNleHByLmlkLFxuICAgICAgICBuYW1lID0gaWQucGFydHNbMF0sXG4gICAgICAgIGlzQmxvY2sgPSBwcm9ncmFtICE9IG51bGwgfHwgaW52ZXJzZSAhPSBudWxsO1xuXG4gICAgdGhpcy5vcGNvZGUoJ2dldENvbnRleHQnLCBpZC5kZXB0aCk7XG5cbiAgICB0aGlzLm9wY29kZSgncHVzaFByb2dyYW0nLCBwcm9ncmFtKTtcbiAgICB0aGlzLm9wY29kZSgncHVzaFByb2dyYW0nLCBpbnZlcnNlKTtcblxuICAgIHRoaXMuSUQoaWQpO1xuXG4gICAgdGhpcy5vcGNvZGUoJ2ludm9rZUFtYmlndW91cycsIG5hbWUsIGlzQmxvY2spO1xuICB9LFxuXG4gIHNpbXBsZVNleHByOiBmdW5jdGlvbihzZXhwcikge1xuICAgIHZhciBpZCA9IHNleHByLmlkO1xuXG4gICAgaWYgKGlkLnR5cGUgPT09ICdEQVRBJykge1xuICAgICAgdGhpcy5EQVRBKGlkKTtcbiAgICB9IGVsc2UgaWYgKGlkLnBhcnRzLmxlbmd0aCkge1xuICAgICAgdGhpcy5JRChpZCk7XG4gICAgfSBlbHNlIHtcbiAgICAgIC8vIFNpbXBsaWZpZWQgSUQgZm9yIGB0aGlzYFxuICAgICAgdGhpcy5hZGREZXB0aChpZC5kZXB0aCk7XG4gICAgICB0aGlzLm9wY29kZSgnZ2V0Q29udGV4dCcsIGlkLmRlcHRoKTtcbiAgICAgIHRoaXMub3Bjb2RlKCdwdXNoQ29udGV4dCcpO1xuICAgIH1cblxuICAgIHRoaXMub3Bjb2RlKCdyZXNvbHZlUG9zc2libGVMYW1iZGEnKTtcbiAgfSxcblxuICBoZWxwZXJTZXhwcjogZnVuY3Rpb24oc2V4cHIsIHByb2dyYW0sIGludmVyc2UpIHtcbiAgICB2YXIgcGFyYW1zID0gdGhpcy5zZXR1cEZ1bGxNdXN0YWNoZVBhcmFtcyhzZXhwciwgcHJvZ3JhbSwgaW52ZXJzZSksXG4gICAgICAgIGlkID0gc2V4cHIuaWQsXG4gICAgICAgIG5hbWUgPSBpZC5wYXJ0c1swXTtcblxuICAgIGlmICh0aGlzLm9wdGlvbnMua25vd25IZWxwZXJzW25hbWVdKSB7XG4gICAgICB0aGlzLm9wY29kZSgnaW52b2tlS25vd25IZWxwZXInLCBwYXJhbXMubGVuZ3RoLCBuYW1lKTtcbiAgICB9IGVsc2UgaWYgKHRoaXMub3B0aW9ucy5rbm93bkhlbHBlcnNPbmx5KSB7XG4gICAgICB0aHJvdyBuZXcgRXhjZXB0aW9uKFwiWW91IHNwZWNpZmllZCBrbm93bkhlbHBlcnNPbmx5LCBidXQgdXNlZCB0aGUgdW5rbm93biBoZWxwZXIgXCIgKyBuYW1lLCBzZXhwcik7XG4gICAgfSBlbHNlIHtcbiAgICAgIGlkLmZhbHN5ID0gdHJ1ZTtcblxuICAgICAgdGhpcy5JRChpZCk7XG4gICAgICB0aGlzLm9wY29kZSgnaW52b2tlSGVscGVyJywgcGFyYW1zLmxlbmd0aCwgaWQub3JpZ2luYWwsIGlkLmlzU2ltcGxlKTtcbiAgICB9XG4gIH0sXG5cbiAgc2V4cHI6IGZ1bmN0aW9uKHNleHByKSB7XG4gICAgdmFyIHR5cGUgPSB0aGlzLmNsYXNzaWZ5U2V4cHIoc2V4cHIpO1xuXG4gICAgaWYgKHR5cGUgPT09IFwic2ltcGxlXCIpIHtcbiAgICAgIHRoaXMuc2ltcGxlU2V4cHIoc2V4cHIpO1xuICAgIH0gZWxzZSBpZiAodHlwZSA9PT0gXCJoZWxwZXJcIikge1xuICAgICAgdGhpcy5oZWxwZXJTZXhwcihzZXhwcik7XG4gICAgfSBlbHNlIHtcbiAgICAgIHRoaXMuYW1iaWd1b3VzU2V4cHIoc2V4cHIpO1xuICAgIH1cbiAgfSxcblxuICBJRDogZnVuY3Rpb24oaWQpIHtcbiAgICB0aGlzLmFkZERlcHRoKGlkLmRlcHRoKTtcbiAgICB0aGlzLm9wY29kZSgnZ2V0Q29udGV4dCcsIGlkLmRlcHRoKTtcblxuICAgIHZhciBuYW1lID0gaWQucGFydHNbMF07XG4gICAgaWYgKCFuYW1lKSB7XG4gICAgICAvLyBDb250ZXh0IHJlZmVyZW5jZSwgaS5lLiBge3tmb28gLn19YCBvciBge3tmb28gLi59fWBcbiAgICAgIHRoaXMub3Bjb2RlKCdwdXNoQ29udGV4dCcpO1xuICAgIH0gZWxzZSB7XG4gICAgICB0aGlzLm9wY29kZSgnbG9va3VwT25Db250ZXh0JywgaWQucGFydHMsIGlkLmZhbHN5LCBpZC5pc1Njb3BlZCk7XG4gICAgfVxuICB9LFxuXG4gIERBVEE6IGZ1bmN0aW9uKGRhdGEpIHtcbiAgICB0aGlzLm9wdGlvbnMuZGF0YSA9IHRydWU7XG4gICAgdGhpcy5vcGNvZGUoJ2xvb2t1cERhdGEnLCBkYXRhLmlkLmRlcHRoLCBkYXRhLmlkLnBhcnRzKTtcbiAgfSxcblxuICBTVFJJTkc6IGZ1bmN0aW9uKHN0cmluZykge1xuICAgIHRoaXMub3Bjb2RlKCdwdXNoU3RyaW5nJywgc3RyaW5nLnN0cmluZyk7XG4gIH0sXG5cbiAgTlVNQkVSOiBmdW5jdGlvbihudW1iZXIpIHtcbiAgICB0aGlzLm9wY29kZSgncHVzaExpdGVyYWwnLCBudW1iZXIubnVtYmVyKTtcbiAgfSxcblxuICBCT09MRUFOOiBmdW5jdGlvbihib29sKSB7XG4gICAgdGhpcy5vcGNvZGUoJ3B1c2hMaXRlcmFsJywgYm9vbC5ib29sKTtcbiAgfSxcblxuICBjb21tZW50OiBmdW5jdGlvbigpIHt9LFxuXG4gIC8vIEhFTFBFUlNcbiAgb3Bjb2RlOiBmdW5jdGlvbihuYW1lKSB7XG4gICAgdGhpcy5vcGNvZGVzLnB1c2goeyBvcGNvZGU6IG5hbWUsIGFyZ3M6IHNsaWNlLmNhbGwoYXJndW1lbnRzLCAxKSB9KTtcbiAgfSxcblxuICBhZGREZXB0aDogZnVuY3Rpb24oZGVwdGgpIHtcbiAgICBpZihkZXB0aCA9PT0gMCkgeyByZXR1cm47IH1cblxuICAgIGlmKCF0aGlzLmRlcHRoc1tkZXB0aF0pIHtcbiAgICAgIHRoaXMuZGVwdGhzW2RlcHRoXSA9IHRydWU7XG4gICAgICB0aGlzLmRlcHRocy5saXN0LnB1c2goZGVwdGgpO1xuICAgIH1cbiAgfSxcblxuICBjbGFzc2lmeVNleHByOiBmdW5jdGlvbihzZXhwcikge1xuICAgIHZhciBpc0hlbHBlciAgID0gc2V4cHIuaXNIZWxwZXI7XG4gICAgdmFyIGlzRWxpZ2libGUgPSBzZXhwci5lbGlnaWJsZUhlbHBlcjtcbiAgICB2YXIgb3B0aW9ucyAgICA9IHRoaXMub3B0aW9ucztcblxuICAgIC8vIGlmIGFtYmlndW91cywgd2UgY2FuIHBvc3NpYmx5IHJlc29sdmUgdGhlIGFtYmlndWl0eSBub3dcbiAgICAvLyBBbiBlbGlnaWJsZSBoZWxwZXIgaXMgb25lIHRoYXQgZG9lcyBub3QgaGF2ZSBhIGNvbXBsZXggcGF0aCwgaS5lLiBgdGhpcy5mb29gLCBgLi4vZm9vYCBldGMuXG4gICAgaWYgKGlzRWxpZ2libGUgJiYgIWlzSGVscGVyKSB7XG4gICAgICB2YXIgbmFtZSA9IHNleHByLmlkLnBhcnRzWzBdO1xuXG4gICAgICBpZiAob3B0aW9ucy5rbm93bkhlbHBlcnNbbmFtZV0pIHtcbiAgICAgICAgaXNIZWxwZXIgPSB0cnVlO1xuICAgICAgfSBlbHNlIGlmIChvcHRpb25zLmtub3duSGVscGVyc09ubHkpIHtcbiAgICAgICAgaXNFbGlnaWJsZSA9IGZhbHNlO1xuICAgICAgfVxuICAgIH1cblxuICAgIGlmIChpc0hlbHBlcikgeyByZXR1cm4gXCJoZWxwZXJcIjsgfVxuICAgIGVsc2UgaWYgKGlzRWxpZ2libGUpIHsgcmV0dXJuIFwiYW1iaWd1b3VzXCI7IH1cbiAgICBlbHNlIHsgcmV0dXJuIFwic2ltcGxlXCI7IH1cbiAgfSxcblxuICBwdXNoUGFyYW1zOiBmdW5jdGlvbihwYXJhbXMpIHtcbiAgICBmb3IodmFyIGk9MCwgbD1wYXJhbXMubGVuZ3RoOyBpPGw7IGkrKykge1xuICAgICAgdGhpcy5wdXNoUGFyYW0ocGFyYW1zW2ldKTtcbiAgICB9XG4gIH0sXG5cbiAgcHVzaFBhcmFtOiBmdW5jdGlvbih2YWwpIHtcbiAgICBpZiAodGhpcy5zdHJpbmdQYXJhbXMpIHtcbiAgICAgIGlmKHZhbC5kZXB0aCkge1xuICAgICAgICB0aGlzLmFkZERlcHRoKHZhbC5kZXB0aCk7XG4gICAgICB9XG4gICAgICB0aGlzLm9wY29kZSgnZ2V0Q29udGV4dCcsIHZhbC5kZXB0aCB8fCAwKTtcbiAgICAgIHRoaXMub3Bjb2RlKCdwdXNoU3RyaW5nUGFyYW0nLCB2YWwuc3RyaW5nTW9kZVZhbHVlLCB2YWwudHlwZSk7XG5cbiAgICAgIGlmICh2YWwudHlwZSA9PT0gJ3NleHByJykge1xuICAgICAgICAvLyBTdWJleHByZXNzaW9ucyBnZXQgZXZhbHVhdGVkIGFuZCBwYXNzZWQgaW5cbiAgICAgICAgLy8gaW4gc3RyaW5nIHBhcmFtcyBtb2RlLlxuICAgICAgICB0aGlzLnNleHByKHZhbCk7XG4gICAgICB9XG4gICAgfSBlbHNlIHtcbiAgICAgIGlmICh0aGlzLnRyYWNrSWRzKSB7XG4gICAgICAgIHRoaXMub3Bjb2RlKCdwdXNoSWQnLCB2YWwudHlwZSwgdmFsLmlkTmFtZSB8fCB2YWwuc3RyaW5nTW9kZVZhbHVlKTtcbiAgICAgIH1cbiAgICAgIHRoaXMuYWNjZXB0KHZhbCk7XG4gICAgfVxuICB9LFxuXG4gIHNldHVwRnVsbE11c3RhY2hlUGFyYW1zOiBmdW5jdGlvbihzZXhwciwgcHJvZ3JhbSwgaW52ZXJzZSkge1xuICAgIHZhciBwYXJhbXMgPSBzZXhwci5wYXJhbXM7XG4gICAgdGhpcy5wdXNoUGFyYW1zKHBhcmFtcyk7XG5cbiAgICB0aGlzLm9wY29kZSgncHVzaFByb2dyYW0nLCBwcm9ncmFtKTtcbiAgICB0aGlzLm9wY29kZSgncHVzaFByb2dyYW0nLCBpbnZlcnNlKTtcblxuICAgIGlmIChzZXhwci5oYXNoKSB7XG4gICAgICB0aGlzLmhhc2goc2V4cHIuaGFzaCk7XG4gICAgfSBlbHNlIHtcbiAgICAgIHRoaXMub3Bjb2RlKCdlbXB0eUhhc2gnKTtcbiAgICB9XG5cbiAgICByZXR1cm4gcGFyYW1zO1xuICB9XG59O1xuXG5mdW5jdGlvbiBwcmVjb21waWxlKGlucHV0LCBvcHRpb25zLCBlbnYpIHtcbiAgaWYgKGlucHV0ID09IG51bGwgfHwgKHR5cGVvZiBpbnB1dCAhPT0gJ3N0cmluZycgJiYgaW5wdXQuY29uc3RydWN0b3IgIT09IGVudi5BU1QuUHJvZ3JhbU5vZGUpKSB7XG4gICAgdGhyb3cgbmV3IEV4Y2VwdGlvbihcIllvdSBtdXN0IHBhc3MgYSBzdHJpbmcgb3IgSGFuZGxlYmFycyBBU1QgdG8gSGFuZGxlYmFycy5wcmVjb21waWxlLiBZb3UgcGFzc2VkIFwiICsgaW5wdXQpO1xuICB9XG5cbiAgb3B0aW9ucyA9IG9wdGlvbnMgfHwge307XG4gIGlmICghKCdkYXRhJyBpbiBvcHRpb25zKSkge1xuICAgIG9wdGlvbnMuZGF0YSA9IHRydWU7XG4gIH1cbiAgaWYgKG9wdGlvbnMuY29tcGF0KSB7XG4gICAgb3B0aW9ucy51c2VEZXB0aHMgPSB0cnVlO1xuICB9XG5cbiAgdmFyIGFzdCA9IGVudi5wYXJzZShpbnB1dCk7XG4gIHZhciBlbnZpcm9ubWVudCA9IG5ldyBlbnYuQ29tcGlsZXIoKS5jb21waWxlKGFzdCwgb3B0aW9ucyk7XG4gIHJldHVybiBuZXcgZW52LkphdmFTY3JpcHRDb21waWxlcigpLmNvbXBpbGUoZW52aXJvbm1lbnQsIG9wdGlvbnMpO1xufVxuXG5leHBvcnRzLnByZWNvbXBpbGUgPSBwcmVjb21waWxlO2Z1bmN0aW9uIGNvbXBpbGUoaW5wdXQsIG9wdGlvbnMsIGVudikge1xuICBpZiAoaW5wdXQgPT0gbnVsbCB8fCAodHlwZW9mIGlucHV0ICE9PSAnc3RyaW5nJyAmJiBpbnB1dC5jb25zdHJ1Y3RvciAhPT0gZW52LkFTVC5Qcm9ncmFtTm9kZSkpIHtcbiAgICB0aHJvdyBuZXcgRXhjZXB0aW9uKFwiWW91IG11c3QgcGFzcyBhIHN0cmluZyBvciBIYW5kbGViYXJzIEFTVCB0byBIYW5kbGViYXJzLmNvbXBpbGUuIFlvdSBwYXNzZWQgXCIgKyBpbnB1dCk7XG4gIH1cblxuICBvcHRpb25zID0gb3B0aW9ucyB8fCB7fTtcblxuICBpZiAoISgnZGF0YScgaW4gb3B0aW9ucykpIHtcbiAgICBvcHRpb25zLmRhdGEgPSB0cnVlO1xuICB9XG4gIGlmIChvcHRpb25zLmNvbXBhdCkge1xuICAgIG9wdGlvbnMudXNlRGVwdGhzID0gdHJ1ZTtcbiAgfVxuXG4gIHZhciBjb21waWxlZDtcblxuICBmdW5jdGlvbiBjb21waWxlSW5wdXQoKSB7XG4gICAgdmFyIGFzdCA9IGVudi5wYXJzZShpbnB1dCk7XG4gICAgdmFyIGVudmlyb25tZW50ID0gbmV3IGVudi5Db21waWxlcigpLmNvbXBpbGUoYXN0LCBvcHRpb25zKTtcbiAgICB2YXIgdGVtcGxhdGVTcGVjID0gbmV3IGVudi5KYXZhU2NyaXB0Q29tcGlsZXIoKS5jb21waWxlKGVudmlyb25tZW50LCBvcHRpb25zLCB1bmRlZmluZWQsIHRydWUpO1xuICAgIHJldHVybiBlbnYudGVtcGxhdGUodGVtcGxhdGVTcGVjKTtcbiAgfVxuXG4gIC8vIFRlbXBsYXRlIGlzIG9ubHkgY29tcGlsZWQgb24gZmlyc3QgdXNlIGFuZCBjYWNoZWQgYWZ0ZXIgdGhhdCBwb2ludC5cbiAgdmFyIHJldCA9IGZ1bmN0aW9uKGNvbnRleHQsIG9wdGlvbnMpIHtcbiAgICBpZiAoIWNvbXBpbGVkKSB7XG4gICAgICBjb21waWxlZCA9IGNvbXBpbGVJbnB1dCgpO1xuICAgIH1cbiAgICByZXR1cm4gY29tcGlsZWQuY2FsbCh0aGlzLCBjb250ZXh0LCBvcHRpb25zKTtcbiAgfTtcbiAgcmV0Ll9zZXR1cCA9IGZ1bmN0aW9uKG9wdGlvbnMpIHtcbiAgICBpZiAoIWNvbXBpbGVkKSB7XG4gICAgICBjb21waWxlZCA9IGNvbXBpbGVJbnB1dCgpO1xuICAgIH1cbiAgICByZXR1cm4gY29tcGlsZWQuX3NldHVwKG9wdGlvbnMpO1xuICB9O1xuICByZXQuX2NoaWxkID0gZnVuY3Rpb24oaSwgZGF0YSwgZGVwdGhzKSB7XG4gICAgaWYgKCFjb21waWxlZCkge1xuICAgICAgY29tcGlsZWQgPSBjb21waWxlSW5wdXQoKTtcbiAgICB9XG4gICAgcmV0dXJuIGNvbXBpbGVkLl9jaGlsZChpLCBkYXRhLCBkZXB0aHMpO1xuICB9O1xuICByZXR1cm4gcmV0O1xufVxuXG5leHBvcnRzLmNvbXBpbGUgPSBjb21waWxlO2Z1bmN0aW9uIGFyZ0VxdWFscyhhLCBiKSB7XG4gIGlmIChhID09PSBiKSB7XG4gICAgcmV0dXJuIHRydWU7XG4gIH1cblxuICBpZiAoaXNBcnJheShhKSAmJiBpc0FycmF5KGIpICYmIGEubGVuZ3RoID09PSBiLmxlbmd0aCkge1xuICAgIGZvciAodmFyIGkgPSAwOyBpIDwgYS5sZW5ndGg7IGkrKykge1xuICAgICAgaWYgKCFhcmdFcXVhbHMoYVtpXSwgYltpXSkpIHtcbiAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgfVxuICAgIH1cbiAgICByZXR1cm4gdHJ1ZTtcbiAgfVxufSIsIlwidXNlIHN0cmljdFwiO1xudmFyIEV4Y2VwdGlvbiA9IHJlcXVpcmUoXCIuLi9leGNlcHRpb25cIilbXCJkZWZhdWx0XCJdO1xuXG5mdW5jdGlvbiBzdHJpcEZsYWdzKG9wZW4sIGNsb3NlKSB7XG4gIHJldHVybiB7XG4gICAgbGVmdDogb3Blbi5jaGFyQXQoMikgPT09ICd+JyxcbiAgICByaWdodDogY2xvc2UuY2hhckF0KGNsb3NlLmxlbmd0aC0zKSA9PT0gJ34nXG4gIH07XG59XG5cbmV4cG9ydHMuc3RyaXBGbGFncyA9IHN0cmlwRmxhZ3M7XG5mdW5jdGlvbiBwcmVwYXJlQmxvY2sobXVzdGFjaGUsIHByb2dyYW0sIGludmVyc2VBbmRQcm9ncmFtLCBjbG9zZSwgaW52ZXJ0ZWQsIGxvY0luZm8pIHtcbiAgLypqc2hpbnQgLVcwNDAgKi9cbiAgaWYgKG11c3RhY2hlLnNleHByLmlkLm9yaWdpbmFsICE9PSBjbG9zZS5wYXRoLm9yaWdpbmFsKSB7XG4gICAgdGhyb3cgbmV3IEV4Y2VwdGlvbihtdXN0YWNoZS5zZXhwci5pZC5vcmlnaW5hbCArICcgZG9lc25cXCd0IG1hdGNoICcgKyBjbG9zZS5wYXRoLm9yaWdpbmFsLCBtdXN0YWNoZSk7XG4gIH1cblxuICB2YXIgaW52ZXJzZSA9IGludmVyc2VBbmRQcm9ncmFtICYmIGludmVyc2VBbmRQcm9ncmFtLnByb2dyYW07XG5cbiAgdmFyIHN0cmlwID0ge1xuICAgIGxlZnQ6IG11c3RhY2hlLnN0cmlwLmxlZnQsXG4gICAgcmlnaHQ6IGNsb3NlLnN0cmlwLnJpZ2h0LFxuXG4gICAgLy8gRGV0ZXJtaW5lIHRoZSBzdGFuZGFsb25lIGNhbmRpYWN5LiBCYXNpY2FsbHkgZmxhZyBvdXIgY29udGVudCBhcyBiZWluZyBwb3NzaWJseSBzdGFuZGFsb25lXG4gICAgLy8gc28gb3VyIHBhcmVudCBjYW4gZGV0ZXJtaW5lIGlmIHdlIGFjdHVhbGx5IGFyZSBzdGFuZGFsb25lXG4gICAgb3BlblN0YW5kYWxvbmU6IGlzTmV4dFdoaXRlc3BhY2UocHJvZ3JhbS5zdGF0ZW1lbnRzKSxcbiAgICBjbG9zZVN0YW5kYWxvbmU6IGlzUHJldldoaXRlc3BhY2UoKGludmVyc2UgfHwgcHJvZ3JhbSkuc3RhdGVtZW50cylcbiAgfTtcblxuICBpZiAobXVzdGFjaGUuc3RyaXAucmlnaHQpIHtcbiAgICBvbWl0UmlnaHQocHJvZ3JhbS5zdGF0ZW1lbnRzLCBudWxsLCB0cnVlKTtcbiAgfVxuXG4gIGlmIChpbnZlcnNlKSB7XG4gICAgdmFyIGludmVyc2VTdHJpcCA9IGludmVyc2VBbmRQcm9ncmFtLnN0cmlwO1xuXG4gICAgaWYgKGludmVyc2VTdHJpcC5sZWZ0KSB7XG4gICAgICBvbWl0TGVmdChwcm9ncmFtLnN0YXRlbWVudHMsIG51bGwsIHRydWUpO1xuICAgIH1cbiAgICBpZiAoaW52ZXJzZVN0cmlwLnJpZ2h0KSB7XG4gICAgICBvbWl0UmlnaHQoaW52ZXJzZS5zdGF0ZW1lbnRzLCBudWxsLCB0cnVlKTtcbiAgICB9XG4gICAgaWYgKGNsb3NlLnN0cmlwLmxlZnQpIHtcbiAgICAgIG9taXRMZWZ0KGludmVyc2Uuc3RhdGVtZW50cywgbnVsbCwgdHJ1ZSk7XG4gICAgfVxuXG4gICAgLy8gRmluZCBzdGFuZGFsb25lIGVsc2Ugc3RhdG1lbnRzXG4gICAgaWYgKGlzUHJldldoaXRlc3BhY2UocHJvZ3JhbS5zdGF0ZW1lbnRzKVxuICAgICAgICAmJiBpc05leHRXaGl0ZXNwYWNlKGludmVyc2Uuc3RhdGVtZW50cykpIHtcblxuICAgICAgb21pdExlZnQocHJvZ3JhbS5zdGF0ZW1lbnRzKTtcbiAgICAgIG9taXRSaWdodChpbnZlcnNlLnN0YXRlbWVudHMpO1xuICAgIH1cbiAgfSBlbHNlIHtcbiAgICBpZiAoY2xvc2Uuc3RyaXAubGVmdCkge1xuICAgICAgb21pdExlZnQocHJvZ3JhbS5zdGF0ZW1lbnRzLCBudWxsLCB0cnVlKTtcbiAgICB9XG4gIH1cblxuICBpZiAoaW52ZXJ0ZWQpIHtcbiAgICByZXR1cm4gbmV3IHRoaXMuQmxvY2tOb2RlKG11c3RhY2hlLCBpbnZlcnNlLCBwcm9ncmFtLCBzdHJpcCwgbG9jSW5mbyk7XG4gIH0gZWxzZSB7XG4gICAgcmV0dXJuIG5ldyB0aGlzLkJsb2NrTm9kZShtdXN0YWNoZSwgcHJvZ3JhbSwgaW52ZXJzZSwgc3RyaXAsIGxvY0luZm8pO1xuICB9XG59XG5cbmV4cG9ydHMucHJlcGFyZUJsb2NrID0gcHJlcGFyZUJsb2NrO1xuZnVuY3Rpb24gcHJlcGFyZVByb2dyYW0oc3RhdGVtZW50cywgaXNSb290KSB7XG4gIGZvciAodmFyIGkgPSAwLCBsID0gc3RhdGVtZW50cy5sZW5ndGg7IGkgPCBsOyBpKyspIHtcbiAgICB2YXIgY3VycmVudCA9IHN0YXRlbWVudHNbaV0sXG4gICAgICAgIHN0cmlwID0gY3VycmVudC5zdHJpcDtcblxuICAgIGlmICghc3RyaXApIHtcbiAgICAgIGNvbnRpbnVlO1xuICAgIH1cblxuICAgIHZhciBfaXNQcmV2V2hpdGVzcGFjZSA9IGlzUHJldldoaXRlc3BhY2Uoc3RhdGVtZW50cywgaSwgaXNSb290LCBjdXJyZW50LnR5cGUgPT09ICdwYXJ0aWFsJyksXG4gICAgICAgIF9pc05leHRXaGl0ZXNwYWNlID0gaXNOZXh0V2hpdGVzcGFjZShzdGF0ZW1lbnRzLCBpLCBpc1Jvb3QpLFxuXG4gICAgICAgIG9wZW5TdGFuZGFsb25lID0gc3RyaXAub3BlblN0YW5kYWxvbmUgJiYgX2lzUHJldldoaXRlc3BhY2UsXG4gICAgICAgIGNsb3NlU3RhbmRhbG9uZSA9IHN0cmlwLmNsb3NlU3RhbmRhbG9uZSAmJiBfaXNOZXh0V2hpdGVzcGFjZSxcbiAgICAgICAgaW5saW5lU3RhbmRhbG9uZSA9IHN0cmlwLmlubGluZVN0YW5kYWxvbmUgJiYgX2lzUHJldldoaXRlc3BhY2UgJiYgX2lzTmV4dFdoaXRlc3BhY2U7XG5cbiAgICBpZiAoc3RyaXAucmlnaHQpIHtcbiAgICAgIG9taXRSaWdodChzdGF0ZW1lbnRzLCBpLCB0cnVlKTtcbiAgICB9XG4gICAgaWYgKHN0cmlwLmxlZnQpIHtcbiAgICAgIG9taXRMZWZ0KHN0YXRlbWVudHMsIGksIHRydWUpO1xuICAgIH1cblxuICAgIGlmIChpbmxpbmVTdGFuZGFsb25lKSB7XG4gICAgICBvbWl0UmlnaHQoc3RhdGVtZW50cywgaSk7XG5cbiAgICAgIGlmIChvbWl0TGVmdChzdGF0ZW1lbnRzLCBpKSkge1xuICAgICAgICAvLyBJZiB3ZSBhcmUgb24gYSBzdGFuZGFsb25lIG5vZGUsIHNhdmUgdGhlIGluZGVudCBpbmZvIGZvciBwYXJ0aWFsc1xuICAgICAgICBpZiAoY3VycmVudC50eXBlID09PSAncGFydGlhbCcpIHtcbiAgICAgICAgICBjdXJyZW50LmluZGVudCA9ICgvKFsgXFx0XSskKS8pLmV4ZWMoc3RhdGVtZW50c1tpLTFdLm9yaWdpbmFsKSA/IFJlZ0V4cC4kMSA6ICcnO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuICAgIGlmIChvcGVuU3RhbmRhbG9uZSkge1xuICAgICAgb21pdFJpZ2h0KChjdXJyZW50LnByb2dyYW0gfHwgY3VycmVudC5pbnZlcnNlKS5zdGF0ZW1lbnRzKTtcblxuICAgICAgLy8gU3RyaXAgb3V0IHRoZSBwcmV2aW91cyBjb250ZW50IG5vZGUgaWYgaXQncyB3aGl0ZXNwYWNlIG9ubHlcbiAgICAgIG9taXRMZWZ0KHN0YXRlbWVudHMsIGkpO1xuICAgIH1cbiAgICBpZiAoY2xvc2VTdGFuZGFsb25lKSB7XG4gICAgICAvLyBBbHdheXMgc3RyaXAgdGhlIG5leHQgbm9kZVxuICAgICAgb21pdFJpZ2h0KHN0YXRlbWVudHMsIGkpO1xuXG4gICAgICBvbWl0TGVmdCgoY3VycmVudC5pbnZlcnNlIHx8IGN1cnJlbnQucHJvZ3JhbSkuc3RhdGVtZW50cyk7XG4gICAgfVxuICB9XG5cbiAgcmV0dXJuIHN0YXRlbWVudHM7XG59XG5cbmV4cG9ydHMucHJlcGFyZVByb2dyYW0gPSBwcmVwYXJlUHJvZ3JhbTtmdW5jdGlvbiBpc1ByZXZXaGl0ZXNwYWNlKHN0YXRlbWVudHMsIGksIGlzUm9vdCkge1xuICBpZiAoaSA9PT0gdW5kZWZpbmVkKSB7XG4gICAgaSA9IHN0YXRlbWVudHMubGVuZ3RoO1xuICB9XG5cbiAgLy8gTm9kZXMgdGhhdCBlbmQgd2l0aCBuZXdsaW5lcyBhcmUgY29uc2lkZXJlZCB3aGl0ZXNwYWNlIChidXQgYXJlIHNwZWNpYWxcbiAgLy8gY2FzZWQgZm9yIHN0cmlwIG9wZXJhdGlvbnMpXG4gIHZhciBwcmV2ID0gc3RhdGVtZW50c1tpLTFdLFxuICAgICAgc2libGluZyA9IHN0YXRlbWVudHNbaS0yXTtcbiAgaWYgKCFwcmV2KSB7XG4gICAgcmV0dXJuIGlzUm9vdDtcbiAgfVxuXG4gIGlmIChwcmV2LnR5cGUgPT09ICdjb250ZW50Jykge1xuICAgIHJldHVybiAoc2libGluZyB8fCAhaXNSb290ID8gKC9cXHI/XFxuXFxzKj8kLykgOiAoLyhefFxccj9cXG4pXFxzKj8kLykpLnRlc3QocHJldi5vcmlnaW5hbCk7XG4gIH1cbn1cbmZ1bmN0aW9uIGlzTmV4dFdoaXRlc3BhY2Uoc3RhdGVtZW50cywgaSwgaXNSb290KSB7XG4gIGlmIChpID09PSB1bmRlZmluZWQpIHtcbiAgICBpID0gLTE7XG4gIH1cblxuICB2YXIgbmV4dCA9IHN0YXRlbWVudHNbaSsxXSxcbiAgICAgIHNpYmxpbmcgPSBzdGF0ZW1lbnRzW2krMl07XG4gIGlmICghbmV4dCkge1xuICAgIHJldHVybiBpc1Jvb3Q7XG4gIH1cblxuICBpZiAobmV4dC50eXBlID09PSAnY29udGVudCcpIHtcbiAgICByZXR1cm4gKHNpYmxpbmcgfHwgIWlzUm9vdCA/ICgvXlxccyo/XFxyP1xcbi8pIDogKC9eXFxzKj8oXFxyP1xcbnwkKS8pKS50ZXN0KG5leHQub3JpZ2luYWwpO1xuICB9XG59XG5cbi8vIE1hcmtzIHRoZSBub2RlIHRvIHRoZSByaWdodCBvZiB0aGUgcG9zaXRpb24gYXMgb21pdHRlZC5cbi8vIEkuZS4ge3tmb299fScgJyB3aWxsIG1hcmsgdGhlICcgJyBub2RlIGFzIG9taXR0ZWQuXG4vL1xuLy8gSWYgaSBpcyB1bmRlZmluZWQsIHRoZW4gdGhlIGZpcnN0IGNoaWxkIHdpbGwgYmUgbWFya2VkIGFzIHN1Y2guXG4vL1xuLy8gSWYgbXVsaXRwbGUgaXMgdHJ1dGh5IHRoZW4gYWxsIHdoaXRlc3BhY2Ugd2lsbCBiZSBzdHJpcHBlZCBvdXQgdW50aWwgbm9uLXdoaXRlc3BhY2Vcbi8vIGNvbnRlbnQgaXMgbWV0LlxuZnVuY3Rpb24gb21pdFJpZ2h0KHN0YXRlbWVudHMsIGksIG11bHRpcGxlKSB7XG4gIHZhciBjdXJyZW50ID0gc3RhdGVtZW50c1tpID09IG51bGwgPyAwIDogaSArIDFdO1xuICBpZiAoIWN1cnJlbnQgfHwgY3VycmVudC50eXBlICE9PSAnY29udGVudCcgfHwgKCFtdWx0aXBsZSAmJiBjdXJyZW50LnJpZ2h0U3RyaXBwZWQpKSB7XG4gICAgcmV0dXJuO1xuICB9XG5cbiAgdmFyIG9yaWdpbmFsID0gY3VycmVudC5zdHJpbmc7XG4gIGN1cnJlbnQuc3RyaW5nID0gY3VycmVudC5zdHJpbmcucmVwbGFjZShtdWx0aXBsZSA/ICgvXlxccysvKSA6ICgvXlsgXFx0XSpcXHI/XFxuPy8pLCAnJyk7XG4gIGN1cnJlbnQucmlnaHRTdHJpcHBlZCA9IGN1cnJlbnQuc3RyaW5nICE9PSBvcmlnaW5hbDtcbn1cblxuLy8gTWFya3MgdGhlIG5vZGUgdG8gdGhlIGxlZnQgb2YgdGhlIHBvc2l0aW9uIGFzIG9taXR0ZWQuXG4vLyBJLmUuICcgJ3t7Zm9vfX0gd2lsbCBtYXJrIHRoZSAnICcgbm9kZSBhcyBvbWl0dGVkLlxuLy9cbi8vIElmIGkgaXMgdW5kZWZpbmVkIHRoZW4gdGhlIGxhc3QgY2hpbGQgd2lsbCBiZSBtYXJrZWQgYXMgc3VjaC5cbi8vXG4vLyBJZiBtdWxpdHBsZSBpcyB0cnV0aHkgdGhlbiBhbGwgd2hpdGVzcGFjZSB3aWxsIGJlIHN0cmlwcGVkIG91dCB1bnRpbCBub24td2hpdGVzcGFjZVxuLy8gY29udGVudCBpcyBtZXQuXG5mdW5jdGlvbiBvbWl0TGVmdChzdGF0ZW1lbnRzLCBpLCBtdWx0aXBsZSkge1xuICB2YXIgY3VycmVudCA9IHN0YXRlbWVudHNbaSA9PSBudWxsID8gc3RhdGVtZW50cy5sZW5ndGggLSAxIDogaSAtIDFdO1xuICBpZiAoIWN1cnJlbnQgfHwgY3VycmVudC50eXBlICE9PSAnY29udGVudCcgfHwgKCFtdWx0aXBsZSAmJiBjdXJyZW50LmxlZnRTdHJpcHBlZCkpIHtcbiAgICByZXR1cm47XG4gIH1cblxuICAvLyBXZSBvbWl0IHRoZSBsYXN0IG5vZGUgaWYgaXQncyB3aGl0ZXNwYWNlIG9ubHkgYW5kIG5vdCBwcmVjZWVkZWQgYnkgYSBub24tY29udGVudCBub2RlLlxuICB2YXIgb3JpZ2luYWwgPSBjdXJyZW50LnN0cmluZztcbiAgY3VycmVudC5zdHJpbmcgPSBjdXJyZW50LnN0cmluZy5yZXBsYWNlKG11bHRpcGxlID8gKC9cXHMrJC8pIDogKC9bIFxcdF0rJC8pLCAnJyk7XG4gIGN1cnJlbnQubGVmdFN0cmlwcGVkID0gY3VycmVudC5zdHJpbmcgIT09IG9yaWdpbmFsO1xuICByZXR1cm4gY3VycmVudC5sZWZ0U3RyaXBwZWQ7XG59IiwiXCJ1c2Ugc3RyaWN0XCI7XG52YXIgQ09NUElMRVJfUkVWSVNJT04gPSByZXF1aXJlKFwiLi4vYmFzZVwiKS5DT01QSUxFUl9SRVZJU0lPTjtcbnZhciBSRVZJU0lPTl9DSEFOR0VTID0gcmVxdWlyZShcIi4uL2Jhc2VcIikuUkVWSVNJT05fQ0hBTkdFUztcbnZhciBFeGNlcHRpb24gPSByZXF1aXJlKFwiLi4vZXhjZXB0aW9uXCIpW1wiZGVmYXVsdFwiXTtcblxuZnVuY3Rpb24gTGl0ZXJhbCh2YWx1ZSkge1xuICB0aGlzLnZhbHVlID0gdmFsdWU7XG59XG5cbmZ1bmN0aW9uIEphdmFTY3JpcHRDb21waWxlcigpIHt9XG5cbkphdmFTY3JpcHRDb21waWxlci5wcm90b3R5cGUgPSB7XG4gIC8vIFBVQkxJQyBBUEk6IFlvdSBjYW4gb3ZlcnJpZGUgdGhlc2UgbWV0aG9kcyBpbiBhIHN1YmNsYXNzIHRvIHByb3ZpZGVcbiAgLy8gYWx0ZXJuYXRpdmUgY29tcGlsZWQgZm9ybXMgZm9yIG5hbWUgbG9va3VwIGFuZCBidWZmZXJpbmcgc2VtYW50aWNzXG4gIG5hbWVMb29rdXA6IGZ1bmN0aW9uKHBhcmVudCwgbmFtZSAvKiAsIHR5cGUqLykge1xuICAgIGlmIChKYXZhU2NyaXB0Q29tcGlsZXIuaXNWYWxpZEphdmFTY3JpcHRWYXJpYWJsZU5hbWUobmFtZSkpIHtcbiAgICAgIHJldHVybiBwYXJlbnQgKyBcIi5cIiArIG5hbWU7XG4gICAgfSBlbHNlIHtcbiAgICAgIHJldHVybiBwYXJlbnQgKyBcIlsnXCIgKyBuYW1lICsgXCInXVwiO1xuICAgIH1cbiAgfSxcbiAgZGVwdGhlZExvb2t1cDogZnVuY3Rpb24obmFtZSkge1xuICAgIHRoaXMuYWxpYXNlcy5sb29rdXAgPSAndGhpcy5sb29rdXAnO1xuXG4gICAgcmV0dXJuICdsb29rdXAoZGVwdGhzLCBcIicgKyBuYW1lICsgJ1wiKSc7XG4gIH0sXG5cbiAgY29tcGlsZXJJbmZvOiBmdW5jdGlvbigpIHtcbiAgICB2YXIgcmV2aXNpb24gPSBDT01QSUxFUl9SRVZJU0lPTixcbiAgICAgICAgdmVyc2lvbnMgPSBSRVZJU0lPTl9DSEFOR0VTW3JldmlzaW9uXTtcbiAgICByZXR1cm4gW3JldmlzaW9uLCB2ZXJzaW9uc107XG4gIH0sXG5cbiAgYXBwZW5kVG9CdWZmZXI6IGZ1bmN0aW9uKHN0cmluZykge1xuICAgIGlmICh0aGlzLmVudmlyb25tZW50LmlzU2ltcGxlKSB7XG4gICAgICByZXR1cm4gXCJyZXR1cm4gXCIgKyBzdHJpbmcgKyBcIjtcIjtcbiAgICB9IGVsc2Uge1xuICAgICAgcmV0dXJuIHtcbiAgICAgICAgYXBwZW5kVG9CdWZmZXI6IHRydWUsXG4gICAgICAgIGNvbnRlbnQ6IHN0cmluZyxcbiAgICAgICAgdG9TdHJpbmc6IGZ1bmN0aW9uKCkgeyByZXR1cm4gXCJidWZmZXIgKz0gXCIgKyBzdHJpbmcgKyBcIjtcIjsgfVxuICAgICAgfTtcbiAgICB9XG4gIH0sXG5cbiAgaW5pdGlhbGl6ZUJ1ZmZlcjogZnVuY3Rpb24oKSB7XG4gICAgcmV0dXJuIHRoaXMucXVvdGVkU3RyaW5nKFwiXCIpO1xuICB9LFxuXG4gIG5hbWVzcGFjZTogXCJIYW5kbGViYXJzXCIsXG4gIC8vIEVORCBQVUJMSUMgQVBJXG5cbiAgY29tcGlsZTogZnVuY3Rpb24oZW52aXJvbm1lbnQsIG9wdGlvbnMsIGNvbnRleHQsIGFzT2JqZWN0KSB7XG4gICAgdGhpcy5lbnZpcm9ubWVudCA9IGVudmlyb25tZW50O1xuICAgIHRoaXMub3B0aW9ucyA9IG9wdGlvbnM7XG4gICAgdGhpcy5zdHJpbmdQYXJhbXMgPSB0aGlzLm9wdGlvbnMuc3RyaW5nUGFyYW1zO1xuICAgIHRoaXMudHJhY2tJZHMgPSB0aGlzLm9wdGlvbnMudHJhY2tJZHM7XG4gICAgdGhpcy5wcmVjb21waWxlID0gIWFzT2JqZWN0O1xuXG4gICAgdGhpcy5uYW1lID0gdGhpcy5lbnZpcm9ubWVudC5uYW1lO1xuICAgIHRoaXMuaXNDaGlsZCA9ICEhY29udGV4dDtcbiAgICB0aGlzLmNvbnRleHQgPSBjb250ZXh0IHx8IHtcbiAgICAgIHByb2dyYW1zOiBbXSxcbiAgICAgIGVudmlyb25tZW50czogW11cbiAgICB9O1xuXG4gICAgdGhpcy5wcmVhbWJsZSgpO1xuXG4gICAgdGhpcy5zdGFja1Nsb3QgPSAwO1xuICAgIHRoaXMuc3RhY2tWYXJzID0gW107XG4gICAgdGhpcy5hbGlhc2VzID0ge307XG4gICAgdGhpcy5yZWdpc3RlcnMgPSB7IGxpc3Q6IFtdIH07XG4gICAgdGhpcy5oYXNoZXMgPSBbXTtcbiAgICB0aGlzLmNvbXBpbGVTdGFjayA9IFtdO1xuICAgIHRoaXMuaW5saW5lU3RhY2sgPSBbXTtcblxuICAgIHRoaXMuY29tcGlsZUNoaWxkcmVuKGVudmlyb25tZW50LCBvcHRpb25zKTtcblxuICAgIHRoaXMudXNlRGVwdGhzID0gdGhpcy51c2VEZXB0aHMgfHwgZW52aXJvbm1lbnQuZGVwdGhzLmxpc3QubGVuZ3RoIHx8IHRoaXMub3B0aW9ucy5jb21wYXQ7XG5cbiAgICB2YXIgb3Bjb2RlcyA9IGVudmlyb25tZW50Lm9wY29kZXMsXG4gICAgICAgIG9wY29kZSxcbiAgICAgICAgaSxcbiAgICAgICAgbDtcblxuICAgIGZvciAoaSA9IDAsIGwgPSBvcGNvZGVzLmxlbmd0aDsgaSA8IGw7IGkrKykge1xuICAgICAgb3Bjb2RlID0gb3Bjb2Rlc1tpXTtcblxuICAgICAgdGhpc1tvcGNvZGUub3Bjb2RlXS5hcHBseSh0aGlzLCBvcGNvZGUuYXJncyk7XG4gICAgfVxuXG4gICAgLy8gRmx1c2ggYW55IHRyYWlsaW5nIGNvbnRlbnQgdGhhdCBtaWdodCBiZSBwZW5kaW5nLlxuICAgIHRoaXMucHVzaFNvdXJjZSgnJyk7XG5cbiAgICAvKiBpc3RhbmJ1bCBpZ25vcmUgbmV4dCAqL1xuICAgIGlmICh0aGlzLnN0YWNrU2xvdCB8fCB0aGlzLmlubGluZVN0YWNrLmxlbmd0aCB8fCB0aGlzLmNvbXBpbGVTdGFjay5sZW5ndGgpIHtcbiAgICAgIHRocm93IG5ldyBFeGNlcHRpb24oJ0NvbXBpbGUgY29tcGxldGVkIHdpdGggY29udGVudCBsZWZ0IG9uIHN0YWNrJyk7XG4gICAgfVxuXG4gICAgdmFyIGZuID0gdGhpcy5jcmVhdGVGdW5jdGlvbkNvbnRleHQoYXNPYmplY3QpO1xuICAgIGlmICghdGhpcy5pc0NoaWxkKSB7XG4gICAgICB2YXIgcmV0ID0ge1xuICAgICAgICBjb21waWxlcjogdGhpcy5jb21waWxlckluZm8oKSxcbiAgICAgICAgbWFpbjogZm5cbiAgICAgIH07XG4gICAgICB2YXIgcHJvZ3JhbXMgPSB0aGlzLmNvbnRleHQucHJvZ3JhbXM7XG4gICAgICBmb3IgKGkgPSAwLCBsID0gcHJvZ3JhbXMubGVuZ3RoOyBpIDwgbDsgaSsrKSB7XG4gICAgICAgIGlmIChwcm9ncmFtc1tpXSkge1xuICAgICAgICAgIHJldFtpXSA9IHByb2dyYW1zW2ldO1xuICAgICAgICB9XG4gICAgICB9XG5cbiAgICAgIGlmICh0aGlzLmVudmlyb25tZW50LnVzZVBhcnRpYWwpIHtcbiAgICAgICAgcmV0LnVzZVBhcnRpYWwgPSB0cnVlO1xuICAgICAgfVxuICAgICAgaWYgKHRoaXMub3B0aW9ucy5kYXRhKSB7XG4gICAgICAgIHJldC51c2VEYXRhID0gdHJ1ZTtcbiAgICAgIH1cbiAgICAgIGlmICh0aGlzLnVzZURlcHRocykge1xuICAgICAgICByZXQudXNlRGVwdGhzID0gdHJ1ZTtcbiAgICAgIH1cbiAgICAgIGlmICh0aGlzLm9wdGlvbnMuY29tcGF0KSB7XG4gICAgICAgIHJldC5jb21wYXQgPSB0cnVlO1xuICAgICAgfVxuXG4gICAgICBpZiAoIWFzT2JqZWN0KSB7XG4gICAgICAgIHJldC5jb21waWxlciA9IEpTT04uc3RyaW5naWZ5KHJldC5jb21waWxlcik7XG4gICAgICAgIHJldCA9IHRoaXMub2JqZWN0TGl0ZXJhbChyZXQpO1xuICAgICAgfVxuXG4gICAgICByZXR1cm4gcmV0O1xuICAgIH0gZWxzZSB7XG4gICAgICByZXR1cm4gZm47XG4gICAgfVxuICB9LFxuXG4gIHByZWFtYmxlOiBmdW5jdGlvbigpIHtcbiAgICAvLyB0cmFjayB0aGUgbGFzdCBjb250ZXh0IHB1c2hlZCBpbnRvIHBsYWNlIHRvIGFsbG93IHNraXBwaW5nIHRoZVxuICAgIC8vIGdldENvbnRleHQgb3Bjb2RlIHdoZW4gaXQgd291bGQgYmUgYSBub29wXG4gICAgdGhpcy5sYXN0Q29udGV4dCA9IDA7XG4gICAgdGhpcy5zb3VyY2UgPSBbXTtcbiAgfSxcblxuICBjcmVhdGVGdW5jdGlvbkNvbnRleHQ6IGZ1bmN0aW9uKGFzT2JqZWN0KSB7XG4gICAgdmFyIHZhckRlY2xhcmF0aW9ucyA9ICcnO1xuXG4gICAgdmFyIGxvY2FscyA9IHRoaXMuc3RhY2tWYXJzLmNvbmNhdCh0aGlzLnJlZ2lzdGVycy5saXN0KTtcbiAgICBpZihsb2NhbHMubGVuZ3RoID4gMCkge1xuICAgICAgdmFyRGVjbGFyYXRpb25zICs9IFwiLCBcIiArIGxvY2Fscy5qb2luKFwiLCBcIik7XG4gICAgfVxuXG4gICAgLy8gR2VuZXJhdGUgbWluaW1pemVyIGFsaWFzIG1hcHBpbmdzXG4gICAgZm9yICh2YXIgYWxpYXMgaW4gdGhpcy5hbGlhc2VzKSB7XG4gICAgICBpZiAodGhpcy5hbGlhc2VzLmhhc093blByb3BlcnR5KGFsaWFzKSkge1xuICAgICAgICB2YXJEZWNsYXJhdGlvbnMgKz0gJywgJyArIGFsaWFzICsgJz0nICsgdGhpcy5hbGlhc2VzW2FsaWFzXTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICB2YXIgcGFyYW1zID0gW1wiZGVwdGgwXCIsIFwiaGVscGVyc1wiLCBcInBhcnRpYWxzXCIsIFwiZGF0YVwiXTtcblxuICAgIGlmICh0aGlzLnVzZURlcHRocykge1xuICAgICAgcGFyYW1zLnB1c2goJ2RlcHRocycpO1xuICAgIH1cblxuICAgIC8vIFBlcmZvcm0gYSBzZWNvbmQgcGFzcyBvdmVyIHRoZSBvdXRwdXQgdG8gbWVyZ2UgY29udGVudCB3aGVuIHBvc3NpYmxlXG4gICAgdmFyIHNvdXJjZSA9IHRoaXMubWVyZ2VTb3VyY2UodmFyRGVjbGFyYXRpb25zKTtcblxuICAgIGlmIChhc09iamVjdCkge1xuICAgICAgcGFyYW1zLnB1c2goc291cmNlKTtcblxuICAgICAgcmV0dXJuIEZ1bmN0aW9uLmFwcGx5KHRoaXMsIHBhcmFtcyk7XG4gICAgfSBlbHNlIHtcbiAgICAgIHJldHVybiAnZnVuY3Rpb24oJyArIHBhcmFtcy5qb2luKCcsJykgKyAnKSB7XFxuICAnICsgc291cmNlICsgJ30nO1xuICAgIH1cbiAgfSxcbiAgbWVyZ2VTb3VyY2U6IGZ1bmN0aW9uKHZhckRlY2xhcmF0aW9ucykge1xuICAgIHZhciBzb3VyY2UgPSAnJyxcbiAgICAgICAgYnVmZmVyLFxuICAgICAgICBhcHBlbmRPbmx5ID0gIXRoaXMuZm9yY2VCdWZmZXIsXG4gICAgICAgIGFwcGVuZEZpcnN0O1xuXG4gICAgZm9yICh2YXIgaSA9IDAsIGxlbiA9IHRoaXMuc291cmNlLmxlbmd0aDsgaSA8IGxlbjsgaSsrKSB7XG4gICAgICB2YXIgbGluZSA9IHRoaXMuc291cmNlW2ldO1xuICAgICAgaWYgKGxpbmUuYXBwZW5kVG9CdWZmZXIpIHtcbiAgICAgICAgaWYgKGJ1ZmZlcikge1xuICAgICAgICAgIGJ1ZmZlciA9IGJ1ZmZlciArICdcXG4gICAgKyAnICsgbGluZS5jb250ZW50O1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIGJ1ZmZlciA9IGxpbmUuY29udGVudDtcbiAgICAgICAgfVxuICAgICAgfSBlbHNlIHtcbiAgICAgICAgaWYgKGJ1ZmZlcikge1xuICAgICAgICAgIGlmICghc291cmNlKSB7XG4gICAgICAgICAgICBhcHBlbmRGaXJzdCA9IHRydWU7XG4gICAgICAgICAgICBzb3VyY2UgPSBidWZmZXIgKyAnO1xcbiAgJztcbiAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgc291cmNlICs9ICdidWZmZXIgKz0gJyArIGJ1ZmZlciArICc7XFxuICAnO1xuICAgICAgICAgIH1cbiAgICAgICAgICBidWZmZXIgPSB1bmRlZmluZWQ7XG4gICAgICAgIH1cbiAgICAgICAgc291cmNlICs9IGxpbmUgKyAnXFxuICAnO1xuXG4gICAgICAgIGlmICghdGhpcy5lbnZpcm9ubWVudC5pc1NpbXBsZSkge1xuICAgICAgICAgIGFwcGVuZE9ubHkgPSBmYWxzZTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cblxuICAgIGlmIChhcHBlbmRPbmx5KSB7XG4gICAgICBpZiAoYnVmZmVyIHx8ICFzb3VyY2UpIHtcbiAgICAgICAgc291cmNlICs9ICdyZXR1cm4gJyArIChidWZmZXIgfHwgJ1wiXCInKSArICc7XFxuJztcbiAgICAgIH1cbiAgICB9IGVsc2Uge1xuICAgICAgdmFyRGVjbGFyYXRpb25zICs9IFwiLCBidWZmZXIgPSBcIiArIChhcHBlbmRGaXJzdCA/ICcnIDogdGhpcy5pbml0aWFsaXplQnVmZmVyKCkpO1xuICAgICAgaWYgKGJ1ZmZlcikge1xuICAgICAgICBzb3VyY2UgKz0gJ3JldHVybiBidWZmZXIgKyAnICsgYnVmZmVyICsgJztcXG4nO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgc291cmNlICs9ICdyZXR1cm4gYnVmZmVyO1xcbic7XG4gICAgICB9XG4gICAgfVxuXG4gICAgaWYgKHZhckRlY2xhcmF0aW9ucykge1xuICAgICAgc291cmNlID0gJ3ZhciAnICsgdmFyRGVjbGFyYXRpb25zLnN1YnN0cmluZygyKSArIChhcHBlbmRGaXJzdCA/ICcnIDogJztcXG4gICcpICsgc291cmNlO1xuICAgIH1cblxuICAgIHJldHVybiBzb3VyY2U7XG4gIH0sXG5cbiAgLy8gW2Jsb2NrVmFsdWVdXG4gIC8vXG4gIC8vIE9uIHN0YWNrLCBiZWZvcmU6IGhhc2gsIGludmVyc2UsIHByb2dyYW0sIHZhbHVlXG4gIC8vIE9uIHN0YWNrLCBhZnRlcjogcmV0dXJuIHZhbHVlIG9mIGJsb2NrSGVscGVyTWlzc2luZ1xuICAvL1xuICAvLyBUaGUgcHVycG9zZSBvZiB0aGlzIG9wY29kZSBpcyB0byB0YWtlIGEgYmxvY2sgb2YgdGhlIGZvcm1cbiAgLy8gYHt7I3RoaXMuZm9vfX0uLi57ey90aGlzLmZvb319YCwgcmVzb2x2ZSB0aGUgdmFsdWUgb2YgYGZvb2AsIGFuZFxuICAvLyByZXBsYWNlIGl0IG9uIHRoZSBzdGFjayB3aXRoIHRoZSByZXN1bHQgb2YgcHJvcGVybHlcbiAgLy8gaW52b2tpbmcgYmxvY2tIZWxwZXJNaXNzaW5nLlxuICBibG9ja1ZhbHVlOiBmdW5jdGlvbihuYW1lKSB7XG4gICAgdGhpcy5hbGlhc2VzLmJsb2NrSGVscGVyTWlzc2luZyA9ICdoZWxwZXJzLmJsb2NrSGVscGVyTWlzc2luZyc7XG5cbiAgICB2YXIgcGFyYW1zID0gW3RoaXMuY29udGV4dE5hbWUoMCldO1xuICAgIHRoaXMuc2V0dXBQYXJhbXMobmFtZSwgMCwgcGFyYW1zKTtcblxuICAgIHZhciBibG9ja05hbWUgPSB0aGlzLnBvcFN0YWNrKCk7XG4gICAgcGFyYW1zLnNwbGljZSgxLCAwLCBibG9ja05hbWUpO1xuXG4gICAgdGhpcy5wdXNoKCdibG9ja0hlbHBlck1pc3NpbmcuY2FsbCgnICsgcGFyYW1zLmpvaW4oJywgJykgKyAnKScpO1xuICB9LFxuXG4gIC8vIFthbWJpZ3VvdXNCbG9ja1ZhbHVlXVxuICAvL1xuICAvLyBPbiBzdGFjaywgYmVmb3JlOiBoYXNoLCBpbnZlcnNlLCBwcm9ncmFtLCB2YWx1ZVxuICAvLyBDb21waWxlciB2YWx1ZSwgYmVmb3JlOiBsYXN0SGVscGVyPXZhbHVlIG9mIGxhc3QgZm91bmQgaGVscGVyLCBpZiBhbnlcbiAgLy8gT24gc3RhY2ssIGFmdGVyLCBpZiBubyBsYXN0SGVscGVyOiBzYW1lIGFzIFtibG9ja1ZhbHVlXVxuICAvLyBPbiBzdGFjaywgYWZ0ZXIsIGlmIGxhc3RIZWxwZXI6IHZhbHVlXG4gIGFtYmlndW91c0Jsb2NrVmFsdWU6IGZ1bmN0aW9uKCkge1xuICAgIHRoaXMuYWxpYXNlcy5ibG9ja0hlbHBlck1pc3NpbmcgPSAnaGVscGVycy5ibG9ja0hlbHBlck1pc3NpbmcnO1xuXG4gICAgLy8gV2UncmUgYmVpbmcgYSBiaXQgY2hlZWt5IGFuZCByZXVzaW5nIHRoZSBvcHRpb25zIHZhbHVlIGZyb20gdGhlIHByaW9yIGV4ZWNcbiAgICB2YXIgcGFyYW1zID0gW3RoaXMuY29udGV4dE5hbWUoMCldO1xuICAgIHRoaXMuc2V0dXBQYXJhbXMoJycsIDAsIHBhcmFtcywgdHJ1ZSk7XG5cbiAgICB0aGlzLmZsdXNoSW5saW5lKCk7XG5cbiAgICB2YXIgY3VycmVudCA9IHRoaXMudG9wU3RhY2soKTtcbiAgICBwYXJhbXMuc3BsaWNlKDEsIDAsIGN1cnJlbnQpO1xuXG4gICAgdGhpcy5wdXNoU291cmNlKFwiaWYgKCFcIiArIHRoaXMubGFzdEhlbHBlciArIFwiKSB7IFwiICsgY3VycmVudCArIFwiID0gYmxvY2tIZWxwZXJNaXNzaW5nLmNhbGwoXCIgKyBwYXJhbXMuam9pbihcIiwgXCIpICsgXCIpOyB9XCIpO1xuICB9LFxuXG4gIC8vIFthcHBlbmRDb250ZW50XVxuICAvL1xuICAvLyBPbiBzdGFjaywgYmVmb3JlOiAuLi5cbiAgLy8gT24gc3RhY2ssIGFmdGVyOiAuLi5cbiAgLy9cbiAgLy8gQXBwZW5kcyB0aGUgc3RyaW5nIHZhbHVlIG9mIGBjb250ZW50YCB0byB0aGUgY3VycmVudCBidWZmZXJcbiAgYXBwZW5kQ29udGVudDogZnVuY3Rpb24oY29udGVudCkge1xuICAgIGlmICh0aGlzLnBlbmRpbmdDb250ZW50KSB7XG4gICAgICBjb250ZW50ID0gdGhpcy5wZW5kaW5nQ29udGVudCArIGNvbnRlbnQ7XG4gICAgfVxuXG4gICAgdGhpcy5wZW5kaW5nQ29udGVudCA9IGNvbnRlbnQ7XG4gIH0sXG5cbiAgLy8gW2FwcGVuZF1cbiAgLy9cbiAgLy8gT24gc3RhY2ssIGJlZm9yZTogdmFsdWUsIC4uLlxuICAvLyBPbiBzdGFjaywgYWZ0ZXI6IC4uLlxuICAvL1xuICAvLyBDb2VyY2VzIGB2YWx1ZWAgdG8gYSBTdHJpbmcgYW5kIGFwcGVuZHMgaXQgdG8gdGhlIGN1cnJlbnQgYnVmZmVyLlxuICAvL1xuICAvLyBJZiBgdmFsdWVgIGlzIHRydXRoeSwgb3IgMCwgaXQgaXMgY29lcmNlZCBpbnRvIGEgc3RyaW5nIGFuZCBhcHBlbmRlZFxuICAvLyBPdGhlcndpc2UsIHRoZSBlbXB0eSBzdHJpbmcgaXMgYXBwZW5kZWRcbiAgYXBwZW5kOiBmdW5jdGlvbigpIHtcbiAgICAvLyBGb3JjZSBhbnl0aGluZyB0aGF0IGlzIGlubGluZWQgb250byB0aGUgc3RhY2sgc28gd2UgZG9uJ3QgaGF2ZSBkdXBsaWNhdGlvblxuICAgIC8vIHdoZW4gd2UgZXhhbWluZSBsb2NhbFxuICAgIHRoaXMuZmx1c2hJbmxpbmUoKTtcbiAgICB2YXIgbG9jYWwgPSB0aGlzLnBvcFN0YWNrKCk7XG4gICAgdGhpcy5wdXNoU291cmNlKCdpZiAoJyArIGxvY2FsICsgJyAhPSBudWxsKSB7ICcgKyB0aGlzLmFwcGVuZFRvQnVmZmVyKGxvY2FsKSArICcgfScpO1xuICAgIGlmICh0aGlzLmVudmlyb25tZW50LmlzU2ltcGxlKSB7XG4gICAgICB0aGlzLnB1c2hTb3VyY2UoXCJlbHNlIHsgXCIgKyB0aGlzLmFwcGVuZFRvQnVmZmVyKFwiJydcIikgKyBcIiB9XCIpO1xuICAgIH1cbiAgfSxcblxuICAvLyBbYXBwZW5kRXNjYXBlZF1cbiAgLy9cbiAgLy8gT24gc3RhY2ssIGJlZm9yZTogdmFsdWUsIC4uLlxuICAvLyBPbiBzdGFjaywgYWZ0ZXI6IC4uLlxuICAvL1xuICAvLyBFc2NhcGUgYHZhbHVlYCBhbmQgYXBwZW5kIGl0IHRvIHRoZSBidWZmZXJcbiAgYXBwZW5kRXNjYXBlZDogZnVuY3Rpb24oKSB7XG4gICAgdGhpcy5hbGlhc2VzLmVzY2FwZUV4cHJlc3Npb24gPSAndGhpcy5lc2NhcGVFeHByZXNzaW9uJztcblxuICAgIHRoaXMucHVzaFNvdXJjZSh0aGlzLmFwcGVuZFRvQnVmZmVyKFwiZXNjYXBlRXhwcmVzc2lvbihcIiArIHRoaXMucG9wU3RhY2soKSArIFwiKVwiKSk7XG4gIH0sXG5cbiAgLy8gW2dldENvbnRleHRdXG4gIC8vXG4gIC8vIE9uIHN0YWNrLCBiZWZvcmU6IC4uLlxuICAvLyBPbiBzdGFjaywgYWZ0ZXI6IC4uLlxuICAvLyBDb21waWxlciB2YWx1ZSwgYWZ0ZXI6IGxhc3RDb250ZXh0PWRlcHRoXG4gIC8vXG4gIC8vIFNldCB0aGUgdmFsdWUgb2YgdGhlIGBsYXN0Q29udGV4dGAgY29tcGlsZXIgdmFsdWUgdG8gdGhlIGRlcHRoXG4gIGdldENvbnRleHQ6IGZ1bmN0aW9uKGRlcHRoKSB7XG4gICAgdGhpcy5sYXN0Q29udGV4dCA9IGRlcHRoO1xuICB9LFxuXG4gIC8vIFtwdXNoQ29udGV4dF1cbiAgLy9cbiAgLy8gT24gc3RhY2ssIGJlZm9yZTogLi4uXG4gIC8vIE9uIHN0YWNrLCBhZnRlcjogY3VycmVudENvbnRleHQsIC4uLlxuICAvL1xuICAvLyBQdXNoZXMgdGhlIHZhbHVlIG9mIHRoZSBjdXJyZW50IGNvbnRleHQgb250byB0aGUgc3RhY2suXG4gIHB1c2hDb250ZXh0OiBmdW5jdGlvbigpIHtcbiAgICB0aGlzLnB1c2hTdGFja0xpdGVyYWwodGhpcy5jb250ZXh0TmFtZSh0aGlzLmxhc3RDb250ZXh0KSk7XG4gIH0sXG5cbiAgLy8gW2xvb2t1cE9uQ29udGV4dF1cbiAgLy9cbiAgLy8gT24gc3RhY2ssIGJlZm9yZTogLi4uXG4gIC8vIE9uIHN0YWNrLCBhZnRlcjogY3VycmVudENvbnRleHRbbmFtZV0sIC4uLlxuICAvL1xuICAvLyBMb29rcyB1cCB0aGUgdmFsdWUgb2YgYG5hbWVgIG9uIHRoZSBjdXJyZW50IGNvbnRleHQgYW5kIHB1c2hlc1xuICAvLyBpdCBvbnRvIHRoZSBzdGFjay5cbiAgbG9va3VwT25Db250ZXh0OiBmdW5jdGlvbihwYXJ0cywgZmFsc3ksIHNjb3BlZCkge1xuICAgIC8qanNoaW50IC1XMDgzICovXG4gICAgdmFyIGkgPSAwLFxuICAgICAgICBsZW4gPSBwYXJ0cy5sZW5ndGg7XG5cbiAgICBpZiAoIXNjb3BlZCAmJiB0aGlzLm9wdGlvbnMuY29tcGF0ICYmICF0aGlzLmxhc3RDb250ZXh0KSB7XG4gICAgICAvLyBUaGUgZGVwdGhlZCBxdWVyeSBpcyBleHBlY3RlZCB0byBoYW5kbGUgdGhlIHVuZGVmaW5lZCBsb2dpYyBmb3IgdGhlIHJvb3QgbGV2ZWwgdGhhdFxuICAgICAgLy8gaXMgaW1wbGVtZW50ZWQgYmVsb3csIHNvIHdlIGV2YWx1YXRlIHRoYXQgZGlyZWN0bHkgaW4gY29tcGF0IG1vZGVcbiAgICAgIHRoaXMucHVzaCh0aGlzLmRlcHRoZWRMb29rdXAocGFydHNbaSsrXSkpO1xuICAgIH0gZWxzZSB7XG4gICAgICB0aGlzLnB1c2hDb250ZXh0KCk7XG4gICAgfVxuXG4gICAgZm9yICg7IGkgPCBsZW47IGkrKykge1xuICAgICAgdGhpcy5yZXBsYWNlU3RhY2soZnVuY3Rpb24oY3VycmVudCkge1xuICAgICAgICB2YXIgbG9va3VwID0gdGhpcy5uYW1lTG9va3VwKGN1cnJlbnQsIHBhcnRzW2ldLCAnY29udGV4dCcpO1xuICAgICAgICAvLyBXZSB3YW50IHRvIGVuc3VyZSB0aGF0IHplcm8gYW5kIGZhbHNlIGFyZSBoYW5kbGVkIHByb3Blcmx5IGlmIHRoZSBjb250ZXh0IChmYWxzeSBmbGFnKVxuICAgICAgICAvLyBuZWVkcyB0byBoYXZlIHRoZSBzcGVjaWFsIGhhbmRsaW5nIGZvciB0aGVzZSB2YWx1ZXMuXG4gICAgICAgIGlmICghZmFsc3kpIHtcbiAgICAgICAgICByZXR1cm4gJyAhPSBudWxsID8gJyArIGxvb2t1cCArICcgOiAnICsgY3VycmVudDtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAvLyBPdGhlcndpc2Ugd2UgY2FuIHVzZSBnZW5lcmljIGZhbHN5IGhhbmRsaW5nXG4gICAgICAgICAgcmV0dXJuICcgJiYgJyArIGxvb2t1cDtcbiAgICAgICAgfVxuICAgICAgfSk7XG4gICAgfVxuICB9LFxuXG4gIC8vIFtsb29rdXBEYXRhXVxuICAvL1xuICAvLyBPbiBzdGFjaywgYmVmb3JlOiAuLi5cbiAgLy8gT24gc3RhY2ssIGFmdGVyOiBkYXRhLCAuLi5cbiAgLy9cbiAgLy8gUHVzaCB0aGUgZGF0YSBsb29rdXAgb3BlcmF0b3JcbiAgbG9va3VwRGF0YTogZnVuY3Rpb24oZGVwdGgsIHBhcnRzKSB7XG4gICAgLypqc2hpbnQgLVcwODMgKi9cbiAgICBpZiAoIWRlcHRoKSB7XG4gICAgICB0aGlzLnB1c2hTdGFja0xpdGVyYWwoJ2RhdGEnKTtcbiAgICB9IGVsc2Uge1xuICAgICAgdGhpcy5wdXNoU3RhY2tMaXRlcmFsKCd0aGlzLmRhdGEoZGF0YSwgJyArIGRlcHRoICsgJyknKTtcbiAgICB9XG5cbiAgICB2YXIgbGVuID0gcGFydHMubGVuZ3RoO1xuICAgIGZvciAodmFyIGkgPSAwOyBpIDwgbGVuOyBpKyspIHtcbiAgICAgIHRoaXMucmVwbGFjZVN0YWNrKGZ1bmN0aW9uKGN1cnJlbnQpIHtcbiAgICAgICAgcmV0dXJuICcgJiYgJyArIHRoaXMubmFtZUxvb2t1cChjdXJyZW50LCBwYXJ0c1tpXSwgJ2RhdGEnKTtcbiAgICAgIH0pO1xuICAgIH1cbiAgfSxcblxuICAvLyBbcmVzb2x2ZVBvc3NpYmxlTGFtYmRhXVxuICAvL1xuICAvLyBPbiBzdGFjaywgYmVmb3JlOiB2YWx1ZSwgLi4uXG4gIC8vIE9uIHN0YWNrLCBhZnRlcjogcmVzb2x2ZWQgdmFsdWUsIC4uLlxuICAvL1xuICAvLyBJZiB0aGUgYHZhbHVlYCBpcyBhIGxhbWJkYSwgcmVwbGFjZSBpdCBvbiB0aGUgc3RhY2sgYnlcbiAgLy8gdGhlIHJldHVybiB2YWx1ZSBvZiB0aGUgbGFtYmRhXG4gIHJlc29sdmVQb3NzaWJsZUxhbWJkYTogZnVuY3Rpb24oKSB7XG4gICAgdGhpcy5hbGlhc2VzLmxhbWJkYSA9ICd0aGlzLmxhbWJkYSc7XG5cbiAgICB0aGlzLnB1c2goJ2xhbWJkYSgnICsgdGhpcy5wb3BTdGFjaygpICsgJywgJyArIHRoaXMuY29udGV4dE5hbWUoMCkgKyAnKScpO1xuICB9LFxuXG4gIC8vIFtwdXNoU3RyaW5nUGFyYW1dXG4gIC8vXG4gIC8vIE9uIHN0YWNrLCBiZWZvcmU6IC4uLlxuICAvLyBPbiBzdGFjaywgYWZ0ZXI6IHN0cmluZywgY3VycmVudENvbnRleHQsIC4uLlxuICAvL1xuICAvLyBUaGlzIG9wY29kZSBpcyBkZXNpZ25lZCBmb3IgdXNlIGluIHN0cmluZyBtb2RlLCB3aGljaFxuICAvLyBwcm92aWRlcyB0aGUgc3RyaW5nIHZhbHVlIG9mIGEgcGFyYW1ldGVyIGFsb25nIHdpdGggaXRzXG4gIC8vIGRlcHRoIHJhdGhlciB0aGFuIHJlc29sdmluZyBpdCBpbW1lZGlhdGVseS5cbiAgcHVzaFN0cmluZ1BhcmFtOiBmdW5jdGlvbihzdHJpbmcsIHR5cGUpIHtcbiAgICB0aGlzLnB1c2hDb250ZXh0KCk7XG4gICAgdGhpcy5wdXNoU3RyaW5nKHR5cGUpO1xuXG4gICAgLy8gSWYgaXQncyBhIHN1YmV4cHJlc3Npb24sIHRoZSBzdHJpbmcgcmVzdWx0XG4gICAgLy8gd2lsbCBiZSBwdXNoZWQgYWZ0ZXIgdGhpcyBvcGNvZGUuXG4gICAgaWYgKHR5cGUgIT09ICdzZXhwcicpIHtcbiAgICAgIGlmICh0eXBlb2Ygc3RyaW5nID09PSAnc3RyaW5nJykge1xuICAgICAgICB0aGlzLnB1c2hTdHJpbmcoc3RyaW5nKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHRoaXMucHVzaFN0YWNrTGl0ZXJhbChzdHJpbmcpO1xuICAgICAgfVxuICAgIH1cbiAgfSxcblxuICBlbXB0eUhhc2g6IGZ1bmN0aW9uKCkge1xuICAgIHRoaXMucHVzaFN0YWNrTGl0ZXJhbCgne30nKTtcblxuICAgIGlmICh0aGlzLnRyYWNrSWRzKSB7XG4gICAgICB0aGlzLnB1c2goJ3t9Jyk7IC8vIGhhc2hJZHNcbiAgICB9XG4gICAgaWYgKHRoaXMuc3RyaW5nUGFyYW1zKSB7XG4gICAgICB0aGlzLnB1c2goJ3t9Jyk7IC8vIGhhc2hDb250ZXh0c1xuICAgICAgdGhpcy5wdXNoKCd7fScpOyAvLyBoYXNoVHlwZXNcbiAgICB9XG4gIH0sXG4gIHB1c2hIYXNoOiBmdW5jdGlvbigpIHtcbiAgICBpZiAodGhpcy5oYXNoKSB7XG4gICAgICB0aGlzLmhhc2hlcy5wdXNoKHRoaXMuaGFzaCk7XG4gICAgfVxuICAgIHRoaXMuaGFzaCA9IHt2YWx1ZXM6IFtdLCB0eXBlczogW10sIGNvbnRleHRzOiBbXSwgaWRzOiBbXX07XG4gIH0sXG4gIHBvcEhhc2g6IGZ1bmN0aW9uKCkge1xuICAgIHZhciBoYXNoID0gdGhpcy5oYXNoO1xuICAgIHRoaXMuaGFzaCA9IHRoaXMuaGFzaGVzLnBvcCgpO1xuXG4gICAgaWYgKHRoaXMudHJhY2tJZHMpIHtcbiAgICAgIHRoaXMucHVzaCgneycgKyBoYXNoLmlkcy5qb2luKCcsJykgKyAnfScpO1xuICAgIH1cbiAgICBpZiAodGhpcy5zdHJpbmdQYXJhbXMpIHtcbiAgICAgIHRoaXMucHVzaCgneycgKyBoYXNoLmNvbnRleHRzLmpvaW4oJywnKSArICd9Jyk7XG4gICAgICB0aGlzLnB1c2goJ3snICsgaGFzaC50eXBlcy5qb2luKCcsJykgKyAnfScpO1xuICAgIH1cblxuICAgIHRoaXMucHVzaCgne1xcbiAgICAnICsgaGFzaC52YWx1ZXMuam9pbignLFxcbiAgICAnKSArICdcXG4gIH0nKTtcbiAgfSxcblxuICAvLyBbcHVzaFN0cmluZ11cbiAgLy9cbiAgLy8gT24gc3RhY2ssIGJlZm9yZTogLi4uXG4gIC8vIE9uIHN0YWNrLCBhZnRlcjogcXVvdGVkU3RyaW5nKHN0cmluZyksIC4uLlxuICAvL1xuICAvLyBQdXNoIGEgcXVvdGVkIHZlcnNpb24gb2YgYHN0cmluZ2Agb250byB0aGUgc3RhY2tcbiAgcHVzaFN0cmluZzogZnVuY3Rpb24oc3RyaW5nKSB7XG4gICAgdGhpcy5wdXNoU3RhY2tMaXRlcmFsKHRoaXMucXVvdGVkU3RyaW5nKHN0cmluZykpO1xuICB9LFxuXG4gIC8vIFtwdXNoXVxuICAvL1xuICAvLyBPbiBzdGFjaywgYmVmb3JlOiAuLi5cbiAgLy8gT24gc3RhY2ssIGFmdGVyOiBleHByLCAuLi5cbiAgLy9cbiAgLy8gUHVzaCBhbiBleHByZXNzaW9uIG9udG8gdGhlIHN0YWNrXG4gIHB1c2g6IGZ1bmN0aW9uKGV4cHIpIHtcbiAgICB0aGlzLmlubGluZVN0YWNrLnB1c2goZXhwcik7XG4gICAgcmV0dXJuIGV4cHI7XG4gIH0sXG5cbiAgLy8gW3B1c2hMaXRlcmFsXVxuICAvL1xuICAvLyBPbiBzdGFjaywgYmVmb3JlOiAuLi5cbiAgLy8gT24gc3RhY2ssIGFmdGVyOiB2YWx1ZSwgLi4uXG4gIC8vXG4gIC8vIFB1c2hlcyBhIHZhbHVlIG9udG8gdGhlIHN0YWNrLiBUaGlzIG9wZXJhdGlvbiBwcmV2ZW50c1xuICAvLyB0aGUgY29tcGlsZXIgZnJvbSBjcmVhdGluZyBhIHRlbXBvcmFyeSB2YXJpYWJsZSB0byBob2xkXG4gIC8vIGl0LlxuICBwdXNoTGl0ZXJhbDogZnVuY3Rpb24odmFsdWUpIHtcbiAgICB0aGlzLnB1c2hTdGFja0xpdGVyYWwodmFsdWUpO1xuICB9LFxuXG4gIC8vIFtwdXNoUHJvZ3JhbV1cbiAgLy9cbiAgLy8gT24gc3RhY2ssIGJlZm9yZTogLi4uXG4gIC8vIE9uIHN0YWNrLCBhZnRlcjogcHJvZ3JhbShndWlkKSwgLi4uXG4gIC8vXG4gIC8vIFB1c2ggYSBwcm9ncmFtIGV4cHJlc3Npb24gb250byB0aGUgc3RhY2suIFRoaXMgdGFrZXNcbiAgLy8gYSBjb21waWxlLXRpbWUgZ3VpZCBhbmQgY29udmVydHMgaXQgaW50byBhIHJ1bnRpbWUtYWNjZXNzaWJsZVxuICAvLyBleHByZXNzaW9uLlxuICBwdXNoUHJvZ3JhbTogZnVuY3Rpb24oZ3VpZCkge1xuICAgIGlmIChndWlkICE9IG51bGwpIHtcbiAgICAgIHRoaXMucHVzaFN0YWNrTGl0ZXJhbCh0aGlzLnByb2dyYW1FeHByZXNzaW9uKGd1aWQpKTtcbiAgICB9IGVsc2Uge1xuICAgICAgdGhpcy5wdXNoU3RhY2tMaXRlcmFsKG51bGwpO1xuICAgIH1cbiAgfSxcblxuICAvLyBbaW52b2tlSGVscGVyXVxuICAvL1xuICAvLyBPbiBzdGFjaywgYmVmb3JlOiBoYXNoLCBpbnZlcnNlLCBwcm9ncmFtLCBwYXJhbXMuLi4sIC4uLlxuICAvLyBPbiBzdGFjaywgYWZ0ZXI6IHJlc3VsdCBvZiBoZWxwZXIgaW52b2NhdGlvblxuICAvL1xuICAvLyBQb3BzIG9mZiB0aGUgaGVscGVyJ3MgcGFyYW1ldGVycywgaW52b2tlcyB0aGUgaGVscGVyLFxuICAvLyBhbmQgcHVzaGVzIHRoZSBoZWxwZXIncyByZXR1cm4gdmFsdWUgb250byB0aGUgc3RhY2suXG4gIC8vXG4gIC8vIElmIHRoZSBoZWxwZXIgaXMgbm90IGZvdW5kLCBgaGVscGVyTWlzc2luZ2AgaXMgY2FsbGVkLlxuICBpbnZva2VIZWxwZXI6IGZ1bmN0aW9uKHBhcmFtU2l6ZSwgbmFtZSwgaXNTaW1wbGUpIHtcbiAgICB0aGlzLmFsaWFzZXMuaGVscGVyTWlzc2luZyA9ICdoZWxwZXJzLmhlbHBlck1pc3NpbmcnO1xuXG4gICAgdmFyIG5vbkhlbHBlciA9IHRoaXMucG9wU3RhY2soKTtcbiAgICB2YXIgaGVscGVyID0gdGhpcy5zZXR1cEhlbHBlcihwYXJhbVNpemUsIG5hbWUpO1xuXG4gICAgdmFyIGxvb2t1cCA9IChpc1NpbXBsZSA/IGhlbHBlci5uYW1lICsgJyB8fCAnIDogJycpICsgbm9uSGVscGVyICsgJyB8fCBoZWxwZXJNaXNzaW5nJztcbiAgICB0aGlzLnB1c2goJygoJyArIGxvb2t1cCArICcpLmNhbGwoJyArIGhlbHBlci5jYWxsUGFyYW1zICsgJykpJyk7XG4gIH0sXG5cbiAgLy8gW2ludm9rZUtub3duSGVscGVyXVxuICAvL1xuICAvLyBPbiBzdGFjaywgYmVmb3JlOiBoYXNoLCBpbnZlcnNlLCBwcm9ncmFtLCBwYXJhbXMuLi4sIC4uLlxuICAvLyBPbiBzdGFjaywgYWZ0ZXI6IHJlc3VsdCBvZiBoZWxwZXIgaW52b2NhdGlvblxuICAvL1xuICAvLyBUaGlzIG9wZXJhdGlvbiBpcyB1c2VkIHdoZW4gdGhlIGhlbHBlciBpcyBrbm93biB0byBleGlzdCxcbiAgLy8gc28gYSBgaGVscGVyTWlzc2luZ2AgZmFsbGJhY2sgaXMgbm90IHJlcXVpcmVkLlxuICBpbnZva2VLbm93bkhlbHBlcjogZnVuY3Rpb24ocGFyYW1TaXplLCBuYW1lKSB7XG4gICAgdmFyIGhlbHBlciA9IHRoaXMuc2V0dXBIZWxwZXIocGFyYW1TaXplLCBuYW1lKTtcbiAgICB0aGlzLnB1c2goaGVscGVyLm5hbWUgKyBcIi5jYWxsKFwiICsgaGVscGVyLmNhbGxQYXJhbXMgKyBcIilcIik7XG4gIH0sXG5cbiAgLy8gW2ludm9rZUFtYmlndW91c11cbiAgLy9cbiAgLy8gT24gc3RhY2ssIGJlZm9yZTogaGFzaCwgaW52ZXJzZSwgcHJvZ3JhbSwgcGFyYW1zLi4uLCAuLi5cbiAgLy8gT24gc3RhY2ssIGFmdGVyOiByZXN1bHQgb2YgZGlzYW1iaWd1YXRpb25cbiAgLy9cbiAgLy8gVGhpcyBvcGVyYXRpb24gaXMgdXNlZCB3aGVuIGFuIGV4cHJlc3Npb24gbGlrZSBge3tmb299fWBcbiAgLy8gaXMgcHJvdmlkZWQsIGJ1dCB3ZSBkb24ndCBrbm93IGF0IGNvbXBpbGUtdGltZSB3aGV0aGVyIGl0XG4gIC8vIGlzIGEgaGVscGVyIG9yIGEgcGF0aC5cbiAgLy9cbiAgLy8gVGhpcyBvcGVyYXRpb24gZW1pdHMgbW9yZSBjb2RlIHRoYW4gdGhlIG90aGVyIG9wdGlvbnMsXG4gIC8vIGFuZCBjYW4gYmUgYXZvaWRlZCBieSBwYXNzaW5nIHRoZSBga25vd25IZWxwZXJzYCBhbmRcbiAgLy8gYGtub3duSGVscGVyc09ubHlgIGZsYWdzIGF0IGNvbXBpbGUtdGltZS5cbiAgaW52b2tlQW1iaWd1b3VzOiBmdW5jdGlvbihuYW1lLCBoZWxwZXJDYWxsKSB7XG4gICAgdGhpcy5hbGlhc2VzLmZ1bmN0aW9uVHlwZSA9ICdcImZ1bmN0aW9uXCInO1xuICAgIHRoaXMuYWxpYXNlcy5oZWxwZXJNaXNzaW5nID0gJ2hlbHBlcnMuaGVscGVyTWlzc2luZyc7XG4gICAgdGhpcy51c2VSZWdpc3RlcignaGVscGVyJyk7XG5cbiAgICB2YXIgbm9uSGVscGVyID0gdGhpcy5wb3BTdGFjaygpO1xuXG4gICAgdGhpcy5lbXB0eUhhc2goKTtcbiAgICB2YXIgaGVscGVyID0gdGhpcy5zZXR1cEhlbHBlcigwLCBuYW1lLCBoZWxwZXJDYWxsKTtcblxuICAgIHZhciBoZWxwZXJOYW1lID0gdGhpcy5sYXN0SGVscGVyID0gdGhpcy5uYW1lTG9va3VwKCdoZWxwZXJzJywgbmFtZSwgJ2hlbHBlcicpO1xuXG4gICAgdGhpcy5wdXNoKFxuICAgICAgJygoaGVscGVyID0gKGhlbHBlciA9ICcgKyBoZWxwZXJOYW1lICsgJyB8fCAnICsgbm9uSGVscGVyICsgJykgIT0gbnVsbCA/IGhlbHBlciA6IGhlbHBlck1pc3NpbmcnXG4gICAgICAgICsgKGhlbHBlci5wYXJhbXNJbml0ID8gJyksKCcgKyBoZWxwZXIucGFyYW1zSW5pdCA6ICcnKSArICcpLCdcbiAgICAgICsgJyh0eXBlb2YgaGVscGVyID09PSBmdW5jdGlvblR5cGUgPyBoZWxwZXIuY2FsbCgnICsgaGVscGVyLmNhbGxQYXJhbXMgKyAnKSA6IGhlbHBlcikpJyk7XG4gIH0sXG5cbiAgLy8gW2ludm9rZVBhcnRpYWxdXG4gIC8vXG4gIC8vIE9uIHN0YWNrLCBiZWZvcmU6IGNvbnRleHQsIC4uLlxuICAvLyBPbiBzdGFjayBhZnRlcjogcmVzdWx0IG9mIHBhcnRpYWwgaW52b2NhdGlvblxuICAvL1xuICAvLyBUaGlzIG9wZXJhdGlvbiBwb3BzIG9mZiBhIGNvbnRleHQsIGludm9rZXMgYSBwYXJ0aWFsIHdpdGggdGhhdCBjb250ZXh0LFxuICAvLyBhbmQgcHVzaGVzIHRoZSByZXN1bHQgb2YgdGhlIGludm9jYXRpb24gYmFjay5cbiAgaW52b2tlUGFydGlhbDogZnVuY3Rpb24obmFtZSwgaW5kZW50KSB7XG4gICAgdmFyIHBhcmFtcyA9IFt0aGlzLm5hbWVMb29rdXAoJ3BhcnRpYWxzJywgbmFtZSwgJ3BhcnRpYWwnKSwgXCInXCIgKyBpbmRlbnQgKyBcIidcIiwgXCInXCIgKyBuYW1lICsgXCInXCIsIHRoaXMucG9wU3RhY2soKSwgdGhpcy5wb3BTdGFjaygpLCBcImhlbHBlcnNcIiwgXCJwYXJ0aWFsc1wiXTtcblxuICAgIGlmICh0aGlzLm9wdGlvbnMuZGF0YSkge1xuICAgICAgcGFyYW1zLnB1c2goXCJkYXRhXCIpO1xuICAgIH0gZWxzZSBpZiAodGhpcy5vcHRpb25zLmNvbXBhdCkge1xuICAgICAgcGFyYW1zLnB1c2goJ3VuZGVmaW5lZCcpO1xuICAgIH1cbiAgICBpZiAodGhpcy5vcHRpb25zLmNvbXBhdCkge1xuICAgICAgcGFyYW1zLnB1c2goJ2RlcHRocycpO1xuICAgIH1cblxuICAgIHRoaXMucHVzaChcInRoaXMuaW52b2tlUGFydGlhbChcIiArIHBhcmFtcy5qb2luKFwiLCBcIikgKyBcIilcIik7XG4gIH0sXG5cbiAgLy8gW2Fzc2lnblRvSGFzaF1cbiAgLy9cbiAgLy8gT24gc3RhY2ssIGJlZm9yZTogdmFsdWUsIC4uLiwgaGFzaCwgLi4uXG4gIC8vIE9uIHN0YWNrLCBhZnRlcjogLi4uLCBoYXNoLCAuLi5cbiAgLy9cbiAgLy8gUG9wcyBhIHZhbHVlIG9mZiB0aGUgc3RhY2sgYW5kIGFzc2lnbnMgaXQgdG8gdGhlIGN1cnJlbnQgaGFzaFxuICBhc3NpZ25Ub0hhc2g6IGZ1bmN0aW9uKGtleSkge1xuICAgIHZhciB2YWx1ZSA9IHRoaXMucG9wU3RhY2soKSxcbiAgICAgICAgY29udGV4dCxcbiAgICAgICAgdHlwZSxcbiAgICAgICAgaWQ7XG5cbiAgICBpZiAodGhpcy50cmFja0lkcykge1xuICAgICAgaWQgPSB0aGlzLnBvcFN0YWNrKCk7XG4gICAgfVxuICAgIGlmICh0aGlzLnN0cmluZ1BhcmFtcykge1xuICAgICAgdHlwZSA9IHRoaXMucG9wU3RhY2soKTtcbiAgICAgIGNvbnRleHQgPSB0aGlzLnBvcFN0YWNrKCk7XG4gICAgfVxuXG4gICAgdmFyIGhhc2ggPSB0aGlzLmhhc2g7XG4gICAgaWYgKGNvbnRleHQpIHtcbiAgICAgIGhhc2guY29udGV4dHMucHVzaChcIidcIiArIGtleSArIFwiJzogXCIgKyBjb250ZXh0KTtcbiAgICB9XG4gICAgaWYgKHR5cGUpIHtcbiAgICAgIGhhc2gudHlwZXMucHVzaChcIidcIiArIGtleSArIFwiJzogXCIgKyB0eXBlKTtcbiAgICB9XG4gICAgaWYgKGlkKSB7XG4gICAgICBoYXNoLmlkcy5wdXNoKFwiJ1wiICsga2V5ICsgXCInOiBcIiArIGlkKTtcbiAgICB9XG4gICAgaGFzaC52YWx1ZXMucHVzaChcIidcIiArIGtleSArIFwiJzogKFwiICsgdmFsdWUgKyBcIilcIik7XG4gIH0sXG5cbiAgcHVzaElkOiBmdW5jdGlvbih0eXBlLCBuYW1lKSB7XG4gICAgaWYgKHR5cGUgPT09ICdJRCcgfHwgdHlwZSA9PT0gJ0RBVEEnKSB7XG4gICAgICB0aGlzLnB1c2hTdHJpbmcobmFtZSk7XG4gICAgfSBlbHNlIGlmICh0eXBlID09PSAnc2V4cHInKSB7XG4gICAgICB0aGlzLnB1c2hTdGFja0xpdGVyYWwoJ3RydWUnKTtcbiAgICB9IGVsc2Uge1xuICAgICAgdGhpcy5wdXNoU3RhY2tMaXRlcmFsKCdudWxsJyk7XG4gICAgfVxuICB9LFxuXG4gIC8vIEhFTFBFUlNcblxuICBjb21waWxlcjogSmF2YVNjcmlwdENvbXBpbGVyLFxuXG4gIGNvbXBpbGVDaGlsZHJlbjogZnVuY3Rpb24oZW52aXJvbm1lbnQsIG9wdGlvbnMpIHtcbiAgICB2YXIgY2hpbGRyZW4gPSBlbnZpcm9ubWVudC5jaGlsZHJlbiwgY2hpbGQsIGNvbXBpbGVyO1xuXG4gICAgZm9yKHZhciBpPTAsIGw9Y2hpbGRyZW4ubGVuZ3RoOyBpPGw7IGkrKykge1xuICAgICAgY2hpbGQgPSBjaGlsZHJlbltpXTtcbiAgICAgIGNvbXBpbGVyID0gbmV3IHRoaXMuY29tcGlsZXIoKTtcblxuICAgICAgdmFyIGluZGV4ID0gdGhpcy5tYXRjaEV4aXN0aW5nUHJvZ3JhbShjaGlsZCk7XG5cbiAgICAgIGlmIChpbmRleCA9PSBudWxsKSB7XG4gICAgICAgIHRoaXMuY29udGV4dC5wcm9ncmFtcy5wdXNoKCcnKTsgICAgIC8vIFBsYWNlaG9sZGVyIHRvIHByZXZlbnQgbmFtZSBjb25mbGljdHMgZm9yIG5lc3RlZCBjaGlsZHJlblxuICAgICAgICBpbmRleCA9IHRoaXMuY29udGV4dC5wcm9ncmFtcy5sZW5ndGg7XG4gICAgICAgIGNoaWxkLmluZGV4ID0gaW5kZXg7XG4gICAgICAgIGNoaWxkLm5hbWUgPSAncHJvZ3JhbScgKyBpbmRleDtcbiAgICAgICAgdGhpcy5jb250ZXh0LnByb2dyYW1zW2luZGV4XSA9IGNvbXBpbGVyLmNvbXBpbGUoY2hpbGQsIG9wdGlvbnMsIHRoaXMuY29udGV4dCwgIXRoaXMucHJlY29tcGlsZSk7XG4gICAgICAgIHRoaXMuY29udGV4dC5lbnZpcm9ubWVudHNbaW5kZXhdID0gY2hpbGQ7XG5cbiAgICAgICAgdGhpcy51c2VEZXB0aHMgPSB0aGlzLnVzZURlcHRocyB8fCBjb21waWxlci51c2VEZXB0aHM7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBjaGlsZC5pbmRleCA9IGluZGV4O1xuICAgICAgICBjaGlsZC5uYW1lID0gJ3Byb2dyYW0nICsgaW5kZXg7XG4gICAgICB9XG4gICAgfVxuICB9LFxuICBtYXRjaEV4aXN0aW5nUHJvZ3JhbTogZnVuY3Rpb24oY2hpbGQpIHtcbiAgICBmb3IgKHZhciBpID0gMCwgbGVuID0gdGhpcy5jb250ZXh0LmVudmlyb25tZW50cy5sZW5ndGg7IGkgPCBsZW47IGkrKykge1xuICAgICAgdmFyIGVudmlyb25tZW50ID0gdGhpcy5jb250ZXh0LmVudmlyb25tZW50c1tpXTtcbiAgICAgIGlmIChlbnZpcm9ubWVudCAmJiBlbnZpcm9ubWVudC5lcXVhbHMoY2hpbGQpKSB7XG4gICAgICAgIHJldHVybiBpO1xuICAgICAgfVxuICAgIH1cbiAgfSxcblxuICBwcm9ncmFtRXhwcmVzc2lvbjogZnVuY3Rpb24oZ3VpZCkge1xuICAgIHZhciBjaGlsZCA9IHRoaXMuZW52aXJvbm1lbnQuY2hpbGRyZW5bZ3VpZF0sXG4gICAgICAgIGRlcHRocyA9IGNoaWxkLmRlcHRocy5saXN0LFxuICAgICAgICB1c2VEZXB0aHMgPSB0aGlzLnVzZURlcHRocyxcbiAgICAgICAgZGVwdGg7XG5cbiAgICB2YXIgcHJvZ3JhbVBhcmFtcyA9IFtjaGlsZC5pbmRleCwgJ2RhdGEnXTtcblxuICAgIGlmICh1c2VEZXB0aHMpIHtcbiAgICAgIHByb2dyYW1QYXJhbXMucHVzaCgnZGVwdGhzJyk7XG4gICAgfVxuXG4gICAgcmV0dXJuICd0aGlzLnByb2dyYW0oJyArIHByb2dyYW1QYXJhbXMuam9pbignLCAnKSArICcpJztcbiAgfSxcblxuICB1c2VSZWdpc3RlcjogZnVuY3Rpb24obmFtZSkge1xuICAgIGlmKCF0aGlzLnJlZ2lzdGVyc1tuYW1lXSkge1xuICAgICAgdGhpcy5yZWdpc3RlcnNbbmFtZV0gPSB0cnVlO1xuICAgICAgdGhpcy5yZWdpc3RlcnMubGlzdC5wdXNoKG5hbWUpO1xuICAgIH1cbiAgfSxcblxuICBwdXNoU3RhY2tMaXRlcmFsOiBmdW5jdGlvbihpdGVtKSB7XG4gICAgcmV0dXJuIHRoaXMucHVzaChuZXcgTGl0ZXJhbChpdGVtKSk7XG4gIH0sXG5cbiAgcHVzaFNvdXJjZTogZnVuY3Rpb24oc291cmNlKSB7XG4gICAgaWYgKHRoaXMucGVuZGluZ0NvbnRlbnQpIHtcbiAgICAgIHRoaXMuc291cmNlLnB1c2godGhpcy5hcHBlbmRUb0J1ZmZlcih0aGlzLnF1b3RlZFN0cmluZyh0aGlzLnBlbmRpbmdDb250ZW50KSkpO1xuICAgICAgdGhpcy5wZW5kaW5nQ29udGVudCA9IHVuZGVmaW5lZDtcbiAgICB9XG5cbiAgICBpZiAoc291cmNlKSB7XG4gICAgICB0aGlzLnNvdXJjZS5wdXNoKHNvdXJjZSk7XG4gICAgfVxuICB9LFxuXG4gIHB1c2hTdGFjazogZnVuY3Rpb24oaXRlbSkge1xuICAgIHRoaXMuZmx1c2hJbmxpbmUoKTtcblxuICAgIHZhciBzdGFjayA9IHRoaXMuaW5jclN0YWNrKCk7XG4gICAgdGhpcy5wdXNoU291cmNlKHN0YWNrICsgXCIgPSBcIiArIGl0ZW0gKyBcIjtcIik7XG4gICAgdGhpcy5jb21waWxlU3RhY2sucHVzaChzdGFjayk7XG4gICAgcmV0dXJuIHN0YWNrO1xuICB9LFxuXG4gIHJlcGxhY2VTdGFjazogZnVuY3Rpb24oY2FsbGJhY2spIHtcbiAgICB2YXIgcHJlZml4ID0gJycsXG4gICAgICAgIGlubGluZSA9IHRoaXMuaXNJbmxpbmUoKSxcbiAgICAgICAgc3RhY2ssXG4gICAgICAgIGNyZWF0ZWRTdGFjayxcbiAgICAgICAgdXNlZExpdGVyYWw7XG5cbiAgICAvKiBpc3RhbmJ1bCBpZ25vcmUgbmV4dCAqL1xuICAgIGlmICghdGhpcy5pc0lubGluZSgpKSB7XG4gICAgICB0aHJvdyBuZXcgRXhjZXB0aW9uKCdyZXBsYWNlU3RhY2sgb24gbm9uLWlubGluZScpO1xuICAgIH1cblxuICAgIC8vIFdlIHdhbnQgdG8gbWVyZ2UgdGhlIGlubGluZSBzdGF0ZW1lbnQgaW50byB0aGUgcmVwbGFjZW1lbnQgc3RhdGVtZW50IHZpYSAnLCdcbiAgICB2YXIgdG9wID0gdGhpcy5wb3BTdGFjayh0cnVlKTtcblxuICAgIGlmICh0b3AgaW5zdGFuY2VvZiBMaXRlcmFsKSB7XG4gICAgICAvLyBMaXRlcmFscyBkbyBub3QgbmVlZCB0byBiZSBpbmxpbmVkXG4gICAgICBwcmVmaXggPSBzdGFjayA9IHRvcC52YWx1ZTtcbiAgICAgIHVzZWRMaXRlcmFsID0gdHJ1ZTtcbiAgICB9IGVsc2Uge1xuICAgICAgLy8gR2V0IG9yIGNyZWF0ZSB0aGUgY3VycmVudCBzdGFjayBuYW1lIGZvciB1c2UgYnkgdGhlIGlubGluZVxuICAgICAgY3JlYXRlZFN0YWNrID0gIXRoaXMuc3RhY2tTbG90O1xuICAgICAgdmFyIG5hbWUgPSAhY3JlYXRlZFN0YWNrID8gdGhpcy50b3BTdGFja05hbWUoKSA6IHRoaXMuaW5jclN0YWNrKCk7XG5cbiAgICAgIHByZWZpeCA9ICcoJyArIHRoaXMucHVzaChuYW1lKSArICcgPSAnICsgdG9wICsgJyknO1xuICAgICAgc3RhY2sgPSB0aGlzLnRvcFN0YWNrKCk7XG4gICAgfVxuXG4gICAgdmFyIGl0ZW0gPSBjYWxsYmFjay5jYWxsKHRoaXMsIHN0YWNrKTtcblxuICAgIGlmICghdXNlZExpdGVyYWwpIHtcbiAgICAgIHRoaXMucG9wU3RhY2soKTtcbiAgICB9XG4gICAgaWYgKGNyZWF0ZWRTdGFjaykge1xuICAgICAgdGhpcy5zdGFja1Nsb3QtLTtcbiAgICB9XG4gICAgdGhpcy5wdXNoKCcoJyArIHByZWZpeCArIGl0ZW0gKyAnKScpO1xuICB9LFxuXG4gIGluY3JTdGFjazogZnVuY3Rpb24oKSB7XG4gICAgdGhpcy5zdGFja1Nsb3QrKztcbiAgICBpZih0aGlzLnN0YWNrU2xvdCA+IHRoaXMuc3RhY2tWYXJzLmxlbmd0aCkgeyB0aGlzLnN0YWNrVmFycy5wdXNoKFwic3RhY2tcIiArIHRoaXMuc3RhY2tTbG90KTsgfVxuICAgIHJldHVybiB0aGlzLnRvcFN0YWNrTmFtZSgpO1xuICB9LFxuICB0b3BTdGFja05hbWU6IGZ1bmN0aW9uKCkge1xuICAgIHJldHVybiBcInN0YWNrXCIgKyB0aGlzLnN0YWNrU2xvdDtcbiAgfSxcbiAgZmx1c2hJbmxpbmU6IGZ1bmN0aW9uKCkge1xuICAgIHZhciBpbmxpbmVTdGFjayA9IHRoaXMuaW5saW5lU3RhY2s7XG4gICAgaWYgKGlubGluZVN0YWNrLmxlbmd0aCkge1xuICAgICAgdGhpcy5pbmxpbmVTdGFjayA9IFtdO1xuICAgICAgZm9yICh2YXIgaSA9IDAsIGxlbiA9IGlubGluZVN0YWNrLmxlbmd0aDsgaSA8IGxlbjsgaSsrKSB7XG4gICAgICAgIHZhciBlbnRyeSA9IGlubGluZVN0YWNrW2ldO1xuICAgICAgICBpZiAoZW50cnkgaW5zdGFuY2VvZiBMaXRlcmFsKSB7XG4gICAgICAgICAgdGhpcy5jb21waWxlU3RhY2sucHVzaChlbnRyeSk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgdGhpcy5wdXNoU3RhY2soZW50cnkpO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuICB9LFxuICBpc0lubGluZTogZnVuY3Rpb24oKSB7XG4gICAgcmV0dXJuIHRoaXMuaW5saW5lU3RhY2subGVuZ3RoO1xuICB9LFxuXG4gIHBvcFN0YWNrOiBmdW5jdGlvbih3cmFwcGVkKSB7XG4gICAgdmFyIGlubGluZSA9IHRoaXMuaXNJbmxpbmUoKSxcbiAgICAgICAgaXRlbSA9IChpbmxpbmUgPyB0aGlzLmlubGluZVN0YWNrIDogdGhpcy5jb21waWxlU3RhY2spLnBvcCgpO1xuXG4gICAgaWYgKCF3cmFwcGVkICYmIChpdGVtIGluc3RhbmNlb2YgTGl0ZXJhbCkpIHtcbiAgICAgIHJldHVybiBpdGVtLnZhbHVlO1xuICAgIH0gZWxzZSB7XG4gICAgICBpZiAoIWlubGluZSkge1xuICAgICAgICAvKiBpc3RhbmJ1bCBpZ25vcmUgbmV4dCAqL1xuICAgICAgICBpZiAoIXRoaXMuc3RhY2tTbG90KSB7XG4gICAgICAgICAgdGhyb3cgbmV3IEV4Y2VwdGlvbignSW52YWxpZCBzdGFjayBwb3AnKTtcbiAgICAgICAgfVxuICAgICAgICB0aGlzLnN0YWNrU2xvdC0tO1xuICAgICAgfVxuICAgICAgcmV0dXJuIGl0ZW07XG4gICAgfVxuICB9LFxuXG4gIHRvcFN0YWNrOiBmdW5jdGlvbigpIHtcbiAgICB2YXIgc3RhY2sgPSAodGhpcy5pc0lubGluZSgpID8gdGhpcy5pbmxpbmVTdGFjayA6IHRoaXMuY29tcGlsZVN0YWNrKSxcbiAgICAgICAgaXRlbSA9IHN0YWNrW3N0YWNrLmxlbmd0aCAtIDFdO1xuXG4gICAgaWYgKGl0ZW0gaW5zdGFuY2VvZiBMaXRlcmFsKSB7XG4gICAgICByZXR1cm4gaXRlbS52YWx1ZTtcbiAgICB9IGVsc2Uge1xuICAgICAgcmV0dXJuIGl0ZW07XG4gICAgfVxuICB9LFxuXG4gIGNvbnRleHROYW1lOiBmdW5jdGlvbihjb250ZXh0KSB7XG4gICAgaWYgKHRoaXMudXNlRGVwdGhzICYmIGNvbnRleHQpIHtcbiAgICAgIHJldHVybiAnZGVwdGhzWycgKyBjb250ZXh0ICsgJ10nO1xuICAgIH0gZWxzZSB7XG4gICAgICByZXR1cm4gJ2RlcHRoJyArIGNvbnRleHQ7XG4gICAgfVxuICB9LFxuXG4gIHF1b3RlZFN0cmluZzogZnVuY3Rpb24oc3RyKSB7XG4gICAgcmV0dXJuICdcIicgKyBzdHJcbiAgICAgIC5yZXBsYWNlKC9cXFxcL2csICdcXFxcXFxcXCcpXG4gICAgICAucmVwbGFjZSgvXCIvZywgJ1xcXFxcIicpXG4gICAgICAucmVwbGFjZSgvXFxuL2csICdcXFxcbicpXG4gICAgICAucmVwbGFjZSgvXFxyL2csICdcXFxccicpXG4gICAgICAucmVwbGFjZSgvXFx1MjAyOC9nLCAnXFxcXHUyMDI4JykgICAvLyBQZXIgRWNtYS0yNjIgNy4zICsgNy44LjRcbiAgICAgIC5yZXBsYWNlKC9cXHUyMDI5L2csICdcXFxcdTIwMjknKSArICdcIic7XG4gIH0sXG5cbiAgb2JqZWN0TGl0ZXJhbDogZnVuY3Rpb24ob2JqKSB7XG4gICAgdmFyIHBhaXJzID0gW107XG5cbiAgICBmb3IgKHZhciBrZXkgaW4gb2JqKSB7XG4gICAgICBpZiAob2JqLmhhc093blByb3BlcnR5KGtleSkpIHtcbiAgICAgICAgcGFpcnMucHVzaCh0aGlzLnF1b3RlZFN0cmluZyhrZXkpICsgJzonICsgb2JqW2tleV0pO1xuICAgICAgfVxuICAgIH1cblxuICAgIHJldHVybiAneycgKyBwYWlycy5qb2luKCcsJykgKyAnfSc7XG4gIH0sXG5cbiAgc2V0dXBIZWxwZXI6IGZ1bmN0aW9uKHBhcmFtU2l6ZSwgbmFtZSwgYmxvY2tIZWxwZXIpIHtcbiAgICB2YXIgcGFyYW1zID0gW10sXG4gICAgICAgIHBhcmFtc0luaXQgPSB0aGlzLnNldHVwUGFyYW1zKG5hbWUsIHBhcmFtU2l6ZSwgcGFyYW1zLCBibG9ja0hlbHBlcik7XG4gICAgdmFyIGZvdW5kSGVscGVyID0gdGhpcy5uYW1lTG9va3VwKCdoZWxwZXJzJywgbmFtZSwgJ2hlbHBlcicpO1xuXG4gICAgcmV0dXJuIHtcbiAgICAgIHBhcmFtczogcGFyYW1zLFxuICAgICAgcGFyYW1zSW5pdDogcGFyYW1zSW5pdCxcbiAgICAgIG5hbWU6IGZvdW5kSGVscGVyLFxuICAgICAgY2FsbFBhcmFtczogW3RoaXMuY29udGV4dE5hbWUoMCldLmNvbmNhdChwYXJhbXMpLmpvaW4oXCIsIFwiKVxuICAgIH07XG4gIH0sXG5cbiAgc2V0dXBPcHRpb25zOiBmdW5jdGlvbihoZWxwZXIsIHBhcmFtU2l6ZSwgcGFyYW1zKSB7XG4gICAgdmFyIG9wdGlvbnMgPSB7fSwgY29udGV4dHMgPSBbXSwgdHlwZXMgPSBbXSwgaWRzID0gW10sIHBhcmFtLCBpbnZlcnNlLCBwcm9ncmFtO1xuXG4gICAgb3B0aW9ucy5uYW1lID0gdGhpcy5xdW90ZWRTdHJpbmcoaGVscGVyKTtcbiAgICBvcHRpb25zLmhhc2ggPSB0aGlzLnBvcFN0YWNrKCk7XG5cbiAgICBpZiAodGhpcy50cmFja0lkcykge1xuICAgICAgb3B0aW9ucy5oYXNoSWRzID0gdGhpcy5wb3BTdGFjaygpO1xuICAgIH1cbiAgICBpZiAodGhpcy5zdHJpbmdQYXJhbXMpIHtcbiAgICAgIG9wdGlvbnMuaGFzaFR5cGVzID0gdGhpcy5wb3BTdGFjaygpO1xuICAgICAgb3B0aW9ucy5oYXNoQ29udGV4dHMgPSB0aGlzLnBvcFN0YWNrKCk7XG4gICAgfVxuXG4gICAgaW52ZXJzZSA9IHRoaXMucG9wU3RhY2soKTtcbiAgICBwcm9ncmFtID0gdGhpcy5wb3BTdGFjaygpO1xuXG4gICAgLy8gQXZvaWQgc2V0dGluZyBmbiBhbmQgaW52ZXJzZSBpZiBuZWl0aGVyIGFyZSBzZXQuIFRoaXMgYWxsb3dzXG4gICAgLy8gaGVscGVycyB0byBkbyBhIGNoZWNrIGZvciBgaWYgKG9wdGlvbnMuZm4pYFxuICAgIGlmIChwcm9ncmFtIHx8IGludmVyc2UpIHtcbiAgICAgIGlmICghcHJvZ3JhbSkge1xuICAgICAgICBwcm9ncmFtID0gJ3RoaXMubm9vcCc7XG4gICAgICB9XG5cbiAgICAgIGlmICghaW52ZXJzZSkge1xuICAgICAgICBpbnZlcnNlID0gJ3RoaXMubm9vcCc7XG4gICAgICB9XG5cbiAgICAgIG9wdGlvbnMuZm4gPSBwcm9ncmFtO1xuICAgICAgb3B0aW9ucy5pbnZlcnNlID0gaW52ZXJzZTtcbiAgICB9XG5cbiAgICAvLyBUaGUgcGFyYW1ldGVycyBnbyBvbiB0byB0aGUgc3RhY2sgaW4gb3JkZXIgKG1ha2luZyBzdXJlIHRoYXQgdGhleSBhcmUgZXZhbHVhdGVkIGluIG9yZGVyKVxuICAgIC8vIHNvIHdlIG5lZWQgdG8gcG9wIHRoZW0gb2ZmIHRoZSBzdGFjayBpbiByZXZlcnNlIG9yZGVyXG4gICAgdmFyIGkgPSBwYXJhbVNpemU7XG4gICAgd2hpbGUgKGktLSkge1xuICAgICAgcGFyYW0gPSB0aGlzLnBvcFN0YWNrKCk7XG4gICAgICBwYXJhbXNbaV0gPSBwYXJhbTtcblxuICAgICAgaWYgKHRoaXMudHJhY2tJZHMpIHtcbiAgICAgICAgaWRzW2ldID0gdGhpcy5wb3BTdGFjaygpO1xuICAgICAgfVxuICAgICAgaWYgKHRoaXMuc3RyaW5nUGFyYW1zKSB7XG4gICAgICAgIHR5cGVzW2ldID0gdGhpcy5wb3BTdGFjaygpO1xuICAgICAgICBjb250ZXh0c1tpXSA9IHRoaXMucG9wU3RhY2soKTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICBpZiAodGhpcy50cmFja0lkcykge1xuICAgICAgb3B0aW9ucy5pZHMgPSBcIltcIiArIGlkcy5qb2luKFwiLFwiKSArIFwiXVwiO1xuICAgIH1cbiAgICBpZiAodGhpcy5zdHJpbmdQYXJhbXMpIHtcbiAgICAgIG9wdGlvbnMudHlwZXMgPSBcIltcIiArIHR5cGVzLmpvaW4oXCIsXCIpICsgXCJdXCI7XG4gICAgICBvcHRpb25zLmNvbnRleHRzID0gXCJbXCIgKyBjb250ZXh0cy5qb2luKFwiLFwiKSArIFwiXVwiO1xuICAgIH1cblxuICAgIGlmICh0aGlzLm9wdGlvbnMuZGF0YSkge1xuICAgICAgb3B0aW9ucy5kYXRhID0gXCJkYXRhXCI7XG4gICAgfVxuXG4gICAgcmV0dXJuIG9wdGlvbnM7XG4gIH0sXG5cbiAgLy8gdGhlIHBhcmFtcyBhbmQgY29udGV4dHMgYXJndW1lbnRzIGFyZSBwYXNzZWQgaW4gYXJyYXlzXG4gIC8vIHRvIGZpbGwgaW5cbiAgc2V0dXBQYXJhbXM6IGZ1bmN0aW9uKGhlbHBlck5hbWUsIHBhcmFtU2l6ZSwgcGFyYW1zLCB1c2VSZWdpc3Rlcikge1xuICAgIHZhciBvcHRpb25zID0gdGhpcy5vYmplY3RMaXRlcmFsKHRoaXMuc2V0dXBPcHRpb25zKGhlbHBlck5hbWUsIHBhcmFtU2l6ZSwgcGFyYW1zKSk7XG5cbiAgICBpZiAodXNlUmVnaXN0ZXIpIHtcbiAgICAgIHRoaXMudXNlUmVnaXN0ZXIoJ29wdGlvbnMnKTtcbiAgICAgIHBhcmFtcy5wdXNoKCdvcHRpb25zJyk7XG4gICAgICByZXR1cm4gJ29wdGlvbnM9JyArIG9wdGlvbnM7XG4gICAgfSBlbHNlIHtcbiAgICAgIHBhcmFtcy5wdXNoKG9wdGlvbnMpO1xuICAgICAgcmV0dXJuICcnO1xuICAgIH1cbiAgfVxufTtcblxudmFyIHJlc2VydmVkV29yZHMgPSAoXG4gIFwiYnJlYWsgZWxzZSBuZXcgdmFyXCIgK1xuICBcIiBjYXNlIGZpbmFsbHkgcmV0dXJuIHZvaWRcIiArXG4gIFwiIGNhdGNoIGZvciBzd2l0Y2ggd2hpbGVcIiArXG4gIFwiIGNvbnRpbnVlIGZ1bmN0aW9uIHRoaXMgd2l0aFwiICtcbiAgXCIgZGVmYXVsdCBpZiB0aHJvd1wiICtcbiAgXCIgZGVsZXRlIGluIHRyeVwiICtcbiAgXCIgZG8gaW5zdGFuY2VvZiB0eXBlb2ZcIiArXG4gIFwiIGFic3RyYWN0IGVudW0gaW50IHNob3J0XCIgK1xuICBcIiBib29sZWFuIGV4cG9ydCBpbnRlcmZhY2Ugc3RhdGljXCIgK1xuICBcIiBieXRlIGV4dGVuZHMgbG9uZyBzdXBlclwiICtcbiAgXCIgY2hhciBmaW5hbCBuYXRpdmUgc3luY2hyb25pemVkXCIgK1xuICBcIiBjbGFzcyBmbG9hdCBwYWNrYWdlIHRocm93c1wiICtcbiAgXCIgY29uc3QgZ290byBwcml2YXRlIHRyYW5zaWVudFwiICtcbiAgXCIgZGVidWdnZXIgaW1wbGVtZW50cyBwcm90ZWN0ZWQgdm9sYXRpbGVcIiArXG4gIFwiIGRvdWJsZSBpbXBvcnQgcHVibGljIGxldCB5aWVsZFwiXG4pLnNwbGl0KFwiIFwiKTtcblxudmFyIGNvbXBpbGVyV29yZHMgPSBKYXZhU2NyaXB0Q29tcGlsZXIuUkVTRVJWRURfV09SRFMgPSB7fTtcblxuZm9yKHZhciBpPTAsIGw9cmVzZXJ2ZWRXb3Jkcy5sZW5ndGg7IGk8bDsgaSsrKSB7XG4gIGNvbXBpbGVyV29yZHNbcmVzZXJ2ZWRXb3Jkc1tpXV0gPSB0cnVlO1xufVxuXG5KYXZhU2NyaXB0Q29tcGlsZXIuaXNWYWxpZEphdmFTY3JpcHRWYXJpYWJsZU5hbWUgPSBmdW5jdGlvbihuYW1lKSB7XG4gIHJldHVybiAhSmF2YVNjcmlwdENvbXBpbGVyLlJFU0VSVkVEX1dPUkRTW25hbWVdICYmIC9eW2EtekEtWl8kXVswLTlhLXpBLVpfJF0qJC8udGVzdChuYW1lKTtcbn07XG5cbmV4cG9ydHNbXCJkZWZhdWx0XCJdID0gSmF2YVNjcmlwdENvbXBpbGVyOyIsIlwidXNlIHN0cmljdFwiO1xuLyoganNoaW50IGlnbm9yZTpzdGFydCAqL1xuLyogaXN0YW5idWwgaWdub3JlIG5leHQgKi9cbi8qIEppc29uIGdlbmVyYXRlZCBwYXJzZXIgKi9cbnZhciBoYW5kbGViYXJzID0gKGZ1bmN0aW9uKCl7XG52YXIgcGFyc2VyID0ge3RyYWNlOiBmdW5jdGlvbiB0cmFjZSgpIHsgfSxcbnl5OiB7fSxcbnN5bWJvbHNfOiB7XCJlcnJvclwiOjIsXCJyb290XCI6MyxcInByb2dyYW1cIjo0LFwiRU9GXCI6NSxcInByb2dyYW1fcmVwZXRpdGlvbjBcIjo2LFwic3RhdGVtZW50XCI6NyxcIm11c3RhY2hlXCI6OCxcImJsb2NrXCI6OSxcInJhd0Jsb2NrXCI6MTAsXCJwYXJ0aWFsXCI6MTEsXCJDT05URU5UXCI6MTIsXCJDT01NRU5UXCI6MTMsXCJvcGVuUmF3QmxvY2tcIjoxNCxcIkVORF9SQVdfQkxPQ0tcIjoxNSxcIk9QRU5fUkFXX0JMT0NLXCI6MTYsXCJzZXhwclwiOjE3LFwiQ0xPU0VfUkFXX0JMT0NLXCI6MTgsXCJvcGVuQmxvY2tcIjoxOSxcImJsb2NrX29wdGlvbjBcIjoyMCxcImNsb3NlQmxvY2tcIjoyMSxcIm9wZW5JbnZlcnNlXCI6MjIsXCJibG9ja19vcHRpb24xXCI6MjMsXCJPUEVOX0JMT0NLXCI6MjQsXCJDTE9TRVwiOjI1LFwiT1BFTl9JTlZFUlNFXCI6MjYsXCJpbnZlcnNlQW5kUHJvZ3JhbVwiOjI3LFwiSU5WRVJTRVwiOjI4LFwiT1BFTl9FTkRCTE9DS1wiOjI5LFwicGF0aFwiOjMwLFwiT1BFTlwiOjMxLFwiT1BFTl9VTkVTQ0FQRURcIjozMixcIkNMT1NFX1VORVNDQVBFRFwiOjMzLFwiT1BFTl9QQVJUSUFMXCI6MzQsXCJwYXJ0aWFsTmFtZVwiOjM1LFwicGFyYW1cIjozNixcInBhcnRpYWxfb3B0aW9uMFwiOjM3LFwicGFydGlhbF9vcHRpb24xXCI6MzgsXCJzZXhwcl9yZXBldGl0aW9uMFwiOjM5LFwic2V4cHJfb3B0aW9uMFwiOjQwLFwiZGF0YU5hbWVcIjo0MSxcIlNUUklOR1wiOjQyLFwiTlVNQkVSXCI6NDMsXCJCT09MRUFOXCI6NDQsXCJPUEVOX1NFWFBSXCI6NDUsXCJDTE9TRV9TRVhQUlwiOjQ2LFwiaGFzaFwiOjQ3LFwiaGFzaF9yZXBldGl0aW9uX3BsdXMwXCI6NDgsXCJoYXNoU2VnbWVudFwiOjQ5LFwiSURcIjo1MCxcIkVRVUFMU1wiOjUxLFwiREFUQVwiOjUyLFwicGF0aFNlZ21lbnRzXCI6NTMsXCJTRVBcIjo1NCxcIiRhY2NlcHRcIjowLFwiJGVuZFwiOjF9LFxudGVybWluYWxzXzogezI6XCJlcnJvclwiLDU6XCJFT0ZcIiwxMjpcIkNPTlRFTlRcIiwxMzpcIkNPTU1FTlRcIiwxNTpcIkVORF9SQVdfQkxPQ0tcIiwxNjpcIk9QRU5fUkFXX0JMT0NLXCIsMTg6XCJDTE9TRV9SQVdfQkxPQ0tcIiwyNDpcIk9QRU5fQkxPQ0tcIiwyNTpcIkNMT1NFXCIsMjY6XCJPUEVOX0lOVkVSU0VcIiwyODpcIklOVkVSU0VcIiwyOTpcIk9QRU5fRU5EQkxPQ0tcIiwzMTpcIk9QRU5cIiwzMjpcIk9QRU5fVU5FU0NBUEVEXCIsMzM6XCJDTE9TRV9VTkVTQ0FQRURcIiwzNDpcIk9QRU5fUEFSVElBTFwiLDQyOlwiU1RSSU5HXCIsNDM6XCJOVU1CRVJcIiw0NDpcIkJPT0xFQU5cIiw0NTpcIk9QRU5fU0VYUFJcIiw0NjpcIkNMT1NFX1NFWFBSXCIsNTA6XCJJRFwiLDUxOlwiRVFVQUxTXCIsNTI6XCJEQVRBXCIsNTQ6XCJTRVBcIn0sXG5wcm9kdWN0aW9uc186IFswLFszLDJdLFs0LDFdLFs3LDFdLFs3LDFdLFs3LDFdLFs3LDFdLFs3LDFdLFs3LDFdLFsxMCwzXSxbMTQsM10sWzksNF0sWzksNF0sWzE5LDNdLFsyMiwzXSxbMjcsMl0sWzIxLDNdLFs4LDNdLFs4LDNdLFsxMSw1XSxbMTEsNF0sWzE3LDNdLFsxNywxXSxbMzYsMV0sWzM2LDFdLFszNiwxXSxbMzYsMV0sWzM2LDFdLFszNiwzXSxbNDcsMV0sWzQ5LDNdLFszNSwxXSxbMzUsMV0sWzM1LDFdLFs0MSwyXSxbMzAsMV0sWzUzLDNdLFs1MywxXSxbNiwwXSxbNiwyXSxbMjAsMF0sWzIwLDFdLFsyMywwXSxbMjMsMV0sWzM3LDBdLFszNywxXSxbMzgsMF0sWzM4LDFdLFszOSwwXSxbMzksMl0sWzQwLDBdLFs0MCwxXSxbNDgsMV0sWzQ4LDJdXSxcbnBlcmZvcm1BY3Rpb246IGZ1bmN0aW9uIGFub255bW91cyh5eXRleHQseXlsZW5nLHl5bGluZW5vLHl5LHl5c3RhdGUsJCQsXyQpIHtcblxudmFyICQwID0gJCQubGVuZ3RoIC0gMTtcbnN3aXRjaCAoeXlzdGF0ZSkge1xuY2FzZSAxOiB5eS5wcmVwYXJlUHJvZ3JhbSgkJFskMC0xXS5zdGF0ZW1lbnRzLCB0cnVlKTsgcmV0dXJuICQkWyQwLTFdOyBcbmJyZWFrO1xuY2FzZSAyOnRoaXMuJCA9IG5ldyB5eS5Qcm9ncmFtTm9kZSh5eS5wcmVwYXJlUHJvZ3JhbSgkJFskMF0pLCB7fSwgdGhpcy5fJCk7XG5icmVhaztcbmNhc2UgMzp0aGlzLiQgPSAkJFskMF07XG5icmVhaztcbmNhc2UgNDp0aGlzLiQgPSAkJFskMF07XG5icmVhaztcbmNhc2UgNTp0aGlzLiQgPSAkJFskMF07XG5icmVhaztcbmNhc2UgNjp0aGlzLiQgPSAkJFskMF07XG5icmVhaztcbmNhc2UgNzp0aGlzLiQgPSBuZXcgeXkuQ29udGVudE5vZGUoJCRbJDBdLCB0aGlzLl8kKTtcbmJyZWFrO1xuY2FzZSA4OnRoaXMuJCA9IG5ldyB5eS5Db21tZW50Tm9kZSgkJFskMF0sIHRoaXMuXyQpO1xuYnJlYWs7XG5jYXNlIDk6dGhpcy4kID0gbmV3IHl5LlJhd0Jsb2NrTm9kZSgkJFskMC0yXSwgJCRbJDAtMV0sICQkWyQwXSwgdGhpcy5fJCk7XG5icmVhaztcbmNhc2UgMTA6dGhpcy4kID0gbmV3IHl5Lk11c3RhY2hlTm9kZSgkJFskMC0xXSwgbnVsbCwgJycsICcnLCB0aGlzLl8kKTtcbmJyZWFrO1xuY2FzZSAxMTp0aGlzLiQgPSB5eS5wcmVwYXJlQmxvY2soJCRbJDAtM10sICQkWyQwLTJdLCAkJFskMC0xXSwgJCRbJDBdLCBmYWxzZSwgdGhpcy5fJCk7XG5icmVhaztcbmNhc2UgMTI6dGhpcy4kID0geXkucHJlcGFyZUJsb2NrKCQkWyQwLTNdLCAkJFskMC0yXSwgJCRbJDAtMV0sICQkWyQwXSwgdHJ1ZSwgdGhpcy5fJCk7XG5icmVhaztcbmNhc2UgMTM6dGhpcy4kID0gbmV3IHl5Lk11c3RhY2hlTm9kZSgkJFskMC0xXSwgbnVsbCwgJCRbJDAtMl0sIHl5LnN0cmlwRmxhZ3MoJCRbJDAtMl0sICQkWyQwXSksIHRoaXMuXyQpO1xuYnJlYWs7XG5jYXNlIDE0OnRoaXMuJCA9IG5ldyB5eS5NdXN0YWNoZU5vZGUoJCRbJDAtMV0sIG51bGwsICQkWyQwLTJdLCB5eS5zdHJpcEZsYWdzKCQkWyQwLTJdLCAkJFskMF0pLCB0aGlzLl8kKTtcbmJyZWFrO1xuY2FzZSAxNTp0aGlzLiQgPSB7IHN0cmlwOiB5eS5zdHJpcEZsYWdzKCQkWyQwLTFdLCAkJFskMC0xXSksIHByb2dyYW06ICQkWyQwXSB9O1xuYnJlYWs7XG5jYXNlIDE2OnRoaXMuJCA9IHtwYXRoOiAkJFskMC0xXSwgc3RyaXA6IHl5LnN0cmlwRmxhZ3MoJCRbJDAtMl0sICQkWyQwXSl9O1xuYnJlYWs7XG5jYXNlIDE3OnRoaXMuJCA9IG5ldyB5eS5NdXN0YWNoZU5vZGUoJCRbJDAtMV0sIG51bGwsICQkWyQwLTJdLCB5eS5zdHJpcEZsYWdzKCQkWyQwLTJdLCAkJFskMF0pLCB0aGlzLl8kKTtcbmJyZWFrO1xuY2FzZSAxODp0aGlzLiQgPSBuZXcgeXkuTXVzdGFjaGVOb2RlKCQkWyQwLTFdLCBudWxsLCAkJFskMC0yXSwgeXkuc3RyaXBGbGFncygkJFskMC0yXSwgJCRbJDBdKSwgdGhpcy5fJCk7XG5icmVhaztcbmNhc2UgMTk6dGhpcy4kID0gbmV3IHl5LlBhcnRpYWxOb2RlKCQkWyQwLTNdLCAkJFskMC0yXSwgJCRbJDAtMV0sIHl5LnN0cmlwRmxhZ3MoJCRbJDAtNF0sICQkWyQwXSksIHRoaXMuXyQpO1xuYnJlYWs7XG5jYXNlIDIwOnRoaXMuJCA9IG5ldyB5eS5QYXJ0aWFsTm9kZSgkJFskMC0yXSwgdW5kZWZpbmVkLCAkJFskMC0xXSwgeXkuc3RyaXBGbGFncygkJFskMC0zXSwgJCRbJDBdKSwgdGhpcy5fJCk7XG5icmVhaztcbmNhc2UgMjE6dGhpcy4kID0gbmV3IHl5LlNleHByTm9kZShbJCRbJDAtMl1dLmNvbmNhdCgkJFskMC0xXSksICQkWyQwXSwgdGhpcy5fJCk7XG5icmVhaztcbmNhc2UgMjI6dGhpcy4kID0gbmV3IHl5LlNleHByTm9kZShbJCRbJDBdXSwgbnVsbCwgdGhpcy5fJCk7XG5icmVhaztcbmNhc2UgMjM6dGhpcy4kID0gJCRbJDBdO1xuYnJlYWs7XG5jYXNlIDI0OnRoaXMuJCA9IG5ldyB5eS5TdHJpbmdOb2RlKCQkWyQwXSwgdGhpcy5fJCk7XG5icmVhaztcbmNhc2UgMjU6dGhpcy4kID0gbmV3IHl5Lk51bWJlck5vZGUoJCRbJDBdLCB0aGlzLl8kKTtcbmJyZWFrO1xuY2FzZSAyNjp0aGlzLiQgPSBuZXcgeXkuQm9vbGVhbk5vZGUoJCRbJDBdLCB0aGlzLl8kKTtcbmJyZWFrO1xuY2FzZSAyNzp0aGlzLiQgPSAkJFskMF07XG5icmVhaztcbmNhc2UgMjg6JCRbJDAtMV0uaXNIZWxwZXIgPSB0cnVlOyB0aGlzLiQgPSAkJFskMC0xXTtcbmJyZWFrO1xuY2FzZSAyOTp0aGlzLiQgPSBuZXcgeXkuSGFzaE5vZGUoJCRbJDBdLCB0aGlzLl8kKTtcbmJyZWFrO1xuY2FzZSAzMDp0aGlzLiQgPSBbJCRbJDAtMl0sICQkWyQwXV07XG5icmVhaztcbmNhc2UgMzE6dGhpcy4kID0gbmV3IHl5LlBhcnRpYWxOYW1lTm9kZSgkJFskMF0sIHRoaXMuXyQpO1xuYnJlYWs7XG5jYXNlIDMyOnRoaXMuJCA9IG5ldyB5eS5QYXJ0aWFsTmFtZU5vZGUobmV3IHl5LlN0cmluZ05vZGUoJCRbJDBdLCB0aGlzLl8kKSwgdGhpcy5fJCk7XG5icmVhaztcbmNhc2UgMzM6dGhpcy4kID0gbmV3IHl5LlBhcnRpYWxOYW1lTm9kZShuZXcgeXkuTnVtYmVyTm9kZSgkJFskMF0sIHRoaXMuXyQpKTtcbmJyZWFrO1xuY2FzZSAzNDp0aGlzLiQgPSBuZXcgeXkuRGF0YU5vZGUoJCRbJDBdLCB0aGlzLl8kKTtcbmJyZWFrO1xuY2FzZSAzNTp0aGlzLiQgPSBuZXcgeXkuSWROb2RlKCQkWyQwXSwgdGhpcy5fJCk7XG5icmVhaztcbmNhc2UgMzY6ICQkWyQwLTJdLnB1c2goe3BhcnQ6ICQkWyQwXSwgc2VwYXJhdG9yOiAkJFskMC0xXX0pOyB0aGlzLiQgPSAkJFskMC0yXTsgXG5icmVhaztcbmNhc2UgMzc6dGhpcy4kID0gW3twYXJ0OiAkJFskMF19XTtcbmJyZWFrO1xuY2FzZSAzODp0aGlzLiQgPSBbXTtcbmJyZWFrO1xuY2FzZSAzOTokJFskMC0xXS5wdXNoKCQkWyQwXSk7XG5icmVhaztcbmNhc2UgNDg6dGhpcy4kID0gW107XG5icmVhaztcbmNhc2UgNDk6JCRbJDAtMV0ucHVzaCgkJFskMF0pO1xuYnJlYWs7XG5jYXNlIDUyOnRoaXMuJCA9IFskJFskMF1dO1xuYnJlYWs7XG5jYXNlIDUzOiQkWyQwLTFdLnB1c2goJCRbJDBdKTtcbmJyZWFrO1xufVxufSxcbnRhYmxlOiBbezM6MSw0OjIsNTpbMiwzOF0sNjozLDEyOlsyLDM4XSwxMzpbMiwzOF0sMTY6WzIsMzhdLDI0OlsyLDM4XSwyNjpbMiwzOF0sMzE6WzIsMzhdLDMyOlsyLDM4XSwzNDpbMiwzOF19LHsxOlszXX0sezU6WzEsNF19LHs1OlsyLDJdLDc6NSw4OjYsOTo3LDEwOjgsMTE6OSwxMjpbMSwxMF0sMTM6WzEsMTFdLDE0OjE2LDE2OlsxLDIwXSwxOToxNCwyMjoxNSwyNDpbMSwxOF0sMjY6WzEsMTldLDI4OlsyLDJdLDI5OlsyLDJdLDMxOlsxLDEyXSwzMjpbMSwxM10sMzQ6WzEsMTddfSx7MTpbMiwxXX0sezU6WzIsMzldLDEyOlsyLDM5XSwxMzpbMiwzOV0sMTY6WzIsMzldLDI0OlsyLDM5XSwyNjpbMiwzOV0sMjg6WzIsMzldLDI5OlsyLDM5XSwzMTpbMiwzOV0sMzI6WzIsMzldLDM0OlsyLDM5XX0sezU6WzIsM10sMTI6WzIsM10sMTM6WzIsM10sMTY6WzIsM10sMjQ6WzIsM10sMjY6WzIsM10sMjg6WzIsM10sMjk6WzIsM10sMzE6WzIsM10sMzI6WzIsM10sMzQ6WzIsM119LHs1OlsyLDRdLDEyOlsyLDRdLDEzOlsyLDRdLDE2OlsyLDRdLDI0OlsyLDRdLDI2OlsyLDRdLDI4OlsyLDRdLDI5OlsyLDRdLDMxOlsyLDRdLDMyOlsyLDRdLDM0OlsyLDRdfSx7NTpbMiw1XSwxMjpbMiw1XSwxMzpbMiw1XSwxNjpbMiw1XSwyNDpbMiw1XSwyNjpbMiw1XSwyODpbMiw1XSwyOTpbMiw1XSwzMTpbMiw1XSwzMjpbMiw1XSwzNDpbMiw1XX0sezU6WzIsNl0sMTI6WzIsNl0sMTM6WzIsNl0sMTY6WzIsNl0sMjQ6WzIsNl0sMjY6WzIsNl0sMjg6WzIsNl0sMjk6WzIsNl0sMzE6WzIsNl0sMzI6WzIsNl0sMzQ6WzIsNl19LHs1OlsyLDddLDEyOlsyLDddLDEzOlsyLDddLDE2OlsyLDddLDI0OlsyLDddLDI2OlsyLDddLDI4OlsyLDddLDI5OlsyLDddLDMxOlsyLDddLDMyOlsyLDddLDM0OlsyLDddfSx7NTpbMiw4XSwxMjpbMiw4XSwxMzpbMiw4XSwxNjpbMiw4XSwyNDpbMiw4XSwyNjpbMiw4XSwyODpbMiw4XSwyOTpbMiw4XSwzMTpbMiw4XSwzMjpbMiw4XSwzNDpbMiw4XX0sezE3OjIxLDMwOjIyLDQxOjIzLDUwOlsxLDI2XSw1MjpbMSwyNV0sNTM6MjR9LHsxNzoyNywzMDoyMiw0MToyMyw1MDpbMSwyNl0sNTI6WzEsMjVdLDUzOjI0fSx7NDoyOCw2OjMsMTI6WzIsMzhdLDEzOlsyLDM4XSwxNjpbMiwzOF0sMjQ6WzIsMzhdLDI2OlsyLDM4XSwyODpbMiwzOF0sMjk6WzIsMzhdLDMxOlsyLDM4XSwzMjpbMiwzOF0sMzQ6WzIsMzhdfSx7NDoyOSw2OjMsMTI6WzIsMzhdLDEzOlsyLDM4XSwxNjpbMiwzOF0sMjQ6WzIsMzhdLDI2OlsyLDM4XSwyODpbMiwzOF0sMjk6WzIsMzhdLDMxOlsyLDM4XSwzMjpbMiwzOF0sMzQ6WzIsMzhdfSx7MTI6WzEsMzBdfSx7MzA6MzIsMzU6MzEsNDI6WzEsMzNdLDQzOlsxLDM0XSw1MDpbMSwyNl0sNTM6MjR9LHsxNzozNSwzMDoyMiw0MToyMyw1MDpbMSwyNl0sNTI6WzEsMjVdLDUzOjI0fSx7MTc6MzYsMzA6MjIsNDE6MjMsNTA6WzEsMjZdLDUyOlsxLDI1XSw1MzoyNH0sezE3OjM3LDMwOjIyLDQxOjIzLDUwOlsxLDI2XSw1MjpbMSwyNV0sNTM6MjR9LHsyNTpbMSwzOF19LHsxODpbMiw0OF0sMjU6WzIsNDhdLDMzOlsyLDQ4XSwzOTozOSw0MjpbMiw0OF0sNDM6WzIsNDhdLDQ0OlsyLDQ4XSw0NTpbMiw0OF0sNDY6WzIsNDhdLDUwOlsyLDQ4XSw1MjpbMiw0OF19LHsxODpbMiwyMl0sMjU6WzIsMjJdLDMzOlsyLDIyXSw0NjpbMiwyMl19LHsxODpbMiwzNV0sMjU6WzIsMzVdLDMzOlsyLDM1XSw0MjpbMiwzNV0sNDM6WzIsMzVdLDQ0OlsyLDM1XSw0NTpbMiwzNV0sNDY6WzIsMzVdLDUwOlsyLDM1XSw1MjpbMiwzNV0sNTQ6WzEsNDBdfSx7MzA6NDEsNTA6WzEsMjZdLDUzOjI0fSx7MTg6WzIsMzddLDI1OlsyLDM3XSwzMzpbMiwzN10sNDI6WzIsMzddLDQzOlsyLDM3XSw0NDpbMiwzN10sNDU6WzIsMzddLDQ2OlsyLDM3XSw1MDpbMiwzN10sNTI6WzIsMzddLDU0OlsyLDM3XX0sezMzOlsxLDQyXX0sezIwOjQzLDI3OjQ0LDI4OlsxLDQ1XSwyOTpbMiw0MF19LHsyMzo0NiwyNzo0NywyODpbMSw0NV0sMjk6WzIsNDJdfSx7MTU6WzEsNDhdfSx7MjU6WzIsNDZdLDMwOjUxLDM2OjQ5LDM4OjUwLDQxOjU1LDQyOlsxLDUyXSw0MzpbMSw1M10sNDQ6WzEsNTRdLDQ1OlsxLDU2XSw0Nzo1Nyw0ODo1OCw0OTo2MCw1MDpbMSw1OV0sNTI6WzEsMjVdLDUzOjI0fSx7MjU6WzIsMzFdLDQyOlsyLDMxXSw0MzpbMiwzMV0sNDQ6WzIsMzFdLDQ1OlsyLDMxXSw1MDpbMiwzMV0sNTI6WzIsMzFdfSx7MjU6WzIsMzJdLDQyOlsyLDMyXSw0MzpbMiwzMl0sNDQ6WzIsMzJdLDQ1OlsyLDMyXSw1MDpbMiwzMl0sNTI6WzIsMzJdfSx7MjU6WzIsMzNdLDQyOlsyLDMzXSw0MzpbMiwzM10sNDQ6WzIsMzNdLDQ1OlsyLDMzXSw1MDpbMiwzM10sNTI6WzIsMzNdfSx7MjU6WzEsNjFdfSx7MjU6WzEsNjJdfSx7MTg6WzEsNjNdfSx7NTpbMiwxN10sMTI6WzIsMTddLDEzOlsyLDE3XSwxNjpbMiwxN10sMjQ6WzIsMTddLDI2OlsyLDE3XSwyODpbMiwxN10sMjk6WzIsMTddLDMxOlsyLDE3XSwzMjpbMiwxN10sMzQ6WzIsMTddfSx7MTg6WzIsNTBdLDI1OlsyLDUwXSwzMDo1MSwzMzpbMiw1MF0sMzY6NjUsNDA6NjQsNDE6NTUsNDI6WzEsNTJdLDQzOlsxLDUzXSw0NDpbMSw1NF0sNDU6WzEsNTZdLDQ2OlsyLDUwXSw0Nzo2Niw0ODo1OCw0OTo2MCw1MDpbMSw1OV0sNTI6WzEsMjVdLDUzOjI0fSx7NTA6WzEsNjddfSx7MTg6WzIsMzRdLDI1OlsyLDM0XSwzMzpbMiwzNF0sNDI6WzIsMzRdLDQzOlsyLDM0XSw0NDpbMiwzNF0sNDU6WzIsMzRdLDQ2OlsyLDM0XSw1MDpbMiwzNF0sNTI6WzIsMzRdfSx7NTpbMiwxOF0sMTI6WzIsMThdLDEzOlsyLDE4XSwxNjpbMiwxOF0sMjQ6WzIsMThdLDI2OlsyLDE4XSwyODpbMiwxOF0sMjk6WzIsMThdLDMxOlsyLDE4XSwzMjpbMiwxOF0sMzQ6WzIsMThdfSx7MjE6NjgsMjk6WzEsNjldfSx7Mjk6WzIsNDFdfSx7NDo3MCw2OjMsMTI6WzIsMzhdLDEzOlsyLDM4XSwxNjpbMiwzOF0sMjQ6WzIsMzhdLDI2OlsyLDM4XSwyOTpbMiwzOF0sMzE6WzIsMzhdLDMyOlsyLDM4XSwzNDpbMiwzOF19LHsyMTo3MSwyOTpbMSw2OV19LHsyOTpbMiw0M119LHs1OlsyLDldLDEyOlsyLDldLDEzOlsyLDldLDE2OlsyLDldLDI0OlsyLDldLDI2OlsyLDldLDI4OlsyLDldLDI5OlsyLDldLDMxOlsyLDldLDMyOlsyLDldLDM0OlsyLDldfSx7MjU6WzIsNDRdLDM3OjcyLDQ3OjczLDQ4OjU4LDQ5OjYwLDUwOlsxLDc0XX0sezI1OlsxLDc1XX0sezE4OlsyLDIzXSwyNTpbMiwyM10sMzM6WzIsMjNdLDQyOlsyLDIzXSw0MzpbMiwyM10sNDQ6WzIsMjNdLDQ1OlsyLDIzXSw0NjpbMiwyM10sNTA6WzIsMjNdLDUyOlsyLDIzXX0sezE4OlsyLDI0XSwyNTpbMiwyNF0sMzM6WzIsMjRdLDQyOlsyLDI0XSw0MzpbMiwyNF0sNDQ6WzIsMjRdLDQ1OlsyLDI0XSw0NjpbMiwyNF0sNTA6WzIsMjRdLDUyOlsyLDI0XX0sezE4OlsyLDI1XSwyNTpbMiwyNV0sMzM6WzIsMjVdLDQyOlsyLDI1XSw0MzpbMiwyNV0sNDQ6WzIsMjVdLDQ1OlsyLDI1XSw0NjpbMiwyNV0sNTA6WzIsMjVdLDUyOlsyLDI1XX0sezE4OlsyLDI2XSwyNTpbMiwyNl0sMzM6WzIsMjZdLDQyOlsyLDI2XSw0MzpbMiwyNl0sNDQ6WzIsMjZdLDQ1OlsyLDI2XSw0NjpbMiwyNl0sNTA6WzIsMjZdLDUyOlsyLDI2XX0sezE4OlsyLDI3XSwyNTpbMiwyN10sMzM6WzIsMjddLDQyOlsyLDI3XSw0MzpbMiwyN10sNDQ6WzIsMjddLDQ1OlsyLDI3XSw0NjpbMiwyN10sNTA6WzIsMjddLDUyOlsyLDI3XX0sezE3Ojc2LDMwOjIyLDQxOjIzLDUwOlsxLDI2XSw1MjpbMSwyNV0sNTM6MjR9LHsyNTpbMiw0N119LHsxODpbMiwyOV0sMjU6WzIsMjldLDMzOlsyLDI5XSw0NjpbMiwyOV0sNDk6NzcsNTA6WzEsNzRdfSx7MTg6WzIsMzddLDI1OlsyLDM3XSwzMzpbMiwzN10sNDI6WzIsMzddLDQzOlsyLDM3XSw0NDpbMiwzN10sNDU6WzIsMzddLDQ2OlsyLDM3XSw1MDpbMiwzN10sNTE6WzEsNzhdLDUyOlsyLDM3XSw1NDpbMiwzN119LHsxODpbMiw1Ml0sMjU6WzIsNTJdLDMzOlsyLDUyXSw0NjpbMiw1Ml0sNTA6WzIsNTJdfSx7MTI6WzIsMTNdLDEzOlsyLDEzXSwxNjpbMiwxM10sMjQ6WzIsMTNdLDI2OlsyLDEzXSwyODpbMiwxM10sMjk6WzIsMTNdLDMxOlsyLDEzXSwzMjpbMiwxM10sMzQ6WzIsMTNdfSx7MTI6WzIsMTRdLDEzOlsyLDE0XSwxNjpbMiwxNF0sMjQ6WzIsMTRdLDI2OlsyLDE0XSwyODpbMiwxNF0sMjk6WzIsMTRdLDMxOlsyLDE0XSwzMjpbMiwxNF0sMzQ6WzIsMTRdfSx7MTI6WzIsMTBdfSx7MTg6WzIsMjFdLDI1OlsyLDIxXSwzMzpbMiwyMV0sNDY6WzIsMjFdfSx7MTg6WzIsNDldLDI1OlsyLDQ5XSwzMzpbMiw0OV0sNDI6WzIsNDldLDQzOlsyLDQ5XSw0NDpbMiw0OV0sNDU6WzIsNDldLDQ2OlsyLDQ5XSw1MDpbMiw0OV0sNTI6WzIsNDldfSx7MTg6WzIsNTFdLDI1OlsyLDUxXSwzMzpbMiw1MV0sNDY6WzIsNTFdfSx7MTg6WzIsMzZdLDI1OlsyLDM2XSwzMzpbMiwzNl0sNDI6WzIsMzZdLDQzOlsyLDM2XSw0NDpbMiwzNl0sNDU6WzIsMzZdLDQ2OlsyLDM2XSw1MDpbMiwzNl0sNTI6WzIsMzZdLDU0OlsyLDM2XX0sezU6WzIsMTFdLDEyOlsyLDExXSwxMzpbMiwxMV0sMTY6WzIsMTFdLDI0OlsyLDExXSwyNjpbMiwxMV0sMjg6WzIsMTFdLDI5OlsyLDExXSwzMTpbMiwxMV0sMzI6WzIsMTFdLDM0OlsyLDExXX0sezMwOjc5LDUwOlsxLDI2XSw1MzoyNH0sezI5OlsyLDE1XX0sezU6WzIsMTJdLDEyOlsyLDEyXSwxMzpbMiwxMl0sMTY6WzIsMTJdLDI0OlsyLDEyXSwyNjpbMiwxMl0sMjg6WzIsMTJdLDI5OlsyLDEyXSwzMTpbMiwxMl0sMzI6WzIsMTJdLDM0OlsyLDEyXX0sezI1OlsxLDgwXX0sezI1OlsyLDQ1XX0sezUxOlsxLDc4XX0sezU6WzIsMjBdLDEyOlsyLDIwXSwxMzpbMiwyMF0sMTY6WzIsMjBdLDI0OlsyLDIwXSwyNjpbMiwyMF0sMjg6WzIsMjBdLDI5OlsyLDIwXSwzMTpbMiwyMF0sMzI6WzIsMjBdLDM0OlsyLDIwXX0sezQ2OlsxLDgxXX0sezE4OlsyLDUzXSwyNTpbMiw1M10sMzM6WzIsNTNdLDQ2OlsyLDUzXSw1MDpbMiw1M119LHszMDo1MSwzNjo4Miw0MTo1NSw0MjpbMSw1Ml0sNDM6WzEsNTNdLDQ0OlsxLDU0XSw0NTpbMSw1Nl0sNTA6WzEsMjZdLDUyOlsxLDI1XSw1MzoyNH0sezI1OlsxLDgzXX0sezU6WzIsMTldLDEyOlsyLDE5XSwxMzpbMiwxOV0sMTY6WzIsMTldLDI0OlsyLDE5XSwyNjpbMiwxOV0sMjg6WzIsMTldLDI5OlsyLDE5XSwzMTpbMiwxOV0sMzI6WzIsMTldLDM0OlsyLDE5XX0sezE4OlsyLDI4XSwyNTpbMiwyOF0sMzM6WzIsMjhdLDQyOlsyLDI4XSw0MzpbMiwyOF0sNDQ6WzIsMjhdLDQ1OlsyLDI4XSw0NjpbMiwyOF0sNTA6WzIsMjhdLDUyOlsyLDI4XX0sezE4OlsyLDMwXSwyNTpbMiwzMF0sMzM6WzIsMzBdLDQ2OlsyLDMwXSw1MDpbMiwzMF19LHs1OlsyLDE2XSwxMjpbMiwxNl0sMTM6WzIsMTZdLDE2OlsyLDE2XSwyNDpbMiwxNl0sMjY6WzIsMTZdLDI4OlsyLDE2XSwyOTpbMiwxNl0sMzE6WzIsMTZdLDMyOlsyLDE2XSwzNDpbMiwxNl19XSxcbmRlZmF1bHRBY3Rpb25zOiB7NDpbMiwxXSw0NDpbMiw0MV0sNDc6WzIsNDNdLDU3OlsyLDQ3XSw2MzpbMiwxMF0sNzA6WzIsMTVdLDczOlsyLDQ1XX0sXG5wYXJzZUVycm9yOiBmdW5jdGlvbiBwYXJzZUVycm9yKHN0ciwgaGFzaCkge1xuICAgIHRocm93IG5ldyBFcnJvcihzdHIpO1xufSxcbnBhcnNlOiBmdW5jdGlvbiBwYXJzZShpbnB1dCkge1xuICAgIHZhciBzZWxmID0gdGhpcywgc3RhY2sgPSBbMF0sIHZzdGFjayA9IFtudWxsXSwgbHN0YWNrID0gW10sIHRhYmxlID0gdGhpcy50YWJsZSwgeXl0ZXh0ID0gXCJcIiwgeXlsaW5lbm8gPSAwLCB5eWxlbmcgPSAwLCByZWNvdmVyaW5nID0gMCwgVEVSUk9SID0gMiwgRU9GID0gMTtcbiAgICB0aGlzLmxleGVyLnNldElucHV0KGlucHV0KTtcbiAgICB0aGlzLmxleGVyLnl5ID0gdGhpcy55eTtcbiAgICB0aGlzLnl5LmxleGVyID0gdGhpcy5sZXhlcjtcbiAgICB0aGlzLnl5LnBhcnNlciA9IHRoaXM7XG4gICAgaWYgKHR5cGVvZiB0aGlzLmxleGVyLnl5bGxvYyA9PSBcInVuZGVmaW5lZFwiKVxuICAgICAgICB0aGlzLmxleGVyLnl5bGxvYyA9IHt9O1xuICAgIHZhciB5eWxvYyA9IHRoaXMubGV4ZXIueXlsbG9jO1xuICAgIGxzdGFjay5wdXNoKHl5bG9jKTtcbiAgICB2YXIgcmFuZ2VzID0gdGhpcy5sZXhlci5vcHRpb25zICYmIHRoaXMubGV4ZXIub3B0aW9ucy5yYW5nZXM7XG4gICAgaWYgKHR5cGVvZiB0aGlzLnl5LnBhcnNlRXJyb3IgPT09IFwiZnVuY3Rpb25cIilcbiAgICAgICAgdGhpcy5wYXJzZUVycm9yID0gdGhpcy55eS5wYXJzZUVycm9yO1xuICAgIGZ1bmN0aW9uIHBvcFN0YWNrKG4pIHtcbiAgICAgICAgc3RhY2subGVuZ3RoID0gc3RhY2subGVuZ3RoIC0gMiAqIG47XG4gICAgICAgIHZzdGFjay5sZW5ndGggPSB2c3RhY2subGVuZ3RoIC0gbjtcbiAgICAgICAgbHN0YWNrLmxlbmd0aCA9IGxzdGFjay5sZW5ndGggLSBuO1xuICAgIH1cbiAgICBmdW5jdGlvbiBsZXgoKSB7XG4gICAgICAgIHZhciB0b2tlbjtcbiAgICAgICAgdG9rZW4gPSBzZWxmLmxleGVyLmxleCgpIHx8IDE7XG4gICAgICAgIGlmICh0eXBlb2YgdG9rZW4gIT09IFwibnVtYmVyXCIpIHtcbiAgICAgICAgICAgIHRva2VuID0gc2VsZi5zeW1ib2xzX1t0b2tlbl0gfHwgdG9rZW47XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIHRva2VuO1xuICAgIH1cbiAgICB2YXIgc3ltYm9sLCBwcmVFcnJvclN5bWJvbCwgc3RhdGUsIGFjdGlvbiwgYSwgciwgeXl2YWwgPSB7fSwgcCwgbGVuLCBuZXdTdGF0ZSwgZXhwZWN0ZWQ7XG4gICAgd2hpbGUgKHRydWUpIHtcbiAgICAgICAgc3RhdGUgPSBzdGFja1tzdGFjay5sZW5ndGggLSAxXTtcbiAgICAgICAgaWYgKHRoaXMuZGVmYXVsdEFjdGlvbnNbc3RhdGVdKSB7XG4gICAgICAgICAgICBhY3Rpb24gPSB0aGlzLmRlZmF1bHRBY3Rpb25zW3N0YXRlXTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIGlmIChzeW1ib2wgPT09IG51bGwgfHwgdHlwZW9mIHN5bWJvbCA9PSBcInVuZGVmaW5lZFwiKSB7XG4gICAgICAgICAgICAgICAgc3ltYm9sID0gbGV4KCk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBhY3Rpb24gPSB0YWJsZVtzdGF0ZV0gJiYgdGFibGVbc3RhdGVdW3N5bWJvbF07XG4gICAgICAgIH1cbiAgICAgICAgaWYgKHR5cGVvZiBhY3Rpb24gPT09IFwidW5kZWZpbmVkXCIgfHwgIWFjdGlvbi5sZW5ndGggfHwgIWFjdGlvblswXSkge1xuICAgICAgICAgICAgdmFyIGVyclN0ciA9IFwiXCI7XG4gICAgICAgICAgICBpZiAoIXJlY292ZXJpbmcpIHtcbiAgICAgICAgICAgICAgICBleHBlY3RlZCA9IFtdO1xuICAgICAgICAgICAgICAgIGZvciAocCBpbiB0YWJsZVtzdGF0ZV0pXG4gICAgICAgICAgICAgICAgICAgIGlmICh0aGlzLnRlcm1pbmFsc19bcF0gJiYgcCA+IDIpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGV4cGVjdGVkLnB1c2goXCInXCIgKyB0aGlzLnRlcm1pbmFsc19bcF0gKyBcIidcIik7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBpZiAodGhpcy5sZXhlci5zaG93UG9zaXRpb24pIHtcbiAgICAgICAgICAgICAgICAgICAgZXJyU3RyID0gXCJQYXJzZSBlcnJvciBvbiBsaW5lIFwiICsgKHl5bGluZW5vICsgMSkgKyBcIjpcXG5cIiArIHRoaXMubGV4ZXIuc2hvd1Bvc2l0aW9uKCkgKyBcIlxcbkV4cGVjdGluZyBcIiArIGV4cGVjdGVkLmpvaW4oXCIsIFwiKSArIFwiLCBnb3QgJ1wiICsgKHRoaXMudGVybWluYWxzX1tzeW1ib2xdIHx8IHN5bWJvbCkgKyBcIidcIjtcbiAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICBlcnJTdHIgPSBcIlBhcnNlIGVycm9yIG9uIGxpbmUgXCIgKyAoeXlsaW5lbm8gKyAxKSArIFwiOiBVbmV4cGVjdGVkIFwiICsgKHN5bWJvbCA9PSAxP1wiZW5kIG9mIGlucHV0XCI6XCInXCIgKyAodGhpcy50ZXJtaW5hbHNfW3N5bWJvbF0gfHwgc3ltYm9sKSArIFwiJ1wiKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgdGhpcy5wYXJzZUVycm9yKGVyclN0ciwge3RleHQ6IHRoaXMubGV4ZXIubWF0Y2gsIHRva2VuOiB0aGlzLnRlcm1pbmFsc19bc3ltYm9sXSB8fCBzeW1ib2wsIGxpbmU6IHRoaXMubGV4ZXIueXlsaW5lbm8sIGxvYzogeXlsb2MsIGV4cGVjdGVkOiBleHBlY3RlZH0pO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIGlmIChhY3Rpb25bMF0gaW5zdGFuY2VvZiBBcnJheSAmJiBhY3Rpb24ubGVuZ3RoID4gMSkge1xuICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKFwiUGFyc2UgRXJyb3I6IG11bHRpcGxlIGFjdGlvbnMgcG9zc2libGUgYXQgc3RhdGU6IFwiICsgc3RhdGUgKyBcIiwgdG9rZW46IFwiICsgc3ltYm9sKTtcbiAgICAgICAgfVxuICAgICAgICBzd2l0Y2ggKGFjdGlvblswXSkge1xuICAgICAgICBjYXNlIDE6XG4gICAgICAgICAgICBzdGFjay5wdXNoKHN5bWJvbCk7XG4gICAgICAgICAgICB2c3RhY2sucHVzaCh0aGlzLmxleGVyLnl5dGV4dCk7XG4gICAgICAgICAgICBsc3RhY2sucHVzaCh0aGlzLmxleGVyLnl5bGxvYyk7XG4gICAgICAgICAgICBzdGFjay5wdXNoKGFjdGlvblsxXSk7XG4gICAgICAgICAgICBzeW1ib2wgPSBudWxsO1xuICAgICAgICAgICAgaWYgKCFwcmVFcnJvclN5bWJvbCkge1xuICAgICAgICAgICAgICAgIHl5bGVuZyA9IHRoaXMubGV4ZXIueXlsZW5nO1xuICAgICAgICAgICAgICAgIHl5dGV4dCA9IHRoaXMubGV4ZXIueXl0ZXh0O1xuICAgICAgICAgICAgICAgIHl5bGluZW5vID0gdGhpcy5sZXhlci55eWxpbmVubztcbiAgICAgICAgICAgICAgICB5eWxvYyA9IHRoaXMubGV4ZXIueXlsbG9jO1xuICAgICAgICAgICAgICAgIGlmIChyZWNvdmVyaW5nID4gMClcbiAgICAgICAgICAgICAgICAgICAgcmVjb3ZlcmluZy0tO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICBzeW1ib2wgPSBwcmVFcnJvclN5bWJvbDtcbiAgICAgICAgICAgICAgICBwcmVFcnJvclN5bWJvbCA9IG51bGw7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBicmVhaztcbiAgICAgICAgY2FzZSAyOlxuICAgICAgICAgICAgbGVuID0gdGhpcy5wcm9kdWN0aW9uc19bYWN0aW9uWzFdXVsxXTtcbiAgICAgICAgICAgIHl5dmFsLiQgPSB2c3RhY2tbdnN0YWNrLmxlbmd0aCAtIGxlbl07XG4gICAgICAgICAgICB5eXZhbC5fJCA9IHtmaXJzdF9saW5lOiBsc3RhY2tbbHN0YWNrLmxlbmd0aCAtIChsZW4gfHwgMSldLmZpcnN0X2xpbmUsIGxhc3RfbGluZTogbHN0YWNrW2xzdGFjay5sZW5ndGggLSAxXS5sYXN0X2xpbmUsIGZpcnN0X2NvbHVtbjogbHN0YWNrW2xzdGFjay5sZW5ndGggLSAobGVuIHx8IDEpXS5maXJzdF9jb2x1bW4sIGxhc3RfY29sdW1uOiBsc3RhY2tbbHN0YWNrLmxlbmd0aCAtIDFdLmxhc3RfY29sdW1ufTtcbiAgICAgICAgICAgIGlmIChyYW5nZXMpIHtcbiAgICAgICAgICAgICAgICB5eXZhbC5fJC5yYW5nZSA9IFtsc3RhY2tbbHN0YWNrLmxlbmd0aCAtIChsZW4gfHwgMSldLnJhbmdlWzBdLCBsc3RhY2tbbHN0YWNrLmxlbmd0aCAtIDFdLnJhbmdlWzFdXTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHIgPSB0aGlzLnBlcmZvcm1BY3Rpb24uY2FsbCh5eXZhbCwgeXl0ZXh0LCB5eWxlbmcsIHl5bGluZW5vLCB0aGlzLnl5LCBhY3Rpb25bMV0sIHZzdGFjaywgbHN0YWNrKTtcbiAgICAgICAgICAgIGlmICh0eXBlb2YgciAhPT0gXCJ1bmRlZmluZWRcIikge1xuICAgICAgICAgICAgICAgIHJldHVybiByO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgaWYgKGxlbikge1xuICAgICAgICAgICAgICAgIHN0YWNrID0gc3RhY2suc2xpY2UoMCwgLTEgKiBsZW4gKiAyKTtcbiAgICAgICAgICAgICAgICB2c3RhY2sgPSB2c3RhY2suc2xpY2UoMCwgLTEgKiBsZW4pO1xuICAgICAgICAgICAgICAgIGxzdGFjayA9IGxzdGFjay5zbGljZSgwLCAtMSAqIGxlbik7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBzdGFjay5wdXNoKHRoaXMucHJvZHVjdGlvbnNfW2FjdGlvblsxXV1bMF0pO1xuICAgICAgICAgICAgdnN0YWNrLnB1c2goeXl2YWwuJCk7XG4gICAgICAgICAgICBsc3RhY2sucHVzaCh5eXZhbC5fJCk7XG4gICAgICAgICAgICBuZXdTdGF0ZSA9IHRhYmxlW3N0YWNrW3N0YWNrLmxlbmd0aCAtIDJdXVtzdGFja1tzdGFjay5sZW5ndGggLSAxXV07XG4gICAgICAgICAgICBzdGFjay5wdXNoKG5ld1N0YXRlKTtcbiAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICBjYXNlIDM6XG4gICAgICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICAgICAgfVxuICAgIH1cbiAgICByZXR1cm4gdHJ1ZTtcbn1cbn07XG4vKiBKaXNvbiBnZW5lcmF0ZWQgbGV4ZXIgKi9cbnZhciBsZXhlciA9IChmdW5jdGlvbigpe1xudmFyIGxleGVyID0gKHtFT0Y6MSxcbnBhcnNlRXJyb3I6ZnVuY3Rpb24gcGFyc2VFcnJvcihzdHIsIGhhc2gpIHtcbiAgICAgICAgaWYgKHRoaXMueXkucGFyc2VyKSB7XG4gICAgICAgICAgICB0aGlzLnl5LnBhcnNlci5wYXJzZUVycm9yKHN0ciwgaGFzaCk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3Ioc3RyKTtcbiAgICAgICAgfVxuICAgIH0sXG5zZXRJbnB1dDpmdW5jdGlvbiAoaW5wdXQpIHtcbiAgICAgICAgdGhpcy5faW5wdXQgPSBpbnB1dDtcbiAgICAgICAgdGhpcy5fbW9yZSA9IHRoaXMuX2xlc3MgPSB0aGlzLmRvbmUgPSBmYWxzZTtcbiAgICAgICAgdGhpcy55eWxpbmVubyA9IHRoaXMueXlsZW5nID0gMDtcbiAgICAgICAgdGhpcy55eXRleHQgPSB0aGlzLm1hdGNoZWQgPSB0aGlzLm1hdGNoID0gJyc7XG4gICAgICAgIHRoaXMuY29uZGl0aW9uU3RhY2sgPSBbJ0lOSVRJQUwnXTtcbiAgICAgICAgdGhpcy55eWxsb2MgPSB7Zmlyc3RfbGluZToxLGZpcnN0X2NvbHVtbjowLGxhc3RfbGluZToxLGxhc3RfY29sdW1uOjB9O1xuICAgICAgICBpZiAodGhpcy5vcHRpb25zLnJhbmdlcykgdGhpcy55eWxsb2MucmFuZ2UgPSBbMCwwXTtcbiAgICAgICAgdGhpcy5vZmZzZXQgPSAwO1xuICAgICAgICByZXR1cm4gdGhpcztcbiAgICB9LFxuaW5wdXQ6ZnVuY3Rpb24gKCkge1xuICAgICAgICB2YXIgY2ggPSB0aGlzLl9pbnB1dFswXTtcbiAgICAgICAgdGhpcy55eXRleHQgKz0gY2g7XG4gICAgICAgIHRoaXMueXlsZW5nKys7XG4gICAgICAgIHRoaXMub2Zmc2V0Kys7XG4gICAgICAgIHRoaXMubWF0Y2ggKz0gY2g7XG4gICAgICAgIHRoaXMubWF0Y2hlZCArPSBjaDtcbiAgICAgICAgdmFyIGxpbmVzID0gY2gubWF0Y2goLyg/Olxcclxcbj98XFxuKS4qL2cpO1xuICAgICAgICBpZiAobGluZXMpIHtcbiAgICAgICAgICAgIHRoaXMueXlsaW5lbm8rKztcbiAgICAgICAgICAgIHRoaXMueXlsbG9jLmxhc3RfbGluZSsrO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgdGhpcy55eWxsb2MubGFzdF9jb2x1bW4rKztcbiAgICAgICAgfVxuICAgICAgICBpZiAodGhpcy5vcHRpb25zLnJhbmdlcykgdGhpcy55eWxsb2MucmFuZ2VbMV0rKztcblxuICAgICAgICB0aGlzLl9pbnB1dCA9IHRoaXMuX2lucHV0LnNsaWNlKDEpO1xuICAgICAgICByZXR1cm4gY2g7XG4gICAgfSxcbnVucHV0OmZ1bmN0aW9uIChjaCkge1xuICAgICAgICB2YXIgbGVuID0gY2gubGVuZ3RoO1xuICAgICAgICB2YXIgbGluZXMgPSBjaC5zcGxpdCgvKD86XFxyXFxuP3xcXG4pL2cpO1xuXG4gICAgICAgIHRoaXMuX2lucHV0ID0gY2ggKyB0aGlzLl9pbnB1dDtcbiAgICAgICAgdGhpcy55eXRleHQgPSB0aGlzLnl5dGV4dC5zdWJzdHIoMCwgdGhpcy55eXRleHQubGVuZ3RoLWxlbi0xKTtcbiAgICAgICAgLy90aGlzLnl5bGVuZyAtPSBsZW47XG4gICAgICAgIHRoaXMub2Zmc2V0IC09IGxlbjtcbiAgICAgICAgdmFyIG9sZExpbmVzID0gdGhpcy5tYXRjaC5zcGxpdCgvKD86XFxyXFxuP3xcXG4pL2cpO1xuICAgICAgICB0aGlzLm1hdGNoID0gdGhpcy5tYXRjaC5zdWJzdHIoMCwgdGhpcy5tYXRjaC5sZW5ndGgtMSk7XG4gICAgICAgIHRoaXMubWF0Y2hlZCA9IHRoaXMubWF0Y2hlZC5zdWJzdHIoMCwgdGhpcy5tYXRjaGVkLmxlbmd0aC0xKTtcblxuICAgICAgICBpZiAobGluZXMubGVuZ3RoLTEpIHRoaXMueXlsaW5lbm8gLT0gbGluZXMubGVuZ3RoLTE7XG4gICAgICAgIHZhciByID0gdGhpcy55eWxsb2MucmFuZ2U7XG5cbiAgICAgICAgdGhpcy55eWxsb2MgPSB7Zmlyc3RfbGluZTogdGhpcy55eWxsb2MuZmlyc3RfbGluZSxcbiAgICAgICAgICBsYXN0X2xpbmU6IHRoaXMueXlsaW5lbm8rMSxcbiAgICAgICAgICBmaXJzdF9jb2x1bW46IHRoaXMueXlsbG9jLmZpcnN0X2NvbHVtbixcbiAgICAgICAgICBsYXN0X2NvbHVtbjogbGluZXMgP1xuICAgICAgICAgICAgICAobGluZXMubGVuZ3RoID09PSBvbGRMaW5lcy5sZW5ndGggPyB0aGlzLnl5bGxvYy5maXJzdF9jb2x1bW4gOiAwKSArIG9sZExpbmVzW29sZExpbmVzLmxlbmd0aCAtIGxpbmVzLmxlbmd0aF0ubGVuZ3RoIC0gbGluZXNbMF0ubGVuZ3RoOlxuICAgICAgICAgICAgICB0aGlzLnl5bGxvYy5maXJzdF9jb2x1bW4gLSBsZW5cbiAgICAgICAgICB9O1xuXG4gICAgICAgIGlmICh0aGlzLm9wdGlvbnMucmFuZ2VzKSB7XG4gICAgICAgICAgICB0aGlzLnl5bGxvYy5yYW5nZSA9IFtyWzBdLCByWzBdICsgdGhpcy55eWxlbmcgLSBsZW5dO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiB0aGlzO1xuICAgIH0sXG5tb3JlOmZ1bmN0aW9uICgpIHtcbiAgICAgICAgdGhpcy5fbW9yZSA9IHRydWU7XG4gICAgICAgIHJldHVybiB0aGlzO1xuICAgIH0sXG5sZXNzOmZ1bmN0aW9uIChuKSB7XG4gICAgICAgIHRoaXMudW5wdXQodGhpcy5tYXRjaC5zbGljZShuKSk7XG4gICAgfSxcbnBhc3RJbnB1dDpmdW5jdGlvbiAoKSB7XG4gICAgICAgIHZhciBwYXN0ID0gdGhpcy5tYXRjaGVkLnN1YnN0cigwLCB0aGlzLm1hdGNoZWQubGVuZ3RoIC0gdGhpcy5tYXRjaC5sZW5ndGgpO1xuICAgICAgICByZXR1cm4gKHBhc3QubGVuZ3RoID4gMjAgPyAnLi4uJzonJykgKyBwYXN0LnN1YnN0cigtMjApLnJlcGxhY2UoL1xcbi9nLCBcIlwiKTtcbiAgICB9LFxudXBjb21pbmdJbnB1dDpmdW5jdGlvbiAoKSB7XG4gICAgICAgIHZhciBuZXh0ID0gdGhpcy5tYXRjaDtcbiAgICAgICAgaWYgKG5leHQubGVuZ3RoIDwgMjApIHtcbiAgICAgICAgICAgIG5leHQgKz0gdGhpcy5faW5wdXQuc3Vic3RyKDAsIDIwLW5leHQubGVuZ3RoKTtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gKG5leHQuc3Vic3RyKDAsMjApKyhuZXh0Lmxlbmd0aCA+IDIwID8gJy4uLic6JycpKS5yZXBsYWNlKC9cXG4vZywgXCJcIik7XG4gICAgfSxcbnNob3dQb3NpdGlvbjpmdW5jdGlvbiAoKSB7XG4gICAgICAgIHZhciBwcmUgPSB0aGlzLnBhc3RJbnB1dCgpO1xuICAgICAgICB2YXIgYyA9IG5ldyBBcnJheShwcmUubGVuZ3RoICsgMSkuam9pbihcIi1cIik7XG4gICAgICAgIHJldHVybiBwcmUgKyB0aGlzLnVwY29taW5nSW5wdXQoKSArIFwiXFxuXCIgKyBjK1wiXlwiO1xuICAgIH0sXG5uZXh0OmZ1bmN0aW9uICgpIHtcbiAgICAgICAgaWYgKHRoaXMuZG9uZSkge1xuICAgICAgICAgICAgcmV0dXJuIHRoaXMuRU9GO1xuICAgICAgICB9XG4gICAgICAgIGlmICghdGhpcy5faW5wdXQpIHRoaXMuZG9uZSA9IHRydWU7XG5cbiAgICAgICAgdmFyIHRva2VuLFxuICAgICAgICAgICAgbWF0Y2gsXG4gICAgICAgICAgICB0ZW1wTWF0Y2gsXG4gICAgICAgICAgICBpbmRleCxcbiAgICAgICAgICAgIGNvbCxcbiAgICAgICAgICAgIGxpbmVzO1xuICAgICAgICBpZiAoIXRoaXMuX21vcmUpIHtcbiAgICAgICAgICAgIHRoaXMueXl0ZXh0ID0gJyc7XG4gICAgICAgICAgICB0aGlzLm1hdGNoID0gJyc7XG4gICAgICAgIH1cbiAgICAgICAgdmFyIHJ1bGVzID0gdGhpcy5fY3VycmVudFJ1bGVzKCk7XG4gICAgICAgIGZvciAodmFyIGk9MDtpIDwgcnVsZXMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgIHRlbXBNYXRjaCA9IHRoaXMuX2lucHV0Lm1hdGNoKHRoaXMucnVsZXNbcnVsZXNbaV1dKTtcbiAgICAgICAgICAgIGlmICh0ZW1wTWF0Y2ggJiYgKCFtYXRjaCB8fCB0ZW1wTWF0Y2hbMF0ubGVuZ3RoID4gbWF0Y2hbMF0ubGVuZ3RoKSkge1xuICAgICAgICAgICAgICAgIG1hdGNoID0gdGVtcE1hdGNoO1xuICAgICAgICAgICAgICAgIGluZGV4ID0gaTtcbiAgICAgICAgICAgICAgICBpZiAoIXRoaXMub3B0aW9ucy5mbGV4KSBicmVhaztcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICBpZiAobWF0Y2gpIHtcbiAgICAgICAgICAgIGxpbmVzID0gbWF0Y2hbMF0ubWF0Y2goLyg/Olxcclxcbj98XFxuKS4qL2cpO1xuICAgICAgICAgICAgaWYgKGxpbmVzKSB0aGlzLnl5bGluZW5vICs9IGxpbmVzLmxlbmd0aDtcbiAgICAgICAgICAgIHRoaXMueXlsbG9jID0ge2ZpcnN0X2xpbmU6IHRoaXMueXlsbG9jLmxhc3RfbGluZSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgIGxhc3RfbGluZTogdGhpcy55eWxpbmVubysxLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgZmlyc3RfY29sdW1uOiB0aGlzLnl5bGxvYy5sYXN0X2NvbHVtbixcbiAgICAgICAgICAgICAgICAgICAgICAgICAgIGxhc3RfY29sdW1uOiBsaW5lcyA/IGxpbmVzW2xpbmVzLmxlbmd0aC0xXS5sZW5ndGgtbGluZXNbbGluZXMubGVuZ3RoLTFdLm1hdGNoKC9cXHI/XFxuPy8pWzBdLmxlbmd0aCA6IHRoaXMueXlsbG9jLmxhc3RfY29sdW1uICsgbWF0Y2hbMF0ubGVuZ3RofTtcbiAgICAgICAgICAgIHRoaXMueXl0ZXh0ICs9IG1hdGNoWzBdO1xuICAgICAgICAgICAgdGhpcy5tYXRjaCArPSBtYXRjaFswXTtcbiAgICAgICAgICAgIHRoaXMubWF0Y2hlcyA9IG1hdGNoO1xuICAgICAgICAgICAgdGhpcy55eWxlbmcgPSB0aGlzLnl5dGV4dC5sZW5ndGg7XG4gICAgICAgICAgICBpZiAodGhpcy5vcHRpb25zLnJhbmdlcykge1xuICAgICAgICAgICAgICAgIHRoaXMueXlsbG9jLnJhbmdlID0gW3RoaXMub2Zmc2V0LCB0aGlzLm9mZnNldCArPSB0aGlzLnl5bGVuZ107XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICB0aGlzLl9tb3JlID0gZmFsc2U7XG4gICAgICAgICAgICB0aGlzLl9pbnB1dCA9IHRoaXMuX2lucHV0LnNsaWNlKG1hdGNoWzBdLmxlbmd0aCk7XG4gICAgICAgICAgICB0aGlzLm1hdGNoZWQgKz0gbWF0Y2hbMF07XG4gICAgICAgICAgICB0b2tlbiA9IHRoaXMucGVyZm9ybUFjdGlvbi5jYWxsKHRoaXMsIHRoaXMueXksIHRoaXMsIHJ1bGVzW2luZGV4XSx0aGlzLmNvbmRpdGlvblN0YWNrW3RoaXMuY29uZGl0aW9uU3RhY2subGVuZ3RoLTFdKTtcbiAgICAgICAgICAgIGlmICh0aGlzLmRvbmUgJiYgdGhpcy5faW5wdXQpIHRoaXMuZG9uZSA9IGZhbHNlO1xuICAgICAgICAgICAgaWYgKHRva2VuKSByZXR1cm4gdG9rZW47XG4gICAgICAgICAgICBlbHNlIHJldHVybjtcbiAgICAgICAgfVxuICAgICAgICBpZiAodGhpcy5faW5wdXQgPT09IFwiXCIpIHtcbiAgICAgICAgICAgIHJldHVybiB0aGlzLkVPRjtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHJldHVybiB0aGlzLnBhcnNlRXJyb3IoJ0xleGljYWwgZXJyb3Igb24gbGluZSAnKyh0aGlzLnl5bGluZW5vKzEpKycuIFVucmVjb2duaXplZCB0ZXh0LlxcbicrdGhpcy5zaG93UG9zaXRpb24oKSxcbiAgICAgICAgICAgICAgICAgICAge3RleHQ6IFwiXCIsIHRva2VuOiBudWxsLCBsaW5lOiB0aGlzLnl5bGluZW5vfSk7XG4gICAgICAgIH1cbiAgICB9LFxubGV4OmZ1bmN0aW9uIGxleCgpIHtcbiAgICAgICAgdmFyIHIgPSB0aGlzLm5leHQoKTtcbiAgICAgICAgaWYgKHR5cGVvZiByICE9PSAndW5kZWZpbmVkJykge1xuICAgICAgICAgICAgcmV0dXJuIHI7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICByZXR1cm4gdGhpcy5sZXgoKTtcbiAgICAgICAgfVxuICAgIH0sXG5iZWdpbjpmdW5jdGlvbiBiZWdpbihjb25kaXRpb24pIHtcbiAgICAgICAgdGhpcy5jb25kaXRpb25TdGFjay5wdXNoKGNvbmRpdGlvbik7XG4gICAgfSxcbnBvcFN0YXRlOmZ1bmN0aW9uIHBvcFN0YXRlKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5jb25kaXRpb25TdGFjay5wb3AoKTtcbiAgICB9LFxuX2N1cnJlbnRSdWxlczpmdW5jdGlvbiBfY3VycmVudFJ1bGVzKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5jb25kaXRpb25zW3RoaXMuY29uZGl0aW9uU3RhY2tbdGhpcy5jb25kaXRpb25TdGFjay5sZW5ndGgtMV1dLnJ1bGVzO1xuICAgIH0sXG50b3BTdGF0ZTpmdW5jdGlvbiAoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLmNvbmRpdGlvblN0YWNrW3RoaXMuY29uZGl0aW9uU3RhY2subGVuZ3RoLTJdO1xuICAgIH0sXG5wdXNoU3RhdGU6ZnVuY3Rpb24gYmVnaW4oY29uZGl0aW9uKSB7XG4gICAgICAgIHRoaXMuYmVnaW4oY29uZGl0aW9uKTtcbiAgICB9fSk7XG5sZXhlci5vcHRpb25zID0ge307XG5sZXhlci5wZXJmb3JtQWN0aW9uID0gZnVuY3Rpb24gYW5vbnltb3VzKHl5LHl5XywkYXZvaWRpbmdfbmFtZV9jb2xsaXNpb25zLFlZX1NUQVJUKSB7XG5cblxuZnVuY3Rpb24gc3RyaXAoc3RhcnQsIGVuZCkge1xuICByZXR1cm4geXlfLnl5dGV4dCA9IHl5Xy55eXRleHQuc3Vic3RyKHN0YXJ0LCB5eV8ueXlsZW5nLWVuZCk7XG59XG5cblxudmFyIFlZU1RBVEU9WVlfU1RBUlRcbnN3aXRjaCgkYXZvaWRpbmdfbmFtZV9jb2xsaXNpb25zKSB7XG5jYXNlIDA6XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGlmKHl5Xy55eXRleHQuc2xpY2UoLTIpID09PSBcIlxcXFxcXFxcXCIpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBzdHJpcCgwLDEpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMuYmVnaW4oXCJtdVwiKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgfSBlbHNlIGlmKHl5Xy55eXRleHQuc2xpY2UoLTEpID09PSBcIlxcXFxcIikge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHN0cmlwKDAsMSk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5iZWdpbihcImVtdVwiKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB0aGlzLmJlZ2luKFwibXVcIik7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgaWYoeXlfLnl5dGV4dCkgcmV0dXJuIDEyO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgXG5icmVhaztcbmNhc2UgMTpyZXR1cm4gMTI7XG5icmVhaztcbmNhc2UgMjpcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5wb3BTdGF0ZSgpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICByZXR1cm4gMTI7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBcbmJyZWFrO1xuY2FzZSAzOlxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHl5Xy55eXRleHQgPSB5eV8ueXl0ZXh0LnN1YnN0cig1LCB5eV8ueXlsZW5nLTkpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMucG9wU3RhdGUoKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICByZXR1cm4gMTU7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBcbmJyZWFrO1xuY2FzZSA0OiByZXR1cm4gMTI7IFxuYnJlYWs7XG5jYXNlIDU6c3RyaXAoMCw0KTsgdGhpcy5wb3BTdGF0ZSgpOyByZXR1cm4gMTM7XG5icmVhaztcbmNhc2UgNjpyZXR1cm4gNDU7XG5icmVhaztcbmNhc2UgNzpyZXR1cm4gNDY7XG5icmVhaztcbmNhc2UgODogcmV0dXJuIDE2OyBcbmJyZWFrO1xuY2FzZSA5OlxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMucG9wU3RhdGUoKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB0aGlzLmJlZ2luKCdyYXcnKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICByZXR1cm4gMTg7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBcbmJyZWFrO1xuY2FzZSAxMDpyZXR1cm4gMzQ7XG5icmVhaztcbmNhc2UgMTE6cmV0dXJuIDI0O1xuYnJlYWs7XG5jYXNlIDEyOnJldHVybiAyOTtcbmJyZWFrO1xuY2FzZSAxMzp0aGlzLnBvcFN0YXRlKCk7IHJldHVybiAyODtcbmJyZWFrO1xuY2FzZSAxNDp0aGlzLnBvcFN0YXRlKCk7IHJldHVybiAyODtcbmJyZWFrO1xuY2FzZSAxNTpyZXR1cm4gMjY7XG5icmVhaztcbmNhc2UgMTY6cmV0dXJuIDI2O1xuYnJlYWs7XG5jYXNlIDE3OnJldHVybiAzMjtcbmJyZWFrO1xuY2FzZSAxODpyZXR1cm4gMzE7XG5icmVhaztcbmNhc2UgMTk6dGhpcy5wb3BTdGF0ZSgpOyB0aGlzLmJlZ2luKCdjb20nKTtcbmJyZWFrO1xuY2FzZSAyMDpzdHJpcCgzLDUpOyB0aGlzLnBvcFN0YXRlKCk7IHJldHVybiAxMztcbmJyZWFrO1xuY2FzZSAyMTpyZXR1cm4gMzE7XG5icmVhaztcbmNhc2UgMjI6cmV0dXJuIDUxO1xuYnJlYWs7XG5jYXNlIDIzOnJldHVybiA1MDtcbmJyZWFrO1xuY2FzZSAyNDpyZXR1cm4gNTA7XG5icmVhaztcbmNhc2UgMjU6cmV0dXJuIDU0O1xuYnJlYWs7XG5jYXNlIDI2Oi8vIGlnbm9yZSB3aGl0ZXNwYWNlXG5icmVhaztcbmNhc2UgMjc6dGhpcy5wb3BTdGF0ZSgpOyByZXR1cm4gMzM7XG5icmVhaztcbmNhc2UgMjg6dGhpcy5wb3BTdGF0ZSgpOyByZXR1cm4gMjU7XG5icmVhaztcbmNhc2UgMjk6eXlfLnl5dGV4dCA9IHN0cmlwKDEsMikucmVwbGFjZSgvXFxcXFwiL2csJ1wiJyk7IHJldHVybiA0MjtcbmJyZWFrO1xuY2FzZSAzMDp5eV8ueXl0ZXh0ID0gc3RyaXAoMSwyKS5yZXBsYWNlKC9cXFxcJy9nLFwiJ1wiKTsgcmV0dXJuIDQyO1xuYnJlYWs7XG5jYXNlIDMxOnJldHVybiA1MjtcbmJyZWFrO1xuY2FzZSAzMjpyZXR1cm4gNDQ7XG5icmVhaztcbmNhc2UgMzM6cmV0dXJuIDQ0O1xuYnJlYWs7XG5jYXNlIDM0OnJldHVybiA0MztcbmJyZWFrO1xuY2FzZSAzNTpyZXR1cm4gNTA7XG5icmVhaztcbmNhc2UgMzY6eXlfLnl5dGV4dCA9IHN0cmlwKDEsMik7IHJldHVybiA1MDtcbmJyZWFrO1xuY2FzZSAzNzpyZXR1cm4gJ0lOVkFMSUQnO1xuYnJlYWs7XG5jYXNlIDM4OnJldHVybiA1O1xuYnJlYWs7XG59XG59O1xubGV4ZXIucnVsZXMgPSBbL14oPzpbXlxceDAwXSo/KD89KFxce1xceykpKS8sL14oPzpbXlxceDAwXSspLywvXig/OlteXFx4MDBdezIsfT8oPz0oXFx7XFx7fFxcXFxcXHtcXHt8XFxcXFxcXFxcXHtcXHt8JCkpKS8sL14oPzpcXHtcXHtcXHtcXHtcXC9bXlxccyFcIiMlLSxcXC5cXC87LT5AXFxbLVxcXmBcXHstfl0rKD89Wz19XFxzXFwvLl0pXFx9XFx9XFx9XFx9KS8sL14oPzpbXlxceDAwXSo/KD89KFxce1xce1xce1xce1xcLykpKS8sL14oPzpbXFxzXFxTXSo/LS1cXH1cXH0pLywvXig/OlxcKCkvLC9eKD86XFwpKS8sL14oPzpcXHtcXHtcXHtcXHspLywvXig/OlxcfVxcfVxcfVxcfSkvLC9eKD86XFx7XFx7KH4pPz4pLywvXig/Olxce1xceyh+KT8jKS8sL14oPzpcXHtcXHsofik/XFwvKS8sL14oPzpcXHtcXHsofik/XFxeXFxzKih+KT9cXH1cXH0pLywvXig/Olxce1xceyh+KT9cXHMqZWxzZVxccyoofik/XFx9XFx9KS8sL14oPzpcXHtcXHsofik/XFxeKS8sL14oPzpcXHtcXHsofik/XFxzKmVsc2VcXGIpLywvXig/Olxce1xceyh+KT9cXHspLywvXig/Olxce1xceyh+KT8mKS8sL14oPzpcXHtcXHshLS0pLywvXig/Olxce1xceyFbXFxzXFxTXSo/XFx9XFx9KS8sL14oPzpcXHtcXHsofik/KS8sL14oPzo9KS8sL14oPzpcXC5cXC4pLywvXig/OlxcLig/PShbPX59XFxzXFwvLildKSkpLywvXig/OltcXC8uXSkvLC9eKD86XFxzKykvLC9eKD86XFx9KH4pP1xcfVxcfSkvLC9eKD86KH4pP1xcfVxcfSkvLC9eKD86XCIoXFxcXFtcIl18W15cIl0pKlwiKS8sL14oPzonKFxcXFxbJ118W14nXSkqJykvLC9eKD86QCkvLC9eKD86dHJ1ZSg/PShbfn1cXHMpXSkpKS8sL14oPzpmYWxzZSg/PShbfn1cXHMpXSkpKS8sL14oPzotP1swLTldKyg/OlxcLlswLTldKyk/KD89KFt+fVxccyldKSkpLywvXig/OihbXlxccyFcIiMlLSxcXC5cXC87LT5AXFxbLVxcXmBcXHstfl0rKD89KFs9fn1cXHNcXC8uKV0pKSkpLywvXig/OlxcW1teXFxdXSpcXF0pLywvXig/Oi4pLywvXig/OiQpL107XG5sZXhlci5jb25kaXRpb25zID0ge1wibXVcIjp7XCJydWxlc1wiOls2LDcsOCw5LDEwLDExLDEyLDEzLDE0LDE1LDE2LDE3LDE4LDE5LDIwLDIxLDIyLDIzLDI0LDI1LDI2LDI3LDI4LDI5LDMwLDMxLDMyLDMzLDM0LDM1LDM2LDM3LDM4XSxcImluY2x1c2l2ZVwiOmZhbHNlfSxcImVtdVwiOntcInJ1bGVzXCI6WzJdLFwiaW5jbHVzaXZlXCI6ZmFsc2V9LFwiY29tXCI6e1wicnVsZXNcIjpbNV0sXCJpbmNsdXNpdmVcIjpmYWxzZX0sXCJyYXdcIjp7XCJydWxlc1wiOlszLDRdLFwiaW5jbHVzaXZlXCI6ZmFsc2V9LFwiSU5JVElBTFwiOntcInJ1bGVzXCI6WzAsMSwzOF0sXCJpbmNsdXNpdmVcIjp0cnVlfX07XG5yZXR1cm4gbGV4ZXI7fSkoKVxucGFyc2VyLmxleGVyID0gbGV4ZXI7XG5mdW5jdGlvbiBQYXJzZXIgKCkgeyB0aGlzLnl5ID0ge307IH1QYXJzZXIucHJvdG90eXBlID0gcGFyc2VyO3BhcnNlci5QYXJzZXIgPSBQYXJzZXI7XG5yZXR1cm4gbmV3IFBhcnNlcjtcbn0pKCk7ZXhwb3J0c1tcImRlZmF1bHRcIl0gPSBoYW5kbGViYXJzO1xuLyoganNoaW50IGlnbm9yZTplbmQgKi8iLCJcInVzZSBzdHJpY3RcIjtcbnZhciBWaXNpdG9yID0gcmVxdWlyZShcIi4vdmlzaXRvclwiKVtcImRlZmF1bHRcIl07XG5cbmZ1bmN0aW9uIHByaW50KGFzdCkge1xuICByZXR1cm4gbmV3IFByaW50VmlzaXRvcigpLmFjY2VwdChhc3QpO1xufVxuXG5leHBvcnRzLnByaW50ID0gcHJpbnQ7ZnVuY3Rpb24gUHJpbnRWaXNpdG9yKCkge1xuICB0aGlzLnBhZGRpbmcgPSAwO1xufVxuXG5leHBvcnRzLlByaW50VmlzaXRvciA9IFByaW50VmlzaXRvcjtQcmludFZpc2l0b3IucHJvdG90eXBlID0gbmV3IFZpc2l0b3IoKTtcblxuUHJpbnRWaXNpdG9yLnByb3RvdHlwZS5wYWQgPSBmdW5jdGlvbihzdHJpbmcpIHtcbiAgdmFyIG91dCA9IFwiXCI7XG5cbiAgZm9yKHZhciBpPTAsbD10aGlzLnBhZGRpbmc7IGk8bDsgaSsrKSB7XG4gICAgb3V0ID0gb3V0ICsgXCIgIFwiO1xuICB9XG5cbiAgb3V0ID0gb3V0ICsgc3RyaW5nICsgXCJcXG5cIjtcbiAgcmV0dXJuIG91dDtcbn07XG5cblByaW50VmlzaXRvci5wcm90b3R5cGUucHJvZ3JhbSA9IGZ1bmN0aW9uKHByb2dyYW0pIHtcbiAgdmFyIG91dCA9IFwiXCIsXG4gICAgICBzdGF0ZW1lbnRzID0gcHJvZ3JhbS5zdGF0ZW1lbnRzLFxuICAgICAgaSwgbDtcblxuICBmb3IoaT0wLCBsPXN0YXRlbWVudHMubGVuZ3RoOyBpPGw7IGkrKykge1xuICAgIG91dCA9IG91dCArIHRoaXMuYWNjZXB0KHN0YXRlbWVudHNbaV0pO1xuICB9XG5cbiAgdGhpcy5wYWRkaW5nLS07XG5cbiAgcmV0dXJuIG91dDtcbn07XG5cblByaW50VmlzaXRvci5wcm90b3R5cGUuYmxvY2sgPSBmdW5jdGlvbihibG9jaykge1xuICB2YXIgb3V0ID0gXCJcIjtcblxuICBvdXQgPSBvdXQgKyB0aGlzLnBhZChcIkJMT0NLOlwiKTtcbiAgdGhpcy5wYWRkaW5nKys7XG4gIG91dCA9IG91dCArIHRoaXMuYWNjZXB0KGJsb2NrLm11c3RhY2hlKTtcbiAgaWYgKGJsb2NrLnByb2dyYW0pIHtcbiAgICBvdXQgPSBvdXQgKyB0aGlzLnBhZChcIlBST0dSQU06XCIpO1xuICAgIHRoaXMucGFkZGluZysrO1xuICAgIG91dCA9IG91dCArIHRoaXMuYWNjZXB0KGJsb2NrLnByb2dyYW0pO1xuICAgIHRoaXMucGFkZGluZy0tO1xuICB9XG4gIGlmIChibG9jay5pbnZlcnNlKSB7XG4gICAgaWYgKGJsb2NrLnByb2dyYW0pIHsgdGhpcy5wYWRkaW5nKys7IH1cbiAgICBvdXQgPSBvdXQgKyB0aGlzLnBhZChcInt7Xn19XCIpO1xuICAgIHRoaXMucGFkZGluZysrO1xuICAgIG91dCA9IG91dCArIHRoaXMuYWNjZXB0KGJsb2NrLmludmVyc2UpO1xuICAgIHRoaXMucGFkZGluZy0tO1xuICAgIGlmIChibG9jay5wcm9ncmFtKSB7IHRoaXMucGFkZGluZy0tOyB9XG4gIH1cbiAgdGhpcy5wYWRkaW5nLS07XG5cbiAgcmV0dXJuIG91dDtcbn07XG5cblByaW50VmlzaXRvci5wcm90b3R5cGUuc2V4cHIgPSBmdW5jdGlvbihzZXhwcikge1xuICB2YXIgcGFyYW1zID0gc2V4cHIucGFyYW1zLCBwYXJhbVN0cmluZ3MgPSBbXSwgaGFzaDtcblxuICBmb3IodmFyIGk9MCwgbD1wYXJhbXMubGVuZ3RoOyBpPGw7IGkrKykge1xuICAgIHBhcmFtU3RyaW5ncy5wdXNoKHRoaXMuYWNjZXB0KHBhcmFtc1tpXSkpO1xuICB9XG5cbiAgcGFyYW1zID0gXCJbXCIgKyBwYXJhbVN0cmluZ3Muam9pbihcIiwgXCIpICsgXCJdXCI7XG5cbiAgaGFzaCA9IHNleHByLmhhc2ggPyBcIiBcIiArIHRoaXMuYWNjZXB0KHNleHByLmhhc2gpIDogXCJcIjtcblxuICByZXR1cm4gdGhpcy5hY2NlcHQoc2V4cHIuaWQpICsgXCIgXCIgKyBwYXJhbXMgKyBoYXNoO1xufTtcblxuUHJpbnRWaXNpdG9yLnByb3RvdHlwZS5tdXN0YWNoZSA9IGZ1bmN0aW9uKG11c3RhY2hlKSB7XG4gIHJldHVybiB0aGlzLnBhZChcInt7IFwiICsgdGhpcy5hY2NlcHQobXVzdGFjaGUuc2V4cHIpICsgXCIgfX1cIik7XG59O1xuXG5QcmludFZpc2l0b3IucHJvdG90eXBlLnBhcnRpYWwgPSBmdW5jdGlvbihwYXJ0aWFsKSB7XG4gIHZhciBjb250ZW50ID0gdGhpcy5hY2NlcHQocGFydGlhbC5wYXJ0aWFsTmFtZSk7XG4gIGlmKHBhcnRpYWwuY29udGV4dCkge1xuICAgIGNvbnRlbnQgKz0gXCIgXCIgKyB0aGlzLmFjY2VwdChwYXJ0aWFsLmNvbnRleHQpO1xuICB9XG4gIGlmIChwYXJ0aWFsLmhhc2gpIHtcbiAgICBjb250ZW50ICs9IFwiIFwiICsgdGhpcy5hY2NlcHQocGFydGlhbC5oYXNoKTtcbiAgfVxuICByZXR1cm4gdGhpcy5wYWQoXCJ7ez4gXCIgKyBjb250ZW50ICsgXCIgfX1cIik7XG59O1xuXG5QcmludFZpc2l0b3IucHJvdG90eXBlLmhhc2ggPSBmdW5jdGlvbihoYXNoKSB7XG4gIHZhciBwYWlycyA9IGhhc2gucGFpcnM7XG4gIHZhciBqb2luZWRQYWlycyA9IFtdLCBsZWZ0LCByaWdodDtcblxuICBmb3IodmFyIGk9MCwgbD1wYWlycy5sZW5ndGg7IGk8bDsgaSsrKSB7XG4gICAgbGVmdCA9IHBhaXJzW2ldWzBdO1xuICAgIHJpZ2h0ID0gdGhpcy5hY2NlcHQocGFpcnNbaV1bMV0pO1xuICAgIGpvaW5lZFBhaXJzLnB1c2goIGxlZnQgKyBcIj1cIiArIHJpZ2h0ICk7XG4gIH1cblxuICByZXR1cm4gXCJIQVNIe1wiICsgam9pbmVkUGFpcnMuam9pbihcIiwgXCIpICsgXCJ9XCI7XG59O1xuXG5QcmludFZpc2l0b3IucHJvdG90eXBlLlNUUklORyA9IGZ1bmN0aW9uKHN0cmluZykge1xuICByZXR1cm4gJ1wiJyArIHN0cmluZy5zdHJpbmcgKyAnXCInO1xufTtcblxuUHJpbnRWaXNpdG9yLnByb3RvdHlwZS5OVU1CRVIgPSBmdW5jdGlvbihudW1iZXIpIHtcbiAgcmV0dXJuIFwiTlVNQkVSe1wiICsgbnVtYmVyLm51bWJlciArIFwifVwiO1xufTtcblxuUHJpbnRWaXNpdG9yLnByb3RvdHlwZS5CT09MRUFOID0gZnVuY3Rpb24oYm9vbCkge1xuICByZXR1cm4gXCJCT09MRUFOe1wiICsgYm9vbC5ib29sICsgXCJ9XCI7XG59O1xuXG5QcmludFZpc2l0b3IucHJvdG90eXBlLklEID0gZnVuY3Rpb24oaWQpIHtcbiAgdmFyIHBhdGggPSBpZC5wYXJ0cy5qb2luKFwiL1wiKTtcbiAgaWYoaWQucGFydHMubGVuZ3RoID4gMSkge1xuICAgIHJldHVybiBcIlBBVEg6XCIgKyBwYXRoO1xuICB9IGVsc2Uge1xuICAgIHJldHVybiBcIklEOlwiICsgcGF0aDtcbiAgfVxufTtcblxuUHJpbnRWaXNpdG9yLnByb3RvdHlwZS5QQVJUSUFMX05BTUUgPSBmdW5jdGlvbihwYXJ0aWFsTmFtZSkge1xuICAgIHJldHVybiBcIlBBUlRJQUw6XCIgKyBwYXJ0aWFsTmFtZS5uYW1lO1xufTtcblxuUHJpbnRWaXNpdG9yLnByb3RvdHlwZS5EQVRBID0gZnVuY3Rpb24oZGF0YSkge1xuICByZXR1cm4gXCJAXCIgKyB0aGlzLmFjY2VwdChkYXRhLmlkKTtcbn07XG5cblByaW50VmlzaXRvci5wcm90b3R5cGUuY29udGVudCA9IGZ1bmN0aW9uKGNvbnRlbnQpIHtcbiAgcmV0dXJuIHRoaXMucGFkKFwiQ09OVEVOVFsgJ1wiICsgY29udGVudC5zdHJpbmcgKyBcIicgXVwiKTtcbn07XG5cblByaW50VmlzaXRvci5wcm90b3R5cGUuY29tbWVudCA9IGZ1bmN0aW9uKGNvbW1lbnQpIHtcbiAgcmV0dXJuIHRoaXMucGFkKFwie3shICdcIiArIGNvbW1lbnQuY29tbWVudCArIFwiJyB9fVwiKTtcbn07IiwiXCJ1c2Ugc3RyaWN0XCI7XG5mdW5jdGlvbiBWaXNpdG9yKCkge31cblxuVmlzaXRvci5wcm90b3R5cGUgPSB7XG4gIGNvbnN0cnVjdG9yOiBWaXNpdG9yLFxuXG4gIGFjY2VwdDogZnVuY3Rpb24ob2JqZWN0KSB7XG4gICAgcmV0dXJuIHRoaXNbb2JqZWN0LnR5cGVdKG9iamVjdCk7XG4gIH1cbn07XG5cbmV4cG9ydHNbXCJkZWZhdWx0XCJdID0gVmlzaXRvcjsiLCJcInVzZSBzdHJpY3RcIjtcblxudmFyIGVycm9yUHJvcHMgPSBbJ2Rlc2NyaXB0aW9uJywgJ2ZpbGVOYW1lJywgJ2xpbmVOdW1iZXInLCAnbWVzc2FnZScsICduYW1lJywgJ251bWJlcicsICdzdGFjayddO1xuXG5mdW5jdGlvbiBFeGNlcHRpb24obWVzc2FnZSwgbm9kZSkge1xuICB2YXIgbGluZTtcbiAgaWYgKG5vZGUgJiYgbm9kZS5maXJzdExpbmUpIHtcbiAgICBsaW5lID0gbm9kZS5maXJzdExpbmU7XG5cbiAgICBtZXNzYWdlICs9ICcgLSAnICsgbGluZSArICc6JyArIG5vZGUuZmlyc3RDb2x1bW47XG4gIH1cblxuICB2YXIgdG1wID0gRXJyb3IucHJvdG90eXBlLmNvbnN0cnVjdG9yLmNhbGwodGhpcywgbWVzc2FnZSk7XG5cbiAgLy8gVW5mb3J0dW5hdGVseSBlcnJvcnMgYXJlIG5vdCBlbnVtZXJhYmxlIGluIENocm9tZSAoYXQgbGVhc3QpLCBzbyBgZm9yIHByb3AgaW4gdG1wYCBkb2Vzbid0IHdvcmsuXG4gIGZvciAodmFyIGlkeCA9IDA7IGlkeCA8IGVycm9yUHJvcHMubGVuZ3RoOyBpZHgrKykge1xuICAgIHRoaXNbZXJyb3JQcm9wc1tpZHhdXSA9IHRtcFtlcnJvclByb3BzW2lkeF1dO1xuICB9XG5cbiAgaWYgKGxpbmUpIHtcbiAgICB0aGlzLmxpbmVOdW1iZXIgPSBsaW5lO1xuICAgIHRoaXMuY29sdW1uID0gbm9kZS5maXJzdENvbHVtbjtcbiAgfVxufVxuXG5FeGNlcHRpb24ucHJvdG90eXBlID0gbmV3IEVycm9yKCk7XG5cbmV4cG9ydHNbXCJkZWZhdWx0XCJdID0gRXhjZXB0aW9uOyIsIlwidXNlIHN0cmljdFwiO1xudmFyIFV0aWxzID0gcmVxdWlyZShcIi4vdXRpbHNcIik7XG52YXIgRXhjZXB0aW9uID0gcmVxdWlyZShcIi4vZXhjZXB0aW9uXCIpW1wiZGVmYXVsdFwiXTtcbnZhciBDT01QSUxFUl9SRVZJU0lPTiA9IHJlcXVpcmUoXCIuL2Jhc2VcIikuQ09NUElMRVJfUkVWSVNJT047XG52YXIgUkVWSVNJT05fQ0hBTkdFUyA9IHJlcXVpcmUoXCIuL2Jhc2VcIikuUkVWSVNJT05fQ0hBTkdFUztcbnZhciBjcmVhdGVGcmFtZSA9IHJlcXVpcmUoXCIuL2Jhc2VcIikuY3JlYXRlRnJhbWU7XG5cbmZ1bmN0aW9uIGNoZWNrUmV2aXNpb24oY29tcGlsZXJJbmZvKSB7XG4gIHZhciBjb21waWxlclJldmlzaW9uID0gY29tcGlsZXJJbmZvICYmIGNvbXBpbGVySW5mb1swXSB8fCAxLFxuICAgICAgY3VycmVudFJldmlzaW9uID0gQ09NUElMRVJfUkVWSVNJT047XG5cbiAgaWYgKGNvbXBpbGVyUmV2aXNpb24gIT09IGN1cnJlbnRSZXZpc2lvbikge1xuICAgIGlmIChjb21waWxlclJldmlzaW9uIDwgY3VycmVudFJldmlzaW9uKSB7XG4gICAgICB2YXIgcnVudGltZVZlcnNpb25zID0gUkVWSVNJT05fQ0hBTkdFU1tjdXJyZW50UmV2aXNpb25dLFxuICAgICAgICAgIGNvbXBpbGVyVmVyc2lvbnMgPSBSRVZJU0lPTl9DSEFOR0VTW2NvbXBpbGVyUmV2aXNpb25dO1xuICAgICAgdGhyb3cgbmV3IEV4Y2VwdGlvbihcIlRlbXBsYXRlIHdhcyBwcmVjb21waWxlZCB3aXRoIGFuIG9sZGVyIHZlcnNpb24gb2YgSGFuZGxlYmFycyB0aGFuIHRoZSBjdXJyZW50IHJ1bnRpbWUuIFwiK1xuICAgICAgICAgICAgXCJQbGVhc2UgdXBkYXRlIHlvdXIgcHJlY29tcGlsZXIgdG8gYSBuZXdlciB2ZXJzaW9uIChcIitydW50aW1lVmVyc2lvbnMrXCIpIG9yIGRvd25ncmFkZSB5b3VyIHJ1bnRpbWUgdG8gYW4gb2xkZXIgdmVyc2lvbiAoXCIrY29tcGlsZXJWZXJzaW9ucytcIikuXCIpO1xuICAgIH0gZWxzZSB7XG4gICAgICAvLyBVc2UgdGhlIGVtYmVkZGVkIHZlcnNpb24gaW5mbyBzaW5jZSB0aGUgcnVudGltZSBkb2Vzbid0IGtub3cgYWJvdXQgdGhpcyByZXZpc2lvbiB5ZXRcbiAgICAgIHRocm93IG5ldyBFeGNlcHRpb24oXCJUZW1wbGF0ZSB3YXMgcHJlY29tcGlsZWQgd2l0aCBhIG5ld2VyIHZlcnNpb24gb2YgSGFuZGxlYmFycyB0aGFuIHRoZSBjdXJyZW50IHJ1bnRpbWUuIFwiK1xuICAgICAgICAgICAgXCJQbGVhc2UgdXBkYXRlIHlvdXIgcnVudGltZSB0byBhIG5ld2VyIHZlcnNpb24gKFwiK2NvbXBpbGVySW5mb1sxXStcIikuXCIpO1xuICAgIH1cbiAgfVxufVxuXG5leHBvcnRzLmNoZWNrUmV2aXNpb24gPSBjaGVja1JldmlzaW9uOy8vIFRPRE86IFJlbW92ZSB0aGlzIGxpbmUgYW5kIGJyZWFrIHVwIGNvbXBpbGVQYXJ0aWFsXG5cbmZ1bmN0aW9uIHRlbXBsYXRlKHRlbXBsYXRlU3BlYywgZW52KSB7XG4gIC8qIGlzdGFuYnVsIGlnbm9yZSBuZXh0ICovXG4gIGlmICghZW52KSB7XG4gICAgdGhyb3cgbmV3IEV4Y2VwdGlvbihcIk5vIGVudmlyb25tZW50IHBhc3NlZCB0byB0ZW1wbGF0ZVwiKTtcbiAgfVxuICBpZiAoIXRlbXBsYXRlU3BlYyB8fCAhdGVtcGxhdGVTcGVjLm1haW4pIHtcbiAgICB0aHJvdyBuZXcgRXhjZXB0aW9uKCdVbmtub3duIHRlbXBsYXRlIG9iamVjdDogJyArIHR5cGVvZiB0ZW1wbGF0ZVNwZWMpO1xuICB9XG5cbiAgLy8gTm90ZTogVXNpbmcgZW52LlZNIHJlZmVyZW5jZXMgcmF0aGVyIHRoYW4gbG9jYWwgdmFyIHJlZmVyZW5jZXMgdGhyb3VnaG91dCB0aGlzIHNlY3Rpb24gdG8gYWxsb3dcbiAgLy8gZm9yIGV4dGVybmFsIHVzZXJzIHRvIG92ZXJyaWRlIHRoZXNlIGFzIHBzdWVkby1zdXBwb3J0ZWQgQVBJcy5cbiAgZW52LlZNLmNoZWNrUmV2aXNpb24odGVtcGxhdGVTcGVjLmNvbXBpbGVyKTtcblxuICB2YXIgaW52b2tlUGFydGlhbFdyYXBwZXIgPSBmdW5jdGlvbihwYXJ0aWFsLCBpbmRlbnQsIG5hbWUsIGNvbnRleHQsIGhhc2gsIGhlbHBlcnMsIHBhcnRpYWxzLCBkYXRhLCBkZXB0aHMpIHtcbiAgICBpZiAoaGFzaCkge1xuICAgICAgY29udGV4dCA9IFV0aWxzLmV4dGVuZCh7fSwgY29udGV4dCwgaGFzaCk7XG4gICAgfVxuXG4gICAgdmFyIHJlc3VsdCA9IGVudi5WTS5pbnZva2VQYXJ0aWFsLmNhbGwodGhpcywgcGFydGlhbCwgbmFtZSwgY29udGV4dCwgaGVscGVycywgcGFydGlhbHMsIGRhdGEsIGRlcHRocyk7XG5cbiAgICBpZiAocmVzdWx0ID09IG51bGwgJiYgZW52LmNvbXBpbGUpIHtcbiAgICAgIHZhciBvcHRpb25zID0geyBoZWxwZXJzOiBoZWxwZXJzLCBwYXJ0aWFsczogcGFydGlhbHMsIGRhdGE6IGRhdGEsIGRlcHRoczogZGVwdGhzIH07XG4gICAgICBwYXJ0aWFsc1tuYW1lXSA9IGVudi5jb21waWxlKHBhcnRpYWwsIHsgZGF0YTogZGF0YSAhPT0gdW5kZWZpbmVkLCBjb21wYXQ6IHRlbXBsYXRlU3BlYy5jb21wYXQgfSwgZW52KTtcbiAgICAgIHJlc3VsdCA9IHBhcnRpYWxzW25hbWVdKGNvbnRleHQsIG9wdGlvbnMpO1xuICAgIH1cbiAgICBpZiAocmVzdWx0ICE9IG51bGwpIHtcbiAgICAgIGlmIChpbmRlbnQpIHtcbiAgICAgICAgdmFyIGxpbmVzID0gcmVzdWx0LnNwbGl0KCdcXG4nKTtcbiAgICAgICAgZm9yICh2YXIgaSA9IDAsIGwgPSBsaW5lcy5sZW5ndGg7IGkgPCBsOyBpKyspIHtcbiAgICAgICAgICBpZiAoIWxpbmVzW2ldICYmIGkgKyAxID09PSBsKSB7XG4gICAgICAgICAgICBicmVhaztcbiAgICAgICAgICB9XG5cbiAgICAgICAgICBsaW5lc1tpXSA9IGluZGVudCArIGxpbmVzW2ldO1xuICAgICAgICB9XG4gICAgICAgIHJlc3VsdCA9IGxpbmVzLmpvaW4oJ1xcbicpO1xuICAgICAgfVxuICAgICAgcmV0dXJuIHJlc3VsdDtcbiAgICB9IGVsc2Uge1xuICAgICAgdGhyb3cgbmV3IEV4Y2VwdGlvbihcIlRoZSBwYXJ0aWFsIFwiICsgbmFtZSArIFwiIGNvdWxkIG5vdCBiZSBjb21waWxlZCB3aGVuIHJ1bm5pbmcgaW4gcnVudGltZS1vbmx5IG1vZGVcIik7XG4gICAgfVxuICB9O1xuXG4gIC8vIEp1c3QgYWRkIHdhdGVyXG4gIHZhciBjb250YWluZXIgPSB7XG4gICAgbG9va3VwOiBmdW5jdGlvbihkZXB0aHMsIG5hbWUpIHtcbiAgICAgIHZhciBsZW4gPSBkZXB0aHMubGVuZ3RoO1xuICAgICAgZm9yICh2YXIgaSA9IDA7IGkgPCBsZW47IGkrKykge1xuICAgICAgICBpZiAoZGVwdGhzW2ldICYmIGRlcHRoc1tpXVtuYW1lXSAhPSBudWxsKSB7XG4gICAgICAgICAgcmV0dXJuIGRlcHRoc1tpXVtuYW1lXTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH0sXG4gICAgbGFtYmRhOiBmdW5jdGlvbihjdXJyZW50LCBjb250ZXh0KSB7XG4gICAgICByZXR1cm4gdHlwZW9mIGN1cnJlbnQgPT09ICdmdW5jdGlvbicgPyBjdXJyZW50LmNhbGwoY29udGV4dCkgOiBjdXJyZW50O1xuICAgIH0sXG5cbiAgICBlc2NhcGVFeHByZXNzaW9uOiBVdGlscy5lc2NhcGVFeHByZXNzaW9uLFxuICAgIGludm9rZVBhcnRpYWw6IGludm9rZVBhcnRpYWxXcmFwcGVyLFxuXG4gICAgZm46IGZ1bmN0aW9uKGkpIHtcbiAgICAgIHJldHVybiB0ZW1wbGF0ZVNwZWNbaV07XG4gICAgfSxcblxuICAgIHByb2dyYW1zOiBbXSxcbiAgICBwcm9ncmFtOiBmdW5jdGlvbihpLCBkYXRhLCBkZXB0aHMpIHtcbiAgICAgIHZhciBwcm9ncmFtV3JhcHBlciA9IHRoaXMucHJvZ3JhbXNbaV0sXG4gICAgICAgICAgZm4gPSB0aGlzLmZuKGkpO1xuICAgICAgaWYgKGRhdGEgfHwgZGVwdGhzKSB7XG4gICAgICAgIHByb2dyYW1XcmFwcGVyID0gcHJvZ3JhbSh0aGlzLCBpLCBmbiwgZGF0YSwgZGVwdGhzKTtcbiAgICAgIH0gZWxzZSBpZiAoIXByb2dyYW1XcmFwcGVyKSB7XG4gICAgICAgIHByb2dyYW1XcmFwcGVyID0gdGhpcy5wcm9ncmFtc1tpXSA9IHByb2dyYW0odGhpcywgaSwgZm4pO1xuICAgICAgfVxuICAgICAgcmV0dXJuIHByb2dyYW1XcmFwcGVyO1xuICAgIH0sXG5cbiAgICBkYXRhOiBmdW5jdGlvbihkYXRhLCBkZXB0aCkge1xuICAgICAgd2hpbGUgKGRhdGEgJiYgZGVwdGgtLSkge1xuICAgICAgICBkYXRhID0gZGF0YS5fcGFyZW50O1xuICAgICAgfVxuICAgICAgcmV0dXJuIGRhdGE7XG4gICAgfSxcbiAgICBtZXJnZTogZnVuY3Rpb24ocGFyYW0sIGNvbW1vbikge1xuICAgICAgdmFyIHJldCA9IHBhcmFtIHx8IGNvbW1vbjtcblxuICAgICAgaWYgKHBhcmFtICYmIGNvbW1vbiAmJiAocGFyYW0gIT09IGNvbW1vbikpIHtcbiAgICAgICAgcmV0ID0gVXRpbHMuZXh0ZW5kKHt9LCBjb21tb24sIHBhcmFtKTtcbiAgICAgIH1cblxuICAgICAgcmV0dXJuIHJldDtcbiAgICB9LFxuXG4gICAgbm9vcDogZW52LlZNLm5vb3AsXG4gICAgY29tcGlsZXJJbmZvOiB0ZW1wbGF0ZVNwZWMuY29tcGlsZXJcbiAgfTtcblxuICB2YXIgcmV0ID0gZnVuY3Rpb24oY29udGV4dCwgb3B0aW9ucykge1xuICAgIG9wdGlvbnMgPSBvcHRpb25zIHx8IHt9O1xuICAgIHZhciBkYXRhID0gb3B0aW9ucy5kYXRhO1xuXG4gICAgcmV0Ll9zZXR1cChvcHRpb25zKTtcbiAgICBpZiAoIW9wdGlvbnMucGFydGlhbCAmJiB0ZW1wbGF0ZVNwZWMudXNlRGF0YSkge1xuICAgICAgZGF0YSA9IGluaXREYXRhKGNvbnRleHQsIGRhdGEpO1xuICAgIH1cbiAgICB2YXIgZGVwdGhzO1xuICAgIGlmICh0ZW1wbGF0ZVNwZWMudXNlRGVwdGhzKSB7XG4gICAgICBkZXB0aHMgPSBvcHRpb25zLmRlcHRocyA/IFtjb250ZXh0XS5jb25jYXQob3B0aW9ucy5kZXB0aHMpIDogW2NvbnRleHRdO1xuICAgIH1cblxuICAgIHJldHVybiB0ZW1wbGF0ZVNwZWMubWFpbi5jYWxsKGNvbnRhaW5lciwgY29udGV4dCwgY29udGFpbmVyLmhlbHBlcnMsIGNvbnRhaW5lci5wYXJ0aWFscywgZGF0YSwgZGVwdGhzKTtcbiAgfTtcbiAgcmV0LmlzVG9wID0gdHJ1ZTtcblxuICByZXQuX3NldHVwID0gZnVuY3Rpb24ob3B0aW9ucykge1xuICAgIGlmICghb3B0aW9ucy5wYXJ0aWFsKSB7XG4gICAgICBjb250YWluZXIuaGVscGVycyA9IGNvbnRhaW5lci5tZXJnZShvcHRpb25zLmhlbHBlcnMsIGVudi5oZWxwZXJzKTtcblxuICAgICAgaWYgKHRlbXBsYXRlU3BlYy51c2VQYXJ0aWFsKSB7XG4gICAgICAgIGNvbnRhaW5lci5wYXJ0aWFscyA9IGNvbnRhaW5lci5tZXJnZShvcHRpb25zLnBhcnRpYWxzLCBlbnYucGFydGlhbHMpO1xuICAgICAgfVxuICAgIH0gZWxzZSB7XG4gICAgICBjb250YWluZXIuaGVscGVycyA9IG9wdGlvbnMuaGVscGVycztcbiAgICAgIGNvbnRhaW5lci5wYXJ0aWFscyA9IG9wdGlvbnMucGFydGlhbHM7XG4gICAgfVxuICB9O1xuXG4gIHJldC5fY2hpbGQgPSBmdW5jdGlvbihpLCBkYXRhLCBkZXB0aHMpIHtcbiAgICBpZiAodGVtcGxhdGVTcGVjLnVzZURlcHRocyAmJiAhZGVwdGhzKSB7XG4gICAgICB0aHJvdyBuZXcgRXhjZXB0aW9uKCdtdXN0IHBhc3MgcGFyZW50IGRlcHRocycpO1xuICAgIH1cblxuICAgIHJldHVybiBwcm9ncmFtKGNvbnRhaW5lciwgaSwgdGVtcGxhdGVTcGVjW2ldLCBkYXRhLCBkZXB0aHMpO1xuICB9O1xuICByZXR1cm4gcmV0O1xufVxuXG5leHBvcnRzLnRlbXBsYXRlID0gdGVtcGxhdGU7ZnVuY3Rpb24gcHJvZ3JhbShjb250YWluZXIsIGksIGZuLCBkYXRhLCBkZXB0aHMpIHtcbiAgdmFyIHByb2cgPSBmdW5jdGlvbihjb250ZXh0LCBvcHRpb25zKSB7XG4gICAgb3B0aW9ucyA9IG9wdGlvbnMgfHwge307XG5cbiAgICByZXR1cm4gZm4uY2FsbChjb250YWluZXIsIGNvbnRleHQsIGNvbnRhaW5lci5oZWxwZXJzLCBjb250YWluZXIucGFydGlhbHMsIG9wdGlvbnMuZGF0YSB8fCBkYXRhLCBkZXB0aHMgJiYgW2NvbnRleHRdLmNvbmNhdChkZXB0aHMpKTtcbiAgfTtcbiAgcHJvZy5wcm9ncmFtID0gaTtcbiAgcHJvZy5kZXB0aCA9IGRlcHRocyA/IGRlcHRocy5sZW5ndGggOiAwO1xuICByZXR1cm4gcHJvZztcbn1cblxuZXhwb3J0cy5wcm9ncmFtID0gcHJvZ3JhbTtmdW5jdGlvbiBpbnZva2VQYXJ0aWFsKHBhcnRpYWwsIG5hbWUsIGNvbnRleHQsIGhlbHBlcnMsIHBhcnRpYWxzLCBkYXRhLCBkZXB0aHMpIHtcbiAgdmFyIG9wdGlvbnMgPSB7IHBhcnRpYWw6IHRydWUsIGhlbHBlcnM6IGhlbHBlcnMsIHBhcnRpYWxzOiBwYXJ0aWFscywgZGF0YTogZGF0YSwgZGVwdGhzOiBkZXB0aHMgfTtcblxuICBpZihwYXJ0aWFsID09PSB1bmRlZmluZWQpIHtcbiAgICB0aHJvdyBuZXcgRXhjZXB0aW9uKFwiVGhlIHBhcnRpYWwgXCIgKyBuYW1lICsgXCIgY291bGQgbm90IGJlIGZvdW5kXCIpO1xuICB9IGVsc2UgaWYocGFydGlhbCBpbnN0YW5jZW9mIEZ1bmN0aW9uKSB7XG4gICAgcmV0dXJuIHBhcnRpYWwoY29udGV4dCwgb3B0aW9ucyk7XG4gIH1cbn1cblxuZXhwb3J0cy5pbnZva2VQYXJ0aWFsID0gaW52b2tlUGFydGlhbDtmdW5jdGlvbiBub29wKCkgeyByZXR1cm4gXCJcIjsgfVxuXG5leHBvcnRzLm5vb3AgPSBub29wO2Z1bmN0aW9uIGluaXREYXRhKGNvbnRleHQsIGRhdGEpIHtcbiAgaWYgKCFkYXRhIHx8ICEoJ3Jvb3QnIGluIGRhdGEpKSB7XG4gICAgZGF0YSA9IGRhdGEgPyBjcmVhdGVGcmFtZShkYXRhKSA6IHt9O1xuICAgIGRhdGEucm9vdCA9IGNvbnRleHQ7XG4gIH1cbiAgcmV0dXJuIGRhdGE7XG59IiwiXCJ1c2Ugc3RyaWN0XCI7XG4vLyBCdWlsZCBvdXQgb3VyIGJhc2ljIFNhZmVTdHJpbmcgdHlwZVxuZnVuY3Rpb24gU2FmZVN0cmluZyhzdHJpbmcpIHtcbiAgdGhpcy5zdHJpbmcgPSBzdHJpbmc7XG59XG5cblNhZmVTdHJpbmcucHJvdG90eXBlLnRvU3RyaW5nID0gZnVuY3Rpb24oKSB7XG4gIHJldHVybiBcIlwiICsgdGhpcy5zdHJpbmc7XG59O1xuXG5leHBvcnRzW1wiZGVmYXVsdFwiXSA9IFNhZmVTdHJpbmc7IiwiXCJ1c2Ugc3RyaWN0XCI7XG4vKmpzaGludCAtVzAwNCAqL1xudmFyIFNhZmVTdHJpbmcgPSByZXF1aXJlKFwiLi9zYWZlLXN0cmluZ1wiKVtcImRlZmF1bHRcIl07XG5cbnZhciBlc2NhcGUgPSB7XG4gIFwiJlwiOiBcIiZhbXA7XCIsXG4gIFwiPFwiOiBcIiZsdDtcIixcbiAgXCI+XCI6IFwiJmd0O1wiLFxuICAnXCInOiBcIiZxdW90O1wiLFxuICBcIidcIjogXCImI3gyNztcIixcbiAgXCJgXCI6IFwiJiN4NjA7XCJcbn07XG5cbnZhciBiYWRDaGFycyA9IC9bJjw+XCInYF0vZztcbnZhciBwb3NzaWJsZSA9IC9bJjw+XCInYF0vO1xuXG5mdW5jdGlvbiBlc2NhcGVDaGFyKGNocikge1xuICByZXR1cm4gZXNjYXBlW2Nocl07XG59XG5cbmZ1bmN0aW9uIGV4dGVuZChvYmogLyogLCAuLi5zb3VyY2UgKi8pIHtcbiAgZm9yICh2YXIgaSA9IDE7IGkgPCBhcmd1bWVudHMubGVuZ3RoOyBpKyspIHtcbiAgICBmb3IgKHZhciBrZXkgaW4gYXJndW1lbnRzW2ldKSB7XG4gICAgICBpZiAoT2JqZWN0LnByb3RvdHlwZS5oYXNPd25Qcm9wZXJ0eS5jYWxsKGFyZ3VtZW50c1tpXSwga2V5KSkge1xuICAgICAgICBvYmpba2V5XSA9IGFyZ3VtZW50c1tpXVtrZXldO1xuICAgICAgfVxuICAgIH1cbiAgfVxuXG4gIHJldHVybiBvYmo7XG59XG5cbmV4cG9ydHMuZXh0ZW5kID0gZXh0ZW5kO3ZhciB0b1N0cmluZyA9IE9iamVjdC5wcm90b3R5cGUudG9TdHJpbmc7XG5leHBvcnRzLnRvU3RyaW5nID0gdG9TdHJpbmc7XG4vLyBTb3VyY2VkIGZyb20gbG9kYXNoXG4vLyBodHRwczovL2dpdGh1Yi5jb20vYmVzdGllanMvbG9kYXNoL2Jsb2IvbWFzdGVyL0xJQ0VOU0UudHh0XG52YXIgaXNGdW5jdGlvbiA9IGZ1bmN0aW9uKHZhbHVlKSB7XG4gIHJldHVybiB0eXBlb2YgdmFsdWUgPT09ICdmdW5jdGlvbic7XG59O1xuLy8gZmFsbGJhY2sgZm9yIG9sZGVyIHZlcnNpb25zIG9mIENocm9tZSBhbmQgU2FmYXJpXG4vKiBpc3RhbmJ1bCBpZ25vcmUgbmV4dCAqL1xuaWYgKGlzRnVuY3Rpb24oL3gvKSkge1xuICBpc0Z1bmN0aW9uID0gZnVuY3Rpb24odmFsdWUpIHtcbiAgICByZXR1cm4gdHlwZW9mIHZhbHVlID09PSAnZnVuY3Rpb24nICYmIHRvU3RyaW5nLmNhbGwodmFsdWUpID09PSAnW29iamVjdCBGdW5jdGlvbl0nO1xuICB9O1xufVxudmFyIGlzRnVuY3Rpb247XG5leHBvcnRzLmlzRnVuY3Rpb24gPSBpc0Z1bmN0aW9uO1xuLyogaXN0YW5idWwgaWdub3JlIG5leHQgKi9cbnZhciBpc0FycmF5ID0gQXJyYXkuaXNBcnJheSB8fCBmdW5jdGlvbih2YWx1ZSkge1xuICByZXR1cm4gKHZhbHVlICYmIHR5cGVvZiB2YWx1ZSA9PT0gJ29iamVjdCcpID8gdG9TdHJpbmcuY2FsbCh2YWx1ZSkgPT09ICdbb2JqZWN0IEFycmF5XScgOiBmYWxzZTtcbn07XG5leHBvcnRzLmlzQXJyYXkgPSBpc0FycmF5O1xuXG5mdW5jdGlvbiBlc2NhcGVFeHByZXNzaW9uKHN0cmluZykge1xuICAvLyBkb24ndCBlc2NhcGUgU2FmZVN0cmluZ3MsIHNpbmNlIHRoZXkncmUgYWxyZWFkeSBzYWZlXG4gIGlmIChzdHJpbmcgaW5zdGFuY2VvZiBTYWZlU3RyaW5nKSB7XG4gICAgcmV0dXJuIHN0cmluZy50b1N0cmluZygpO1xuICB9IGVsc2UgaWYgKHN0cmluZyA9PSBudWxsKSB7XG4gICAgcmV0dXJuIFwiXCI7XG4gIH0gZWxzZSBpZiAoIXN0cmluZykge1xuICAgIHJldHVybiBzdHJpbmcgKyAnJztcbiAgfVxuXG4gIC8vIEZvcmNlIGEgc3RyaW5nIGNvbnZlcnNpb24gYXMgdGhpcyB3aWxsIGJlIGRvbmUgYnkgdGhlIGFwcGVuZCByZWdhcmRsZXNzIGFuZFxuICAvLyB0aGUgcmVnZXggdGVzdCB3aWxsIGRvIHRoaXMgdHJhbnNwYXJlbnRseSBiZWhpbmQgdGhlIHNjZW5lcywgY2F1c2luZyBpc3N1ZXMgaWZcbiAgLy8gYW4gb2JqZWN0J3MgdG8gc3RyaW5nIGhhcyBlc2NhcGVkIGNoYXJhY3RlcnMgaW4gaXQuXG4gIHN0cmluZyA9IFwiXCIgKyBzdHJpbmc7XG5cbiAgaWYoIXBvc3NpYmxlLnRlc3Qoc3RyaW5nKSkgeyByZXR1cm4gc3RyaW5nOyB9XG4gIHJldHVybiBzdHJpbmcucmVwbGFjZShiYWRDaGFycywgZXNjYXBlQ2hhcik7XG59XG5cbmV4cG9ydHMuZXNjYXBlRXhwcmVzc2lvbiA9IGVzY2FwZUV4cHJlc3Npb247ZnVuY3Rpb24gaXNFbXB0eSh2YWx1ZSkge1xuICBpZiAoIXZhbHVlICYmIHZhbHVlICE9PSAwKSB7XG4gICAgcmV0dXJuIHRydWU7XG4gIH0gZWxzZSBpZiAoaXNBcnJheSh2YWx1ZSkgJiYgdmFsdWUubGVuZ3RoID09PSAwKSB7XG4gICAgcmV0dXJuIHRydWU7XG4gIH0gZWxzZSB7XG4gICAgcmV0dXJuIGZhbHNlO1xuICB9XG59XG5cbmV4cG9ydHMuaXNFbXB0eSA9IGlzRW1wdHk7ZnVuY3Rpb24gYXBwZW5kQ29udGV4dFBhdGgoY29udGV4dFBhdGgsIGlkKSB7XG4gIHJldHVybiAoY29udGV4dFBhdGggPyBjb250ZXh0UGF0aCArICcuJyA6ICcnKSArIGlkO1xufVxuXG5leHBvcnRzLmFwcGVuZENvbnRleHRQYXRoID0gYXBwZW5kQ29udGV4dFBhdGg7IiwiLy8gVVNBR0U6XG4vLyB2YXIgaGFuZGxlYmFycyA9IHJlcXVpcmUoJ2hhbmRsZWJhcnMnKTtcblxuLy8gdmFyIGxvY2FsID0gaGFuZGxlYmFycy5jcmVhdGUoKTtcblxudmFyIGhhbmRsZWJhcnMgPSByZXF1aXJlKCcuLi9kaXN0L2Nqcy9oYW5kbGViYXJzJylbXCJkZWZhdWx0XCJdO1xuXG5oYW5kbGViYXJzLlZpc2l0b3IgPSByZXF1aXJlKCcuLi9kaXN0L2Nqcy9oYW5kbGViYXJzL2NvbXBpbGVyL3Zpc2l0b3InKVtcImRlZmF1bHRcIl07XG5cbnZhciBwcmludGVyID0gcmVxdWlyZSgnLi4vZGlzdC9janMvaGFuZGxlYmFycy9jb21waWxlci9wcmludGVyJyk7XG5oYW5kbGViYXJzLlByaW50VmlzaXRvciA9IHByaW50ZXIuUHJpbnRWaXNpdG9yO1xuaGFuZGxlYmFycy5wcmludCA9IHByaW50ZXIucHJpbnQ7XG5cbm1vZHVsZS5leHBvcnRzID0gaGFuZGxlYmFycztcblxuLy8gUHVibGlzaCBhIE5vZGUuanMgcmVxdWlyZSgpIGhhbmRsZXIgZm9yIC5oYW5kbGViYXJzIGFuZCAuaGJzIGZpbGVzXG4vKiBpc3RhbmJ1bCBpZ25vcmUgZWxzZSAqL1xuaWYgKHR5cGVvZiByZXF1aXJlICE9PSAndW5kZWZpbmVkJyAmJiByZXF1aXJlLmV4dGVuc2lvbnMpIHtcbiAgdmFyIGV4dGVuc2lvbiA9IGZ1bmN0aW9uKG1vZHVsZSwgZmlsZW5hbWUpIHtcbiAgICB2YXIgZnMgPSByZXF1aXJlKFwiZnNcIik7XG4gICAgdmFyIHRlbXBsYXRlU3RyaW5nID0gZnMucmVhZEZpbGVTeW5jKGZpbGVuYW1lLCBcInV0ZjhcIik7XG4gICAgbW9kdWxlLmV4cG9ydHMgPSBoYW5kbGViYXJzLmNvbXBpbGUodGVtcGxhdGVTdHJpbmcpO1xuICB9O1xuICByZXF1aXJlLmV4dGVuc2lvbnNbXCIuaGFuZGxlYmFyc1wiXSA9IGV4dGVuc2lvbjtcbiAgcmVxdWlyZS5leHRlbnNpb25zW1wiLmhic1wiXSA9IGV4dGVuc2lvbjtcbn1cbiIsbnVsbCwidmFyIHNlYXJjaCA9IHJlcXVpcmUoJy4vbW9kdWxlcy9zZWFyY2guanMnKTtcbnZhciBhcGkgPSByZXF1aXJlKCcuL21vZHVsZXMvYXBpLmpzJyk7XG52YXIgbmF2cyA9IHJlcXVpcmUoJy4vbW9kdWxlcy9uYXZzLmpzJyk7XG52YXIgdGFibGVzID0gcmVxdWlyZSgnLi9tb2R1bGVzL3RhYmxlcy5qcycpO1xudmFyIHRtcGxzID0gcmVxdWlyZSgnLi9tb2R1bGVzL3RtcGxzLmpzJyk7XG52YXIgZmlsdGVycyA9IHJlcXVpcmUoJy4vbW9kdWxlcy9maWx0ZXJzLmpzJyk7XG52YXIgdXJscyA9IHJlcXVpcmUoJy4vbW9kdWxlcy91cmxzLmpzJyk7XG5cbmFwaS5pbml0KCk7XG5zZWFyY2guaW5pdCgpO1xubmF2cy5pbml0KCk7XG50YWJsZXMuaW5pdCgpO1xudG1wbHMuaW5pdCgpO1xuZmlsdGVycy5pbml0KCk7XG51cmxzLmluaXQoKTtcbiIsInZhciBzaW5ndWxhcml6ZSA9IGZ1bmN0aW9uKGNhdGVnb3J5KSB7XG4gICAgcmV0dXJuIGNhdGVnb3J5LnNwbGl0KCcnKS5zbGljZSgwLCAtMSkuam9pbignJyk7XG59O1xuXG52YXIgY2FsbEFQSSA9IGZ1bmN0aW9uKHVybCkge1xuICAgIHJldHVybiAkLmFqYXgoe1xuICAgICAgICB1cmw6IHVybCxcbiAgICAgICAgc3VjY2VzczogZnVuY3Rpb24oZGF0YSkge1xuICAgICAgICAgICAgY29uc29sZS5sb2coZGF0YSk7XG4gICAgICAgIH1cbiAgICB9KTtcbn07XG5cbm1vZHVsZS5leHBvcnRzID0ge1xuICAgIGluaXQ6IGZ1bmN0aW9uKCkge1xuICAgICAgICB2YXIgZXZlbnRzID0gcmVxdWlyZSgnLi9ldmVudHMuanMnKTtcblxuICAgICAgICBldmVudHMub24oJ3NlYXJjaDpzdWJtaXR0ZWQnLCBmdW5jdGlvbihlKSB7XG4gICAgICAgICAgICBjb25zb2xlLmxvZyhlLnF1ZXJ5KTtcbiAgICAgICAgfSk7XG5cbiAgICAgICAgZXZlbnRzLm9uKCdsb2FkOmJyb3dzZScsIGZ1bmN0aW9uKGUpIHtcbiAgICAgICAgICAgIHZhciBwcm9taXNlID0gY2FsbEFQSSgncmVzdC8nICsgc2luZ3VsYXJpemUoZS5jYXRlZ29yeSkpO1xuXG4gICAgICAgICAgICBwcm9taXNlLmRvbmUoZnVuY3Rpb24oZGF0YSkge1xuICAgICAgICAgICAgICAgIGUuZGF0YSA9IGRhdGE7XG4gICAgICAgICAgICAgICAgZXZlbnRzLmVtaXQoJ3JlbmRlcjpicm93c2UnLCBlKTtcbiAgICAgICAgICAgIH0pO1xuICAgICAgICB9KTtcbiAgICB9XG59O1xuIiwidmFyIEV2ZW50RW1pdHRlcjIgPSByZXF1aXJlKCdldmVudGVtaXR0ZXIyJykuRXZlbnRFbWl0dGVyMjtcbnRoaXMuY2FjaGUgPSB0aGlzLmNhY2hlIHx8IG5ldyBFdmVudEVtaXR0ZXIyKCk7XG5cbm1vZHVsZS5leHBvcnRzID0gdGhpcy5jYWNoZTtcbiIsInZhciBldmVudHMgPSByZXF1aXJlKCcuL2V2ZW50cy5qcycpO1xuXG52YXIgcmVuZGVyRmlsdGVycyA9IGZ1bmN0aW9uKGUpIHtcbiAgICAkKCcjY2FuZGlkYXRlLWZpbHRlcnMgc2VsZWN0JykuY2hvc2VuKHt3aWR0aDogXCIxMDAlXCJ9KTtcbn07XG5cbm1vZHVsZS5leHBvcnRzID0ge1xuICAgIGluaXQ6IGZ1bmN0aW9uKCkge1xuICAgICAgICBldmVudHMub24oJ2JpbmQ6YnJvd3NlJywgcmVuZGVyRmlsdGVycyk7XG4gICAgICAgICQoJy5maWx0ZXItaGVhZGVyLWJhcicpLm9uKCdjbGljaycsIGZ1bmN0aW9uKCkge1xuICAgICAgICAgICAgJCgnLmZpbHRlci1maWVsZC1jb250YWluZXInKS5zbGlkZVRvZ2dsZSgpO1xuICAgICAgICB9KTtcblxuICAgICAgICAvLyBpZiBsb2FkZWQgb24gYSBwYWdlIHdpdGggZmlsdGVycywgaW5pdCBjaG9zZW5cbiAgICAgICAgJCgnI2NhbmRpZGF0ZS1maWx0ZXJzIHNlbGVjdCcpLmNob3Nlbih7d2lkdGg6IFwiMTAwJVwifSk7XG4gICAgfVxufTtcbiIsInZhciBldmVudHMgPSByZXF1aXJlKCcuL2V2ZW50cy5qcycpO1xuXG52YXIgbmF2Q2xpY2tIYW5kbGVyID0gZnVuY3Rpb24oZSkge1xuICAgIGUucHJldmVudERlZmF1bHQoKTtcblxuICAgIGV2ZW50cy5lbWl0KCdsb2FkOmJyb3dzZScsIHtcbiAgICAgICAgJ2NhdGVnb3J5JzogZS50YXJnZXQubmFtZVxuICAgIH0pO1xuXG4gICAgY2hhbmdlQWN0aXZlTmF2TGluayhlLnRhcmdldC5uYW1lKTtcbn07XG5cbnZhciBjaGFuZ2VBY3RpdmVOYXZMaW5rID0gZnVuY3Rpb24oY2F0ZWdvcnkpIHtcbiAgICAkKCcuaGVhZGVyLW5hdi1iYXIgYScpLnJlbW92ZUNsYXNzKCdhY3RpdmUnKTtcbiAgICAkKCcuaGVhZGVyLW5hdi1iYXIgYVtuYW1lPScgKyBjYXRlZ29yeSArICddJykuYWRkQ2xhc3MoJ2FjdGl2ZScpO1xufTtcblxubW9kdWxlLmV4cG9ydHMgPSB7XG4gICAgaW5pdDogZnVuY3Rpb24oKSB7XG4gICAgICAgIHZhciBzZWN0aW9uID0gJCgnI21haW4nKS5kYXRhKCdzZWN0aW9uJyk7XG4gICAgICAgICQoJy5oZWFkZXItbmF2LWJhciBhJykub24oJ2NsaWNrJywgbmF2Q2xpY2tIYW5kbGVyKTtcbiAgICAgICAgJCgnLmJyb3dzZS1saW5rcyBhJykub24oJ2NsaWNrJywgbmF2Q2xpY2tIYW5kbGVyKTtcblxuICAgICAgICBpZiAodHlwZW9mIHNlY3Rpb24gIT09ICd1bmRlZmluZWQnKSB7XG4gICAgICAgICAgICBjaGFuZ2VBY3RpdmVOYXZMaW5rKHNlY3Rpb24pO1xuICAgICAgICB9XG4gICAgfVxufTtcblxuIiwibW9kdWxlLmV4cG9ydHMgPSB7XG4gICAgaW5pdDogZnVuY3Rpb24oKSB7XG4gICAgICAgICQoJyNzZWFyY2gnKS5vbignc3VibWl0JywgZnVuY3Rpb24oZSkge1xuICAgICAgICAgICAgZS5wcmV2ZW50RGVmYXVsdCgpO1xuICAgICAgICAgICAgdmFyIGV2ZW50cyA9IHJlcXVpcmUoJy4vZXZlbnRzLmpzJyk7XG4gICAgICAgICAgICB2YXIgc2VhcmNoUXVlcnkgPSAkKGUudGFyZ2V0KS5maW5kKCdpbnB1dFtuYW1lPXNlYXJjaF0nKS52YWwoKTtcblxuICAgICAgICAgICAgZXZlbnRzLmVtaXQoJ3NlYXJjaDpzdWJtaXR0ZWQnLCB7J3F1ZXJ5Jzogc2VhcmNoUXVlcnl9KTtcbiAgICAgICAgfSk7XG4gICAgfVxufTtcbiIsInZhciBldmVudHMgPSByZXF1aXJlKCcuL2V2ZW50cy5qcycpO1xuXG52YXIgcmVuZGVyVGFibGUgPSBmdW5jdGlvbihlKSB7XG4gICAgY29uc29sZS5sb2coZS5jYXRlZ29yeSk7XG59O1xuXG5tb2R1bGUuZXhwb3J0cyA9IHtcbiAgICBpbml0OiBmdW5jdGlvbigpIHtcbiAgICAgICAgZXZlbnRzLm9uKCdyZW5kZXI6YnJvd3NlJywgcmVuZGVyVGFibGUpO1xuICAgIH1cbn07XG4iLCJ2YXIgZXZlbnRzID0gcmVxdWlyZSgnLi9ldmVudHMuanMnKTtcbnZhciBIYW5kbGViYXJzID0gcmVxdWlyZSgnaGFuZGxlYmFycycpO1xudmFyIHRlbXBsYXRlcyA9IHt9O1xuXG52YXIgcmVuZGVyQnJvd3NlID0gZnVuY3Rpb24oZSkge1xuICAgIHZhciB0bXBsTmFtZSA9IGUuY2F0ZWdvcnksXG4gICAgICAgIHByb21pc2UgPSBsb2FkVGVtcGxhdGUoJ3ZpZXdzLycgKyB0bXBsTmFtZSArICcuaGFuZGxlYmFycycpO1xuXG4gICAgICAgIHByb21pc2UuZG9uZShmdW5jdGlvbihkYXRhKSB7XG4gICAgICAgICAgICB2YXIgY29udGV4dCA9IHt9O1xuICAgICAgICAgICAgY29udGV4dC5jYW5kaWRhdGVzID0gYnVpbGRDYW5kaWRhdGVDb250ZXh0KGUuZGF0YVsyXS5yZXN1bHRzKTtcbiAgICAgICAgICAgIHRlbXBsYXRlc1t0bXBsTmFtZV0gPSBIYW5kbGViYXJzLmNvbXBpbGUoZGF0YSk7XG4gICAgICAgICAgICAkKCcjbWFpbicpLmh0bWwodGVtcGxhdGVzW3RtcGxOYW1lXShjb250ZXh0KSk7XG4gICAgICAgICAgICBldmVudHMuZW1pdCgnYmluZDpicm93c2UnKTtcbiAgICAgICAgfS5iaW5kKGUpKTtcbn07XG5cbnZhciBsb2FkVGVtcGxhdGUgPSBmdW5jdGlvbih1cmwpIHtcbiAgICByZXR1cm4gJC5hamF4KHtcbiAgICAgICAgdXJsOiB1cmwsXG4gICAgICAgIGRhdGFUeXBlOiAndGV4dCdcbiAgICB9KTtcbn07XG5cbnZhciBidWlsZENhbmRpZGF0ZUNvbnRleHQgPSBmdW5jdGlvbihyZXN1bHRzKSB7XG4gICAgdmFyIGNhbmRpZGF0ZXMgPSBbXSxcbiAgICAgICAgaSA9IDAsXG4gICAgICAgIGxlbiA9IHJlc3VsdHMubGVuZ3RoLFxuICAgICAgICBlbGVjdGlvbnMsXG4gICAgICAgIGVsZWN0aW9uLFxuICAgICAgICB5ZWFyO1xuXG4gICAgZm9yIChpOyBpIDwgbGVuOyBpKyspIHtcbiAgICAgICAgZWxlY3Rpb25zID0gcmVzdWx0c1tpXS5lbGVjdGlvbnM7XG4gICAgICAgIHllYXIgPSBPYmplY3Qua2V5cyhlbGVjdGlvbnMpWzBdO1xuICAgICAgICBlbGVjdGlvbiA9IGVsZWN0aW9uc1t5ZWFyXTtcblxuICAgICAgICBjYW5kaWRhdGVzW2ldID0ge1xuICAgICAgICAgICAgJ25hbWUnOiByZXN1bHRzW2ldLm5hbWUuZnVsbF9uYW1lLFxuICAgICAgICAgICAgJ29mZmljZSc6IGVsZWN0aW9uLm9mZmljZV9zb3VnaHQsXG4gICAgICAgICAgICAnZWxlY3Rpb24nOiB5ZWFyLFxuICAgICAgICAgICAgJ3BhcnR5JzogZWxlY3Rpb24ucGFydHlfYWZmaWxpYXRpb24sXG4gICAgICAgICAgICAnc3RhdGUnOiBlbGVjdGlvbi5zdGF0ZSxcbiAgICAgICAgICAgICdkaXN0cmljdCc6IGVsZWN0aW9uLmRpc3RyaWN0XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICByZXR1cm4gY2FuZGlkYXRlcztcbn07XG5cbm1vZHVsZS5leHBvcnRzID0ge1xuICAgIGluaXQ6IGZ1bmN0aW9uKCkge1xuICAgICAgICBldmVudHMub24oJ3JlbmRlcjpicm93c2UnLCByZW5kZXJCcm93c2UpO1xuICAgIH1cbn07XG4iLCJ2YXIgZXZlbnRzID0gcmVxdWlyZSgnLi9ldmVudHMuanMnKTtcblxudmFyIGNoYW5nZVVSTCA9IGZ1bmN0aW9uKGNvbnRleHQpIHtcbiAgICB3aW5kb3cuaGlzdG9yeS5wdXNoU3RhdGUoJycsICcnLCAnLycgKyBjb250ZXh0LmNhdGVnb3J5KTtcbn07XG5cbm1vZHVsZS5leHBvcnRzID0ge1xuICAgIGluaXQ6IGZ1bmN0aW9uKCkge1xuICAgICAgICBldmVudHMub24oJ3JlbmRlcjpicm93c2UnLCBjaGFuZ2VVUkwpO1xuICAgIH1cbn07XG4iXX0=
