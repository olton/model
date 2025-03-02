import EventEmitter from './event-emmiter.js';
import MiddlewareManager from "./middleware.js";
import DevTools from "./dev-tools.js";

const ModelOptions = {
    id: "model",
}

class Model extends EventEmitter {
    static DEBUG = false
    static log = (...args) => {
        if (Model.DEBUG) {
            console.log(...args);
        }
    }
    
    constructor(data = {}, options = {}) {
        Model.log('Model initialization with data:', data);

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
        this.domDependencies = new Map(); // Хранит связи между свойствами и DOM-элементами
        this.virtualDom = new Map(); // Для сравнения состояний

        // Регистрируем вычисляемые свойства
        for (const key in data) {
            if (typeof data[key] === 'function') {
                this.computed[key] = {
                    getter: data[key],
                    value: null,
                    dependencies: [] // Будет заполнено при первом вызове
                };
                delete data[key];
            }
        }

        this.data = this.createReactiveProxy(data);
    }

    // Метод для регистрации зависимости DOM от свойства
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
        Model.log('Looking for items with data-for');
        const loopElements = rootElement.querySelectorAll('[data-for]');
        Model.log('Found items from data-for:', loopElements.length);

        loopElements.forEach((element, index) => {
            const expression = element.getAttribute('data-for').trim();
            Model.log(`Element processing ${index}:`, expression);

            const matches = expression.match(/^\s*(\w+)(?:\s*,\s*(\w+))?\s+in\s+(\w+(?:\.\w+)*)\s*$/);

            if (!matches) {
                console.error('Incorrect format of expression data-for:', expression);
                return;
            }

            const [_, itemName, indexName, arrayPath] = matches;
            Model.log('The expression is dismantled:', {itemName, indexName, arrayPath});

            const array = this.getValueByPath(arrayPath);
            Model.log('An array was obtained:', array);

            if (!Array.isArray(array)) {
                console.error(`The value in the way ${arrayPath} is not an array:`, array);
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

            Model.log('Update the cycle for the item');
            this.updateLoop(element);
        });
    }

    // Оновлюємо цикл
    updateLoop(element) {
        const loopInfo = this.loops.get(element);
        if (!loopInfo) {
            console.error('No cycle information found for an item');
            return;
        }

        const {template, itemName, indexName, arrayPath, parentNode} = loopInfo;
        const array = this.getValueByPath(arrayPath);

        Model.log('Update cycle for array:', array);

        if (!Array.isArray(array)) {
            console.error('The value is not an array:', array);
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
                Model.log('Replacement in the template:', {original: match, path, value});
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

    setValueByPath(path, value) {
        Model.log('Setting value by path:', {path, value});
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

    // Оновлюємо метод createArrayProxy
    createArrayProxy(array, path = '') {
        return new Proxy(array, {
            get: (target, property) => {
                Model.log('ArrayProxy get:', {path, property});
                return target[property];
            },

            set: (target, property, value) => {
                Model.log('ArrayProxy set:', {path, property, value});

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

    // Вычисление значения computed свойства
    evaluateComputed(key) {
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

    // Обновление вычисляемых свойств при изменении зависимостей
    updateComputedProperties(changedProp) {
        for (const key in this.computed) {
            const computed = this.computed[key];

            // Если изменившееся свойство находится в зависимостях
            if (computed.dependencies.includes(changedProp)) {
                console.log(`Updating computed property: ${key}`);
                const newValue = this.evaluateComputed(key);

                // Обновляем DOM для вычисляемого свойства
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
            null,
            false
        );

        let node;
        const regex = /\{\{\s*([^}]+)\s*\}\}/g;

        while (node = walker.nextNode()) {
            let match;
            const text = node.textContent;
            const originalText = text;

            // Сбрасываем индекс, чтобы проверить все совпадения заново
            regex.lastIndex = 0;

            while ((match = regex.exec(text)) !== null) {
                const propPath = match[1].trim();

                // Регистрируем зависимость
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
            this.inputs.push({
                element: input,
                property: property
            });

            input.addEventListener('input', (e) => {
                const value = e.target.value;
                const path = property.split('.');
                let current = this.data;

                // Для вкладених властивостей
                for (let i = 0; i < path.length - 1; i++) {
                    current = current[path[i]];
                }
                current[path[path.length - 1]] = value;
            });
        });
    }

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

    // Оновлюємо метод updateDOM для підтримки вкладених шляхів
    updateDOM(propertyPath, value) {
        // Если есть прямые зависимости - обновляем только их
        if (this.domDependencies.has(propertyPath)) {
            this.domDependencies.get(propertyPath).forEach(dep => {
                if (dep.type === 'template') {
                    this.updateTemplateNode(dep.element, dep.template);
                } else if (dep.type === 'conditional') {
                    this.updateConditional(dep.element, dep.expression);
                } else if (dep.type === 'loop') {
                    this.updateLoopPart(dep.element, dep.arrayPath, value, dep.index);
                }
            });
            return;
        }

        // Обратная совместимость со старым методом
        this.elements.forEach(element => {
            const isAffected = element.propName === propertyPath ||
                element.propName.startsWith(propertyPath + '.') ||
                propertyPath.startsWith(element.propName + '.');

            if (isAffected) {
                this.updateTemplateNode(element.node, element.template);
            }
        });
    }

    parseConditionals(rootElement) {
        const conditionalElements = rootElement.querySelectorAll('[data-if]');

        conditionalElements.forEach((element) => {
            const expression = element.getAttribute('data-if').trim();

            // Сохраняем оригинальное значение display
            element.__originalDisplay =
                element.style.display === 'none' ? '' : element.style.display;

            // Регистрируем зависимости
            const variables = this.extractVariables(expression);
            variables.forEach(variable => {
                this.registerDomDependency(variable, element, {
                    type: 'conditional',
                    expression: expression
                });
            });

            // Начальное обновление
            this.updateConditional(element, expression);
        });
    }

    updateConditional(element, expression) {
        // Получаем текущее состояние
        const currentState = this.virtualDom.get(element);

        // Вычисляем новое состояние
        const context = {...this.data};
        const result = this.evaluateExpression(expression, context);

        // Обновляем DOM только при изменении состояния
        if (currentState !== result) {
            element.style.display = result ?
                (element.__originalDisplay || '') : 'none';
            this.virtualDom.set(element, result);
        }
    }
    
    updateLoopPart(element, arrayPath, changedValue, changedIndex) {
        const loopInfo = this.loops.get(element);
        if (!loopInfo) return;

        const {template, itemName, indexName, parentNode} = loopInfo;
        const array = this.getValueByPath(arrayPath);

        if (!Array.isArray(array)) return;

        // Получаем существующие сгенерированные элементы
        const generated = Array.from(
            parentNode.querySelectorAll(`[data-generated-for="${arrayPath}"]`)
        );

        // Если изменений больше чем элементов, проще обновить всё
        if (changedIndex === undefined || generated.length !== array.length) {
            return this.updateLoop(element); // Полное обновление
        }

        // Обновляем только измененный элемент
        const elementToUpdate = generated[changedIndex];
        if (elementToUpdate) {
            // Создаём новый элемент на основе шаблона
            const newNode = template.cloneNode(true);

            // Применяем контекст для нового элемента
            this.processTemplateNode(newNode, {
                [itemName]: array[changedIndex],
                [indexName || 'index']: changedIndex
            });

            // Заменяем только содержимое, без удаления элемента
            while (elementToUpdate.firstChild) {
                elementToUpdate.removeChild(elementToUpdate.firstChild);
            }

            while (newNode.firstChild) {
                elementToUpdate.appendChild(newNode.firstChild);
            }

            // Копируем атрибуты
            Array.from(newNode.attributes).forEach(attr => {
                elementToUpdate.setAttribute(attr.name, attr.value);
            });
        }
    }
    
    // Метод для обновления текстового шаблона
    updateTemplateNode(node, template) {
        const newContent = template.replace(/\{\{\s*([^}]+)\s*\}\}/g, (match, path) => {
            path = path.trim();
            return this.getValueByPath(path);
        });

        // Обновляем DOM только если содержимое изменилось
        if (this.virtualDom.get(node) !== newContent) {
            node.textContent = newContent;
            this.virtualDom.set(node, newContent);
        }
    }

    // Метод для отримання значення за шляхом
    getValueByPath(path) {
        Model.log('Отримання значення за шляхом:', path);
        let value = this.data;
        if (!path) return value;

        const parts = path.split('.');
        for (const part of parts) {
            if (value === undefined || value === null) {
                console.error(`The way ${path} broke off on ${part}`);
                return undefined;
            }
            value = value[part];
        }
        Model.log('The value received:', value);
        return value;
    }

    // Збереження стану
    saveState() {
        const state = {
            data: this.data,
            computed: Object.fromEntries(
                Object.entries(this.computed)
                    .map(([key, comp]) => [key, comp.value])
            )
        };

        localStorage.setItem(this.options.id, JSON.stringify(state));
        Model.log('State saved:', state);
        this.emit('saveState', state);
        return state;
    }

    // Відновлення стану
    loadState() {
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
            console.error('Snapshot is undefined or null');
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
            console.error('Error loading state from snapshot:', error);

            // Запускаємо подію про помилку
            this.emit('restoreStateError', {
                error,
                snapshot
            });

            return false;
        }
    }

    // Допоміжний метод для отримання всіх обчислюваних значень
    getComputedValues() {
        return Object.fromEntries(
            Object.entries(this.computed)
                .map(([key, comp]) => [key, comp.value])
        );
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
    
    // Парсимо DOM для пошуку умовних виразів
    // parseConditionals(rootElement) {
    //     Model.log('Looking for items with data-if');
    //     const conditionalElements = rootElement.querySelectorAll('[data-if]');
    //     Model.log('Found items from data-if:', conditionalElements.length);
    //
    //     conditionalElements.forEach((element) => {
    //         const expression = element.getAttribute('data-if').trim();
    //         Model.log('Processing of conditional expression:', expression);
    //
    //         // Зберігаємо original display value
    //         const originalDisplay = element.style.display;
    //
    //         // Створюємо функцію оновлення видимості
    //         const updateVisibility = () => {
    //             try {
    //                 // Створюємо контекст з даними моделі
    //                 const context = {...this.data};
    //                 // Оцінюємо вираз
    //                 const result = this.evaluateExpression(expression, context);
    //
    //                 element.style.display = result ? originalDisplay || '' : 'none';
    //                 Model.log(`The result of the expression ${expression}:`, result);
    //             } catch (error) {
    //                 console.error('Error in processing data-if:', error);
    //             }
    //         };
    //
    //         // Додаємо спостерігач за змінними у виразі
    //         const variables = this.extractVariables(expression);
    //         variables.forEach(variable => {
    //             this.watch(variable, () => updateVisibility());
    //         });
    //
    //         // Початкове оновлення
    //         updateVisibility();
    //     });
    // }

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
            console.error('Error when evaluating expression:', error);
            return false;
        }
    }

    // Ініціюємо модель на відповідному DOM елементі
    init(selector) {
        const rootElement = typeof selector === 'string'
            ? document.querySelector(selector)
            : selector;

        if (!rootElement) {
            console.error('The root element was not found!');
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

}

export default Model;