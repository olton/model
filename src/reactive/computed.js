/**
 * Manages computed properties in a reactive model system.
 * - Initializes computed property getters
 * - Tracks property dependencies automatically
 * - Updates computed values on dependency changes
 * - Supports nested object dependencies
 *
 * @class
 * @property {Object} model - Host reactive model
 * @property {Object} computed - Computed property definitions
 * @property {Object} store - Reference to model's data store
 */
export default class ComputedProps {
    constructor(model, computed = {}) {
        this.model = model;
        this.computed = computed;
        this.store = model.store;
        this.asyncCache = new Map();
    }

    /**
     * Sets up computed properties in the model.
     * - Performs initial evaluation of all computed properties
     * - Defines getter proxies on model.data
     * - Makes computed properties enumerable and configurable
     * - Ensures reactive updates through getter access
     *
     * @method init
     */
    async init() {
        for (const key in this.computed) {
            await this.evaluate(key);

            Object.defineProperty(this.model.data, key, {
                get: () => {
                    const computed = this.computed[key];
                    // Повертаємо кешоване значення для асинхронних властивостей
                    return computed.isAsync ? this.asyncCache.get(key) : computed.value;
                },
                enumerable: true,
                configurable: true
            });
        }
    }

    /**
     * Evaluates computed property and tracks its dependencies.
     * - Creates proxy for dependency tracking
     * - Handles nested object dependencies
     * - Records all accessed properties during evaluation
     * - Emits computation events with results
     * - Supports forced re-evaluation
     *
     * @method evaluate
     * @param {string} key - Computed property name
     * @param {boolean} [force=false] - Force re-evaluation flag
     * @returns {*} New computed value
     * @emits compute
     */
    async evaluate(key, force = false) {
        const computed = this.computed[key];
        const dependencies = new Set();

        const dataTracker = new Proxy(this.store.getState(), {
            get: (target, prop) => {
                dependencies.add(prop);
                let value = target[prop];

                if (value && typeof value === 'object') {
                    return new Proxy(value, {
                        get: (obj, nestedProp) => {
                            dependencies.add(`${prop}.${nestedProp}`);
                            return obj[nestedProp];
                        }
                    });
                }
                return value;
            }
        });

        // Перевіряємо чи геттер є асинхронним
        const isAsync = computed.getter.constructor.name === 'AsyncFunction';
        computed.isAsync = isAsync;

        try {
            const result = await computed.getter.call(dataTracker);
            computed.dependencies = [...dependencies];

            if (isAsync) {
                // Зберігаємо результат в кеш для асинхронних властивостей
                this.asyncCache.set(key, result);
            } else {
                computed.value = result;
            }

            this.store.emit('compute', {
                key,
                value: result,
                dependencies,
                isAsync
            });

            return result;
        } catch (error) {
            console.error(`Error evaluating computed property "${key}":`, error);
            throw error;
        }
    }

    /**
     * Updates computed properties affected by model changes.
     * Checks three types of dependencies:
     * - Direct property matches
     * - Nested property changes (parent changed)
     * - Parent property changes (child changed)
     * Re-evaluates affected computed properties
     *
     * @method update
     * @param {string} changedProp - Changed property path
     */
    async update(changedProp) {
        const updatePromises = [];

        for (const key in this.computed) {
            const computed = this.computed[key];

            const isDependency = computed.dependencies.some(dep => {
                if (dep === changedProp) return true;
                if (changedProp.startsWith(dep + '.')) return true;
                if (dep.startsWith(changedProp + '.')) return true;
                return false;
            });

            if (isDependency) {
                const updatePromise = (async () => {
                    const newValue = await this.evaluate(key);
                    this.model.dom.updateDOM(key, newValue);
                    this.model.dom.updateInputs(key, newValue);
                })();

                updatePromises.push(updatePromise);
            }
        }

        // Чекаємо завершення всіх оновлень
        await Promise.all(updatePromises);
    }

    /**
     * @method all
     * @description Retrieves all computed properties and their current values.
     * Converts the `computed` object into a plain object, mapping each computed
     * property's name to its current value.
     *
     * @returns {Object} An object containing all computed property names and their values.
     */
    all() {
        return Object.fromEntries(
            Object.entries(this.computed)
                .map(([key, comp]) => [key, comp.value])
        );
    }
}