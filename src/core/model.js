import EventEmitter from '../event-emitter/event-emitter.js'
import DevTools from '../dev/dev-tools.js'
import ReactiveStore from '../reactive/reactive-store.js'
import DOMManager from '../dom/dom-manager.js'
import ComputedProps from '../reactive/computed.js'
import StateManager from '../state-manager/state-manager.js'
import Logger from '../logger/logger.js'

/**
 * Default options for the Model class.
 * @type {{id: string}}
 */
const ModelOptions = {
    id: "model", 
    useSimpleExpressions: true,
    debug: false,
    plugins: [],
    validators: [],
    formatters: [],
}

/**
 * A core class for managing reactive data, DOM bindings, computed properties, and more.
 * Extends EventEmitter for event handling capabilities.
 */
class Model extends EventEmitter {
    /**
     * Creates a new instance of the Model class.
     * @param {Object} [data={}] - Initial data for the model.
     * @param {Object} [options={}] - Configuration options for the model.
     */
    constructor(data = {}, options = {}) {
        super();

        this.options = {...ModelOptions, ...options};

        Logger.DEBUG_LEVEL = this.options.debug ? 4 : 0;
        Logger.debug('Creating a model with data:', data);
        Logger.debug('Configuration options:', options);
        
        // this.events = []
        this.computed = {};

        // We register the calculated properties
        for (const key in data) {
            if (typeof data[key] === 'function') {
                Logger.debug(`Registration calculated property "${key}"`);
                this.computed[key] = {
                    getter: data[key], 
                    value: null, 
                    dependencies: [],
                };
                delete data[key];
            }
        }

        this.store = new ReactiveStore(data, this);
        this.data = this.store.state;
        this.dom = new DOMManager(this);
        this.computedProps = new ComputedProps(this, this.computed);
        this.stateManager = new StateManager(this.store);
        this.plugins = new Map();

        if (this.options.plugins) {
            for (const p of this.options.plugins) {
                const {name, plugin, options} = p;
                if (name && plugin && typeof plugin === 'function') {
                    this.registerPlugin(name, plugin, options);
                }
            }
        }
        
        if (this.options.validators) {
            for (const p of this.options.validators) {
                const {path, validator} = p;
                if (path && validator && typeof validator === 'function') {
                    this.addValidator(path, validator);
                }
            }
        }
        
        if (this.options.formatters) {
            for (const p of this.options.formatters) {
                const {path, formatter} = p;
                if (path && formatter && typeof formatter === 'function') {
                    this.addValidator(path, formatter);
                }
            }
        }
        
        this.subscribe();

        Logger.debug('The model was created successfully!');
    }

    /**
     * Subscribes to changes from the ReactiveStore and handles DOM updates,
     * input field updates, and computed properties recalculation.
     */
    subscribe() {
        Logger.debug('Subscribing to store changes');
        
        this.store.on("change", (data) => {
            this.dom.updateDOM(data.path, data.newValue);
            this.dom.updateInputs(data.path, data.newValue);
            this.computedProps.update(data.path).then(()=>{});
            
            this.emit("change", data);
        });
        this.store.on("compute", (data) => this.emit("compute", data))
        this.store.on("arrayChange", (data) => this.emit("arrayChange", data))
        this.store.on("batchComplete", (data) => this.emit("batchComplete", data))

        Logger.debug('Subscribing to state manager events');
        this.stateManager.on("saveState", (data) => this.emit("saveState", data))
        this.stateManager.on("saveStateError", (error) => this.emit("saveStateError", error))
        this.stateManager.on("restoreState", (data) => this.emit("restoreState", data))
        this.stateManager.on("restoreStateError", (error) => this.emit("restoreStateError", error))
        this.stateManager.on("createSnapshot", (data) => this.emit("createSnapshot", data))
        this.stateManager.on("restoreSnapshot", (data) => this.emit("restoreSnapshot", data))
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
     * Executes a batch of state changes in a single update cycle.
     * @param callback
     */
    batch(callback) {
        return this.store.batch(callback);
    }

    /**
     * Detects changes between two arrays and returns the differences.
     * @param newArray
     * @param oldArray
     * @returns {{added: [], removed: [], moved: []}}
     */
    diffArrays(newArray, oldArray) {
        return this.store.detectArrayChanges(newArray, oldArray);
    }
    
    diff(){
        // Not implemented yet
    }

    /**
     * Validates the model for potential issues, including:
     *
     * 1. Cyclic dependencies in computed properties: Ensures that no property in the `computed`
     *    object of the model depends on itself through a chain of other properties.
     * 2. Invalid paths in DOM dependencies: Ensures that all paths used in the DOM template
     *    exist within the model's store.
     *
     * @returns {{errors: Array<Object>, warnings: Array<Object>}} - Returns an object containing arrays
     *          of errors and warnings. Each error or warning is represented as an object with details
     *          about the issue.
     *
     * Errors include:
     * - `CYCLIC_DEPENDENCY`: Indicates a cyclic dependency was found in `computed` properties.
     *   - `property`: The property with the cyclic dependency.
     *   - `message`: Description of the cyclic dependency.
     *
     * Warnings include:
     * - `INVALID_PATH`: Indicates a path used in the DOM does not exist in the model.
     *   - `path`: The invalid path.
     *   - `message`: Description of the invalid path.
     */
    validate() {
        const errors = [];
        const warnings = [];

        for (const key in this.computed) {
            const visited = new Set();
            const cyclePath = this._checkCyclicDependencies(key, visited);
            if (cyclePath) {
                errors.push({
                    type: 'CYCLIC_DEPENDENCY',
                    property: key,
                    message: `Cyclic dependence is found: ${cyclePath.join(' -> ')}`
                });
            }
        }

        this.dom.domDependencies.forEach((deps, path) => {
            if (!this.store.isValidPath(path)) {
                warnings.push({
                    type: 'INVALID_PATH',
                    path,
                    message: `Property ${path} used in the template, but does not exist in the model`
                });
            }
        });

        return {errors, warnings};
    }

    /**
     * Checks for cyclic dependencies in the computed properties of the model.
     *
     * This method recursively traverses the dependencies of a given property to determine
     * if a cyclic dependency exists. A cyclic dependency occurs when a property ultimately
     * depends on itself through a chain of other properties.
     *
     * @param {string} key - The key of the property to check for cyclic dependencies.
     * @param {Set<string>} visited - A set of visited properties during the traversal.
     * @param {string[]} [path=[]] - The current path of dependencies being checked.
     * @returns {string[]|null} - Returns an array representing the cyclic path if a cycle is found,
     *                            otherwise `null`.
     */
    _checkCyclicDependencies(key, visited, path = []) {
        if (visited.has(key)) {
            return [...path, key];
        }

        visited.add(key);
        path.push(key);

        const computed = this.computed[key];
        if (!computed || !computed.dependencies) {
            return null;
        }

        for (const dep of computed.dependencies) {
            if (dep in this.computed) {
                const cyclePath = this._checkCyclicDependencies(dep, new Set(visited), [...path]);
                if (cyclePath) {
                    return cyclePath;
                }
            }
        }

        return null;
    }

    /**
     * Validates a given path to check if it exists in the model's store.
     * @param path
     * @returns {boolean}
     */
    validatePath(path){
        return this.store.isValidPath(path);
    }
    
    /**
     * Initializes the DOM bindings for the model.
     * @param {string|HTMLElement} selector - Selector or root element to bind on.
     * @returns {Model|undefined} - Returns the model instance, or undefined if the root element is not found.
     */
    init(selector) {
        Logger.debug('Initializing DOM bindings');
        
        let rootElement = typeof selector === 'string' ? document.querySelector(selector) : selector;

        if (!rootElement) {
            rootElement = document.body
        }

        Logger.debug(`Model initialized in ${selector ?? 'body'}`);

        Logger.debug('Binding DOM');
        this.dom.bindDOM(rootElement);

        this.emit('init');

        Logger.debug('Initialization complete!');
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

        return this.stateManager.restoreSnapshot(_snapshot);
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
     * @param options
     * @throws {Error} If a plugin with the same name is already registered.
     */
    registerPlugin(name, plugin, options = {}) {
        if (this.plugins.has(name)) {
            throw new Error(`Plugin ${name} already registered`);
        }
        this.plugins.set(name, new plugin(this, options));
    }

    /**
     * Uses a registered plugin by name.
     * @param {string} name - Name of the plugin to use.
     * @param {Object} [options={}] - Options to pass to the plugin.
     * @returns {Model} - Returns the model instance to allow method chaining.
     */
    usePlugin(name, options = {}) {
        const pluginInstance = this.plugins.get(name);
        if (!pluginInstance) {
            console.error(`Plugin ${name} not found`);
            return this
        }
        pluginInstance.run();
        return this;
    }

    /**
     * Removes a registered plugin by name.
     * @param name
     */
    removePlugin(name) {
        if (this.plugins.has(name)) {
            this.plugins.delete(name);
        }
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
