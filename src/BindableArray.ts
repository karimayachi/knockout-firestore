import * as ko from 'knockout';
import { ObservableArray, utils } from 'knockout';
import { firestore } from 'firebase';
import { Bindable, createBindable, ModelExtensions } from './Bindable';
import { mergeObjects } from './mergeObjects';
import { bindCollection } from './index';

export type BindableArray<T> = ObservableArray<T> & ArrayExtensions<T>;

export class ArrayExtensions<T> {
    fsQuery?: firestore.Query;
    fsCollection?: firestore.CollectionReference;
    includes?: { [key: string]: { class: new () => any, orderBy: string[] | string[][] } };
    localOnly: boolean;
    twoWayBinding: boolean;

    constructor() {
        this.localOnly = false;
        this.twoWayBinding = false;
        console.log('Hallo vanuit BindableArray.ts');
    }

    getDocument(id: string): Bindable<T> | null {
        /* assume 'this' is merged with an ObservableArray */
        let contents: T[] = (<BindableArray<T>><any>this)();

        for (let doc of contents) {
            /* assume all documents are converted to Bindable */
            let bindableDoc: Bindable<T> = <Bindable<T>>doc;

            if (bindableDoc.fsDocumentId === id)
                return bindableDoc;
        }

        return null;
    }

    detach(item: T): void {
        /* assume 'this' is merged with an ObservableArray */
        let observableArray: BindableArray<T> = (<BindableArray<T>><any>this);

        /* if this collection is Two-Way bound, just delete */
        if (observableArray.twoWayBinding) {
            observableArray.remove(item);
        }
        else {
            /* assume all items are converted to Bindable */
            (<Bindable<T>>item).state(3); /* DELETED */

            /* use Knockout's internal _destroy property to filter this item out of the UI */
            observableArray.destroy(item);

            //logging.debug('Document "' + item.fsDocumentId + '" detached from local collection.');
        }
    }

    saveAll(): void {
        /* assume 'this' is merged with an ObservableArray */
        let contents: T[] = (<BindableArray<T>><any>this)();

        for (let item of contents) {
            /* assume all items are converted to Bindable */
            let bindableItem: Bindable<T> = <Bindable<T>>item

            if (bindableItem.state() !== 0) {
                bindableItem.save();
            }
        }
    }
}

export function createBindableArray<T>(koObservableArray: ObservableArray<T>): BindableArray<T> {

    let extension: ArrayExtensions<T> = new ArrayExtensions();

    let bindableArray: BindableArray<T> = mergeObjects(koObservableArray, extension);
    bindableArray.subscribe<BindableArray<T>>(collectionChanged, bindableArray, 'arrayChange');

    return bindableArray;
}

function collectionChanged<T>(this: ArrayExtensions<T>, changes: utils.ArrayChanges<T>) {
    /* if local only change (e.g. triggered by load from Firestore) return */
    /* also return if the collection is not set, which should'nt be able to happen, but to satisfy the type system, check for it */
    if (this.localOnly || this.fsCollection === undefined) { return; }

    for (let change of changes) {
        let item: T = change.value;

        switch (change.status) {
            case 'added':
                /* extend the Model with the ObservableDocument functionality
                 * extend / overrule the includes with includes from passed options (only one level) */
                let bindable: Bindable<T> = createBindable(item, this.includes);
                bindable.twoWayBinding = this.twoWayBinding;

                if (this.twoWayBinding) {
                    //logging.debug('Adding new document to Firestore collection "' + this.fsCollection.id + '"');

                    this.fsCollection.add(bindable.getFlatDocument())
                        .then((doc: firestore.DocumentReference): void => {
                            bindable.fsBaseCollection = doc.parent;
                            bindable.fsDocumentId = doc.id;

                            /* get deep includes for Array properties 
                             * TODO: fix that the deep linking is done here AND in explodeObject in knockout.firestore.js */
                            createAndBindDeepIncludes(bindable);
                        }).catch(function (error) {
                            //logging.error('Error saving Firestore document :', error);
                        });
                }
                else {
                    //logging.debug('Adding new document to local collection only');
                    bindable.state(1); /* NEW */
                    bindable.fsBaseCollection = this.fsCollection;
                }

                break;
            case 'deleted':
                if (this.twoWayBinding) {
                    //logging.debug('Deleting document "' + item.fsDocumentId + '" from Firestore collection "' + this.fsCollection.id + '"');

                    let bindable: Bindable<T> = <Bindable<T>>item;

                    if (bindable.fsBaseCollection === undefined) { continue; } /* can't happen, but satisfy the type system by checking */

                    bindable.fsBaseCollection.doc(bindable.fsDocumentId)
                        .delete()
                        .catch((error: any): void => {
                            //logging.error('Error deleting Firestore document :', error);
                        });
                }
                else {
                    //logging.debug('Document "' + item.fsDocumentId + '" removed from local collection.');
                    //logging.debug('You\'re not using Two-Way binding, please use .detach() in stead of .remove() to persist the change when syncing to Firestore');
                }

                break;
        }
    }
}

function createAndBindDeepIncludes<T>(item: Bindable<T>) {
    /* enumerate using keys() and filter out protoype functions with hasOwnProperty() in stead of using 
     * getOwnPropertyNames(), because the latter also returns non-enumerables */
    for (let key of Object.keys(item)) {

        if (!item.hasOwnProperty(key) || item.fsBaseCollection === undefined) continue;

        let property = (<any>item)[key];

        /* get deep includes for Array properties */
        if (ko.isObservableArray(property) && item.includes && (<any>item.includes)[key]) {
            let include = (<any>item.includes)[key];
            let collectionRef = item.fsBaseCollection
                .doc(item.fsDocumentId)
                .collection(key);

            bindCollection(property, collectionRef, include.class, { twoWayBinding: item.twoWayBinding, orderBy: include.orderBy });

            /* if the collection was locally already filled with data */
            /* TODO: Transaction for speed */
            for (let childItem of property()) {
                let bindableChild: ModelExtensions = createBindable(childItem, {});
                bindableChild.fsBaseCollection = collectionRef;
                bindableChild.twoWayBinding = item.twoWayBinding;
                bindableChild.state(1); /* NEW */
                bindableChild.save();
            }
        }
    }
}