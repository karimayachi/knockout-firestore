'use strict';

/* globals */
var db; // database reference

document.addEventListener("DOMContentLoaded", function() { 
    var settingsViewModel = new SettingsViewModel();

    ko.applyBindings(settingsViewModel, document.getElementById('settingsview'));
});

function SettingsViewModel () {
    this.apiKey = ko.observable('');
    this.authDomain = ko.observable('');
    this.projectId = ko.observable('');
    this.collection = ko.observable('todoItems');
    this.logLevel = ko.observable(0);
    this.twoWayBinding = ko.observable(true);

    this.bind = function () {
        if(db == null) {
            /* initialization */
            firebase.initializeApp({
                apiKey: this.apiKey(),
                authDomain: this.authDomain(),
                projectId: this.projectId()
            });

            /* initialize Cloud Firestore through Firebase */
            db = firebase.firestore();
            db.settings({ timestampsInSnapshots: true });
        }

        var collection = db.collection(this.collection());

        var options = {
            logLevel: this.logLevel(),
            twoWayBinding: this.twoWayBinding(),
            orderBy: ['createDate', 'asc'],
            includes: { actions: { class: Action, orderBy: ['percentageFinished', 'desc'] } }
        }

        
        var todoViewModel = new TodoViewModel();
        todoViewModel.todoItems = kofs.getBoundCollection(collection, TodoItem, options);
        ko.applyBindings(todoViewModel, document.getElementById('contentview'));
    }
}

function TodoViewModel () {
    var self = this;

    this.add = function() {
        self.todoItems.push(new TodoItem());
    }

    this.remove = function(item) {
        self.todoItems.detach(item);
    }

    this.save = function() {
        self.todoItems.saveAll();
    }
 }

function TodoItem () {
    var self = this;

     this.title = ko.observable();
     this.description = ko.observable();
     this.finished = ko.observable(false);
     this.createDate = ko.observable(new Date());
     this.actions = ko.observableArray();

     this.addAction = function () {
        self.actions.push(new Action());
     }
 }

 function Action () {
    var self = this;

    this.title = ko.observable();
    this.percentageFinished = ko.observable(0);

    this.addTenPercent = function () {
        var perc = self.percentageFinished();
        if(perc <= 90) {
            self.percentageFinished(perc + 10);
        }
     }
}