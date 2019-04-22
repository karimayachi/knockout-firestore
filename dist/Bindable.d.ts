import { Observable, PureComputed } from 'knockout';
import { firestore } from 'firebase';
export declare type Bindable<T> = ModelExtensions & T;
export declare class ModelExtensions {
    fsDocumentId?: string;
    fsBaseCollection?: firestore.CollectionReference;
    includes?: {
        property: {
            class: new () => any;
            orderBy: string[] | string[][];
        };
    };
    lock: boolean;
    twoWayBinding: boolean;
    state: Observable<number>;
    modified: PureComputed<boolean>;
    constructor();
    getFlatDocument(): any;
    save(): void;
    saveProperty(property: string, value: any): void;
}
/**
 * Creates a bindable from the given object and optionally the deep includes
 * (navigation properties)
 * @param model the object to be made bindable
 * @param includes (optional) the deep includes for eager loading
 */
export declare function createBindable<T>(model: T, includes?: any): Bindable<T>;
