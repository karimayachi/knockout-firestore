import { firestore } from 'firebase';
import { ObservableArray } from 'knockout';
import { BindableArray } from './BindableArray';
export declare namespace kofs {
    interface KofsOptions {
        where?: string[] | string[][];
        orderBy: string[] | string[][];
        includes?: {
            [key: string]: {
                class: new () => any;
                orderBy: string[] | string[][];
            };
        };
        twoWayBinding: boolean;
    }
    function getBoundCollection<T>(fsCollection: firestore.CollectionReference, model: new () => T, options: any): BindableArray<T>;
    function bindCollection<T>(observableArray: ObservableArray<T>, fsCollection: firestore.CollectionReference, model: new () => T, options: KofsOptions): void;
}
