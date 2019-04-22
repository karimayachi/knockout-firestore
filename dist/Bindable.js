"use strict";
exports.__esModule = true;
var helpers_1 = require("./helpers");
var ModelExtensions = /** @class */ (function () {
    function ModelExtensions() {
        var _this = this;
        this.lock = false;
        this.twoWayBinding = true;
        this.state = ko.observable(0); /* UNCHANGED */
        this.modified = ko.pureComputed(function () {
            return _this.state() != 0;
        });
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
    ModelExtensions.prototype.getFlatDocument = function () {
        var document = {};
        /* enumerate using keys() and filter out protoype functions with hasOwnProperty() in stead of using
         * getOwnPropertyNames(), because the latter also returns non-enumerables */
        for (var _i = 0, _a = Object.keys(this); _i < _a.length; _i++) {
            var key = _a[_i];
            if (!this.hasOwnProperty(key))
                continue;
            var property = this[key];
            /* flatten properties, except computed and deep includes */
            if (ko.isObservable(property) &&
                !ko.isComputed(property) &&
                !this.includes[key]) {
                var propertyValue = void 0;
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
    };
    ModelExtensions.prototype.save = function () {
        var _this = this;
        if (this.state() == 0) {
            //logging.debug('Firestore document ' + this.fsDocumentId + ' unchanged');
            return;
        }
        if (this.fsBaseCollection === undefined) {
            //logging.error('Firestore document ' + this.fsDocumentId + ' not part of a Collection');
            return;
        }
        var thisDocument = this.getFlatDocument();
        if (this.state() == 1) { /* NEW */
            this.fsBaseCollection.add(thisDocument).then(function (doc) {
                //logging.debug('Firestore document ' + doc.id + ' added to database');
                _this.fsDocumentId = doc.id;
                if (_this.state() == 2) { /* document was modified while saving */
                    //logging.debug('Firestore document ' + doc.id + ' was modified during insert, save changes');
                    _this.save();
                }
                else {
                    _this.state(0);
                }
            })["catch"](function (error) {
                //logging.error('Error adding Firestore document :', error);
            });
        }
        else if (this.state() == 2) { /* MODIFIED */
            this.fsBaseCollection.doc(this.fsDocumentId).update(thisDocument).then(function () {
                //logging.debug('Firestore document ' + this.fsDocumentId + ' saved to database');
                _this.state(0);
            })["catch"](function (error) {
                //logging.error('Error saving Firestore document :', error);
            });
        }
        else if (this.state() == 3) { /* DELETED */
            this.fsBaseCollection.doc(this.fsDocumentId)["delete"]().then(function () {
                //logging.debug('Firestore document ' + this.fsDocumentId + ' deleted from database');
            })["catch"](function (error) {
                //logging.error('Error saving Firestore document :', error);
            });
        }
    };
    ModelExtensions.prototype.saveProperty = function (property, value) {
        var doc = {};
        if (typeof value == 'number' ||
            typeof value == 'string' ||
            typeof value == 'boolean') {
            doc[property] = value;
        }
        else if (Array.isArray(value)) { /* only serialize non-complex elements.. TODO: serialize knockout observables */
            doc[property] = value.filter(function (value) {
                return typeof value == 'number' ||
                    typeof value == 'string' ||
                    typeof value == 'boolean';
            });
        }
        if (this.fsBaseCollection === undefined) {
            //logging.error('Firestore document ' + this.fsDocumentId + ' not part of a Collection');
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
            this.fsBaseCollection.doc(this.fsDocumentId).update(doc).then(function () {
                //logging.debug('Firestore document ' + this.fsDocumentId + ' saved to database');
            })["catch"](function (error) {
                //logging.error('Error saving Firestore document :', error);
            });
        }
    };
    return ModelExtensions;
}());
exports.ModelExtensions = ModelExtensions;
/**
 * Creates a bindable from the given object and optionally the deep includes
 * (navigation properties)
 * @param model the object to be made bindable
 * @param includes (optional) the deep includes for eager loading
 */
function createBindable(model, includes) {
    var extension = new ModelExtensions();
    var bindableModel = helpers_1.mergeObjects(model, extension);
    bindableModel.includes = Object.assign(includes || {}, bindableModel.includes);
    var _loop_1 = function (key) {
        if (!bindableModel.hasOwnProperty(key))
            return "continue";
        var property = bindableModel[key];
        /* Bind listeners to the properties */
        if (ko.isObservable(property) &&
            (!ko.isObservableArray(property) || !bindableModel.includes[key]) &&
            !ko.isComputed(property)) {
            (function (elementName) {
                property.subscribe(function (value) {
                    //logging.debug('Knockout observable property "' + elementName + '" changed. LocalOnly: ' + bindableModel.lock);
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
    };
    /* subscribe to the Knockout changes
     * enumerate using keys() and filter out protoype functions with hasOwnProperty() in stead of using
     * getOwnPropertyNames(), because the latter also returns non-enumerables */
    for (var _i = 0, _a = Object.keys(bindableModel); _i < _a.length; _i++) {
        var key = _a[_i];
        _loop_1(key);
    }
    return bindableModel;
}
exports.createBindable = createBindable;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiQmluZGFibGUuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi9zcmMvQmluZGFibGUudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7QUFFQSxxQ0FBeUM7QUFNekM7SUFTSTtRQUFBLGlCQXFCQztRQXBCRyxJQUFJLENBQUMsSUFBSSxHQUFHLEtBQUssQ0FBQztRQUNsQixJQUFJLENBQUMsYUFBYSxHQUFHLElBQUksQ0FBQztRQUUxQixJQUFJLENBQUMsS0FBSyxHQUFHLEVBQUUsQ0FBQyxVQUFVLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxlQUFlO1FBQzlDLElBQUksQ0FBQyxRQUFRLEdBQUcsRUFBRSxDQUFDLFlBQVksQ0FBQztZQUM1QixPQUFPLEtBQUksQ0FBQyxLQUFLLEVBQUUsSUFBSSxDQUFDLENBQUM7UUFDN0IsQ0FBQyxDQUFDLENBQUM7UUFFSCxzREFBc0Q7UUFDdEQsTUFBTSxDQUFDLGNBQWMsQ0FBQyxJQUFJLEVBQUUsT0FBTyxFQUFFO1lBQ2pDLFVBQVUsRUFBRSxLQUFLO1lBQ2pCLFlBQVksRUFBRSxLQUFLO1lBQ25CLFFBQVEsRUFBRSxLQUFLO1NBQ2xCLENBQUMsQ0FBQztRQUVILE1BQU0sQ0FBQyxjQUFjLENBQUMsSUFBSSxFQUFFLFVBQVUsRUFBRTtZQUNwQyxVQUFVLEVBQUUsS0FBSztZQUNqQixZQUFZLEVBQUUsS0FBSztZQUNuQixRQUFRLEVBQUUsS0FBSztTQUNsQixDQUFDLENBQUM7SUFDUCxDQUFDO0lBRUQseUNBQWUsR0FBZjtRQUNJLElBQUksUUFBUSxHQUFRLEVBQUUsQ0FBQztRQUV2QjtvRkFDNEU7UUFDNUUsS0FBZ0IsVUFBaUIsRUFBakIsS0FBQSxNQUFNLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxFQUFqQixjQUFpQixFQUFqQixJQUFpQixFQUFFO1lBQTlCLElBQUksR0FBRyxTQUFBO1lBQ1IsSUFBSSxDQUFDLElBQUksQ0FBQyxjQUFjLENBQUMsR0FBRyxDQUFDO2dCQUFFLFNBQVM7WUFFeEMs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LGNBQTBCLEVBQTFCLElBQTBCO1FBQXJDLElBQUksR0FBRyxTQUFBO2dCQUFILEdBQUc7S0F5Qlg7SUFFRCxPQUFPLGFBQWEsQ0FBQztBQUN6QixDQUFDO0FBdkNELHdDQXVDQyIsInNvdXJjZXNDb250ZW50IjpbImltcG9ydCBrbm9ja291dCwgeyBPYnNlcnZhYmxlLCBQdXJlQ29tcHV0ZWQgfSBmcm9tICdrbm9ja291dCc7XG5pbXBvcnQgeyBmaXJlc3RvcmUgfSBmcm9tICdmaXJlYmFzZSc7XG5pbXBvcnQgeyBtZXJnZU9iamVjdHMgfSBmcm9tICcuL2hlbHBlcnMnO1xuXG5kZWNsYXJlIHZhciBrbzogdHlwZW9mIGtub2Nrb3V0OyAvKiBhbGlhcyB0aGUgbmFtZXNwYWNlIHRvIGF2b2lkIGltcG9ydGluZyB0aGUgbW9kdWxlLCBidXQgc3RpbGwgdXNlIHRoZSB0eXBpbmdzICovXG5cbmV4cG9ydCB0eXBlIEJpbmRhYmxlPFQ+ID0gTW9kZWxFeHRlbnNpb25zICYgVDtcblxuZXhwb3J0IGNsYXNzIE1vZGVsRXh0ZW5zaW9ucyB7XG4gICAgZnNEb2N1bWVudElkPzogc3RyaW5nO1xuICAgIGZzQmFzZUNvbGxlY3Rpb24/OiBmaXJlc3RvcmUuQ29sbGVjdGlvblJlZmVyZW5jZTtcbiAgICBpbmNsdWRlcz86IHsgcHJvcGVydHk6IHsgY2xhc3M6IG5ldyAoKSA9PiBhbnksIG9yZGVyQnk6IHN0cmluZ1tdIHwgc3RyaW5nW11bXSB9IH07XG4gICAgbG9jazogYm9vbGVhbjtcbiAgICB0d29XYXlCaW5kaW5nOiBib29sZWFuO1xuICAgIHN0YXRlOiBPYnNlcnZhYmxlPG51bWJlcj47XG4gICAgbW9kaWZpZWQ6IFB1cmVDb21wdXRlZDxib29sZWFuPjsgLyogV2h5IGlzIHRoaXMgaGlkZGVuIGFnYWluPyAqL1xuXG4gICAgY29uc3RydWN0b3IoKSB7XG4gICAgICAgIHRoaXMubG9jayA9IGZhbHNlO1xuICAgICAgICB0aGlzLnR3b1dheUJpbmRpbmcgPSB0cnVlO1xuXG4gICAgICAgIHRoaXMuc3RhdGUgPSBrby5vYnNlcnZhYmxlKDApOyAvKiBVTkNIQU5HRUQgKi9cbiAgICAgICAgdGhpcy5tb2RpZmllZCA9IGtvLnB1cmVDb21wdXRlZCgoKTogYm9vbGVhbiA9PiB7XG4gICAgICAgICAgICByZXR1cm4gdGhpcy5zdGF0ZSgpICE9IDA7XG4gICAgICAgIH0pO1xuXG4gICAgICAgIC8qIERvbid0IHVzZSBkZWNvcmF0b3JzIG9yIGVuZCB1cCBpbiBQcm90b3R5cGUgSGVsbCAqL1xuICAgICAgICBPYmplY3QuZGVmaW5lUHJvcGVydHkodGhpcywgJ3N0YXRlJywge1xuICAgICAgICAgICAgZW51bWVyYWJsZTogZmFsc2UsXG4gICAgICAgICAgICBjb25maWd1cmFibGU6IGZhbHNlLFxuICAgICAgICAgICAgd3JpdGFibGU6IGZhbHNlXG4gICAgICAgIH0pO1xuXG4gICAgICAgIE9iamVjdC5kZWZpbmVQcm9wZXJ0eSh0aGlzLCAnbW9kaWZpZWQnLCB7XG4gICAgICAgICAgICBlbnVtZXJhYmxlOiBmYWxzZSxcbiAgICAgICAgICAgIGNvbmZpZ3VyYWJsZTogZmFsc2UsXG4gICAgICAgICAgICB3cml0YWJsZTogZmFsc2VcbiAgICAgICAgfSk7XG4gICAgfVxuXG4gICAgZ2V0RmxhdERvY3VtZW50KCk6IGFueSB7XG4gICAgICAgIGxldCBkb2N1bWVudDogYW55ID0ge307XG5cbiAgICAgICAgLyogZW51bWVyYXRlIHVzaW5nIGtleXMoKSBhbmQgZmlsdGVyIG91dCBwcm90b3lwZSBmdW5jdGlvbnMgd2l0aCBoYXNPd25Qcm9wZXJ0eSgpIGluIHN0ZWFkIG9mIHVzaW5nIFxuICAgICAgICAgKiBnZXRPd25Qcm9wZXJ0eU5hbWVzKCksIGJlY2F1c2UgdGhlIGxhdHRlciBhbHNvIHJldHVybnMgbm9uLWVudW1lcmFibGVzICovXG4gICAgICAgIGZvciAobGV0IGtleSBvZiBPYmplY3Qua2V5cyh0aGlzKSkge1xuICAgICAgICAgICAgaWYgKCF0aGlzLmhhc093blByb3BlcnR5KGtleSkpIGNvbnRpbnVlO1xuXG4gICAgICAgICAgICBsZXQgcHJvcGVydHk6IGFueSA9ICg8YW55PnRoaXMpW2tleV07XG5cbiAgICAgICAgICAgIC8qIGZsYXR0ZW4gcHJvcGVydGllcywgZXhjZXB0IGNvbXB1dGVkIGFuZCBkZWVwIGluY2x1ZGVzICovXG4gICAgICAgICAgICBpZiAoa28uaXNPYnNlcnZhYmxlKHByb3BlcnR5KSAmJlxuICAgICAgICAgICAgICAgICFrby5pc0NvbXB1dGVkKHByb3BlcnR5KSAmJlxuICAgICAgICAgICAgICAgICEoPGFueT50aGlzLmluY2x1ZGVzKVtrZXldKSB7XG4gICAgICAgICAgICAgICAgbGV0IHByb3BlcnR5VmFsdWU6IGFueTtcbiAgICAgICAgICAgICAgICBpZiAodHlwZW9mIHByb3BlcnR5KCkgPT09ICdib29sZWFuJyB8fCB0eXBlb2YgcHJvcGVydHkoKSA9PT0gJ251bWJlcicpIHtcbiAgICAgICAgICAgICAgICAgICAgcHJvcGVydHlWYWx1ZSA9IHByb3BlcnR5KCk7IC8qIDAgb3IgZmFsc2Ugc2hvdWxkIGp1c3QgYmUgaW5zZXJ0ZWQgYXMgYSB2YWx1ZSAqL1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgcHJvcGVydHlWYWx1ZSA9IHByb3BlcnR5KCkgfHwgJyc7IC8qIGJ1dCBub3QgbnVsbCwgdW5kZWZpbmVkIG9yIHRoZSBsaWtlcyAqL1xuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIGRvY3VtZW50W2tleV0gPSBwcm9wZXJ0eVZhbHVlO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIGRvY3VtZW50O1xuICAgIH1cblxuICAgIHNhdmUoKTogdm9pZCB7XG4gICAgICAgIGlmICh0aGlzLnN0YXRlKCkgPT0gMCkge1xuICAgICAgICAgICAgLy9sb2dnaW5nLmRlYnVnKCdGaXJlc3RvcmUgZG9jdW1lbnQgJyArIHRoaXMuZnNEb2N1bWVudElkICsgJyB1bmNoYW5nZWQnKTtcbiAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmICh0aGlzLmZzQmFzZUNvbGxlY3Rpb24gPT09IHVuZGVmaW5lZCkge1xuICAgICAgICAgICAgLy9sb2dnaW5nLmVycm9yKCdGaXJlc3RvcmUgZG9jdW1lbnQgJyArIHRoaXMuZnNEb2N1bWVudElkICsgJyBub3QgcGFydCBvZiBhIENvbGxlY3Rpb24nKTtcbiAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuXG4gICAgICAgIGxldCB0aGlzRG9jdW1lbnQ6IGFueSA9IHRoaXMuZ2V0RmxhdERvY3VtZW50KCk7XG5cbiAgICAgICAgaWYgKHRoaXMuc3RhdGUoKSA9PSAxKSB7IC8qIE5FVyAqL1xuICAgICAgICAgICAgdGhpcy5mc0Jhc2VDb2xsZWN0aW9uLmFkZCh0aGlzRG9jdW1lbnQpLnRoZW4oKGRvYzogZmlyZXN0b3JlLkRvY3VtZW50UmVmZXJlbmNlKTogdm9pZCA9PiB7XG4gICAgICAgICAgICAgICAgLy9sb2dnaW5nLmRlYnVnKCdGaXJlc3RvcmUgZG9jdW1lbnQgJyArIGRvYy5pZCArICcgYWRkZWQgdG8gZGF0YWJhc2UnKTtcbiAgICAgICAgICAgICAgICB0aGlzLmZzRG9jdW1lbnRJZCA9IGRvYy5pZDtcbiAgICAgICAgICAgICAgICBpZiAodGhpcy5zdGF0ZSgpID09IDIpIHsgLyogZG9jdW1lbnQgd2FzIG1vZGlmaWVkIHdoaWxlIHNhdmluZyAqL1xuICAgICAgICAgICAgICAgICAgICAvL2xvZ2dpbmcuZGVidWcoJ0ZpcmVzdG9yZSBkb2N1bWVudCAnICsgZG9jLmlkICsgJyB3YXMgbW9kaWZpZWQgZHVyaW5nIGluc2VydCwgc2F2ZSBjaGFuZ2VzJyk7XG4gICAgICAgICAgICAgICAgICAgIHRoaXMuc2F2ZSgpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5zdGF0ZSgwKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9KS5jYXRjaCgoZXJyb3I6IGFueSk6IHZvaWQgPT4ge1xuICAgICAgICAgICAgICAgIC8vbG9nZ2luZy5lcnJvcignRXJyb3IgYWRkaW5nIEZpcmVzdG9yZSBkb2N1bWVudCA6JywgZXJyb3IpO1xuICAgICAgICAgICAgfSk7XG4gICAgICAgIH1cbiAgICAgICAgZWxzZSBpZiAodGhpcy5zdGF0ZSgpID09IDIpIHsgLyogTU9ESUZJRUQgKi9cbiAgICAgICAgICAgIHRoaXMuZnNCYXNlQ29sbGVjdGlvbi5kb2ModGhpcy5mc0RvY3VtZW50SWQpLnVwZGF0ZSh0aGlzRG9jdW1lbnQpLnRoZW4oKCk6IHZvaWQgPT4ge1xuICAgICAgICAgICAgICAgIC8vbG9nZ2luZy5kZWJ1ZygnRmlyZXN0b3JlIGRvY3VtZW50ICcgKyB0aGlzLmZzRG9jdW1lbnRJZCArICcgc2F2ZWQgdG8gZGF0YWJhc2UnKTtcbiAgICAgICAgICAgICAgICB0aGlzLnN0YXRlKDApO1xuICAgICAgICAgICAgfSkuY2F0Y2goKGVycm9yOiBhbnkpOiB2b2lkID0+IHtcbiAgICAgICAgICAgICAgICAvL2xvZ2dpbmcuZXJyb3IoJ0Vycm9yIHNhdmluZyBGaXJlc3RvcmUgZG9jdW1lbnQgOicsIGVycm9yKTtcbiAgICAgICAgICAgIH0pO1xuICAgICAgICB9XG4gICAgICAgIGVsc2UgaWYgKHRoaXMuc3RhdGUoKSA9PSAzKSB7IC8qIERFTEVURUQgKi9cbiAgICAgICAgICAgIHRoaXMuZnNCYXNlQ29sbGVjdGlvbi5kb2ModGhpcy5mc0RvY3VtZW50SWQpLmRlbGV0ZSgpLnRoZW4oKCk6IHZvaWQgPT4ge1xuICAgICAgICAgICAgICAgIC8vbG9nZ2luZy5kZWJ1ZygnRmlyZXN0b3JlIGRvY3VtZW50ICcgKyB0aGlzLmZzRG9jdW1lbnRJZCArICcgZGVsZXRlZCBmcm9tIGRhdGFiYXNlJyk7XG4gICAgICAgICAgICB9KS5jYXRjaCgoZXJyb3I6IGFueSk6IHZvaWQgPT4ge1xuICAgICAgICAgICAgICAgIC8vbG9nZ2luZy5lcnJvcignRXJyb3Igc2F2aW5nIEZpcmVzdG9yZSBkb2N1bWVudCA6JywgZXJyb3IpO1xuICAgICAgICAgICAgfSk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBzYXZlUHJvcGVydHkocHJvcGVydHk6IHN0cmluZywgdmFsdWU6IGFueSk6IHZvaWQge1xuICAgICAgICBsZXQgZG9jOiBhbnkgPSB7fTtcblxuICAgICAgICBpZiAodHlwZW9mIHZhbHVlID09ICdudW1iZXInIHx8XG4gICAgICAgICAgICB0eXBlb2YgdmFsdWUgPT0gJ3N0cmluZycgfHxcbiAgICAgICAgICAgIHR5cGVvZiB2YWx1ZSA9PSAnYm9vbGVhbicpIHtcbiAgICAgICAgICAgIGRvY1twcm9wZXJ0eV0gPSB2YWx1ZTtcbiAgICAgICAgfVxuICAgICAgICBlbHNlIGlmIChBcnJheS5pc0FycmF5KHZhbHVlKSkgeyAvKiBvbmx5IHNlcmlhbGl6ZSBub24tY29tcGxleCBlbGVtZW50cy4uIFRPRE86IHNlcmlhbGl6ZSBrbm9ja291dCBvYnNlcnZhYmxlcyAqL1xuICAgICAgICAgICAgZG9jW3Byb3BlcnR5XSA9IHZhbHVlLmZpbHRlcigodmFsdWU6IGFueSkgPT4ge1xuICAgICAgICAgICAgICAgIHJldHVybiB0eXBlb2YgdmFsdWUgPT0gJ251bWJlcicgfHxcbiAgICAgICAgICAgICAgICAgICAgdHlwZW9mIHZhbHVlID09ICdzdHJpbmcnIHx8XG4gICAgICAgICAgICAgICAgICAgIHR5cGVvZiB2YWx1ZSA9PSAnYm9vbGVhbic7XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmICh0aGlzLmZzQmFzZUNvbGxlY3Rpb24gPT09IHVuZGVmaW5lZCkge1xuICAgICAgICAgICAgLy9sb2dnaW5nLmVycm9yKCdGaXJlc3RvcmUgZG9jdW1lbnQgJyArIHRoaXMuZnNEb2N1bWVudElkICsgJyBub3QgcGFydCBvZiBhIENvbGxlY3Rpb24nKTtcbiAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuXG4gICAgICAgIC8qIGl0IGNhbiBoYXBwZW4gdGhhdCBhIHByb3BlcnR5IGNoYW5nZSB0cmlnZ2VycyBzYXZlUHJvcGVydHksXG4gICAgICAgICAqIHdoaWxlIHRoZSBkb2N1bWVudCBpcyBub3QgeWV0IHByb3Blcmx5IHNhdmVkIGluIEZpcmVzdG9yZSBhbmRcbiAgICAgICAgICogaGFzIG5vIGZzRG9jdW1lbnRJZCB5ZXQuIEluIHRoYXQgY2FzZSBkb24ndCBzYXZlIHRvIEZpcmVzdG9yZSxcbiAgICAgICAgICogYnV0IHJlY29yZCB0aGUgY2hhbmdlIGFuZCBtYXJrIHRoaXMgZG9jdW1lbnQgTU9ESUZJRUQgKi9cbiAgICAgICAgaWYgKHR5cGVvZiB0aGlzLmZzRG9jdW1lbnRJZCA9PT0gJ3VuZGVmaW5lZCcpIHtcbiAgICAgICAgICAgIHRoaXMuc3RhdGUoMik7IC8vIE1PRElGSUVEXG4gICAgICAgIH1cbiAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICB0aGlzLmZzQmFzZUNvbGxlY3Rpb24uZG9jKHRoaXMuZnNEb2N1bWVudElkKS51cGRhdGUoZG9jKS50aGVuKCgpOiB2b2lkID0+IHtcbiAgICAgICAgICAgICAgICAvL2xvZ2dpbmcuZGVidWcoJ0ZpcmVzdG9yZSBkb2N1bWVudCAnICsgdGhpcy5mc0RvY3VtZW50SWQgKyAnIHNhdmVkIHRvIGRhdGFiYXNlJyk7XG4gICAgICAgICAgICB9KS5jYXRjaCgoZXJyb3I6IGFueSk6IHZvaWQgPT4ge1xuICAgICAgICAgICAgICAgIC8vbG9nZ2luZy5lcnJvcignRXJyb3Igc2F2aW5nIEZpcmVzdG9yZSBkb2N1bWVudCA6JywgZXJyb3IpO1xuICAgICAgICAgICAgfSk7XG4gICAgICAgIH1cbiAgICB9XG59XG5cbi8qKlxuICogQ3JlYXRlcyBhIGJpbmRhYmxlIGZyb20gdGhlIGdpdmVuIG9iamVjdCBhbmQgb3B0aW9uYWxseSB0aGUgZGVlcCBpbmNsdWRlc1xuICogKG5hdmlnYXRpb24gcHJvcGVydGllcylcbiAqIEBwYXJhbSBtb2RlbCB0aGUgb2JqZWN0IHRvIGJlIG1hZGUgYmluZGFibGVcbiAqIEBwYXJhbSBpbmNsdWRlcyAob3B0aW9uYWwpIHRoZSBkZWVwIGluY2x1ZGVzIGZvciBlYWdlciBsb2FkaW5nXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBjcmVhdGVCaW5kYWJsZTxUPihtb2RlbDogVCwgaW5jbHVkZXM/OiBhbnkpOiBCaW5kYWJsZTxUPiB7XG5cbiAgICBsZXQgZXh0ZW5zaW9uID0gbmV3IE1vZGVsRXh0ZW5zaW9ucygpO1xuXG4gICAgbGV0IGJpbmRhYmxlTW9kZWw6IEJpbmRhYmxlPFQ+ID0gbWVyZ2VPYmplY3RzKG1vZGVsLCBleHRlbnNpb24pO1xuXG4gICAgYmluZGFibGVNb2RlbC5pbmNsdWRlcyA9IE9iamVjdC5hc3NpZ24oaW5jbHVkZXMgfHwge30sIGJpbmRhYmxlTW9kZWwuaW5jbHVkZXMpO1xuXG4gICAgLyogc3Vic2NyaWJlIHRvIHRoZSBLbm9ja291dCBjaGFuZ2VzXG4gICAgICogZW51bWVyYXRlIHVzaW5nIGtleXMoKSBhbmQgZmlsdGVyIG91dCBwcm90b3lwZSBmdW5jdGlvbnMgd2l0aCBoYXNPd25Qcm9wZXJ0eSgpIGluIHN0ZWFkIG9mIHVzaW5nIFxuICAgICAqIGdldE93blByb3BlcnR5TmFtZXMoKSwgYmVjYXVzZSB0aGUgbGF0dGVyIGFsc28gcmV0dXJucyBub24tZW51bWVyYWJsZXMgKi9cbiAgICBmb3IgKGxldCBrZXkgb2YgT2JqZWN0LmtleXMoYmluZGFibGVNb2RlbCkpIHtcbiAgICAgICAgaWYgKCFiaW5kYWJsZU1vZGVsLmhhc093blByb3BlcnR5KGtleSkpIGNvbnRpbnVlO1xuXG4gICAgICAgIGxldCBwcm9wZXJ0eTogYW55ID0gKDxhbnk+YmluZGFibGVNb2RlbClba2V5XTtcblxuICAgICAgICAvKiBCaW5kIGxpc3RlbmVycyB0byB0aGUgcHJvcGVydGllcyAqL1xuICAgICAgICBpZiAoa28uaXNPYnNlcnZhYmxlKHByb3BlcnR5KSAmJlxuICAgICAgICAgICAgKCFrby5pc09ic2VydmFibGVBcnJheShwcm9wZXJ0eSkgfHwgISg8YW55PmJpbmRhYmxlTW9kZWwuaW5jbHVkZXMpW2tleV0pICYmXG4gICAgICAgICAgICAha28uaXNDb21wdXRlZChwcm9wZXJ0eSkpIHtcbiAgICAgICAgICAgICgoZWxlbWVudE5hbWU6IHN0cmluZyk6IHZvaWQgPT4ge1xuICAgICAgICAgICAgICAgIHByb3BlcnR5LnN1YnNjcmliZSgodmFsdWU6IGFueSk6IHZvaWQgPT4ge1xuICAgICAgICAgICAgICAgICAgICAvL2xvZ2dpbmcuZGVidWcoJ0tub2Nrb3V0IG9ic2VydmFibGUgcHJvcGVydHkgXCInICsgZWxlbWVudE5hbWUgKyAnXCIgY2hhbmdlZC4gTG9jYWxPbmx5OiAnICsgYmluZGFibGVNb2RlbC5sb2NrKTtcblxuICAgICAgICAgICAgICAgICAgICAvKiBpZ25vcmUgdXBkYXRlcyB0cmlnZ2VyZWQgYnkgaW5jb21pbmcgY2hhbmdlcyBmcm9tIEZpcmViYXNlICovXG4gICAgICAgICAgICAgICAgICAgIGlmICghYmluZGFibGVNb2RlbC5sb2NrKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAoYmluZGFibGVNb2RlbC50d29XYXlCaW5kaW5nKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgYmluZGFibGVNb2RlbC5zYXZlUHJvcGVydHkoZWxlbWVudE5hbWUsIHZhbHVlKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgIGVsc2UgaWYgKGJpbmRhYmxlTW9kZWwuc3RhdGUoKSAhPSAxKSB7IC8qIGlmIHN0YXRlIGlzIE5FVyBrZWVwIGl0IGluIHRoaXMgc3RhdGUgdW50aWxsIGl0IGlzIHNhdmVkLCBldmVuIGlmIGl0J3MgbW9kaWZpZWQgaW4gdGhlIG1lYW4gdGltZSAqL1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGJpbmRhYmxlTW9kZWwuc3RhdGUoMik7IC8qIE1PRElGSUVEICovXG4gICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIH0pKGtleSk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICByZXR1cm4gYmluZGFibGVNb2RlbDtcbn1cbiJdfQ==