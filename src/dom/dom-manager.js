import LoopManager from "./loop-manager.js";
import ConditionalManager from "./conditional-manager.js";
import AttributeManager from "./attribute-manager.js";
import EventManager from "./event-manager.js";
import Logger from "../logger/logger.js";

/**
 * The DOMManager class handles interactions with the DOM, including the registration of DOM dependencies,
 * processing of template nodes, input binding for two-way data binding, and updates to the DOM elements
 * based on the model's data.
 */
export default class DOMManager {

    /**
     * Creates an instance of the DOMManager class, initializing necessary properties and dependencies
     * for managing the DOM in relation to the model. Sets up managers for loops, conditionals, and attributes,
     * and prepares structures for DOM dependencies and virtual DOM.
     *
     * @param {Object} model - The model that serves as the data source for the DOMManager.
     *                         It is used for data binding and template rendering in the DOM.
     */
    constructor(model) {
        Logger.DEBUG_LEVEL = model.options.debug ? 4 : 0;
        Logger.debug('DOMManager: Init DOMManager');

        this.model = model;
        this.elements = [];
        this.inputs = [];
        this.domDependencies = new Map();
        this.virtualDom = new Map();

        this.loopManager = new LoopManager(this, model);
        this.conditionalManager = new ConditionalManager(this, model);
        this.attributeManager = new AttributeManager(this, model);
        this.eventManager = new EventManager(this, model);
        
        Logger.debug('DOMManager: DOMManager initialized');
    }

    /**
     * Registers a dependency between a model property path and a DOM element.
     * - Creates a new Set for the property path if it doesn't exist
     * - Adds element and additional info to the dependency set
     * - Supports multiple elements depending on the same property
     *
     * @param {string} propertyPath - Model property path to watch
     * @param {HTMLElement} domElement - DOM element to update
     * @param {Object} info - Additional dependency metadata
     */
    registerDomDependency(propertyPath, domElement, info) {
        if (!this.domDependencies.has(propertyPath)) {
            this.domDependencies.set(propertyPath, new Set());
        }
        this.domDependencies.get(propertyPath).add({
            element: domElement,
            ...info
        });
    }

    /**
     * Recursively processes template nodes and replaces placeholders with values.
     * - Handles text nodes: replaces {{expression}} with actual values
     * - For text nodes: compares original and new content to avoid unnecessary updates
     * - For element nodes: recursively processes all child nodes
     * - Supports both context values and model store values
     *
     * @param {Node} node - DOM node to process
     * @param {Object} context - Optional context data for placeholder replacement
     */
    processTemplateNode(node, context) {
        Logger.debug('DOMManager: processTemplateNode', {node, context});
        
        if (node.nodeType === Node.TEXT_NODE) {
            const originalText = node.textContent;
            const newText = node.textContent.replace(/\{\{\s*([^}]+)\s*\}\}/g, (match, path) => {
                path = path.trim();

                // Функція для отримання значення за шляхом
                const getValueByPath = (obj, path) => {
                    return path.split('.').reduce((value, key) => {
                        return value ? value[key] : undefined;
                    }, obj);
                };

                // Спочатку шукаємо в локальному контексті
                let value = context ? getValueByPath(context, path) : undefined;

                // Якщо не знайдено в контексті, шукаємо в глобальному сховищі
                if (value === undefined) {
                    value = this.model.store.get(path);
                }

                return value !== undefined ? value : '';
            });
            if (originalText !== newText) {
                Logger.debug(`DOMManager: updated node text from ${originalText} to ${newText}`);
                node.textContent = newText;
            }
        } else if (node.nodeType === Node.ELEMENT_NODE) {
            Array.from(node.childNodes).forEach(child => {
                this.processTemplateNode(child, context);
            });
        }
    }

    /**
     * Parses DOM tree for template placeholders and sets up reactive bindings.
     * - Uses TreeWalker to efficiently traverse text nodes
     * - Detects template expressions using regex pattern
     * - Registers dependencies for each found template expression
     * - Preserves original template text for future updates
     * - Handles regex state reset between matches
     *
     * @param {HTMLElement} root - Starting point for DOM traversal
     */
    parse(root) {
        Logger.debug('DOMManager: parse from', root);
        
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

            regex.lastIndex = 0;

            while ((match = regex.exec(text)) !== null) {
                Logger.debug(`DOMManager: parse match found for ${text}`, match);
                
                const propPath = match[1].trim();

                this.registerDomDependency(propPath, node, {
                    type: 'template',
                    template: originalText
                });

                this.elements.push({
                    node,
                    propName: propPath,
                    template: originalText
                });
            }

            Logger.debug(`DOMManager: update virtual DOM set`, {node, text: node.textContent});
            this.virtualDom.set(node, node.textContent);
        }

        Logger.debug('DOMManager: Find inputs with data-model directive...');
        const inputs = root.querySelectorAll('[data-model]');
        Logger.debug('DOMManager: Found inputs with data-model:', inputs.length);
        inputs.forEach(input => {
            const property = input.getAttribute('data-model');

            Logger.debug('DOMManager: Register handler for:', {input, property});
            
            const handler = (e) => {
                const value = input.type === 'checkbox' || input.type === 'radio'
                    ? e.target.checked
                    : e.target.value;

                this.model.store.set(property, value);
            };

            input.__modelInputHandler = handler;

            input.addEventListener('input', handler);

            this.inputs.push({
                element: input,
                property: property
            });
        });
    }

    /**
     * Sets the value of the input element based on the provided value.
     * For checkboxes and radio buttons, it sets the `checked` property.
     * For other input types, it sets the `value` property.
     *
     * @param {HTMLInputElement} input - The input element to update.
     * @param {*} value - The value to set for the input. For checkboxes and radio buttons, it should be a boolean.
     */
    setInputValue(input, value) {
        if (input.type === 'checkbox' || input.type === 'radio') {
            input.checked = Boolean(value);
        } else {
            input.value = value;
        }
    }

    /**
     * Updates all input elements associated with the specified property with the provided value.
     * It ensures that the value in the DOM accurately reflects the value in the model.
     *
     * @param {string} propName - The name of the property whose value should be updated in the inputs.
     * @param {*} value - The value to set for the associated inputs.
     */
    updateInputs(propName, value) {
        Logger.debug('DOMManager: updateInputs', {propName, value});
        this.inputs.forEach(item => {
            if (item.property === propName) {
                Logger.debug('DOMManager: update input', {item, value});
                this.setInputValue(item.element, value);
            }
        });
    }

    /**
     * Updates all DOM elements based on the current state of the model.
     * This includes:
     * - Text nodes containing template placeholders.
     * - Input elements bound using `data-model` attributes.
     *
     * Iterates through registered nodes and inputs, updating their content
     * or values to reflect the latest model state.
     *
     * Ensures that the UI remains synchronized with the underlying model.
     */
    updateAllDOM() {
        Logger.debug('DOMManager: updateAllDOM');
        
        this.elements.forEach(element => {
            let newContent = element.template;
            newContent = newContent.replace(/\{\{\s*([^}]+)\s*\}\}/g, (match, path) => {
                path = path.trim();
                return this.model.store.get(path);
            });
            element.node.textContent = newContent;
            Logger.debug(`DOMManager: updated node`, {element, newContent});
        });

        Logger.debug('DOMManager: update inputs');
        this.inputs.forEach(item => {
            Logger.debug('DOMManager: update input', {item});
            const value = this.model.store.get(item.property);
            this.setInputValue(item.element, value);
            Logger.debug('DOMManager: updated input', {item, value});
        });
    }

    /**
     * Updates the DOM elements or attributes whenever a property in the model changes.
     * It resolves what elements depending on the property should be updated,
     * including templates, conditionals, loops, and attributes.
     *
     * @param {string} propertyPath - Path of the property in the model that triggered the change.
     * @param {*} value - New value of the property (could be a primitive, object, or array).
     */
    updateDOM(propertyPath, value) {
        Logger.debug(`DOMManager: update DOM for ${propertyPath} with ${value}`);

        if (!propertyPath) {
            console.warn('Path is undefined in updateDOM');
            return;
        }

        const isArrayMethodChange = value && typeof value === 'object' && 'method' in value;

        if (isArrayMethodChange) {
            propertyPath = value.path || propertyPath;
        }

        const elementsToUpdate = new Set();

        if (this.domDependencies.has(propertyPath)) {
            this.domDependencies.get(propertyPath).forEach(dep =>
                elementsToUpdate.add(dep)
            );
            // const deps = this.domDependencies.get(propertyPath);
            // for (const { element, meta } of deps) {
            //     console.log(element, meta);
            //     // Обрабатываем разные типы зависимостей
            //     if (meta && meta.type) { 
            //         switch (meta.type) {
            //             case 'attribute':
            //                 // Обработка атрибутов
            //                 // this.updateElementAttribute(element, meta.attribute, meta.expression);
            //                 break;
            //         }
            //     }
            // }
        }

        const pathParts = propertyPath.split('.');
        let currentPath = '';
        for (let i = 0; i < pathParts.length; i++) {
            currentPath = currentPath ? `${currentPath}.${pathParts[i]}` : pathParts[i];
            if (this.domDependencies.has(currentPath)) {
                this.domDependencies.get(currentPath).forEach(dep =>
                    elementsToUpdate.add(dep)
                );
            }
        }

        const conditionalElements = this.conditionalManager.getDependenciesByPath(propertyPath);
        conditionalElements.forEach(dep => {
            if (dep.type === 'if') {
                this.conditionalManager.updateConditional(dep.element, dep.expression);
            }
        });

        this.domDependencies.forEach((deps, path) => {
            if (path.startsWith(`${propertyPath}.`) || path.startsWith(`${propertyPath}[`)) {
                deps.forEach(dep => elementsToUpdate.add(dep));
            }
        });

        if (Array.isArray(value) || isArrayMethodChange || typeof value === 'object') {
            this.loopManager.updateLoops(propertyPath, value);
        }

        if (elementsToUpdate.size === 0) return;

        const updates = {
            template: [],
            conditional: [],
            loop: [],
            attribute: []
        };

        elementsToUpdate.forEach(dep => {
            if (dep && dep.type) {
                updates[dep.type].push(dep);
            }
        });

        updates.template.forEach(dep => this.updateTemplateNode(dep.element, dep.template));
        updates.conditional.forEach(dep => this.conditionalManager.updateConditional(dep.element, dep.expression));
        updates.attribute.forEach(dep => this.attributeManager.update(dep.element, dep.attribute, dep.expression));
        updates.loop.forEach(dep => this.loopManager.updateLoopPart(dep.element, dep.arrayPath, value, dep.index));
    }

    /**
     * Updates a template-based DOM node's content with the latest values
     * from the model store.
     *
     * This method uses a Mustache-like syntax (for example, `{{propertyName}}`)
     * to replace placeholders in the template with actual values retrieved
     * from the model store. If the content changes compared to the virtual DOM,
     * the DOM node is updated, and the new content is recorded in the virtual DOM.
     *
     * @param {HTMLElement} node - The DOM node to update.
     * @param {string} template - The template string containing placeholders
     *                            for dynamic values.
     */
    updateTemplateNode(node, template) {
        const newContent = template.replace(/\{\{\s*([^}]+)\s*\}\}/g, (match, path) => {
            path = path.trim();
            return this.model.store.get(path);
        });

        if (this.virtualDom.get(node) !== newContent) {
            node.textContent = newContent;
            this.virtualDom.set(node, newContent);
        }
    }

    /**
     * Checks whether the given pathA is a dependency of pathB.
     *
     * A path is considered a dependency if:
     * - It is identical to the other path.
     * - It is a hierarchical descendent of the other path (for example, pathB starts with pathA).
     * - It is an array element of the other path (for example, pathB starts with pathA followed by an array index).
     *
     * @param {string} pathA - The base path to check against.
     * @param {string} pathB - The path to verify as a dependency.
     * @returns {boolean} - Returns `true` if pathB is a dependency of pathA, otherwise `false`.
     */
    isPathDependency(pathA, pathB) {
        return pathB === pathA ||
            pathB.startsWith(`${pathA}.`) ||
            pathB.startsWith(`${pathA}[`);
    }

    /**
     * Retrieves all paths from the DOM dependency tracker that are
     * dependent on the given path. A path is considered dependent if:
     * - It is hierarchically related (for example, a path starts with the given path).
     * - It matches exactly with the given path.
     *
     * This method collects and returns all such dependent paths.
     *
     * @param {string} path - The path for which to find dependent paths.
     * @returns {string[]} - An array of dependent paths.
     */
    getDependentPaths(path) {
        const dependentPaths = [];
        this.domDependencies.forEach((_, depPath) => {
            if (this.isPathDependency(path, depPath)) {
                dependentPaths.push(depPath);
            }
        });
        return dependentPaths;
    }

    /**
     * Binds and processes the DOM for data binding, conditional rendering,
     * loops, and attribute updates. This method integrates the different
     * managers and processes involved in setting up the live DOM bindings.
     *
     * Steps performed:
     * 1. Parses loops within the DOM using the loop manager.
     * 2. Parses conditional elements using the conditional manager.
     * 3. Parses standard attributes using the attribute manager.
     * 4. Processes custom attribute bindings (colon-prefixed attributes).
     * 5. Parses any additional elements or bindings.
     * 6. Updates the DOM to reflect the current state of the model.
     *
     * @param {HTMLElement} rootElement - The root element to initiate the DOM binding process.
     */
    bindDOM(rootElement) {
        Logger.debug('DOMManager: bind DOM from', rootElement);
        this.loopManager.parseLoops(rootElement);
        this.conditionalManager.parseConditionals(rootElement);
        this.attributeManager.parseAttributesBind(rootElement);
        this.attributeManager.parseAttributes(rootElement);
        this.eventManager.parseEvents(rootElement);
        this.parse(rootElement);
        this.updateAllDOM();
        Logger.debug('DOMManager: binding completed');
    }
    
    /**
     * Destroys the instance by performing cleanup tasks.
     *
     * This method removes event listeners from input elements, clears out
     * internal data structures like `elements`, `inputs`, `domDependencies`,
     * and `virtualDom`, and calls the `destroy` methods of `loopManager` and
     * `conditionalManager`. It is intended to completely clean up the instance
     * and free resources to avoid memory leaks.
     */
    destroy() {
        this.inputs.forEach(({element}) => {
            if (element.__modelInputHandler) {
                element.removeEventListener('input', element.__modelInputHandler);
                delete element.__modelInputHandler;
            }
        });

        this.elements = [];
        this.inputs = [];
        this.domDependencies.clear();
        this.virtualDom.clear();

        this.loopManager.destroy();
        this.conditionalManager.destroy();
        this.eventManager.destroy();
        
        Logger.debug('DOMManager: destroyed');
    }
}