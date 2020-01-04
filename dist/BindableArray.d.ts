import { ObservableArray } from 'knockout';
import { firestore } from 'firebase';
import { Bindable } from './Bindable';
import { Logger } from './Logger';
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
    logger: Logger;
    constructor(logger?: Logger);
    getDocument(id: string): Bindable<T> | null;
    detach(item: T): void;
    saveAll(): void;
}
export declare function createBindableArray<T>(koObservableArray: ObservableArray<T>, logger?: Logger): BindableArray<T>;
