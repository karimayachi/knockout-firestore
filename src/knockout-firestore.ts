import { firestore } from 'firebase';
import * as ko from 'knockout';
import { ObservableArray } from 'knockout';
import { BindableArray, createBindableArray } from './BindableArray';
import { Bindable, createBindable } from './Bindable';

export interface KofsOptions {
    where?: string[] | string[][];
    orderBy: string[] | string[][];
    includes?: { [key: string]: { class: new () => any, orderBy: string[] | string[][] } };
    twoWayBinding: boolean;
}

export function getBoundCollection<T>(fsCollection: firestore.CollectionReference, model: new () => T, options: any): BindableArray<T> {
    /* create the collection as a ko.observableArray and bind it */
    let observableArray: ObservableArray<T> = ko.observableArray();

    bindCollection(observableArray, fsCollection, model, options);

    return <BindableArray<T>>observableArray;
}

export function bindCollection<T>(observableArray: ObservableArray<T>, fsCollection: firestore.CollectionReference, model: new () => T, options: KofsOptions): void {
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
    let bindableArray: BindableArray<T> = createBindableArray(observableArray);
    bindableArray.twoWayBinding = twoWayBinding;
    bindableArray.fsQuery = query;
    bindableArray.fsCollection = fsCollection;
    bindableArray.includes = includes;

    /* subscribe to the Firestore collection */
    query.onSnapshot((snapshot: firestore.QuerySnapshot): void => {
        snapshot.docChanges().forEach((change: firestore.DocumentChange): void => {
            /* ignore local changes */
            if (!change.doc.metadata.hasPendingWrites) {

                if (change.type === 'added') {
                    //logging.debug('Firestore object ' + change.doc.id + ' added to collection');
                    let item: T & { includes?: any } = new model();
                    let index: number = change.newIndex;

                    /* extend the Model with the Bindable functionality */
                    let combinedIncludes = Object.assign(includes, item.includes);
                    let bindableItem: Bindable<T> = createBindable(item, combinedIncludes);

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
                    let localDoc: Bindable<T> | null = bindableArray.getDocument(change.doc.id);
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
                    let localDoc: Bindable<T> | null = bindableArray.getDocument(change.doc.id);
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

function explodeObject<T>(firestoreDocument: firestore.QueryDocumentSnapshot, localObject: Bindable<T>, deepInclude: boolean) {
    /* during update set lock on the file, so there will be no update loop */
    localObject.lock = true;

    /* enumerate using keys() and filter out protoype functions with hasOwnProperty() in stead of using 
     * getOwnPropertyNames(), because the latter also returns non-enumerables */
    for (let key of Object.keys(localObject)) {
        if (!localObject.hasOwnProperty(key)) continue;

        let propertyData: any;
        let property: any = (<any>localObject)[key];

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
        if (ko.isObservableArray(property) && !(<any>localObject.includes)[key]) {
            propertyData = firestoreDocument.get(key);

            if (Array.isArray(propertyData)) {
                property(propertyData);
            }
        }

        /* get deep includes for Array properties */
        if (deepInclude &&
            ko.isObservableArray(property) &&
            (<any>localObject.includes)[key] &&
            localObject.fsBaseCollection !== undefined) {
            let include: { class: new () => any, orderBy: string[] | string[][] } = (<any>localObject.includes)[key];
            let collectionRef: firestore.CollectionReference = localObject.fsBaseCollection.doc(localObject.fsDocumentId).collection(key);
            bindCollection(property, collectionRef, include.class, { twoWayBinding: localObject.twoWayBinding, orderBy: include.orderBy });
        }
    }

    /* reset lock */
    localObject.lock = false;
}
