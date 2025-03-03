import EventEmitter from '../event-emitter/event-emitter.js';
import DevTools from "../dev/dev-tools.js";
import Logger from '../dev/logger.js';
import ReactiveStore from "../reactive/reactive-store.js";
import DOMManager from "../dom/dom-manager.js";
import ComputedProps from "../reactive/computed.js";

const ModelOptions = {
    id: "model",
    memoizeComputed: true,
}

class Model extends EventEmitter {
    static plugins = new Map();

    constructor(data = {}, options = {}) {
        super();
       
        this.options = Object.assign({}, ModelOptions, options);
        this.computed = {};

        // We register the calculated properties
        for (const key in data) {
            if (typeof data[key] === 'function') {
                this.computed[key] = {
                    getter: data[key],
                    value: null,
                    dependencies: [] 
                };
                delete data[key];
            }
        }

        this.store = new ReactiveStore(data);
        this.data = this.store.state;
        this.dom = new DOMManager(this)
        this.computedProps = new ComputedProps(this, this.computed);
        this.subscribe();
        this.computedProps.init();
    }

    subscribe() {
        this.store.on("change", (data) => {
            this.dom.updateDOM(data.path, data.newValue);
            this.dom.updateInputs(data.path, data.newValue);
            this.computedProps.update(data.path);
        });
    }
    
    // Add validation
    addValidator(path, validator) {
        this.store.addValidator(path, validator);
    }

    // Add formatting
    addFormatter(path, formatter) {
        this.store.addFormatter(path, formatter);
    }

    // Add Middleware
    use(middleware) {
        this.store.use(middleware);        
    }
    
    // Add the watcher
    watch(path, callback) {
        this.store.watch(path, callback);
    }

    // We initiate the model on the appropriate Dom element
    init(selector) {
        const rootElement = typeof selector === 'string'
            ? document.querySelector(selector)
            : selector;

        if (!rootElement) {
            Logger.error('The root element was not found!');
            return;
        }

        this.dom.bindDOM(rootElement);

        this.emit('init');
        
        return this;
    }

    // We initiate devtools
    initDevTools(options = {}) {
        return new DevTools(this, options);
    }

    static registerPlugin(name, plugin) {
        if (this.plugins.has(name)) {
            throw new Error(`Plugin ${name} already registered`);
        }
        this.plugins.set(name, plugin);
    }
    
    usePlugin(name, options = {}) {
        const Plugin = Model.plugins.get(name);
        if (!Plugin) {
            console.error(`Plugin ${name} not found`);
        }
        new Plugin(this, options);
        return this;
    }

    destroy() {
        this.dom.destroy();
        this.store.destroy();        
        
        // Викликаємо подію для додаткового очищення
        this.emit('destroy');
    }
}

export default Model;