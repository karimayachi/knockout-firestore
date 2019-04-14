(function(){function r(e,n,t){function o(i,f){if(!n[i]){if(!e[i]){var c="function"==typeof require&&require;if(!f&&c)return c(i,!0);if(u)return u(i,!0);var a=new Error("Cannot find module '"+i+"'");throw a.code="MODULE_NOT_FOUND",a}var p=n[i]={exports:{}};e[i][0].call(p.exports,function(r){var n=e[i][1][r];return o(n||r)},p,p.exports,r,e,n,t)}return n[i].exports}for(var u="function"==typeof require&&require,i=0;i<t.length;i++)o(t[i]);return o}return r})()({1:[function(require,module,exports){
"use strict";
exports.__esModule = true;
var helpers_1 = require("./helpers");
var ModelExtensions = /** @class */ (function () {
    function ModelExtensions() {
        var _this = this;
        this.lock = false;
        this.twoWayBinding = true;
        this.state = ko.observable(0); /* UNCHANGED */
        this.modified = ko.pureComputed(function () {
            return _this.state() != 0;
        });
        /* Don't use decorators or end up in Prototype Hell */
        Object.defineProperty(this, 'state', {
            enumerable: false,
            configurable: false,
            writable: false
        });
        Object.defineProperty(this, 'modified', {
            enumerable: false,
            configurable: false,
            writable: false
        });
    }
    ModelExtensions.prototype.getFlatDocument = function () {
        var document = {};
        /* enumerate using keys() and filter out protoype functions with hasOwnProperty() in stead of using
         * getOwnPropertyNames(), because the latter also returns non-enumerables */
        for (var _i = 0, _a = Object.keys(this); _i < _a.length; _i++) {
            var key = _a[_i];
            if (!this.hasOwnProperty(key))
                continue;
            var property = this[key];
            /* flatten properties, except computed and deep includes */
            if (ko.isObservable(property) &&
                !ko.isComputed(property) &&
                !this.includes[key]) {
                var propertyValue = void 0;
                if (typeof property() === 'boolean' || typeof property() === 'number') {
                    propertyValue = property(); /* 0 or false should just be inserted as a value */
                }
                else {
                    propertyValue = property() || ''; /* but not null, undefined or the likes */
                }
                document[key] = propertyValue;
            }
        }
        return document;
    };
    ModelExtensions.prototype.save = function () {
        var _this = this;
        if (this.state() == 0) {
            //logging.debug('Firestore document ' + this.fsDocumentId + ' unchanged');
            return;
        }
        if (this.fsBaseCollection === undefined) {
            //logging.error('Firestore document ' + this.fsDocumentId + ' not part of a Collection');
            return;
        }
        var thisDocument = this.getFlatDocument();
        if (this.state() == 1) { /* NEW */
            this.fsBaseCollection.add(thisDocument).then(function (doc) {
                //logging.debug('Firestore document ' + doc.id + ' added to database');
                _this.fsDocumentId = doc.id;
                if (_this.state() == 2) { /* document was modified while saving */
                    //logging.debug('Firestore document ' + doc.id + ' was modified during insert, save changes');
                    _this.save();
                }
                else {
                    _this.state(0);
                }
            })["catch"](function (error) {
                //logging.error('Error adding Firestore document :', error);
            });
        }
        else if (this.state() == 2) { /* MODIFIED */
            this.fsBaseCollection.doc(this.fsDocumentId).update(thisDocument).then(function () {
                //logging.debug('Firestore document ' + this.fsDocumentId + ' saved to database');
                _this.state(0);
            })["catch"](function (error) {
                //logging.error('Error saving Firestore document :', error);
            });
        }
        else if (this.state() == 3) { /* DELETED */
            this.fsBaseCollection.doc(this.fsDocumentId)["delete"]().then(function () {
                //logging.debug('Firestore document ' + this.fsDocumentId + ' deleted from database');
            })["catch"](function (error) {
                //logging.error('Error saving Firestore document :', error);
            });
        }
    };
    ModelExtensions.prototype.saveProperty = function (property, value) {
        var doc = {};
        doc[property] = value;
        if (this.fsBaseCollection === undefined) {
            //logging.error('Firestore document ' + this.fsDocumentId + ' not part of a Collection');
            return;
        }
        /* it can happen that a property change triggers saveProperty,
         * while the document is not yet properly saved in Firestore and
         * has no fsDocumentId yet. In that case don't save to Firestore,
         * but record the change and mark this document MODIFIED */
        if (typeof this.fsDocumentId === 'undefined') {
            this.state(2); // MODIFIED
        }
        else {
            this.fsBaseCollection.doc(this.fsDocumentId).update(doc).then(function () {
                //logging.debug('Firestore document ' + this.fsDocumentId + ' saved to database');
            })["catch"](function (error) {
                //logging.error('Error saving Firestore document :', error);
            });
        }
    };
    return ModelExtensions;
}());
exports.ModelExtensions = ModelExtensions;
/**
 * Creates a bindable from the given object and optionally the deep includes
 * (navigation properties)
 * @param model the object to be made bindable
 * @param includes (optional) the deep includes for eager loading
 */
function createBindable(model, includes) {
    var extension = new ModelExtensions();
    var bindableModel = helpers_1.mergeObjects(model, extension);
    bindableModel.includes = Object.assign(includes || {}, bindableModel.includes);
    var _loop_1 = function (key) {
        if (!bindableModel.hasOwnProperty(key))
            return "continue";
        var property = bindableModel[key];
        /* Bind listeners to the properties */
        if (ko.isObservable(property) &&
            (!ko.isObservableArray(property) || !bindableModel.includes[key]) &&
            !ko.isComputed(property)) {
            (function (elementName) {
                property.subscribe(function (value) {
                    //logging.debug('Knockout observable property "' + elementName + '" changed. LocalOnly: ' + bindableModel.lock);
                    /* ignore updates triggered by incoming changes from Firebase */
                    if (!bindableModel.lock) {
                        if (bindableModel.twoWayBinding) {
                            bindableModel.saveProperty(elementName, value);
                        }
                        else if (bindableModel.state() != 1) { /* if state is NEW keep it in this state untill it is saved, even if it's modified in the mean time */
                            bindableModel.state(2); /* MODIFIED */
                        }
                    }
                });
            })(key);
        }
    };
    /* subscribe to the Knockout changes
     * enumerate using keys() and filter out protoype functions with hasOwnProperty() in stead of using
     * getOwnPropertyNames(), because the latter also returns non-enumerables */
    for (var _i = 0, _a = Object.keys(bindableModel); _i < _a.length; _i++) {
        var key = _a[_i];
        _loop_1(key);
    }
    return bindableModel;
}
exports.createBindable = createBindable;

},{"./helpers":3}],2:[function(require,module,exports){
"use strict";
exports.__esModule = true;
var ArrayExtensions = /** @class */ (function () {
    function ArrayExtensions() {
        this.localOnly = false;
        this.twoWayBinding = false;
    }
    ArrayExtensions.prototype.getDocument = function (id) {
        /* assume 'this' is merged with an ObservableArray */
        var contents = this();
        for (var _i = 0, contents_1 = contents; _i < contents_1.length; _i++) {
            var doc = contents_1[_i];
            /* assume all documents are converted to Bindable */
            var bindableDoc = doc;
            if (bindableDoc.fsDocumentId === id)
                return bindableDoc;
        }
        return null;
    };
    ArrayExtensions.prototype.detach = function (item) {
        /* assume 'this' is merged with an ObservableArray */
        var observableArray = this;
        /* if this collection is Two-Way bound, just delete */
        if (observableArray.twoWayBinding) {
            observableArray.remove(item);
        }
        else {
            /* assume all items are converted to Bindable */
            item.state(3); /* DELETED */
            /* use Knockout's internal _destroy property to filter this item out of the UI */
            observableArray.destroy(item);
            //logging.debug('Document "' + item.fsDocumentId + '" detached from local collection.');
        }
    };
    ArrayExtensions.prototype.saveAll = function () {
        /* assume 'this' is merged with an ObservableArray */
        var contents = this();
        for (var _i = 0, contents_2 = contents; _i < contents_2.length; _i++) {
            var item = contents_2[_i];
            /* assume all items are converted to Bindable */
            var bindableItem = item;
            if (bindableItem.state() !== 0) {
                bindableItem.save();
            }
        }
    };
    return ArrayExtensions;
}());
exports.ArrayExtensions = ArrayExtensions;
function createBindableArray(koObservableArray) {
    //koObservableArray.subscribe(collectionChanged, koObservableArray, 'arrayChange');
    return koObservableArray;
}
exports.createBindableArray = createBindableArray;

},{}],3:[function(require,module,exports){
"use strict";
exports.__esModule = true;
function mergeObjects(target, source) {
    var newTarget = target;
    /* insert the prototype of source into target prototype chain (just one level deep) */
    var pSource = Object.getPrototypeOf(source);
    var pTarget = Object.getPrototypeOf(target);
    Object.setPrototypeOf(pSource, pTarget);
    Object.setPrototypeOf(target, pSource);
    /* copy the properties (not on the prototype chain, but including the non-enumerable) to the target */
    for (var _i = 0, _a = Object.getOwnPropertyNames(source); _i < _a.length; _i++) {
        var key = _a[_i];
        var descriptor = Object.getOwnPropertyDescriptor(source, key);
        if (descriptor && (!descriptor.writable || !descriptor.configurable || !descriptor.enumerable || descriptor.get || descriptor.set)) {
            Object.defineProperty(target, key, descriptor);
        }
        else {
            target[key] = source[key];
        }
    }
    return newTarget;
}
exports.mergeObjects = mergeObjects;

},{}],4:[function(require,module,exports){
"use strict";
exports.__esModule = true;
var BindableArray_1 = require("./BindableArray");
var Bindable_1 = require("./Bindable");
var kofs;
(function (kofs) {
    function getBoundCollection(fsCollection, model, options) {
        /* create the collection as a ko.observableArray and bind it */
        var observableArray = ko.observableArray();
        bindCollection(observableArray, fsCollection, model, options);
        return observableArray;
    }
    kofs.getBoundCollection = getBoundCollection;
    function bindCollection(observableArray, fsCollection, model, options) {
        /* settings */
        options = options || {};
        var where = options.where || [];
        var orderBy = options.orderBy || [];
        var includes = options.includes || {};
        var twoWayBinding = typeof options.twoWayBinding === 'undefined' ? true : options.twoWayBinding;
        /* set log level */
        //if (options.logLevel) { logging.setLogLevel(options.logLevel); }
        /* create the Firestore query from the collection and the options */
        var query = createFirestoreQuery(fsCollection, where, orderBy);
        /* extend the observableArray with our functions */
        var bindableArray = BindableArray_1.createBindableArray(observableArray);
        bindableArray.twoWayBinding = twoWayBinding;
        bindableArray.fsQuery = query;
        bindableArray.fsCollection = fsCollection;
        bindableArray.includes = includes;
        /* subscribe to the Firestore collection */
        query.onSnapshot(function (snapshot) {
            snapshot.docChanges().forEach(function (change) {
                /* ignore local changes */
                if (!change.doc.metadata.hasPendingWrites) {
                    if (change.type === 'added') {
                        //logging.debug('Firestore object ' + change.doc.id + ' added to collection');
                        var item = new model();
                        var index = change.newIndex;
                        /* extend the Model with the Bindable functionality */
                        var combinedIncludes = Object.assign(includes, item.includes);
                        var bindableItem = Bindable_1.createBindable(item, combinedIncludes);
                        /* fill the new object with meta-data
                         * extend / overrule the includes with includes from the passed options */
                        bindableItem.fsBaseCollection = change.doc.ref.parent;
                        bindableItem.fsDocumentId = change.doc.id;
                        bindableItem.twoWayBinding = twoWayBinding;
                        /* explode the data AND deep include if two-way */
                        explodeObject(change.doc, bindableItem, twoWayBinding);
                        /* set the collection to localOnly to ignore these incoming changes from Firebase */
                        bindableArray.localOnly = true;
                        bindableArray.splice(index, 0, bindableItem);
                        bindableArray.localOnly = false;
                    }
                    if (change.type === "modified") {
                        //logging.debug('Firestore object ' + change.doc.id + ' modified');
                        var localDoc = bindableArray.getDocument(change.doc.id);
                        if (localDoc != null) {
                            /* explode the data, but don't mess with the deep includes */
                            explodeObject(change.doc, localDoc, false);
                        }
                        else {
                            //logging.debug('Firestore object ' + change.doc.id + ' not found in local collection');
                        }
                    }
                    if (change.type === "removed") {
                        //logging.debug('Firestore object ' + change.doc.id + ' removed from collection');
                        var localDoc = bindableArray.getDocument(change.doc.id);
                        if (localDoc != null) {
                            bindableArray.localOnly = true;
                            bindableArray.remove(localDoc);
                            bindableArray.localOnly = false;
                        }
                        else {
                            /* when removing from Firestore, the snapshot is triggered, so it will try to remove it again when it's no longer there */
                            //logging.debug('Firestore object ' + change.doc.id + ' not (longer) found in local collection');
                        }
                    }
                }
            });
        });
    }
    kofs.bindCollection = bindCollection;
    function createFirestoreQuery(collection, where, orderBy) {
        /* convert our where and orderby arrays to real Firestore queries */
        var query = collection;
        if (where != null && Array.isArray(where) && where.length > 0) {
            if (Array.isArray(where[0])) {
                for (var _i = 0, where_1 = where; _i < where_1.length; _i++) {
                    var whereClause = where_1[_i];
                    query = query.where(whereClause[0], whereClause[1], whereClause[2]);
                }
            }
            else {
                query = query.where(where[0], where[1], where[2]);
            }
        }
        if (orderBy != null && Array.isArray(orderBy) && orderBy.length > 0) {
            if (Array.isArray(orderBy[0])) {
                for (var _a = 0, orderBy_1 = orderBy; _a < orderBy_1.length; _a++) {
                    var orderByClause = orderBy_1[_a];
                    query = query.orderBy(orderByClause[0], orderByClause[1]);
                }
            }
            else {
                query = query.orderBy(orderBy[0], orderBy[1]);
            }
        }
        return query;
    }
    function explodeObject(firestoreDocument, localObject, deepInclude) {
        /* during update set lock on the file, so there will be no update loop */
        localObject.lock = true;
        /* enumerate using keys() and filter out protoype functions with hasOwnProperty() in stead of using
         * getOwnPropertyNames(), because the latter also returns non-enumerables */
        for (var _i = 0, _a = Object.keys(localObject); _i < _a.length; _i++) {
            var key = _a[_i];
            if (!localObject.hasOwnProperty(key))
                continue;
            var propertyData = void 0;
            var property = localObject[key];
            /* get data from Firestore for primitive properties */
            if (ko.isObservable(property) &&
                !ko.isObservableArray(property) &&
                !ko.isComputed(property)) {
                propertyData = firestoreDocument.get(key);
                switch (typeof propertyData) {
                    case 'undefined':
                        break;
                    case 'string':
                    case 'number':
                    case 'boolean':
                        property(propertyData);
                        break;
                    case 'object':
                        if (propertyData && typeof propertyData.toDate === 'function') { /* assume Firestore.Timestamp */
                            property(propertyData.toDate());
                        }
                        break;
                }
            }
            /* get regular arrays, or arrays not marked for deep inclusion */
            if (ko.isObservableArray(property) && !localObject.includes[key]) {
                propertyData = firestoreDocument.get(key);
                if (Array.isArray(propertyData)) {
                    property(propertyData);
                }
            }
            /* get deep includes for Array properties */
            if (deepInclude &&
                ko.isObservableArray(property) &&
                localObject.includes[key] &&
                localObject.fsBaseCollection !== undefined) {
                var include = localObject.includes[key];
                var collectionRef = localObject.fsBaseCollection.doc(localObject.fsDocumentId).collection(key);
                kofs.bindCollection(property, collectionRef, include["class"], { twoWayBinding: localObject.twoWayBinding, orderBy: include.orderBy });
            }
        }
        /* reset lock */
        localObject.lock = false;
    }
})(kofs = exports.kofs || (exports.kofs = {}));

},{"./Bindable":1,"./BindableArray":2}],5:[function(require,module,exports){
'use strict';

/* expose the library to the global scope */
var library = require('../dist/knockout-firestore');

window.kofs = library.kofs;
},{"../dist/knockout-firestore":4}]},{},[5])
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uL3Vzci9sb2NhbC9saWIvbm9kZV9tb2R1bGVzL2Jyb3dzZXJpZnkvbm9kZV9tb2R1bGVzL2Jyb3dzZXItcGFjay9fcHJlbHVkZS5qcyIsImRpc3QvQmluZGFibGUuanMiLCJkaXN0L0JpbmRhYmxlQXJyYXkuanMiLCJkaXN0L2hlbHBlcnMuanMiLCJkaXN0L2tub2Nrb3V0LWZpcmVzdG9yZS5qcyIsInNyYy9pbmRleC5qcyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTtBQ0FBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDaEtBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3REQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDdkJBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ2xLQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EiLCJmaWxlIjoiZ2VuZXJhdGVkLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXNDb250ZW50IjpbIihmdW5jdGlvbigpe2Z1bmN0aW9uIHIoZSxuLHQpe2Z1bmN0aW9uIG8oaSxmKXtpZighbltpXSl7aWYoIWVbaV0pe3ZhciBjPVwiZnVuY3Rpb25cIj09dHlwZW9mIHJlcXVpcmUmJnJlcXVpcmU7aWYoIWYmJmMpcmV0dXJuIGMoaSwhMCk7aWYodSlyZXR1cm4gdShpLCEwKTt2YXIgYT1uZXcgRXJyb3IoXCJDYW5ub3QgZmluZCBtb2R1bGUgJ1wiK2krXCInXCIpO3Rocm93IGEuY29kZT1cIk1PRFVMRV9OT1RfRk9VTkRcIixhfXZhciBwPW5baV09e2V4cG9ydHM6e319O2VbaV1bMF0uY2FsbChwLmV4cG9ydHMsZnVuY3Rpb24ocil7dmFyIG49ZVtpXVsxXVtyXTtyZXR1cm4gbyhufHxyKX0scCxwLmV4cG9ydHMscixlLG4sdCl9cmV0dXJuIG5baV0uZXhwb3J0c31mb3IodmFyIHU9XCJmdW5jdGlvblwiPT10eXBlb2YgcmVxdWlyZSYmcmVxdWlyZSxpPTA7aTx0Lmxlbmd0aDtpKyspbyh0W2ldKTtyZXR1cm4gb31yZXR1cm4gcn0pKCkiLCJcInVzZSBzdHJpY3RcIjtcbmV4cG9ydHMuX19lc01vZHVsZSA9IHRydWU7XG52YXIgaGVscGVyc18xID0gcmVxdWlyZShcIi4vaGVscGVyc1wiKTtcbnZhciBNb2RlbEV4dGVuc2lvbnMgPSAvKiogQGNsYXNzICovIChmdW5jdGlvbiAoKSB7XG4gICAgZnVuY3Rpb24gTW9kZWxFeHRlbnNpb25zKCkge1xuICAgICAgICB2YXIgX3RoaXMgPSB0aGlzO1xuICAgICAgICB0aGlzLmxvY2sgPSBmYWxzZTtcbiAgICAgICAgdGhpcy50d29XYXlCaW5kaW5nID0gdHJ1ZTtcbiAgICAgICAgdGhpcy5zdGF0ZSA9IGtvLm9ic2VydmFibGUoMCk7IC8qIFVOQ0hBTkdFRCAqL1xuICAgICAgICB0aGlzLm1vZGlmaWVkID0ga28ucHVyZUNvbXB1dGVkKGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgIHJldHVybiBfdGhpcy5zdGF0ZSgpICE9IDA7XG4gICAgICAgIH0pO1xuICAgICAgICAvKiBEb24ndCB1c2UgZGVjb3JhdG9ycyBvciBlbmQgdXAgaW4gUHJvdG90eXBlIEhlbGwgKi9cbiAgICAgICAgT2JqZWN0LmRlZmluZVByb3BlcnR5KHRoaXMsICdzdGF0ZScsIHtcbiAgICAgICAgICAgIGVudW1lcmFibGU6IGZhbHNlLFxuICAgICAgICAgICAgY29uZmlndXJhYmxlOiBmYWxzZSxcbiAgICAgICAgICAgIHdyaXRhYmxlOiBmYWxzZVxuICAgICAgICB9KTtcbiAgICAgICAgT2JqZWN0LmRlZmluZVByb3BlcnR5KHRoaXMsICdtb2RpZmllZCcsIHtcbiAgICAgICAgICAgIGVudW1lcmFibGU6IGZhbHNlLFxuICAgICAgICAgICAgY29uZmlndXJhYmxlOiBmYWxzZSxcbiAgICAgICAgICAgIHdyaXRhYmxlOiBmYWxzZVxuICAgICAgICB9KTtcbiAgICB9XG4gICAgTW9kZWxFeHRlbnNpb25zLnByb3RvdHlwZS5nZXRGbGF0RG9jdW1lbnQgPSBmdW5jdGlvbiAoKSB7XG4gICAgICAgIHZhciBkb2N1bWVudCA9IHt9O1xuICAgICAgICAvKiBlbnVtZXJhdGUgdXNpbmcga2V5cygpIGFuZCBmaWx0ZXIgb3V0IHByb3RveXBlIGZ1bmN0aW9ucyB3aXRoIGhhc093blByb3BlcnR5KCkgaW4gc3RlYWQgb2YgdXNpbmdcbiAgICAgICAgICogZ2V0T3duUHJvcGVydHlOYW1lcygpLCBiZWNhdXNlIHRoZSBsYXR0ZXIgYWxzbyByZXR1cm5zIG5vbi1lbnVtZXJhYmxlcyAqL1xuICAgICAgICBmb3IgKHZhciBfaSA9IDAsIF9hID0gT2JqZWN0LmtleXModGhpcyk7IF9pIDwgX2EubGVuZ3RoOyBfaSsrKSB7XG4gICAgICAgICAgICB2YXIga2V5ID0gX2FbX2ldO1xuICAgICAgICAgICAgaWYgKCF0aGlzLmhhc093blByb3BlcnR5KGtleSkpXG4gICAgICAgICAgICAgICAgY29udGludWU7XG4gICAgICAgICAgICB2YXIgcHJvcGVydHkgPSB0aGlzW2tleV07XG4gICAgICAgICAgICAvKiBmbGF0dGVuIHByb3BlcnRpZXMsIGV4Y2VwdCBjb21wdXRlZCBhbmQgZGVlcCBpbmNsdWRlcyAqL1xuICAgICAgICAgICAgaWYgKGtvLmlzT2JzZXJ2YWJsZShwcm9wZXJ0eSkgJiZcbiAgICAgICAgICAgICAgICAha28uaXNDb21wdXRlZChwcm9wZXJ0eSkgJiZcbiAgICAgICAgICAgICAgICAhdGhpcy5pbmNsdWRlc1trZXldKSB7XG4gICAgICAgICAgICAgICAgdmFyIHByb3BlcnR5VmFsdWUgPSB2b2lkIDA7XG4gICAgICAgICAgICAgICAgaWYgKHR5cGVvZiBwcm9wZXJ0eSgpID09PSAnYm9vbGVhbicgfHwgdHlwZW9mIHByb3BlcnR5KCkgPT09ICdudW1iZXInKSB7XG4gICAgICAgICAgICAgICAgICAgIHByb3BlcnR5VmFsdWUgPSBwcm9wZXJ0eSgpOyAvKiAwIG9yIGZhbHNlIHNob3VsZCBqdXN0IGJlIGluc2VydGVkIGFzIGEgdmFsdWUgKi9cbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgIHByb3BlcnR5VmFsdWUgPSBwcm9wZXJ0eSgpIHx8ICcnOyAvKiBidXQgbm90IG51bGwsIHVuZGVmaW5lZCBvciB0aGUgbGlrZXMgKi9cbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgZG9jdW1lbnRba2V5XSA9IHByb3BlcnR5VmFsdWU7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIGRvY3VtZW50O1xuICAgIH07XG4gICAgTW9kZWxFeHRlbnNpb25zLnByb3RvdHlwZS5zYXZlID0gZnVuY3Rpb24gKCkge1xuICAgICAgICB2YXIgX3RoaXMgPSB0aGlzO1xuICAgICAgICBpZiAodGhpcy5zdGF0ZSgpID09IDApIHtcbiAgICAgICAgICAgIC8vbG9nZ2luZy5kZWJ1ZygnRmlyZXN0b3JlIGRvY3VtZW50ICcgKyB0aGlzLmZzRG9jdW1lbnRJZCArICcgdW5jaGFuZ2VkJyk7XG4gICAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cbiAgICAgICAgaWYgKHRoaXMuZnNCYXNlQ29sbGVjdGlvbiA9PT0gdW5kZWZpbmVkKSB7XG4gICAgICAgICAgICAvL2xvZ2dpbmcuZXJyb3IoJ0ZpcmVzdG9yZSBkb2N1bWVudCAnICsgdGhpcy5mc0RvY3VtZW50SWQgKyAnIG5vdCBwYXJ0IG9mIGEgQ29sbGVjdGlvbicpO1xuICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG4gICAgICAgIHZhciB0aGlzRG9jdW1lbnQgPSB0aGlzLmdldEZsYXREb2N1bWVudCgpO1xuICAgICAgICBpZiAodGhpcy5zdGF0ZSgpID09IDEpIHsgLyogTkVXICovXG4gICAgICAgICAgICB0aGlzLmZzQmFzZUNvbGxlY3Rpb24uYWRkKHRoaXNEb2N1bWVudCkudGhlbihmdW5jdGlvbiAoZG9jKSB7XG4gICAgICAgICAgICAgICAgLy9sb2dnaW5nLmRlYnVnKCdGaXJlc3RvcmUgZG9jdW1lbnQgJyArIGRvYy5pZCArICcgYWRkZWQgdG8gZGF0YWJhc2UnKTtcbiAgICAgICAgICAgICAgICBfdGhpcy5mc0RvY3VtZW50SWQgPSBkb2MuaWQ7XG4gICAgICAgICAgICAgICAgaWYgKF90aGlzLnN0YXRlKCkgPT0gMikgeyAvKiBkb2N1bWVudCB3YXMgbW9kaWZpZWQgd2hpbGUgc2F2aW5nICovXG4gICAgICAgICAgICAgICAgICAgIC8vbG9nZ2luZy5kZWJ1ZygnRmlyZXN0b3JlIGRvY3VtZW50ICcgKyBkb2MuaWQgKyAnIHdhcyBtb2RpZmllZCBkdXJpbmcgaW5zZXJ0LCBzYXZlIGNoYW5nZXMnKTtcbiAgICAgICAgICAgICAgICAgICAgX3RoaXMuc2F2ZSgpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgX3RoaXMuc3RhdGUoMCk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSlbXCJjYXRjaFwiXShmdW5jdGlvbiAoZXJyb3IpIHtcbiAgICAgICAgICAgICAgICAvL2xvZ2dpbmcuZXJyb3IoJ0Vycm9yIGFkZGluZyBGaXJlc3RvcmUgZG9jdW1lbnQgOicsIGVycm9yKTtcbiAgICAgICAgICAgIH0pO1xuICAgICAgICB9XG4gICAgICAgIGVsc2UgaWYgKHRoaXMuc3RhdGUoKSA9PSAyKSB7IC8qIE1PRElGSUVEICovXG4gICAgICAgICAgICB0aGlzLmZzQmFzZUNvbGxlY3Rpb24uZG9jKHRoaXMuZnNEb2N1bWVudElkKS51cGRhdGUodGhpc0RvY3VtZW50KS50aGVuKGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgICAgICAvL2xvZ2dpbmcuZGVidWcoJ0ZpcmVzdG9yZSBkb2N1bWVudCAnICsgdGhpcy5mc0RvY3VtZW50SWQgKyAnIHNhdmVkIHRvIGRhdGFiYXNlJyk7XG4gICAgICAgICAgICAgICAgX3RoaXMuc3RhdGUoMCk7XG4gICAgICAgICAgICB9KVtcImNhdGNoXCJdKGZ1bmN0aW9uIChlcnJvcikge1xuICAgICAgICAgICAgICAgIC8vbG9nZ2luZy5lcnJvcignRXJyb3Igc2F2aW5nIEZpcmVzdG9yZSBkb2N1bWVudCA6JywgZXJyb3IpO1xuICAgICAgICAgICAgfSk7XG4gICAgICAgIH1cbiAgICAgICAgZWxzZSBpZiAodGhpcy5zdGF0ZSgpID09IDMpIHsgLyogREVMRVRFRCAqL1xuICAgICAgICAgICAgdGhpcy5mc0Jhc2VDb2xsZWN0aW9uLmRvYyh0aGlzLmZzRG9jdW1lbnRJZClbXCJkZWxldGVcIl0oKS50aGVuKGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgICAgICAvL2xvZ2dpbmcuZGVidWcoJ0ZpcmVzdG9yZSBkb2N1bWVudCAnICsgdGhpcy5mc0RvY3VtZW50SWQgKyAnIGRlbGV0ZWQgZnJvbSBkYXRhYmFzZScpO1xuICAgICAgICAgICAgfSlbXCJjYXRjaFwiXShmdW5jdGlvbiAoZXJyb3IpIHtcbiAgICAgICAgICAgICAgICAvL2xvZ2dpbmcuZXJyb3IoJ0Vycm9yIHNhdmluZyBGaXJlc3RvcmUgZG9jdW1lbnQgOicsIGVycm9yKTtcbiAgICAgICAgICAgIH0pO1xuICAgICAgICB9XG4gICAgfTtcbiAgICBNb2RlbEV4dGVuc2lvbnMucHJvdG90eXBlLnNhdmVQcm9wZXJ0eSA9IGZ1bmN0aW9uIChwcm9wZXJ0eSwgdmFsdWUpIHtcbiAgICAgICAgdmFyIGRvYyA9IHt9O1xuICAgICAgICBkb2NbcHJvcGVydHldID0gdmFsdWU7XG4gICAgICAgIGlmICh0aGlzLmZzQmFzZUNvbGxlY3Rpb24gPT09IHVuZGVmaW5lZCkge1xuICAgICAgICAgICAgLy9sb2dnaW5nLmVycm9yKCdGaXJlc3RvcmUgZG9jdW1lbnQgJyArIHRoaXMuZnNEb2N1bWVudElkICsgJyBub3QgcGFydCBvZiBhIENvbGxlY3Rpb24nKTtcbiAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuICAgICAgICAvKiBpdCBjYW4gaGFwcGVuIHRoYXQgYSBwcm9wZXJ0eSBjaGFuZ2UgdHJpZ2dlcnMgc2F2ZVByb3BlcnR5LFxuICAgICAgICAgKiB3aGlsZSB0aGUgZG9jdW1lbnQgaXMgbm90IHlldCBwcm9wZXJseSBzYXZlZCBpbiBGaXJlc3RvcmUgYW5kXG4gICAgICAgICAqIGhhcyBubyBmc0RvY3VtZW50SWQgeWV0LiBJbiB0aGF0IGNhc2UgZG9uJ3Qgc2F2ZSB0byBGaXJlc3RvcmUsXG4gICAgICAgICAqIGJ1dCByZWNvcmQgdGhlIGNoYW5nZSBhbmQgbWFyayB0aGlzIGRvY3VtZW50IE1PRElGSUVEICovXG4gICAgICAgIGlmICh0eXBlb2YgdGhpcy5mc0RvY3VtZW50SWQgPT09ICd1bmRlZmluZWQnKSB7XG4gICAgICAgICAgICB0aGlzLnN0YXRlKDIpOyAvLyBNT0RJRklFRFxuICAgICAgICB9XG4gICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgdGhpcy5mc0Jhc2VDb2xsZWN0aW9uLmRvYyh0aGlzLmZzRG9jdW1lbnRJZCkudXBkYXRlKGRvYykudGhlbihmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICAgICAgLy9sb2dnaW5nLmRlYnVnKCdGaXJlc3RvcmUgZG9jdW1lbnQgJyArIHRoaXMuZnNEb2N1bWVudElkICsgJyBzYXZlZCB0byBkYXRhYmFzZScpO1xuICAgICAgICAgICAgfSlbXCJjYXRjaFwiXShmdW5jdGlvbiAoZXJyb3IpIHtcbiAgICAgICAgICAgICAgICAvL2xvZ2dpbmcuZXJyb3IoJ0Vycm9yIHNhdmluZyBGaXJlc3RvcmUgZG9jdW1lbnQgOicsIGVycm9yKTtcbiAgICAgICAgICAgIH0pO1xuICAgICAgICB9XG4gICAgfTtcbiAgICByZXR1cm4gTW9kZWxFeHRlbnNpb25zO1xufSgpKTtcbmV4cG9ydHMuTW9kZWxFeHRlbnNpb25zID0gTW9kZWxFeHRlbnNpb25zO1xuLyoqXG4gKiBDcmVhdGVzIGEgYmluZGFibGUgZnJvbSB0aGUgZ2l2ZW4gb2JqZWN0IGFuZCBvcHRpb25hbGx5IHRoZSBkZWVwIGluY2x1ZGVzXG4gKiAobmF2aWdhdGlvbiBwcm9wZXJ0aWVzKVxuICogQHBhcmFtIG1vZGVsIHRoZSBvYmplY3QgdG8gYmUgbWFkZSBiaW5kYWJsZVxuICogQHBhcmFtIGluY2x1ZGVzIChvcHRpb25hbCkgdGhlIGRlZXAgaW5jbHVkZXMgZm9yIGVhZ2VyIGxvYWRpbmdcbiAqL1xuZnVuY3Rpb24gY3JlYXRlQmluZGFibGUobW9kZWwsIGluY2x1ZGVzKSB7XG4gICAgdmFyIGV4dGVuc2lvbiA9IG5ldyBNb2RlbEV4dGVuc2lvbnMoKTtcbiAgICB2YXIgYmluZGFibGVNb2RlbCA9IGhlbHBlcnNfMS5tZXJnZU9iamVjdHMobW9kZWwsIGV4dGVuc2lvbik7XG4gICAgYmluZGFibGVNb2RlbC5pbmNsdWRlcyA9IE9iamVjdC5hc3NpZ24oaW5jbHVkZXMgfHwge30sIGJpbmRhYmxlTW9kZWwuaW5jbHVkZXMpO1xuICAgIHZhciBfbG9vcF8xID0gZnVuY3Rpb24gKGtleSkge1xuICAgICAgICBpZiAoIWJpbmRhYmxlTW9kZWwuaGFzT3duUHJvcGVydHkoa2V5KSlcbiAgICAgICAgICAgIHJldHVybiBcImNvbnRpbnVlXCI7XG4gICAgICAgIHZhciBwcm9wZXJ0eSA9IGJpbmRhYmxlTW9kZWxba2V5XTtcbiAgICAgICAgLyogQmluZCBsaXN0ZW5lcnMgdG8gdGhlIHByb3BlcnRpZXMgKi9cbiAgICAgICAgaWYgKGtvLmlzT2JzZXJ2YWJsZShwcm9wZXJ0eSkgJiZcbiAgICAgICAgICAgICgha28uaXNPYnNlcnZhYmxlQXJyYXkocHJvcGVydHkpIHx8ICFiaW5kYWJsZU1vZGVsLmluY2x1ZGVzW2tleV0pICYmXG4gICAgICAgICAgICAha28uaXNDb21wdXRlZChwcm9wZXJ0eSkpIHtcbiAgICAgICAgICAgIChmdW5jdGlvbiAoZWxlbWVudE5hbWUpIHtcbiAgICAgICAgICAgICAgICBwcm9wZXJ0eS5zdWJzY3JpYmUoZnVuY3Rpb24gKHZhbHVlKSB7XG4gICAgICAgICAgICAgICAgICAgIC8vbG9nZ2luZy5kZWJ1ZygnS25vY2tvdXQgb2JzZXJ2YWJsZSBwcm9wZXJ0eSBcIicgKyBlbGVtZW50TmFtZSArICdcIiBjaGFuZ2VkLiBMb2NhbE9ubHk6ICcgKyBiaW5kYWJsZU1vZGVsLmxvY2spO1xuICAgICAgICAgICAgICAgICAgICAvKiBpZ25vcmUgdXBkYXRlcyB0cmlnZ2VyZWQgYnkgaW5jb21pbmcgY2hhbmdlcyBmcm9tIEZpcmViYXNlICovXG4gICAgICAgICAgICAgICAgICAgIGlmICghYmluZGFibGVNb2RlbC5sb2NrKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAoYmluZGFibGVNb2RlbC50d29XYXlCaW5kaW5nKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgYmluZGFibGVNb2RlbC5zYXZlUHJvcGVydHkoZWxlbWVudE5hbWUsIHZhbHVlKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgIGVsc2UgaWYgKGJpbmRhYmxlTW9kZWwuc3RhdGUoKSAhPSAxKSB7IC8qIGlmIHN0YXRlIGlzIE5FVyBrZWVwIGl0IGluIHRoaXMgc3RhdGUgdW50aWxsIGl0IGlzIHNhdmVkLCBldmVuIGlmIGl0J3MgbW9kaWZpZWQgaW4gdGhlIG1lYW4gdGltZSAqL1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGJpbmRhYmxlTW9kZWwuc3RhdGUoMik7IC8qIE1PRElGSUVEICovXG4gICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIH0pKGtleSk7XG4gICAgICAgIH1cbiAgICB9O1xuICAgIC8qIHN1YnNjcmliZSB0byB0aGUgS25vY2tvdXQgY2hhbmdlc1xuICAgICAqIGVudW1lcmF0ZSB1c2luZyBrZXlzKCkgYW5kIGZpbHRlciBvdXQgcHJvdG95cGUgZnVuY3Rpb25zIHdpdGggaGFzT3duUHJvcGVydHkoKSBpbiBzdGVhZCBvZiB1c2luZ1xuICAgICAqIGdldE93blByb3BlcnR5TmFtZXMoKSwgYmVjYXVzZSB0aGUgbGF0dGVyIGFsc28gcmV0dXJucyBub24tZW51bWVyYWJsZXMgKi9cbiAgICBmb3IgKHZhciBfaSA9IDAsIF9hID0gT2JqZWN0LmtleXMoYmluZGFibGVNb2RlbCk7IF9pIDwgX2EubGVuZ3RoOyBfaSsrKSB7XG4gICAgICAgIHZhciBrZXkgPSBfYVtfaV07XG4gICAgICAgIF9sb29wXzEoa2V5KTtcbiAgICB9XG4gICAgcmV0dXJuIGJpbmRhYmxlTW9kZWw7XG59XG5leHBvcnRzLmNyZWF0ZUJpbmRhYmxlID0gY3JlYXRlQmluZGFibGU7XG4vLyMgc291cmNlTWFwcGluZ1VSTD1CaW5kYWJsZS5qcy5tYXAiLCJcInVzZSBzdHJpY3RcIjtcbmV4cG9ydHMuX19lc01vZHVsZSA9IHRydWU7XG52YXIgQXJyYXlFeHRlbnNpb25zID0gLyoqIEBjbGFzcyAqLyAoZnVuY3Rpb24gKCkge1xuICAgIGZ1bmN0aW9uIEFycmF5RXh0ZW5zaW9ucygpIHtcbiAgICAgICAgdGhpcy5sb2NhbE9ubHkgPSBmYWxzZTtcbiAgICAgICAgdGhpcy50d29XYXlCaW5kaW5nID0gZmFsc2U7XG4gICAgfVxuICAgIEFycmF5RXh0ZW5zaW9ucy5wcm90b3R5cGUuZ2V0RG9jdW1lbnQgPSBmdW5jdGlvbiAoaWQpIHtcbiAgICAgICAgLyogYXNzdW1lICd0aGlzJyBpcyBtZXJnZWQgd2l0aCBhbiBPYnNlcnZhYmxlQXJyYXkgKi9cbiAgICAgICAgdmFyIGNvbnRlbnRzID0gdGhpcygpO1xuICAgICAgICBmb3IgKHZhciBfaSA9IDAsIGNvbnRlbnRzXzEgPSBjb250ZW50czsgX2kgPCBjb250ZW50c18xLmxlbmd0aDsgX2krKykge1xuICAgICAgICAgICAgdmFyIGRvYyA9IGNvbnRlbnRzXzFbX2ldO1xuICAgICAgICAgICAgLyogYXNzdW1lIGFsbCBkb2N1bWVudHMgYXJlIGNvbnZlcnRlZCB0byBCaW5kYWJsZSAqL1xuICAgICAgICAgICAgdmFyIGJpbmRhYmxlRG9jID0gZG9jO1xuICAgICAgICAgICAgaWYgKGJpbmRhYmxlRG9jLmZzRG9jdW1lbnRJZCA9PT0gaWQpXG4gICAgICAgICAgICAgICAgcmV0dXJuIGJpbmRhYmxlRG9jO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiBudWxsO1xuICAgIH07XG4gICAgQXJyYXlFeHRlbnNpb25zLnByb3RvdHlwZS5kZXRhY2ggPSBmdW5jdGlvbiAoaXRlbSkge1xuICAgICAgICAvKiBhc3N1bWUgJ3RoaXMnIGlzIG1lcmdlZCB3aXRoIGFuIE9ic2VydmFibGVBcnJheSAqL1xuICAgICAgICB2YXIgb2JzZXJ2YWJsZUFycmF5ID0gdGhpcztcbiAgICAgICAgLyogaWYgdGhpcyBjb2xsZWN0aW9uIGlzIFR3by1XYXkgYm91bmQsIGp1c3QgZGVsZXRlICovXG4gICAgICAgIGlmIChvYnNlcnZhYmxlQXJyYXkudHdvV2F5QmluZGluZykge1xuICAgICAgICAgICAgb2JzZXJ2YWJsZUFycmF5LnJlbW92ZShpdGVtKTtcbiAgICAgICAgfVxuICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgIC8qIGFzc3VtZSBhbGwgaXRlbXMgYXJlIGNvbnZlcnRlZCB0byBCaW5kYWJsZSAqL1xuICAgICAgICAgICAgaXRlbS5zdGF0ZSgzKTsgLyogREVMRVRFRCAqL1xuICAgICAgICAgICAgLyogdXNlIEtub2Nrb3V0J3MgaW50ZXJuYWwgX2Rlc3Ryb3kgcHJvcGVydHkgdG8gZmlsdGVyIHRoaXMgaXRlbSBvdXQgb2YgdGhlIFVJICovXG4gICAgICAgICAgICBvYnNlcnZhYmxlQXJyYXkuZGVzdHJveShpdGVtKTtcbiAgICAgICAgICAgIC8vbG9nZ2luZy5kZWJ1ZygnRG9jdW1lbnQgXCInICsgaXRlbS5mc0RvY3VtZW50SWQgKyAnXCIgZGV0YWNoZWQgZnJvbSBsb2NhbCBjb2xsZWN0aW9uLicpO1xuICAgICAgICB9XG4gICAgfTtcbiAgICBBcnJheUV4dGVuc2lvbnMucHJvdG90eXBlLnNhdmVBbGwgPSBmdW5jdGlvbiAoKSB7XG4gICAgICAgIC8qIGFzc3VtZSAndGhpcycgaXMgbWVyZ2VkIHdpdGggYW4gT2JzZXJ2YWJsZUFycmF5ICovXG4gICAgICAgIHZhciBjb250ZW50cyA9IHRoaXMoKTtcbiAgICAgICAgZm9yICh2YXIgX2kgPSAwLCBjb250ZW50c18yID0gY29udGVudHM7IF9pIDwgY29udGVudHNfMi5sZW5ndGg7IF9pKyspIHtcbiAgICAgICAgICAgIHZhciBpdGVtID0gY29udGVudHNfMltfaV07XG4gICAgICAgICAgICAvKiBhc3N1bWUgYWxsIGl0ZW1zIGFyZSBjb252ZXJ0ZWQgdG8gQmluZGFibGUgKi9cbiAgICAgICAgICAgIHZhciBiaW5kYWJsZUl0ZW0gPSBpdGVtO1xuICAgICAgICAgICAgaWYgKGJpbmRhYmxlSXRlbS5zdGF0ZSgpICE9PSAwKSB7XG4gICAgICAgICAgICAgICAgYmluZGFibGVJdGVtLnNhdmUoKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH07XG4gICAgcmV0dXJuIEFycmF5RXh0ZW5zaW9ucztcbn0oKSk7XG5leHBvcnRzLkFycmF5RXh0ZW5zaW9ucyA9IEFycmF5RXh0ZW5zaW9ucztcbmZ1bmN0aW9uIGNyZWF0ZUJpbmRhYmxlQXJyYXkoa29PYnNlcnZhYmxlQXJyYXkpIHtcbiAgICAvL2tvT2JzZXJ2YWJsZUFycmF5LnN1YnNjcmliZShjb2xsZWN0aW9uQ2hhbmdlZCwga29PYnNlcnZhYmxlQXJyYXksICdhcnJheUNoYW5nZScpO1xuICAgIHJldHVybiBrb09ic2VydmFibGVBcnJheTtcbn1cbmV4cG9ydHMuY3JlYXRlQmluZGFibGVBcnJheSA9IGNyZWF0ZUJpbmRhYmxlQXJyYXk7XG4vLyMgc291cmNlTWFwcGluZ1VSTD1CaW5kYWJsZUFycmF5LmpzLm1hcCIsIlwidXNlIHN0cmljdFwiO1xuZXhwb3J0cy5fX2VzTW9kdWxlID0gdHJ1ZTtcbmZ1bmN0aW9uIG1lcmdlT2JqZWN0cyh0YXJnZXQsIHNvdXJjZSkge1xuICAgIHZhciBuZXdUYXJnZXQgPSB0YXJnZXQ7XG4gICAgLyogaW5zZXJ0IHRoZSBwcm90b3R5cGUgb2Ygc291cmNlIGludG8gdGFyZ2V0IHByb3RvdHlwZSBjaGFpbiAoanVzdCBvbmUgbGV2ZWwgZGVlcCkgKi9cbiAgICB2YXIgcFNvdXJjZSA9IE9iamVjdC5nZXRQcm90b3R5cGVPZihzb3VyY2UpO1xuICAgIHZhciBwVGFyZ2V0ID0gT2JqZWN0LmdldFByb3RvdHlwZU9mKHRhcmdldCk7XG4gICAgT2JqZWN0LnNldFByb3RvdHlwZU9mKHBTb3VyY2UsIHBUYXJnZXQpO1xuICAgIE9iamVjdC5zZXRQcm90b3R5cGVPZih0YXJnZXQsIHBTb3VyY2UpO1xuICAgIC8qIGNvcHkgdGhlIHByb3BlcnRpZXMgKG5vdCBvbiB0aGUgcHJvdG90eXBlIGNoYWluLCBidXQgaW5jbHVkaW5nIHRoZSBub24tZW51bWVyYWJsZSkgdG8gdGhlIHRhcmdldCAqL1xuICAgIGZvciAodmFyIF9pID0gMCwgX2EgPSBPYmplY3QuZ2V0T3duUHJvcGVydHlOYW1lcyhzb3VyY2UpOyBfaSA8IF9hLmxlbmd0aDsgX2krKykge1xuICAgICAgICB2YXIga2V5ID0gX2FbX2ldO1xuICAgICAgICB2YXIgZGVzY3JpcHRvciA9IE9iamVjdC5nZXRPd25Qcm9wZXJ0eURlc2NyaXB0b3Ioc291cmNlLCBrZXkpO1xuICAgICAgICBpZiAoZGVzY3JpcHRvciAmJiAoIWRlc2NyaXB0b3Iud3JpdGFibGUgfHwgIWRlc2NyaXB0b3IuY29uZmlndXJhYmxlIHx8ICFkZXNjcmlwdG9yLmVudW1lcmFibGUgfHwgZGVzY3JpcHRvci5nZXQgfHwgZGVzY3JpcHRvci5zZXQpKSB7XG4gICAgICAgICAgICBPYmplY3QuZGVmaW5lUHJvcGVydHkodGFyZ2V0LCBrZXksIGRlc2NyaXB0b3IpO1xuICAgICAgICB9XG4gICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgdGFyZ2V0W2tleV0gPSBzb3VyY2Vba2V5XTtcbiAgICAgICAgfVxuICAgIH1cbiAgICByZXR1cm4gbmV3VGFyZ2V0O1xufVxuZXhwb3J0cy5tZXJnZU9iamVjdHMgPSBtZXJnZU9iamVjdHM7XG4vLyMgc291cmNlTWFwcGluZ1VSTD1oZWxwZXJzLmpzLm1hcCIsIlwidXNlIHN0cmljdFwiO1xuZXhwb3J0cy5fX2VzTW9kdWxlID0gdHJ1ZTtcbnZhciBCaW5kYWJsZUFycmF5XzEgPSByZXF1aXJlKFwiLi9CaW5kYWJsZUFycmF5XCIpO1xudmFyIEJpbmRhYmxlXzEgPSByZXF1aXJlKFwiLi9CaW5kYWJsZVwiKTtcbnZhciBrb2ZzO1xuKGZ1bmN0aW9uIChrb2ZzKSB7XG4gICAgZnVuY3Rpb24gZ2V0Qm91bmRDb2xsZWN0aW9uKGZzQ29sbGVjdGlvbiwgbW9kZWwsIG9wdGlvbnMpIHtcbiAgICAgICAgLyogY3JlYXRlIHRoZSBjb2xsZWN0aW9uIGFzIGEga28ub2JzZXJ2YWJsZUFycmF5IGFuZCBiaW5kIGl0ICovXG4gICAgICAgIHZhciBvYnNlcnZhYmxlQXJyYXkgPSBrby5vYnNlcnZhYmxlQXJyYXkoKTtcbiAgICAgICAgYmluZENvbGxlY3Rpb24ob2JzZXJ2YWJsZUFycmF5LCBmc0NvbGxlY3Rpb24sIG1vZGVsLCBvcHRpb25zKTtcbiAgICAgICAgcmV0dXJuIG9ic2VydmFibGVBcnJheTtcbiAgICB9XG4gICAga29mcy5nZXRCb3VuZENvbGxlY3Rpb24gPSBnZXRCb3VuZENvbGxlY3Rpb247XG4gICAgZnVuY3Rpb24gYmluZENvbGxlY3Rpb24ob2JzZXJ2YWJsZUFycmF5LCBmc0NvbGxlY3Rpb24sIG1vZGVsLCBvcHRpb25zKSB7XG4gICAgICAgIC8qIHNldHRpbmdzICovXG4gICAgICAgIG9wdGlvbnMgPSBvcHRpb25zIHx8IHt9O1xuICAgICAgICB2YXIgd2hlcmUgPSBvcHRpb25zLndoZXJlIHx8IFtdO1xuICAgICAgICB2YXIgb3JkZXJCeSA9IG9wdGlvbnMub3JkZXJCeSB8fCBbXTtcbiAgICAgICAgdmFyIGluY2x1ZGVzID0gb3B0aW9ucy5pbmNsdWRlcyB8fCB7fTtcbiAgICAgICAgdmFyIHR3b1dheUJpbmRpbmcgPSB0eXBlb2Ygb3B0aW9ucy50d29XYXlCaW5kaW5nID09PSAndW5kZWZpbmVkJyA/IHRydWUgOiBvcHRpb25zLnR3b1dheUJpbmRpbmc7XG4gICAgICAgIC8qIHNldCBsb2cgbGV2ZWwgKi9cbiAgICAgICAgLy9pZiAob3B0aW9ucy5sb2dMZXZlbCkgeyBsb2dnaW5nLnNldExvZ0xldmVsKG9wdGlvbnMubG9nTGV2ZWwpOyB9XG4gICAgICAgIC8qIGNyZWF0ZSB0aGUgRmlyZXN0b3JlIHF1ZXJ5IGZyb20gdGhlIGNvbGxlY3Rpb24gYW5kIHRoZSBvcHRpb25zICovXG4gICAgICAgIHZhciBxdWVyeSA9IGNyZWF0ZUZpcmVzdG9yZVF1ZXJ5KGZzQ29sbGVjdGlvbiwgd2hlcmUsIG9yZGVyQnkpO1xuICAgICAgICAvKiBleHRlbmQgdGhlIG9ic2VydmFibGVBcnJheSB3aXRoIG91ciBmdW5jdGlvbnMgKi9cbiAgICAgICAgdmFyIGJpbmRhYmxlQXJyYXkgPSBCaW5kYWJsZUFycmF5XzEuY3JlYXRlQmluZGFibGVBcnJheShvYnNlcnZhYmxlQXJyYXkpO1xuICAgICAgICBiaW5kYWJsZUFycmF5LnR3b1dheUJpbmRpbmcgPSB0d29XYXlCaW5kaW5nO1xuICAgICAgICBiaW5kYWJsZUFycmF5LmZzUXVlcnkgPSBxdWVyeTtcbiAgICAgICAgYmluZGFibGVBcnJheS5mc0NvbGxlY3Rpb24gPSBmc0NvbGxlY3Rpb247XG4gICAgICAgIGJpbmRhYmxlQXJyYXkuaW5jbHVkZXMgPSBpbmNsdWRlcztcbiAgICAgICAgLyogc3Vic2NyaWJlIHRvIHRoZSBGaXJlc3RvcmUgY29sbGVjdGlvbiAqL1xuICAgICAgICBxdWVyeS5vblNuYXBzaG90KGZ1bmN0aW9uIChzbmFwc2hvdCkge1xuICAgICAgICAgICAgc25hcHNob3QuZG9jQ2hhbmdlcygpLmZvckVhY2goZnVuY3Rpb24gKGNoYW5nZSkge1xuICAgICAgICAgICAgICAgIC8qIGlnbm9yZSBsb2NhbCBjaGFuZ2VzICovXG4gICAgICAgICAgICAgICAgaWYgKCFjaGFuZ2UuZG9jLm1ldGFkYXRhLmhhc1BlbmRpbmdXcml0ZXMpIHtcbiAgICAgICAgICAgICAgICAgICAgaWYgKGNoYW5nZS50eXBlID09PSAnYWRkZWQnKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAvL2xvZ2dpbmcuZGVidWcoJ0ZpcmVzdG9yZSBvYmplY3QgJyArIGNoYW5nZS5kb2MuaWQgKyAnIGFkZGVkIHRvIGNvbGxlY3Rpb24nKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIHZhciBpdGVtID0gbmV3IG1vZGVsKCk7XG4gICAgICAgICAgICAgICAgICAgICAgICB2YXIgaW5kZXggPSBjaGFuZ2UubmV3SW5kZXg7XG4gICAgICAgICAgICAgICAgICAgICAgICAvKiBleHRlbmQgdGhlIE1vZGVsIHdpdGggdGhlIEJpbmRhYmxlIGZ1bmN0aW9uYWxpdHkgKi9cbiAgICAgICAgICAgICAgICAgICAgICAgIHZhciBjb21iaW5lZEluY2x1ZGVzID0gT2JqZWN0LmFzc2lnbihpbmNsdWRlcywgaXRlbS5pbmNsdWRlcyk7XG4gICAgICAgICAgICAgICAgICAgICAgICB2YXIgYmluZGFibGVJdGVtID0gQmluZGFibGVfMS5jcmVhdGVCaW5kYWJsZShpdGVtLCBjb21iaW5lZEluY2x1ZGVzKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIC8qIGZpbGwgdGhlIG5ldyBvYmplY3Qgd2l0aCBtZXRhLWRhdGFcbiAgICAgICAgICAgICAgICAgICAgICAgICAqIGV4dGVuZCAvIG92ZXJydWxlIHRoZSBpbmNsdWRlcyB3aXRoIGluY2x1ZGVzIGZyb20gdGhlIHBhc3NlZCBvcHRpb25zICovXG4gICAgICAgICAgICAgICAgICAgICAgICBiaW5kYWJsZUl0ZW0uZnNCYXNlQ29sbGVjdGlvbiA9IGNoYW5nZS5kb2MucmVmLnBhcmVudDtcbiAgICAgICAgICAgICAgICAgICAgICAgIGJpbmRhYmxlSXRlbS5mc0RvY3VtZW50SWQgPSBjaGFuZ2UuZG9jLmlkO1xuICAgICAgICAgICAgICAgICAgICAgICAgYmluZGFibGVJdGVtLnR3b1dheUJpbmRpbmcgPSB0d29XYXlCaW5kaW5nO1xuICAgICAgICAgICAgICAgICAgICAgICAgLyogZXhwbG9kZSB0aGUgZGF0YSBBTkQgZGVlcCBpbmNsdWRlIGlmIHR3by13YXkgKi9cbiAgICAgICAgICAgICAgICAgICAgICAgIGV4cGxvZGVPYmplY3QoY2hhbmdlLmRvYywgYmluZGFibGVJdGVtLCB0d29XYXlCaW5kaW5nKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIC8qIHNldCB0aGUgY29sbGVjdGlvbiB0byBsb2NhbE9ubHkgdG8gaWdub3JlIHRoZXNlIGluY29taW5nIGNoYW5nZXMgZnJvbSBGaXJlYmFzZSAqL1xuICAgICAgICAgICAgICAgICAgICAgICAgYmluZGFibGVBcnJheS5sb2NhbE9ubHkgPSB0cnVlO1xuICAgICAgICAgICAgICAgICAgICAgICAgYmluZGFibGVBcnJheS5zcGxpY2UoaW5kZXgsIDAsIGJpbmRhYmxlSXRlbSk7XG4gICAgICAgICAgICAgICAgICAgICAgICBiaW5kYWJsZUFycmF5LmxvY2FsT25seSA9IGZhbHNlO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIGlmIChjaGFuZ2UudHlwZSA9PT0gXCJtb2RpZmllZFwiKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAvL2xvZ2dpbmcuZGVidWcoJ0ZpcmVzdG9yZSBvYmplY3QgJyArIGNoYW5nZS5kb2MuaWQgKyAnIG1vZGlmaWVkJyk7XG4gICAgICAgICAgICAgICAgICAgICAgICB2YXIgbG9jYWxEb2MgPSBiaW5kYWJsZUFycmF5LmdldERvY3VtZW50KGNoYW5nZS5kb2MuaWQpO1xuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKGxvY2FsRG9jICE9IG51bGwpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAvKiBleHBsb2RlIHRoZSBkYXRhLCBidXQgZG9uJ3QgbWVzcyB3aXRoIHRoZSBkZWVwIGluY2x1ZGVzICovXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgZXhwbG9kZU9iamVjdChjaGFuZ2UuZG9jLCBsb2NhbERvYywgZmFsc2UpO1xuICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgLy9sb2dnaW5nLmRlYnVnKCdGaXJlc3RvcmUgb2JqZWN0ICcgKyBjaGFuZ2UuZG9jLmlkICsgJyBub3QgZm91bmQgaW4gbG9jYWwgY29sbGVjdGlvbicpO1xuICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIGlmIChjaGFuZ2UudHlwZSA9PT0gXCJyZW1vdmVkXCIpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIC8vbG9nZ2luZy5kZWJ1ZygnRmlyZXN0b3JlIG9iamVjdCAnICsgY2hhbmdlLmRvYy5pZCArICcgcmVtb3ZlZCBmcm9tIGNvbGxlY3Rpb24nKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIHZhciBsb2NhbERvYyA9IGJpbmRhYmxlQXJyYXkuZ2V0RG9jdW1lbnQoY2hhbmdlLmRvYy5pZCk7XG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAobG9jYWxEb2MgIT0gbnVsbCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGJpbmRhYmxlQXJyYXkubG9jYWxPbmx5ID0gdHJ1ZTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBiaW5kYWJsZUFycmF5LnJlbW92ZShsb2NhbERvYyk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgYmluZGFibGVBcnJheS5sb2NhbE9ubHkgPSBmYWxzZTtcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIC8qIHdoZW4gcmVtb3ZpbmcgZnJvbSBGaXJlc3RvcmUsIHRoZSBzbmFwc2hvdCBpcyB0cmlnZ2VyZWQsIHNvIGl0IHdpbGwgdHJ5IHRvIHJlbW92ZSBpdCBhZ2FpbiB3aGVuIGl0J3Mgbm8gbG9uZ2VyIHRoZXJlICovXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgLy9sb2dnaW5nLmRlYnVnKCdGaXJlc3RvcmUgb2JqZWN0ICcgKyBjaGFuZ2UuZG9jLmlkICsgJyBub3QgKGxvbmdlcikgZm91bmQgaW4gbG9jYWwgY29sbGVjdGlvbicpO1xuICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSk7XG4gICAgICAgIH0pO1xuICAgIH1cbiAgICBrb2ZzLmJpbmRDb2xsZWN0aW9uID0gYmluZENvbGxlY3Rpb247XG4gICAgZnVuY3Rpb24gY3JlYXRlRmlyZXN0b3JlUXVlcnkoY29sbGVjdGlvbiwgd2hlcmUsIG9yZGVyQnkpIHtcbiAgICAgICAgLyogY29udmVydCBvdXIgd2hlcmUgYW5kIG9yZGVyYnkgYXJyYXlzIHRvIHJlYWwgRmlyZXN0b3JlIHF1ZXJpZXMgKi9cbiAgICAgICAgdmFyIHF1ZXJ5ID0gY29sbGVjdGlvbjtcbiAgICAgICAgaWYgKHdoZXJlICE9IG51bGwgJiYgQXJyYXkuaXNBcnJheSh3aGVyZSkgJiYgd2hlcmUubGVuZ3RoID4gMCkge1xuICAgICAgICAgICAgaWYgKEFycmF5LmlzQXJyYXkod2hlcmVbMF0pKSB7XG4gICAgICAgICAgICAgICAgZm9yICh2YXIgX2kgPSAwLCB3aGVyZV8xID0gd2hlcmU7IF9pIDwgd2hlcmVfMS5sZW5ndGg7IF9pKyspIHtcbiAgICAgICAgICAgICAgICAgICAgdmFyIHdoZXJlQ2xhdXNlID0gd2hlcmVfMVtfaV07XG4gICAgICAgICAgICAgICAgICAgIHF1ZXJ5ID0gcXVlcnkud2hlcmUod2hlcmVDbGF1c2VbMF0sIHdoZXJlQ2xhdXNlWzFdLCB3aGVyZUNsYXVzZVsyXSk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICAgICAgcXVlcnkgPSBxdWVyeS53aGVyZSh3aGVyZVswXSwgd2hlcmVbMV0sIHdoZXJlWzJdKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICBpZiAob3JkZXJCeSAhPSBudWxsICYmIEFycmF5LmlzQXJyYXkob3JkZXJCeSkgJiYgb3JkZXJCeS5sZW5ndGggPiAwKSB7XG4gICAgICAgICAgICBpZiAoQXJyYXkuaXNBcnJheShvcmRlckJ5WzBdKSkge1xuICAgICAgICAgICAgICAgIGZvciAodmFyIF9hID0gMCwgb3JkZXJCeV8xID0gb3JkZXJCeTsgX2EgPCBvcmRlckJ5XzEubGVuZ3RoOyBfYSsrKSB7XG4gICAgICAgICAgICAgICAgICAgIHZhciBvcmRlckJ5Q2xhdXNlID0gb3JkZXJCeV8xW19hXTtcbiAgICAgICAgICAgICAgICAgICAgcXVlcnkgPSBxdWVyeS5vcmRlckJ5KG9yZGVyQnlDbGF1c2VbMF0sIG9yZGVyQnlDbGF1c2VbMV0pO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgICAgIHF1ZXJ5ID0gcXVlcnkub3JkZXJCeShvcmRlckJ5WzBdLCBvcmRlckJ5WzFdKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gcXVlcnk7XG4gICAgfVxuICAgIGZ1bmN0aW9uIGV4cGxvZGVPYmplY3QoZmlyZXN0b3JlRG9jdW1lbnQsIGxvY2FsT2JqZWN0LCBkZWVwSW5jbHVkZSkge1xuICAgICAgICAvKiBkdXJpbmcgdXBkYXRlIHNldCBsb2NrIG9uIHRoZSBmaWxlLCBzbyB0aGVyZSB3aWxsIGJlIG5vIHVwZGF0ZSBsb29wICovXG4gICAgICAgIGxvY2FsT2JqZWN0LmxvY2sgPSB0cnVlO1xuICAgICAgICAvKiBlbnVtZXJhdGUgdXNpbmcga2V5cygpIGFuZCBmaWx0ZXIgb3V0IHByb3RveXBlIGZ1bmN0aW9ucyB3aXRoIGhhc093blByb3BlcnR5KCkgaW4gc3RlYWQgb2YgdXNpbmdcbiAgICAgICAgICogZ2V0T3duUHJvcGVydHlOYW1lcygpLCBiZWNhdXNlIHRoZSBsYXR0ZXIgYWxzbyByZXR1cm5zIG5vbi1lbnVtZXJhYmxlcyAqL1xuICAgICAgICBmb3IgKHZhciBfaSA9IDAsIF9hID0gT2JqZWN0LmtleXMobG9jYWxPYmplY3QpOyBfaSA8IF9hLmxlbmd0aDsgX2krKykge1xuICAgICAgICAgICAgdmFyIGtleSA9IF9hW19pXTtcbiAgICAgICAgICAgIGlmICghbG9jYWxPYmplY3QuaGFzT3duUHJvcGVydHkoa2V5KSlcbiAgICAgICAgICAgICAgICBjb250aW51ZTtcbiAgICAgICAgICAgIHZhciBwcm9wZXJ0eURhdGEgPSB2b2lkIDA7XG4gICAgICAgICAgICB2YXIgcHJvcGVydHkgPSBsb2NhbE9iamVjdFtrZXldO1xuICAgICAgICAgICAgLyogZ2V0IGRhdGEgZnJvbSBGaXJlc3RvcmUgZm9yIHByaW1pdGl2ZSBwcm9wZXJ0aWVzICovXG4gICAgICAgICAgICBpZiAoa28uaXNPYnNlcnZhYmxlKHByb3BlcnR5KSAmJlxuICAgICAgICAgICAgICAgICFrby5pc09ic2VydmFibGVBcnJheShwcm9wZXJ0eSkgJiZcbiAgICAgICAgICAgICAgICAha28uaXNDb21wdXRlZChwcm9wZXJ0eSkpIHtcbiAgICAgICAgICAgICAgICBwcm9wZXJ0eURhdGEgPSBmaXJlc3RvcmVEb2N1bWVudC5nZXQoa2V5KTtcbiAgICAgICAgICAgICAgICBzd2l0Y2ggKHR5cGVvZiBwcm9wZXJ0eURhdGEpIHtcbiAgICAgICAgICAgICAgICAgICAgY2FzZSAndW5kZWZpbmVkJzpcbiAgICAgICAgICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgICAgICAgICBjYXNlICdzdHJpbmcnOlxuICAgICAgICAgICAgICAgICAgICBjYXNlICdudW1iZXInOlxuICAgICAgICAgICAgICAgICAgICBjYXNlICdib29sZWFuJzpcbiAgICAgICAgICAgICAgICAgICAgICAgIHByb3BlcnR5KHByb3BlcnR5RGF0YSk7XG4gICAgICAgICAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgICAgICAgICAgY2FzZSAnb2JqZWN0JzpcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmIChwcm9wZXJ0eURhdGEgJiYgdHlwZW9mIHByb3BlcnR5RGF0YS50b0RhdGUgPT09ICdmdW5jdGlvbicpIHsgLyogYXNzdW1lIEZpcmVzdG9yZS5UaW1lc3RhbXAgKi9cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBwcm9wZXJ0eShwcm9wZXJ0eURhdGEudG9EYXRlKCkpO1xuICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgLyogZ2V0IHJlZ3VsYXIgYXJyYXlzLCBvciBhcnJheXMgbm90IG1hcmtlZCBmb3IgZGVlcCBpbmNsdXNpb24gKi9cbiAgICAgICAgICAgIGlmIChrby5pc09ic2VydmFibGVBcnJheShwcm9wZXJ0eSkgJiYgIWxvY2FsT2JqZWN0LmluY2x1ZGVzW2tleV0pIHtcbiAgICAgICAgICAgICAgICBwcm9wZXJ0eURhdGEgPSBmaXJlc3RvcmVEb2N1bWVudC5nZXQoa2V5KTtcbiAgICAgICAgICAgICAgICBpZiAoQXJyYXkuaXNBcnJheShwcm9wZXJ0eURhdGEpKSB7XG4gICAgICAgICAgICAgICAgICAgIHByb3BlcnR5KHByb3BlcnR5RGF0YSk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgLyogZ2V0IGRlZXAgaW5jbHVkZXMgZm9yIEFycmF5IHByb3BlcnRpZXMgKi9cbiAgICAgICAgICAgIGlmIChkZWVwSW5jbHVkZSAmJlxuICAgICAgICAgICAgICAgIGtvLmlzT2JzZXJ2YWJsZUFycmF5KHByb3BlcnR5KSAmJlxuICAgICAgICAgICAgICAgIGxvY2FsT2JqZWN0LmluY2x1ZGVzW2tleV0gJiZcbiAgICAgICAgICAgICAgICBsb2NhbE9iamVjdC5mc0Jhc2VDb2xsZWN0aW9uICE9PSB1bmRlZmluZWQpIHtcbiAgICAgICAgICAgICAgICB2YXIgaW5jbHVkZSA9IGxvY2FsT2JqZWN0LmluY2x1ZGVzW2tleV07XG4gICAgICAgICAgICAgICAgdmFyIGNvbGxlY3Rpb25SZWYgPSBsb2NhbE9iamVjdC5mc0Jhc2VDb2xsZWN0aW9uLmRvYyhsb2NhbE9iamVjdC5mc0RvY3VtZW50SWQpLmNvbGxlY3Rpb24oa2V5KTtcbiAgICAgICAgICAgICAgICBrb2ZzLmJpbmRDb2xsZWN0aW9uKHByb3BlcnR5LCBjb2xsZWN0aW9uUmVmLCBpbmNsdWRlW1wiY2xhc3NcIl0sIHsgdHdvV2F5QmluZGluZzogbG9jYWxPYmplY3QudHdvV2F5QmluZGluZywgb3JkZXJCeTogaW5jbHVkZS5vcmRlckJ5IH0pO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIC8qIHJlc2V0IGxvY2sgKi9cbiAgICAgICAgbG9jYWxPYmplY3QubG9jayA9IGZhbHNlO1xuICAgIH1cbn0pKGtvZnMgPSBleHBvcnRzLmtvZnMgfHwgKGV4cG9ydHMua29mcyA9IHt9KSk7XG4vLyMgc291cmNlTWFwcGluZ1VSTD1rbm9ja291dC1maXJlc3RvcmUuanMubWFwIiwiJ3VzZSBzdHJpY3QnO1xuXG4vKiBleHBvc2UgdGhlIGxpYnJhcnkgdG8gdGhlIGdsb2JhbCBzY29wZSAqL1xudmFyIGxpYnJhcnkgPSByZXF1aXJlKCcuLi9kaXN0L2tub2Nrb3V0LWZpcmVzdG9yZScpO1xuXG53aW5kb3cua29mcyA9IGxpYnJhcnkua29mczsiXX0=
