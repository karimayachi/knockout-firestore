# Knockout-Firestore

The `knockout-firestore` (KOFS) package provides an two-way binding between [Knockout](https://github.com/knockout/knockout)'s MVVM based observable objects and [Firebase](https://github.com/firebase)' Cloud Firestore (a realtime database). It features '[deep includes](#deep-includes)' (a.k.a. Navigation Properties, a.k.a. nested collections).

It offers a lightweight interface to to create true MVVM applications in the browser, backed by realtime database storage.

KOFS is build in TypeScript and it extends your view model and the `ko.ObservableArray` of Knockout. You can use it in any browser based JavaScript project that meets the prerequisites below.

It aims at being simple, clean, lightweight and without dependencies on frameworks (other than Knockout and Firebase ofcourse). 

## Table of contents
- [Knockout-Firestore](#knockout-firestore)
  * [Table of contents](#table-of-contents)
  * [Prerequisites](#prerequisites)
    + [For using KOFS](#for-using-kofs)
    + [For building/extending KOFS](#for-building-extending-kofs)
  * [Quick start](#quick-start)
  * [Disclaimer](#disclaimer)
  * [Installation](#installation)
    + [NPM](#npm)
    + [CDN](#cdn)
    + [Local installation](#local-installation)
  * [Usage](#usage)
  * [Example](#example)
  * [Building](#building)
  * [Reference](#reference)
    + [The kofs namespace](#the-kofs-namespace)
      - [getBoundCollection(collection, object [, options])](#getboundcollection-collection--object----options--)
    + [extensions to ko.observableArray](#extensions-to-koobservablearray)
    + [extensions to the Data Model objects](#extensions-to-the-data-model-objects)
  * [Further reading](#further-reading)
    + [Deep includes](#deep-includes)
    + [Excludes](#excludes)
  * [Release notes](#release-notes)
    + [1.1.4](#114)
    + [1.1.0 - 1.1.3](#110---113)
    + [1.0.0](#100)
    + [1.0.0 - Beta 1](#100---beta-1)
  * [License](#license)

## Prerequisites

### For using KOFS
- Knockout >= 3.5.0
- Firebase JavaScript API
- A Firebase account and a Firestore collection

### For building/extending KOFS
- NPM

## Quick start

```javascript
// collection is a firebase.firestore.CollectionReference
// BlogPost is a function that represents an entity in the application's model
var viewModel = { };
viewModel.blogPostsList = kofs.getBoundCollection(collection, BlogPost);

ko.applyBindings(viewModel);
```

## Disclaimer
I come from the world of strongly typed object oriented programming languages and strict, strongly typed ORM solutions. There are many concepts that I love and think are really useful. When creating this package, I constantly find myself thinking "How would I do it in the ORM world?". This package is the result of me trying to bring my workflow to JavaScript. It is by no means an excercise in theoretical JavaScript programming. So if it violates any of the reasoning behind functional programming, so be it ;-)

Furthermore, the aim of this package is not to be a full fledged ORM with atomic transactions, deep change tracking, offline caching, etc. It just aims at doing the heavy lifting in typical MVVM situations.

## Installation

### NPM

```shell
npm i knockout-firestore
```
Knockout and Firebase are **not** installed as dependencies. You have to install them seperately. This way, you're free to load the Firebase API as you wish, e.g. through the Firebase Reserved Hosting URLS ([Load Firebase SDKs from reserved URLs](https://firebase.google.com/docs/hosting/reserved-urls#add_scripts_for_reserved_urls))

### CDN

Include the CDN version in your project, **after** Knockout and the Firebase API.

```html
<script type="text/javascript" src="https://www.gstatic.com/firebasejs/5.0.4/firebase.js"></script>
<script type="text/javascript" src="https://cdnjs.cloudflare.com/ajax/libs/knockout/3.4.2/knockout-min.js"></script>
<script type="text/javascript" src="https://unpkg.com/knockout-firebase@1.1.3"></script>
```

### Local installation
Build the package (see below). After that copy the relevant files from the `/dist` folder to your project. You can find the minimized version including type-definitions as well as the development version with mapping file in this folder. Be sure to reference them in your project **after** referencing Knockout and Firebase.

## Usage
KOFS creates a two way binding interface between an MVVM application build with Knockout and the Firebase realtime database Firestore.

First make sure you have the Firestore database hooked-up and ready to go (unless you use reserved Hosting URLs):

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
var BlogPost = function () {
    this.title = ko.observable();
    this.content = ko.observable();
}

var BlogViewModel = function () {
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
```
npm run dev
```

Now load http://localhost:9000 in two different browsers, fill in your Firebase credentials and Firestore collection, click `bind` and view the miracle of synchronization!

## Building
KOFS is written in [TypeScript](https://www.typescriptlang.org/) and build using [webpack](https://webpack.js.org/). 

The KOFS build however has no dependencies on NodeJS or any of it's modules. Use the local build or CDN version in every browser based Javascript project.

Build it using:
```
npm run build-dev
```
or
```
npm run build-prod
```

## Reference

### The kofs namespace
The kofs namespace exposes the following functions:

#### getBoundCollection(collection, object [, options])
Retrieves a collection from Firestore and returns a observableArray that is bound to that collection.

returns: a `ko.observableArray` with some additional functionality (see [below](#extensions-to-koobservablearray)).

#### bindCollection(observableArray, collection, object [, options])

Takes an existing `ko.observableArray`, extends it with additional functionality (see [below](#extensions-to-koobservablearray)) and binds it to a Firestore collection.

returns: -

##### observableArray
type: ko.observableArray<br>
An exisiting observableArray that will be extended (see [below](#extensions-to-koobservablearray)) and bound to the Firestore collection

##### collection
type: [firebase.firestore.CollectionReference](https://firebase.google.com/docs/reference/js/firebase.firestore.CollectionReference)<br>
This is the base collection that is used for the initial filling of the `ko.observableArray` and where new documents will be added as new items are pushed onto the `ko.observableArray`

##### object
type: [Function]<br>
A Javascript function that acts as a Model. All koObservable properties of this function will be synced with document properties of the same name. E.g.:
```javascript
var BlogPost = function () {
      this.title = ko.observable();
      this.content = ko.observable();
}
```
Syncs with the Firestore document:
```javascript
{
    title: 'foo',
    content: 'bar'
}
```
##### options
type: [Object]<br>
Optional parameters to pass to the binding mechanism:

| Key  | Value | Default |
|------------|-------------|----------|
| twoWayBinding | true/false <br><br>When set to false, local changes are not automatically saved back to the database. You will have to manually call `save()` or `saveAll()`. Also  be sure to use `detach()` in stead of `remove()`. <br><br> **Note:** setting this false will also disable deep bindings!| true |
| where | [ path, operation, value ] or [ [ path, operation, value ],  [ path, operation, value ], ... ] ] ]<br><br>Provide one or more where-clauses to make up the query that fills the collection and is listened to for changes| [ ] |
| orderBy | [ property, 'asc' / 'desc' ] or [ [ property, 'asc' / 'desc' ],  [ property, 'asc' / 'desc' ], ... ] ]<br><br>Provide one or more where-clauses to make up the query that fills the collection and is listened to for changes | [ ] |
| includes | { property : { class: ViewModel, orderBy: [ property, 'asc' / 'desc' ] }, ... }<br><br>property: navigation property / nested array to follow<br>ViewModel: view model function<br>orderBy: OrderBy clause as above<br><br>See [Deep includes](#deep-includes) | { } |
| logLevel | 0, 1 or 2<br><br>Sets the log level. 0 = errors only, 1 = info, 2 = debug. Note, to show debug logging in Chrome, you may have to set log level to verbose in the console.| 0 |

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

## Further reading

### Deep includes
> **Note:** Deep includes are ignored when twoWayBinding is set to false

KOFS can follow observableArrays in your view model and automatically bind them to nested collections in Firestore. There are two ways to configure this:

#### using the `includes` option
You can set the properties you want KOFS to follow using the `include` option. Provide the property and the model used and optionally an orderBy clause.

Example:
```javascript
var BlogPost = function () {
    this.title = ko.observable();
    this.content = ko.observable();
    this.images = ko.observableArray();
    this.comments = ko.observableArray();
};

var Image = function () {
    this.url = ko.observable();
    this.title = ko.observable();
};

var BlogComment = function () {
    this.comment = ko.observable();
    this.user = ko.observable();
    this.postDate = ko.observable();
};

var BlogViewModel = function () {
    var options = {
        where: ['createDate', '>', new Date(Date.now() - 86400000)],
        orderBy: ['modifiedDate', 'asc'],
        includes: {
            images: { class: Image }, 
            comments: { class: BlogComment, orderBy: ['postDate', 'asc'] }
        }
    };

    this.blogList = kofs.getBoundCollection(collection, BlogPost, options);
};
```
Only one level of includes can be defined using this method.

#### using the `includes` property
Another way to configure the deep includes is using the `includes` property in your (view)model.

Example:
```javascript
var BlogPost = function () {
    this.includes = { images: { class: Image } };

    this.title = ko.observable();
    this.content = ko.observable();
    this.images = ko.observableArray();
};

var Image = function () {
    this.includes = { likes: { class: Like, orderBy: ['user', 'desc'] } };

    this.url = ko.observable();
    this.title = ko.observable();
    this.likes = ko.observableArray();
};

var Like = function () {
    this.user = ko.observable();
};

var BlogViewModel = function () {
    var options = {
        where: ['createDate', '>', new Date(Date.now() - 86400000)],
        orderBy: ['modifiedDate', 'asc']
    };

    this.blogList = kofs.getBoundCollection(collection, BlogPost, options);
};
```
Using this method you can deep link multiple levels.

### Excludes
All observables and observableArrays are bound to the Firestore document. The following properties are excluded from binding:
* computed and pureComputed properties
* non-observables (vanilla javascript properties)
* non-enumarable properties (even if they're observable)

So the following properties of a view model will all not be bound:
```javascript
var ThesePropertiesAreNotBound = function () {

    this.computed = ko.pureComputed(function () {
        return someObservableProperty();
    });

    this.vanillaProperty = 'hello world';

    Object.defineProperty(this, 'observableYetNotBoundProperty', {
        enumerable: false,
        configurable: false,
        writable: false,
        value: ko.observable()
    });
}
```

## Release notes

### 1.1.4
* Bugfixes: re-enabled logging

### 1.1.0 - 1.1.3
Refactored from JavaScript + Browserify to TypeScript + Webpack

Regression/ known bugs:
* Logging temporarily disabled

### 1.0.0
Added:
* Deep inludes: binding follows ObservableArrays in view model to nested Firestore collections
* More configuration options

Bugfixes:
* Sort order preserved when adding/inserting new objects


### 1.0.0 - Beta 1
First beta version: two way binding between a Firestore collection and an ObservableArray.

## License

© 2018 - 2020 Karim Ayachi. Licensed under [The MIT License](LICENSE).
