"use strict";
exports.__esModule = true;
var BindableArray_1 = require("./BindableArray");
var Bindable_1 = require("./Bindable");
var kofs;
(function (kofs) {
    function getBoundCollection(fsCollection, model, options) {
        /* create the collection as a ko.observableArray and bind it */
        var observableArray = ko.observableArray();
        bindCollection(observableArray, fsCollection, model, options);
        return observableArray;
    }
    kofs.getBoundCollection = getBoundCollection;
    function bindCollection(observableArray, fsCollection, model, options) {
        /* settings */
        options = options || {};
        var where = options.where || [];
        var orderBy = options.orderBy || [];
        var includes = options.includes || {};
        var twoWayBinding = typeof options.twoWayBinding === 'undefined' ? true : options.twoWayBinding;
        /* set log level */
        //if (options.logLevel) { logging.setLogLevel(options.logLevel); }
        /* create the Firestore query from the collection and the options */
        var query = createFirestoreQuery(fsCollection, where, orderBy);
        /* extend the observableArray with our functions */
        var bindableArray = BindableArray_1.createBindableArray(observableArray);
        bindableArray.twoWayBinding = twoWayBinding;
        bindableArray.fsQuery = query;
        bindableArray.fsCollection = fsCollection;
        bindableArray.includes = includes;
        /* subscribe to the Firestore collection */
        query.onSnapshot(function (snapshot) {
            snapshot.docChanges().forEach(function (change) {
                /* ignore local changes */
                if (!change.doc.metadata.hasPendingWrites) {
                    if (change.type === 'added') {
                        //logging.debug('Firestore object ' + change.doc.id + ' added to collection');
                        var item = new model();
                        var index = change.newIndex;
                        /* extend the Model with the Bindable functionality */
                        var combinedIncludes = Object.assign(includes, item.includes);
                        var bindableItem = Bindable_1.createBindable(item, combinedIncludes);
                        /* fill the new object with meta-data
                         * extend / overrule the includes with includes from the passed options */
                        bindableItem.fsBaseCollection = change.doc.ref.parent;
                        bindableItem.fsDocumentId = change.doc.id;
                        bindableItem.twoWayBinding = twoWayBinding;
                        /* explode the data AND deep include if two-way */
                        explodeObject(change.doc, bindableItem, twoWayBinding);
                        /* set the collection to localOnly to ignore these incoming changes from Firebase */
                        bindableArray.localOnly = true;
                        bindableArray.splice(index, 0, bindableItem);
                        bindableArray.localOnly = false;
                    }
                    if (change.type === "modified") {
                        //logging.debug('Firestore object ' + change.doc.id + ' modified');
                        var localDoc = bindableArray.getDocument(change.doc.id);
                        if (localDoc != null) {
                            /* explode the data, but don't mess with the deep includes */
                            explodeObject(change.doc, localDoc, false);
                        }
                        else {
                            //logging.debug('Firestore object ' + change.doc.id + ' not found in local collection');
                        }
                    }
                    if (change.type === "removed") {
                        //logging.debug('Firestore object ' + change.doc.id + ' removed from collection');
                        var localDoc = bindableArray.getDocument(change.doc.id);
                        if (localDoc != null) {
                            bindableArray.localOnly = true;
                            bindableArray.remove(localDoc);
                            bindableArray.localOnly = false;
                        }
                        else {
                            /* when removing from Firestore, the snapshot is triggered, so it will try to remove it again when it's no longer there */
                            //logging.debug('Firestore object ' + change.doc.id + ' not (longer) found in local collection');
                        }
                    }
                }
            });
        });
    }
    kofs.bindCollection = bindCollection;
    function createFirestoreQuery(collection, where, orderBy) {
        /* convert our where and orderby arrays to real Firestore queries */
        var query = collection;
        if (where != null && Array.isArray(where) && where.length > 0) {
            if (Array.isArray(where[0])) {
                for (var _i = 0, where_1 = where; _i < where_1.length; _i++) {
                    var whereClause = where_1[_i];
                    query = query.where(whereClause[0], whereClause[1], whereClause[2]);
                }
            }
            else {
                query = query.where(where[0], where[1], where[2]);
            }
        }
        if (orderBy != null && Array.isArray(orderBy) && orderBy.length > 0) {
            if (Array.isArray(orderBy[0])) {
                for (var _a = 0, orderBy_1 = orderBy; _a < orderBy_1.length; _a++) {
                    var orderByClause = orderBy_1[_a];
                    query = query.orderBy(orderByClause[0], orderByClause[1]);
                }
            }
            else {
                query = query.orderBy(orderBy[0], orderBy[1]);
            }
        }
        return query;
    }
    function explodeObject(firestoreDocument, localObject, deepInclude) {
        /* during update set lock on the file, so there will be no update loop */
        localObject.lock = true;
        /* enumerate using keys() and filter out protoype functions with hasOwnProperty() in stead of using
         * getOwnPropertyNames(), because the latter also returns non-enumerables */
        for (var _i = 0, _a = Object.keys(localObject); _i < _a.length; _i++) {
            var key = _a[_i];
            if (!localObject.hasOwnProperty(key))
                continue;
            var propertyData = void 0;
            var property = localObject[key];
            /* get data from Firestore for primitive properties */
            if (ko.isObservable(property) &&
                !ko.isObservableArray(property) &&
                !ko.isComputed(property)) {
                propertyData = firestoreDocument.get(key);
                switch (typeof propertyData) {
                    case 'undefined':
                        break;
                    case 'string':
                    case 'number':
                    case 'boolean':
                        property(propertyData);
                        break;
                    case 'object':
                        if (propertyData && typeof propertyData.toDate === 'function') { /* assume Firestore.Timestamp */
                            property(propertyData.toDate());
                        }
                        break;
                }
            }
            /* get regular arrays, or arrays not marked for deep inclusion */
            if (ko.isObservableArray(property) && !localObject.includes[key]) {
                propertyData = firestoreDocument.get(key);
                if (Array.isArray(propertyData)) {
                    property(propertyData);
                }
            }
            /* get deep includes for Array properties */
            if (deepInclude &&
                ko.isObservableArray(property) &&
                localObject.includes[key] &&
                localObject.fsBaseCollection !== undefined) {
                var include = localObject.includes[key];
                var collectionRef = localObject.fsBaseCollection.doc(localObject.fsDocumentId).collection(key);
                kofs.bindCollection(property, collectionRef, include["class"], { twoWayBinding: localObject.twoWayBinding, orderBy: include.orderBy });
            }
        }
        /* reset lock */
        localObject.lock = false;
    }
})(kofs = exports.kofs || (exports.kofs = {}));
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoia25vY2tvdXQtZmlyZXN0b3JlLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vc3JjL2tub2Nrb3V0LWZpcmVzdG9yZS50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOztBQUVBLGlEQUFxRTtBQUNyRSx1Q0FBc0Q7QUFJdEQsSUFBaUIsSUFBSSxDQXdMcEI7QUF4TEQsV0FBaUIsSUFBSTtJQVFqQixTQUFnQixrQkFBa0IsQ0FBSSxZQUEyQyxFQUFFLEtBQWtCLEVBQUUsT0FBWTtRQUMvRywrREFBK0Q7UUFDL0QsSUFBSSxlQUFlLEdBQXVCLEVBQUUsQ0FBQyxlQUFlLEVBQUUsQ0FBQztRQUUvRCxjQUFjLENBQUMsZUFBZSxFQUFFLFlBQVksRUFBRSxLQUFLLEVBQUUsT0FBTyxDQUFDLENBQUM7UUFFOUQsT0FBeUIsZUFBZSxDQUFDO0lBQzdDLENBQUM7SUFQZSx1QkFBa0IscUJBT2pDLENBQUE7SUFFRCxTQUFnQixjQUFjLENBQUksZUFBbUMsRUFBRSxZQUEyQyxFQUFFLEtBQWtCLEVBQUUsT0FBb0I7UUFDeEosY0FBYztRQUNkLE9BQU8sR0FBRyxPQUFPLElBQUksRUFBRSxDQUFDO1FBQ3hCLElBQUksS0FBSyxHQUFHLE9BQU8sQ0FBQyxLQUFLLElBQUksRUFBRSxDQUFDO1FBQ2hDLElBQUksT0FBTyxHQUFHLE9BQU8sQ0FBQyxPQUFPLElBQUksRUFBRSxDQUFDO1FBQ3BDLElBQUksUUFBUSxHQUFHLE9BQU8sQ0FBQyxRQUFRLElBQUksRUFBRSxDQUFDO1FBQ3RDLElBQUksYUFBYSxHQUFZLE9BQU8sT0FBTyxDQUFDLGFBQWEsS0FBSyxXQUFXLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsT0FBTyxDQUFDLGFBQWEsQ0FBQztRQUV6RyxtQkFBbUI7UUFDbkIsa0VBQWtFO1FBRWxFLG9FQUFvRTtRQUNwRSxJQUFJLEtBQUssR0FBb0Isb0JBQW9CLENBQWtCLFlBQVksRUFBRSxLQUFLLEVBQUUsT0FBTyxDQUFDLENBQUM7UUFF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WUFBSSxLQUFKLFlBQUksUUF3THBCIiwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IHsgZmlyZXN0b3JlIH0gZnJvbSAnZmlyZWJhc2UnO1xuaW1wb3J0IGtub2Nrb3V0LCB7IE9ic2VydmFibGVBcnJheSB9IGZyb20gJ2tub2Nrb3V0JztcbmltcG9ydCB7IEJpbmRhYmxlQXJyYXksIGNyZWF0ZUJpbmRhYmxlQXJyYXkgfSBmcm9tICcuL0JpbmRhYmxlQXJyYXknO1xuaW1wb3J0IHsgQmluZGFibGUsIGNyZWF0ZUJpbmRhYmxlIH0gZnJvbSAnLi9CaW5kYWJsZSc7XG5cbmRlY2xhcmUgdmFyIGtvOiB0eXBlb2Yga25vY2tvdXQ7IC8qIGFsaWFzIHRoZSBuYW1lc3BhY2UgdG8gYXZvaWQgaW1wb3J0aW5nIHRoZSBtb2R1bGUsIGJ1dCBzdGlsbCB1c2UgdGhlIHR5cGluZ3MgKi9cblxuZXhwb3J0IG5hbWVzcGFjZSBrb2ZzIHtcbiAgICBpbnRlcmZhY2UgS29mc09wdGlvbnMge1xuICAgICAgICB3aGVyZT86IHN0cmluZ1tdIHwgc3RyaW5nW11bXTtcbiAgICAgICAgb3JkZXJCeTogc3RyaW5nW10gfCBzdHJpbmdbXVtdO1xuICAgICAgICBpbmNsdWRlcz86IHsgW2tleTogc3RyaW5nXTogeyBjbGFzczogbmV3ICgpID0+IGFueSwgb3JkZXJCeTogc3RyaW5nW10gfCBzdHJpbmdbXVtdIH0gfTtcbiAgICAgICAgdHdvV2F5QmluZGluZzogYm9vbGVhbjtcbiAgICB9XG5cbiAgICBleHBvcnQgZnVuY3Rpb24gZ2V0Qm91bmRDb2xsZWN0aW9uPFQ+KGZzQ29sbGVjdGlvbjogZmlyZXN0b3JlLkNvbGxlY3Rpb25SZWZlcmVuY2UsIG1vZGVsOiBuZXcgKCkgPT4gVCwgb3B0aW9uczogYW55KTogQmluZGFibGVBcnJheTxUPiB7XG4gICAgICAgIC8qIGNyZWF0ZSB0aGUgY29sbGVjdGlvbiBhcyBhIGtvLm9ic2VydmFibGVBcnJheSBhbmQgYmluZCBpdCAqL1xuICAgICAgICBsZXQgb2JzZXJ2YWJsZUFycmF5OiBPYnNlcnZhYmxlQXJyYXk8VD4gPSBrby5vYnNlcnZhYmxlQXJyYXkoKTtcblxuICAgICAgICBiaW5kQ29sbGVjdGlvbihvYnNlcnZhYmxlQXJyYXksIGZzQ29sbGVjdGlvbiwgbW9kZWwsIG9wdGlvbnMpO1xuXG4gICAgICAgIHJldHVybiA8QmluZGFibGVBcnJheTxUPj5vYnNlcnZhYmxlQXJyYXk7XG4gICAgfVxuXG4gICAgZXhwb3J0IGZ1bmN0aW9uIGJpbmRDb2xsZWN0aW9uPFQ+KG9ic2VydmFibGVBcnJheTogT2JzZXJ2YWJsZUFycmF5PFQ+LCBmc0NvbGxlY3Rpb246IGZpcmVzdG9yZS5Db2xsZWN0aW9uUmVmZXJlbmNlLCBtb2RlbDogbmV3ICgpID0+IFQsIG9wdGlvbnM6IEtvZnNPcHRpb25zKTogdm9pZCB7XG4gICAgICAgIC8qIHNldHRpbmdzICovXG4gICAgICAgIG9wdGlvbnMgPSBvcHRpb25zIHx8IHt9O1xuICAgICAgICBsZXQgd2hlcmUgPSBvcHRpb25zLndoZXJlIHx8IFtdO1xuICAgICAgICBsZXQgb3JkZXJCeSA9IG9wdGlvbnMub3JkZXJCeSB8fCBbXTtcbiAgICAgICAgbGV0IGluY2x1ZGVzID0gb3B0aW9ucy5pbmNsdWRlcyB8fCB7fTtcbiAgICAgICAgbGV0IHR3b1dheUJpbmRpbmc6IGJvb2xlYW4gPSB0eXBlb2Ygb3B0aW9ucy50d29XYXlCaW5kaW5nID09PSAndW5kZWZpbmVkJyA/IHRydWUgOiBvcHRpb25zLnR3b1dheUJpbmRpbmc7XG5cbiAgICAgICAgLyogc2V0IGxvZyBsZXZlbCAqL1xuICAgICAgICAvL2lmIChvcHRpb25zLmxvZ0xldmVsKSB7IGxvZ2dpbmcuc2V0TG9nTGV2ZWwob3B0aW9ucy5sb2dMZXZlbCk7IH1cblxuICAgICAgICAvKiBjcmVhdGUgdGhlIEZpcmVzdG9yZSBxdWVyeSBmcm9tIHRoZSBjb2xsZWN0aW9uIGFuZCB0aGUgb3B0aW9ucyAqL1xuICAgICAgICBsZXQgcXVlcnk6IGZpcmVzdG9yZS5RdWVyeSA9IGNyZWF0ZUZpcmVzdG9yZVF1ZXJ5KDxmaXJlc3RvcmUuUXVlcnk+ZnNDb2xsZWN0aW9uLCB3aGVyZSwgb3JkZXJCeSk7XG5cbiAgICAgICAgLyogZXh0ZW5kIHRoZSBvYnNlcnZhYmxlQXJyYXkgd2l0aCBvdXIgZnVuY3Rpb25zICovXG4gICAgICAgIGxldCBiaW5kYWJsZUFycmF5OiBCaW5kYWJsZUFycmF5PFQ+ID0gY3JlYXRlQmluZGFibGVBcnJheShvYnNlcnZhYmxlQXJyYXkpO1xuICAgICAgICBiaW5kYWJsZUFycmF5LnR3b1dheUJpbmRpbmcgPSB0d29XYXlCaW5kaW5nO1xuICAgICAgICBiaW5kYWJsZUFycmF5LmZzUXVlcnkgPSBxdWVyeTtcbiAgICAgICAgYmluZGFibGVBcnJheS5mc0NvbGxlY3Rpb24gPSBmc0NvbGxlY3Rpb247XG4gICAgICAgIGJpbmRhYmxlQXJyYXkuaW5jbHVkZXMgPSBpbmNsdWRlcztcblxuICAgICAgICAvKiBzdWJzY3JpYmUgdG8gdGhlIEZpcmVzdG9yZSBjb2xsZWN0aW9uICovXG4gICAgICAgIHF1ZXJ5Lm9uU25hcHNob3QoKHNuYXBzaG90OiBmaXJlc3RvcmUuUXVlcnlTbmFwc2hvdCk6IHZvaWQgPT4ge1xuICAgICAgICAgICAgc25hcHNob3QuZG9jQ2hhbmdlcygpLmZvckVhY2goKGNoYW5nZTogZmlyZXN0b3JlLkRvY3VtZW50Q2hhbmdlKTogdm9pZCA9PiB7XG4gICAgICAgICAgICAgICAgLyogaWdub3JlIGxvY2FsIGNoYW5nZXMgKi9cbiAgICAgICAgICAgICAgICBpZiAoIWNoYW5nZS5kb2MubWV0YWRhdGEuaGFzUGVuZGluZ1dyaXRlcykge1xuXG4gICAgICAgICAgICAgICAgICAgIGlmIChjaGFuZ2UudHlwZSA9PT0gJ2FkZGVkJykge1xuICAgICAgICAgICAgICAgICAgICAgICAgLy9sb2dnaW5nLmRlYnVnKCdGaXJlc3RvcmUgb2JqZWN0ICcgKyBjaGFuZ2UuZG9jLmlkICsgJyBhZGRlZCB0byBjb2xsZWN0aW9uJyk7XG4gICAgICAgICAgICAgICAgICAgICAgICBsZXQgaXRlbTogVCAmIHsgaW5jbHVkZXM/OiBhbnkgfSA9IG5ldyBtb2RlbCgpO1xuICAgICAgICAgICAgICAgICAgICAgICAgbGV0IGluZGV4OiBudW1iZXIgPSBjaGFuZ2UubmV3SW5kZXg7XG5cbiAgICAgICAgICAgICAgICAgICAgICAgIC8qIGV4dGVuZCB0aGUgTW9kZWwgd2l0aCB0aGUgQmluZGFibGUgZnVuY3Rpb25hbGl0eSAqL1xuICAgICAgICAgICAgICAgICAgICAgICAgbGV0IGNvbWJpbmVkSW5jbHVkZXMgPSBPYmplY3QuYXNzaWduKGluY2x1ZGVzLCBpdGVtLmluY2x1ZGVzKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGxldCBiaW5kYWJsZUl0ZW06IEJpbmRhYmxlPFQ+ID0gY3JlYXRlQmluZGFibGUoaXRlbSwgY29tYmluZWRJbmNsdWRlcyk7XG5cbiAgICAgICAgICAgICAgICAgICAgICAgIC8qIGZpbGwgdGhlIG5ldyBvYmplY3Qgd2l0aCBtZXRhLWRhdGFcbiAgICAgICAgICAgICAgICAgICAgICAgICAqIGV4dGVuZCAvIG92ZXJydWxlIHRoZSBpbmNsdWRlcyB3aXRoIGluY2x1ZGVzIGZyb20gdGhlIHBhc3NlZCBvcHRpb25zICovXG4gICAgICAgICAgICAgICAgICAgICAgICBiaW5kYWJsZUl0ZW0uZnNCYXNlQ29sbGVjdGlvbiA9IGNoYW5nZS5kb2MucmVmLnBhcmVudDtcbiAgICAgICAgICAgICAgICAgICAgICAgIGJpbmRhYmxlSXRlbS5mc0RvY3VtZW50SWQgPSBjaGFuZ2UuZG9jLmlkO1xuICAgICAgICAgICAgICAgICAgICAgICAgYmluZGFibGVJdGVtLnR3b1dheUJpbmRpbmcgPSB0d29XYXlCaW5kaW5nO1xuXG4gICAgICAgICAgICAgICAgICAgICAgICAvKiBleHBsb2RlIHRoZSBkYXRhIEFORCBkZWVwIGluY2x1ZGUgaWYgdHdvLXdheSAqL1xuICAgICAgICAgICAgICAgICAgICAgICAgZXhwbG9kZU9iamVjdChjaGFuZ2UuZG9jLCBiaW5kYWJsZUl0ZW0sIHR3b1dheUJpbmRpbmcpO1xuXG4gICAgICAgICAgICAgICAgICAgICAgICAvKiBzZXQgdGhlIGNvbGxlY3Rpb24gdG8gbG9jYWxPbmx5IHRvIGlnbm9yZSB0aGVzZSBpbmNvbWluZyBjaGFuZ2VzIGZyb20gRmlyZWJhc2UgKi9cbiAgICAgICAgICAgICAgICAgICAgICAgIGJpbmRhYmxlQXJyYXkubG9jYWxPbmx5ID0gdHJ1ZTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGJpbmRhYmxlQXJyYXkuc3BsaWNlKGluZGV4LCAwLCBiaW5kYWJsZUl0ZW0pO1xuICAgICAgICAgICAgICAgICAgICAgICAgYmluZGFibGVBcnJheS5sb2NhbE9ubHkgPSBmYWxzZTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICBpZiAoY2hhbmdlLnR5cGUgPT09IFwibW9kaWZpZWRcIikge1xuICAgICAgICAgICAgICAgICAgICAgICAgLy9sb2dnaW5nLmRlYnVnKCdGaXJlc3RvcmUgb2JqZWN0ICcgKyBjaGFuZ2UuZG9jLmlkICsgJyBtb2RpZmllZCcpO1xuICAgICAgICAgICAgICAgICAgICAgICAgbGV0IGxvY2FsRG9jOiBCaW5kYWJsZTxUPiB8IG51bGwgPSBiaW5kYWJsZUFycmF5LmdldERvY3VtZW50KGNoYW5nZS5kb2MuaWQpO1xuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKGxvY2FsRG9jICE9IG51bGwpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAvKiBleHBsb2RlIHRoZSBkYXRhLCBidXQgZG9uJ3QgbWVzcyB3aXRoIHRoZSBkZWVwIGluY2x1ZGVzICovXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgZXhwbG9kZU9iamVjdChjaGFuZ2UuZG9jLCBsb2NhbERvYywgZmFsc2UpO1xuICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgLy9sb2dnaW5nLmRlYnVnKCdGaXJlc3RvcmUgb2JqZWN0ICcgKyBjaGFuZ2UuZG9jLmlkICsgJyBub3QgZm91bmQgaW4gbG9jYWwgY29sbGVjdGlvbicpO1xuICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIGlmIChjaGFuZ2UudHlwZSA9PT0gXCJyZW1vdmVkXCIpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIC8vbG9nZ2luZy5kZWJ1ZygnRmlyZXN0b3JlIG9iamVjdCAnICsgY2hhbmdlLmRvYy5pZCArICcgcmVtb3ZlZCBmcm9tIGNvbGxlY3Rpb24nKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGxldCBsb2NhbERvYzogQmluZGFibGU8VD4gfCBudWxsID0gYmluZGFibGVBcnJheS5nZXREb2N1bWVudChjaGFuZ2UuZG9jLmlkKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmIChsb2NhbERvYyAhPSBudWxsKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgYmluZGFibGVBcnJheS5sb2NhbE9ubHkgPSB0cnVlO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGJpbmRhYmxlQXJyYXkucmVtb3ZlKGxvY2FsRG9jKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBiaW5kYWJsZUFycmF5LmxvY2FsT25seSA9IGZhbHNlO1xuICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgLyogd2hlbiByZW1vdmluZyBmcm9tIEZpcmVzdG9yZSwgdGhlIHNuYXBzaG90IGlzIHRyaWdnZXJlZCwgc28gaXQgd2lsbCB0cnkgdG8gcmVtb3ZlIGl0IGFnYWluIHdoZW4gaXQncyBubyBsb25nZXIgdGhlcmUgKi9cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAvL2xvZ2dpbmcuZGVidWcoJ0ZpcmVzdG9yZSBvYmplY3QgJyArIGNoYW5nZS5kb2MuaWQgKyAnIG5vdCAobG9uZ2VyKSBmb3VuZCBpbiBsb2NhbCBjb2xsZWN0aW9uJyk7XG4gICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgfSk7XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gY3JlYXRlRmlyZXN0b3JlUXVlcnkoY29sbGVjdGlvbjogZmlyZXN0b3JlLlF1ZXJ5LCB3aGVyZTogYW55LCBvcmRlckJ5OiBhbnkpIHtcbiAgICAgICAgLyogY29udmVydCBvdXIgd2hlcmUgYW5kIG9yZGVyYnkgYXJyYXlzIHRvIHJlYWwgRmlyZXN0b3JlIHF1ZXJpZXMgKi9cblxuICAgICAgICBsZXQgcXVlcnk6IGZpcmVzdG9yZS5RdWVyeSA9IGNvbGxlY3Rpb247XG5cbiAgICAgICAgaWYgKHdoZXJlICE9IG51bGwgJiYgQXJyYXkuaXNBcnJheSh3aGVyZSkgJiYgd2hlcmUubGVuZ3RoID4gMCkge1xuICAgICAgICAgICAgaWYgKEFycmF5LmlzQXJyYXkod2hlcmVbMF0pKSB7XG4gICAgICAgICAgICAgICAgZm9yIChsZXQgd2hlcmVDbGF1c2Ugb2Ygd2hlcmUpIHtcbiAgICAgICAgICAgICAgICAgICAgcXVlcnkgPSBxdWVyeS53aGVyZSh3aGVyZUNsYXVzZVswXSwgd2hlcmVDbGF1c2VbMV0sIHdoZXJlQ2xhdXNlWzJdKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgICAgICBxdWVyeSA9IHF1ZXJ5LndoZXJlKHdoZXJlWzBdLCB3aGVyZVsxXSwgd2hlcmVbMl0pO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgaWYgKG9yZGVyQnkgIT0gbnVsbCAmJiBBcnJheS5pc0FycmF5KG9yZGVyQnkpICYmIG9yZGVyQnkubGVuZ3RoID4gMCkge1xuICAgICAgICAgICAgaWYgKEFycmF5LmlzQXJyYXkob3JkZXJCeVswXSkpIHtcbiAgICAgICAgICAgICAgICBmb3IgKGxldCBvcmRlckJ5Q2xhdXNlIG9mIG9yZGVyQnkpIHtcbiAgICAgICAgICAgICAgICAgICAgcXVlcnkgPSBxdWVyeS5vcmRlckJ5KG9yZGVyQnlDbGF1c2VbMF0sIG9yZGVyQnlDbGF1c2VbMV0pO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgICAgIHF1ZXJ5ID0gcXVlcnkub3JkZXJCeShvcmRlckJ5WzBdLCBvcmRlckJ5WzFdKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIHJldHVybiBxdWVyeTtcbiAgICB9XG5cbiAgICBmdW5jdGlvbiBleHBsb2RlT2JqZWN0PFQ+KGZpcmVzdG9yZURvY3VtZW50OiBmaXJlc3RvcmUuUXVlcnlEb2N1bWVudFNuYXBzaG90LCBsb2NhbE9iamVjdDogQmluZGFibGU8VD4sIGRlZXBJbmNsdWRlOiBib29sZWFuKSB7XG4gICAgICAgIC8qIGR1cmluZyB1cGRhdGUgc2V0IGxvY2sgb24gdGhlIGZpbGUsIHNvIHRoZXJlIHdpbGwgYmUgbm8gdXBkYXRlIGxvb3AgKi9cbiAgICAgICAgbG9jYWxPYmplY3QubG9jayA9IHRydWU7XG5cbiAgICAgICAgLyogZW51bWVyYXRlIHVzaW5nIGtleXMoKSBhbmQgZmlsdGVyIG91dCBwcm90b3lwZSBmdW5jdGlvbnMgd2l0aCBoYXNPd25Qcm9wZXJ0eSgpIGluIHN0ZWFkIG9mIHVzaW5nIFxuICAgICAgICAgKiBnZXRPd25Qcm9wZXJ0eU5hbWVzKCksIGJlY2F1c2UgdGhlIGxhdHRlciBhbHNvIHJldHVybnMgbm9uLWVudW1lcmFibGVzICovXG4gICAgICAgIGZvciAobGV0IGtleSBvZiBPYmplY3Qua2V5cyhsb2NhbE9iamVjdCkpIHtcbiAgICAgICAgICAgIGlmICghbG9jYWxPYmplY3QuaGFzT3duUHJvcGVydHkoa2V5KSkgY29udGludWU7XG5cbiAgICAgICAgICAgIGxldCBwcm9wZXJ0eURhdGE6IGFueTtcbiAgICAgICAgICAgIGxldCBwcm9wZXJ0eTogYW55ID0gKDxhbnk+bG9jYWxPYmplY3QpW2tleV07XG5cbiAgICAgICAgICAgIC8qIGdldCBkYXRhIGZyb20gRmlyZXN0b3JlIGZvciBwcmltaXRpdmUgcHJvcGVydGllcyAqL1xuICAgICAgICAgICAgaWYgKGtvLmlzT2JzZXJ2YWJsZShwcm9wZXJ0eSkgJiZcbiAgICAgICAgICAgICAgICAha28uaXNPYnNlcnZhYmxlQXJyYXkocHJvcGVydHkpICYmXG4gICAgICAgICAgICAgICAgIWtvLmlzQ29tcHV0ZWQocHJvcGVydHkpKSB7XG5cbiAgICAgICAgICAgICAgICBwcm9wZXJ0eURhdGEgPSBmaXJlc3RvcmVEb2N1bWVudC5nZXQoa2V5KTtcblxuICAgICAgICAgICAgICAgIHN3aXRjaCAodHlwZW9mIHByb3BlcnR5RGF0YSkge1xuICAgICAgICAgICAgICAgICAgICBjYXNlICd1bmRlZmluZWQnOlxuICAgICAgICAgICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICAgICAgICAgIGNhc2UgJ3N0cmluZyc6XG4gICAgICAgICAgICAgICAgICAgIGNhc2UgJ251bWJlcic6XG4gICAgICAgICAgICAgICAgICAgIGNhc2UgJ2Jvb2xlYW4nOlxuICAgICAgICAgICAgICAgICAgICAgICAgcHJvcGVydHkocHJvcGVydHlEYXRhKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgICAgICAgICBjYXNlICdvYmplY3QnOlxuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKHByb3BlcnR5RGF0YSAmJiB0eXBlb2YgcHJvcGVydHlEYXRhLnRvRGF0ZSA9PT0gJ2Z1bmN0aW9uJykgeyAvKiBhc3N1bWUgRmlyZXN0b3JlLlRpbWVzdGFtcCAqL1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHByb3BlcnR5KHByb3BlcnR5RGF0YS50b0RhdGUoKSk7XG4gICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIC8qIGdldCByZWd1bGFyIGFycmF5cywgb3IgYXJyYXlzIG5vdCBtYXJrZWQgZm9yIGRlZXAgaW5jbHVzaW9uICovXG4gICAgICAgICAgICBpZiAoa28uaXNPYnNlcnZhYmxlQXJyYXkocHJvcGVydHkpICYmICEoPGFueT5sb2NhbE9iamVjdC5pbmNsdWRlcylba2V5XSkge1xuICAgICAgICAgICAgICAgIHByb3BlcnR5RGF0YSA9IGZpcmVzdG9yZURvY3VtZW50LmdldChrZXkpO1xuXG4gICAgICAgICAgICAgICAgaWYgKEFycmF5LmlzQXJyYXkocHJvcGVydHlEYXRhKSkge1xuICAgICAgICAgICAgICAgICAgICBwcm9wZXJ0eShwcm9wZXJ0eURhdGEpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgLyogZ2V0IGRlZXAgaW5jbHVkZXMgZm9yIEFycmF5IHByb3BlcnRpZXMgKi9cbiAgICAgICAgICAgIGlmIChkZWVwSW5jbHVkZSAmJlxuICAgICAgICAgICAgICAgIGtvLmlzT2JzZXJ2YWJsZUFycmF5KHByb3BlcnR5KSAmJlxuICAgICAgICAgICAgICAgICg8YW55PmxvY2FsT2JqZWN0LmluY2x1ZGVzKVtrZXldICYmXG4gICAgICAgICAgICAgICAgbG9jYWxPYmplY3QuZnNCYXNlQ29sbGVjdGlvbiAhPT0gdW5kZWZpbmVkKSB7XG4gICAgICAgICAgICAgICAgbGV0IGluY2x1ZGU6IHsgY2xhc3M6IG5ldyAoKSA9PiBhbnksIG9yZGVyQnk6IHN0cmluZ1tdIHwgc3RyaW5nW11bXSB9ID0gKDxhbnk+bG9jYWxPYmplY3QuaW5jbHVkZXMpW2tleV07XG4gICAgICAgICAgICAgICAgbGV0IGNvbGxlY3Rpb25SZWY6IGZpcmVzdG9yZS5Db2xsZWN0aW9uUmVmZXJlbmNlID0gbG9jYWxPYmplY3QuZnNCYXNlQ29sbGVjdGlvbi5kb2MobG9jYWxPYmplY3QuZnNEb2N1bWVudElkKS5jb2xsZWN0aW9uKGtleSk7XG4gICAgICAgICAgICAgICAga29mcy5iaW5kQ29sbGVjdGlvbihwcm9wZXJ0eSwgY29sbGVjdGlvblJlZiwgaW5jbHVkZS5jbGFzcywgeyB0d29XYXlCaW5kaW5nOiBsb2NhbE9iamVjdC50d29XYXlCaW5kaW5nLCBvcmRlckJ5OiBpbmNsdWRlLm9yZGVyQnkgfSk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICAvKiByZXNldCBsb2NrICovXG4gICAgICAgIGxvY2FsT2JqZWN0LmxvY2sgPSBmYWxzZTtcbiAgICB9XG59XG4iXX0=