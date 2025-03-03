import EventEmitter from '../event-emitter/event-emitter.js';
import DevTools from "../dev/dev-tools.js";
import ReactiveStore from "../reactive/reactive-store.js";
import DOMManager from "../dom/dom-manager.js";
import ComputedProps from "../reactive/computed.js";
import StateManager from "../state-manager/state-manager.js";

/**
 * Default options for the Model class.
 * @type {{id: string, memoizeComputed: boolean}}
 */
const ModelOptions = {
    id: "model", 
    memoizeComputed: true,
}

/**
 * A core class for managing reactive data, DOM bindings, computed properties, and more.
 * Extends EventEmitter for event handling capabilities.
 */
class Model extends EventEmitter {
    /**
     * A map for storing registered plugins.
     * @type {Map<string, Function>}
     */
    static plugins = new Map();

    /**
     * Creates a new instance of the Model class.
     * @param {Object} [data={}] - Initial data for the model.
     * @param {Object} [options={}] - Configuration options for the model.
     */
    constructor(data = {}, options = {}) {
        super();

        this.options = Object.assign({}, ModelOptions, options);
        this.computed = {};

        // We register the calculated properties
        for (const key in data) {
            if (typeof data[key] === 'function') {
                this.computed[key] = {
                    getter: data[key], value: null, dependencies: []
                };
                delete data[key];
            }
        }

        this.store = new ReactiveStore(data);
        this.data = this.store.state;
        this.dom = new DOMManager(this);
        this.computedProps = new ComputedProps(this, this.computed);
        this.stateManager = new StateManager(this.store);

        this.subscribe();
        this.computedProps.init();
    }

    /**
     * Subscribes to changes from the ReactiveStore and handles DOM updates,
     * input field updates, and computed properties recalculation.
     */
    subscribe() {
        this.store.on("change", (data) => {
            this.dom.updateDOM(data.path, data.newValue);
            this.dom.updateInputs(data.path, data.newValue);
            this.computedProps.update(data.path);
        });
    }

    /**
     * Adds a validator function to a specified path.
     * @param {string} path - Path within the state to attach the validator.
     * @param {Function} validator - Validation function to execute on path changes.
     */
    addValidator(path, validator) {
        this.store.addValidator(path, validator);
    }

    /**
     * Adds a formatter function to a specified path.
     * @param {string} path - Path within the state to attach the formatter.
     * @param {Function} formatter - Formatting function to execute on path changes.
     */
    addFormatter(path, formatter) {
        this.store.addFormatter(path, formatter);
    }

    /**
     * Adds middleware to the ReactiveStore for intercepting and processing state changes.
     * @param {Function} middleware - Middleware function that receives and can modify state changes before they're applied.
     */
    use(middleware) {
        this.store.use(middleware);
    }

    /**
     * Watches a specific path in the state and triggers a callback on changes.
     * @param {string} path - Path to watch.
     * @param {Function} callback - Callback function to execute when the path changes.
     */
    watch(path, callback) {
        this.store.watch(path, callback);
    }

    /**
     * Initializes the DOM bindings for the model.
     * @param {string|HTMLElement} selector - Selector or root element to bind on.
     * @returns {Model|undefined} - Returns the model instance, or undefined if the root element is not found.
     */
    init(selector) {
        const rootElement = typeof selector === 'string' ? document.querySelector(selector) : selector;

        if (!rootElement) {
            console.error('The root element was not found!');
            return;
        }

        this.dom.bindDOM(rootElement);

        this.emit('init');

        return this;
    }

    /**
     * Initializes development tools for the model.
     * @param {Object} [options={}] - Options for the development tools.
     * @returns {DevTools} - An instance of the DevTools class.
     */
    runDevTools(options = {}) {
        return new DevTools(this, options);
    }

    /**
     * Saves the current state of the model.
     * @returns {{data: *, timestamp: number}|null}
     */
    save() {
        return this.stateManager.saveState();
    }

    /**
     * Restores the model to a previously saved state.
     * @returns {*|null}
     */
    restore() {
        return this.stateManager.restoreState();
    }

    /**
     * Creates a snapshot of the current state.
     * @param _snapshot
     * @returns {*|null|{data: *, timestamp: number}}
     */
    snapshot(_snapshot) {
        if (!_snapshot) {
            return this.stateManager.createSnapshot();
        }

        return this.stateManager.restoreSnapshot(s);
    }

    /**
     * Enables or disables auto-saving of the model's state.
     * @param interval
     */
    autoSave(interval) {
        if (!interval) {
            this.stateManager.disableAutoSave()
        } else {
            this.stateManager.enableAutoSave(interval);
        }
    }
    
    /**
     * Registers a plugin for the model.
     * @param {string} name - Name of the plugin.
     * @param {Function} plugin - Plugin class or constructor function.
     * @throws {Error} If a plugin with the same name is already registered.
     */
    static registerPlugin(name, plugin) {
        if (this.plugins.has(name)) {
            throw new Error(`Plugin ${name} already registered`);
        }
        this.plugins.set(name, plugin);
    }

    /**
     * Uses a registered plugin by name.
     * @param {string} name - Name of the plugin to use.
     * @param {Object} [options={}] - Options to pass to the plugin.
     * @returns {Model} - Returns the model instance to allow method chaining.
     */
    usePlugin(name, options = {}) {
        const Plugin = Model.plugins.get(name);
        if (!Plugin) {
            console.error(`Plugin ${name} not found`);
        }
        new Plugin(this, options);
        return this;
    }

    /**
     * Destroys the model instance and cleans up resources.
     */
    destroy() {
        this.dom.destroy();
        this.store.destroy();

        this.emit('destroy');
    }
}

export default Model;
