# Knockout-Firestore

The `knockout-firestore` (KOFS) package provides an two-way binding between [Knockout](https://github.com/knockout/knockout)'s MVVM based observable objects and [Firebase](https://github.com/firebase)' realtime database Firestore.

It offers a lightweight interface to to create true MVVM applications in the browser, backed by realtime database storage.

KOFS is build in Javascript and it extends `ko.Observable` and `ko.ObservableArray` of Knockout. You can use it in any browser based Javascript project that meets the prerequisites below.

It aims at being simple, clean, lightweight and without dependencies on frameworks (other than Knockout and Firebase ofcourse). 

## Prerequistes

### For using KOFS
- Knockout
- Firebase Javascript API
- A Firebase account and a Firestore collection

### For building/extending KOFS
- NodeJS
- Browserify
- UglifyJS (for minimizing)

## Quick start

```javascript
// collection is a firebase.firestore.CollectionReference
// BlogPost is a function that represents an entity in the application's model
var viewModel = { };
viewModel.blogPostsList = kofs.getBoundCollection(collection, BlogPost);

ko.applyBindings(viewModel);
```

## Disclaimers
I come from the world of strongly typed object oriented programming languages and strict, strongly typed ORM solutions. There are many concepts that I love and think are really useful. When creating this package, I constantly find myself thinking "How would I do it in the ORM world?". This package is the result of me trying to bring my workflow to Javascript. It is by no means an excercise in theoretical Javascript programming. So if it violates any of the reasoning behind weak typing and prototyping languages, so be it ;-)

Furthermore, the aim of this package is not (yet?) to be a full fledged ORM with atomic transactions, deep change tracking, offline caching, etc. It just aims at doing the heavy lifting in typical MVVM situations.

## Installation

Include the build version in your project, **after** Knockout and the Firebase API.

```html
<script type="text/javascript" src="https://www.gstatic.com/firebasejs/5.0.4/firebase.js"></script>
<script type="text/javascript" src="https://cdnjs.cloudflare.com/ajax/libs/knockout/3.4.2/knockout-min.js"></script>
...
<script type="text/javascript" src="knockout.firestore.min.js"></script>
```

## Usage
KOFS creates a two way binding interface between an MVVM application build with Knockout and the Firebase realtime database Firestore.

First make sure you have the Firestore database hooked-up and ready to go:

```javascript
firebase.initializeApp({
  apiKey: 'yourfirebaseapikey',
  authDomain: 'yourfirebaseauthdomain',
  projectId: 'yourfirebaseprojectid'
});

var db = firebase.firestore();
```

A Firebase collection will serve as a end point to the Kockout ViewModel. In other words: we will create a ko.ObservableArray that is in sync with this collection. First create the end point:

```javascript
var collection = db.collection('posts');
```

Next we will need a ViewModel and the entities in the data model of the application.

```javascript
var BlogPost = function() {
    this.title = ko.Observable();
    this.content = ko.Observable();
}

var BlogViewModel = function() {
    this.blogList = kofs.getBoundCollection(collection, BlogPost);
}
```

This is just like creating a 'normal' Knockout binding, except we don't initialize blogList as an `ko.ObservableArray`. `getBoundCollection` creates an ko.ObservableArray for us and loads it (asynchronously) with instances of `BlogPost` from the Firestore collection.

We can apply this ViewModel to our view as normal:

```javascript
ko.applyBindings(new BlogViewModel());
```

That's it! The ObservableArray is now two-way bound between the user interface and the database.

See the section Reference for more detailed info on how to get more fine grained control over the binding process.

## Example
See the example folder. Load index.html in two different browsers, fill in your Firebase credentials and Firestore collection, click `bind` and view the miracle of synchronization!

## Building
KOFS is build using [Browserify](http://browserify.org/). This enables the use of NodeJS' `require` module to keep the source code organized. The KOFS build however has no dependencies on NodeJS or any of it's modules. Use the build in every browser based Javascript project.

```
browserify src/index.js > dist/knockout.firestore.js 
browserify src/index.js | uglifyjs > dist/knockout.firestore.min.js
```

## Reference

### The kofs namespace
The kofs namespace exposes the following functions:

#### getBoundCollection(collection, object [, options])

returns: a `ko.ObservableArray` with some additional functionality (see below).

| Parameter  | Description |
|------------|-------------|
| collection | type: [firebase.firestore.CollectionReference](https://firebase.google.com/docs/reference/js/firebase.firestore.CollectionReference) <br><br>This is the base collection that is used for the initial filling of the `ko.ObservableArray` and where new documents will be added as new items are pushed onto the `ko.ObservableArray` |
| object | type: [Function] <br><br>A Javascript function that acts as a Model. All koObservable properties of this function will be synced with document properties of the same name.<br><br>For instance: <br><pre>var BlogPost = function() {<br>   this.title = ko.Observable();<br>   this.content = ko.Observable();<br>}</pre>Syncs with a Firestore document:<br><pre>{<br>   title: 'foo',<br>   content: 'bar'<br>}</pre>|
| options | type: [Object]<br><br>Optional parameters to pass to the binding mechanism:<br><br>`twoWayBinding`:  true/false (default: true)<br>When set to false, local changes are not automatically saved back to the database. You will have to manually call `save()` or `saveAll()`. Also when using manual saving, be sure to use `detach()` in stead of `remove()`.<br><br>`where`: [ path, operation, value ] or [ [ path, operation, value ],  [ path, operation, value ], ... ] (default: [ ])<br>Provide one or more where-clauses to make up the query that fills the collection and is listened to for changes<br><br>`orderBy`: [ property, 'asc' / 'desc' ] or [ [ property, 'asc' / 'desc' ],  [ property, 'asc' / 'desc' ], ... ] (default: null)<br>Provide one or more where-clauses to make up the query that fills the collection and is listened to for changes<br><br>`logLevel`: 0, 1 or 2 (default: 0)<br>Sets the log level. 0 = errors only, 1 = info, 2 = debug. Note, to show debug logging in Chrome, you may have to set log level to verbose in the console.|

Note: some combinations of where and orderBy options require you to create an index in Firestore. This will be mentioned in the console output.

Examples:

```javascript
function BlogPost() { /* BlogPost model */ }
var collection = firebase.firestore().collection('posts');

var options = {
    logLevel: 2,
    twoWayBinding: false
}

var boundObservableArray = kofs.getBoundCollection(collection, BlogPost, options);
```

```javascript
function BlogPost() { /* BlogPost model */ }
var collection = firebase.firestore().collection('posts');

var options = {
    where: ['createDate', '>', new Date(Date.now() - 86400000)],
    orderBy: ['modifiedDate', 'asc']
}

var boundObservableArray = kofs.getBoundCollection(collection, BlogPost, options);
```
### extensions to ko.observableArray
The ko.observableArray returned by kofs.getBoundCollection is extended to have the following functions:

#### detach(item)
When using a two-way binding, this is just an alias for Knockout's `remove(item)`, as the item gets deleted immediatly, both from the local collection as well as the Firestore collection.

When using a one-way binding, this removes the item from the user interface, but keeps it in the local collection, until it is saved, at which time, it is removed from the local collection and the Firestore collection. When using one-way bindings you must use this in stead of `remove(item)`, otherwise you can never propagate a deletion to the database.

#### saveAll()
Only when using one-way binding. This will save all documents in the collection with state NEW, MODIFIED and DELETED to the Firestore collection.

### extensions to the Data Model objects
All objects that are pushed onto the above `ko.observableArray` or that are part of the initial initialization (from `getBoundCollection()`) are synchronized with the Firestore collection and extended with the following functions:

#### save()
Only when using one-way binding. This will save the current document to the Firestore collection.

#### modified()
Only when using one-way binding. This is a `ko.observable` that returns true if the document has unsaved changes. Since this is a bindable `ko.observable`, you can use it in your interface to show and hide a save-button (for instance).

## License

© 2018 Karim Ayachi. Licensed under [The MIT License](LICENSE).
