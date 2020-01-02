import * as ko from 'knockout';
import { Observable, PureComputed } from 'knockout';
import { firestore } from 'firebase';
import { mergeObjects } from './mergeObjects';
import { Logger } from './Logger';

export type Bindable<T> = ModelExtensions & T;

export class ModelExtensions {
    fsDocumentId?: string;
    fsBaseCollection?: firestore.CollectionReference;
    includes?: { property: { class: new () => any, orderBy: string[] | string[][] } };
    lock: boolean;
    twoWayBinding: boolean;
    state: Observable<number>;
    modified: PureComputed<boolean>; /* Why is this hidden again? */
    logger: Logger;

    constructor(logger?: Logger) {
        this.lock = false;
        this.twoWayBinding = true;

        this.state = ko.observable(0); /* UNCHANGED */
        this.modified = ko.pureComputed((): boolean => {
            return this.state() != 0;
        });

        this.logger = logger || new Logger();

        /* Don't use decorators or end up in Prototype Hell */
        Object.defineProperty(this, 'state', {
            enumerable: false,
            configurable: false,
            writable: false
        });

        Object.defineProperty(this, 'modified', {
            enumerable: false,
            configurable: false,
            writable: false
        });
    }

    getFlatDocument(): any {
        let document: any = {};

        /* enumerate using keys() and filter out protoype functions with hasOwnProperty() in stead of using 
         * getOwnPropertyNames(), because the latter also returns non-enumerables */
        for (let key of Object.keys(this)) {
            if (!this.hasOwnProperty(key)) continue;

            let property: any = (<any>this)[key];

            /* flatten properties, except computed and deep includes */
            if (ko.isObservable(property) &&
                !ko.isComputed(property) &&
                !(<any>this.includes)[key]) {
                let propertyValue: any;
                if (typeof property() === 'boolean' || typeof property() === 'number') {
                    propertyValue = property(); /* 0 or false should just be inserted as a value */
                }
                else {
                    propertyValue = property() || ''; /* but not null, undefined or the likes */
                }

                document[key] = propertyValue;
            }
        }

        return document;
    }

    save(): void {
        if (this.state() == 0) {
            this.logger.debug('Firestore document ' + this.fsDocumentId + ' unchanged');
            return;
        }

        if (this.fsBaseCollection === undefined) {
            this.logger.error('Firestore document ' + this.fsDocumentId + ' not part of a Collection');
            return;
        }

        let thisDocument: any = this.getFlatDocument();

        if (this.state() == 1) { /* NEW */
            this.fsBaseCollection.add(thisDocument).then((doc: firestore.DocumentReference): void => {
                this.logger.debug('Firestore document ' + doc.id + ' added to database');
                this.fsDocumentId = doc.id;
                if (this.state() == 2) { /* document was modified while saving */
                    this.logger.debug('Firestore document ' + doc.id + ' was modified during insert, save changes');
                    this.save();
                }
                else {
                    this.state(0);
                }
            }).catch((error: any): void => {
                this.logger.error('Error adding Firestore document :', error);
            });
        }
        else if (this.state() == 2) { /* MODIFIED */
            this.fsBaseCollection.doc(this.fsDocumentId).update(thisDocument).then((): void => {
                this.logger.debug('Firestore document ' + this.fsDocumentId + ' saved to database');
                this.state(0);
            }).catch((error: any): void => {
                this.logger.error('Error saving Firestore document :', error);
            });
        }
        else if (this.state() == 3) { /* DELETED */
            this.fsBaseCollection.doc(this.fsDocumentId).delete().then((): void => {
                this.logger.debug('Firestore document ' + this.fsDocumentId + ' deleted from database');
            }).catch((error: any): void => {
                this.logger.error('Error saving Firestore document :', error);
            });
        }
    }

    saveProperty(property: string, value: any): void {
        let doc: any = {};

        if (typeof value == 'number' ||
            typeof value == 'string' ||
            typeof value == 'boolean') {
            doc[property] = value;
        }
        else if (Array.isArray(value)) { /* only serialize non-complex elements.. TODO: serialize knockout observables */
            doc[property] = value.filter((value: any) => {
                return typeof value == 'number' ||
                    typeof value == 'string' ||
                    typeof value == 'boolean';
            });
        }

        if (this.fsBaseCollection === undefined) {
            this.logger.error('Firestore document ' + this.fsDocumentId + ' not part of a Collection');
            return;
        }

        /* it can happen that a property change triggers saveProperty,
         * while the document is not yet properly saved in Firestore and
         * has no fsDocumentId yet. In that case don't save to Firestore,
         * but record the change and mark this document MODIFIED */
        if (typeof this.fsDocumentId === 'undefined') {
            this.state(2); // MODIFIED
        }
        else {
            this.fsBaseCollection.doc(this.fsDocumentId).update(doc).then((): void => {
                this.logger.debug('Firestore document ' + this.fsDocumentId + ' saved to database');
            }).catch((error: any): void => {
                this.logger.error('Error saving Firestore document :', error);
            });
        }
    }
}

/**
 * Creates a bindable from the given object and optionally the deep includes
 * (navigation properties)
 * @param model the object to be made bindable
 * @param includes (optional) the deep includes for eager loading
 */
export function createBindable<T>(model: T, includes?: any, logger?: Logger): Bindable<T> {

    let extension = new ModelExtensions(logger);

    let bindableModel: Bindable<T> = mergeObjects(model, extension);

    bindableModel.includes = Object.assign(includes || {}, bindableModel.includes);

    /* subscribe to the Knockout changes
     * enumerate using keys() and filter out protoype functions with hasOwnProperty() in stead of using 
     * getOwnPropertyNames(), because the latter also returns non-enumerables */
    for (let key of Object.keys(bindableModel)) {
        if (!bindableModel.hasOwnProperty(key)) continue;

        let property: any = (<any>bindableModel)[key];

        /* Bind listeners to the properties */
        if (ko.isObservable(property) &&
            (!ko.isObservableArray(property) || !(<any>bindableModel.includes)[key]) &&
            !ko.isComputed(property)) {
            ((elementName: string): void => {
                property.subscribe((value: any): void => {
                    bindableModel.logger.debug('Knockout observable property "' + elementName + '" changed. LocalOnly: ' + bindableModel.lock);

                    /* ignore updates triggered by incoming changes from Firebase */
                    if (!bindableModel.lock) {
                        if (bindableModel.twoWayBinding) {
                            bindableModel.saveProperty(elementName, value);
                        }
                        else if (bindableModel.state() != 1) { /* if state is NEW keep it in this state untill it is saved, even if it's modified in the mean time */
                            bindableModel.state(2); /* MODIFIED */
                        }
                    }
                });
            })(key);
        }
    }

    return bindableModel;
}
