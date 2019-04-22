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
        if (typeof value == 'number' ||
            typeof value == 'string' ||
            typeof value == 'boolean') {
            doc[property] = value;
        }
        else if (Array.isArray(value)) { /* only serialize non-complex elements.. TODO: serialize knockout observables */
            doc[property] = value.filter(function (value) {
                return typeof value == 'number' ||
                    typeof value == 'string' ||
                    typeof value == 'boolean';
            });
        }
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
var Bindable_1 = require("./Bindable");
var helpers_1 = require("./helpers");
var knockout_firestore_1 = require("./knockout-firestore");
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
    var extension = new ArrayExtensions();
    var bindableArray = helpers_1.mergeObjects(koObservableArray, extension);
    bindableArray.subscribe(collectionChanged, bindableArray, 'arrayChange');
    return bindableArray;
}
exports.createBindableArray = createBindableArray;
function collectionChanged(changes) {
    /* if local only change (e.g. triggered by load from Firestore) return */
    /* also return if the collection is not set, which should'nt be able to happen, but to satisfy the type system, check for it */
    if (this.localOnly || this.fsCollection === undefined) {
        return;
    }
    var _loop_1 = function (change) {
        var item = change.value;
        switch (change.status) {
            case 'added':
                /* extend the Model with the ObservableDocument functionality
                 * extend / overrule the includes with includes from passed options (only one level) */
                var bindable_1 = Bindable_1.createBindable(item, this_1.includes);
                bindable_1.twoWayBinding = this_1.twoWayBinding;
                if (this_1.twoWayBinding) {
                    //logging.debug('Adding new document to Firestore collection "' + this.fsCollection.id + '"');
                    this_1.fsCollection.add(bindable_1.getFlatDocument())
                        .then(function (doc) {
                        bindable_1.fsBaseCollection = doc.parent;
                        bindable_1.fsDocumentId = doc.id;
                        /* get deep includes for Array properties
                         * TODO: fix that the deep linking is done here AND in explodeObject in knockout.firestore.js */
                        createAndBindDeepIncludes(bindable_1);
                    })["catch"](function (error) {
                        //logging.error('Error saving Firestore document :', error);
                    });
                }
                else {
                    //logging.debug('Adding new document to local collection only');
                    bindable_1.state(1); /* NEW */
                    bindable_1.fsBaseCollection = this_1.fsCollection;
                }
                break;
            case 'deleted':
                if (this_1.twoWayBinding) {
                    //logging.debug('Deleting document "' + item.fsDocumentId + '" from Firestore collection "' + this.fsCollection.id + '"');
                    var bindable_2 = item;
                    if (bindable_2.fsBaseCollection === undefined) {
                        return "continue";
                    } /* can't happen, but satisfy the type system by checking */
                    bindable_2.fsBaseCollection.doc(bindable_2.fsDocumentId)["delete"]()["catch"](function (error) {
                        //logging.error('Error deleting Firestore document :', error);
                    });
                }
                else {
                    //logging.debug('Document "' + item.fsDocumentId + '" removed from local collection.');
                    //logging.debug('You\'re not using Two-Way binding, please use .detach() in stead of .remove() to persist the change when syncing to Firestore');
                }
                break;
        }
    };
    var this_1 = this;
    for (var _i = 0, changes_1 = changes; _i < changes_1.length; _i++) {
        var change = changes_1[_i];
        _loop_1(change);
    }
}
function createAndBindDeepIncludes(item) {
    /* enumerate using keys() and filter out protoype functions with hasOwnProperty() in stead of using
     * getOwnPropertyNames(), because the latter also returns non-enumerables */
    for (var _i = 0, _a = Object.keys(item); _i < _a.length; _i++) {
        var key = _a[_i];
        if (!item.hasOwnProperty(key) || item.fsBaseCollection === undefined)
            continue;
        var property = item[key];
        /* get deep includes for Array properties */
        if (ko.isObservableArray(property) && item.includes && item.includes[key]) {
            var include = item.includes[key];
            var collectionRef = item.fsBaseCollection
                .doc(item.fsDocumentId)
                .collection(key);
            knockout_firestore_1.kofs.bindCollection(property, collectionRef, include["class"], { twoWayBinding: item.twoWayBinding, orderBy: include.orderBy });
            /* if the collection was locally already filled with data */
            /* TODO: Transaction for speed */
            for (var _b = 0, _c = property(); _b < _c.length; _b++) {
                var childItem = _c[_b];
                var bindableChild = Bindable_1.createBindable(childItem, {});
                bindableChild.fsBaseCollection = collectionRef;
                bindableChild.twoWayBinding = item.twoWayBinding;
                bindableChild.state(1); /* NEW */
                bindableChild.save();
            }
        }
    }
}

},{"./Bindable":1,"./helpers":3,"./knockout-firestore":4}],3:[function(require,module,exports){
"use strict";
exports.__esModule = true;
function mergeObjects(target, source) {
    var newTarget = target;
    var pSource = Object.getPrototypeOf(source);
    addPrototypeToEndOfChain(target, pSource);
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
function addPrototypeToEndOfChain(chain, prototype) {
    var pTarget = Object.getPrototypeOf(chain);
    if (pTarget === prototype) { /* prototype already added to this chain */
    }
    else if (pTarget === Object.prototype || pTarget === Function.prototype) { /* end of chain: add prototype */
        Object.setPrototypeOf(chain, prototype);
    }
    else { /* recursive go down chain */
        addPrototypeToEndOfChain(pTarget, prototype);
    }
}

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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uL3Vzci9sb2NhbC9saWIvbm9kZV9tb2R1bGVzL2Jyb3dzZXJpZnkvbm9kZV9tb2R1bGVzL2Jyb3dzZXItcGFjay9fcHJlbHVkZS5qcyIsInNyYy9CaW5kYWJsZS50cyIsInNyYy9CaW5kYWJsZUFycmF5LnRzIiwic3JjL2hlbHBlcnMudHMiLCJzcmMva25vY2tvdXQtZmlyZXN0b3JlLnRzIiwic3JjL2luZGV4LmpzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7QUNFQSxxQ0FBeUM7QUFNekM7SUFTSTtRQUFBLGlCQXFCQztRQXBCRyxJQUFJLENBQUMsSUFBSSxHQUFHLEtBQUssQ0FBQztRQUNsQixJQUFJLENBQUMsYUFBYSxHQUFHLElBQUksQ0FBQztRQUUxQixJQUFJLENBQUMsS0FBSyxHQUFHLEVBQUUsQ0FBQyxVQUFVLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxlQUFlO1FBQzlDLElBQUksQ0FBQyxRQUFRLEdBQUcsRUFBRSxDQUFDLFlBQVksQ0FBQztZQUM1QixPQUFPLEtBQUksQ0FBQyxLQUFLLEVBQUUsSUFBSSxDQUFDLENBQUM7UUFDN0IsQ0FBQyxDQUFDLENBQUM7UUFFSCxzREFBc0Q7UUFDdEQsTUFBTSxDQUFDLGNBQWMsQ0FBQyxJQUFJLEVBQUUsT0FBTyxFQUFFO1lBQ2pDLFVBQVUsRUFBRSxLQUFLO1lBQ2pCLFlBQVksRUFBRSxLQUFLO1lBQ25CLFFBQVEsRUFBRSxLQUFLO1NBQ2xCLENBQUMsQ0FBQztRQUVILE1BQU0sQ0FBQyxjQUFjLENBQUMsSUFBSSxFQUFFLFVBQVUsRUFBRTtZQUNwQyxVQUFVLEVBQUUsS0FBSztZQUNqQixZQUFZLEVBQUUsS0FBSztZQUNuQixRQUFRLEVBQUUsS0FBSztTQUNsQixDQUFDLENBQUM7SUFDUCxDQUFDO0lBRUQseUNBQWUsR0FBZjtRQUNJLElBQUksUUFBUSxHQUFRLEVBQUUsQ0FBQztRQUV2QjtvRkFDNEU7UUFDNUUsS0FBZ0IsVUFBaUIsRUFBakIsS0FBQSxNQUFNLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxFQUFqQixjQUFpQixFQUFqQixJQUFpQixFQUFFO1lBQTlCLElBQUksR0FBRyxTQUFBO1lBQ1IsSUFBSSxDQUFDLElBQUksQ0FBQyxjQUFjLENBQUMsR0FBRyxDQUFDO2dCQUFFLFNBQVM7WUFFeEMsSUFBSSxRQUFRLEdBQWMsSUFBSyxDQUFDLEdBQUcsQ0FBQyxDQUFDO1lBRXJDLDJEQUEyRDtZQUMzRCxJQUFJLEVBQUUsQ0FBQyxZQUFZLENBQUMsUUFBUSxDQUFDO2dCQUN6QixDQUFDLEVBQUUsQ0FBQyxVQUFVLENBQUMsUUFBUSxDQUFDO2dCQUN4QixDQUFPLElBQUksQ0FBQyxRQUFTLENBQUMsR0FBRyxDQUFDLEVBQUU7Z0JBQzVCLElBQUksYUFBYSxTQUFLLENBQUM7Z0JBQ3ZCLElBQUksT0FBTyxRQUFRLEVBQUUsS0FBSyxTQUFTLElBQUksT0FBTyxRQUFRLEVBQUUsS0FBSyxRQUFRLEVBQUU7b0JBQ25FLGFBQWEsR0FBRyxRQUFRLEVBQUUsQ0FBQyxDQUFDLG1EQUFtRDtpQkFDbEY7cUJBQ0k7b0JBQ0QsYUFBYSxHQUFHLFFBQVEsRUFBRSxJQUFJLEVBQUUsQ0FBQyxDQUFDLDBDQUEwQztpQkFDL0U7Z0JBRUQsUUFBUSxDQUFDLEdBQUcsQ0FBQyxHQUFHLGFBQWEsQ0FBQzthQUNqQztTQUNKO1FBRUQsT0FBTyxRQUFRLENBQUM7SUFDcEIsQ0FBQztJQUVELDhCQUFJLEdBQUo7UUFBQSxpQkEyQ0M7UUExQ0csSUFBSSxJQUFJLENBQUMsS0FBSyxFQUFFLElBQUksQ0FBQyxFQUFFO1lBQ25CLDBFQUEwRTtZQUMxRSxPQUFPO1NBQ1Y7UUFFRCxJQUFJLElBQUksQ0FBQyxnQkFBZ0IsS0FBSyxTQUFTLEVBQUU7WUFDckMseUZBQXlGO1lBQ3pGLE9BQU87U0FDVjtRQUVELElBQUksWUFBWSxHQUFRLElBQUksQ0FBQyxlQUFlLEVBQUUsQ0FBQztRQUUvQyxJQUFJLElBQUksQ0FBQyxLQUFLLEVBQUUsSUFBSSxDQUFDLEVBQUUsRUFBRSxTQUFTO1lBQzlCLElBQUksQ0FBQyxnQkFBZ0IsQ0FBQyxHQUFHLENBQUMsWUFBWSxDQUFDLENBQUMsSUFBSSxDQUFDLFVBQUMsR0FBZ0M7Z0JBQzFFLHVFQUF1RTtnQkFDdkUsS0FBSSxDQUFDLFlBQVksR0FBRyxHQUFHLENBQUMsRUFBRSxDQUFDO2dCQUMzQixJQUFJLEtBQUksQ0FBQyxLQUFLLEVBQUUsSUFBSSxDQUFDLEVBQUUsRUFBRSx3Q0FBd0M7b0JBQzdELDhGQUE4RjtvQkFDOUYsS0FBSSxDQUFDLElBQUksRUFBRSxDQUFDO2lCQUNmO3FCQUNJO29CQUNELEtBQUksQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDLENBQUM7aUJBQ2pCO1lBQ0wsQ0FBQyxDQUFDLENBQUMsT0FBSyxDQUFBLENBQUMsVUFBQyxLQUFVO2dCQUNoQiw0REFBNEQ7WUFDaEUsQ0FBQyxDQUFDLENBQUM7U0FDTjthQUNJLElBQUksSUFBSSxDQUFDLEtBQUssRUFBRSxJQUFJLENBQUMsRUFBRSxFQUFFLGNBQWM7WUFDeEMsSUFBSSxDQUFDLGdCQUFnQixDQUFDLEdBQUcsQ0FBQyxJQUFJLENBQUMsWUFBWSxDQUFDLENBQUMsTUFBTSxDQUFDLFlBQVksQ0FBQyxDQUFDLElBQUksQ0FBQztnQkFDbkUsa0ZBQWtGO2dCQUNsRixLQUFJLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQyxDQUFDO1lBQ2xCLENBQUMsQ0FBQyxDQUFDLE9BQUssQ0FBQSxDQUFDLFVBQUMsS0FBVTtnQkFDaEIsNERBQTREO1lBQ2hFLENBQUMsQ0FBQyxDQUFDO1NBQ047YUFDSSxJQUFJLElBQUksQ0FBQyxLQUFLLEVBQUUsSUFBSSxDQUFDLEVBQUUsRUFBRSxhQUFhO1lBQ3ZDLElBQUksQ0FBQyxnQkFBZ0IsQ0FBQyxHQUFHLENBQUMsSUFBSSxDQUFDLFlBQVksQ0FBQyxDQUFDLFFBQU0sQ0FBQSxFQUFFLENBQUMsSUFBSSxDQUFDO2dCQUN2RCxzRkFBc0Y7WUFDMUYsQ0FBQyxDQUFDLENBQUMsT0FBSyxDQUFBLENBQUMsVUFBQyxLQUFVO2dCQUNoQiw0REFBNEQ7WUFDaEUsQ0FBQyxDQUFDLENBQUM7U0FDTjtJQUNMLENBQUM7SUFFRCxzQ0FBWSxHQUFaLFVBQWEsUUFBZ0IsRUFBRSxLQUFVO1FBQ3JDLElBQUksR0FBRyxHQUFRLEVBQUUsQ0FBQztRQUVsQixJQUFJLE9BQU8sS0FBSyxJQUFJLFFBQVE7WUFDeEIsT0FBTyxLQUFLLElBQUksUUFBUTtZQUN4QixPQUFPLEtBQUssSUFBSSxTQUFTLEVBQUU7WUFDM0IsR0FBRyxDQUFDLFFBQVEsQ0FBQyxHQUFHLEtBQUssQ0FBQztTQUN6QjthQUNJLElBQUksS0FBSyxDQUFDLE9BQU8sQ0FBQyxLQUFLLENBQUMsRUFBRSxFQUFFLGdGQUFnRjtZQUM3RyxHQUFHLENBQUMsUUFBUSxDQUFDLEdBQUcsS0FBSyxDQUFDLE1BQU0sQ0FBQyxVQUFDLEtBQVU7Z0JBQ3BDLE9BQU8sT0FBTyxLQUFLLElBQUksUUFBUTtvQkFDM0IsT0FBTyxLQUFLLElBQUksUUFBUTtvQkFDeEIsT0FBTyxLQUFLLElBQUksU0FBUyxDQUFDO1lBQ2xDLENBQUMsQ0FBQyxDQUFDO1NBQ047UUFFRCxJQUFJLElBQUksQ0FBQyxnQkFBZ0IsS0FBSyxTQUFTLEVBQUU7WUFDckMseUZBQXlGO1lBQ3pGLE9BQU87U0FDVjtRQUVEOzs7bUVBRzJEO1FBQzNELElBQUksT0FBTyxJQUFJLENBQUMsWUFBWSxLQUFLLFdBQVcsRUFBRTtZQUMxQyxJQUFJLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsV0FBVztTQUM3QjthQUNJO1lBQ0QsSUFBSSxDQUFDLGdCQUFnQixDQUFDLEdBQUcsQ0FBQyxJQUFJLENBQUMsWUFBWSxDQUFDLENBQUMsTUFBTSxDQUFDLEdBQUcsQ0FBQyxDQUFDLElBQUksQ0FBQztnQkFDMUQsa0ZBQWtGO1lBQ3RGLENBQUMsQ0FBQyxDQUFDLE9BQUssQ0FBQSxDQUFDLFVBQUMsS0FBVTtnQkFDaEIsNERBQTREO1lBQ2hFLENBQUMsQ0FBQyxDQUFDO1NBQ047SUFDTCxDQUFDO0lBQ0wsc0JBQUM7QUFBRCxDQTlJQSxBQThJQyxJQUFBO0FBOUlZLDBDQUFlO0FBZ0o1Qjs7Ozs7R0FLRztBQUNILFNBQWdCLGNBQWMsQ0FBSSxLQUFRLEVBQUUsUUFBYztJQUV0RCxJQUFJLFNBQVMsR0FBRyxJQUFJLGVBQWUsRUFBRSxDQUFDO0lBRXRDLElBQUksYUFBYSxHQUFnQixzQkFBWSxDQUFDLEtBQUssRUFBRSxTQUFTLENBQUMsQ0FBQztJQUVoRSxhQUFhLENBQUMsUUFBUSxHQUFHLE1BQU0sQ0FBQyxNQUFNLENBQUMsUUFBUSxJQUFJLEVBQUUsRUFBRSxhQUFhLENBQUMsUUFBUSxDQUFDLENBQUM7NEJBS3RFLEdBQUc7UUFDUixJQUFJLENBQUMsYUFBYSxDQUFDLGNBQWMsQ0FBQyxHQUFHLENBQUM7OEJBQVc7UUFFakQsSUFBSSxRQUFRLEdBQWMsYUFBYyxDQUFDLEdBQUcsQ0FBQyxDQUFDO1FBRTlDLHNDQUFzQztRQUN0QyxJQUFJLEVBQUUsQ0FBQyxZQUFZLENBQUMsUUFBUSxDQUFDO1lBQ3pCLENBQUMsQ0FBQyxFQUFFLENBQUMsaUJBQWlCLENBQUMsUUFBUSxDQUFDLElBQUksQ0FBTyxhQUFhLENBQUMsUUFBUyxDQUFDLEdBQUcsQ0FBQyxDQUFDO1lBQ3hFLENBQUMsRUFBRSxDQUFDLFVBQVUsQ0FBQyxRQUFRLENBQUMsRUFBRTtZQUMxQixDQUFDLFVBQUMsV0FBbUI7Z0JBQ2pCLFFBQVEsQ0FBQyxTQUFTLENBQUMsVUFBQyxLQUFVO29CQUMxQixnSEFBZ0g7b0JBRWhILGdFQUFnRTtvQkFDaEUsSUFBSSxDQUFDLGFBQWEsQ0FBQyxJQUFJLEVBQUU7d0JBQ3JCLElBQUksYUFBYSxDQUFDLGFBQWEsRUFBRTs0QkFDN0IsYUFBYSxDQUFDLFlBQVksQ0FBQyxXQUFXLEVBQUUsS0FBSyxDQUFDLENBQUM7eUJBQ2xEOzZCQUNJLElBQUksYUFBYSxDQUFDLEtBQUssRUFBRSxJQUFJLENBQUMsRUFBRSxFQUFFLHNHQUFzRzs0QkFDekksYUFBYSxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLGNBQWM7eUJBQ3pDO3FCQUNKO2dCQUNMLENBQUMsQ0FBQyxDQUFDO1lBQ1AsQ0FBQyxDQUFDLENBQUMsR0FBRyxDQUFDLENBQUM7U0FDWDs7SUEzQkw7O2dGQUU0RTtJQUM1RSxLQUFnQixVQUEwQixFQUExQixLQUFBLE1BQU0sQ0FBQyxJQUFJLENBQUMsYUFBYSxDQUFDLEVBQTFCLGNBQTBCLEVBQTFCLElBQTBCO1FBQXJDLElBQUksR0FBRyxTQUFBO2dCQUFILEdBQUc7S0F5Qlg7SUFFRCxPQUFPLGFBQWEsQ0FBQztBQUN6QixDQUFDO0FBdkNELHdDQXVDQzs7Ozs7QUNuTUQsdUNBQXVFO0FBQ3ZFLHFDQUF5QztBQUN6QywyREFBNEM7QUFNNUM7SUFPSTtRQUNJLElBQUksQ0FBQyxTQUFTLEdBQUcsS0FBSyxDQUFDO1FBQ3ZCLElBQUksQ0FBQyxhQUFhLEdBQUcsS0FBSyxDQUFDO0lBQy9CLENBQUM7SUFFRCxxQ0FBVyxHQUFYLFVBQVksRUFBVTtRQUNsQixxREFBcUQ7UUFDckQsSUFBSSxRQUFRLEdBQW9DLElBQUssRUFBRSxDQUFDO1FBRXhELEtBQWdCLFVBQVEsRUFBUixxQkFBUSxFQUFSLHNCQUFRLEVBQVIsSUFBUSxFQUFFO1lBQXJCLElBQUksR0FBRyxpQkFBQTtZQUNSLG9EQUFvRDtZQUNwRCxJQUFJLFdBQVcsR0FBNkIsR0FBRyxDQUFDO1lBRWhELElBQUksV0FBVyxDQUFDLFlBQVksS0FBSyxFQUFFO2dCQUMvQixPQUFPLFdBQVcsQ0FBQztTQUMxQjtRQUVELE9BQU8sSUFBSSxDQUFDO0lBQ2hCLENBQUM7SUFFRCxnQ0FBTSxHQUFOLFVBQU8sSUFBTztRQUNWLHFEQUFxRDtRQUNyRCxJQUFJLGVBQWUsR0FBaUQsSUFBSyxDQUFDO1FBRTFFLHNEQUFzRDtRQUN0RCxJQUFJLGVBQWUsQ0FBQyxhQUFhLEVBQUU7WUFDL0IsZUFBZSxDQUFDLE1BQU0sQ0FBQyxJQUFJLENBQUMsQ0FBQztTQUNoQzthQUNJO1lBQ0QsZ0RBQWdEO1lBQ2xDLElBQUssQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxhQUFhO1lBRTNDLGlGQUFpRjtZQUNqRixlQUFlLENBQUMsT0FBTyxDQUFDLElBQUksQ0FBQyxDQUFDO1lBRTlCLHdGQUF3RjtTQUMzRjtJQUNMLENBQUM7SUFFRCxpQ0FBTyxHQUFQO1FBQ0kscURBQXFEO1FBQ3JELElBQUksUUFBUSxHQUFvQyxJQUFLLEVBQUUsQ0FBQztRQUV4RCxLQUFpQixVQUFRLEVBQVIscUJBQVEsRUFBUixzQkFBUSxFQUFSLElBQVEsRUFBRTtZQUF0QixJQUFJLElBQUksaUJBQUE7WUFDVCxnREFBZ0Q7WUFDaEQsSUFBSSxZQUFZLEdBQTZCLElBQUksQ0FBQTtZQUVqRCxJQUFJLFlBQVksQ0FBQyxLQUFLLEVBQUUsS0FBSyxDQUFDLEVBQUU7Z0JBQzVCLFlBQVksQ0FBQyxJQUFJLEVBQUUsQ0FBQzthQUN2QjtTQUNKO0lBQ0wsQ0FBQztJQUNMLHNCQUFDO0FBQUQsQ0EzREEsQUEyREMsSUFBQTtBQTNEWSwwQ0FBZTtBQTZENUIsU0FBZ0IsbUJBQW1CLENBQUksaUJBQXFDO0lBRXhFLElBQUksU0FBUyxHQUF1QixJQUFJLGVBQWUsRUFBRSxDQUFDO0lBRTFELElBQUksYUFBYSxHQUFxQixzQkFBWSxDQUFDLGlCQUFpQixFQUFFLFNBQVMsQ0FBQyxDQUFDO0lBQ2pGLGFBQWEsQ0FBQyxTQUFTLENBQW1CLGlCQUFpQixFQUFFLGFBQWEsRUFBRSxhQUFhLENBQUMsQ0FBQztJQUUzRixPQUFPLGFBQWEsQ0FBQztBQUN6QixDQUFDO0FBUkQsa0RBUUM7QUFFRCxTQUFTLGlCQUFpQixDQUE4QixPQUE4QjtJQUNsRix5RUFBeUU7SUFDekUsK0hBQStIO0lBQy9ILElBQUksSUFBSSxDQUFDLFNBQVMsSUFBSSxJQUFJLENBQUMsWUFBWSxLQUFLLFNBQVMsRUFBRTtRQUFFLE9BQU87S0FBRTs0QkFFekQsTUFBTTtRQUNYLElBQUksSUFBSSxHQUFNLE1BQU0sQ0FBQyxLQUFLLENBQUM7UUFFM0IsUUFBUSxNQUFNLENBQUMsTUFBTSxFQUFFO1lBQ25CLEtBQUssT0FBTztnQkFDUjt1R0FDdUY7Z0JBQ3ZGLElBQUksVUFBUSxHQUFnQix5QkFBYyxDQUFDLElBQUksRUFBRSxPQUFLLFFBQVEsQ0FBQyxDQUFDO2dCQUNoRSxVQUFRLENBQUMsYUFBYSxHQUFHLE9BQUssYUFBYSxDQUFDO2dCQUU1QyxJQUFJLE9BQUssYUFBYSxFQUFFO29CQUNwQiw4RkFBOEY7b0JBRTlGLE9BQUssWUFBWSxDQUFDLEdBQUcsQ0FBQyxVQUFRLENBQUMsZUFBZSxFQUFFLENBQUM7eUJBQzVDLElBQUksQ0FBQyxVQUFDLEdBQWdDO3dCQUNuQyxVQUFRLENBQUMsZ0JBQWdCLEdBQUcsR0FBRyxDQUFDLE1BQU0sQ0FBQzt3QkFDdkMsVUFBUSxDQUFDLFlBQVksR0FBRyxHQUFHLENBQUMsRUFBRSxDQUFDO3dCQUUvQjt3SEFDZ0c7d0JBQ2hHLHlCQUF5QixDQUFDLFVBQVEsQ0FBQyxDQUFDO29CQUN4QyxDQUFDLENBQUMsQ0FBQyxPQUFLLENBQUEsQ0FBQyxVQUFVLEtBQUs7d0JBQ3BCLDREQUE0RDtvQkFDaEUsQ0FBQyxDQUFDLENBQUM7aUJBQ1Y7cUJBQ0k7b0JBQ0QsZ0VBQWdFO29CQUNoRSxVQUFRLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsU0FBUztvQkFDNUIsVUFBUSxDQUFDLGdCQUFnQixHQUFHLE9BQUssWUFBWSxDQUFDO2lCQUNqRDtnQkFFRCxNQUFNO1lBQ1YsS0FBSyxTQUFTO2dCQUNWLElBQUksT0FBSyxhQUFhLEVBQUU7b0JBQ3BCLDBIQUEwSDtvQkFFMUgsSUFBSSxVQUFRLEdBQTZCLElBQUksQ0FBQztvQkFFOUMsSUFBSSxVQUFRLENBQUMsZ0JBQWdCLEtBQUssU0FBUyxFQUFFOztxQkFBYSxDQUFDLDJEQUEyRDtvQkFFdEgsVUFBUSxDQUFDLGdCQUFnQixDQUFDLEdBQUcsQ0FBQyxVQUFRLENBQUMsWUFBWSxDQUFDLENBQy9DLFFBQU0sQ0FBQSxFQUFFLENBQ1IsT0FBSyxDQUFBLENBQUMsVUFBQyxLQUFVO3dCQUNkLDhEQUE4RDtvQkFDbEUsQ0FBQyxDQUFDLENBQUM7aUJBQ1Y7cUJBQ0k7b0JBQ0QsdUZBQXVGO29CQUN2RixpSkFBaUo7aUJBQ3BKO2dCQUVELE1BQU07U0FDYjs7O0lBcERMLEtBQW1CLFVBQU8sRUFBUCxtQkFBTyxFQUFQLHFCQUFPLEVBQVAsSUFBTztRQUFyQixJQUFJLE1BQU0sZ0JBQUE7Z0JBQU4sTUFBTTtLQXFEZDtBQUNMLENBQUM7QUFFRCxTQUFTLHlCQUF5QixDQUFJLElBQWlCO0lBQ25EO2dGQUM0RTtJQUM1RSxLQUFnQixVQUFpQixFQUFqQixLQUFBLE1BQU0sQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLEVBQWpCLGNBQWlCLEVBQWpCLElBQWlCLEVBQUU7UUFBOUIsSUFBSSxHQUFHLFNBQUE7UUFFUixJQUFJLENBQUMsSUFBSSxDQUFDLGNBQWMsQ0FBQyxHQUFHLENBQUMsSUFBSSxJQUFJLENBQUMsZ0JBQWdCLEtBQUssU0FBUztZQUFFLFNBQVM7UUFFL0UsSUFBSSxRQUFRLEdBQVMsSUFBSyxDQUFDLEdBQUcsQ0FBQyxDQUFDO1FBRWhDLDRDQUE0QztRQUM1QyxJQUFJLEVBQUUsQ0FBQyxpQkFBaUIsQ0FBQyxRQUFRLENBQUMsSUFBSSxJQUFJLENBQUMsUUFBUSxJQUFVLElBQUksQ0FBQyxRQUFTLENBQUMsR0FBRyxDQUFDLEVBQUU7WUFDOUUsSUFBSSxPQUFPLEdBQVMsSUFBSSxDQUFDLFFBQVMsQ0FBQyxHQUFHLENBQUMsQ0FBQztZQUN4QyxJQUFJLGFBQWEsR0FBRyxJQUFJLENBQUMsZ0JBQWdCO2lCQUNwQyxHQUFHLENBQUMsSUFBSSxDQUFDLFlBQVksQ0FBQztpQkFDdEIsVUFBVSxDQUFDLEdBQUcsQ0FBQyxDQUFDO1lBRXJCLHlCQUFJLENBQUMsY0FBYyxDQUFDLFFBQVEsRUFBRSxhQUFhLEVBQUUsT0FBTyxDQUFDLE9BQUssQ0FBQSxFQUFFLEVBQUUsYUFBYSxFQUFFLElBQUksQ0FBQyxhQUFhLEVBQUUsT0FBTyxFQUFFLE9BQU8sQ0FBQyxPQUFPLEVBQUUsQ0FBQyxDQUFDO1lBRTdILDREQUE0RDtZQUM1RCxpQ0FBaUM7WUFDakMsS0FBc0IsVUFBVSxFQUFWLEtBQUEsUUFBUSxFQUFFLEVBQVYsY0FBVSxFQUFWLElBQVUsRUFBRTtnQkFBN0IsSUFBSSxTQUFTLFNBQUE7Z0JBQ2QsSUFBSSxhQUFhLEdBQW9CLHlCQUFjLENBQUMsU0FBUyxFQUFFLEVBQUUsQ0FBQyxDQUFDO2dCQUNuRSxhQUFhLENBQUMsZ0JBQWdCLEdBQUcsYUFBYSxDQUFDO2dCQUMvQyxhQUFhLENBQUMsYUFBYSxHQUFHLElBQUksQ0FBQyxhQUFhLENBQUM7Z0JBQ2pELGFBQWEsQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxTQUFTO2dCQUNqQyxhQUFhLENBQUMsSUFBSSxFQUFFLENBQUM7YUFDeEI7U0FDSjtLQUNKO0FBQ0wsQ0FBQzs7Ozs7QUMzS0QsU0FBZ0IsWUFBWSxDQUFtQixNQUFlLEVBQUUsTUFBZTtJQUUzRSxJQUFJLFNBQVMsR0FBeUMsTUFBTSxDQUFDO0lBQzdELElBQUksT0FBTyxHQUFRLE1BQU0sQ0FBQyxjQUFjLENBQUMsTUFBTSxDQUFDLENBQUM7SUFFakQsd0JBQXdCLENBQUMsTUFBTSxFQUFFLE9BQU8sQ0FBQyxDQUFDO0lBRTFDLHNHQUFzRztJQUN0RyxLQUFnQixVQUFrQyxFQUFsQyxLQUFBLE1BQU0sQ0FBQyxtQkFBbUIsQ0FBQyxNQUFNLENBQUMsRUFBbEMsY0FBa0MsRUFBbEMsSUFBa0MsRUFBRTtRQUEvQyxJQUFJLEdBQUcsU0FBQTtRQUNSLElBQUksVUFBVSxHQUFtQyxNQUFNLENBQUMsd0JBQXdCLENBQUMsTUFBTSxFQUFFLEdBQUcsQ0FBQyxDQUFDO1FBRTlGLElBQUksVUFBVSxJQUFJLENBQUMsQ0FBQyxVQUFVLENBQUMsUUFBUSxJQUFJLENBQUMsVUFBVSxDQUFDLFlBQVksSUFBSSxDQUFDLFVBQVUsQ0FBQyxVQUFVLElBQUksVUFBVSxDQUFDLEdBQUcsSUFBSSxVQUFVLENBQUMsR0FBRyxDQUFDLEVBQUU7WUFDaEksTUFBTSxDQUFDLGNBQWMsQ0FBQyxNQUFNLEVBQUUsR0FBRyxFQUFFLFVBQVUsQ0FBQyxDQUFDO1NBQ2xEO2FBQ0k7WUFDSyxNQUFPLENBQUMsR0FBRyxDQUFDLEdBQVMsTUFBTyxDQUFDLEdBQUcsQ0FBQyxDQUFDO1NBQzNDO0tBQ0o7SUFFRCxPQUFPLFNBQVMsQ0FBQztBQUNyQixDQUFDO0FBcEJELG9DQW9CQztBQUVELFNBQVMsd0JBQXdCLENBQUMsS0FBVSxFQUFFLFNBQWM7SUFDeEQsSUFBSSxPQUFPLEdBQVEsTUFBTSxDQUFDLGNBQWMsQ0FBQyxLQUFLLENBQUMsQ0FBQztJQUVoRCxJQUFHLE9BQU8sS0FBSyxTQUFTLEVBQUUsRUFBRywyQ0FBMkM7S0FDdkU7U0FDSSxJQUFHLE9BQU8sS0FBSyxNQUFNLENBQUMsU0FBUyxJQUFJLE9BQU8sS0FBSyxRQUFRLENBQUMsU0FBUyxFQUFFLEVBQUUsaUNBQWlDO1FBQ3ZHLE1BQU0sQ0FBQyxjQUFjLENBQUMsS0FBSyxFQUFFLFNBQVMsQ0FBQyxDQUFDO0tBQzNDO1NBQ0ksRUFBRSw2QkFBNkI7UUFDaEMsd0JBQXdCLENBQUMsT0FBTyxFQUFFLFNBQVMsQ0FBQyxDQUFDO0tBQ2hEO0FBQ0wsQ0FBQzs7Ozs7QUMvQkQsaURBQXFFO0FBQ3JFLHVDQUFzRDtBQUl0RCxJQUFpQixJQUFJLENBd0xwQjtBQXhMRCxXQUFpQixJQUFJO0lBUWpCLFNBQWdCLGtCQUFrQixDQUFJLFlBQTJDLEVBQUUsS0FBa0IsRUFBRSxPQUFZO1FBQy9HLCtEQUErRDtRQUMvRCxJQUFJLGVBQWUsR0FBdUIsRUFBRSxDQUFDLGVBQWUsRUFBRSxDQUFDO1FBRS9ELGNBQWMsQ0FBQyxlQUFlLEVBQUUsWUFBWSxFQUFFLEtBQUssRUFBRSxPQUFPLENBQUMsQ0FBQztRQUU5RCxPQUF5QixlQUFlLENBQUM7SUFDN0MsQ0FBQztJQVBlLHVCQUFrQixxQkFPakMsQ0FBQTtJQUVELFNBQWdCLGNBQWMsQ0FBSSxlQUFtQyxFQUFFLFlBQTJDLEVBQUUsS0FBa0IsRUFBRSxPQUFvQjtRQUN4SixjQUFjO1FBQ2QsT0FBTyxHQUFHLE9BQU8sSUFBSSxFQUFFLENBQUM7UUFDeEIsSUFBSSxLQUFLLEdBQUcsT0FBTyxDQUFDLEtBQUssSUFBSSxFQUFFLENBQUM7UUFDaEMsSUFBSSxPQUFPLEdBQUcsT0FBTyxDQUFDLE9BQU8sSUFBSSxFQUFFLENBQUM7UUFDcEMsSUFBSSxRQUFRLEdBQUcsT0FBTyxDQUFDLFFBQVEsSUFBSSxFQUFFLENBQUM7UUFDdEMsSUFBSSxhQUFhLEdBQVksT0FBTyxPQUFPLENBQUMsYUFBYSxLQUFLLFdBQVcsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxPQUFPLENBQUMsYUFBYSxDQUFDO1FBRXpHLG1CQUFtQjtRQUNuQixrRUFBa0U7UUFFbEUsb0VBQW9FO1FBQ3BFLElBQUksS0FBSyxHQUFvQixvQkFBb0IsQ0FBa0IsWUFBWSxFQUFFLEtBQUssRUFBRSxPQUFPLENBQUMsQ0FBQztRQUVqRyxtREFBbUQ7UUFDbkQsSUFBSSxhQUFhLEdBQXFCLG1DQUFtQixDQUFDLGVBQWUsQ0FBQyxDQUFDO1FBQzNFLGFBQWEsQ0FBQyxhQUFhLEdBQUcsYUFBYSxDQUFDO1FBQzVDLGFBQWEsQ0FBQyxPQUFPLEdBQUcsS0FBSyxDQUFDO1FBQzlCLGFBQWEsQ0FBQyxZQUFZLEdBQUcsWUFBWSxDQUFDO1FBQzFDLGFBQWEsQ0FBQyxRQUFRLEdBQUcsUUFBUSxDQUFDO1FBRWxDLDJDQUEyQztRQUMzQyxLQUFLLENBQUMsVUFBVSxDQUFDLFVBQUMsUUFBaUM7WUFDL0MsUUFBUSxDQUFDLFVBQVUsRUFBRSxDQUFDLE9BQU8sQ0FBQyxVQUFDLE1BQWdDO2dCQUMzRCwwQkFBMEI7Z0JBQzFCLElBQUksQ0FBQyxNQUFNLENBQUMsR0FBRyxDQUFDLFFBQVEsQ0FBQyxnQkFBZ0IsRUFBRTtvQkFFdkMsSUFBSSxNQUFNLENBQUMsSUFBSSxLQUFLLE9BQU8sRUFBRTt3QkFDekIsOEVBQThFO3dCQUM5RSxJQUFJLElBQUksR0FBMkIsSUFBSSxLQUFLLEVBQUUsQ0FBQzt3QkFDL0MsSUFBSSxLQUFLLEdBQVcsTUFBTSxDQUFDLFFBQVEsQ0FBQzt3QkFFcEMsc0RBQXNEO3dCQUN0RCxJQUFJLGdCQUFnQixHQUFHLE1BQU0sQ0FBQyxNQUFNLENBQUMsUUFBUSxFQUFFLElBQUksQ0FBQyxRQUFRLENBQUMsQ0FBQzt3QkFDOUQsSUFBSSxZQUFZLEdBQWdCLHlCQUFjLENBQUMsSUFBSSxFQUFFLGdCQUFnQixDQUFDLENBQUM7d0JBRXZFO2tHQUMwRTt3QkFDMUUsWUFBWSxDQUFDLGdCQUFnQixHQUFHLE1BQU0sQ0FBQyxHQUFHLENBQUMsR0FBRyxDQUFDLE1BQU0sQ0FBQzt3QkFDdEQsWUFBWSxDQUFDLFlBQVksR0FBRyxNQUFNLENBQUMsR0FBRyxDQUFDLEVBQUUsQ0FBQzt3QkFDMUMsWUFBWSxDQUFDLGFBQWEsR0FBRyxhQUFhLENBQUM7d0JBRTNDLGtEQUFrRDt3QkFDbEQsYUFBYSxDQUFDLE1BQU0sQ0FBQyxHQUFHLEVBQUUsWUFBWSxFQUFFLGFBQWEsQ0FBQyxDQUFDO3dCQUV2RCxvRkFBb0Y7d0JBQ3BGLGFBQWEsQ0FBQyxTQUFTLEdBQUcsSUFBSSxDQUFDO3dCQUMvQixhQUFhLENBQUMsTUFBTSxDQUFDLEtBQUssRUFBRSxDQUFDLEVBQUUsWUFBWSxDQUFDLENBQUM7d0JBQzdDLGFBQWEsQ0FBQyxTQUFTLEdBQUcsS0FBSyxDQUFDO3FCQUNuQztvQkFDRCxJQUFJLE1BQU0sQ0FBQyxJQUFJLEtBQUssVUFBVSxFQUFFO3dCQUM1QixtRUFBbUU7d0JBQ25FLElBQUksUUFBUSxHQUF1QixhQUFhLENBQUMsV0FBVyxDQUFDLE1BQU0sQ0FBQyxHQUFHLENBQUMsRUFBRSxDQUFDLENBQUM7d0JBQzVFLElBQUksUUFBUSxJQUFJLElBQUksRUFBRTs0QkFDbEIsNkRBQTZEOzRCQUM3RCxhQUFhLENBQUMsTUFBTSxDQUFDLEdBQUcsRUFBRSxRQUFRLEVBQUUsS0FBSyxDQUFDLENBQUM7eUJBQzlDOzZCQUNJOzRCQUNELHdGQUF3Rjt5QkFDM0Y7cUJBQ0o7b0JBQ0QsSUFBSSxNQUFNLENBQUMsSUFBSSxLQUFLLFNBQVMsRUFBRTt3QkFDM0Isa0ZBQWtGO3dCQUNsRixJQUFJLFFBQVEsR0FBdUIsYUFBYSxDQUFDLFdBQVcsQ0FBQyxNQUFNLENBQUMsR0FBRyxDQUFDLEVBQUUsQ0FBQyxDQUFDO3dCQUM1RSxJQUFJLFFBQVEsSUFBSSxJQUFJLEVBQUU7NEJBQ2xCLGFBQWEsQ0FBQyxTQUFTLEdBQUcsSUFBSSxDQUFDOzRCQUMvQixhQUFhLENBQUMsTUFBTSxDQUFDLFFBQVEsQ0FBQyxDQUFDOzRCQUMvQixhQUFhLENBQUMsU0FBUyxHQUFHLEtBQUssQ0FBQzt5QkFDbkM7NkJBQ0k7NEJBQ0QsMEhBQTBIOzRCQUMxSCxpR0FBaUc7eUJBQ3BHO3FCQUNKO2lCQUNKO1lBQ0wsQ0FBQyxDQUFDLENBQUM7UUFDUCxDQUFDLENBQUMsQ0FBQztJQUNQLENBQUM7SUE3RWUsbUJBQWMsaUJBNkU3QixDQUFBO0lBRUQsU0FBUyxvQkFBb0IsQ0FBQyxVQUEyQixFQUFFLEtBQVUsRUFBRSxPQUFZO1FBQy9FLG9FQUFvRTtRQUVwRSxJQUFJLEtBQUssR0FBb0IsVUFBVSxDQUFDO1FBRXhDLElBQUksS0FBSyxJQUFJLElBQUksSUFBSSxLQUFLLENBQUMsT0FBTyxDQUFDLEtBQUssQ0FBQyxJQUFJLEtBQUssQ0FBQyxNQUFNLEdBQUcsQ0FBQyxFQUFFO1lBQzNELElBQUksS0FBSyxDQUFDLE9BQU8sQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDLENBQUMsRUFBRTtnQkFDekIsS0FBd0IsVUFBSyxFQUFMLGVBQUssRUFBTCxtQkFBSyxFQUFMLElBQUssRUFBRTtvQkFBMUIsSUFBSSxXQUFXLGNBQUE7b0JBQ2hCLEtBQUssR0FBRyxLQUFLLENBQUMsS0FBSyxDQUFDLFdBQVcsQ0FBQyxDQUFDLENBQUMsRUFBRSxXQUFXLENBQUMsQ0FBQyxDQUFDLEVBQUUsV0FBVyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUM7aUJBQ3ZFO2FBQ0o7aUJBQ0k7Z0JBQ0QsS0FBSyxHQUFHLEtBQUssQ0FBQyxLQUFLLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQyxFQUFFLEtBQUssQ0FBQyxDQUFDLENBQUMsRUFBRSxLQUFLLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQzthQUNyRDtTQUNKO1FBRUQsSUFBSSxPQUFPLElBQUksSUFBSSxJQUFJLEtBQUssQ0FBQyxPQUFPLENBQUMsT0FBTyxDQUFDLElBQUksT0FBTyxDQUFDLE1BQU0sR0FBRyxDQUFDLEVBQUU7WUFDakUsSUFBSSxLQUFLLENBQUMsT0FBTyxDQUFDLE9BQU8sQ0FBQyxDQUFDLENBQUMsQ0FBQyxFQUFFO2dCQUMzQixLQUEwQixVQUFPLEVBQVAsbUJBQU8sRUFBUCxxQkFBTyxFQUFQLElBQU8sRUFBRTtvQkFBOUIsSUFBSSxhQUFhLGdCQUFBO29CQUNsQixLQUFLLEdBQUcsS0FBSyxDQUFDLE9BQU8sQ0FBQyxhQUFhLENBQUMsQ0FBQyxDQUFDLEVBQUUsYUFBYSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUM7aUJBQzdEO2FBQ0o7aUJBQ0k7Z0JBQ0QsS0FBSyxHQUFHLEtBQUssQ0FBQyxPQUFPLENBQUMsT0FBTyxDQUFDLENBQUMsQ0FBQyxFQUFFLE9BQU8sQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDO2FBQ2pEO1NBQ0o7UUFFRCxPQUFPLEtBQUssQ0FBQztJQUNqQixDQUFDO0lBRUQsU0FBUyxhQUFhLENBQUksaUJBQWtELEVBQUUsV0FBd0IsRUFBRSxXQUFvQjtRQUN4SCx5RUFBeUU7UUFDekUsV0FBVyxDQUFDLElBQUksR0FBRyxJQUFJLENBQUM7UUFFeEI7b0ZBQzRFO1FBQzVFLEtBQWdCLFVBQXdCLEVBQXhCLEtBQUEsTUFBTSxDQUFDLElBQUksQ0FBQyxXQUFXLENBQUMsRUFBeEIsY0FBd0IsRUFBeEIsSUFBd0IsRUFBRTtZQUFyQyxJQUFJLEdBQUcsU0FBQTtZQUNSLElBQUksQ0FBQyxXQUFXLENBQUMsY0FBYyxDQUFDLEdBQUcsQ0FBQztnQkFBRSxTQUFTO1lBRS9DLElBQUksWUFBWSxTQUFLLENBQUM7WUFDdEIsSUFBSSxRQUFRLEdBQWMsV0FBWSxDQUFDLEdBQUcsQ0FBQyxDQUFDO1lBRTVDLHNEQUFzRDtZQUN0RCxJQUFJLEVBQUUsQ0FBQyxZQUFZLENBQUMsUUFBUSxDQUFDO2dCQUN6QixDQUFDLEVBQUUsQ0FBQyxpQkFBaUIsQ0FBQyxRQUFRLENBQUM7Z0JBQy9CLENBQUMsRUFBRSxDQUFDLFVBQVUsQ0FBQyxRQUFRLENBQUMsRUFBRTtnQkFFMUIsWUFBWSxHQUFHLGlCQUFpQixDQUFDLEdBQUcsQ0FBQyxHQUFHLENBQUMsQ0FBQztnQkFFMUMsUUFBUSxPQUFPLFlBQVksRUFBRTtvQkFDekIsS0FBSyxXQUFXO3dCQUNaLE1BQU07b0JBQ1YsS0FBSyxRQUFRLENBQUM7b0JBQ2QsS0FBSyxRQUFRLENBQUM7b0JBQ2QsS0FBSyxTQUFTO3dCQUNWLFFBQVEsQ0FBQyxZQUFZLENBQUMsQ0FBQzt3QkFDdkIsTUFBTTtvQkFDVixLQUFLLFFBQVE7d0JBQ1QsSUFBSSxZQUFZLElBQUksT0FBTyxZQUFZLENBQUMsTUFBTSxLQUFLLFVBQVUsRUFBRSxFQUFFLGdDQUFnQzs0QkFDN0YsUUFBUSxDQUFDLFlBQVksQ0FBQyxNQUFNLEVBQUUsQ0FBQyxDQUFDO3lCQUNuQzt3QkFDRCxNQUFNO2lCQUNiO2FBQ0o7WUFFRCxpRUFBaUU7WUFDakUsSUFBSSxFQUFFLENBQUMsaUJBQWlCLENBQUMsUUFBUSxDQUFDLElBQUksQ0FBTyxXQUFXLENBQUMsUUFBUyxDQUFDLEdBQUcsQ0FBQyxFQUFFO2dCQUNyRSxZQUFZLEdBQUcsaUJBQWlCLENBQUMsR0FBRyxDQUFDLEdBQUcsQ0FBQyxDQUFDO2dCQUUxQyxJQUFJLEtBQUssQ0FBQyxPQUFPLENBQUMsWUFBWSxDQUFDLEVBQUU7b0JBQzdCLFFBQVEsQ0FBQyxZQUFZLENBQUMsQ0FBQztpQkFDMUI7YUFDSjtZQUVELDRDQUE0QztZQUM1QyxJQUFJLFdBQVc7Z0JBQ1gsRUFBRSxDQUFDLGlCQUFpQixDQUFDLFFBQVEsQ0FBQztnQkFDeEIsV0FBVyxDQUFDLFFBQVMsQ0FBQyxHQUFHLENBQUM7Z0JBQ2hDLFdBQVcsQ0FBQyxnQkFBZ0IsS0FBSyxTQUFTLEVBQUU7Z0JBQzVDLElBQUksT0FBTyxHQUFtRSxXQUFXLENBQUMsUUFBUyxDQUFDLEdBQUcsQ0FBQyxDQUFDO2dCQUN6RyxJQUFJLGFBQWEsR0FBa0MsV0FBVyxDQUFDLGdCQUFnQixDQUFDLEdBQUcsQ0FBQyxXQUFXLENBQUMsWUFBWSxDQUFDLENBQUMsVUFBVSxDQUFDLEdBQUcsQ0FBQyxDQUFDO2dCQUM5SCxJQUFJLENBQUMsY0FBYyxDQUFDLFFBQVEsRUFBRSxhQUFhLEVBQUUsT0FBTyxDQUFDLE9BQUssQ0FBQSxFQUFFLEVBQUUsYUFBYSxFQUFFLFdBQVcsQ0FBQyxhQUFhLEVBQUUsT0FBTyxFQUFFLE9BQU8sQ0FBQyxPQUFPLEVBQUUsQ0FBQyxDQUFDO2FBQ3ZJO1NBQ0o7UUFFRCxnQkFBZ0I7UUFDaEIsV0FBVyxDQUFDLElBQUksR0FBRyxLQUFLLENBQUM7SUFDN0IsQ0FBQztBQUNMLENBQUMsRUF4TGdCLElBQUksR0FBSixZQUFJLEtBQUosWUFBSSxRQXdMcEI7OztBQy9MRDtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EiLCJmaWxlIjoiZ2VuZXJhdGVkLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXNDb250ZW50IjpbIihmdW5jdGlvbigpe2Z1bmN0aW9uIHIoZSxuLHQpe2Z1bmN0aW9uIG8oaSxmKXtpZighbltpXSl7aWYoIWVbaV0pe3ZhciBjPVwiZnVuY3Rpb25cIj09dHlwZW9mIHJlcXVpcmUmJnJlcXVpcmU7aWYoIWYmJmMpcmV0dXJuIGMoaSwhMCk7aWYodSlyZXR1cm4gdShpLCEwKTt2YXIgYT1uZXcgRXJyb3IoXCJDYW5ub3QgZmluZCBtb2R1bGUgJ1wiK2krXCInXCIpO3Rocm93IGEuY29kZT1cIk1PRFVMRV9OT1RfRk9VTkRcIixhfXZhciBwPW5baV09e2V4cG9ydHM6e319O2VbaV1bMF0uY2FsbChwLmV4cG9ydHMsZnVuY3Rpb24ocil7dmFyIG49ZVtpXVsxXVtyXTtyZXR1cm4gbyhufHxyKX0scCxwLmV4cG9ydHMscixlLG4sdCl9cmV0dXJuIG5baV0uZXhwb3J0c31mb3IodmFyIHU9XCJmdW5jdGlvblwiPT10eXBlb2YgcmVxdWlyZSYmcmVxdWlyZSxpPTA7aTx0Lmxlbmd0aDtpKyspbyh0W2ldKTtyZXR1cm4gb31yZXR1cm4gcn0pKCkiLCJpbXBvcnQga25vY2tvdXQsIHsgT2JzZXJ2YWJsZSwgUHVyZUNvbXB1dGVkIH0gZnJvbSAna25vY2tvdXQnO1xuaW1wb3J0IHsgZmlyZXN0b3JlIH0gZnJvbSAnZmlyZWJhc2UnO1xuaW1wb3J0IHsgbWVyZ2VPYmplY3RzIH0gZnJvbSAnLi9oZWxwZXJzJztcblxuZGVjbGFyZSB2YXIga286IHR5cGVvZiBrbm9ja291dDsgLyogYWxpYXMgdGhlIG5hbWVzcGFjZSB0byBhdm9pZCBpbXBvcnRpbmcgdGhlIG1vZHVsZSwgYnV0IHN0aWxsIHVzZSB0aGUgdHlwaW5ncyAqL1xuXG5leHBvcnQgdHlwZSBCaW5kYWJsZTxUPiA9IE1vZGVsRXh0ZW5zaW9ucyAmIFQ7XG5cbmV4cG9ydCBjbGFzcyBNb2RlbEV4dGVuc2lvbnMge1xuICAgIGZzRG9jdW1lbnRJZD86IHN0cmluZztcbiAgICBmc0Jhc2VDb2xsZWN0aW9uPzogZmlyZXN0b3JlLkNvbGxlY3Rpb25SZWZlcmVuY2U7XG4gICAgaW5jbHVkZXM/OiB7IHByb3BlcnR5OiB7IGNsYXNzOiBuZXcgKCkgPT4gYW55LCBvcmRlckJ5OiBzdHJpbmdbXSB8IHN0cmluZ1tdW10gfSB9O1xuICAgIGxvY2s6IGJvb2xlYW47XG4gICAgdHdvV2F5QmluZGluZzogYm9vbGVhbjtcbiAgICBzdGF0ZTogT2JzZXJ2YWJsZTxudW1iZXI+O1xuICAgIG1vZGlmaWVkOiBQdXJlQ29tcHV0ZWQ8Ym9vbGVhbj47IC8qIFdoeSBpcyB0aGlzIGhpZGRlbiBhZ2Fpbj8gKi9cblxuICAgIGNvbnN0cnVjdG9yKCkge1xuICAgICAgICB0aGlzLmxvY2sgPSBmYWxzZTtcbiAgICAgICAgdGhpcy50d29XYXlCaW5kaW5nID0gdHJ1ZTtcblxuICAgICAgICB0aGlzLnN0YXRlID0ga28ub2JzZXJ2YWJsZSgwKTsgLyogVU5DSEFOR0VEICovXG4gICAgICAgIHRoaXMubW9kaWZpZWQgPSBrby5wdXJlQ29tcHV0ZWQoKCk6IGJvb2xlYW4gPT4ge1xuICAgICAgICAgICAgcmV0dXJuIHRoaXMuc3RhdGUoKSAhPSAwO1xuICAgICAgICB9KTtcblxuICAgICAgICAvKiBEb24ndCB1c2UgZGVjb3JhdG9ycyBvciBlbmQgdXAgaW4gUHJvdG90eXBlIEhlbGwgKi9cbiAgICAgICAgT2JqZWN0LmRlZmluZVByb3BlcnR5KHRoaXMsICdzdGF0ZScsIHtcbiAgICAgICAgICAgIGVudW1lcmFibGU6IGZhbHNlLFxuICAgICAgICAgICAgY29uZmlndXJhYmxlOiBmYWxzZSxcbiAgICAgICAgICAgIHdyaXRhYmxlOiBmYWxzZVxuICAgICAgICB9KTtcblxuICAgICAgICBPYmplY3QuZGVmaW5lUHJvcGVydHkodGhpcywgJ21vZGlmaWVkJywge1xuICAgICAgICAgICAgZW51bWVyYWJsZTogZmFsc2UsXG4gICAgICAgICAgICBjb25maWd1cmFibGU6IGZhbHNlLFxuICAgICAgICAgICAgd3JpdGFibGU6IGZhbHNlXG4gICAgICAgIH0pO1xuICAgIH1cblxuICAgIGdldEZsYXREb2N1bWVudCgpOiBhbnkge1xuICAgICAgICBsZXQgZG9jdW1lbnQ6IGFueSA9IHt9O1xuXG4gICAgICAgIC8qIGVudW1lcmF0ZSB1c2luZyBrZXlzKCkgYW5kIGZpbHRlciBvdXQgcHJvdG95cGUgZnVuY3Rpb25zIHdpdGggaGFzT3duUHJvcGVydHkoKSBpbiBzdGVhZCBvZiB1c2luZyBcbiAgICAgICAgICogZ2V0T3duUHJvcGVydHlOYW1lcygpLCBiZWNhdXNlIHRoZSBsYXR0ZXIgYWxzbyByZXR1cm5zIG5vbi1lbnVtZXJhYmxlcyAqL1xuICAgICAgICBmb3IgKGxldCBrZXkgb2YgT2JqZWN0LmtleXModGhpcykpIHtcbiAgICAgICAgICAgIGlmICghdGhpcy5oYXNPd25Qcm9wZXJ0eShrZXkpKSBjb250aW51ZTtcblxuICAgICAgICAgICAgbGV0IHByb3BlcnR5OiBhbnkgPSAoPGFueT50aGlzKVtrZXldO1xuXG4gICAgICAgICAgICAvKiBmbGF0dGVuIHByb3BlcnRpZXMsIGV4Y2VwdCBjb21wdXRlZCBhbmQgZGVlcCBpbmNsdWRlcyAqL1xuICAgICAgICAgICAgaWYgKGtvLmlzT2JzZXJ2YWJsZShwcm9wZXJ0eSkgJiZcbiAgICAgICAgICAgICAgICAha28uaXNDb21wdXRlZChwcm9wZXJ0eSkgJiZcbiAgICAgICAgICAgICAgICAhKDxhbnk+dGhpcy5pbmNsdWRlcylba2V5XSkge1xuICAgICAgICAgICAgICAgIGxldCBwcm9wZXJ0eVZhbHVlOiBhbnk7XG4gICAgICAgICAgICAgICAgaWYgKHR5cGVvZiBwcm9wZXJ0eSgpID09PSAnYm9vbGVhbicgfHwgdHlwZW9mIHByb3BlcnR5KCkgPT09ICdudW1iZXInKSB7XG4gICAgICAgICAgICAgICAgICAgIHByb3BlcnR5VmFsdWUgPSBwcm9wZXJ0eSgpOyAvKiAwIG9yIGZhbHNlIHNob3VsZCBqdXN0IGJlIGluc2VydGVkIGFzIGEgdmFsdWUgKi9cbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgIHByb3BlcnR5VmFsdWUgPSBwcm9wZXJ0eSgpIHx8ICcnOyAvKiBidXQgbm90IG51bGwsIHVuZGVmaW5lZCBvciB0aGUgbGlrZXMgKi9cbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICBkb2N1bWVudFtrZXldID0gcHJvcGVydHlWYWx1ZTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIHJldHVybiBkb2N1bWVudDtcbiAgICB9XG5cbiAgICBzYXZlKCk6IHZvaWQge1xuICAgICAgICBpZiAodGhpcy5zdGF0ZSgpID09IDApIHtcbiAgICAgICAgICAgIC8vbG9nZ2luZy5kZWJ1ZygnRmlyZXN0b3JlIGRvY3VtZW50ICcgKyB0aGlzLmZzRG9jdW1lbnRJZCArICcgdW5jaGFuZ2VkJyk7XG4gICAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cblxuICAgICAgICBpZiAodGhpcy5mc0Jhc2VDb2xsZWN0aW9uID09PSB1bmRlZmluZWQpIHtcbiAgICAgICAgICAgIC8vbG9nZ2luZy5lcnJvcignRmlyZXN0b3JlIGRvY3VtZW50ICcgKyB0aGlzLmZzRG9jdW1lbnRJZCArICcgbm90IHBhcnQgb2YgYSBDb2xsZWN0aW9uJyk7XG4gICAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cblxuICAgICAgICBsZXQgdGhpc0RvY3VtZW50OiBhbnkgPSB0aGlzLmdldEZsYXREb2N1bWVudCgpO1xuXG4gICAgICAgIGlmICh0aGlzLnN0YXRlKCkgPT0gMSkgeyAvKiBORVcgKi9cbiAgICAgICAgICAgIHRoaXMuZnNCYXNlQ29sbGVjdGlvbi5hZGQodGhpc0RvY3VtZW50KS50aGVuKChkb2M6IGZpcmVzdG9yZS5Eb2N1bWVudFJlZmVyZW5jZSk6IHZvaWQgPT4ge1xuICAgICAgICAgICAgICAgIC8vbG9nZ2luZy5kZWJ1ZygnRmlyZXN0b3JlIGRvY3VtZW50ICcgKyBkb2MuaWQgKyAnIGFkZGVkIHRvIGRhdGFiYXNlJyk7XG4gICAgICAgICAgICAgICAgdGhpcy5mc0RvY3VtZW50SWQgPSBkb2MuaWQ7XG4gICAgICAgICAgICAgICAgaWYgKHRoaXMuc3RhdGUoKSA9PSAyKSB7IC8qIGRvY3VtZW50IHdhcyBtb2RpZmllZCB3aGlsZSBzYXZpbmcgKi9cbiAgICAgICAgICAgICAgICAgICAgLy9sb2dnaW5nLmRlYnVnKCdGaXJlc3RvcmUgZG9jdW1lbnQgJyArIGRvYy5pZCArICcgd2FzIG1vZGlmaWVkIGR1cmluZyBpbnNlcnQsIHNhdmUgY2hhbmdlcycpO1xuICAgICAgICAgICAgICAgICAgICB0aGlzLnNhdmUoKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgIHRoaXMuc3RhdGUoMCk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSkuY2F0Y2goKGVycm9yOiBhbnkpOiB2b2lkID0+IHtcbiAgICAgICAgICAgICAgICAvL2xvZ2dpbmcuZXJyb3IoJ0Vycm9yIGFkZGluZyBGaXJlc3RvcmUgZG9jdW1lbnQgOicsIGVycm9yKTtcbiAgICAgICAgICAgIH0pO1xuICAgICAgICB9XG4gICAgICAgIGVsc2UgaWYgKHRoaXMuc3RhdGUoKSA9PSAyKSB7IC8qIE1PRElGSUVEICovXG4gICAgICAgICAgICB0aGlzLmZzQmFzZUNvbGxlY3Rpb24uZG9jKHRoaXMuZnNEb2N1bWVudElkKS51cGRhdGUodGhpc0RvY3VtZW50KS50aGVuKCgpOiB2b2lkID0+IHtcbiAgICAgICAgICAgICAgICAvL2xvZ2dpbmcuZGVidWcoJ0ZpcmVzdG9yZSBkb2N1bWVudCAnICsgdGhpcy5mc0RvY3VtZW50SWQgKyAnIHNhdmVkIHRvIGRhdGFiYXNlJyk7XG4gICAgICAgICAgICAgICAgdGhpcy5zdGF0ZSgwKTtcbiAgICAgICAgICAgIH0pLmNhdGNoKChlcnJvcjogYW55KTogdm9pZCA9PiB7XG4gICAgICAgICAgICAgICAgLy9sb2dnaW5nLmVycm9yKCdFcnJvciBzYXZpbmcgRmlyZXN0b3JlIGRvY3VtZW50IDonLCBlcnJvcik7XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgfVxuICAgICAgICBlbHNlIGlmICh0aGlzLnN0YXRlKCkgPT0gMykgeyAvKiBERUxFVEVEICovXG4gICAgICAgICAgICB0aGlzLmZzQmFzZUNvbGxlY3Rpb24uZG9jKHRoaXMuZnNEb2N1bWVudElkKS5kZWxldGUoKS50aGVuKCgpOiB2b2lkID0+IHtcbiAgICAgICAgICAgICAgICAvL2xvZ2dpbmcuZGVidWcoJ0ZpcmVzdG9yZSBkb2N1bWVudCAnICsgdGhpcy5mc0RvY3VtZW50SWQgKyAnIGRlbGV0ZWQgZnJvbSBkYXRhYmFzZScpO1xuICAgICAgICAgICAgfSkuY2F0Y2goKGVycm9yOiBhbnkpOiB2b2lkID0+IHtcbiAgICAgICAgICAgICAgICAvL2xvZ2dpbmcuZXJyb3IoJ0Vycm9yIHNhdmluZyBGaXJlc3RvcmUgZG9jdW1lbnQgOicsIGVycm9yKTtcbiAgICAgICAgICAgIH0pO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgc2F2ZVByb3BlcnR5KHByb3BlcnR5OiBzdHJpbmcsIHZhbHVlOiBhbnkpOiB2b2lkIHtcbiAgICAgICAgbGV0IGRvYzogYW55ID0ge307XG5cbiAgICAgICAgaWYgKHR5cGVvZiB2YWx1ZSA9PSAnbnVtYmVyJyB8fFxuICAgICAgICAgICAgdHlwZW9mIHZhbHVlID09ICdzdHJpbmcnIHx8XG4gICAgICAgICAgICB0eXBlb2YgdmFsdWUgPT0gJ2Jvb2xlYW4nKSB7XG4gICAgICAgICAgICBkb2NbcHJvcGVydHldID0gdmFsdWU7XG4gICAgICAgIH1cbiAgICAgICAgZWxzZSBpZiAoQXJyYXkuaXNBcnJheSh2YWx1ZSkpIHsgLyogb25seSBzZXJpYWxpemUgbm9uLWNvbXBsZXggZWxlbWVudHMuLiBUT0RPOiBzZXJpYWxpemUga25vY2tvdXQgb2JzZXJ2YWJsZXMgKi9cbiAgICAgICAgICAgIGRvY1twcm9wZXJ0eV0gPSB2YWx1ZS5maWx0ZXIoKHZhbHVlOiBhbnkpID0+IHtcbiAgICAgICAgICAgICAgICByZXR1cm4gdHlwZW9mIHZhbHVlID09ICdudW1iZXInIHx8XG4gICAgICAgICAgICAgICAgICAgIHR5cGVvZiB2YWx1ZSA9PSAnc3RyaW5nJyB8fFxuICAgICAgICAgICAgICAgICAgICB0eXBlb2YgdmFsdWUgPT0gJ2Jvb2xlYW4nO1xuICAgICAgICAgICAgfSk7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAodGhpcy5mc0Jhc2VDb2xsZWN0aW9uID09PSB1bmRlZmluZWQpIHtcbiAgICAgICAgICAgIC8vbG9nZ2luZy5lcnJvcignRmlyZXN0b3JlIGRvY3VtZW50ICcgKyB0aGlzLmZzRG9jdW1lbnRJZCArICcgbm90IHBhcnQgb2YgYSBDb2xsZWN0aW9uJyk7XG4gICAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cblxuICAgICAgICAvKiBpdCBjYW4gaGFwcGVuIHRoYXQgYSBwcm9wZXJ0eSBjaGFuZ2UgdHJpZ2dlcnMgc2F2ZVByb3BlcnR5LFxuICAgICAgICAgKiB3aGlsZSB0aGUgZG9jdW1lbnQgaXMgbm90IHlldCBwcm9wZXJseSBzYXZlZCBpbiBGaXJlc3RvcmUgYW5kXG4gICAgICAgICAqIGhhcyBubyBmc0RvY3VtZW50SWQgeWV0LiBJbiB0aGF0IGNhc2UgZG9uJ3Qgc2F2ZSB0byBGaXJlc3RvcmUsXG4gICAgICAgICAqIGJ1dCByZWNvcmQgdGhlIGNoYW5nZSBhbmQgbWFyayB0aGlzIGRvY3VtZW50IE1PRElGSUVEICovXG4gICAgICAgIGlmICh0eXBlb2YgdGhpcy5mc0RvY3VtZW50SWQgPT09ICd1bmRlZmluZWQnKSB7XG4gICAgICAgICAgICB0aGlzLnN0YXRlKDIpOyAvLyBNT0RJRklFRFxuICAgICAgICB9XG4gICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgdGhpcy5mc0Jhc2VDb2xsZWN0aW9uLmRvYyh0aGlzLmZzRG9jdW1lbnRJZCkudXBkYXRlKGRvYykudGhlbigoKTogdm9pZCA9PiB7XG4gICAgICAgICAgICAgICAgLy9sb2dnaW5nLmRlYnVnKCdGaXJlc3RvcmUgZG9jdW1lbnQgJyArIHRoaXMuZnNEb2N1bWVudElkICsgJyBzYXZlZCB0byBkYXRhYmFzZScpO1xuICAgICAgICAgICAgfSkuY2F0Y2goKGVycm9yOiBhbnkpOiB2b2lkID0+IHtcbiAgICAgICAgICAgICAgICAvL2xvZ2dpbmcuZXJyb3IoJ0Vycm9yIHNhdmluZyBGaXJlc3RvcmUgZG9jdW1lbnQgOicsIGVycm9yKTtcbiAgICAgICAgICAgIH0pO1xuICAgICAgICB9XG4gICAgfVxufVxuXG4vKipcbiAqIENyZWF0ZXMgYSBiaW5kYWJsZSBmcm9tIHRoZSBnaXZlbiBvYmplY3QgYW5kIG9wdGlvbmFsbHkgdGhlIGRlZXAgaW5jbHVkZXNcbiAqIChuYXZpZ2F0aW9uIHByb3BlcnRpZXMpXG4gKiBAcGFyYW0gbW9kZWwgdGhlIG9iamVjdCB0byBiZSBtYWRlIGJpbmRhYmxlXG4gKiBAcGFyYW0gaW5jbHVkZXMgKG9wdGlvbmFsKSB0aGUgZGVlcCBpbmNsdWRlcyBmb3IgZWFnZXIgbG9hZGluZ1xuICovXG5leHBvcnQgZnVuY3Rpb24gY3JlYXRlQmluZGFibGU8VD4obW9kZWw6IFQsIGluY2x1ZGVzPzogYW55KTogQmluZGFibGU8VD4ge1xuXG4gICAgbGV0IGV4dGVuc2lvbiA9IG5ldyBNb2RlbEV4dGVuc2lvbnMoKTtcblxuICAgIGxldCBiaW5kYWJsZU1vZGVsOiBCaW5kYWJsZTxUPiA9IG1lcmdlT2JqZWN0cyhtb2RlbCwgZXh0ZW5zaW9uKTtcblxuICAgIGJpbmRhYmxlTW9kZWwuaW5jbHVkZXMgPSBPYmplY3QuYXNzaWduKGluY2x1ZGVzIHx8IHt9LCBiaW5kYWJsZU1vZGVsLmluY2x1ZGVzKTtcblxuICAgIC8qIHN1YnNjcmliZSB0byB0aGUgS25vY2tvdXQgY2hhbmdlc1xuICAgICAqIGVudW1lcmF0ZSB1c2luZyBrZXlzKCkgYW5kIGZpbHRlciBvdXQgcHJvdG95cGUgZnVuY3Rpb25zIHdpdGggaGFzT3duUHJvcGVydHkoKSBpbiBzdGVhZCBvZiB1c2luZyBcbiAgICAgKiBnZXRPd25Qcm9wZXJ0eU5hbWVzKCksIGJlY2F1c2UgdGhlIGxhdHRlciBhbHNvIHJldHVybnMgbm9uLWVudW1lcmFibGVzICovXG4gICAgZm9yIChsZXQga2V5IG9mIE9iamVjdC5rZXlzKGJpbmRhYmxlTW9kZWwpKSB7XG4gICAgICAgIGlmICghYmluZGFibGVNb2RlbC5oYXNPd25Qcm9wZXJ0eShrZXkpKSBjb250aW51ZTtcblxuICAgICAgICBsZXQgcHJvcGVydHk6IGFueSA9ICg8YW55PmJpbmRhYmxlTW9kZWwpW2tleV07XG5cbiAgICAgICAgLyogQmluZCBsaXN0ZW5lcnMgdG8gdGhlIHByb3BlcnRpZXMgKi9cbiAgICAgICAgaWYgKGtvLmlzT2JzZXJ2YWJsZShwcm9wZXJ0eSkgJiZcbiAgICAgICAgICAgICgha28uaXNPYnNlcnZhYmxlQXJyYXkocHJvcGVydHkpIHx8ICEoPGFueT5iaW5kYWJsZU1vZGVsLmluY2x1ZGVzKVtrZXldKSAmJlxuICAgICAgICAgICAgIWtvLmlzQ29tcHV0ZWQocHJvcGVydHkpKSB7XG4gICAgICAgICAgICAoKGVsZW1lbnROYW1lOiBzdHJpbmcpOiB2b2lkID0+IHtcbiAgICAgICAgICAgICAgICBwcm9wZXJ0eS5zdWJzY3JpYmUoKHZhbHVlOiBhbnkpOiB2b2lkID0+IHtcbiAgICAgICAgICAgICAgICAgICAgLy9sb2dnaW5nLmRlYnVnKCdLbm9ja291dCBvYnNlcnZhYmxlIHByb3BlcnR5IFwiJyArIGVsZW1lbnROYW1lICsgJ1wiIGNoYW5nZWQuIExvY2FsT25seTogJyArIGJpbmRhYmxlTW9kZWwubG9jayk7XG5cbiAgICAgICAgICAgICAgICAgICAgLyogaWdub3JlIHVwZGF0ZXMgdHJpZ2dlcmVkIGJ5IGluY29taW5nIGNoYW5nZXMgZnJvbSBGaXJlYmFzZSAqL1xuICAgICAgICAgICAgICAgICAgICBpZiAoIWJpbmRhYmxlTW9kZWwubG9jaykge1xuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKGJpbmRhYmxlTW9kZWwudHdvV2F5QmluZGluZykge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGJpbmRhYmxlTW9kZWwuc2F2ZVByb3BlcnR5KGVsZW1lbnROYW1lLCB2YWx1ZSk7XG4gICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICBlbHNlIGlmIChiaW5kYWJsZU1vZGVsLnN0YXRlKCkgIT0gMSkgeyAvKiBpZiBzdGF0ZSBpcyBORVcga2VlcCBpdCBpbiB0aGlzIHN0YXRlIHVudGlsbCBpdCBpcyBzYXZlZCwgZXZlbiBpZiBpdCdzIG1vZGlmaWVkIGluIHRoZSBtZWFuIHRpbWUgKi9cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBiaW5kYWJsZU1vZGVsLnN0YXRlKDIpOyAvKiBNT0RJRklFRCAqL1xuICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICB9KShrZXkpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgcmV0dXJuIGJpbmRhYmxlTW9kZWw7XG59XG4iLCJpbXBvcnQga25vY2tvdXQsIHsgT2JzZXJ2YWJsZUFycmF5LCB1dGlscyB9IGZyb20gJ2tub2Nrb3V0JztcbmltcG9ydCB7IGZpcmVzdG9yZSB9IGZyb20gJ2ZpcmViYXNlJztcbmltcG9ydCB7IEJpbmRhYmxlLCBjcmVhdGVCaW5kYWJsZSwgTW9kZWxFeHRlbnNpb25zIH0gZnJvbSAnLi9CaW5kYWJsZSc7XG5pbXBvcnQgeyBtZXJnZU9iamVjdHMgfSBmcm9tICcuL2hlbHBlcnMnO1xuaW1wb3J0IHsga29mcyB9IGZyb20gJy4va25vY2tvdXQtZmlyZXN0b3JlJztcblxuZGVjbGFyZSB2YXIga286IHR5cGVvZiBrbm9ja291dDsgLyogYWxpYXMgdGhlIG5hbWVzcGFjZSB0byBhdm9pZCBpbXBvcnRpbmcgdGhlIG1vZHVsZSwgYnV0IHN0aWxsIHVzZSB0aGUgdHlwaW5ncyAqL1xuXG5leHBvcnQgdHlwZSBCaW5kYWJsZUFycmF5PFQ+ID0gT2JzZXJ2YWJsZUFycmF5PFQ+ICYgQXJyYXlFeHRlbnNpb25zPFQ+O1xuXG5leHBvcnQgY2xhc3MgQXJyYXlFeHRlbnNpb25zPFQ+IHtcbiAgICBmc1F1ZXJ5PzogZmlyZXN0b3JlLlF1ZXJ5O1xuICAgIGZzQ29sbGVjdGlvbj86IGZpcmVzdG9yZS5Db2xsZWN0aW9uUmVmZXJlbmNlO1xuICAgIGluY2x1ZGVzPzogeyBba2V5OiBzdHJpbmddOiB7IGNsYXNzOiBuZXcgKCkgPT4gYW55LCBvcmRlckJ5OiBzdHJpbmdbXSB8IHN0cmluZ1tdW10gfSB9O1xuICAgIGxvY2FsT25seTogYm9vbGVhbjtcbiAgICB0d29XYXlCaW5kaW5nOiBib29sZWFuO1xuXG4gICAgY29uc3RydWN0b3IoKSB7XG4gICAgICAgIHRoaXMubG9jYWxPbmx5ID0gZmFsc2U7XG4gICAgICAgIHRoaXMudHdvV2F5QmluZGluZyA9IGZhbHNlO1xuICAgIH1cblxuICAgIGdldERvY3VtZW50KGlkOiBzdHJpbmcpOiBCaW5kYWJsZTxUPiB8IG51bGwge1xuICAgICAgICAvKiBhc3N1bWUgJ3RoaXMnIGlzIG1lcmdlZCB3aXRoIGFuIE9ic2VydmFibGVBcnJheSAqL1xuICAgICAgICBsZXQgY29udGVudHM6IFRbXSA9ICg8QmluZGFibGVBcnJheTxUPj48dW5rbm93bj50aGlzKSgpO1xuXG4gICAgICAgIGZvciAobGV0IGRvYyBvZiBjb250ZW50cykge1xuICAgICAgICAgICAgLyogYXNzdW1lIGFsbCBkb2N1bWVudHMgYXJlIGNvbnZlcnRlZCB0byBCaW5kYWJsZSAqL1xuICAgICAgICAgICAgbGV0IGJpbmRhYmxlRG9jOiBCaW5kYWJsZTxUPiA9IDxCaW5kYWJsZTxUPj5kb2M7XG5cbiAgICAgICAgICAgIGlmIChiaW5kYWJsZURvYy5mc0RvY3VtZW50SWQgPT09IGlkKVxuICAgICAgICAgICAgICAgIHJldHVybiBiaW5kYWJsZURvYztcbiAgICAgICAgfVxuXG4gICAgICAgIHJldHVybiBudWxsO1xuICAgIH1cblxuICAgIGRldGFjaChpdGVtOiBUKTogdm9pZCB7XG4gICAgICAgIC8qIGFzc3VtZSAndGhpcycgaXMgbWVyZ2VkIHdpdGggYW4gT2JzZXJ2YWJsZUFycmF5ICovXG4gICAgICAgIGxldCBvYnNlcnZhYmxlQXJyYXk6IEJpbmRhYmxlQXJyYXk8VD4gPSAoPEJpbmRhYmxlQXJyYXk8VD4+PHVua25vd24+dGhpcyk7XG5cbiAgICAgICAgLyogaWYgdGhpcyBjb2xsZWN0aW9uIGlzIFR3by1XYXkgYm91bmQsIGp1c3QgZGVsZXRlICovXG4gICAgICAgIGlmIChvYnNlcnZhYmxlQXJyYXkudHdvV2F5QmluZGluZykge1xuICAgICAgICAgICAgb2JzZXJ2YWJsZUFycmF5LnJlbW92ZShpdGVtKTtcbiAgICAgICAgfVxuICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgIC8qIGFzc3VtZSBhbGwgaXRlbXMgYXJlIGNvbnZlcnRlZCB0byBCaW5kYWJsZSAqL1xuICAgICAgICAgICAgKDxCaW5kYWJsZTxUPj5pdGVtKS5zdGF0ZSgzKTsgLyogREVMRVRFRCAqL1xuXG4gICAgICAgICAgICAvKiB1c2UgS25vY2tvdXQncyBpbnRlcm5hbCBfZGVzdHJveSBwcm9wZXJ0eSB0byBmaWx0ZXIgdGhpcyBpdGVtIG91dCBvZiB0aGUgVUkgKi9cbiAgICAgICAgICAgIG9ic2VydmFibGVBcnJheS5kZXN0cm95KGl0ZW0pO1xuXG4gICAgICAgICAgICAvL2xvZ2dpbmcuZGVidWcoJ0RvY3VtZW50IFwiJyArIGl0ZW0uZnNEb2N1bWVudElkICsgJ1wiIGRldGFjaGVkIGZyb20gbG9jYWwgY29sbGVjdGlvbi4nKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIHNhdmVBbGwoKTogdm9pZCB7XG4gICAgICAgIC8qIGFzc3VtZSAndGhpcycgaXMgbWVyZ2VkIHdpdGggYW4gT2JzZXJ2YWJsZUFycmF5ICovXG4gICAgICAgIGxldCBjb250ZW50czogVFtdID0gKDxCaW5kYWJsZUFycmF5PFQ+Pjx1bmtub3duPnRoaXMpKCk7XG5cbiAgICAgICAgZm9yIChsZXQgaXRlbSBvZiBjb250ZW50cykge1xuICAgICAgICAgICAgLyogYXNzdW1lIGFsbCBpdGVtcyBhcmUgY29udmVydGVkIHRvIEJpbmRhYmxlICovXG4gICAgICAgICAgICBsZXQgYmluZGFibGVJdGVtOiBCaW5kYWJsZTxUPiA9IDxCaW5kYWJsZTxUPj5pdGVtXG5cbiAgICAgICAgICAgIGlmIChiaW5kYWJsZUl0ZW0uc3RhdGUoKSAhPT0gMCkge1xuICAgICAgICAgICAgICAgIGJpbmRhYmxlSXRlbS5zYXZlKCk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBjcmVhdGVCaW5kYWJsZUFycmF5PFQ+KGtvT2JzZXJ2YWJsZUFycmF5OiBPYnNlcnZhYmxlQXJyYXk8VD4pOiBCaW5kYWJsZUFycmF5PFQ+IHtcblxuICAgIGxldCBleHRlbnNpb246IEFycmF5RXh0ZW5zaW9uczxUPiA9IG5ldyBBcnJheUV4dGVuc2lvbnMoKTtcblxuICAgIGxldCBiaW5kYWJsZUFycmF5OiBCaW5kYWJsZUFycmF5PFQ+ID0gbWVyZ2VPYmplY3RzKGtvT2JzZXJ2YWJsZUFycmF5LCBleHRlbnNpb24pO1xuICAgIGJpbmRhYmxlQXJyYXkuc3Vic2NyaWJlPEJpbmRhYmxlQXJyYXk8VD4+KGNvbGxlY3Rpb25DaGFuZ2VkLCBiaW5kYWJsZUFycmF5LCAnYXJyYXlDaGFuZ2UnKTtcblxuICAgIHJldHVybiBiaW5kYWJsZUFycmF5O1xufVxuXG5mdW5jdGlvbiBjb2xsZWN0aW9uQ2hhbmdlZDxUPih0aGlzOiBBcnJheUV4dGVuc2lvbnM8VD4sIGNoYW5nZXM6IHV0aWxzLkFycmF5Q2hhbmdlczxUPikge1xuICAgIC8qIGlmIGxvY2FsIG9ubHkgY2hhbmdlIChlLmcuIHRyaWdnZXJlZCBieSBsb2FkIGZyb20gRmlyZXN0b3JlKSByZXR1cm4gKi9cbiAgICAvKiBhbHNvIHJldHVybiBpZiB0aGUgY29sbGVjdGlvbiBpcyBub3Qgc2V0LCB3aGljaCBzaG91bGQnbnQgYmUgYWJsZSB0byBoYXBwZW4sIGJ1dCB0byBzYXRpc2Z5IHRoZSB0eXBlIHN5c3RlbSwgY2hlY2sgZm9yIGl0ICovXG4gICAgaWYgKHRoaXMubG9jYWxPbmx5IHx8IHRoaXMuZnNDb2xsZWN0aW9uID09PSB1bmRlZmluZWQpIHsgcmV0dXJuOyB9XG5cbiAgICBmb3IgKGxldCBjaGFuZ2Ugb2YgY2hhbmdlcykge1xuICAgICAgICBsZXQgaXRlbTogVCA9IGNoYW5nZS52YWx1ZTtcblxuICAgICAgICBzd2l0Y2ggKGNoYW5nZS5zdGF0dXMpIHtcbiAgICAgICAgICAgIGNhc2UgJ2FkZGVkJzpcbiAgICAgICAgICAgICAgICAvKiBleHRlbmQgdGhlIE1vZGVsIHdpdGggdGhlIE9ic2VydmFibGVEb2N1bWVudCBmdW5jdGlvbmFsaXR5XG4gICAgICAgICAgICAgICAgICogZXh0ZW5kIC8gb3ZlcnJ1bGUgdGhlIGluY2x1ZGVzIHdpdGggaW5jbHVkZXMgZnJvbSBwYXNzZWQgb3B0aW9ucyAob25seSBvbmUgbGV2ZWwpICovXG4gICAgICAgICAgICAgICAgbGV0IGJpbmRhYmxlOiBCaW5kYWJsZTxUPiA9IGNyZWF0ZUJpbmRhYmxlKGl0ZW0sIHRoaXMuaW5jbHVkZXMpO1xuICAgICAgICAgICAgICAgIGJpbmRhYmxlLnR3b1dheUJpbmRpbmcgPSB0aGlzLnR3b1dheUJpbmRpbmc7XG5cbiAgICAgICAgICAgICAgICBpZiAodGhpcy50d29XYXlCaW5kaW5nKSB7XG4gICAgICAgICAgICAgICAgICAgIC8vbG9nZ2luZy5kZWJ1ZygnQWRkaW5nIG5ldyBkb2N1bWVudCB0byBGaXJlc3RvcmUgY29sbGVjdGlvbiBcIicgKyB0aGlzLmZzQ29sbGVjdGlvbi5pZCArICdcIicpO1xuXG4gICAgICAgICAgICAgICAgICAgIHRoaXMuZnNDb2xsZWN0aW9uLmFkZChiaW5kYWJsZS5nZXRGbGF0RG9jdW1lbnQoKSlcbiAgICAgICAgICAgICAgICAgICAgICAgIC50aGVuKChkb2M6IGZpcmVzdG9yZS5Eb2N1bWVudFJlZmVyZW5jZSk6IHZvaWQgPT4ge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGJpbmRhYmxlLmZzQmFzZUNvbGxlY3Rpb24gPSBkb2MucGFyZW50O1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGJpbmRhYmxlLmZzRG9jdW1lbnRJZCA9IGRvYy5pZDtcblxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIC8qIGdldCBkZWVwIGluY2x1ZGVzIGZvciBBcnJheSBwcm9wZXJ0aWVzIFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAqIFRPRE86IGZpeCB0aGF0IHRoZSBkZWVwIGxpbmtpbmcgaXMgZG9uZSBoZXJlIEFORCBpbiBleHBsb2RlT2JqZWN0IGluIGtub2Nrb3V0LmZpcmVzdG9yZS5qcyAqL1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNyZWF0ZUFuZEJpbmREZWVwSW5jbHVkZXMoYmluZGFibGUpO1xuICAgICAgICAgICAgICAgICAgICAgICAgfSkuY2F0Y2goZnVuY3Rpb24gKGVycm9yKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgLy9sb2dnaW5nLmVycm9yKCdFcnJvciBzYXZpbmcgRmlyZXN0b3JlIGRvY3VtZW50IDonLCBlcnJvcik7XG4gICAgICAgICAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgIC8vbG9nZ2luZy5kZWJ1ZygnQWRkaW5nIG5ldyBkb2N1bWVudCB0byBsb2NhbCBjb2xsZWN0aW9uIG9ubHknKTtcbiAgICAgICAgICAgICAgICAgICAgYmluZGFibGUuc3RhdGUoMSk7IC8qIE5FVyAqL1xuICAgICAgICAgICAgICAgICAgICBiaW5kYWJsZS5mc0Jhc2VDb2xsZWN0aW9uID0gdGhpcy5mc0NvbGxlY3Rpb247XG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICBjYXNlICdkZWxldGVkJzpcbiAgICAgICAgICAgICAgICBpZiAodGhpcy50d29XYXlCaW5kaW5nKSB7XG4gICAgICAgICAgICAgICAgICAgIC8vbG9nZ2luZy5kZWJ1ZygnRGVsZXRpbmcgZG9jdW1lbnQgXCInICsgaXRlbS5mc0RvY3VtZW50SWQgKyAnXCIgZnJvbSBGaXJlc3RvcmUgY29sbGVjdGlvbiBcIicgKyB0aGlzLmZzQ29sbGVjdGlvbi5pZCArICdcIicpO1xuXG4gICAgICAgICAgICAgICAgICAgIGxldCBiaW5kYWJsZTogQmluZGFibGU8VD4gPSA8QmluZGFibGU8VD4+aXRlbTtcblxuICAgICAgICAgICAgICAgICAgICBpZiAoYmluZGFibGUuZnNCYXNlQ29sbGVjdGlvbiA9PT0gdW5kZWZpbmVkKSB7IGNvbnRpbnVlOyB9IC8qIGNhbid0IGhhcHBlbiwgYnV0IHNhdGlzZnkgdGhlIHR5cGUgc3lzdGVtIGJ5IGNoZWNraW5nICovXG5cbiAgICAgICAgICAgICAgICAgICAgYmluZGFibGUuZnNCYXNlQ29sbGVjdGlvbi5kb2MoYmluZGFibGUuZnNEb2N1bWVudElkKVxuICAgICAgICAgICAgICAgICAgICAgICAgLmRlbGV0ZSgpXG4gICAgICAgICAgICAgICAgICAgICAgICAuY2F0Y2goKGVycm9yOiBhbnkpOiB2b2lkID0+IHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAvL2xvZ2dpbmcuZXJyb3IoJ0Vycm9yIGRlbGV0aW5nIEZpcmVzdG9yZSBkb2N1bWVudCA6JywgZXJyb3IpO1xuICAgICAgICAgICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICAvL2xvZ2dpbmcuZGVidWcoJ0RvY3VtZW50IFwiJyArIGl0ZW0uZnNEb2N1bWVudElkICsgJ1wiIHJlbW92ZWQgZnJvbSBsb2NhbCBjb2xsZWN0aW9uLicpO1xuICAgICAgICAgICAgICAgICAgICAvL2xvZ2dpbmcuZGVidWcoJ1lvdVxcJ3JlIG5vdCB1c2luZyBUd28tV2F5IGJpbmRpbmcsIHBsZWFzZSB1c2UgLmRldGFjaCgpIGluIHN0ZWFkIG9mIC5yZW1vdmUoKSB0byBwZXJzaXN0IHRoZSBjaGFuZ2Ugd2hlbiBzeW5jaW5nIHRvIEZpcmVzdG9yZScpO1xuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICB9XG4gICAgfVxufVxuXG5mdW5jdGlvbiBjcmVhdGVBbmRCaW5kRGVlcEluY2x1ZGVzPFQ+KGl0ZW06IEJpbmRhYmxlPFQ+KSB7XG4gICAgLyogZW51bWVyYXRlIHVzaW5nIGtleXMoKSBhbmQgZmlsdGVyIG91dCBwcm90b3lwZSBmdW5jdGlvbnMgd2l0aCBoYXNPd25Qcm9wZXJ0eSgpIGluIHN0ZWFkIG9mIHVzaW5nIFxuICAgICAqIGdldE93blByb3BlcnR5TmFtZXMoKSwgYmVjYXVzZSB0aGUgbGF0dGVyIGFsc28gcmV0dXJucyBub24tZW51bWVyYWJsZXMgKi9cbiAgICBmb3IgKGxldCBrZXkgb2YgT2JqZWN0LmtleXMoaXRlbSkpIHtcblxuICAgICAgICBpZiAoIWl0ZW0uaGFzT3duUHJvcGVydHkoa2V5KSB8fCBpdGVtLmZzQmFzZUNvbGxlY3Rpb24gPT09IHVuZGVmaW5lZCkgY29udGludWU7XG5cbiAgICAgICAgbGV0IHByb3BlcnR5ID0gKDxhbnk+aXRlbSlba2V5XTtcblxuICAgICAgICAvKiBnZXQgZGVlcCBpbmNsdWRlcyBmb3IgQXJyYXkgcHJvcGVydGllcyAqL1xuICAgICAgICBpZiAoa28uaXNPYnNlcnZhYmxlQXJyYXkocHJvcGVydHkpICYmIGl0ZW0uaW5jbHVkZXMgJiYgKDxhbnk+aXRlbS5pbmNsdWRlcylba2V5XSkge1xuICAgICAgICAgICAgbGV0IGluY2x1ZGUgPSAoPGFueT5pdGVtLmluY2x1ZGVzKVtrZXldO1xuICAgICAgICAgICAgbGV0IGNvbGxlY3Rpb25SZWYgPSBpdGVtLmZzQmFzZUNvbGxlY3Rpb25cbiAgICAgICAgICAgICAgICAuZG9jKGl0ZW0uZnNEb2N1bWVudElkKVxuICAgICAgICAgICAgICAgIC5jb2xsZWN0aW9uKGtleSk7XG5cbiAgICAgICAgICAgIGtvZnMuYmluZENvbGxlY3Rpb24ocHJvcGVydHksIGNvbGxlY3Rpb25SZWYsIGluY2x1ZGUuY2xhc3MsIHsgdHdvV2F5QmluZGluZzogaXRlbS50d29XYXlCaW5kaW5nLCBvcmRlckJ5OiBpbmNsdWRlLm9yZGVyQnkgfSk7XG5cbiAgICAgICAgICAgIC8qIGlmIHRoZSBjb2xsZWN0aW9uIHdhcyBsb2NhbGx5IGFscmVhZHkgZmlsbGVkIHdpdGggZGF0YSAqL1xuICAgICAgICAgICAgLyogVE9ETzogVHJhbnNhY3Rpb24gZm9yIHNwZWVkICovXG4gICAgICAgICAgICBmb3IgKGxldCBjaGlsZEl0ZW0gb2YgcHJvcGVydHkoKSkge1xuICAgICAgICAgICAgICAgIGxldCBiaW5kYWJsZUNoaWxkOiBNb2RlbEV4dGVuc2lvbnMgPSBjcmVhdGVCaW5kYWJsZShjaGlsZEl0ZW0sIHt9KTtcbiAgICAgICAgICAgICAgICBiaW5kYWJsZUNoaWxkLmZzQmFzZUNvbGxlY3Rpb24gPSBjb2xsZWN0aW9uUmVmO1xuICAgICAgICAgICAgICAgIGJpbmRhYmxlQ2hpbGQudHdvV2F5QmluZGluZyA9IGl0ZW0udHdvV2F5QmluZGluZztcbiAgICAgICAgICAgICAgICBiaW5kYWJsZUNoaWxkLnN0YXRlKDEpOyAvKiBORVcgKi9cbiAgICAgICAgICAgICAgICBiaW5kYWJsZUNoaWxkLnNhdmUoKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH1cbn0iLCJleHBvcnQgZnVuY3Rpb24gbWVyZ2VPYmplY3RzPFRUYXJnZXQsIFRTb3VyY2U+KHRhcmdldDogVFRhcmdldCwgc291cmNlOiBUU291cmNlKTogVFRhcmdldCAmIFRTb3VyY2Uge1xuXG4gICAgbGV0IG5ld1RhcmdldDogVFRhcmdldCAmIFRTb3VyY2UgPSA8VFRhcmdldCAmIFRTb3VyY2U+dGFyZ2V0O1xuICAgIGxldCBwU291cmNlOiBhbnkgPSBPYmplY3QuZ2V0UHJvdG90eXBlT2Yoc291cmNlKTtcbiAgICBcbiAgICBhZGRQcm90b3R5cGVUb0VuZE9mQ2hhaW4odGFyZ2V0LCBwU291cmNlKTtcblxuICAgIC8qIGNvcHkgdGhlIHByb3BlcnRpZXMgKG5vdCBvbiB0aGUgcHJvdG90eXBlIGNoYWluLCBidXQgaW5jbHVkaW5nIHRoZSBub24tZW51bWVyYWJsZSkgdG8gdGhlIHRhcmdldCAqL1xuICAgIGZvciAobGV0IGtleSBvZiBPYmplY3QuZ2V0T3duUHJvcGVydHlOYW1lcyhzb3VyY2UpKSB7XG4gICAgICAgIGxldCBkZXNjcmlwdG9yOiBQcm9wZXJ0eURlc2NyaXB0b3IgfCB1bmRlZmluZWQgPSBPYmplY3QuZ2V0T3duUHJvcGVydHlEZXNjcmlwdG9yKHNvdXJjZSwga2V5KTtcblxuICAgICAgICBpZiAoZGVzY3JpcHRvciAmJiAoIWRlc2NyaXB0b3Iud3JpdGFibGUgfHwgIWRlc2NyaXB0b3IuY29uZmlndXJhYmxlIHx8ICFkZXNjcmlwdG9yLmVudW1lcmFibGUgfHwgZGVzY3JpcHRvci5nZXQgfHwgZGVzY3JpcHRvci5zZXQpKSB7XG4gICAgICAgICAgICBPYmplY3QuZGVmaW5lUHJvcGVydHkodGFyZ2V0LCBrZXksIGRlc2NyaXB0b3IpO1xuICAgICAgICB9XG4gICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgKDxhbnk+dGFyZ2V0KVtrZXldID0gKDxhbnk+c291cmNlKVtrZXldO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgcmV0dXJuIG5ld1RhcmdldDtcbn1cblxuZnVuY3Rpb24gYWRkUHJvdG90eXBlVG9FbmRPZkNoYWluKGNoYWluOiBhbnksIHByb3RvdHlwZTogYW55KSB7XG4gICAgbGV0IHBUYXJnZXQ6IGFueSA9IE9iamVjdC5nZXRQcm90b3R5cGVPZihjaGFpbik7XG5cbiAgICBpZihwVGFyZ2V0ID09PSBwcm90b3R5cGUpIHsgIC8qIHByb3RvdHlwZSBhbHJlYWR5IGFkZGVkIHRvIHRoaXMgY2hhaW4gKi9cbiAgICB9XG4gICAgZWxzZSBpZihwVGFyZ2V0ID09PSBPYmplY3QucHJvdG90eXBlIHx8IHBUYXJnZXQgPT09IEZ1bmN0aW9uLnByb3RvdHlwZSkgeyAvKiBlbmQgb2YgY2hhaW46IGFkZCBwcm90b3R5cGUgKi9cbiAgICAgICAgT2JqZWN0LnNldFByb3RvdHlwZU9mKGNoYWluLCBwcm90b3R5cGUpO1xuICAgIH1cbiAgICBlbHNlIHsgLyogcmVjdXJzaXZlIGdvIGRvd24gY2hhaW4gKi9cbiAgICAgICAgYWRkUHJvdG90eXBlVG9FbmRPZkNoYWluKHBUYXJnZXQsIHByb3RvdHlwZSk7XG4gICAgfVxufSIsImltcG9ydCB7IGZpcmVzdG9yZSB9IGZyb20gJ2ZpcmViYXNlJztcbmltcG9ydCBrbm9ja291dCwgeyBPYnNlcnZhYmxlQXJyYXkgfSBmcm9tICdrbm9ja291dCc7XG5pbXBvcnQgeyBCaW5kYWJsZUFycmF5LCBjcmVhdGVCaW5kYWJsZUFycmF5IH0gZnJvbSAnLi9CaW5kYWJsZUFycmF5JztcbmltcG9ydCB7IEJpbmRhYmxlLCBjcmVhdGVCaW5kYWJsZSB9IGZyb20gJy4vQmluZGFibGUnO1xuXG5kZWNsYXJlIHZhciBrbzogdHlwZW9mIGtub2Nrb3V0OyAvKiBhbGlhcyB0aGUgbmFtZXNwYWNlIHRvIGF2b2lkIGltcG9ydGluZyB0aGUgbW9kdWxlLCBidXQgc3RpbGwgdXNlIHRoZSB0eXBpbmdzICovXG5cbmV4cG9ydCBuYW1lc3BhY2Uga29mcyB7XG4gICAgaW50ZXJmYWNlIEtvZnNPcHRpb25zIHtcbiAgICAgICAgd2hlcmU/OiBzdHJpbmdbXSB8IHN0cmluZ1tdW107XG4gICAgICAgIG9yZGVyQnk6IHN0cmluZ1tdIHwgc3RyaW5nW11bXTtcbiAgICAgICAgaW5jbHVkZXM/OiB7IFtrZXk6IHN0cmluZ106IHsgY2xhc3M6IG5ldyAoKSA9PiBhbnksIG9yZGVyQnk6IHN0cmluZ1tdIHwgc3RyaW5nW11bXSB9IH07XG4gICAgICAgIHR3b1dheUJpbmRpbmc6IGJvb2xlYW47XG4gICAgfVxuXG4gICAgZXhwb3J0IGZ1bmN0aW9uIGdldEJvdW5kQ29sbGVjdGlvbjxUPihmc0NvbGxlY3Rpb246IGZpcmVzdG9yZS5Db2xsZWN0aW9uUmVmZXJlbmNlLCBtb2RlbDogbmV3ICgpID0+IFQsIG9wdGlvbnM6IGFueSk6IEJpbmRhYmxlQXJyYXk8VD4ge1xuICAgICAgICAvKiBjcmVhdGUgdGhlIGNvbGxlY3Rpb24gYXMgYSBrby5vYnNlcnZhYmxlQXJyYXkgYW5kIGJpbmQgaXQgKi9cbiAgICAgICAgbGV0IG9ic2VydmFibGVBcnJheTogT2JzZXJ2YWJsZUFycmF5PFQ+ID0ga28ub2JzZXJ2YWJsZUFycmF5KCk7XG5cbiAgICAgICAgYmluZENvbGxlY3Rpb24ob2JzZXJ2YWJsZUFycmF5LCBmc0NvbGxlY3Rpb24sIG1vZGVsLCBvcHRpb25zKTtcblxuICAgICAgICByZXR1cm4gPEJpbmRhYmxlQXJyYXk8VD4+b2JzZXJ2YWJsZUFycmF5O1xuICAgIH1cblxuICAgIGV4cG9ydCBmdW5jdGlvbiBiaW5kQ29sbGVjdGlvbjxUPihvYnNlcnZhYmxlQXJyYXk6IE9ic2VydmFibGVBcnJheTxUPiwgZnNDb2xsZWN0aW9uOiBmaXJlc3RvcmUuQ29sbGVjdGlvblJlZmVyZW5jZSwgbW9kZWw6IG5ldyAoKSA9PiBULCBvcHRpb25zOiBLb2ZzT3B0aW9ucyk6IHZvaWQge1xuICAgICAgICAvKiBzZXR0aW5ncyAqL1xuICAgICAgICBvcHRpb25zID0gb3B0aW9ucyB8fCB7fTtcbiAgICAgICAgbGV0IHdoZXJlID0gb3B0aW9ucy53aGVyZSB8fCBbXTtcbiAgICAgICAgbGV0IG9yZGVyQnkgPSBvcHRpb25zLm9yZGVyQnkgfHwgW107XG4gICAgICAgIGxldCBpbmNsdWRlcyA9IG9wdGlvbnMuaW5jbHVkZXMgfHwge307XG4gICAgICAgIGxldCB0d29XYXlCaW5kaW5nOiBib29sZWFuID0gdHlwZW9mIG9wdGlvbnMudHdvV2F5QmluZGluZyA9PT0gJ3VuZGVmaW5lZCcgPyB0cnVlIDogb3B0aW9ucy50d29XYXlCaW5kaW5nO1xuXG4gICAgICAgIC8qIHNldCBsb2cgbGV2ZWwgKi9cbiAgICAgICAgLy9pZiAob3B0aW9ucy5sb2dMZXZlbCkgeyBsb2dnaW5nLnNldExvZ0xldmVsKG9wdGlvbnMubG9nTGV2ZWwpOyB9XG5cbiAgICAgICAgLyogY3JlYXRlIHRoZSBGaXJlc3RvcmUgcXVlcnkgZnJvbSB0aGUgY29sbGVjdGlvbiBhbmQgdGhlIG9wdGlvbnMgKi9cbiAgICAgICAgbGV0IHF1ZXJ5OiBmaXJlc3RvcmUuUXVlcnkgPSBjcmVhdGVGaXJlc3RvcmVRdWVyeSg8ZmlyZXN0b3JlLlF1ZXJ5PmZzQ29sbGVjdGlvbiwgd2hlcmUsIG9yZGVyQnkpO1xuXG4gICAgICAgIC8qIGV4dGVuZCB0aGUgb2JzZXJ2YWJsZUFycmF5IHdpdGggb3VyIGZ1bmN0aW9ucyAqL1xuICAgICAgICBsZXQgYmluZGFibGVBcnJheTogQmluZGFibGVBcnJheTxUPiA9IGNyZWF0ZUJpbmRhYmxlQXJyYXkob2JzZXJ2YWJsZUFycmF5KTtcbiAgICAgICAgYmluZGFibGVBcnJheS50d29XYXlCaW5kaW5nID0gdHdvV2F5QmluZGluZztcbiAgICAgICAgYmluZGFibGVBcnJheS5mc1F1ZXJ5ID0gcXVlcnk7XG4gICAgICAgIGJpbmRhYmxlQXJyYXkuZnNDb2xsZWN0aW9uID0gZnNDb2xsZWN0aW9uO1xuICAgICAgICBiaW5kYWJsZUFycmF5LmluY2x1ZGVzID0gaW5jbHVkZXM7XG5cbiAgICAgICAgLyogc3Vic2NyaWJlIHRvIHRoZSBGaXJlc3RvcmUgY29sbGVjdGlvbiAqL1xuICAgICAgICBxdWVyeS5vblNuYXBzaG90KChzbmFwc2hvdDogZmlyZXN0b3JlLlF1ZXJ5U25hcHNob3QpOiB2b2lkID0+IHtcbiAgICAgICAgICAgIHNuYXBzaG90LmRvY0NoYW5nZXMoKS5mb3JFYWNoKChjaGFuZ2U6IGZpcmVzdG9yZS5Eb2N1bWVudENoYW5nZSk6IHZvaWQgPT4ge1xuICAgICAgICAgICAgICAgIC8qIGlnbm9yZSBsb2NhbCBjaGFuZ2VzICovXG4gICAgICAgICAgICAgICAgaWYgKCFjaGFuZ2UuZG9jLm1ldGFkYXRhLmhhc1BlbmRpbmdXcml0ZXMpIHtcblxuICAgICAgICAgICAgICAgICAgICBpZiAoY2hhbmdlLnR5cGUgPT09ICdhZGRlZCcpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIC8vbG9nZ2luZy5kZWJ1ZygnRmlyZXN0b3JlIG9iamVjdCAnICsgY2hhbmdlLmRvYy5pZCArICcgYWRkZWQgdG8gY29sbGVjdGlvbicpO1xuICAgICAgICAgICAgICAgICAgICAgICAgbGV0IGl0ZW06IFQgJiB7IGluY2x1ZGVzPzogYW55IH0gPSBuZXcgbW9kZWwoKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGxldCBpbmRleDogbnVtYmVyID0gY2hhbmdlLm5ld0luZGV4O1xuXG4gICAgICAgICAgICAgICAgICAgICAgICAvKiBleHRlbmQgdGhlIE1vZGVsIHdpdGggdGhlIEJpbmRhYmxlIGZ1bmN0aW9uYWxpdHkgKi9cbiAgICAgICAgICAgICAgICAgICAgICAgIGxldCBjb21iaW5lZEluY2x1ZGVzID0gT2JqZWN0LmFzc2lnbihpbmNsdWRlcywgaXRlbS5pbmNsdWRlcyk7XG4gICAgICAgICAgICAgICAgICAgICAgICBsZXQgYmluZGFibGVJdGVtOiBCaW5kYWJsZTxUPiA9IGNyZWF0ZUJpbmRhYmxlKGl0ZW0sIGNvbWJpbmVkSW5jbHVkZXMpO1xuXG4gICAgICAgICAgICAgICAgICAgICAgICAvKiBmaWxsIHRoZSBuZXcgb2JqZWN0IHdpdGggbWV0YS1kYXRhXG4gICAgICAgICAgICAgICAgICAgICAgICAgKiBleHRlbmQgLyBvdmVycnVsZSB0aGUgaW5jbHVkZXMgd2l0aCBpbmNsdWRlcyBmcm9tIHRoZSBwYXNzZWQgb3B0aW9ucyAqL1xuICAgICAgICAgICAgICAgICAgICAgICAgYmluZGFibGVJdGVtLmZzQmFzZUNvbGxlY3Rpb24gPSBjaGFuZ2UuZG9jLnJlZi5wYXJlbnQ7XG4gICAgICAgICAgICAgICAgICAgICAgICBiaW5kYWJsZUl0ZW0uZnNEb2N1bWVudElkID0gY2hhbmdlLmRvYy5pZDtcbiAgICAgICAgICAgICAgICAgICAgICAgIGJpbmRhYmxlSXRlbS50d29XYXlCaW5kaW5nID0gdHdvV2F5QmluZGluZztcblxuICAgICAgICAgICAgICAgICAgICAgICAgLyogZXhwbG9kZSB0aGUgZGF0YSBBTkQgZGVlcCBpbmNsdWRlIGlmIHR3by13YXkgKi9cbiAgICAgICAgICAgICAgICAgICAgICAgIGV4cGxvZGVPYmplY3QoY2hhbmdlLmRvYywgYmluZGFibGVJdGVtLCB0d29XYXlCaW5kaW5nKTtcblxuICAgICAgICAgICAgICAgICAgICAgICAgLyogc2V0IHRoZSBjb2xsZWN0aW9uIHRvIGxvY2FsT25seSB0byBpZ25vcmUgdGhlc2UgaW5jb21pbmcgY2hhbmdlcyBmcm9tIEZpcmViYXNlICovXG4gICAgICAgICAgICAgICAgICAgICAgICBiaW5kYWJsZUFycmF5LmxvY2FsT25seSA9IHRydWU7XG4gICAgICAgICAgICAgICAgICAgICAgICBiaW5kYWJsZUFycmF5LnNwbGljZShpbmRleCwgMCwgYmluZGFibGVJdGVtKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGJpbmRhYmxlQXJyYXkubG9jYWxPbmx5ID0gZmFsc2U7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgaWYgKGNoYW5nZS50eXBlID09PSBcIm1vZGlmaWVkXCIpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIC8vbG9nZ2luZy5kZWJ1ZygnRmlyZXN0b3JlIG9iamVjdCAnICsgY2hhbmdlLmRvYy5pZCArICcgbW9kaWZpZWQnKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGxldCBsb2NhbERvYzogQmluZGFibGU8VD4gfCBudWxsID0gYmluZGFibGVBcnJheS5nZXREb2N1bWVudChjaGFuZ2UuZG9jLmlkKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmIChsb2NhbERvYyAhPSBudWxsKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgLyogZXhwbG9kZSB0aGUgZGF0YSwgYnV0IGRvbid0IG1lc3Mgd2l0aCB0aGUgZGVlcCBpbmNsdWRlcyAqL1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGV4cGxvZGVPYmplY3QoY2hhbmdlLmRvYywgbG9jYWxEb2MsIGZhbHNlKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIC8vbG9nZ2luZy5kZWJ1ZygnRmlyZXN0b3JlIG9iamVjdCAnICsgY2hhbmdlLmRvYy5pZCArICcgbm90IGZvdW5kIGluIGxvY2FsIGNvbGxlY3Rpb24nKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICBpZiAoY2hhbmdlLnR5cGUgPT09IFwicmVtb3ZlZFwiKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAvL2xvZ2dpbmcuZGVidWcoJ0ZpcmVzdG9yZSBvYmplY3QgJyArIGNoYW5nZS5kb2MuaWQgKyAnIHJlbW92ZWQgZnJvbSBjb2xsZWN0aW9uJyk7XG4gICAgICAgICAgICAgICAgICAgICAgICBsZXQgbG9jYWxEb2M6IEJpbmRhYmxlPFQ+IHwgbnVsbCA9IGJpbmRhYmxlQXJyYXkuZ2V0RG9jdW1lbnQoY2hhbmdlLmRvYy5pZCk7XG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAobG9jYWxEb2MgIT0gbnVsbCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGJpbmRhYmxlQXJyYXkubG9jYWxPbmx5ID0gdHJ1ZTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBiaW5kYWJsZUFycmF5LnJlbW92ZShsb2NhbERvYyk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgYmluZGFibGVBcnJheS5sb2NhbE9ubHkgPSBmYWxzZTtcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIC8qIHdoZW4gcmVtb3ZpbmcgZnJvbSBGaXJlc3RvcmUsIHRoZSBzbmFwc2hvdCBpcyB0cmlnZ2VyZWQsIHNvIGl0IHdpbGwgdHJ5IHRvIHJlbW92ZSBpdCBhZ2FpbiB3aGVuIGl0J3Mgbm8gbG9uZ2VyIHRoZXJlICovXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgLy9sb2dnaW5nLmRlYnVnKCdGaXJlc3RvcmUgb2JqZWN0ICcgKyBjaGFuZ2UuZG9jLmlkICsgJyBub3QgKGxvbmdlcikgZm91bmQgaW4gbG9jYWwgY29sbGVjdGlvbicpO1xuICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSk7XG4gICAgICAgIH0pO1xuICAgIH1cblxuICAgIGZ1bmN0aW9uIGNyZWF0ZUZpcmVzdG9yZVF1ZXJ5KGNvbGxlY3Rpb246IGZpcmVzdG9yZS5RdWVyeSwgd2hlcmU6IGFueSwgb3JkZXJCeTogYW55KSB7XG4gICAgICAgIC8qIGNvbnZlcnQgb3VyIHdoZXJlIGFuZCBvcmRlcmJ5IGFycmF5cyB0byByZWFsIEZpcmVzdG9yZSBxdWVyaWVzICovXG5cbiAgICAgICAgbGV0IHF1ZXJ5OiBmaXJlc3RvcmUuUXVlcnkgPSBjb2xsZWN0aW9uO1xuXG4gICAgICAgIGlmICh3aGVyZSAhPSBudWxsICYmIEFycmF5LmlzQXJyYXkod2hlcmUpICYmIHdoZXJlLmxlbmd0aCA+IDApIHtcbiAgICAgICAgICAgIGlmIChBcnJheS5pc0FycmF5KHdoZXJlWzBdKSkge1xuICAgICAgICAgICAgICAgIGZvciAobGV0IHdoZXJlQ2xhdXNlIG9mIHdoZXJlKSB7XG4gICAgICAgICAgICAgICAgICAgIHF1ZXJ5ID0gcXVlcnkud2hlcmUod2hlcmVDbGF1c2VbMF0sIHdoZXJlQ2xhdXNlWzFdLCB3aGVyZUNsYXVzZVsyXSk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICAgICAgcXVlcnkgPSBxdWVyeS53aGVyZSh3aGVyZVswXSwgd2hlcmVbMV0sIHdoZXJlWzJdKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIGlmIChvcmRlckJ5ICE9IG51bGwgJiYgQXJyYXkuaXNBcnJheShvcmRlckJ5KSAmJiBvcmRlckJ5Lmxlbmd0aCA+IDApIHtcbiAgICAgICAgICAgIGlmIChBcnJheS5pc0FycmF5KG9yZGVyQnlbMF0pKSB7XG4gICAgICAgICAgICAgICAgZm9yIChsZXQgb3JkZXJCeUNsYXVzZSBvZiBvcmRlckJ5KSB7XG4gICAgICAgICAgICAgICAgICAgIHF1ZXJ5ID0gcXVlcnkub3JkZXJCeShvcmRlckJ5Q2xhdXNlWzBdLCBvcmRlckJ5Q2xhdXNlWzFdKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgICAgICBxdWVyeSA9IHF1ZXJ5Lm9yZGVyQnkob3JkZXJCeVswXSwgb3JkZXJCeVsxXSk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm4gcXVlcnk7XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gZXhwbG9kZU9iamVjdDxUPihmaXJlc3RvcmVEb2N1bWVudDogZmlyZXN0b3JlLlF1ZXJ5RG9jdW1lbnRTbmFwc2hvdCwgbG9jYWxPYmplY3Q6IEJpbmRhYmxlPFQ+LCBkZWVwSW5jbHVkZTogYm9vbGVhbikge1xuICAgICAgICAvKiBkdXJpbmcgdXBkYXRlIHNldCBsb2NrIG9uIHRoZSBmaWxlLCBzbyB0aGVyZSB3aWxsIGJlIG5vIHVwZGF0ZSBsb29wICovXG4gICAgICAgIGxvY2FsT2JqZWN0LmxvY2sgPSB0cnVlO1xuXG4gICAgICAgIC8qIGVudW1lcmF0ZSB1c2luZyBrZXlzKCkgYW5kIGZpbHRlciBvdXQgcHJvdG95cGUgZnVuY3Rpb25zIHdpdGggaGFzT3duUHJvcGVydHkoKSBpbiBzdGVhZCBvZiB1c2luZyBcbiAgICAgICAgICogZ2V0T3duUHJvcGVydHlOYW1lcygpLCBiZWNhdXNlIHRoZSBsYXR0ZXIgYWxzbyByZXR1cm5zIG5vbi1lbnVtZXJhYmxlcyAqL1xuICAgICAgICBmb3IgKGxldCBrZXkgb2YgT2JqZWN0LmtleXMobG9jYWxPYmplY3QpKSB7XG4gICAgICAgICAgICBpZiAoIWxvY2FsT2JqZWN0Lmhhc093blByb3BlcnR5KGtleSkpIGNvbnRpbnVlO1xuXG4gICAgICAgICAgICBsZXQgcHJvcGVydHlEYXRhOiBhbnk7XG4gICAgICAgICAgICBsZXQgcHJvcGVydHk6IGFueSA9ICg8YW55PmxvY2FsT2JqZWN0KVtrZXldO1xuXG4gICAgICAgICAgICAvKiBnZXQgZGF0YSBmcm9tIEZpcmVzdG9yZSBmb3IgcHJpbWl0aXZlIHByb3BlcnRpZXMgKi9cbiAgICAgICAgICAgIGlmIChrby5pc09ic2VydmFibGUocHJvcGVydHkpICYmXG4gICAgICAgICAgICAgICAgIWtvLmlzT2JzZXJ2YWJsZUFycmF5KHByb3BlcnR5KSAmJlxuICAgICAgICAgICAgICAgICFrby5pc0NvbXB1dGVkKHByb3BlcnR5KSkge1xuXG4gICAgICAgICAgICAgICAgcHJvcGVydHlEYXRhID0gZmlyZXN0b3JlRG9jdW1lbnQuZ2V0KGtleSk7XG5cbiAgICAgICAgICAgICAgICBzd2l0Y2ggKHR5cGVvZiBwcm9wZXJ0eURhdGEpIHtcbiAgICAgICAgICAgICAgICAgICAgY2FzZSAndW5kZWZpbmVkJzpcbiAgICAgICAgICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgICAgICAgICBjYXNlICdzdHJpbmcnOlxuICAgICAgICAgICAgICAgICAgICBjYXNlICdudW1iZXInOlxuICAgICAgICAgICAgICAgICAgICBjYXNlICdib29sZWFuJzpcbiAgICAgICAgICAgICAgICAgICAgICAgIHByb3BlcnR5KHByb3BlcnR5RGF0YSk7XG4gICAgICAgICAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgICAgICAgICAgY2FzZSAnb2JqZWN0JzpcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmIChwcm9wZXJ0eURhdGEgJiYgdHlwZW9mIHByb3BlcnR5RGF0YS50b0RhdGUgPT09ICdmdW5jdGlvbicpIHsgLyogYXNzdW1lIEZpcmVzdG9yZS5UaW1lc3RhbXAgKi9cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBwcm9wZXJ0eShwcm9wZXJ0eURhdGEudG9EYXRlKCkpO1xuICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAvKiBnZXQgcmVndWxhciBhcnJheXMsIG9yIGFycmF5cyBub3QgbWFya2VkIGZvciBkZWVwIGluY2x1c2lvbiAqL1xuICAgICAgICAgICAgaWYgKGtvLmlzT2JzZXJ2YWJsZUFycmF5KHByb3BlcnR5KSAmJiAhKDxhbnk+bG9jYWxPYmplY3QuaW5jbHVkZXMpW2tleV0pIHtcbiAgICAgICAgICAgICAgICBwcm9wZXJ0eURhdGEgPSBmaXJlc3RvcmVEb2N1bWVudC5nZXQoa2V5KTtcblxuICAgICAgICAgICAgICAgIGlmIChBcnJheS5pc0FycmF5KHByb3BlcnR5RGF0YSkpIHtcbiAgICAgICAgICAgICAgICAgICAgcHJvcGVydHkocHJvcGVydHlEYXRhKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIC8qIGdldCBkZWVwIGluY2x1ZGVzIGZvciBBcnJheSBwcm9wZXJ0aWVzICovXG4gICAgICAgICAgICBpZiAoZGVlcEluY2x1ZGUgJiZcbiAgICAgICAgICAgICAgICBrby5pc09ic2VydmFibGVBcnJheShwcm9wZXJ0eSkgJiZcbiAgICAgICAgICAgICAgICAoPGFueT5sb2NhbE9iamVjdC5pbmNsdWRlcylba2V5XSAmJlxuICAgICAgICAgICAgICAgIGxvY2FsT2JqZWN0LmZzQmFzZUNvbGxlY3Rpb24gIT09IHVuZGVmaW5lZCkge1xuICAgICAgICAgICAgICAgIGxldCBpbmNsdWRlOiB7IGNsYXNzOiBuZXcgKCkgPT4gYW55LCBvcmRlckJ5OiBzdHJpbmdbXSB8IHN0cmluZ1tdW10gfSA9ICg8YW55PmxvY2FsT2JqZWN0LmluY2x1ZGVzKVtrZXldO1xuICAgICAgICAgICAgICAgIGxldCBjb2xsZWN0aW9uUmVmOiBmaXJlc3RvcmUuQ29sbGVjdGlvblJlZmVyZW5jZSA9IGxvY2FsT2JqZWN0LmZzQmFzZUNvbGxlY3Rpb24uZG9jKGxvY2FsT2JqZWN0LmZzRG9jdW1lbnRJZCkuY29sbGVjdGlvbihrZXkpO1xuICAgICAgICAgICAgICAgIGtvZnMuYmluZENvbGxlY3Rpb24ocHJvcGVydHksIGNvbGxlY3Rpb25SZWYsIGluY2x1ZGUuY2xhc3MsIHsgdHdvV2F5QmluZGluZzogbG9jYWxPYmplY3QudHdvV2F5QmluZGluZywgb3JkZXJCeTogaW5jbHVkZS5vcmRlckJ5IH0pO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgLyogcmVzZXQgbG9jayAqL1xuICAgICAgICBsb2NhbE9iamVjdC5sb2NrID0gZmFsc2U7XG4gICAgfVxufVxuIiwiJ3VzZSBzdHJpY3QnO1xuXG4vKiBleHBvc2UgdGhlIGxpYnJhcnkgdG8gdGhlIGdsb2JhbCBzY29wZSAqL1xudmFyIGxpYnJhcnkgPSByZXF1aXJlKCcuLi9kaXN0L2tub2Nrb3V0LWZpcmVzdG9yZScpO1xuXG53aW5kb3cua29mcyA9IGxpYnJhcnkua29mczsiXX0=
