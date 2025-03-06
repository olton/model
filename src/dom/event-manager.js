import Logger from "../logger/logger.js";

export default class EventManager {
    /**
     * Creates a copy of the event manager
     * @param {Object} domManager - DOM manager for working with DOM elements
     * @param {Object} model - Data model that will be used as a context in events
     */
    constructor(domManager, model) {
        Logger.DEBUG_LEVEL = model.options.debug ? 4 : 0;
        Logger.debug('EventManager: Init EventManager');

        this.domManager = domManager;
        this.model = model;
        this.eventHandlers = new Map(); 
        
        Logger.debug('EventManager: EventManager initialized');
    }

    /**
     * Analyzes DOM-Vreyevo and finds all attributes starting with @,
     * Registering them as events
     * @param {HTMLElement} rootElement - Root element for searching for events
     */
    parseEvents(rootElement) {
        Logger.debug("EventManager: Parsing events with @...")
        const allElements = rootElement.querySelectorAll('*');
        const elements = [rootElement, ...Array.from(allElements)];
        
        elements.forEach(element => {
            const attributes = Array.from(element.attributes || []);
            
            attributes.forEach(attr => {
                if (attr.name.startsWith('@')) {
                    Logger.debug(`EventManager: Found attribute with "@" ${attr.name} in`, element)

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
     * @param {HTMLElement} element - DOM element
     * @param {string} eventName - Event name (without @)
     * @param {string} handlerExpression - Line with an event processor
     */
    bindEventHandler(element, eventName, handlerExpression) {
        Logger.debug(`EventManager: Binding event handler with expression ${handlerExpression} for ${eventName} on`, element);
        
        const eventHandler = (event) => {
            try {
                const context = {
                    $model: this.model,
                    $event: event,
                    $data: this.model.data,
                    $dom: this.domManager,
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
                                    Logger.debug(`EventManager: Requested Event`, event);
                                    return event;
                                }
                                
                                if (param === '$model') {
                                    Logger.debug(`EventManager: Requested Model`, this.model);
                                    return this.model;
                                }
                                
                                if (param === '$data') {
                                    Logger.debug(`EventManager: Requested Model Context`, this.model.data);
                                    return this.model.data;
                                }
                                
                                if (param === '$dom') {
                                    Logger.debug(`EventManager: Requested DOMManager`, this.domManager);
                                    return this.domManager;
                                }

                                return this.model.store.get(param);
                            });
                        }

                        method.apply(context, params);
                    } else {
                        console.warn(`EventManager: The method '${methodName}' not found in a model or global space!`);
                    }
                } else {
                    if (this.model.options.useSimpleExpressions) {
                        const result = new Function(`return ${handlerExpression}`)
                        result.apply(this.model.data);
                    } else {
                        console.warn(`EventManager: Unknown format of the event handler: '${handlerExpression}'`);
                    }
                }
            } catch (error) {
                console.error(`EventManager: Error when performing an event processor '${eventName}': ${error.message}`);
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
     * @param {HTMLElement} element - DOM element
     * @param {string} eventName - Event name (without @)
     */
    removeEventHandler(element, eventName) {
        Logger.debug(`EventManager: Removing event handler for ${eventName} on`, element);
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
     * @param {HTMLElement} element - DOM element for updating
     */
    updateEvents(element) {
        Logger.debug('EventManager: Updating events for', element);
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
        Logger.debug('EventManager: Destroying EventManager');
        this.eventHandlers.forEach((handlers, element) => {
            handlers.forEach((handler, eventName) => {
                Logger.debug(`EventManager: Removing event handler for ${eventName} on`, element);
                element.removeEventListener(eventName, handler);
            });
        });

        this.eventHandlers.clear();
        
        Logger.debug('EventManager: Destroyed');
    }
}