import { firestore } from 'firebase';
import { ObservableArray } from 'knockout';
import { BindableArray } from './BindableArray';
import { Bindable } from './Bindable';
export interface KofsOptions {
    where: [string, string, any] | [string, string, any][];
    orderBy: [string, string] | [string, string][];
    includes: {
        [key: string]: {
            class: new () => any;
            orderBy: [string, string] | [string, string][];
        };
    };
    twoWayBinding: boolean;
    logLevel: number;
}
export { BindableArray, Bindable };
export declare function getBoundCollection<T>(fsCollection: firestore.CollectionReference, model: new () => T, options: Partial<KofsOptions>): BindableArray<T>;
export declare function bindCollection<T>(observableArray: ObservableArray<T>, fsCollection: firestore.CollectionReference, model: new () => T, options: Partial<KofsOptions>): void;
