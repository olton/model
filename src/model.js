const ModelOptions = {
    id: "model",
}

class Model {
    static DEBUG = false
    static log = (...args) => {
        if (Model.DEBUG) {
            console.log(...args);
        }
    }


    constructor(data = {}, options = {}) {
        Model.log('Ініціалізація Model з даними:', data);

        this.options = Object.assign({}, ModelOptions, options);
        this.elements = [];
        this.inputs = [];
        this.computed = {};
        this.watchers = new Map(); // Додаємо спостерігачів
        this.batchUpdate = false;
        this.loops = new Map();


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

    parseLoops(rootElement) {
        Model.log('Шукаємо елементи з m-for');
        const loopElements = rootElement.querySelectorAll('[m-for]');
        Model.log('Знайдено елементів з m-for:', loopElements.length);

        loopElements.forEach((element, index) => {
            const expression = element.getAttribute('m-for').trim();
            Model.log(`Обробка елементу ${index}:`, expression);

            const matches = expression.match(/^\s*(\w+)(?:\s*,\s*(\w+))?\s+in\s+(\w+(?:\.\w+)*)\s*$/);

            if (!matches) {
                console.error('Неправильний формат виразу m-for:', expression);
                return;
            }

            const [_, itemName, indexName, arrayPath] = matches;
            Model.log('Розібрано вираз:', {itemName, indexName, arrayPath});

            const array = this.getValueByPath(arrayPath);
            Model.log('Отримано масив:', array);

            if (!Array.isArray(array)) {
                console.error(`Значення за шляхом ${arrayPath} не є масивом:`, array);
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

            Model.log('Оновлюємо цикл для елементу');
            this.updateLoop(element);
        });
    }

    updateLoop(element) {
        const loopInfo = this.loops.get(element);
        if (!loopInfo) {
            console.error('Не знайдено інформацію про цикл для елементу');
            return;
        }

        const {template, itemName, indexName, arrayPath, parentNode} = loopInfo;
        const array = this.getValueByPath(arrayPath);

        Model.log('Оновлення циклу для масиву:', array);

        if (!Array.isArray(array)) {
            console.error('Значення не є масивом:', array);
            return;
        }

        // Видаляємо попередні згенеровані елементи
        const generated = parentNode.querySelectorAll(`[data-generated-for="${arrayPath}"]`);
        generated.forEach(el => el.remove());

        // Створюємо нові елементи
        array.forEach((item, index) => {
            const newNode = template.cloneNode(true);
            newNode.style.display = '';
            newNode.removeAttribute('m-for');
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

    processTemplateNode(node, context) {
        if (node.nodeType === Node.TEXT_NODE) {
            const originalText = node.textContent;
            const newText = node.textContent.replace(/\{\{\s*([^}]+)\s*\}\}/g, (match, path) => {
                path = path.trim();
                const value = context && path in context ? context[path] : this.getValueByPath(path);
                Model.log('Заміна в шаблоні:', {original: match, path, value});
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

    // bindLoopEvents(node, item, index) {
    //     const clickHandler = node.getAttribute('m-on:click');
    //     if (clickHandler) {
    //         node.addEventListener('click', (event) => {
    //             // Створюємо контекст для обробника
    //             const context = {
    //                 item,
    //                 index,
    //                 event,
    //                 target: event.target
    //             };
    //
    //             // Виконуємо обробник у контексті моделі
    //             this.executeHandler(clickHandler, context);
    //         });
    //     }
    // }

    batch(callback) {
        this.batchUpdate = true;
        callback();
        this.batchUpdate = false;
        this.updateAllDOM();
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

    // Новий метод для створення реактивного проксі
    createReactiveProxy(obj, path = '') {
        // Якщо отримуємо масив, створюємо для нього спеціальний проксі
        if (Array.isArray(obj)) {
            return this.createArrayProxy(obj, path);
        }

        return new Proxy(obj, {
            set: (target, property, value) => {
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
                target[property] = value;

                const fullPath = path ? `${path}.${property}` : property;

                // Викликаємо спостерігачів
                if (this.watchers.has(fullPath)) {
                    this.watchers.get(fullPath).forEach(callback =>
                        callback(value, oldValue)
                    );
                }

                if (!this.batchUpdate) {
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

        return result;
    }

    // Обновление вычисляемых свойств при изменении зависимостей
    updateComputedProperties(changedProp) {
        for (const key in this.computed) {
            const computed = this.computed[key];

            // Если изменившееся свойство находится в зависимостях
            if (computed.dependencies.includes(changedProp)) {
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

            while ((match = regex.exec(text)) !== null) {
                const propPath = match[1].trim();
                this.elements.push({
                    node,
                    propName: propPath,
                    template: originalText
                });
            }
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

    // Оновлення значень в input-елементах при зміні даних моделі
    updateInputs(propName, value) {
        this.inputs.forEach(item => {
            if (item.property === propName) {
                const input = item.element;

                if (input.type === 'checkbox' || input.type === 'radio') {
                    input.checked = Boolean(value);
                } else if (input.value !== String(value)) {
                    input.value = value;
                }
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
            const input = item.element;

            if (input.type === 'checkbox' || input.type === 'radio') {
                input.checked = Boolean(value);
            } else if (input.value !== String(value)) {
                input.value = value;
            }
        });
    }

    // Оновлюємо метод updateDOM для підтримки вкладених шляхів
    updateDOM(propertyPath, value) {
        this.elements.forEach(element => {
            // Оновлюємо елемент якщо змінилась будь-яка частина шляху
            const isAffected = element.propName === propertyPath ||
                element.propName.startsWith(propertyPath + '.') ||
                propertyPath.startsWith(element.propName + '.');

            if (isAffected) {
                let newContent = element.template;

                // Замінюємо всі вирази в шаблоні
                newContent = newContent.replace(/\{\{\s*([^}]+)\s*\}\}/g, (match, path) => {
                    path = path.trim();
                    return this.getValueByPath(path);
                });

                element.node.textContent = newContent;
            }
        });
    }

    // Метод для отримання значення за шляхом
    getValueByPath(path) {
        Model.log('Отримання значення за шляхом:', path);
        let value = this.data;
        if (!path) return value;

        const parts = path.split('.');
        for (const part of parts) {
            if (value === undefined || value === null) {
                console.error(`Шлях ${path} обірвався на ${part}`);
                return undefined;
            }
            value = value[part];
        }
        Model.log('Отримане значення:', value);
        return value;
    }

    // Збереження стану
    saveState() {
        localStorage.setItem(this.options.id, JSON.stringify(this.data));
    }

    // Відновлення стану
    loadState() {
        const savedState = localStorage.getItem(this.options.id);
        if (savedState) {
            const newState = JSON.parse(savedState);
            this.batch(() => {
                Object.assign(this.data, newState);
            });
        }
    }

    // Парсимо DOM для пошуку умовних виразів
    parseConditionals(rootElement) {
        Model.log('Шукаємо елементи з m-if');
        const conditionalElements = rootElement.querySelectorAll('[m-if]');
        Model.log('Знайдено елементів з m-if:', conditionalElements.length);

        conditionalElements.forEach((element) => {
            const expression = element.getAttribute('m-if').trim();
            Model.log('Обробка умовного виразу:', expression);

            // Зберігаємо original display value
            const originalDisplay = element.style.display;

            // Створюємо функцію оновлення видимості
            const updateVisibility = () => {
                try {
                    // Створюємо контекст з даними моделі
                    const context = {...this.data};
                    // Оцінюємо вираз
                    const result = this.evaluateExpression(expression, context);

                    element.style.display = result ? originalDisplay || '' : 'none';
                    Model.log(`Результат виразу ${expression}:`, result);
                } catch (error) {
                    console.error('Помилка при обробці m-if:', error);
                }
            };

            // Додаємо спостерігач за змінними у виразі
            const variables = this.extractVariables(expression);
            variables.forEach(variable => {
                this.watch(variable, () => updateVisibility());
            });

            // Початкове оновлення
            updateVisibility();
        });
    }

    // Допоміжний метод для вилучення змінних з виразу
    extractVariables(expression) {
        // Простий регулярний вираз для пошуку змінних
        const matches = expression.match(/\b[a-zA-Z_]\w*(?:\.[a-zA-Z_]\w*)*\b/g) || [];
        return [...new Set(matches)];
    }

    // Метод для оцінки виразу
    evaluateExpression(expression, context) {
        try {
            // Створюємо безпечну функцію для оцінки виразу
            const func = new Function(...Object.keys(context), `return ${expression}`);
            return func(...Object.values(context));
        } catch (error) {
            console.error('Помилка при оцінці виразу:', error);
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

        return this;
    }
}

export default Model;