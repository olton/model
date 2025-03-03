import EventEmitter from '../event-emitter/event-emitter.js';
import MiddlewareManager from "../middleware/middleware.js";

export default class ReactiveStore extends EventEmitter {
    constructor(initialState = {}) {
        super();

        this.state = this.createReactiveProxy(initialState);
        this.watchers = new Map();
        this.previousState = JSON.parse(JSON.stringify(initialState));
        this.middleware = new MiddlewareManager();
    }

    use(middleware) {
        this.middleware.use(middleware);
    }
    
    createReactiveProxy(obj, path = '') {
        // Якщо це масив, обробляємо спеціально
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

                // Якщо значення є об'єктом, робимо його теж реактивним
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

                // Якщо значення не змінилося, нічого не робимо
                if (oldValue === value) {
                    return true;
                }

                // Валідація
                if (this.validators?.has(`${fullPath}`)) {
                    const isValid = this.validators.get(`${fullPath}`)(value);
                    if (!isValid) return false;
                }

                // Форматування
                if (this.formatters?.has(`${fullPath}`)) {
                    value = this.formatters.get(`${fullPath}`)(value);
                }
                
                // Якщо нове значення є об'єктом, робимо його реактивним
                if (value && typeof value === 'object') {
                    value = this.createReactiveProxy(value, fullPath);
                }

                const context = {
                    prop,
                    oldValue,
                    newValue: value,
                    preventDefault: false
                };

                // Обробляємо через middleware
                await this.middleware.process(context);

                if (context.preventDefault) {
                    return true;
                }
                
                target[prop] = value;

                // Повідомляємо про зміну
                this.emit('change', {
                    path: fullPath,
                    oldValue,
                    newValue: value
                });

                // Викликаємо спостерігачів для цього шляху
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
                    // Повідомляємо про видалення
                    this.emit('delete', {
                        path: fullPath,
                        oldValue
                    });

                    // Викликаємо спостерігачів
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

    // Спеціальний проксі для масивів
    createArrayProxy(array, path) {
        return new Proxy(array, {
            get: (target, prop) => {
                const value = target[prop];

                // Перехоплюємо методи, що змінюють масив
                if (typeof value === 'function' &&
                    ['push', 'pop', 'shift', 'unshift', 'splice', 'sort', 'reverse'].includes(prop)) {

                    return (...args) => {
                        // Зберігаємо стару копію масиву
                        const oldArray = [...target];

                        // Викликаємо метод і отримуємо результат
                        const result = target[prop].apply(target, args);

                        // Повідомляємо про зміну
                        this.emit('arrayChange', {
                            path,
                            method: prop,
                            args,
                            oldValue: oldArray,
                            newValue: [...target]
                        });

                        // Викликаємо спостерігачів для масиву
                        if (this.watchers.has(path)) {
                            this.watchers.get(path).forEach(callback => {
                                callback([...target], oldArray);
                            });
                        }

                        return result;
                    };
                }

                // Якщо це звичайне читання властивості
                if (typeof prop !== 'symbol' && !isNaN(Number(prop))) {
                    // Якщо значення є об'єктом, робимо його реактивним
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

                const oldValue = target[prop];

                // Якщо значення не змінилося, нічого не робимо
                if (oldValue === value) {
                    return true;
                }

                // Валідація
                if (this.validators?.has(`${path}.${prop}`)) {
                    const isValid = this.validators.get(`${path}.${prop}`)(value);
                    if (!isValid) return false;
                }

                // Форматування
                if (this.formatters?.has(`${path}.${prop}`)) {
                    value = this.formatters.get(`${path}.${prop}`)(value);
                }

                // Якщо нове значення є об'єктом, робимо його реактивним
                if (value && typeof value === 'object') {
                    value = this.createReactiveProxy(value, `${path}[${prop}]`);
                }

                const context = {
                    prop,
                    oldValue,
                    newValue: value,
                    preventDefault: false
                };

                // Обробляємо через middleware
                await this.middleware.process(context);

                if (context.preventDefault) {
                    return true;
                }

                target[prop] = value;

                // Повідомляємо про зміну елемента масиву
                this.emit('change', {
                    path: `${path}[${prop}]`,
                    oldValue,
                    newValue: value,
                    arrayIndex: Number(prop)
                });

                // Повідомляємо про зміну всього масиву
                if (this.watchers.has(path)) {
                    this.watchers.get(path).forEach(callback => {
                        callback([...target], undefined);
                    });
                }

                return true;
            }
        });
    }

    // Спеціалізований метод для масивів
    applyArrayMethod(path, method, ...args) {
        const array = this.get(path);

        if (!Array.isArray(array)) {
            console.error(`Путь ${path} не является массивом!`);
            return false;
        }

        // Сохраняем старое состояние массива
        const oldArray = [...array];

        // Применяем метод
        const result = array[method].apply(array, args);

        // Генерируем событие изменения массива
        this.emit('arrayChange', {
            path,
            method,
            args,
            oldValue: oldArray,
            newValue: [...array]
        });
        
        // Генерируем событие изменения массива
        this.emit('change', {
            path,
            oldValue: oldArray,
            newValue: [...array]
        });

        // Вызываем наблюдателей для массива
        if (this.watchers.has(path)) {
            this.watchers.get(path).forEach(callback => {
                callback([...array], oldArray);
            });
        }

        return result;
    }

    // Специализированные методы для массивов
    // Пример использования:
    // model.applyArrayChanges('users', (users) => users.push({ name: 'Новый пользователь' }));
    applyArrayChanges(path, callback) {
        const array = this.get(path);

        if (!Array.isArray(array)) {
            console.error(`The path ${path} is not an array!`);
            return false;
        }

        // Сохраняем старое состояние массива
        const oldArray = [...array];
        const result = callback(array);

        // Генерируем событие изменения массива
        this.emit('change', {
            path,
            oldValue: oldArray,
            newValue: [...array]
        });

        // Вызываем наблюдателей для массива
        if (this.watchers.has(path)) {
            this.watchers.get(path).forEach(callback => {
                callback([...array], oldArray);
            });
        }

        return result
    }


    // Метод для спостереження за змінами
    watch(path, callback) {
        if (!this.watchers.has(path)) {
            this.watchers.set(path, new Set());
        }
        this.watchers.get(path).add(callback);

        // Повертаємо функцію для відписки
        return () => {
            if (this.watchers.has(path)) {
                this.watchers.get(path).delete(callback);
            }
        };
    }

    // Метод для отримання значення за шляхом
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

    // Метод для встановлення значення за шляхом
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

    // Метод для пакетного оновлення 
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

    // Повертає поточний стан
    getState() {
        return this.state;
    }

    // Повертає попередній стан
    getPreviousState() {
        return this.previousState;
    }

    // Сериалізує стан до JSON
    toJSON() {
        return JSON.stringify(this.state);
    }

    // Відновлює стан з JSON
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
    
    destroy() {
        this.state = null;
        this.watchers.clear();
        this.previousState = null;
    }
}