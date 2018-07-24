(function(){function r(e,n,t){function o(i,f){if(!n[i]){if(!e[i]){var c="function"==typeof require&&require;if(!f&&c)return c(i,!0);if(u)return u(i,!0);var a=new Error("Cannot find module '"+i+"'");throw a.code="MODULE_NOT_FOUND",a}var p=n[i]={exports:{}};e[i][0].call(p.exports,function(r){var n=e[i][1][r];return o(n||r)},p,p.exports,r,e,n,t)}return n[i].exports}for(var u="function"==typeof require&&require,i=0;i<t.length;i++)o(t[i]);return o}return r})()({1:[function(require,module,exports){
'use strict';

localStorage.logLevel = 1;

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
},{}],2:[function(require,module,exports){
'use strict';

var logging = require('./Logging');

exports.extendObservable = function (document) {
    document.fsDocumentId;
    document.fsBaseCollection;
    document.lock = false;
    document.twoWayBinding = true;

    /* create 'hidden' observables to track changes */
    Object.defineProperty(document, 'state', {
        enumerable: false,
        configurable: false,
        writable: false,
        value: ko.observable(0) /* UNCHANGED */
    });
      Object.defineProperty(document, 'modified', {
        enumerable: false,
        configurable: false,
        writable: false,
        value: ko.pureComputed(function () {
            return document.state() != 0;
        })
    });

    /* extend the prototype (the same protoype will be extended for each instance: TODO: OPTIMIZE) */
    document.__proto__.saveProperty = saveProperty;
    document.__proto__.getFlatDocument = getFlatDocument;
    document.__proto__.save = save;

    /* subscribe to the Knockout changes
     * enumerate using keys() and filter out protoype functions with hasOwnProperty() in stead of using 
     * getOwnPropertyNames(), because the latter also returns non-enumerables */
    for(var index in Object.keys(document)) {
        var propertyName = Object.keys(document)[index];
        
        if(!document.hasOwnProperty(propertyName)) continue;

        var property = document[propertyName];

        /* Bind listeners to the properties */
        if(ko.isObservable(property) && 
           !ko.isObservableArray(property) && 
           !ko.isComputed(property)) {

            (function (elementName) {
                property.subscribe(function(value) { 
                    logging.debug('Knockout observable property "' + elementName + '" changed. LocalOnly: ' + document.lock);
                        
                    /* ignore updates triggered by incoming changes from Firebase */
                    if (!document.lock) {
                        if(document.twoWayBinding) { 
                            document.saveProperty(elementName, value);
                        }
                        else if(document.state() != 1) { /* if state is NEW keep it in this state untill it is saved, even if it's modified in the mean time */
                            document.state(2); /* MODIFIED */
                        }
                    }
                });
            })(propertyName);
        }
    }
}

function getFlatDocument () {
    var document = {};

    /* enumerate using keys() and filter out protoype functions with hasOwnProperty() in stead of using 
     * getOwnPropertyNames(), because the latter also returns non-enumerables */
    for(var index in Object.keys(this)) {
        var propertyName = Object.keys(this)[index];

        if(!this.hasOwnProperty(propertyName)) continue;

        var property = this[propertyName];

        if(ko.isObservable(property) && !ko.isComputed(property)) {
            var propertyValue;
            if(typeof property() === 'boolean' || typeof property() === 'number') {
                propertyValue = property(); /* 0 or false should just be inserted as a value */
            }
            else {
                propertyValue = property() || '' ; /* but not null, undefined or the likes */
            }
            
            document[propertyName] = propertyValue;
        }
    }

    return document;
}

function save () {
    if(this.state() == 0) {
        logging.debug('Firestore document ' + this.fsDocumentId + ' unchanged');
        return;
    }

    var self = this;
    var thisDocument = this.getFlatDocument();

    if (self.state() == 1 ) { /* NEW */
        this.fsBaseCollection.add(thisDocument).then(function (doc) {
            logging.debug('Firestore document ' + doc.id + ' added to database');
            self.state(0);
            self.fsDocumentId = doc.id;
        }).catch(function (error) {
            logging.error('Error adding Firestore document :', error);
        });
    }
    else if(self.state() == 2) { /* MODIFIED */
        this.fsBaseCollection.doc(this.fsDocumentId).update(thisDocument).then(function () {
            logging.debug('Firestore document ' + self.fsDocumentId + ' saved to database');
            self.state(0);
        }).catch(function (error) {
            logging.error('Error saving Firestore document :', error);
        });
    }
    else if(self.state() == 3) { /* DELETED */
        this.fsBaseCollection.doc(this.fsDocumentId).delete().then(function () {
            logging.debug('Firestore document ' + self.fsDocumentId + ' deleted from database');
        }).catch(function (error) {
            logging.error('Error saving Firestore document :', error);
        });
    }
}

function saveProperty (property, value) {
    var self = this;
    var doc = {};
    doc[property] = value;
    
    this.fsBaseCollection.doc(this.fsDocumentId).update(doc).then(function () {
        logging.debug('Firestore document ' + self.fsDocumentId + ' saved to database');
    }).catch(function (error) {
        logging.error('Error saving Firestore document :', error);
    });
}

},{"./Logging":1}],3:[function(require,module,exports){
'use strict';
var observable = require('./ModelExtensions');
var logging = require('./Logging');

exports.extendObservableArray = function (koObservableArray) {
    koObservableArray.fsQuery;
    koObservableArray.fsCollection;
    koObservableArray.localOnly = false;
    koObservableArray.twoWayBinding = true;

    /* extend the prototype (the same protoype will be extended for each instance: TODO: OPTIMIZE) */
    koObservableArray.__proto__.getDocument = getDocument;
    koObservableArray.__proto__.detach = detach;
    koObservableArray.__proto__.saveAll = saveAll;

    koObservableArray.subscribe(collectionChanged, koObservableArray, 'arrayChange');
}

function getDocument(id) {
    for (var i = 0; i < this().length; i++) {
        if (this()[i].fsDocumentId === id)
            return this()[i];
    }
    return null;
}

function detach(item) {
    /* if this collection is Two-Way bound, just delete */
    if(this.twoWayBinding) {
        this.remove(item);
    }
    else {
        item.state(3); /* DELETED */

        /* use Knockout's internal _destroy property to filter this item out of the UI */
        this.destroy(item);

        logging.debug('Document "' + item.fsDocumentId + '" detached from local collection.');
    }
}

function saveAll() {
    for (var i = 0; i < this().length; i++) {
        if (this()[i].state() !== 0)
            this()[i].save();
    }
}

function collectionChanged(changes) {
    /* if local only change (e.g. triggered by load from Firestore) return */
    if(this.localOnly) { return; }

    for(var index in changes) {
        var item = changes[index].value;
        
        switch(changes[index].status) {
            case 'added':
                /* extend the Model with the ObservableDocument functionality */
                observable.extendObservable(item);
                item.twoWayBinding = this.twoWayBinding;

                if(this.twoWayBinding) {
                    logging.debug('Adding new document to Firestore collection "' + this.fsCollection.id +'"');

                    this.fsCollection.add(item.getFlatDocument())
                    .then(function (doc) {
                        item.fsBaseCollection = doc.parent;
                        item.fsDocumentId = doc.id;

                        /* get deep includes for Array properties 
                         * TODO: fix that the deep linking is done here AND in explodeObject in knockout.firestore.js */
                        bindDeepIncludes(item);
                    }).catch(function (error) {
                        logging.error('Error saving Firestore document :', error);
                    });
                }
                else {
                    logging.debug('Adding new document to local collection only');
                    item.state(1); /* NEW */
                    item.fsBaseCollection = this.fsCollection;
                }

                break;
            case 'deleted':
                if(this.twoWayBinding) {
                    logging.debug('Deleting document "' + item.fsDocumentId + '" from Firestore collection "' + this.fsCollection.id +'"');

                    item.fsBaseCollection.doc(item.fsDocumentId).delete().catch(function (error) {
                        logging.error('Error deleting Firestore document :', error);
                    });
                }
                else {
                    logging.debug('Document "' + item.fsDocumentId + '" removed from local collection.');
                    logging.debug('You\'re not using Two-Way binding, please use .detach() in stead of .remove() to persist the change when syncing to Firestore');
                }

                break;
        }
    }
}

function bindDeepIncludes(item) {
    /* enumerate using keys() and filter out protoype functions with hasOwnProperty() in stead of using 
     * getOwnPropertyNames(), because the latter also returns non-enumerables */
    for(var index in Object.keys(item)) {
        var propertyName = Object.keys(item)[index];
        
        if(!item.hasOwnProperty(propertyName)) continue;

        var property = item[propertyName];

        /* get deep includes for Array properties */
        if(ko.isObservableArray(property)) {
            var collectionRef = item.fsBaseCollection.doc(item.fsDocumentId).collection(propertyName);
            kofs.bindCollection(property, collectionRef, Action, { twoWayBinding: item.twoWayBinding });
        }
    }
}
},{"./Logging":1,"./ModelExtensions":2}],4:[function(require,module,exports){
'use strict';

/* expose the library to the global scope */
window.kofs = require('./knockout.firestore');
},{"./knockout.firestore":5}],5:[function(require,module,exports){
'use strict';
var modelExtensions = require('./ModelExtensions');
var observableArrayExtensions = require('./ObservableArrayExtensions');
var logging = require('./Logging');


/* WHILE 3.5.0 OF KNOCKOUT IS STILL RC */
ko.isObservableArray = function (instance) {
    return ko.isObservable(instance)
        && typeof instance["remove"] == "function"
        && typeof instance["push"] == "function";
};
/* END OF 3.5.0 FUNCTIONALITY */

exports.getBoundCollection = function (fsCollection, object, options) {
    /* create the collection as a ko.observableArray and bind it */
    var collection = ko.observableArray();

    kofs.bindCollection(collection, fsCollection, object, options);

    return collection;
}

exports.bindCollection = function (observableArray, fsCollection, object, options) {
    /* settings */
    options = options || {};
    var where = options.where || [];
    var orderBy = options.orderBy || [];
    var twoWayBinding = typeof options.twoWayBinding === 'undefined' ? true : options.twoWayBinding;

    /* set log level */
    if(options.logLevel) { logging.setLogLevel(options.logLevel); }

    /* create the Firestore query from the collection and the options */
    var query = createFirestoreQuery(fsCollection, where, orderBy);

    /* extend the observableArray with our functions */
    observableArrayExtensions.extendObservableArray(observableArray);
    observableArray.twoWayBinding = twoWayBinding;
    observableArray.fsQuery = query;
    observableArray.fsCollection = fsCollection;
    
    /* subscribe to the Firestore collection */
    query.onSnapshot(function(snapshot) {
        snapshot.docChanges().forEach(function(change) {
            /* ignore local changes */
            if(!change.doc.metadata.hasPendingWrites) {
                
                if (change.type === "added") {
                    logging.debug('Firestore object ' + change.doc.id + ' added to collection');
                    var item = new object();
                    
                    /* extend the Model with the ObservableDocument functionality */
                    modelExtensions.extendObservable(item);

                    /* fill the new object with meta-data */
                    item.fsBaseCollection = change.doc.ref.parent;
                    item.fsDocumentId = change.doc.id;
                    item.twoWayBinding = twoWayBinding;

                    /* explode the data AND deep include if two-way */
                    explodeObject(change.doc, item, twoWayBinding);
                    
                    /* set the collection to localOnly to ignore these incoming changes from Firebase */
                    observableArray.localOnly = true;
                    observableArray.push(item);
                    observableArray.localOnly = false;
                }
                if (change.type === "modified") {
                    logging.debug('Firestore object ' + change.doc.id + ' modified');
                    var localDoc = observableArray.getDocument(change.doc.id);
                    if(localDoc != null) {
                        /* explode the data, but don't mess with the deep includes */
                        explodeObject(change.doc, localDoc, false);
                    }
                    else {
                        logging.debug('Firestore object ' + change.doc.id + ' not found in local collection');
                    }
                }
                if (change.type === "removed") {
                    logging.debug('Firestore object ' + change.doc.id + ' removed from collection');
                    var localDoc = observableArray.getDocument(change.doc.id);
                    if(localDoc != null) {
                        observableArray.localOnly = true;
                        observableArray.remove(localDoc);
                        observableArray.localOnly = false;
                    }
                    else {
                        /* when removing from Firestore, the snapshot is triggered, so it will try to remove it again when it's no longer there */
                        logging.debug('Firestore object ' + change.doc.id + ' not (longer) found in local collection');
                    }
                }

            }
        });
    });
}

function explodeObject(firestoreDocument, localObject, deepInclude) {
    /* during update set lock on the file, so there will be no update loop */
    localObject.lock = true;

    /* enumerate using keys() and filter out protoype functions with hasOwnProperty() in stead of using 
     * getOwnPropertyNames(), because the latter also returns non-enumerables */
    for(var index in Object.keys(localObject)) {
        var propertyName = Object.keys(localObject)[index];
        
        if(!localObject.hasOwnProperty(propertyName)) continue;

        var property = localObject[propertyName];

        /* get data from Firestore for primitive properties */
        if(ko.isObservable(property) && 
           !ko.isObservableArray(property) && 
           !ko.isComputed(property)) {

            var propertyData = firestoreDocument.get(propertyName);

            switch (typeof propertyData) {
                case 'undefined':
                    break;
                case 'string':
                case 'number':
                case 'boolean':
                    property(propertyData);
                    break;
                case 'object':
                    if(typeof propertyData.toDate === 'function') { /* assume Firestore.Timestamp */
                        property(propertyData.toDate());
                    }
                    break;
            }
        }

        /* get deep includes for Array properties */
        if(deepInclude && ko.isObservableArray(property)) {
            var collectionRef = localObject.fsBaseCollection.doc(localObject.fsDocumentId).collection(propertyName);
            kofs.bindCollection(property, collectionRef, Action, { twoWayBinding: localObject.twoWayBinding });
        }
    }

    /* reset lock */
    localObject.lock = false;
}

function createFirestoreQuery(collection, where, orderBy) {
    /* convert our where and orderby arrays to real Firestore queries */

    var query = collection;

    if(where != null && Array.isArray(where) && where.length > 0) {
        if(Array.isArray(where[0])) {
            for(var index in where) {
                var whereClause = where[index];

                query = query.where(whereClause[0], whereClause[1], whereClause[2]);
            }
        }
        else {
            query = query.where(where[0], where[1], where[2]);
        }
    }

    if(orderBy != null && Array.isArray(orderBy) && orderBy.length > 0) {
        if(Array.isArray(orderBy[0])) {
            for(var index in orderBy) {
                var orderByClause = orderBy[index];

                query = query.orderBy(orderByClause[0], whereClause[1]);
            }
        }
        else {
            query = query.orderBy(orderBy[0], orderBy[1]);
        }
    }

    return query;
}
},{"./Logging":1,"./ModelExtensions":2,"./ObservableArrayExtensions":3}]},{},[4]);
