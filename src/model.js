import EventEmitter from './event-emmiter.js';
import MiddlewareManager from "./middleware.js";
import DevTools from "./dev-tools.js";

const ModelOptions = {
    id: "model",
    memoizeComputed: true,
}

class Model extends EventEmitter {
    static DEBUG_LEVELS = {
        NONE: 0,
        ERROR: 1,
        WARN: 2,
        INFO: 3,
        DEBUG: 4,
        TRACE: 5
    };

    static DEBUG_LEVEL = Model.DEBUG_LEVELS.NONE;

    static log(level, message, data) {
        if (level > Model.DEBUG_LEVEL) return;

        const styles = {
            error: 'color: #ff5555; font-weight: bold',
            warn: 'color: #ffaa00; font-weight: bold',
            info: 'color: #0080fe; font-weight: bold',
            debug: 'color: #00aa00; font-weight: bold',
            trace: 'color: #888888',
            data: 'color: #555; font-style: italic'
        };

        let styleType;
        let method;

        switch(level) {
            case Model.DEBUG_LEVELS.ERROR:
                styleType = 'error';
                method = console.error;
                break;
            case Model.DEBUG_LEVELS.WARN:
                styleType = 'warn';
                method = console.warn;
                break;
            case Model.DEBUG_LEVELS.INFO:
                styleType = 'info';
                method = console.info;
                break;
            case Model.DEBUG_LEVELS.DEBUG:
                styleType = 'debug';
                method = console.debug;
                break;
            case Model.DEBUG_LEVELS.TRACE:
                styleType = 'trace';
                method = console.log;
                break;
            default:
                return;
        }

        console.group(`%c Model: ${message}`, styles[styleType]);

        if (data !== undefined) {
            console.log('%c Data:', styles.data, data);
        }

        console.groupEnd();
    }

    // Методы для удобства
    static error(message, data) {
        Model.log(Model.DEBUG_LEVELS.ERROR, message, data);
    }

    static warn(message, data) {
        Model.log(Model.DEBUG_LEVELS.WARN, message, data);
    }

    static info(message, data) {
        Model.log(Model.DEBUG_LEVELS.INFO, message, data);
    }

    static debug(message, data) {
        Model.log(Model.DEBUG_LEVELS.DEBUG, message, data);
    }

    static trace(message, data) {
        Model.log(Model.DEBUG_LEVELS.TRACE, message, data);
    }
    
    constructor(data = {}, options = {}) {
        Model.debug('Model initialization with data:', data);

        super();
        
        this.options = Object.assign({}, ModelOptions, options);
        this.elements = [];
        this.inputs = [];
        this.computed = {};
        this.watchers = new Map(); // Додаємо спостерігачів
        this.batchProcessing = false;
        this.loops = new Map();
        this.events = new Map();
        this.middleware = new MiddlewareManager();
        this.autoSaveInterval = null;
        this.domDependencies = new Map(); // Зберігає зв'язки між властивостями та DOM-елементами
        this.virtualDom = new Map(); // Для порівняння станів

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

        this.data = this.createReactiveProxy(data);
    }

    // Метод реєстрації залежності DOM від властивості
    registerDomDependency(propertyPath, domElement, info) {
        if (!this.domDependencies.has(propertyPath)) {
            this.domDependencies.set(propertyPath, new Set());
        }
        this.domDependencies.get(propertyPath).add({
            element: domElement,
            ...info
        });
    }
    
    // Парсимо DOM для пошуку циклів
    parseLoops(rootElement) {
        Model.debug('Looking for items with data-for...');
        const loopElements = rootElement.querySelectorAll('[data-for]');
        Model.debug('Found items from data-for:', loopElements.length);

        loopElements.forEach((element, index) => {
            const expression = element.getAttribute('data-for').trim();
            Model.debug(`Element processing ${index}:`, expression);

            const matches = expression.match(/^\s*(\w+)(?:\s*,\s*(\w+))?\s+in\s+(\w+(?:\.\w+)*)\s*$/);

            if (!matches) {
                console.error('Incorrect format of expression data-for:', expression);
                return;
            }

            const [_, itemName, indexName, arrayPath] = matches;
            Model.debug('The expression is dismantled:', {itemName, indexName, arrayPath});

            const array = this.getValueByPath(arrayPath);
            Model.debug('An array was obtained:', array);

            if (!Array.isArray(array)) {
                Model.error(`The value in the path ${arrayPath} is not an array:`, array);
                return;
            }

            const template = element.cloneNode(true);

            this.loops.set(element, {
                template,
                itemName,
                indexName,
                arrayPath,
                parentNode: element.parentNode
            });

            Model.debug('Update the loop for the item');
            this.updateLoop(element);
        });
    }

    // Оновлюємо цикл
    updateLoop(element) {
        const loopInfo = this.loops.get(element);
        if (!loopInfo) {
            Model.error('No loop information found for an item');
            return;
        }

        const {template, itemName, indexName, arrayPath, parentNode} = loopInfo;
        const array = this.getValueByPath(arrayPath);

        Model.debug('Update loop for array:', array);

        if (!Array.isArray(array)) {
            Model.error('The value is not an array:', array);
            return;
        }

        // Видаляємо попередні згенеровані елементи
        const generated = parentNode.querySelectorAll(`[data-generated-for="${arrayPath}"]`);
        generated.forEach(el => el.remove());

        // Створюємо нові елементи
        array.forEach((item, index) => {
            const newNode = template.cloneNode(true);
            newNode.style.display = '';
            newNode.removeAttribute('data-for');
            newNode.setAttribute('data-generated-for', arrayPath);

            // Замінюємо змінні в шаблоні
            this.processTemplateNode(newNode, {
                [itemName]: item,
                [indexName || 'index']: index
            });

            parentNode.insertBefore(newNode, element);
        });

        // Приховуємо оригінальний шаблон
        element.style.display = 'none';
    }

    // Обробка шаблонних вузлів
    processTemplateNode(node, context) {
        if (node.nodeType === Node.TEXT_NODE) {
            const originalText = node.textContent;
            const newText = node.textContent.replace(/\{\{\s*([^}]+)\s*\}\}/g, (match, path) => {
                path = path.trim();
                const value = context && path in context ? context[path] : this.getValueByPath(path);
                Model.debug('Replacement in the template:', {original: match, path, value});
                return value;
            });
            if (originalText !== newText) {
                node.textContent = newText;
            }
        } else if (node.nodeType === Node.ELEMENT_NODE) {
            // Обробка атрибутів та дочірніх елементів...
            Array.from(node.childNodes).forEach(child => {
                this.processTemplateNode(child, context);
            });
        }
    }

    // Пакетне оновлення: аргумент - функція або об'єкт
    batch(callback) {
        this.batchProcessing = true;

        try {
            if (typeof callback === 'function') {
                callback();
            } else {
                for (const [path, value] of Object.entries(callback)) {
                    this.setValueByPath(path, value);
                }
            }
        } finally {
            this.updateAllDOM();
            this.batchProcessing = false;
            this.emit('batchComplete');
        }
    }

    // Метод для встановлення значення за шляхом
    setValueByPath(path, value) {
        Model.debug('Setting value by path:', {path, value});
        const parts = path.split('.');
        let current = this.data;

        for (let i = 0; i < parts.length - 1; i++) {
            if (!(parts[i] in current)) {
                current[parts[i]] = {};
            }
            current = current[parts[i]];
        }

        current[parts[parts.length - 1]] = value;
    }

    // Метод для отримання значення за шляхом
    getValueByPath(path) {
        Model.debug('Obtaining value by way:', path);
        let value = this.data;
        if (!path) return value;

        const parts = path.split('.');
        for (const part of parts) {
            if (value === undefined || value === null) {
                Model.error(`The way ${path} broke off on ${part}`);
                return undefined;
            }
            value = value[part];
        }
        Model.debug('The value received:', value);
        return value;
    }

    // Додаємо спостерігачів (watchers)
    watch(propertyPath, callback) {
        if (!this.watchers.has(propertyPath)) {
            this.watchers.set(propertyPath, new Set());
        }
        this.watchers.get(propertyPath).add(callback);
    }

    // Додаємо валідацію
    addValidator(propertyPath, validator) {
        if (!this.validators) {
            this.validators = new Map();
        }
        this.validators.set(propertyPath, validator);
    }

    // Додаємо форматування
    addFormatter(propertyPath, formatter) {
        if (!this.formatters) {
            this.formatters = new Map();
        }
        this.formatters.set(propertyPath, formatter);
    }

    // Додаємо middleware
    use(middleware) {
        this.middleware.use(middleware);        
    }
    
    // Створення реактивного проксі для масиву
    createArrayProxy(array, path = '') {
        return new Proxy(array, {
            get: (target, property) => {
                Model.debug('ArrayProxy get:', {path, property});
                return target[property];
            },

            set: (target, property, value) => {
                Model.debug('ArrayProxy set:', {path, property, value});

                if (typeof property === 'symbol') {
                    target[property] = value;
                    return true;
                }

                target[property] = value;

                // Оновлюємо всі цикли, що використовують цей масив
                this.loops.forEach((loopInfo, element) => {
                    if (loopInfo.arrayPath === path) {
                        this.updateLoop(element);
                    }
                });

                return true;
            }
        });
    }

    // Створення реактивного проксі
    createReactiveProxy(obj, path = '') {
        // Якщо отримуємо масив, створюємо для нього спеціальний проксі
        if (Array.isArray(obj)) {
            return this.createArrayProxy(obj, path);
        }

        return new Proxy(obj, {
            set: async (target, property, value) => {
                if (typeof property === 'symbol') {
                    target[property] = value;
                    return true;
                }

                // Валідація
                if (this.validators?.has(`${path}.${property}`)) {
                    const isValid = this.validators.get(`${path}.${property}`)(value);
                    if (!isValid) return false;
                }

                // Форматування
                if (this.formatters?.has(`${path}.${property}`)) {
                    value = this.formatters.get(`${path}.${property}`)(value);
                }

                // Якщо значення є об'єктом, робимо його реактивним
                if (value && typeof value === 'object') {
                    value = this.createReactiveProxy(
                        value,
                        path ? `${path}.${property}` : property
                    );
                }

                const oldValue = target[property];
                
                // Створюємо контекст для middleware
                const context = {
                    property,
                    oldValue,
                    newValue: value,
                    preventDefault: false
                };

                // Обробляємо через middleware
                await this.middleware.process(context);

                if (context.preventDefault) {
                    return true;
                }

                target[property] = context.newValue;

                this.emit('change', {
                    property,
                    oldValue,
                    newValue: context.newValue
                });

                const fullPath = path ? `${path}.${property}` : property;

                // Викликаємо спостерігачів
                if (this.watchers.has(fullPath)) {
                    this.watchers.get(fullPath).forEach(callback =>
                        callback(value, oldValue)
                    );
                }

                if (!this.batchProcessing) {
                    this.updateDOM(fullPath, value);
                    this.updateInputs(fullPath, value);
                    this.updateComputedProperties(fullPath);
                }

                return true;
            },

            get: (target, property) => {
                // Ігноруємо Symbol властивості
                if (typeof property === 'symbol') {
                    return target[property];
                }

                const fullPath = path ? `${path}.${property}` : property;
                if (fullPath in this.computed) {
                    return this.evaluateComputed(fullPath);
                }

                const value = target[property];
                if (value && typeof value === 'object') {
                    return this.createReactiveProxy(
                        value,
                        fullPath
                    );
                }

                return value;
            }
        });
    }

    // Обчислення значення computed властивості
    evaluateComputed(key, force = false) {
        const computed = this.computed[key];

        const dependencies = new Set();
        const dataTracker = new Proxy(this.data, {
            get: (target, prop) => {
                // Додаємо базову властивість до залежностей
                dependencies.add(prop);

                // Отримуємо значення
                let value = target[prop];

                // Якщо значення є об'єктом, створюємо для нього проксі для відслідковування
                if (value && typeof value === 'object') {
                    return new Proxy(value, {
                        get: (obj, nestedProp) => {
                            // Додаємо повний шлях до залежностей
                            dependencies.add(`${prop}.${nestedProp}`);
                            return obj[nestedProp];
                        }
                    });
                }

                return value;
            }
        });

        const result = computed.getter.call(dataTracker);
        computed.dependencies = [...dependencies];
        computed.value = result;

        this.emit('compute', {
            key,
            value: result,
            dependencies,
        });
        
        return result;
    }

    // Оновлення обчислюваних властивостей при зміні залежностей
    updateComputedProperties(changedProp) {
        for (const key in this.computed) {
            const computed = this.computed[key];

            // Якщо властивість, що змінилася, знаходиться в залежностях
            if (computed.dependencies.includes(changedProp)) {
                console.log(`Updating computed property: ${key}`);
                const newValue = this.evaluateComputed(key);

                // Оновлюємо DOM для обчислюваної властивості
                this.updateDOM(key, newValue);
                this.updateInputs(key, newValue);
            }
        }
    }

    // Парсимо DOM для пошуку виразів {{ змінна }}
    parse(root) {
        const walker = document.createTreeWalker(
            root,
            NodeFilter.SHOW_TEXT,
            null
        );

        let node;
        const regex = /\{\{\s*([^}]+)\s*\}\}/g;

        while (node = walker.nextNode()) {
            let match;
            const text = node.textContent;
            const originalText = text;

            // Скидаємо індекс, щоб перевірити всі збіги заново
            regex.lastIndex = 0;

            while ((match = regex.exec(text)) !== null) {
                const propPath = match[1].trim();

                // Реєструємо залежність
                this.registerDomDependency(propPath, node, {
                    type: 'template',
                    template: originalText
                });

                // Для совместимости с существующим кодом
                this.elements.push({
                    node,
                    propName: propPath,
                    template: originalText
                });
            }

            // Сохраняем начальное состояние в virtualDom
            this.virtualDom.set(node, node.textContent);
        }

        // Знаходимо всі input-елементи з атрибутом data-model
        const inputs = root.querySelectorAll('[data-model]');
        inputs.forEach(input => {
            const property = input.getAttribute('data-model');

            // Створюємо обробник і зберігаємо на елементі
            const handler = (e) => {
                const value = input.type === 'checkbox' || input.type === 'radio'
                    ? e.target.checked
                    : e.target.value;

                this.setValueByPath(property, value);
            };

            // Зберігаємо посилання на обробник для можливості видалення
            input.__modelInputHandler = handler;

            input.addEventListener('input', handler);

            this.inputs.push({
                element: input,
                property: property
            });
        });
    }

    // Встановлення значення в input-елемент
    setInputValue(input, value) {
        if (input.type === 'checkbox' || input.type === 'radio') {
            input.checked = Boolean(value);
        } else {
            input.value = value;
        }
    }
    
    // Оновлення значень в input-елементах при зміні даних моделі
    updateInputs(propName, value) {
        this.inputs.forEach(item => {
            if (item.property === propName) {
                this.setInputValue(item.element, value);
            }
        });
    }

    // Оновлюємо элементи DOM, які того потребують
    updateAllDOM() {
        // Оновлюємо всі елементи з шаблонами
        this.elements.forEach(element => {
            let newContent = element.template;
            newContent = newContent.replace(/\{\{\s*([^}]+)\s*\}\}/g, (match, path) => {
                path = path.trim();
                return this.getValueByPath(path);
            });
            element.node.textContent = newContent;
        });

        // Оновлюємо всі інпути
        this.inputs.forEach(item => {
            const value = this.getValueByPath(item.property);
            this.setInputValue(item.element, value);
        });
    }

    // Оновлення DOM при зміні даних
    updateDOM(propertyPath, value) {
        if (!this.domDependencies.has(propertyPath)) return;

        const affectedElements = this.domDependencies.get(propertyPath);
        if (affectedElements.size === 0) return;

        // Группируем обновления по типу для уменьшения перерисовок
        const updates = {
            template: [],
            conditional: [],
            loop: []
        };

        affectedElements.forEach(dep => {
            updates[dep.type].push(dep);
        });

        // Обрабатываем по группам
        updates.template.forEach(dep => this.updateTemplateNode(dep.element, dep.template));
        updates.conditional.forEach(dep => this.updateConditional(dep.element, dep.expression));
        updates.loop.forEach(dep => this.updateLoopPart(dep.element, dep.arrayPath, value, dep.index));
    }

    // Парсимо DOM для пошуку умовних виразів
    parseConditionals(rootElement) {
        const conditionalElements = rootElement.querySelectorAll('[data-if]');

        conditionalElements.forEach((element) => {
            const expression = element.getAttribute('data-if').trim();

            // Зберігаємо оригінальне значення display
            element.__originalDisplay =
                element.style.display === 'none' ? '' : element.style.display;

            // Реєструємо залежності
            const variables = this.extractVariables(expression);
            variables.forEach(variable => {
                this.registerDomDependency(variable, element, {
                    type: 'conditional',
                    expression: expression
                });
            });

            // Початкове оновлення
            this.updateConditional(element, expression);
        });
    }

    // Оновлення умовного виразу
    updateConditional(element, expression) {
        // Отримуємо поточний стан
        const currentState = this.virtualDom.get(element);

        // Обчислюємо новий стан
        const context = {...this.data};
        const result = this.evaluateExpression(expression, context);

        // Оновлюємо DOM лише за зміни стану
        if (currentState !== result) {
            element.style.display = result ?
                (element.__originalDisplay || '') : 'none';
            this.virtualDom.set(element, result);
        }
    }
    
    // Оновлення частини циклу
    updateLoopPart(element, arrayPath, changedValue, changedIndex) {
        const loopInfo = this.loops.get(element);
        if (!loopInfo) return;

        const {template, itemName, indexName, parentNode} = loopInfo;
        const array = this.getValueByPath(arrayPath);

        if (!Array.isArray(array)) return;

        // Отримуємо існуючі згенеровані елементи
        const generated = Array.from(
            parentNode.querySelectorAll(`[data-generated-for="${arrayPath}"]`)
        );

        // Якщо змін більше, ніж елементів, оновлюємо все
        if (changedIndex === undefined || generated.length !== array.length) {
            return this.updateLoop(element); 
        }

        // Оновлюємо лише змінений елемент
        const elementToUpdate = generated[changedIndex];
        if (elementToUpdate) {
            // Створюємо новий елемент на основі шаблону
            const newNode = template.cloneNode(true);

            // Застосовуємо контекст для нового елемента
            this.processTemplateNode(newNode, {
                [itemName]: array[changedIndex],
                [indexName || 'index']: changedIndex
            });

            // Замінюємо лише вміст, без видалення елемента
            while (elementToUpdate.firstChild) {
                elementToUpdate.removeChild(elementToUpdate.firstChild);
            }

            while (newNode.firstChild) {
                elementToUpdate.appendChild(newNode.firstChild);
            }

            // Копіюємо атрибути
            Array.from(newNode.attributes).forEach(attr => {
                elementToUpdate.setAttribute(attr.name, attr.value);
            });
        }
    }
    
    // Метод оновлення текстового шаблону
    updateTemplateNode(node, template) {
        const newContent = template.replace(/\{\{\s*([^}]+)\s*\}\}/g, (match, path) => {
            path = path.trim();
            return this.getValueByPath(path);
        });

        // Оновлюємо DOM тільки якщо вміст змінився
        if (this.virtualDom.get(node) !== newContent) {
            node.textContent = newContent;
            this.virtualDom.set(node, newContent);
        }
    }

    // Допоміжний метод перевірки доступності localStorage
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
    
    // Збереження стану
    saveState() {
        if (!Model.isStorageAvailable()) {
            console.warn('localStorage is not available');
            this.emit('saveStateError', { error: new Error('localStorage is not available') });
            return null;
        }

        const dataToSave = JSON.parse(JSON.stringify(this.data));
        
        const state = {
            data: dataToSave,
            computed: Object.fromEntries(
                Object.entries(this.computed)
                    .map(([key, comp]) => [key, comp.value])
            ),
            timestamp: Date.now()
        };

        try {
            localStorage.setItem(this.options.id, JSON.stringify(state));
            this.emit('saveState', state);
            Model.debug('State saved:', state);
            return state;
        } catch (error) {
            Model.error('Error saving state:', error);
            this.emit('saveStateError', { error, state });
            return null;
        }
    }

    // Відновлення стану
    loadState() {
        if (!Model.isStorageAvailable()) {
            console.warn('localStorage is not available');
            return null;
        }
        
        const savedState = localStorage.getItem(this.options.id);
        
        if (savedState) {
            const parsed = JSON.parse(savedState);
            // Оновлюємо основні дані
            Object.assign(this.data, parsed.data);
            
            // Перераховуємо всі обчислювані властивості
            if (parsed.computed) {
                for (const key of Object.keys(this.computed)) {
                    // Викликаємо getter для перерахунку значення
                    this.computed[key].value = this.computed[key].getter.call(this.data);
                }
            }
            // Викликаємо подію про завантаження стану
            this.emit('loadState', {
                data: parsed.data,
                computed: this.getComputedValues()
            });
        }
    }
    
    loadStateFromSnapshot(snapshot) {
        if (!snapshot) {
            Model.error('Snapshot is undefined or null');
            return;
        }

        try {
            const computed = {}
            
            for (const key in snapshot) {
                if (typeof snapshot[key] === 'function') {
                    computed[key] = {
                        getter: snapshot[key],
                        value: null,
                        dependencies: [] // Будет заполнено при первом вызове
                    };
                } else {
                    this.data[key] = snapshot[key];
                }
            }

            // Запускаємо подію про оновлення стану
            this.emit('restoreState', {
                timestamp: Date.now(),
                snapshot
            });

            return true;
        } catch (error) {
            Model.error('Error loading state from snapshot:', error);

            // Запускаємо подію про помилку
            this.emit('restoreStateError', {
                error,
                snapshot
            });

            return false;
        }
    }

    // Автоматичне збереження в localStorage
    enableAutoSave(interval = 5000) {
        this.autoSaveInterval = setInterval(() => {
            this.saveState()
        }, interval);
    }

    // Вимкнення автоматичного збереження
    disableAutoSave() {
        clearInterval(this.autoSaveInterval);
    }

    // Допоміжний метод для отримання всіх обчислюваних значень
    getComputedValues() {
        return Object.fromEntries(
            Object.entries(this.computed)
                .map(([key, comp]) => [key, comp.value])
        );
    }
    
    // Допоміжний метод для вилучення змінних з виразу
    extractVariables(expression) {
        const matches = expression.match(/\b[a-zA-Z_]\w*(?:\.[a-zA-Z_]\w*)*\b/g) || [];
        return [...new Set(matches)];
    }

    // Метод для оцінки виразу
    evaluateExpression(expression, context) {
        try {
            const func = new Function(...Object.keys(context), `return ${expression}`);
            return func(...Object.values(context));
        } catch (error) {
            Model.error('Error when evaluating expression:', error);
            return false;
        }
    }

    // Ініціюємо модель на відповідному DOM елементі
    init(selector) {
        const rootElement = typeof selector === 'string'
            ? document.querySelector(selector)
            : selector;

        if (!rootElement) {
            Model.error('The root element was not found!');
            return;
        }

        this.parseLoops(rootElement);
        this.parseConditionals(rootElement);
        this.parse(rootElement);
        this.updateAllDOM();

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
        const array = this.getValueByPath(arrayPath);
        if (!Array.isArray(array)) {
            Model.error(`The path ${arrayPath} is not an array!`);
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
            const value = this.getValueByPath(path);
            return value !== undefined;
        } catch (e) {
            return false;
        }
    }
    
    destroy() {
        // Зупиняємо автозбереження
        this.disableAutoSave();

        // Видаляємо обробники подій з інпутів
        this.inputs.forEach(({ element }) => {
            element.removeEventListener('input', element.__modelInputHandler);
        });

        // Очищаємо всі колекції
        this.elements = [];
        this.inputs = [];
        this.domDependencies.clear();
        this.virtualDom.clear();
        this.watchers.clear();
        this.loops.clear();
        this.events.clear();

        // Викликаємо подію для додаткового очищення
        this.emit('destroy');

        // Очищаємо всіх слухачів подій
        // this.removeAllEventListeners();
    }
}

export default Model;