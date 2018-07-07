'use strict';
var observable = require('./observableExtension');
var logging = require('./logging');

exports.extendObservableArray = function (koObservableArray) {
    koObservableArray.fsQuery;
    koObservableArray.fsCollection;
    koObservableArray.localOnly = false;
    koObservableArray.twoWayBinding = true;

    /* extend the prototype (the same protoype will be extended for each instance: TODO: OPTIMIZE) */
    koObservableArray.__proto__.getDocument = getDocument;
    koObservableArray.__proto__.detach = detach;
    koObservableArray.__proto__.saveAll = saveAll;

    koObservableArray.subscribe(collectionChanged, koObservableArray, 'arrayChange');
}

function getDocument(id) {
    for (var i = 0; i < this().length; i++) {
        if (this()[i].fsDocumentId === id)
            return this()[i];
    }
    return null;
}

function detach(item) {
    /* if this collection is Two-Way bound, just delete */
    if(this.twoWayBinding) {
        this.remove(item);
    }
    else {
        item.state(3); /* DELETED */

        /* use Knockout's internal _destroy property to filter this item out of the UI */
        this.destroy(item);

        logging.debug('Document "' + item.fsDocumentId + '" detached from local collection.');
    }
}

function saveAll() {
    for (var i = 0; i < this().length; i++) {
        if (this()[i].state() !== 0)
            this()[i].save();
    }
}

function collectionChanged(changes) {
    /* if local only change (e.g. triggered by load from Firestore) return */
    if(this.localOnly) { return; }

    for(var index in changes) {
        var item = changes[index].value;
        
        switch(changes[index].status) {
            case 'added':
                /* extend the Model with the ObservableDocument functionality */
                observable.extendObservable(item);
                item.twoWayBinding = this.twoWayBinding;

                if(this.twoWayBinding) {
                    logging.debug('Adding new document to Firestore collection "' + this.fsCollection.id +'"');

                    this.fsCollection.add(item.getFlatDocument())
                    .then(function (doc) {
                        item.fsBaseCollection = doc.parent;
                        item.fsDocumentId = doc.id;
                    }).catch(function (error) {
                        logging.error('Error saving Firestore document :', error);
                    });
                }
                else {
                    logging.debug('Adding new document to local collection only');
                    item.state(1); /* NEW */
                    item.fsBaseCollection = this.fsCollection;
                }

                break;
            case 'deleted':
                if(this.twoWayBinding) {
                    logging.debug('Deleting document "' + item.fsDocumentId + '" from Firestore collection "' + this.fsCollection.id +'"');

                    item.fsBaseCollection.doc(item.fsDocumentId).delete().catch(function (error) {
                        logging.error('Error deleting Firestore document :', error);
                    });
                }
                else {
                    logging.debug('Document "' + item.fsDocumentId + '" removed from local collection.');
                    logging.debug('You\'re not using Two-Way binding, please use .detach() in stead of .remove() to persist the change when syncing to Firestore');
                }

                break;
        }
    }
}