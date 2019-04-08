import { firestore } from 'firebase';
import ko, { ObservableArray } from 'knockout';
import { BindableArray } from './BindableArray';

export namespace kofs {

    export interface KofsOptions {
        where: string[] | string[][];
        orderBy: string[] | string[][];
        includes: { property: { class: string, orderBy: string[] | string[][] } };
        twoWayBinding: boolean;
    }

    export function getBoundCollection<T>(fsCollection: firestore.CollectionReference, object: new () => T, options: any): BindableArray<T> {
        /* create the collection as a ko.observableArray and bind it */
        let collection: BindableArray<T> = ko.observableArray();

        bindCollection(collection, fsCollection, object, options);

        return collection;
    }

    export function bindCollection<T>(observableArray: BindableArray<T>, fsCollection: firestore.CollectionReference, object: new () => T, options: KofsOptions): void {
        /* settings */
        options = options || {};
        let where = options.where || [];
        let orderBy = options.orderBy || [];
        let includes = options.includes || {};
        let twoWayBinding: boolean = typeof options.twoWayBinding === 'undefined' ? true : options.twoWayBinding;

        /* set log level */
        //if (options.logLevel) { logging.setLogLevel(options.logLevel); }

        /* create the Firestore query from the collection and the options */
        let query: firestore.Query = createFirestoreQuery(<firestore.Query>fsCollection, where, orderBy);

        /* extend the observableArray with our functions */
        observableArrayExtensions.extendObservableArray(observableArray);
        observableArray.twoWayBinding = twoWayBinding;
        observableArray.fsQuery = query;
        observableArray.fsCollection = fsCollection;
        observableArray.includes = includes;

        /* subscribe to the Firestore collection */
        query.onSnapshot(function (snapshot) {
            snapshot.docChanges().forEach(function (change) {
                /* ignore local changes */
                if (!change.doc.metadata.hasPendingWrites) {

                    if (change.type === "added") {
                        logging.debug('Firestore object ' + change.doc.id + ' added to collection');
                        var item = new object();
                        var index = change.newIndex;

                        /* extend the Model with the ObservableDocument functionality */
                        var combinedIncludes = Object.assign(includes, item.includes);
                        modelExtensions.extendObservable(item, combinedIncludes);

                        /* fill the new object with meta-data
                         * extend / overrule the includes with includes from the passed options */
                        item.fsBaseCollection = change.doc.ref.parent;
                        item.fsDocumentId = change.doc.id;
                        item.twoWayBinding = twoWayBinding;

                        /* explode the data AND deep include if two-way */
                        explodeObject(change.doc, item, twoWayBinding);

                        /* set the collection to localOnly to ignore these incoming changes from Firebase */
                        observableArray.localOnly = true;
                        observableArray.splice(index, 0, item);
                        observableArray.localOnly = false;
                    }
                    if (change.type === "modified") {
                        logging.debug('Firestore object ' + change.doc.id + ' modified');
                        var localDoc = observableArray.getDocument(change.doc.id);
                        if (localDoc != null) {
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
                        if (localDoc != null) {
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

    function createFirestoreQuery(collection: firestore.Query, where: any, orderBy: any) {
        /* convert our where and orderby arrays to real Firestore queries */
    
        let query: firestore.Query = collection;
    
        if (where != null && Array.isArray(where) && where.length > 0) {
            if (Array.isArray(where[0])) {
                for (let whereClause of where) {
                    query = query.where(whereClause[0], whereClause[1], whereClause[2]);
                }
            }
            else {
                query = query.where(where[0], where[1], where[2]);
            }
        }
    
        if (orderBy != null && Array.isArray(orderBy) && orderBy.length > 0) {
            if (Array.isArray(orderBy[0])) {
                for (let orderByClause of orderBy) {
                    query = query.orderBy(orderByClause[0], orderByClause[1]);
                }
            }
            else {
                query = query.orderBy(orderBy[0], orderBy[1]);
            }
        }
    
        return query;
    }
}


function explodeObject(firestoreDocument, localObject, deepInclude) {
    /* during update set lock on the file, so there will be no update loop */
    localObject.lock = true;

    /* enumerate using keys() and filter out protoype functions with hasOwnProperty() in stead of using 
     * getOwnPropertyNames(), because the latter also returns non-enumerables */
    for (var index in Object.keys(localObject)) {
        var propertyName = Object.keys(localObject)[index];
        var propertyData;

        if (!localObject.hasOwnProperty(propertyName)) continue;

        var property = localObject[propertyName];

        /* get data from Firestore for primitive properties */
        if (ko.isObservable(property) &&
            !ko.isObservableArray(property) &&
            !ko.isComputed(property)) {

            propertyData = firestoreDocument.get(propertyName);

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
        if (ko.isObservableArray(property) && !localObject.includes[propertyName]) {
            propertyData = firestoreDocument.get(propertyName);

            if (Array.isArray(propertyData)) {
                property(propertyData);
            }
        }

        /* get deep includes for Array properties */
        if (deepInclude &&
            ko.isObservableArray(property) &&
            localObject.includes[propertyName]) {
            var include = localObject.includes[propertyName];
            var collectionRef = localObject.fsBaseCollection.doc(localObject.fsDocumentId).collection(propertyName);
            kofs.bindCollection(property, collectionRef, include.class, { twoWayBinding: localObject.twoWayBinding, orderBy: include.orderBy });
        }
    }

    /* reset lock */
    localObject.lock = false;
}

