import EventEmitter from '../event-emitter/event-emitter.js';
import MiddlewareManager from "../middleware/middleware.js";

/**
 * Reactive state management store with:
 * - Deep reactivity through Proxy
 * - Middleware support for state changes
 * - Validation and formatting capabilities
 * - State change history tracking
 * - Event-driven updates via EventEmitter
 * - Support for arrays and nested objects
 *
 * @extends EventEmitter
 */
export default class ReactiveStore extends EventEmitter {

    /**
     * Initializes a new ReactiveStore.
     * - Creates reactive proxy for state management
     * - Sets up watchers for property observation
     * - Stores previous state for change detection
     * - Initializes middleware system for state updates
     *
     * @param {Object} [initialState={}] - Initial store state
     * @property {Proxy} state - Reactive state object
     * @property {Map} watchers - Property change observers
     * @property {Object} previousState - Last known state
     * @property {MiddlewareManager} middleware - State update pipeline
     */
    constructor(initialState = {}) {
        super();

        this.state = this.createReactiveProxy(initialState);
        this.watchers = new Map();
        this.previousState = JSON.parse(JSON.stringify(initialState));
        this.middleware = new MiddlewareManager();
    }

    /**
     * Registers state change middleware.
     * Middleware receives context object with:
     * - prop: Changed property name
     * - oldValue: Previous value
     * - newValue: New value
     * - preventDefault: Control flag
     *
     * @param {Function} middleware - Handler(context, next)
     */
    use(middleware) {
        this.middleware.use(middleware);
    }

    /**
     * Creates reactive proxy for state objects.
     * Features:
     * - Special handling for arrays via separate proxy
     * - Deep reactivity for nested objects
     * - Property path tracking
     * - Value validation support
     * - Value formatting support
     * - Middleware integration
     * - Change prevention capability
     *
     * @param {Object|Array} obj - Target object
     * @param {string} [path=''] - Property path
     * @returns {Proxy} Reactive proxy
     */
    createReactiveProxy(obj, path = '') {

        if (Array.isArray(obj)) {
            return this.createArrayProxy(obj, path);
        }

        return new Proxy(obj, {
            get: (target, prop) => {
                if (typeof prop === 'symbol') {
                    return target[prop];
                }

                const value = target[prop];
                const fullPath = path ? `${path}.${prop}` : prop;

                if (value && typeof value === 'object') {
                    return this.createReactiveProxy(value, fullPath);
                }

                return value;
            },

            set: async (target, prop, value) => {
                if (typeof prop === 'symbol') {
                    target[prop] = value;
                    return true;
                }

                const fullPath = path ? `${path}.${prop}` : prop;
                const oldValue = target[prop];

                if (oldValue === value) {
                    return true;
                }

                if (this.validators?.has(`${fullPath}`)) {
                    const isValid = this.validators.get(`${fullPath}`)(value);
                    if (!isValid) return false;
                }

                if (this.formatters?.has(`${fullPath}`)) {
                    value = this.formatters.get(`${fullPath}`)(value);
                }
                
                if (value && typeof value === 'object') {
                    value = this.createReactiveProxy(value, fullPath);
                }

                const context = {
                    prop,
                    oldValue,
                    newValue: value,
                    preventDefault: false
                };

                await this.middleware.process(context);

                if (context.preventDefault) {
                    return true;
                }

                target[prop] = value;

                this.emit('change', {
                    path: fullPath,
                    oldValue,
                    newValue: value
                });

                if (this.watchers.has(fullPath)) {
                    this.watchers.get(fullPath).forEach(callback => {
                        callback(value, oldValue);
                    });
                }

                return true;
            },

            deleteProperty: (target, prop) => {
                if (typeof prop === 'symbol') {
                    return delete target[prop];
                }

                const fullPath = path ? `${path}.${prop}` : prop;
                const oldValue = target[prop];

                const result = delete target[prop];

                if (result) {

                    this.emit('delete', {
                        path: fullPath,
                        oldValue
                    });

                    if (this.watchers.has(fullPath)) {
                        this.watchers.get(fullPath).forEach(callback => {
                            callback(undefined, oldValue);
                        });
                    }
                }

                return result;
            }
        });
    }

    /**
     * Creates a reactive proxy for an array.
     * The proxy intercepts standard array methods (e.g., push, pop, shift, etc.)
     * to enable detection and reaction to structural changes in the array.
     * It also ensures that array elements are made reactive.
     *
     * @param {Array} array - The array to be proxied.
     * @param {string} path - The path to the current property in the state tree.
     *
     * @returns {Proxy} A proxy that wraps the given array to make it reactive.
     */
    createArrayProxy(array, path) {
        return new Proxy(array, {
            get: (target, prop) => {
                if (typeof prop === 'symbol') {
                    return target[prop];
                }

                const value = target[prop];

                if (typeof value === 'function' &&
                    ['push', 'pop', 'shift', 'unshift', 'splice', 'sort', 'reverse'].includes(prop)) {

                    return (...args) => {
                        const oldValue = [...target];
                        const result = target[prop].apply(target, args);

                        const context = {
                            prop: path,
                            oldValue,
                            newValue: target,
                            method: prop,
                            args,
                            preventDefault: false
                        };

                        this.middleware.process(context).then(() => {
                            if (!context.preventDefault) {
                                // Емітимо подію про зміну
                                this.emit('change', {
                                    path,
                                    oldValue,
                                    newValue: target,
                                    method: prop,
                                    args
                                });

                                // Викликаємо відповідні watchers
                                if (this.watchers.has(path)) {
                                    this.watchers.get(path).forEach(callback => {
                                        callback(target, oldValue);
                                    });
                                }
                            }
                        });

                        return result;
                    };
                }

                if (typeof prop !== 'symbol' && !isNaN(Number(prop))) {
                    if (value && typeof value === 'object') {
                        return this.createReactiveProxy(value, `${path}[${prop}]`);
                    }
                }

                return value;
            },

            set: async (target, prop, value) => {
                if (typeof prop === 'symbol') {
                    target[prop] = value;
                    return true;
                }

                const fullPath = path ? `${path}.${prop}` : prop;
                const oldValue = target[prop];

                if (oldValue === value) {
                    return true;
                }

                if (this.validators?.has(fullPath)) {
                    const isValid = this.validators.get(fullPath)(value);
                    if (!isValid) return false;
                }

                if (this.formatters?.has(fullPath)) {
                    value = this.formatters.get(fullPath)(value);
                }

                target[prop] = value;

                if (value && typeof value === 'object') {
                    value = this.createReactiveProxy(value, `${path}[${prop}]`);
                }

                const context = {
                    prop,
                    oldValue,
                    newValue: value,
                    preventDefault: false
                };

                await this.middleware.process(context);

                if (context.preventDefault) {
                    return true;
                }

                target[prop] = value;

                this.middleware.process(context).then(() => {
                    if (!context.preventDefault) {
                        this.emit('change', {
                            path: fullPath,
                            oldValue,
                            newValue: value,
                            arrayIndex: Number(prop)
                        });

                        if (this.watchers.has(fullPath)) {
                            this.watchers.get(fullPath).forEach(callback => {
                                callback(value, oldValue);
                            });
                        }
                    }
                });

                return true;
            }
        });
    }

    /**
     * Applies the specified array method (e.g., push, pop, splice) on the array
     * located at the given path in the state tree. The function ensures
     * that the changes are reactive by emitting appropriate events and invoking watchers.
     *
     * @param {string} path - The path to the array in the state tree.
     * @param {string} method - The name of the array method to apply (e.g., 'push', 'pop').
     * @param {...any} args - Arguments to pass to the array method.
     *
     * @returns {any} The result of applying the array method to the array.
     */
    applyArrayMethod(path, method, ...args) {
        const array = this.get(path);

        if (!Array.isArray(array)) {
            console.error(`Путь ${path} не является массивом!`);
            return false;
        }

        const oldArray = [...array];

        const result = array[method].apply(array, args);

        this.emit('arrayChange', {
            path,
            method,
            args,
            oldValue: oldArray,
            newValue: [...array]
        });

        this.emit('change', {
            path,
            oldValue: oldArray,
            newValue: [...array]
        });

        if (this.watchers.has(path)) {
            this.watchers.get(path).forEach(callback => {
                callback([...array], oldArray);
            });
        }

        return result;
    }

    /**
     * Watches for changes to an array located at the specified path in the state tree
     * and applies the provided callback to make modifications.
     * Emitted events ensure that watchers are notified and reactivity is maintained.
     *
     * @param {string} path - The path to the array in the state tree.
     * @param {Function} callback - A function to modify the array.
     *                               Receives the array as an argument and applies changes to it.
     *
     * @returns {any} The result of the callback function applied to the array.
     */
    applyArrayChanges(path, callback) {
        const array = this.get(path);

        if (!Array.isArray(array)) {
            console.error(`The path ${path} is not an array!`);
            return false;
        }

        const oldArray = [...array];
        const result = callback(array);

        this.emit('change', {
            path,
            oldValue: oldArray,
            newValue: [...array]
        });

        if (this.watchers.has(path)) {
            this.watchers.get(path).forEach(callback => {
                callback([...array], oldArray);
            });
        }

        return result
    }

    /**
     * Detects changes between two arrays, identifying items that were added, removed,
     * or moved. This function compares items by their JSON stringified values.
     *
     * @param {Array} newArray - The new array to compare.
     * @param {Array} [oldArray=[]] - The old array to compare against. Defaults to an empty array.
     *
     * @returns {Object} An object containing the changes between the arrays.
     */
    detectArrayChanges(newArray, oldArray = []) {
        const changes = {
            added: [],
            removed: [],
            moved: []
        };

        for (let i = 0; i < newArray.length; i++) {
            const item = newArray[i];
            const oldIndex = oldArray.findIndex(oldItem =>
                JSON.stringify(oldItem) === JSON.stringify(item)
            );

            if (oldIndex === -1) {
                changes.added.push({index: i, item});
            } else if (oldIndex !== i) {
                changes.moved.push({oldIndex, newIndex: i, item});
            }
        }

        for (let i = 0; i < oldArray.length; i++) {
            const item = oldArray[i];
            const newIndex = newArray.findIndex(newItem =>
                JSON.stringify(newItem) === JSON.stringify(item)
            );

            if (newIndex === -1) {
                changes.removed.push({index: i, item});
            }
        }

        return changes;
    }

    /**
     * Watches for changes to the specified path in the state tree
     * and allows the addition of callbacks that execute when changes occur.
     *
     * @param {string} path - The path in the state tree to watch for changes.
     * @param {Function} callback - A function to execute when the value at the path changes.
     *                                The callback receives the new and old values as parameters.
     *
     * @returns {Function} A function to unsubscribe the callback from the watcher.
     */
    watch(path, callback) {
        if (!this.watchers.has(path)) {
            this.watchers.set(path, new Set());
        }
        this.watchers.get(path).add(callback);

        return () => {
            if (this.watchers.has(path)) {
                this.watchers.get(path).delete(callback);
            }
        };
    }

    /**
     * Retrieves the value at the specified path in the state tree.
     * @param {string} [path] - The dot-delimited path to the desired value within the state tree.
     * @returns {any} - The value at the specified path or `undefined` if the path does not exist.
     */
    get(path) {
        if (!path) return this.state;

        const parts = path.split('.');
        let value = this.state;

        for (const part of parts) {
            if (value === undefined || value === null) {
                return undefined;
            }
            value = value[part];
        }

        return value;
    }

    /**
     * Sets a new value at the specified path in the state tree.
     * @param {String} path - The dot-delimited path to the desired value within the state tree.
     * @param {any} value - The new value to set at the specified path.
     */
    set(path, value) {
        const parts = path.split('.');
        let current = this.state;

        for (let i = 0; i < parts.length - 1; i++) {
            if (current[parts[i]] === undefined) {
                current[parts[i]] = {};
            }
            current = current[parts[i]];
        }

        current[parts[parts.length - 1]] = value;
        return value;
    }

    /**
     * Executes the given updater as a batch operation on the state.
     *
     * If the `updater` is a function, it will be invoked with the state as an argument,
     * allowing for multiple updates within a single call. If the `updater` is an object,
     * its key-value pairs will be used to update specific paths in the state.
     *
     * After the batch operation completes, an event (`batchUpdate`) is emitted containing
     * both the previous state (before changes) and the current state (after changes).
     *
     * @param {Function|Object} updater - Either a function to modify the state or an object where keys represent
     *                                    paths (dot-delimited) and values are the new values to set for those paths.
     */
    batch(updater) {
        this.previousState = JSON.parse(JSON.stringify(this.state));

        if (typeof updater === 'function') {
            updater(this.state);
        } else if (typeof updater === 'object') {
            Object.entries(updater).forEach(([path, value]) => {
                this.set(path, value);
            });
        }

        this.emit('batchUpdate', {
            previousState: this.previousState,
            currentState: this.state
        });
    }

    /**
     * Retrieves the current state tree.
     * @returns {Object} The entire state object.
     */
    getState() {
        return this.state;
    }

    /**
     * Retrieves the previous state of the state tree.
     *
     * This method returns the state as it was prior to the last update,
     * enabling comparison or rollback operations if needed.
     *
     * @returns {Object} The previous state object.
     */
    getPreviousState() {
        return this.previousState;
    }

    /**
     * Converts the current state tree to a JSON string.
     *
     * This method serializes the entire state tree into a JSON-formatted string,
     * which can be used for storage, transmission, or debugging purposes.
     *
     * @returns {string} A JSON string representation of the current state.
     */
    toJSON() {
        return JSON.stringify(this.state);
    }

    /**
     * Reconstructs the state tree from a JSON string.
     *
     * This method accepts a JSON-formatted string representing the state,
     * replaces the current state with the contents of the JSON, and emits a `restore` event
     * to notify listeners about the restoration operation. The previous state is preserved
     * for potential comparisons or rollback operations.
     *
     * @param {string} json - A JSON-formatted string representing the new state.
     */
    fromJSON(json) {
        const newState = JSON.parse(json);
        this.previousState = JSON.parse(JSON.stringify(this.state));

        Object.keys(this.state).forEach(key => {
            delete this.state[key];
        });

        Object.entries(newState).forEach(([key, value]) => {
            this.state[key] = value;
        });

        this.emit('restore', {
            previousState: this.previousState,
            currentState: this.state
        });
    }

    /**
     * Adds a validator function for a specific property in the state tree.
     *
     * The validator function should accept the new value as a parameter
     * and return `true` if the value is valid, or `false` if it is invalid.
     *
     * @param {string} propertyPath - The dot-delimited path to the property in the state tree to validate.
     * @param {Function} validator - A function that checks the validity of the property value.
     */
    addValidator(propertyPath, validator) {
        if (!this.validators) {
            this.validators = new Map();
        }
        this.validators.set(propertyPath, validator);
    }

    /**
     * Adds a formatter function for a specific property in the state tree.
     *
     * The formatter function modifies the value of a property before it is returned.
     * This can be helpful when the stored value needs to be presented in a specific format.
     *
     * @param {string} propertyPath - The dot-delimited path to the property in the state tree to format.
     * @param {Function} formatter - A function that transforms the value of the property.
     *                                The function receives the current value as a parameter
     *                                and returns the formatted value.
     */
    addFormatter(propertyPath, formatter) {
        if (!this.formatters) {
            this.formatters = new Map();
        }
        this.formatters.set(propertyPath, formatter);
    }

    /**
     * Validates if the provided path exists in the state tree.
     *
     * This method checks whether the specified dot-delimited path
     * in the state tree resolves to a defined value.
     *
     * @param {string} path - The dot-delimited path to validate.
     * @returns {boolean} - `true` if the path exists and has a defined value, `false` otherwise.
     */
    isValidPath(path) {
        try {
            const value = this.get(path);
            return value !== undefined;
        } catch (e) {
            return false;
        }
    }

    /**
     * Destroys the current state object and clears all associated watchers and previous states.
     *
     * This method is useful for cleanup operations, ensuring no residual state,
     * watchers, or references are left in memory.
     */
    destroy() {
        this.state = null;
        this.watchers.clear();
        this.previousState = null;
    }
}