import { ObservableArray } from 'knockout';
import { firestore } from 'firebase';

export class Bindable {
    fsQuery?: firestore.Query;
    fsCollection?: firestore.CollectionReference;
    includes: any;
    localOnly: boolean;
    twoWayBinding: boolean;

    constructor() {
        this.localOnly = false;
        this.twoWayBinding = false;

        
    }
}

export type BindableArray<T> = ObservableArray<T> & Bindable;

export function createBindableArray<T>(koObservableArray: BindableArray<T>): void {
    

    koObservableArray.subscribe(collectionChanged, koObservableArray, 'arrayChange');
}