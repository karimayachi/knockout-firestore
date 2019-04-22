"use strict";
exports.__esModule = true;
var Bindable_1 = require("./Bindable");
var helpers_1 = require("./helpers");
var knockout_firestore_1 = require("./knockout-firestore");
var ArrayExtensions = /** @class */ (function () {
    function ArrayExtensions() {
        this.localOnly = false;
        this.twoWayBinding = false;
    }
    ArrayExtensions.prototype.getDocument = function (id) {
        /* assume 'this' is merged with an ObservableArray */
        var contents = this();
        for (var _i = 0, contents_1 = contents; _i < contents_1.length; _i++) {
            var doc = contents_1[_i];
            /* assume all documents are converted to Bindable */
            var bindableDoc = doc;
            if (bindableDoc.fsDocumentId === id)
                return bindableDoc;
        }
        return null;
    };
    ArrayExtensions.prototype.detach = function (item) {
        /* assume 'this' is merged with an ObservableArray */
        var observableArray = this;
        /* if this collection is Two-Way bound, just delete */
        if (observableArray.twoWayBinding) {
            observableArray.remove(item);
        }
        else {
            /* assume all items are converted to Bindable */
            item.state(3); /* DELETED */
            /* use Knockout's internal _destroy property to filter this item out of the UI */
            observableArray.destroy(item);
            //logging.debug('Document "' + item.fsDocumentId + '" detached from local collection.');
        }
    };
    ArrayExtensions.prototype.saveAll = function () {
        /* assume 'this' is merged with an ObservableArray */
        var contents = this();
        for (var _i = 0, contents_2 = contents; _i < contents_2.length; _i++) {
            var item = contents_2[_i];
            /* assume all items are converted to Bindable */
            var bindableItem = item;
            if (bindableItem.state() !== 0) {
                bindableItem.save();
            }
        }
    };
    return ArrayExtensions;
}());
exports.ArrayExtensions = ArrayExtensions;
function createBindableArray(koObservableArray) {
    var extension = new ArrayExtensions();
    var bindableArray = helpers_1.mergeObjects(koObservableArray, extension);
    bindableArray.subscribe(collectionChanged, bindableArray, 'arrayChange');
    return bindableArray;
}
exports.createBindableArray = createBindableArray;
function collectionChanged(changes) {
    /* if local only change (e.g. triggered by load from Firestore) return */
    /* also return if the collection is not set, which should'nt be able to happen, but to satisfy the type system, check for it */
    if (this.localOnly || this.fsCollection === undefined) {
        return;
    }
    var _loop_1 = function (change) {
        var item = change.value;
        switch (change.status) {
            case 'added':
                /* extend the Model with the ObservableDocument functionality
                 * extend / overrule the includes with includes from passed options (only one level) */
                var bindable_1 = Bindable_1.createBindable(item, this_1.includes);
                bindable_1.twoWayBinding = this_1.twoWayBinding;
                if (this_1.twoWayBinding) {
                    //logging.debug('Adding new document to Firestore collection "' + this.fsCollection.id + '"');
                    this_1.fsCollection.add(bindable_1.getFlatDocument())
                        .then(function (doc) {
                        bindable_1.fsBaseCollection = doc.parent;
                        bindable_1.fsDocumentId = doc.id;
                        /* get deep includes for Array properties
                         * TODO: fix that the deep linking is done here AND in explodeObject in knockout.firestore.js */
                        createAndBindDeepIncludes(bindable_1);
                    })["catch"](function (error) {
                        //logging.error('Error saving Firestore document :', error);
                    });
                }
                else {
                    //logging.debug('Adding new document to local collection only');
                    bindable_1.state(1); /* NEW */
                    bindable_1.fsBaseCollection = this_1.fsCollection;
                }
                break;
            case 'deleted':
                if (this_1.twoWayBinding) {
                    //logging.debug('Deleting document "' + item.fsDocumentId + '" from Firestore collection "' + this.fsCollection.id + '"');
                    var bindable_2 = item;
                    if (bindable_2.fsBaseCollection === undefined) {
                        return "continue";
                    } /* can't happen, but satisfy the type system by checking */
                    bindable_2.fsBaseCollection.doc(bindable_2.fsDocumentId)["delete"]()["catch"](function (error) {
                        //logging.error('Error deleting Firestore document :', error);
                    });
                }
                else {
                    //logging.debug('Document "' + item.fsDocumentId + '" removed from local collection.');
                    //logging.debug('You\'re not using Two-Way binding, please use .detach() in stead of .remove() to persist the change when syncing to Firestore');
                }
                break;
        }
    };
    var this_1 = this;
    for (var _i = 0, changes_1 = changes; _i < changes_1.length; _i++) {
        var change = changes_1[_i];
        _loop_1(change);
    }
}
function createAndBindDeepIncludes(item) {
    /* enumerate using keys() and filter out protoype functions with hasOwnProperty() in stead of using
     * getOwnPropertyNames(), because the latter also returns non-enumerables */
    for (var _i = 0, _a = Object.keys(item); _i < _a.length; _i++) {
        var key = _a[_i];
        if (!item.hasOwnProperty(key) || item.fsBaseCollection === undefined)
            continue;
        var property = item[key];
        /* get deep includes for Array properties */
        if (ko.isObservableArray(property) && item.includes && item.includes[key]) {
            var include = item.includes[key];
            var collectionRef = item.fsBaseCollection
                .doc(item.fsDocumentId)
                .collection(key);
            knockout_firestore_1.kofs.bindCollection(property, collectionRef, include["class"], { twoWayBinding: item.twoWayBinding, orderBy: include.orderBy });
            /* if the collection was locally already filled with data */
            /* TODO: Transaction for speed */
            for (var _b = 0, _c = property(); _b < _c.length; _b++) {
                var childItem = _c[_b];
                var bindableChild = Bindable_1.createBindable(childItem, {});
                bindableChild.fsBaseCollection = collectionRef;
                bindableChild.twoWayBinding = item.twoWayBinding;
                bindableChild.state(1); /* NEW */
                bindableChild.save();
            }
        }
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiQmluZGFibGVBcnJheS5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uL3NyYy9CaW5kYWJsZUFycmF5LnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7O0FBRUEsdUNBQXVFO0FBQ3ZFLHFDQUF5QztBQUN6QywyREFBNEM7QUFNNUM7SUFPSTtRQUNJLElBQUksQ0FBQyxTQUFTLEdBQUcsS0FBSyxDQUFDO1FBQ3ZCLElBQUksQ0FBQyxhQUFhLEdBQUcsS0FBSyxDQUFDO0lBQy9CLENBQUM7SUFFRCxxQ0FBVyxHQUFYLFVBQVksRUFBVTtRQUNsQixxREFBcUQ7UUFDckQsSUFBSSxRQUFRLEdBQW9DLElBQUssRUFBRSxDQUFDO1FBRXhELEtBQWdCLFVBQVEsRUFBUixxQkFBUSxFQUFSLHNCQUFRLEVBQVIsSUFBUSxFQUFFO1lBQXJCLElBQUksR0FBRyxpQkFBQTtZQUNSLG9EQUFvRDtZQUNwRCxJQUFJLFdBQVcsR0FBNkIsR0FBRyxDQUFDO1lBRWhELElBQUksV0FBVyxDQUFDLFlBQVksS0FBSyxFQUFFO2dCQUMvQixPQUFPLFdBQVcsQ0FBQztTQUMxQjtRQUVELE9BQU8sSUFBSSxDQUFDO0lBQ2hCLENBQUM7SUFFRCxnQ0FBTSxHQUFOLFVBQU8sSUFBTztRQUNWLHFEQUFxRDtRQUNyRCxJQUFJLGVBQWUsR0FBaUQsSUFBSyxDQUFDO1FBRTFFLHNEQUFzRDtRQUN0RCxJQUFJLGVBQWUsQ0FBQyxhQUFhLEVBQUU7WUFDL0IsZUFBZSxDQUFDLE1BQU0sQ0FBQyxJQUFJLENBQUMsQ0FBQztTQUNoQzthQUNJO1lBQ0QsZ0RBQWdEO1lBQ2xDLElBQUssQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxhQUFhO1lBRTNDLGlGQUFpRjtZQUNqRixlQUFlLENBQUMsT0FBTyxDQUFDLElBQUksQ0FBQyxDQUFDO1lBRTlCLHdGQUF3RjtTQUMzRjtJQUNMLENBQUM7SUFFRCxpQ0FBTyxHQUFQO1FBQ0kscURBQXFEO1FBQ3JELElBQUksUUFBUSxHQUFv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QUNuRSxhQUFhLENBQUMsZ0JBQWdCLEdBQUcsYUFBYSxDQUFDO2dCQUMvQyxhQUFhLENBQUMsYUFBYSxHQUFHLElBQUksQ0FBQyxhQUFhLENBQUM7Z0JBQ2pELGFBQWEsQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxTQUFTO2dCQUNqQyxhQUFhLENBQUMsSUFBSSxFQUFFLENBQUM7YUFDeEI7U0FDSjtLQUNKO0FBQ0wsQ0FBQyIsInNvdXJjZXNDb250ZW50IjpbImltcG9ydCBrbm9ja291dCwgeyBPYnNlcnZhYmxlQXJyYXksIHV0aWxzIH0gZnJvbSAna25vY2tvdXQnO1xuaW1wb3J0IHsgZmlyZXN0b3JlIH0gZnJvbSAnZmlyZWJhc2UnO1xuaW1wb3J0IHsgQmluZGFibGUsIGNyZWF0ZUJpbmRhYmxlLCBNb2RlbEV4dGVuc2lvbnMgfSBmcm9tICcuL0JpbmRhYmxlJztcbmltcG9ydCB7IG1lcmdlT2JqZWN0cyB9IGZyb20gJy4vaGVscGVycyc7XG5pbXBvcnQgeyBrb2ZzIH0gZnJvbSAnLi9rbm9ja291dC1maXJlc3RvcmUnO1xuXG5kZWNsYXJlIHZhciBrbzogdHlwZW9mIGtub2Nrb3V0OyAvKiBhbGlhcyB0aGUgbmFtZXNwYWNlIHRvIGF2b2lkIGltcG9ydGluZyB0aGUgbW9kdWxlLCBidXQgc3RpbGwgdXNlIHRoZSB0eXBpbmdzICovXG5cbmV4cG9ydCB0eXBlIEJpbmRhYmxlQXJyYXk8VD4gPSBPYnNlcnZhYmxlQXJyYXk8VD4gJiBBcnJheUV4dGVuc2lvbnM8VD47XG5cbmV4cG9ydCBjbGFzcyBBcnJheUV4dGVuc2lvbnM8VD4ge1xuICAgIGZzUXVlcnk/OiBmaXJlc3RvcmUuUXVlcnk7XG4gICAgZnNDb2xsZWN0aW9uPzogZmlyZXN0b3JlLkNvbGxlY3Rpb25SZWZlcmVuY2U7XG4gICAgaW5jbHVkZXM/OiB7IFtrZXk6IHN0cmluZ106IHsgY2xhc3M6IG5ldyAoKSA9PiBhbnksIG9yZGVyQnk6IHN0cmluZ1tdIHwgc3RyaW5nW11bXSB9IH07XG4gICAgbG9jYWxPbmx5OiBib29sZWFuO1xuICAgIHR3b1dheUJpbmRpbmc6IGJvb2xlYW47XG5cbiAgICBjb25zdHJ1Y3RvcigpIHtcbiAgICAgICAgdGhpcy5sb2NhbE9ubHkgPSBmYWxzZTtcbiAgICAgICAgdGhpcy50d29XYXlCaW5kaW5nID0gZmFsc2U7XG4gICAgfVxuXG4gICAgZ2V0RG9jdW1lbnQoaWQ6IHN0cmluZyk6IEJpbmRhYmxlPFQ+IHwgbnVsbCB7XG4gICAgICAgIC8qIGFzc3VtZSAndGhpcycgaXMgbWVyZ2VkIHdpdGggYW4gT2JzZXJ2YWJsZUFycmF5ICovXG4gICAgICAgIGxldCBjb250ZW50czogVFtdID0gKDxCaW5kYWJsZUFycmF5PFQ+Pjx1bmtub3duPnRoaXMpKCk7XG5cbiAgICAgICAgZm9yIChsZXQgZG9jIG9mIGNvbnRlbnRzKSB7XG4gICAgICAgICAgICAvKiBhc3N1bWUgYWxsIGRvY3VtZW50cyBhcmUgY29udmVydGVkIHRvIEJpbmRhYmxlICovXG4gICAgICAgICAgICBsZXQgYmluZGFibGVEb2M6IEJpbmRhYmxlPFQ+ID0gPEJpbmRhYmxlPFQ+PmRvYztcblxuICAgICAgICAgICAgaWYgKGJpbmRhYmxlRG9jLmZzRG9jdW1lbnRJZCA9PT0gaWQpXG4gICAgICAgICAgICAgICAgcmV0dXJuIGJpbmRhYmxlRG9jO1xuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIG51bGw7XG4gICAgfVxuXG4gICAgZGV0YWNoKGl0ZW06IFQpOiB2b2lkIHtcbiAgICAgICAgLyogYXNzdW1lICd0aGlzJyBpcyBtZXJnZWQgd2l0aCBhbiBPYnNlcnZhYmxlQXJyYXkgKi9cbiAgICAgICAgbGV0IG9ic2VydmFibGVBcnJheTogQmluZGFibGVBcnJheTxUPiA9ICg8QmluZGFibGVBcnJheTxUPj48dW5rbm93bj50aGlzKTtcblxuICAgICAgICAvKiBpZiB0aGlzIGNvbGxlY3Rpb24gaXMgVHdvLVdheSBib3VuZCwganVzdCBkZWxldGUgKi9cbiAgICAgICAgaWYgKG9ic2VydmFibGVBcnJheS50d29XYXlCaW5kaW5nKSB7XG4gICAgICAgICAgICBvYnNlcnZhYmxlQXJyYXkucmVtb3ZlKGl0ZW0pO1xuICAgICAgICB9XG4gICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgLyogYXNzdW1lIGFsbCBpdGVtcyBhcmUgY29udmVydGVkIHRvIEJpbmRhYmxlICovXG4gICAgICAgICAgICAoPEJpbmRhYmxlPFQ+Pml0ZW0pLnN0YXRlKDMpOyAvKiBERUxFVEVEICovXG5cbiAgICAgICAgICAgIC8qIHVzZSBLbm9ja291dCdzIGludGVybmFsIF9kZXN0cm95IHByb3BlcnR5IHRvIGZpbHRlciB0aGlzIGl0ZW0gb3V0IG9mIHRoZSBVSSAqL1xuICAgICAgICAgICAgb2JzZXJ2YWJsZUFycmF5LmRlc3Ryb3koaXRlbSk7XG5cbiAgICAgICAgICAgIC8vbG9nZ2luZy5kZWJ1ZygnRG9jdW1lbnQgXCInICsgaXRlbS5mc0RvY3VtZW50SWQgKyAnXCIgZGV0YWNoZWQgZnJvbSBsb2NhbCBjb2xsZWN0aW9uLicpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgc2F2ZUFsbCgpOiB2b2lkIHtcbiAgICAgICAgLyogYXNzdW1lICd0aGlzJyBpcyBtZXJnZWQgd2l0aCBhbiBPYnNlcnZhYmxlQXJyYXkgKi9cbiAgICAgICAgbGV0IGNvbnRlbnRzOiBUW10gPSAoPEJpbmRhYmxlQXJyYXk8VD4+PHVua25vd24+dGhpcykoKTtcblxuICAgICAgICBmb3IgKGxldCBpdGVtIG9mIGNvbnRlbnRzKSB7XG4gICAgICAgICAgICAvKiBhc3N1bWUgYWxsIGl0ZW1zIGFyZSBjb252ZXJ0ZWQgdG8gQmluZGFibGUgKi9cbiAgICAgICAgICAgIGxldCBiaW5kYWJsZUl0ZW06IEJpbmRhYmxlPFQ+ID0gPEJpbmRhYmxlPFQ+Pml0ZW1cblxuICAgICAgICAgICAgaWYgKGJpbmRhYmxlSXRlbS5zdGF0ZSgpICE9PSAwKSB7XG4gICAgICAgICAgICAgICAgYmluZGFibGVJdGVtLnNhdmUoKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH1cbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGNyZWF0ZUJpbmRhYmxlQXJyYXk8VD4oa29PYnNlcnZhYmxlQXJyYXk6IE9ic2VydmFibGVBcnJheTxUPik6IEJpbmRhYmxlQXJyYXk8VD4ge1xuXG4gICAgbGV0IGV4dGVuc2lvbjogQXJyYXlFeHRlbnNpb25zPFQ+ID0gbmV3IEFycmF5RXh0ZW5zaW9ucygpO1xuXG4gICAgbGV0IGJpbmRhYmxlQXJyYXk6IEJpbmRhYmxlQXJyYXk8VD4gPSBtZXJnZU9iamVjdHMoa29PYnNlcnZhYmxlQXJyYXksIGV4dGVuc2lvbik7XG4gICAgYmluZGFibGVBcnJheS5zdWJzY3JpYmU8QmluZGFibGVBcnJheTxUPj4oY29sbGVjdGlvbkNoYW5nZWQsIGJpbmRhYmxlQXJyYXksICdhcnJheUNoYW5nZScpO1xuXG4gICAgcmV0dXJuIGJpbmRhYmxlQXJyYXk7XG59XG5cbmZ1bmN0aW9uIGNvbGxlY3Rpb25DaGFuZ2VkPFQ+KHRoaXM6IEFycmF5RXh0ZW5zaW9uczxUPiwgY2hhbmdlczogdXRpbHMuQXJyYXlDaGFuZ2VzPFQ+KSB7XG4gICAgLyogaWYgbG9jYWwgb25seSBjaGFuZ2UgKGUuZy4gdHJpZ2dlcmVkIGJ5IGxvYWQgZnJvbSBGaXJlc3RvcmUpIHJldHVybiAqL1xuICAgIC8qIGFsc28gcmV0dXJuIGlmIHRoZSBjb2xsZWN0aW9uIGlzIG5vdCBzZXQsIHdoaWNoIHNob3VsZCdudCBiZSBhYmxlIHRvIGhhcHBlbiwgYnV0IHRvIHNhdGlzZnkgdGhlIHR5cGUgc3lzdGVtLCBjaGVjayBmb3IgaXQgKi9cbiAgICBpZiAodGhpcy5sb2NhbE9ubHkgfHwgdGhpcy5mc0NvbGxlY3Rpb24gPT09IHVuZGVmaW5lZCkgeyByZXR1cm47IH1cblxuICAgIGZvciAobGV0IGNoYW5nZSBvZiBjaGFuZ2VzKSB7XG4gICAgICAgIGxldCBpdGVtOiBUID0gY2hhbmdlLnZhbHVlO1xuXG4gICAgICAgIHN3aXRjaCAoY2hhbmdlLnN0YXR1cykge1xuICAgICAgICAgICAgY2FzZSAnYWRkZWQnOlxuICAgICAgICAgICAgICAgIC8qIGV4dGVuZCB0aGUgTW9kZWwgd2l0aCB0aGUgT2JzZXJ2YWJsZURvY3VtZW50IGZ1bmN0aW9uYWxpdHlcbiAgICAgICAgICAgICAgICAgKiBleHRlbmQgLyBvdmVycnVsZSB0aGUgaW5jbHVkZXMgd2l0aCBpbmNsdWRlcyBmcm9tIHBhc3NlZCBvcHRpb25zIChvbmx5IG9uZSBsZXZlbCkgKi9cbiAgICAgICAgICAgICAgICBsZXQgYmluZGFibGU6IEJpbmRhYmxlPFQ+ID0gY3JlYXRlQmluZGFibGUoaXRlbSwgdGhpcy5pbmNsdWRlcyk7XG4gICAgICAgICAgICAgICAgYmluZGFibGUudHdvV2F5QmluZGluZyA9IHRoaXMudHdvV2F5QmluZGluZztcblxuICAgICAgICAgICAgICAgIGlmICh0aGlzLnR3b1dheUJpbmRpbmcpIHtcbiAgICAgICAgICAgICAgICAgICAgLy9sb2dnaW5nLmRlYnVnKCdBZGRpbmcgbmV3IGRvY3VtZW50IHRvIEZpcmVzdG9yZSBjb2xsZWN0aW9uIFwiJyArIHRoaXMuZnNDb2xsZWN0aW9uLmlkICsgJ1wiJyk7XG5cbiAgICAgICAgICAgICAgICAgICAgdGhpcy5mc0NvbGxlY3Rpb24uYWRkKGJpbmRhYmxlLmdldEZsYXREb2N1bWVudCgpKVxuICAgICAgICAgICAgICAgICAgICAgICAgLnRoZW4oKGRvYzogZmlyZXN0b3JlLkRvY3VtZW50UmVmZXJlbmNlKTogdm9pZCA9PiB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgYmluZGFibGUuZnNCYXNlQ29sbGVjdGlvbiA9IGRvYy5wYXJlbnQ7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgYmluZGFibGUuZnNEb2N1bWVudElkID0gZG9jLmlkO1xuXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgLyogZ2V0IGRlZXAgaW5jbHVkZXMgZm9yIEFycmF5IHByb3BlcnRpZXMgXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICogVE9ETzogZml4IHRoYXQgdGhlIGRlZXAgbGlua2luZyBpcyBkb25lIGhlcmUgQU5EIGluIGV4cGxvZGVPYmplY3QgaW4ga25vY2tvdXQuZmlyZXN0b3JlLmpzICovXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgY3JlYXRlQW5kQmluZERlZXBJbmNsdWRlcyhiaW5kYWJsZSk7XG4gICAgICAgICAgICAgICAgICAgICAgICB9KS5jYXRjaChmdW5jdGlvbiAoZXJyb3IpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAvL2xvZ2dpbmcuZXJyb3IoJ0Vycm9yIHNhdmluZyBGaXJlc3RvcmUgZG9jdW1lbnQgOicsIGVycm9yKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgLy9sb2dnaW5nLmRlYnVnKCdBZGRpbmcgbmV3IGRvY3VtZW50IHRvIGxvY2FsIGNvbGxlY3Rpb24gb25seScpO1xuICAgICAgICAgICAgICAgICAgICBiaW5kYWJsZS5zdGF0ZSgxKTsgLyogTkVXICovXG4gICAgICAgICAgICAgICAgICAgIGJpbmRhYmxlLmZzQmFzZUNvbGxlY3Rpb24gPSB0aGlzLmZzQ29sbGVjdGlvbjtcbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgIGNhc2UgJ2RlbGV0ZWQnOlxuICAgICAgICAgICAgICAgIGlmICh0aGlzLnR3b1dheUJpbmRpbmcpIHtcbiAgICAgICAgICAgICAgICAgICAgLy9sb2dnaW5nLmRlYnVnKCdEZWxldGluZyBkb2N1bWVudCBcIicgKyBpdGVtLmZzRG9jdW1lbnRJZCArICdcIiBmcm9tIEZpcmVzdG9yZSBjb2xsZWN0aW9uIFwiJyArIHRoaXMuZnNDb2xsZWN0aW9uLmlkICsgJ1wiJyk7XG5cbiAgICAgICAgICAgICAgICAgICAgbGV0IGJpbmRhYmxlOiBCaW5kYWJsZTxUPiA9IDxCaW5kYWJsZTxUPj5pdGVtO1xuXG4gICAgICAgICAgICAgICAgICAgIGlmIChiaW5kYWJsZS5mc0Jhc2VDb2xsZWN0aW9uID09PSB1bmRlZmluZWQpIHsgY29udGludWU7IH0gLyogY2FuJ3QgaGFwcGVuLCBidXQgc2F0aXNmeSB0aGUgdHlwZSBzeXN0ZW0gYnkgY2hlY2tpbmcgKi9cblxuICAgICAgICAgICAgICAgICAgICBiaW5kYWJsZS5mc0Jhc2VDb2xsZWN0aW9uLmRvYyhiaW5kYWJsZS5mc0RvY3VtZW50SWQpXG4gICAgICAgICAgICAgICAgICAgICAgICAuZGVsZXRlKClcbiAgICAgICAgICAgICAgICAgICAgICAgIC5jYXRjaCgoZXJyb3I6IGFueSk6IHZvaWQgPT4ge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIC8vbG9nZ2luZy5lcnJvcignRXJyb3IgZGVsZXRpbmcgRmlyZXN0b3JlIGRvY3VtZW50IDonLCBlcnJvcik7XG4gICAgICAgICAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgIC8vbG9nZ2luZy5kZWJ1ZygnRG9jdW1lbnQgXCInICsgaXRlbS5mc0RvY3VtZW50SWQgKyAnXCIgcmVtb3ZlZCBmcm9tIGxvY2FsIGNvbGxlY3Rpb24uJyk7XG4gICAgICAgICAgICAgICAgICAgIC8vbG9nZ2luZy5kZWJ1ZygnWW91XFwncmUgbm90IHVzaW5nIFR3by1XYXkgYmluZGluZywgcGxlYXNlIHVzZSAuZGV0YWNoKCkgaW4gc3RlYWQgb2YgLnJlbW92ZSgpIHRvIHBlcnNpc3QgdGhlIGNoYW5nZSB3aGVuIHN5bmNpbmcgdG8gRmlyZXN0b3JlJyk7XG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgIH1cbiAgICB9XG59XG5cbmZ1bmN0aW9uIGNyZWF0ZUFuZEJpbmREZWVwSW5jbHVkZXM8VD4oaXRlbTogQmluZGFibGU8VD4pIHtcbiAgICAvKiBlbnVtZXJhdGUgdXNpbmcga2V5cygpIGFuZCBmaWx0ZXIgb3V0IHByb3RveXBlIGZ1bmN0aW9ucyB3aXRoIGhhc093blByb3BlcnR5KCkgaW4gc3RlYWQgb2YgdXNpbmcgXG4gICAgICogZ2V0T3duUHJvcGVydHlOYW1lcygpLCBiZWNhdXNlIHRoZSBsYXR0ZXIgYWxzbyByZXR1cm5zIG5vbi1lbnVtZXJhYmxlcyAqL1xuICAgIGZvciAobGV0IGtleSBvZiBPYmplY3Qua2V5cyhpdGVtKSkge1xuXG4gICAgICAgIGlmICghaXRlbS5oYXNPd25Qcm9wZXJ0eShrZXkpIHx8IGl0ZW0uZnNCYXNlQ29sbGVjdGlvbiA9PT0gdW5kZWZpbmVkKSBjb250aW51ZTtcblxuICAgICAgICBsZXQgcHJvcGVydHkgPSAoPGFueT5pdGVtKVtrZXldO1xuXG4gICAgICAgIC8qIGdldCBkZWVwIGluY2x1ZGVzIGZvciBBcnJheSBwcm9wZXJ0aWVzICovXG4gICAgICAgIGlmIChrby5pc09ic2VydmFibGVBcnJheShwcm9wZXJ0eSkgJiYgaXRlbS5pbmNsdWRlcyAmJiAoPGFueT5pdGVtLmluY2x1ZGVzKVtrZXldKSB7XG4gICAgICAgICAgICBsZXQgaW5jbHVkZSA9ICg8YW55Pml0ZW0uaW5jbHVkZXMpW2tleV07XG4gICAgICAgICAgICBsZXQgY29sbGVjdGlvblJlZiA9IGl0ZW0uZnNCYXNlQ29sbGVjdGlvblxuICAgICAgICAgICAgICAgIC5kb2MoaXRlbS5mc0RvY3VtZW50SWQpXG4gICAgICAgICAgICAgICAgLmNvbGxlY3Rpb24oa2V5KTtcblxuICAgICAgICAgICAga29mcy5iaW5kQ29sbGVjdGlvbihwcm9wZXJ0eSwgY29sbGVjdGlvblJlZiwgaW5jbHVkZS5jbGFzcywgeyB0d29XYXlCaW5kaW5nOiBpdGVtLnR3b1dheUJpbmRpbmcsIG9yZGVyQnk6IGluY2x1ZGUub3JkZXJCeSB9KTtcblxuICAgICAgICAgICAgLyogaWYgdGhlIGNvbGxlY3Rpb24gd2FzIGxvY2FsbHkgYWxyZWFkeSBmaWxsZWQgd2l0aCBkYXRhICovXG4gICAgICAgICAgICAvKiBUT0RPOiBUcmFuc2FjdGlvbiBmb3Igc3BlZWQgKi9cbiAgICAgICAgICAgIGZvciAobGV0IGNoaWxkSXRlbSBvZiBwcm9wZXJ0eSgpKSB7XG4gICAgICAgICAgICAgICAgbGV0IGJpbmRhYmxlQ2hpbGQ6IE1vZGVsRXh0ZW5zaW9ucyA9IGNyZWF0ZUJpbmRhYmxlKGNoaWxkSXRlbSwge30pO1xuICAgICAgICAgICAgICAgIGJpbmRhYmxlQ2hpbGQuZnNCYXNlQ29sbGVjdGlvbiA9IGNvbGxlY3Rpb25SZWY7XG4gICAgICAgICAgICAgICAgYmluZGFibGVDaGlsZC50d29XYXlCaW5kaW5nID0gaXRlbS50d29XYXlCaW5kaW5nO1xuICAgICAgICAgICAgICAgIGJpbmRhYmxlQ2hpbGQuc3RhdGUoMSk7IC8qIE5FVyAqL1xuICAgICAgICAgICAgICAgIGJpbmRhYmxlQ2hpbGQuc2F2ZSgpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfVxufSJdfQ==