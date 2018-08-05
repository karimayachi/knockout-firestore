'use strict';
var observable = require('./observableExtension');
var observableArray = require('./observableArrayExtension');
var logging = require('./logging');

exports.getBoundCollection = function (fsCollection, object, options) {
    /* settings */
    options = options || {};
    var logLevel = options.logLevel || 1;
    var where = options.where || [];
    var orderBy = options.orderBy || [];
    var twoWayBinding = typeof options.twoWayBinding === 'undefined' ? true : options.twoWayBinding;

    /* set log level */
    logging.setLogLevel(logLevel);

    /* create the Firestore query from the collection and the options */
    var query = createFirestoreQuery(fsCollection, where, orderBy);

    /* create the collection as a ko.observableArray and extend it with our functions */
    var collection = ko.observableArray();
    observableArray.extendObservableArray(collection);
    collection.twoWayBinding = twoWayBinding;
    collection.fsQuery = query;
    collection.fsCollection = fsCollection;
    
    /* subscribe to the Firestore collection */
    query.onSnapshot(function(snapshot) {
        snapshot.docChanges().forEach(function(change) {
            /* ignore local changes */
            if(!change.doc.metadata.hasPendingWrites) {

                if (change.type === "added") {
                    logging.debug('Firestore object ' + change.doc.id + ' added to collection');
                    var item = new object();
                    var index = change.newIndex;
                    
                    /* extend the Model with the ObservableDocument functionality */
                    observable.extendObservable(item);

                    /* fill the new object with data */
                    item.fsBaseCollection = change.doc.ref.parent;
                    item.fsDocumentId = change.doc.id;
                    item.twoWayBinding = twoWayBinding;
                    explodeObject(change.doc, item);
                    
                    /* set the collection to localOnly to ignore these changes loading from Firebase */
                    collection.localOnly = true;
                    collection.splice(index, 0, item);
                    collection.localOnly = false;
                }
                if (change.type === "modified") {
                    logging.debug('Firestore object ' + change.doc.id + ' modified');
                    var localDoc = collection.getDocument(change.doc.id);
                    if(localDoc != null) {
                        explodeObject(change.doc, localDoc);
                    }
                    else {
                        logging.debug('Firestore object ' + change.doc.id + ' not found in local collection');
                    }
                }
                if (change.type === "removed") {
                    logging.debug('Firestore object ' + change.doc.id + ' removed from collection');
                    var localDoc = collection.getDocument(change.doc.id);
                    if(localDoc != null) {
                        collection.localOnly = true;
                        collection.remove(localDoc);
                        collection.localOnly = false;
                    }
                    else {
                        /* when removing from Firestore, the snapshot is triggered, so it will try to remove it again when it's no longer there */
                        logging.debug('Firestore object ' + change.doc.id + ' not (longer) found in local collection');
                    }
                }

            }
        });
    });

    return collection;
}

function explodeObject(firestoreDocument, localObject) {
    /* during update set lock on the file, so there will be no update loop */
    localObject.lock = true;

    /* enumerate using keys() and filter out protoype functions with hasOwnProperty() in stead of using 
     * getOwnPropertyNames(), because the latter also returns non-enumerables */
    for(var index in Object.keys(localObject)) {
        var propertyName = Object.keys(localObject)[index];
        
        if(!localObject.hasOwnProperty(propertyName)) continue;

        var property = localObject[propertyName];

        if(ko.isObservable(property) && !ko.isComputed(property)) {
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