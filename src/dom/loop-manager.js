import Logger from "../logger/logger.js";

/**
 * Manages dynamic loop rendering in the DOM based on data bindings.
 * - Handles array iteration with data-for attribute
 * - Handles object property iteration with data-in attribute
 * - Maintains templates and dependencies for dynamic updates
 * - Supports index/key variables in loop expressions
 *
 * @class
 * @property {Map} loops - Stores array-based loop configurations
 * @property {Array} loopsIn - Stores object-based loop configurations
 */
export default class LoopManager {

    /**
     * Creates a new instance of LoopManager.
     *
     * @param {Object} domManager - Manages DOM operations and template bindings
     * @param {Object} model - Contains the data store and bindings
     * @property {Map} loops - Stores array loop templates and configurations
     * @property {Array} loopsIn - Stores object loop configurations and elements
     */
    constructor(domManager, model) {
        Logger.DEBUG_LEVEL = model.options.debug ? 4 : 0;
        Logger.debug('Init LoopManager');

        this.domManager = domManager;
        this.model = model;
        this.loops = new Map();
        this.loopsIn = []
        
        Logger.debug('LoopManager initialized');
    }

    /**
     * Parses and initializes both array and object loops in the DOM.
     *
     * For data-for loops:
     * - Validates loop expression syntax (item[, index] in array)
     * - Creates template clones for future updates
     * - Registers array dependencies for reactive updates
     * - Performs initial loop rendering
     *
     * For data-in loops:
     * - Validates loop expression (key in object)
     * - Stores original templates
     * - Creates placeholder comments for loop position
     * - Hides original elements
     * - Performs initial object iteration rendering
     *
     * @param {HTMLElement} rootElement - Root element to scan for loop directives
     * @throws {Error} Logs error for invalid loop expressions
     */
    parseLoops(rootElement) {
        Logger.debug("Parsing loops with data-for...")
        
        const loopElements = rootElement.querySelectorAll('[data-for]');

        Logger.debug("Found elements with data-for:", loopElements.length)
        
        loopElements.forEach((element) => {
            const expression = element.getAttribute('data-for').trim();
            const matches = expression.match(/^\s*(\w+)(?:\s*,\s*(\w+))?\s+in\s+(\w+(?:\.\w+)*)\s*$/);

            if (!matches) {
                console.error('Invalid expression format data-for:', expression);
                return;
            }

            const [_, itemName, indexName, arrayPath] = matches;
            const array = this.model.store.get(arrayPath);

            if (!Array.isArray(array)) {
                console.error(`The value in the ${arrayPath} path is not an array:`, array);
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

            this.domManager.registerDomDependency(arrayPath, element, {
                type: 'loop',
                arrayPath
            });

            this.updateLoop(element);
        });

        Logger.debug("Parsing loops with data-in...")
        
        const inLoops = rootElement.querySelectorAll('[data-in]');
        
        Logger.debug("Found elements with data-in:", inLoops.length)
        
        inLoops.forEach(element => {
            const attributeValue = element.getAttribute('data-in');
            const match = attributeValue.match(/^\s*(\w+)\s+in\s+(\S+)\s*$/);

            if (!match) {
                console.error(`Invalid data-in syntax: ${attributeValue}`);
                return;
            }

            const [_, keyVar, objectPath] = match;

            const template = element.innerHTML;
            const parent = element.parentNode;
            const placeholder = document.createComment(`data-in: ${attributeValue}`);

            element.style.display = 'none';
            parent.insertBefore(placeholder, element);

            this.loopsIn.push({
                type: 'in',
                originalElement: element,
                template,
                placeholder,
                objectPath,
                keyVar,
                elements: []
            });

            const objectData = this.model.store.get(objectPath);
            if (objectData && typeof objectData === 'object' && !Array.isArray(objectData)) {
                this.updateInLoop(this.loopsIn[this.loopsIn.length - 1], objectData);
            }
        });
    }

    /**
     * Updates the content of object-based loops (`data-in`) when the associated object data changes.
     *
     * This method clears the current DOM elements generated for the loop, then iterates through
     * the provided `objectData` to render new elements based on the loop's template. It uses the
     * `keyVar` for the object's keys and binds the DOM elements for further updates.
     *
     * @param {Object} loop - The loop configuration containing details such as the template,
     *                        placeholder, and object path.
     * @param {Object} objectData - The new object data used to generate loop elements.
     */
    updateInLoop(loop, objectData) {
        loop.elements.forEach(el => el.remove());
        loop.elements = [];

        if (!objectData || typeof objectData !== 'object' || Array.isArray(objectData)) {
            return;
        }

        Object.keys(objectData).forEach(key => {
            Logger.debug(`Updating loop for key: ${key}`);
            const newElement = loop.originalElement.cloneNode(true);
            newElement.removeAttribute('data-in');
            newElement.style.display = '';

            const itemContext = {
                [loop.keyVar]: key,
            };

            newElement.innerHTML = this.processTemplate(loop.template, objectData, key, itemContext);

            loop.placeholder.parentNode.insertBefore(newElement, loop.placeholder.nextSibling);

            loop.elements.push(newElement);

            this.domManager.bindDOM(newElement);
        });
    }

    /**
     * Processes a template string by replacing placeholders with computed values
     * based on the given object data, key, and context.
     *
     * Placeholder syntax: `{{ path }}`, where `path` can refer to variable keys,
     * object properties, or dynamic expressions.
     *
     * @param {string} template - The template string containing placeholders.
     * @param {Object} objectData - The object data used for resolving placeholders.
     * @param {string} key - The current key in the object data.
     * @param {Object} itemContext - The context containing additional data such as the key variable.
     * @returns {string} - The processed template string with placeholders replaced by their respective values.
     */
    processTemplate(template, objectData, key, itemContext) {
        Logger.debug("Processing template:", template)
        Logger.debug("\t With data:", objectData)
        Logger.debug(`\t For key: ${key}`)
        Logger.debug(`\t With context:`, itemContext)
        
        return template.replace(/\{\{\s*([^}]+)\s*\}\}/g, (match, path) => {
            path = path.trim();
            const keyVar = Object.keys(itemContext)[0];

            if (path === keyVar) {
                return key;
            }

            Logger.debug(`Template: Processing path: ${path}`)
            
            const bracketRegex = new RegExp(`(\\w+)\\[${keyVar}\\]`);
            const bracketMatch = path.match(bracketRegex);

            if (bracketMatch) {
                const objName = bracketMatch[1];
                const obj = objectData;

                if (obj && typeof obj === 'object') {
                    return obj[key] !== undefined ? obj[key] : '';
                }
            }

            const value = this.model.store.get(path);
            if (value !== undefined) {
                return value;
            }

            return '';
        });
    }

    /**
     * Updates all the loops (`data-for` and `data-in`) when the data in the store changes.
     *
     * Specifically:
     * - Updates array-based loops (`data-for`) if the associated array data changes.
     * - Updates object-based loops (`data-in`) if the associated object or its child properties change.
     *
     * @param {string} path - The path of the data in the store that has changed.
     * @param {*} value - The new value at the given path.
     */
    updateLoops(path, value) {

        Logger.debug("Updating data-for loops for ${path}", this.loops)
        
        this.loops.forEach((loopInfo, element) => {
            if (loopInfo.arrayPath === path) {
                this.updateLoop(element);
            }
        });

        Logger.debug(`Updating data-in loops for ${path}`, this.loopsIn)
        
        this.loopsIn.forEach(loop => {
            if (loop.type === 'in' && (loop.objectPath === path || path.startsWith(loop.objectPath + '.'))) {
                const objectData = this.model.store.get(loop.objectPath);
                if (objectData && typeof objectData === 'object') {
                    this.updateInLoop(loop, objectData);
                }
            }
        });
    }

    /**
     * Updates the entire loop for a given element.
     * @param element
     */
    updateLoop(element) {
        Logger.debug("Updating loop for element:", element)
        
        const loopInfo = this.loops.get(element) || this.loopsIn.find(loop => loop.originalElement === element)[0];

        if (!loopInfo) {
            console.error('Информация о цикле не найдена для элемента');
            return;
        }

        const {template, itemName, indexName, arrayPath, parentNode} = loopInfo;
        const array = this.model.store.get(arrayPath);

        if (!Array.isArray(array)) {
            console.error('Значение не является массивом:', array);
            return;
        }

        const generated = parentNode.querySelectorAll(`[data-generated-for="${arrayPath}"]`);
        generated.forEach(el => el.remove());

        array.forEach((item, index) => {
            const newNode = template.cloneNode(true);
            newNode.style.display = '';
            newNode.removeAttribute('data-for');
            newNode.setAttribute('data-generated-for', arrayPath);
            newNode.setAttribute('data-item-index', ""+index);

            Logger.debug(`Creating new loop element for ${arrayPath} at index ${index}`)
            
            this.domManager.processTemplateNode(newNode, {
                [itemName]: item,
                [indexName || 'index']: index
            });

            Logger.debug(`Insert new node`, newNode)
            parentNode.insertBefore(newNode, element);
        });

        element.style.display = 'none';
    }

    /**
     * Partially updates a single DOM element within a loop based on changes in
     * the associated array. Specifically:
     * - If the changed index is provided, updates only the element at that index.
     * - If no changed index is provided or if the array length does not match
     *   the number of generated elements, falls back to a full loop update.
     *
     * @param {HTMLElement} element - The loop's original template element.
     * @param {string} arrayPath - The path to the array in the data store associated with this loop.
     * @param {*} changedValue - The updated value in the array (optional).
     * @param {number} changedIndex - The index of the updated value in the array (optional).
     */
    updateLoopPart(element, arrayPath, changedValue, changedIndex) {
        const loopInfo = this.loops.get(element);
        if (!loopInfo) return;

        const {template, itemName, indexName, parentNode} = loopInfo;
        const array = this.model.store.get(arrayPath);

        if (!Array.isArray(array)) return;

        const generated = Array.from(
            parentNode.querySelectorAll(`[data-generated-for="${arrayPath}"]`)
        );

        if (changedIndex === undefined || generated.length !== array.length) {
            return this.updateLoop(element);
        }

        const elementToUpdate = generated[changedIndex];
        if (elementToUpdate) {
            const newNode = template.cloneNode(true);

            this.domManager.processTemplateNode(newNode, {
                [itemName]: array[changedIndex],
                [indexName || 'index']: changedIndex
            });

            while (elementToUpdate.firstChild) {
                elementToUpdate.removeChild(elementToUpdate.firstChild);
            }

            while (newNode.firstChild) {
                elementToUpdate.appendChild(newNode.firstChild);
            }

            Array.from(newNode.attributes).forEach(attr => {
                elementToUpdate.setAttribute(attr.name, attr.value);
            });
        }
    }

    /**
     * Returns an object containing the tracked loops in the current instance.
     *
     * @returns {Object} An object with two properties:
     * - `for`: A Map of loops associated with array-based (`data-for`) rendering.
     * - `in`: An array of loops associated with object-based (`data-in`) rendering.
     */
    getLoops() {
        return {
            "for": this.loops,
            "in": this.loopsIn
        }
    }

    /**
     * Destroys all tracked loops by clearing the internal Map of `data-for` loops.
     *
     * This method should be called when the instance is no longer needed
     * to release memory and cleanup loop references.
     */
    destroy() {
        this.loops.clear();
        this.loopsIn = [];
        
        Logger.debug('LoopManager destroyed');
    }
}