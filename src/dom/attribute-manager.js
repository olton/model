import {evaluateExpression, extractVariables} from "../utils/expression.js";

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
    parseAttributes(rootElement) {
        const elements = rootElement.querySelectorAll('[data-bind]');

        elements.forEach(element => {
            const bindingExpression = element.getAttribute('data-bind');

            try {
                const bindings = JSON.parse(bindingExpression.replace(/'/g, '"'));

                for (const [attributeName, expression] of Object.entries(bindings)) {

                    const variables = extractVariables(expression);


                    variables.forEach(variable => {
                        this.domManager.registerDomDependency(variable, element, {
                            type: 'attribute',
                            attribute: attributeName,
                            expression: expression
                        });
                    });


                    this.updateAttribute(element, attributeName, expression);
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
    updateAttribute(element, attributeName, expression) {
        const context = {...this.model.store.getState()};
        let value;

        if (expression.startsWith('{{') && expression.endsWith('}}')) {

            const path = expression.substring(2, expression.length - 2).trim();
            value = this.model.store.get(path);
        } else {

            value = evaluateExpression(expression, context);
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
        }
    }
}