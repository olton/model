/**
 * Manages conditional rendering logic by interpreting custom attributes
 * (e.g., `data-if`, `data-else-if`, `data-else`) on DOM elements and updating their visibility.
 * Tracks dependencies between model paths and conditional groups to reactively update DOM when the model changes.
 *
 * @class ConditionalManager
 * @param {Object} dom - The root DOM element or DOM-related utilities.
 * @param {Object} model - The data model containing `store` or `data` state.
 * @property {Object} dom - Reference to the DOM or DOM utilities.
 * @property {Object} model - Data model for determining dynamic conditions.
 * @property {Map} dependencies - Tracks variable dependencies for conditional expressions.
 * @property {Array} conditionalGroups - Group of DOM elements with conditional attributes.
 */
export default class ConditionalManager {

    /**
     * Initializes a new instance of the ConditionalManager class.
     *
     * @constructor
     * @param {Object} dom - The root DOM element or DOM-related utilities.
     * @param {Object} model - The data model containing state (e.g., `store` or `data`).
     */
    constructor(dom, model) {
        this.dom = dom;
        this.model = model;
        this.dependencies = new Map();
        this.conditionalGroups = [];

        this.subscribe();
    }

    /**
     * Subscribes to the model's store 'change' event to automatically update
     * affected conditional groups when data changes.
     * - Listens for store changes
     * - Identifies affected groups using getGroupsByPath
     * - Triggers updates for affected conditional groups
     *
     * @method subscribe
     * @private
     */
    subscribe() {
        this.model.store.on('change', (data) => {
            const dependentGroups = this.getGroupsByPath(data.path);
            dependentGroups.forEach(group => {
                this.updateConditionalGroup(group);
            });
        });
    }

    /**
     * Finds all conditional groups that depend on a specific model path.
     * - Uses Set to avoid duplicate groups
     * - Checks direct path matches and path prefix matches
     * - Filters groups based on their expressions
     *
     * @param {string} path - The model path to check dependencies against
     * @returns {Array} Array of unique conditional groups dependent on the path
     * @private
     */
    getGroupsByPath(path) {
        if (!path) {
            return [];
        }
        
        const result = new Set();

        this.conditionalGroups.forEach(group => {
            const hasDependency = group.some(item => {
                if (!item.expression) return false;

                return item.expression.includes(path) ||
                    path.startsWith(this.extractBasePath(item.expression));
            });

            if (hasDependency) {
                result.add(group);
            }
        });

        return Array.from(result);
    }

    /**
     * Extracts the base path from an expression using regex pattern matching.
     * - Matches valid JavaScript variable names
     * - Returns the first match or empty string
     * - Valid names start with letter/underscore followed by alphanumeric/underscore
     *
     * @param {string} expression - Expression to analyze
     * @returns {string} First valid variable name or empty string
     * @private
     */
    extractBasePath(expression) {
        const matches = expression.match(/[a-zA-Z_][a-zA-Z0-9_]*/g);
        return matches ? matches[0] : '';
    }

    /**
     * Parses and creates a map of conditional elements (`data-if`, `data-else-if`, and `data-else`)
     * within the given `rootElement`. Groups related conditional elements and attaches
     * them to the `conditionalGroups` property for dynamic evaluation.
     *
     * This method identifies `data-if`, `data-else-if`, and `data-else` attributes in the DOM and
     * ensures their relationships are correctly established (e.g., ensuring `data-else` elements have
     * preceding `data-if` or `data-else-if` elements). It also handles invalid sequences of attributes
     * and logs warnings for cases where a `data-else` does not follow valid prerequisites.
     *
     * After parsing and grouping, conditional groups are evaluated, and their dependencies
     * are registered for reactive re-evaluation when relevant model paths change.
     *
     * @method parseConditionals
     * @param {Element} rootElement - The root DOM element to scan for conditional attributes.
     * @public
     */
    parseConditionals(rootElement) {

        const nodes = rootElement.querySelectorAll('[data-if],[data-else-if],[data-else]');

        let currentGroup = [];
        const groups = [];

        nodes.forEach(node => {
            if (node.hasAttribute('data-if')) {

                if (currentGroup.length) {
                    groups.push(currentGroup);
                }
                currentGroup = [{
                    element: node,
                    type: 'if',
                    expression: node.getAttribute('data-if')
                }];
            } else if (node.hasAttribute('data-else-if')) {

                if (currentGroup.length && this.isAdjacentNode(currentGroup[currentGroup.length - 1].element, node)) {
                    currentGroup.push({
                        element: node,
                        type: 'else-if',
                        expression: node.getAttribute('data-else-if')
                    });
                } else {

                    if (currentGroup.length) {
                        groups.push(currentGroup);
                    }
                    currentGroup = [{
                        element: node,
                        type: 'if',
                        expression: node.getAttribute('data-else-if')
                    }];
                }
            } else if (node.hasAttribute('data-else')) {

                if (currentGroup.length && this.isAdjacentNode(currentGroup[currentGroup.length - 1].element, node)) {
                    currentGroup.push({
                        element: node,
                        type: 'else',
                        expression: null
                    });

                    groups.push(currentGroup);
                    currentGroup = [];
                } else {

                    console.warn('data-else без предшествующего data-if или data-else-if', node);
                }
            }
        });

        if (currentGroup.length) {
            groups.push(currentGroup);
        }

        this.conditionalGroups = groups;
        groups.forEach(group => this.updateConditionalGroup(group));

        this.setupDependencies(nodes);
    }

    /**
     * Checks if two DOM nodes are adjacent siblings, ignoring whitespace nodes.
     *
     * This method iterates over the sibling nodes of `node1` until it encounters
     * either `node2` (indicating adjacency) or another element node that is not
     * a whitespace text node (indicating they are not adjacent).
     *
     * @param {Node} node1 - The first DOM node.
     * @param {Node} node2 - The second DOM node to check adjacency with.
     * @returns {boolean} `true` if `node2` is an adjacent sibling of `node1`, ignoring whitespace; otherwise `false`.
     * @private
     */
    isAdjacentNode(node1, node2) {

        let current = node1.nextSibling;
        while (current) {
            if (current === node2) return true;
            if (current.nodeType === 1 && !this.isWhitespaceNode(current)) return false;
            current = current.nextSibling;
        }
        return false;
    }

    /**
     * Determines if a given DOM node is a whitespace text node.
     *
     * A whitespace text node is a text node (nodeType === 3)
     * whose content consists only of whitespace characters (spaces, tabs, newlines).
     *
     * @param {Node} node - The DOM node to check.
     * @returns {boolean} `true` if the node is a whitespace text node; otherwise `false`.
     * @private
     */
    isWhitespaceNode(node) {
        return node.nodeType === 3 && node.textContent.trim() === '';
    }

    /**
     * Evaluates and updates the visibility of elements within a group of conditionals.
     *
     * A group represents a logical chain of `data-if`, `data-else-if`, and `data-else` elements.
     * This method determines the first condition in the group that evaluates to `true`
     * and sets the corresponding element to be displayed while hiding others.
     *
     * @param {Array<Object>} group - An array representing a logical group of conditionals.
     * Each object in the array contains:
     *    - {Element} element: The DOM element.
     *    - {string} type: The type of conditional ('if', 'else-if', 'else').
     *    - {string|null} expression: The conditional expression, null for 'else'.
     */
    updateConditionalGroup(group) {

        const context = this.model && this.model.store ?
            {...this.model.store.getState()} :
            this.model && this.model.data ? this.model.data : {};

        let conditionMet = false;

        for (const item of group) {
            if (item.type === 'if' || item.type === 'else-if') {

                const result = !conditionMet && this.evaluateExpression(item.expression, context);

                if (result) {

                    item.element.style.display = '';
                    conditionMet = true;
                } else {

                    item.element.style.display = 'none';
                }
            } else if (item.type === 'else') {

                item.element.style.display = conditionMet ? 'none' : '';
            }
        }
    }

    /**
     * Updates the visibility of DOM elements based on conditional expressions.
     *
     * This method processes groups of elements with `data-if`, `data-else-if`, and `data-else` attributes,
     * updating their visibility based on the evaluation of corresponding expressions.
     *
     * It also sets up dependencies between variables used in the expressions and their corresponding DOM elements,
     * allowing for dynamic updates when the context or variables change.
     *
     * This functionality is used to implement conditional rendering in the DOM.
     *
     * @param {Element} element - The DOM element to update.
     * @param {string} expression - The conditional expression to evaluate.
     * Nodes are expected to contain attributes like `data-if`, `data-else-if`, or `data-else`.
     */
    updateConditional(element, expression) {

        const group = this.findGroupForElement(element);
        if (group) {
            this.updateConditionalGroup(group);
        } else {

            const context = this.model && this.model.store ?
                {...this.model.store.getState()} :
                this.model && this.model.data ? this.model.data : {};

            const result = this.evaluateExpression(expression, context);
            element.style.display = result ? '' : 'none';
        }
    }

    /**
     * Finds and returns the group of conditional elements that contains the specified element.
     *
     * This method searches through the existing groups of conditional elements to determine
     * the group where the given element belongs. Each group represents a logical chain of
     * `data-if`, `data-else-if`, and `data-else` elements.
     *
     * @param {Element} element - The DOM element to find the group for.
     * @returns {Array<Object>|null} The group containing the specified element, or `null` if not found.
     * Each group object comprises:
     *    - {Element} element: The DOM element.
     *    - {string} type: The type of conditional ('if', 'else-if', 'else').
     *    - {string|null} expression: The conditional expression, null for 'else'.
     */
    findGroupForElement(element) {

        for (const group of this.conditionalGroups || []) {
            if (group.some(item => item.element === element)) {
                return group;
            }
        }
        return null;
    }

    /**
     * Sets up and configures the dependencies for the provided DOM nodes.
     *
     * This method scans through the given list of nodes and determines
     * which variables are referenced in their conditional expressions (`data-if`, `data-else-if`).
     * It maps these variables to the corresponding DOM elements, building a dependency tree
     * that allows tracking of changes and their impact on the visibility of elements.
     *
     * @param {NodeList|Array<Element>} nodes - The list of DOM elements to process.
     */
    setupDependencies(nodes) {
        this.dependencies = new Map();

        nodes.forEach(element => {
            let expression;

            if (element.hasAttribute('data-if')) {
                expression = element.getAttribute('data-if');
            } else if (element.hasAttribute('data-else-if')) {
                expression = element.getAttribute('data-else-if');
            } else {
                return;
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

    /**
     * Extracts variables from a given expression string.
     *
     * This method parses the expression and returns a list of variable names that are used
     * in the expression. The variables are determined based on alphanumeric and underscore
     * naming conventions, excluding JavaScript reserved keywords and primitive constants.
     *
     * @param {string} expression - The expression string to extract variables from.
     * @returns {Array<string>} An array of unique variable names found in the expression.
     * Variables are returned in their base form (i.e., the part before any dot notation or brackets).
     */
    extractVariables(expression) {
        const variables = [];

        // Удаляем строковые литералы, чтобы не извлекать переменные из них
        const cleanExpr = expression
            .replace(/'[^']*'/g, "''")
            .replace(/"[^"]*"/g, '""');

        // Находим потенциальные переменные
        const matches = cleanExpr.match(/[a-zA-Z_][a-zA-Z0-9_]*(\.([a-zA-Z_][a-zA-Z0-9_]*))*(\[\d+\])*/g);

        if (matches) {
            matches.forEach(match => {
                // Извлекаем базовое имя переменной (до точки или скобки)
                const baseName = match.split('.')[0].split('[')[0].trim();

                // Проверяем, что это не JavaScript ключевое слово или литерал
                if (!['true', 'false', 'null', 'undefined'].includes(baseName)) {
                    if (!variables.includes(baseName)) {
                        variables.push(baseName);
                    }
                }
            });
        }

        return variables;
    }

    /**
     * Retrieves all dependencies related to a specific path.
     *
     * This method scans through the dependencies map and collects all elements and their details
     * that are associated with the given path. It also includes dependencies that match the base
     * path and/or any sub-paths (e.g., 'path' and 'path.sub').
     *
     * @param {string} path - The path of the dependency to look for.
     * @returns {Array<Object>} An array of dependency objects containing:
     *    - {Element} element: The DOM element associated with the dependency.
     *    - {string} expression: The original conditional expression linked to the dependency.
     *    - {string} type: The type of the conditional ('if' or 'else-if').
     */
    getDependenciesByPath(path) {
        const result = [];

        this.dependencies.forEach((deps, variable) => {
            if (variable === path || path.startsWith(variable + '.')) {
                result.push(...deps);
            }
        });

        return result;
    }

    /**
     * Evaluates a given expression within a specific context.
     *
     * This method can handle three types of input:
     * 1. Expressions wrapped in double curly braces (`{{ }}`) are treated as
     *    context paths and their values are retrieved using the `getValueFromContext` method.
     * 2. Ternary, logical, and comparison operations within the expression
     *    are parsed and evaluated using the `parseExpression` method.
     * 3. Literal or primitive values (e.g., numbers, strings, booleans) are directly returned.
     *
     * Any parsing or evaluation errors are caught and logged.
     *
     * @param {string} expression - The expression to evaluate.
     * @param {Object} context - The object representing the evaluation context.
     * @returns {*} The result of evaluating the expression. Returns `false` if an error occurs.
     */
    evaluateExpression(expression, context) {
        try {

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

    /**
     * Retrieves a value from a given context object based on a dot-separated path.
     *
     * This method allows accessing nested properties or array elements from an object
     * using a path string. If a part of the path references an array, you can include
     * an array index (e.g., 'path.toArray[0]'). If the path is invalid or the property
     * doesn't exist, the method will return undefined.
     *
     * @param {Object} obj - The context object to retrieve values from.
     * @param {string} path - The dot-separated string representing the path to the value.
     * @returns {*} The value located at the specified path, or undefined if not found.
     */
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

    /**
     * Parses and evaluates a given expression within a provided context.
     *
     * This method handles several types of expressions, including:
     * 1. Ternary expressions (`condition ? trueValue : falseValue`).
     * 2. Logical expressions with `&&` (AND) and `||` (OR).
     * 3. Comparison expressions (e.g., `===`, `!==`, `>`, `<`, `>=`, `<=`).
     * 4. String literals inside single or double quotes.
     * 5. Numeric literals (integers and floats).
     * 6. Boolean literals (`true`, `false`), and `null`, `undefined`.
     * 7. Context-based values, retrieved using the `getValueFromContext` method if the expression
     *    is not a primitive value or an operation.
     *
     * The method uses recursion to parse and evaluate nested expressions.
     *
     * @param {string} expression - The expression to parse and evaluate.
     * @param {Object} context - The object providing the evaluation context.
     * @returns {*} The evaluated result of the expression, or `undefined` if the path does not exist in the context.
     */
    parseExpression(expression, context) {
        expression = expression.trim();

        const ternaryMatch = expression.match(/(.+?)\s*\?\s*(.+?)\s*:\s*(.+)/);
        if (ternaryMatch) {
            const [_, condition, trueExpr, falseExpr] = ternaryMatch;
            return this.parseExpression(condition, context)
                ? this.parseExpression(trueExpr, context)
                : this.parseExpression(falseExpr, context);
        }

        if (expression.includes('&&')) {
            const parts = expression.split('&&');
            return parts.every(part => this.parseExpression(part.trim(), context));
        }

        if (expression.includes('||')) {
            const parts = expression.split('||');
            return parts.some(part => this.parseExpression(part.trim(), context));
        }

        const comparisonMatch = expression.match(/(.+?)\s*(===|==|!==|!=|>=|<=|>|<)\s*(.+)/);
        if (comparisonMatch) {
            const [_, left, operator, right] = comparisonMatch;
            const leftValue = this.parseExpression(left.trim(), context);
            const rightValue = this.parseExpression(right.trim(), context);

            switch (operator) {
                case '==':
                    return leftValue == rightValue;
                case '===':
                    return leftValue === rightValue;
                case '!=':
                    return leftValue != rightValue;
                case '!==':
                    return leftValue !== rightValue;
                case '>':
                    return leftValue > rightValue;
                case '<':
                    return leftValue < rightValue;
                case '>=':
                    return leftValue >= rightValue;
                case '<=':
                    return leftValue <= rightValue;
            }
        }

        if ((expression.startsWith("'") && expression.endsWith("'")) ||
            (expression.startsWith('"') && expression.endsWith('"'))) {
            return expression.substring(1, expression.length - 1);
        }

        if (/^-?\d+(\.\d+)?$/.test(expression)) {
            return parseFloat(expression);
        }

        if (expression === 'true') return true;
        if (expression === 'false') return false;
        if (expression === 'null') return null;
        if (expression === 'undefined') return undefined;

        return this.getValueFromContext(context, expression);
    }

    /**
     * Cleans up the instance by clearing dependencies and resetting conditional groups.
     *
     * This method should be called to release resources and avoid memory leaks when
     * the instance of the class is no longer required.
     */
    destroy() {
        this.dependencies.clear();
        this.conditionalGroups = [];
    }
}