import { ObservableArray } from 'knockout';
import { firestore } from 'firebase';
import { Bindable } from './Bindable';

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
    }

    getDocument(id: string): Bindable<T> | null {
        /* assume 'this' is merged with an ObservableArray */
        let contents: T[] = (<BindableArray<T>><unknown>this)();

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
        let observableArray: BindableArray<T> = (<BindableArray<T>><unknown>this);

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
        let contents: T[] = (<BindableArray<T>><unknown>this)();

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


    //koObservableArray.subscribe(collectionChanged, koObservableArray, 'arrayChange');
    return <BindableArray<T>>koObservableArray;
}