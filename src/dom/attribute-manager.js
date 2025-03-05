// import {evaluateExpression, extractVariables} from "../utils/expression.js";
import ExpressionManager from "../utils/expression-manager.js";
import Logger from "../logger/logger.js";

/**
 * @class AttributeManager
 * Handles dynamic parsing, updating, and management of DOM element attributes based on data bindings defined
 * in `data-bind` attributes. Provides functionality for registering dependencies with a DOM manager and
 * dynamically synchronizing attributes according to changes in the application model.
 * 
 * Manages attributes of DOM elements, allowing for dynamic updates and bindings.
 * @class
 * @param {Object} dom - The DOM manager responsible for registering dependencies.
 * @param {Object} model - The data model containing application state and logic.
 * 
 * @example
 * // Usage Example:
 * const domManager = new DomManager();
 * const model = new Model();
 * const attributeManager = new AttributeManager(domManager, model);
 * const rootElement = document.getElementById('root');
 * attributeManager.parseAttributes(rootElement);
 */
export default class AttributeManager {
    constructor(dom, model) {
        this.domManager = dom;
        this.model = model;
        
        Logger.DEBUG_LEVEL = this.model.options.debug ? 4 : 0;
        Logger.debug("Init AttributeManager")
    }

    /**
     * Parses the attributes of elements with 'data-bind' attribute within the root element.
     * - Searches for elements with data-bind attribute
     * - Parses JSON binding expressions (converts single quotes to double quotes)
     * - Extracts variables from expressions
     * - Registers DOM dependencies for each variable
     * - Initializes attribute values
     *
     * @param {HTMLElement} rootElement - The root element containing elements with data bindings.
     * @throws {Error} When binding expression parsing fails
     */
    parseAttributesBind(rootElement) {
        Logger.debug("Parsing attributes bind with data-bind...")
        const elements = rootElement.querySelectorAll('[data-bind]');
        Logger.debug("Found elements with data-bind:", elements.length)
        
        elements.forEach(element => {
            Logger.debug("Parsing element with data-bind:", element)
            const bindingExpression = element.getAttribute('data-bind');

            try {
                const bindings = JSON.parse(bindingExpression.replace(/'/g, '"'));

                for (const [attributeName, expression] of Object.entries(bindings)) {

                    const variables = ExpressionManager.extractVariables(expression);

                    Logger.debug(`Found variables for ${attributeName}:`, variables)

                    variables.forEach(variable => {
                        this.domManager.registerDomDependency(variable, element, {
                            type: 'attribute',
                            attribute: attributeName,
                            expression: expression
                        });
                    });

                    this.updateAttributes(element, attributeName, expression);
                }
            } catch (error) {
                console.error('An error of analysis of attachments:', error);
            }
        });
    }
    
    /**
     * Updates a DOM element's attribute based on a provided expression.
     * Evaluates the expression using the current state of the application model, and
     * updates the attribute only if its value has changed.
     *
     * - If the expression represents a falsy value (false, null, undefined), the attribute is removed.
     * - If the value is `true`, the attribute is added without a value ("").
     * - Otherwise, the attribute is set to the stringified value of the evaluated expression.
     *
     * @param {HTMLElement} element - The DOM element whose attribute needs to be updated.
     * @param {string} attributeName - The name of the attribute to be updated.
     * @param {string} expression - The expression to be evaluated to determine the attribute's value.
     *
     * Special cases:
     * - Handles template expressions in format {{expression}}
     * - Direct model path access for template expressions
     * - Expression evaluation for non-template strings
     * 
     */
    updateAttributes(element, attributeName, expression) {
        const context = {...this.model.store.getState()};
        let value;

        if (expression.startsWith('{{') && expression.endsWith('}}')) {

            const path = expression.substring(2, expression.length - 2).trim();
            value = this.model.store.get(path);
        } else {

            value = ExpressionManager.evaluateExpression(expression, context);
        }

        const previousValue = element.getAttribute(attributeName);
        
        if (String(value) !== previousValue) {
            if (value === false || value === null || value === undefined) {
                element.removeAttribute(attributeName);
            } else if (value === true) {
                element.setAttribute(attributeName, '');
            } else {
                element.setAttribute(attributeName, String(value));
            }
            Logger.debug(`Updated attribute ${attributeName} with value:`, value)
        }
    }

    /**
     * Parses and processes attribute bindings in the provided root
     * DOM element. Attributes prefixed with a colon (e.g., `:class`)
     * are treated as dynamic bindings.
     *
     * For each dynamically bound attribute:
     * - Updates the attribute value on the element based on the
     *   current model store state.
     * - Registers a dependency between the element and the attribute
     *   expression in the DOM dependency tracker.
     * - Removes the colon-prefixed attribute from the DOM.
     *
     * @param {HTMLElement} rootElement - The root element to search
     *                                    for attribute bindings.
     */
    parseAttributes(rootElement) {
        Logger.debug("Parsing attributes with colon...")
        
        const allElements = rootElement.querySelectorAll('*');

        for (const element of allElements) {
            const attributes = element.attributes;

            for (let i = 0; i < attributes.length; i++) {
                const attr = attributes[i];

                if (attr.name.startsWith(':')) {
                    Logger.debug(`Found attribute:`, attr)

                    const realAttrName = attr.name.substring(1);

                    const expression = attr.value;

                    this.updateElementAttribute(element, realAttrName, expression);

                    this.domManager.registerDomDependency(expression, element, {
                        type: 'attribute',
                        attribute: realAttrName,
                        expression: expression
                    });

                    element.removeAttribute(attr.name);
                }
            }
        }
    }

    /**
     * Updates the value of a DOM element's attribute based on the current
     * state of the model store.
     *
     * Dynamically handles specific attributes like `class`, `disabled`,
     * `checked`, `selected`, and `readonly` to ensure they're properly assigned
     * for Boolean or string values. For other attributes, it assigns the value
     * directly.
     *
     * If the value for the given expression cannot be resolved from the model store,
     * a warning is logged to the console.
     *
     * @param {HTMLElement} element - The DOM element whose attribute is being updated.
     * @param {string} attribute - The name of the attribute to update.
     * @param {string} expression - The model store expression to retrieve the value.
     */
    updateElementAttribute(element, attribute, expression) {
        const value = this.model.store.get(expression);

        if (value === undefined) {
            return;
        }

        Logger.debug(`Updating attribute ${attribute} with ${value}`)
        
        if (attribute === 'class') {
            element.className = value;
        } else if (attribute === 'disabled' ||
            attribute === 'checked' ||
            attribute === 'selected' ||
            attribute === 'readonly') {

            if (value) {
                element.setAttribute(attribute, '');
            } else {
                element.removeAttribute(attribute);
            }
        } else {
            element.setAttribute(attribute, value);
        }
    }
    
    update(element, attribute, expression){
        Logger.debug(`Updating element:`, element)
        Logger.debug(`\t Attribute: ${attribute} for:`, expression)
        
        this.updateAttributes(element, attribute, expression);
        this.updateElementAttribute(element, attribute, expression)
    }
}