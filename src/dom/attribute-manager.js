import {evaluateExpression, extractVariables} from "../utils/expression.js";

export default class AttributeManager {
    constructor(dom, model) {
        this.domManager = dom;
        this.model = model;
    }
    
    // Parse DOM to search for attributes with bindings
    parseAttributes(rootElement) {
        const elements = rootElement.querySelectorAll('[data-bind]');

        elements.forEach(element => {
            const bindingExpression = element.getAttribute('data-bind');

            try {
                const bindings = JSON.parse(bindingExpression.replace(/'/g, '"'));

                for (const [attributeName, expression] of Object.entries(bindings)) {
                    // We extract variables from expression
                    const variables = extractVariables(expression);

                    // We register dependencies
                    variables.forEach(variable => {
                        this.domManager.registerDomDependency(variable, element, {
                            type: 'attribute',
                            attribute: attributeName,
                            expression: expression
                        });
                    });

                    // The initial renewal of the attribute
                    this.updateAttribute(element, attributeName, expression);
                }
            } catch (error) {
                console.error('An error of analysis of attachments:', error);
            }
        });
    }

    // A method for updating the attribute based on expression
    updateAttribute(element, attributeName, expression) {
        // We calculate the value of the expression
        const context = {...this.model.store.getState()};
        let value;

        if (expression.startsWith('{{') && expression.endsWith('}}')) {
            // If this template {{ expression }}
            const path = expression.substring(2, expression.length - 2).trim();
            value = this.model.store.get(path);
        } else {
            // If it is JavaScript expression
            value = evaluateExpression(expression, context);
        }

        // We remember the previous value to prevent excess Dom updates
        const previousValue = element.getAttribute(attributeName);

        // We update the attribute only if the value has changed
        if (String(value) !== previousValue) {
            // Special processing for Boolean Atrictens
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