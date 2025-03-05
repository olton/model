export default class EventManager {
    /**
     * Создает экземпляр менеджера событий
     * @param {Object} domManager - DOM менеджер для работы с DOM элементами
     * @param {Object} model - Модель данных, которая будет использоваться как контекст в обработчиках событий
     */
    constructor(domManager, model) {
        this.domManager = domManager;
        this.model = model;
        this.eventHandlers = new Map(); // Хранит все зарегистрированные обработчики событий
    }

    /**
     * Анализирует DOM-дерево и находит все атрибуты, начинающиеся с @,
     * регистрируя их как обработчики событий
     * @param {HTMLElement} rootElement - Корневой элемент для поиска событий
     */
    parseEvents(rootElement) {
        const allElements = rootElement.querySelectorAll('*');
        const elements = [rootElement, ...Array.from(allElements)];

        elements.forEach(element => {
            const attributes = Array.from(element.attributes || []);

            attributes.forEach(attr => {
                if (attr.name.startsWith('@')) {
                    const eventName = attr.name.substring(1); // Убираем @ из имени атрибута
                    const handler = attr.value.trim();

                    this.bindEventHandler(element, eventName, handler);
                    element.removeAttribute(attr.name); // Удаляем атрибут, чтобы избежать дублирования
                }
            });
        });
    }

    /**
     * Binds the event handler to the DOM element
     * @param {HTMLElement} element - DOM элемент
     * @param {string} eventName - Имя события (без @)
     * @param {string} handlerExpression - Строка с обработчиком события
     */
    bindEventHandler(element, eventName, handlerExpression) {
        const eventHandler = (event) => {
            try {
                const context = {
                    $model: this.model,
                    $event: event,
                    $data: this.model.data
                };

                const methodMatch = handlerExpression.match(/(\w+)\((.*)\)/);

                if (methodMatch) {
                    const methodName = methodMatch[1];
                    const paramsString = methodMatch[2];

                    const resolveMethod = (path, context) => {
                        return path.split('.').reduce((obj, key) => (obj && obj[key] !== undefined) ? obj[key] : undefined, context);
                    };

                    let method = resolveMethod(methodName, this.model); // Поиск в модели
                    if (!method) {
                        method = resolveMethod(methodName, window); // Поиск в глобальном объекте (например, window)
                    }

                    if (typeof method === 'function') {
                        // Обрабатываем параметры, если они есть
                        let params = [];
                        if (paramsString.trim()) {
                            params = paramsString.split(',').map(param => {
                                param = param.trim();

                                if ((param.startsWith('"') && param.endsWith('"')) ||
                                    (param.startsWith("'") && param.endsWith("'"))) {
                                    return param.slice(1, -1);
                                }

                                if (!isNaN(param)) {
                                    return Number(param);
                                }

                                if (param === '$event') {
                                    return event;
                                }
                                
                                if (param === '$model') {
                                    return this.model;
                                }
                                
                                if (param === '$data') {
                                    return this.model.data;
                                }

                                return this.model.store.get(param);
                            });
                        }

                        method.apply(context, params);
                    } else {
                        console.warn(`Метод '${methodName}' не найден в модели или глобальном пространстве`);
                    }
                } else {
                    if (this.model.options.useSimpleExpressions) {
                        const result = new Function(`return ${handlerExpression}`)
                        result.apply(this.model.data);
                    } else {
                        console.warn(`Неизвестный формат обработчика события: '${handlerExpression}'`);
                    }
                }
            } catch (error) {
                console.error(`Ошибка при выполнении обработчика события '${eventName}': ${error.message}`);
            }
        };

        if (!this.eventHandlers.has(element)) {
            this.eventHandlers.set(element, new Map());
        }

        const elementHandlers = this.eventHandlers.get(element);
        if (elementHandlers.has(eventName)) {
            element.removeEventListener(eventName, elementHandlers.get(eventName));
        }

        elementHandlers.set(eventName, eventHandler);
        element.addEventListener(eventName, eventHandler);
    }

    /**
     * Removes the event processor from the DOM element
     * @param {HTMLElement} element - DOM элемент
     * @param {string} eventName - Имя события (без @)
     */
    removeEventHandler(element, eventName) {
        if (this.eventHandlers.has(element)) {
            const elementHandlers = this.eventHandlers.get(element);

            if (elementHandlers.has(eventName)) {
                const handler = elementHandlers.get(eventName);
                element.removeEventListener(eventName, handler);
                elementHandlers.delete(eventName);

                if (elementHandlers.size === 0) {
                    this.eventHandlers.delete(element);
                }
            }
        }
    }

    /**
     * Updates events for the element
     * @param {HTMLElement} element - DOM элемент для обновления
     */
    updateEvents(element) {
        Array.from(element.attributes || []).forEach(attr => {
            if (attr.name.startsWith('@')) {
                const eventName = attr.name.substring(1);
                const handler = attr.value.trim();

                this.bindEventHandler(element, eventName, handler);
                element.removeAttribute(attr.name);
            }
        });
    }

    /**
     * Releases all resources and removes all events
     */
    destroy() {
        this.eventHandlers.forEach((handlers, element) => {
            handlers.forEach((handler, eventName) => {
                element.removeEventListener(eventName, handler);
            });
        });

        this.eventHandlers.clear();
    }
}