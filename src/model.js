const ModelOptions = {
    id: "model",
}

class Model {
    constructor(data = {}, options = {}) {
        this.options = Object.assign({}, ModelOptions, options);
        this.elements = [];
        this.inputs = [];
        this.computed = {};
        this.watchers = new Map(); // Додаємо спостерігачів
        this.batchUpdate = false;

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

    // Новий метод для створення реактивного проксі
    createReactiveProxy(obj, path = '') {
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
    parse(rootElement) {
        let root;

        if (typeof rootElement === 'string') {
            root = document.querySelector(rootElement);
        } else if (rootElement instanceof HTMLElement) {
            root = rootElement;
        } else {
            root = document.body;
        }

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

    // Новий метод для отримання значення за шляхом
    getValueByPath(path) {
        if (path in this.computed) {
            return this.evaluateComputed(path);
        }

        const parts = path.split('.');
        let current = this.data;

        for (const part of parts) {
            if (current === undefined || current === null) {
                return '';
            }
            current = current[part];
        }

        return current;

    }

    // Додаємо збереження стану
    saveState() {
        localStorage.setItem(this.options.id, JSON.stringify(this.data));
    }

    loadState() {
        const savedState = localStorage.getItem(this.options.id);
        if (savedState) {
            const newState = JSON.parse(savedState);
            this.batch(() => {
                Object.assign(this.data, newState);
            });
        }
    }

    // Ініціюємо модель на відповідному DOM елементі
    init(rootElement) {
        this.parse(rootElement);
        this.updateAllDOM();
        
        return this;
    }
}

export default Model;