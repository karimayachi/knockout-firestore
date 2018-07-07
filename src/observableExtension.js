'use strict';

var logging = require('./logging');

exports.extendObservable = function (koObservable) {
    koObservable.fsDocumentId;
    koObservable.fsBaseCollection;
    koObservable.lock = false;
    koObservable.twoWayBinding = true;

    /* create 'hidden' observables to track changes */
    Object.defineProperty(koObservable, 'state', {
        enumerable: false,
        configurable: false,
        writable: false,
        value: ko.observable(0) /* UNCHANGED */
    });
      Object.defineProperty(koObservable, 'modified', {
        enumerable: false,
        configurable: false,
        writable: false,
        value: ko.pureComputed(function () {
            return koObservable.state() != 0;
        })
    });

    /* extend the prototype (the same protoype will be extended for each instance: TODO: OPTIMIZE) */
    koObservable.__proto__.saveProperty = saveProperty;
    koObservable.__proto__.getFlatDocument = getFlatDocument;
    koObservable.__proto__.save = save;

    /* subscribe to the Knockout changes
     * enumerate using keys() and filter out protoype functions with hasOwnProperty() in stead of using 
     * getOwnPropertyNames(), because the latter also returns non-enumerables */
    for(var index in Object.keys(koObservable)) {
        var propertyName = Object.keys(koObservable)[index];
        
        if(!koObservable.hasOwnProperty(propertyName)) continue;

        var property = koObservable[propertyName];

        if(ko.isObservable(property) && !ko.isComputed(property)) {
            (function (elementName) {
                property.subscribe(function(value) { 
                    logging.debug('Knockout observable property "' + elementName + '" changed. LocalOnly: ' + koObservable.lock);
                        
                    /* ignore updates triggered by incoming changes from Firebase */
                    if (!koObservable.lock) {
                        if(koObservable.twoWayBinding) { 
                            koObservable.saveProperty(elementName, value);
                        }
                        else if(koObservable.state() != 1) { /* if state is NEW keep it in this state untill it is saved, even if it's modified in the mean time */
                            koObservable.state(2); /* MODIFIED */
                        }
                    }
                });
            })(propertyName);
        }
    }
}

function getFlatDocument () {
    var document = {};

    /* enumerate using keys() and filter out protoype functions with hasOwnProperty() in stead of using 
     * getOwnPropertyNames(), because the latter also returns non-enumerables */
    for(var index in Object.keys(this)) {
        var propertyName = Object.keys(this)[index];

        if(!this.hasOwnProperty(propertyName)) continue;

        var property = this[propertyName];

        if(ko.isObservable(property) && !ko.isComputed(property)) {
            var propertyValue = property() || '' ;
            document[propertyName] = propertyValue;
        }
    }

    return document;
}

function save () {
    if(this.state() == 0) {
        logging.debug('Firestore document ' + this.fsDocumentId + ' unchanged');
        return;
    }

    var self = this;
    var thisDocument = this.getFlatDocument();

    if (self.state() == 1 ) { /* NEW */
        this.fsBaseCollection.add(thisDocument).then(function (doc) {
            logging.debug('Firestore document ' + doc.id + ' added to database');
            self.state(0);
            self.fsDocumentId = doc.id;
        }).catch(function (error) {
            logging.error('Error adding Firestore document :', error);
        });
    }
    else if(self.state() == 2) { /* MODIFIED */
        this.fsBaseCollection.doc(this.fsDocumentId).update(thisDocument).then(function () {
            logging.debug('Firestore document ' + self.fsDocumentId + ' saved to database');
            self.state(0);
        }).catch(function (error) {
            logging.error('Error saving Firestore document :', error);
        });
    }
    else if(self.state() == 3) { /* DELETED */
        this.fsBaseCollection.doc(this.fsDocumentId).delete().then(function () {
            logging.debug('Firestore document ' + self.fsDocumentId + ' deleted from database');
        }).catch(function (error) {
            logging.error('Error saving Firestore document :', error);
        });
    }
}

function saveProperty (property, value) {
    var self = this;
    var doc = {};
    doc[property] = value;
    
    this.fsBaseCollection.doc(this.fsDocumentId).update(doc).then(function () {
        logging.debug('Firestore document ' + self.fsDocumentId + ' saved to database');
    }).catch(function (error) {
        logging.error('Error saving Firestore document :', error);
    });
}
