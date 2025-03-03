import EventEmitter from './event-emitter/event-emitter.js';
import DevTools from "./dev/dev-tools.js";
import Logger from './dev/logger.js';
import ReactiveStore from "./reactive/reactive-store.js";
import DOMManager from "./dom/dom-manager.js";
import ComputedProps from "./reactive/computed.js";

const ModelOptions = {
    id: "model",
    memoizeComputed: true,
}

class Model extends EventEmitter {
    constructor(data = {}, options = {}) {
        Logger.DEBUG_LEVEL = Logger.DEBUG_LEVELS.DEBUG;

        Logger.debug('Model initialization with data:', data);

        super();
       
        this.options = Object.assign({}, ModelOptions, options);
        this.computed = {};
        this.events = new Map();
        this.autoSaveInterval = null;

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

    // Специализированные методы для массивов
    // Пример использования:
    // model.applyArrayChanges('users', (users) => users.push({ name: 'Новый пользователь' }));
    applyArrayChanges(arrayPath, callback) {
        const array = this.store.get(arrayPath);
        if (!Array.isArray(array)) {
            Logger.error(`The path ${arrayPath} is not an array!`);
            return false;
        }

        this.batchProcessing = true;
        let result;

        try {
            result = callback(array);

            // Обновляем циклы только для измененного массива
            this.loops.forEach((loopInfo, element) => {
                if (loopInfo.arrayPath === arrayPath) {
                    this.updateLoop(element);
                }
            });
        } finally {
            this.batchProcessing = false;
            this.updateAllDOM();
        }

        return result;
    }

    // Добавим метод для валидации и обработки ошибок
    validateModel() {
        const errors = [];
        const warnings = [];

        // Проверяем наличие циклических зависимостей в computed свойствах
        for (const key in this.computed) {
            const visited = new Set();
            const cyclePath = this.checkCyclicDependencies(key, visited);
            if (cyclePath) {
                errors.push({
                    type: 'CYCLIC_DEPENDENCY',
                    property: key,
                    message: `Cyclic dependence is found: ${cyclePath.join(' -> ')}`
                });
            }
        }

        // Проверка на невалидные выражения в шаблонах
        this.domDependencies.forEach((deps, path) => {
            if (!this.isValidPath(path)) {
                warnings.push({
                    type: 'INVALID_PATH',
                    path,
                    message: `Property ${path} used in the template, but does not exist in the model`
                });
            }
        });

        return { errors, warnings };
    }

    // Проверяем наличие циклических зависимостей
    checkCyclicDependencies(key, visited, path = []) {
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
                const cyclePath = this.checkCyclicDependencies(dep, new Set(visited), [...path]);
                if (cyclePath) {
                    return cyclePath;
                }
            }
        }

        return null;
    }

    // Проверка существования пути в модели
    isValidPath(path) {
        try {
            const value = this.store.get(path);
            return value !== undefined;
        } catch (e) {
            return false;
        }
    }
    
    destroy() {
        // Зупиняємо автозбереження
        // this.disableAutoSave();

        // Видаляємо обробники подій з інпутів
        // this.inputs.forEach(({ element }) => {
        //     element.removeEventListener('input', element.__modelInputHandler);
        // });

        // Очищаємо всі колекції
        // this.elements = [];
        // this.inputs = [];
        // this.domDependencies.clear();
        // this.virtualDom.clear();
        // this.watchers.clear();
        // this.loops.clear();
        this.events.clear();

        this.dom.destroy();
        this.store.destroy();        
        
        // Викликаємо подію для додаткового очищення
        this.emit('destroy');

        // Очищаємо всіх слухачів подій
        // this.removeAllEventListeners();
    }
}

export default Model;