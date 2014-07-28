!(function (root, factory) {
    if (typeof define === 'function' && define.amd) {

        define([], factory);
    } else if (typeof exports === 'object') {

        module.exports = factory();
    } else {

        root.UndoRedoManager = factory();
  }
}(this, function () {

    function UndoRedoManager() {

        this._history = [];
        this._historyPointer = 0;
    }

    var p = UndoRedoManager.prototype;

    p.undo = function () {

        if (this._historyPointer > 0) {

            --this._historyPointer;

            var reg = this._history[this._historyPointer];
            reg.undo.apply(reg.undoContext, reg.undoParams);

            return true
        }
        else {
            return false
        }
    };

    p.redo = function () {

        if (this._historyPointer < this._history.length) {

            var reg = this._history[this._historyPointer];
            reg.redo.apply(reg.redoContext, reg.redoParams);

            ++this._historyPointer;

            return true
        }
        else {
            return false
        }
    };

    p.save = function (undo, redo, undoContext, redoContext, undoParams, redoParams) {

        this._history.splice(this._historyPointer);
        this._history.push({
            undo: undo,
            redo: redo,
            undoContext: undoContext,
            redoContext: redoContext,
            undoParams: undoParams,
            redoParams: redoParams
        });
        this._historyPointer = this._history.length;
    };

    p.listenParam = function(obj, name) {

        if (name.indexOf(' ') !== -1) {
            name.split(' ').map(this.listenParam.bind(this, obj));
        };
    }

    return UndoRedoManager;
}));
