'use strict';

localStorage.logLevel = 2;

exports.setLogLevel = function(level) {
    localStorage.logLevel = level;
}

exports.debug = function() {
    if(localStorage.logLevel == 2) {
        var args = Array.prototype.slice.call(arguments);
        args.unshift('[KOFS]');
        console.debug.apply(console, args);
    }
}

exports.error = function() {
    if(localStorage.logLevel > 0) {
        var args = Array.prototype.slice.call(arguments);
        args.unshift('[KOFS]');
        console.error.apply(console, args);
    }
}