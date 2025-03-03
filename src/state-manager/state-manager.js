import EventEmitter from "../event-emitter/event-emitter.js";

/**
 * A utility class for managing application state with localStorage support.
 *
 * This class provides methods to save, restore, and manage state snapshots using
 * localStorage. It also includes functionality to enable automatic state-saving at
 * a defined interval.
 *
 * @class StateManager
 */
export default class StateManager extends EventEmitter {
    /**
     * Creates a new StateManager instance.
     * @param {Object} store - The store object to manage state for.
     * @param {Object} [options={}] - Configuration options for the StateManager.
     * @param {string} [options.id="model"] - Unique identifier for the state in localStorage.
     */
    constructor(store, options = {}) {
        super();
        this.store = store;
        this.options = Object.assign({id: "model"}, options);
    }

    /**
     * Checks if localStorage is available.
     * @returns {boolean}
     */
    static isStorageAvailable() {
        try {
            const test = '__test__';
            localStorage.setItem(test, test);
            localStorage.removeItem(test);
            return true;
        } catch (e) {
            return false;
        }
    }

    /**
     * Saves the current state to localStorage.
     * @returns {{data: any, timestamp: number}|null}
     */
    saveState() {
        if (!StateManager.isStorageAvailable()) {
            console.warn('localStorage is not available');
            return null;
        }
        const dataToSave = JSON.parse(JSON.stringify(this.store.getState()));
        const state = {
            data: dataToSave,
            timestamp: Date.now()
        };
        try {
            localStorage.setItem(this.options.id, JSON.stringify(state));
            this.emit('saveState', state);
            return state;
        } catch (error) {
            console.error('Error saving state:', error);
            this.emit('saveStateError', error);
            return null;
        }
    }

    /**
     * Restores the state from localStorage.
     * @returns {any|null}
     */
    restoreState() {
        if (!StateManager.isStorageAvailable()) {
            console.warn('localStorage is not available');
            return null;
        }
        try {
            const savedState = localStorage.getItem(this.options.id);
            if (savedState) {
                const parsed = JSON.parse(savedState);
                Object.assign(this.store.state, parsed.data);
                this.emit('restoreState', parsed);
                return parsed;
            }
        } catch (error) {
            this.emit('restoreStateError', error);
        }
    }

    /**
     * Creates a snapshot of the current state.
     * @returns {{data: any, timestamp: number}|null}
     */
    createSnapshot() {
        if (!StateManager.isStorageAvailable()) {
            console.warn('localStorage is not available');
            return null;
        }
        const dataToSave = JSON.parse(JSON.stringify(this.store.getState()));
        const snapshot = {
            data: dataToSave,
            timestamp: Date.now()
        };
        this.emit('createSnapshot', snapshot);
        return snapshot
    }

    /**
     * Restores the state from a snapshot.  
     * @param snapshot
     * @returns {*|null}
     */
    restoreSnapshot(snapshot) {
        if (!StateManager.isStorageAvailable()) {
            console.warn('localStorage is not available');
            return null;
        }
        if (snapshot) {
            Object.assign(this.store.state, snapshot.data);
            this.emit('restoreSnapshot', snapshot);
            return snapshot;
        }
        return null;
    }

    /**
     * Enables automatic state-saving at a specified interval.
     * @param interval
     */
    enableAutoSave(interval = 5000) {
        this.autoSaveInterval = setInterval(() => {
            this.saveState()
        }, interval);
    }

    /**
     * Disables automatic state-saving.
     */
    disableAutoSave() {
        clearInterval(this.autoSaveInterval);
    }
}