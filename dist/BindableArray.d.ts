import { ObservableArray } from 'knockout';
import { firestore } from 'firebase';
import { Bindable } from './Bindable';
export declare type BindableArray<T> = ObservableArray<T> & ArrayExtensions<T>;
export declare class ArrayExtensions<T> {
    fsQuery?: firestore.Query;
    fsCollection?: firestore.CollectionReference;
    includes?: {
        [key: string]: {
            class: new () => any;
            orderBy: string[] | string[][];
        };
    };
    localOnly: boolean;
    twoWayBinding: boolean;
    constructor();
    getDocument(id: string): Bindable<T> | null;
    detach(item: T): void;
    saveAll(): void;
}
export declare function createBindableArray<T>(koObservableArray: ObservableArray<T>): BindableArray<T>;
