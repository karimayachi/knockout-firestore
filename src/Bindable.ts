import ko from 'knockout';

interface Bindable {
    fsDocumentId: string;
    fsBaseCollection: any;
    includes: any;
    lock: boolean;
    twoWayBinding: boolean;
}

class Model {
    id: number;
    title: string;
    description: string;

    constructor() {
        this.id = 0;
        this.title = '';
        this.description = '';
    }
}


/**
 * Creates a bindable from the given object and optionally the deep includes
 * (navigation properties)
 * @param model the object to be made bindable
 * @param includes (optional) the deep includes for eager loading
 */
export function createBindable<T>(model: T, includes?: any): Bindable & T {
    return <Bindable & T>model;
}

exports.extendObservable = function (document, includes) {
    document.fsDocumentId;
    document.fsBaseCollection;
    document.includes = Object.assign(includes || {}, document.includes);
    document.lock = false;
    document.twoWayBinding = true;

    /* create 'hidden' observables to track changes */
    Object.defineProperty(document, 'state', {
        enumerable: false,
        configurable: false,
        writable: false,
        value: ko.observable(0) /* UNCHANGED */
    });
    Object.defineProperty(document, 'modified', {
        enumerable: false,
        configurable: false,
        writable: false,
        value: ko.pureComputed(function () {
            return document.state() != 0;
        })
    });

    /* extend the prototype (the same protoype will be extended for each instance: TODO: OPTIMIZE) */
    document.__proto__.saveProperty = saveProperty;
    document.__proto__.getFlatDocument = getFlatDocument;
    document.__proto__.save = save;

    /* subscribe to the Knockout changes
     * enumerate using keys() and filter out protoype functions with hasOwnProperty() in stead of using 
     * getOwnPropertyNames(), because the latter also returns non-enumerables */
    for (var index in Object.keys(document)) {
        var propertyName = Object.keys(document)[index];

        if (!document.hasOwnProperty(propertyName)) continue;

        var property = document[propertyName];

        /* Bind listeners to the properties */
        if (ko.isObservable(property) &&
            (!ko.isObservableArray(property) || !document.includes[propertyName]) &&
            !ko.isComputed(property)) {
            (function (elementName) {
                property.subscribe(function (value) {
                    logging.debug('Knockout observable property "' + elementName + '" changed. LocalOnly: ' + document.lock);

                    /* ignore updates triggered by incoming changes from Firebase */
                    if (!document.lock) {
                        if (document.twoWayBinding) {
                            document.saveProperty(elementName, value);
                        }
                        else if (document.state() != 1) { /* if state is NEW keep it in this state untill it is saved, even if it's modified in the mean time */
                            document.state(2); /* MODIFIED */
                        }
                    }
                });
            })(propertyName);
        }
    }
}

function getFlatDocument() {
    var document = {};

    /* enumerate using keys() and filter out protoype functions with hasOwnProperty() in stead of using 
     * getOwnPropertyNames(), because the latter also returns non-enumerables */
    for (var index in Object.keys(this)) {
        var propertyName = Object.keys(this)[index];

        if (!this.hasOwnProperty(propertyName)) continue;

        var property = this[propertyName];

        /* flatten properties, except computed and deep includes */
        if (ko.isObservable(property) &&
            !ko.isComputed(property) &&
            !this.includes[propertyName]) {
            var propertyValue;
            if (typeof property() === 'boolean' || typeof property() === 'number') {
                propertyValue = property(); /* 0 or false should just be inserted as a value */
            }
            else {
                propertyValue = property() || ''; /* but not null, undefined or the likes */
            }

            document[propertyName] = propertyValue;
        }
    }

    return document;
}

function save() {
    if (this.state() == 0) {
        logging.debug('Firestore document ' + this.fsDocumentId + ' unchanged');
        return;
    }

    var self = this;
    var thisDocument = this.getFlatDocument();

    if (self.state() == 1) { /* NEW */
        this.fsBaseCollection.add(thisDocument).then(function (doc) {
            logging.debug('Firestore document ' + doc.id + ' added to database');
            self.fsDocumentId = doc.id;
            if (self.state() == 2) { /* document was modified while saving */
                logging.debug('Firestore document ' + doc.id + ' was modified during insert, save changes');
                self.save();
            }
            else {
                self.state(0);
            }
        }).catch(function (error) {
            logging.error('Error adding Firestore document :', error);
        });
    }
    else if (self.state() == 2) { /* MODIFIED */
        this.fsBaseCollection.doc(this.fsDocumentId).update(thisDocument).then(function () {
            logging.debug('Firestore document ' + self.fsDocumentId + ' saved to database');
            self.state(0);
        }).catch(function (error) {
            logging.error('Error saving Firestore document :', error);
        });
    }
    else if (self.state() == 3) { /* DELETED */
        this.fsBaseCollection.doc(this.fsDocumentId).delete().then(function () {
            logging.debug('Firestore document ' + self.fsDocumentId + ' deleted from database');
        }).catch(function (error) {
            logging.error('Error saving Firestore document :', error);
        });
    }
}

function saveProperty(property, value) {
    var self = this;
    var doc = {};
    doc[property] = value;

    /* it can happen that a property change triggers saveProperty,
     * while the document is not yet properly saved in Firestore and
     * has no fsDocumentId yet. In that case don't save to Firestore,
     * but record the change and mark this document MODIFIED */
    if (typeof this.fsDocumentId === 'undefined') {
        this.state(2); // MODIFIED
    }
    else {
        this.fsBaseCollection.doc(this.fsDocumentId).update(doc).then(function () {
            logging.debug('Firestore document ' + self.fsDocumentId + ' saved to database');
        }).catch(function (error) {
            logging.error('Error saving Firestore document :', error);
        });
    }
}
