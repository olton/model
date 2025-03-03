export default class ConditionalManager {
    constructor(dom, model) {
        this.dom = dom;
        this.model = model;
        this.dependencies = new Map();
        this.conditionalGroups = [];
        
        this.subscribe();
    }

    subscribe() {
        this.model.store.on('change', (data) => {
            // We update all groups of conditional directives, depending on the changed path
            const dependentGroups = this.getGroupsByPath(data.path);
            dependentGroups.forEach(group => {
                this.updateConditionalGroup(group);
            });
        });
    }

    // Obtaining groups depending on the specified path
    getGroupsByPath(path) {
        const result = new Set();

        this.conditionalGroups.forEach(group => {
            const hasDependency = group.some(item => {
                if (!item.expression) return false;

                // We check whether the expression contains the specified path
                return item.expression.includes(path) ||
                    path.startsWith(this.extractBasePath(item.expression));
            });

            if (hasDependency) {
                result.add(group);
            }
        });

        return Array.from(result);
    }

    // Extracting the basic path from expression (for example, from "Counter> 0" extract "Counter")
    extractBasePath(expression) {
        const matches = expression.match(/[a-zA-Z_][a-zA-Z0-9_]*/g);
        return matches ? matches[0] : '';
    }
    
    parseConditionals(rootElement) {
        // We find all elements with conditional directives in the order of their following in Dom
        const nodes = rootElement.querySelectorAll('[data-if],[data-else-if],[data-else]');

        // We group related conditional elements
        let currentGroup = [];
        const groups = [];

        nodes.forEach(node => {
            if (node.hasAttribute('data-if')) {
                // if found new data-if, We begin a new group
                if (currentGroup.length) {
                    groups.push(currentGroup);
                }
                currentGroup = [{
                    element: node,
                    type: 'if',
                    expression: node.getAttribute('data-if')
                }];
            } else if (node.hasAttribute('data-else-if')) {
                // We check that this is a continuation of the current group
                if (currentGroup.length && this.isAdjacentNode(currentGroup[currentGroup.length-1].element, node)) {
                    currentGroup.push({
                        element: node,
                        type: 'else-if',
                        expression: node.getAttribute('data-else-if')
                    });
                } else {
                    // If this is not a continuation, we start a new group (we process as if)
                    if (currentGroup.length) {
                        groups.push(currentGroup);
                    }
                    currentGroup = [{
                        element: node,
                        type: 'if', // We consider it as a regular if
                        expression: node.getAttribute('data-else-if')
                    }];
                }
            } else if (node.hasAttribute('data-else')) {
                // We check that this is a continuation of the current group
                if (currentGroup.length && this.isAdjacentNode(currentGroup[currentGroup.length-1].element, node)) {
                    currentGroup.push({
                        element: node,
                        type: 'else',
                        expression: null
                    });

                    // else Always completes the group
                    groups.push(currentGroup);
                    currentGroup = [];
                } else {
                    // If this is not a continuation, we ignore (Else should follow the if/else-line)
                    console.warn('data-else без предшествующего data-if или data-else-if', node);
                }
            }
        });

        // Add the last group if it is
        if (currentGroup.length) {
            groups.push(currentGroup);
        }

        // We update each group of conventional elements
        this.conditionalGroups = groups;
        groups.forEach(group => this.updateConditionalGroup(group));

        // We set up a dependence card
        this.setupDependencies(nodes);
    }

    // Checks whether the nodes are neighboring Dom
    isAdjacentNode(node1, node2) {
        // We check that Node2 is immediately after Node1 or is separated only
        let current = node1.nextSibling;
        while (current) {
            if (current === node2) return true;
            if (current.nodeType === 1 && !this.isWhitespaceNode(current)) return false;
            current = current.nextSibling;
        }
        return false;
    }

    // Checks whether the knot is a sample
    isWhitespaceNode(node) {
        return node.nodeType === 3 && node.textContent.trim() === '';
    }

    updateConditionalGroup(group) {
        // We get a condition from the model in a safe way
        const context = this.model && this.model.store ?
            {...this.model.store.getState()} :
            this.model && this.model.data ? this.model.data : {};

        let conditionMet = false;

        for (const item of group) {
            if (item.type === 'if' || item.type === 'else-if') {
                // We calculate the condition only if the previous ones did not work
                const result = !conditionMet && this.evaluateExpression(item.expression, context);

                if (result) {
                    // Show this element
                    item.element.style.display = '';
                    conditionMet = true;
                } else {
                    // We hide the element
                    item.element.style.display = 'none';
                }
            } else if (item.type === 'else') {
                // Show ELSE only if none of the previous conditions has worked
                item.element.style.display = conditionMet ? 'none' : '';
            }
        }
    }

    updateConditional(element, expression) {
        // Update the entire group if the element is included in the group
        const group = this.findGroupForElement(element);
        if (group) {
            this.updateConditionalGroup(group);
        } else {
            // For single if elements
            const context = this.model && this.model.store ?
                {...this.model.store.getState()} :
                this.model && this.model.data ? this.model.data : {};

            const result = this.evaluateExpression(expression, context);
            element.style.display = result ? '' : 'none';
        }
    }

    findGroupForElement(element) {
        // We find a group containing this element
        for (const group of this.conditionalGroups || []) {
            if (group.some(item => item.element === element)) {
                return group;
            }
        }
        return null;
    }

    setupDependencies(nodes) {
        this.dependencies = new Map();

        nodes.forEach(element => {
            let expression;

            if (element.hasAttribute('data-if')) {
                expression = element.getAttribute('data-if');
            } else if (element.hasAttribute('data-else-if')) {
                expression = element.getAttribute('data-else-if');
            } else {
                return; // data-else It has no expression
            }

            const variables = this.extractVariables(expression);

            variables.forEach(variable => {
                if (!this.dependencies.has(variable)) {
                    this.dependencies.set(variable, []);
                }

                this.dependencies.get(variable).push({
                    element,
                    expression,
                    type: element.hasAttribute('data-if') ? 'if' : 'else-if'
                });
            });
        });
    }

    extractVariables(expression) {
        // A simple option for extracting variables from expression
        const variables = [];
        const parts = expression.split(/[^a-zA-Z0-9_.]/);

        parts.forEach(part => {
            const varName = part.trim();
            if (varName && /^[a-zA-Z_][a-zA-Z0-9_.]*$/.test(varName)) {
                const baseName = varName.split('.')[0];
                if (!variables.includes(baseName) && baseName !== 'true' &&
                    baseName !== 'false' && baseName !== 'null' &&
                    baseName !== 'undefined' && !isNaN(Number(baseName))) {
                    variables.push(baseName);
                }
            }
        });

        return variables;
    }

    getDependenciesByPath(path) {
        const result = [];

        this.dependencies.forEach((deps, variable) => {
            if (variable === path || path.startsWith(variable + '.')) {
                result.push(...deps);
            }
        });

        return result;
    }

    // Safe assessment of expressions
    evaluateExpression(expression, context) {
        try {
            // Checking on templates {{PATH}}
            if (expression.startsWith('{{') && expression.endsWith('}}')) {
                const path = expression.substring(2, expression.length - 2).trim();
                return this.getValueFromContext(context, path);
            }

            return this.parseExpression(expression, context);
        } catch (error) {
            console.error('Ошибка при вычислении выражения:', error);
            return false;
        }
    }

    // Obtaining a value along the way in the object
    getValueFromContext(obj, path) {
        if (!path) return obj;

        return path.split('.').reduce((acc, part) => {
            const arrayMatch = part.match(/^([^\[]+)(?:\[(\d+)\])?$/);
            if (arrayMatch) {
                const [_, propName, arrayIndex] = arrayMatch;
                const propValue = acc?.[propName];
                return arrayIndex !== undefined && Array.isArray(propValue) ?
                    propValue[parseInt(arrayIndex, 10)] : propValue;
            }
            return acc?.[part];
        }, obj);
    }

    // Safe Parsing expressions
    parseExpression(expression, context) {
        expression = expression.trim();

        // Processing of a thorns operator
        const ternaryMatch = expression.match(/(.+?)\s*\?\s*(.+?)\s*:\s*(.+)/);
        if (ternaryMatch) {
            const [_, condition, trueExpr, falseExpr] = ternaryMatch;
            return this.parseExpression(condition, context)
                ? this.parseExpression(trueExpr, context)
                : this.parseExpression(falseExpr, context);
        }

        // Logic operators
        if (expression.includes('&&')) {
            const parts = expression.split('&&');
            return parts.every(part => this.parseExpression(part.trim(), context));
        }

        if (expression.includes('||')) {
            const parts = expression.split('||');
            return parts.some(part => this.parseExpression(part.trim(), context));
        }

        // Comparison operators
        const comparisonMatch = expression.match(/(.+?)\s*(===|==|!==|!=|>=|<=|>|<)\s*(.+)/);
        if (comparisonMatch) {
            const [_, left, operator, right] = comparisonMatch;
            const leftValue = this.parseExpression(left.trim(), context);
            const rightValue = this.parseExpression(right.trim(), context);

            switch (operator) {
                case '==': return leftValue == rightValue;
                case '===': return leftValue === rightValue;
                case '!=': return leftValue != rightValue;
                case '!==': return leftValue !== rightValue;
                case '>': return leftValue > rightValue;
                case '<': return leftValue < rightValue;
                case '>=': return leftValue >= rightValue;
                case '<=': return leftValue <= rightValue;
            }
        }

        // String literals
        if ((expression.startsWith("'") && expression.endsWith("'")) ||
            (expression.startsWith('"') && expression.endsWith('"'))) {
            return expression.substring(1, expression.length - 1);
        }

        // Numerical literals
        if (/^-?\d+(\.\d+)?$/.test(expression)) {
            return parseFloat(expression);
        }

        // Boolean Literals and null/undefined
        if (expression === 'true') return true;
        if (expression === 'false') return false;
        if (expression === 'null') return null;
        if (expression === 'undefined') return undefined;

        // Obtaining a value from context
        return this.getValueFromContext(context, expression);
    }
    
    destroy() {
        this.dependencies.clear();
        this.conditionalGroups = [];
    }
}