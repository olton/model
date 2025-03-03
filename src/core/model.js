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
    constructor(data = {}, options = {}) {
        super();
       
        this.options = Object.assign({}, ModelOptions, options);
        this.computed = {};

        // Реєструємо обчислювані властивості
        for (const key in data) {
            if (typeof data[key] === 'function') {
                this.computed[key] = {
                    getter: data[key],
                    value: null,
                    dependencies: [] // Буде заповнено під час першого виклику
                };
                delete data[key];
            }
        }

        this.dom = new DOMManager(this)
        this.store = new ReactiveStore(data);
        this.data = this.store.state;
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
    
    // Додаємо валідацію
    addValidator(path, validator) {
        this.store.addValidator(path, validator);
    }

    // Додаємо форматування
    addFormatter(path, formatter) {
        this.store.addFormatter(path, formatter);
    }

    // Додаємо middleware
    use(middleware) {
        this.store.use(middleware);        
    }
    
    watch(path, callback) {
        this.store.watch(path, callback);
    }

    // Ініціюємо модель на відповідному DOM елементі
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

    // Ініціюємо DevTools
    initDevTools(options = {}) {
        return new DevTools(this, options);
    }
    
    destroy() {
        this.dom.destroy();
        this.store.destroy();        
        
        // Викликаємо подію для додаткового очищення
        this.emit('destroy');

        // Очищаємо всіх слухачів подій
        // this.removeAllEventListeners();
    }
}

export default Model;