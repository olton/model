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
     * Привязывает обработчик события к DOM элементу
     * @param {HTMLElement} element - DOM элемент
     * @param {string} eventName - Имя события (без @)
     * @param {string} handlerExpression - Строка с обработчиком события
     */
    bindEventHandler(element, eventName, handlerExpression) {
        // Создаем функцию-обработчик, которая будет привязана к модели
        const eventHandler = (event) => {
            try {
                // Создаем контекст выполнения с доступом к модели и событию
                const context = {
                    $model: this.model,
                    $event: event,
                    $data: this.model.data
                };

                // Обработка выражений вида methodName(params)
                const methodMatch = handlerExpression.match(/(\w+)\((.*)\)/);

                if (methodMatch) {
                    const methodName = methodMatch[1];
                    const paramsString = methodMatch[2];

                    // Проверяем, есть ли у модели такой метод
                    if (typeof this.model[methodName] === 'function') {
                        // Обрабатываем параметры, если они есть
                        let params = [];
                        if (paramsString.trim()) {
                            // Простой парсинг параметров (для более сложных случаев потребуется улучшить)
                            params = paramsString.split(',').map(param => {
                                param = param.trim();

                                // Обработка строк в кавычках
                                if ((param.startsWith('"') && param.endsWith('"')) ||
                                    (param.startsWith("'") && param.endsWith("'"))) {
                                    return param.slice(1, -1);
                                }

                                // Обработка числовых параметров
                                if (!isNaN(param)) {
                                    return Number(param);
                                }

                                // Проверка параметров из контекста
                                if (param === '$event') {
                                    return event;
                                }

                                // Получение значения из модели
                                return this.model.store.get(param);
                            });
                        }

                        // Вызываем метод модели с нужными параметрами
                        this.model[methodName].apply(this.model, params);
                    } else {
                        console.warn(`Метод '${methodName}' не найден в модели`);
                    }
                } else {
                    // Для простых выражений без вызова метода
                    // Здесь можно добавить eval или Function для выполнения выражения,
                    // но это может быть небезопасно
                    console.warn(`Неподдерживаемое выражение: '${handlerExpression}'`);
                }
            } catch (error) {
                console.error(`Ошибка при выполнении обработчика события '${eventName}': ${error.message}`);
            }
        };

        // Сохраняем обработчик для возможности его удаления в будущем
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
     * Удаляет обработчик события с DOM элемента
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
     * Обновляет обработчики событий для элемента
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
     * Освобождает все ресурсы и удаляет все обработчики событий
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