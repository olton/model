import ExpressionManager from "../utils/expression-manager.js";
import Logger from "../logger/logger.js";

/**
 * Manages conditional rendering logic by interpreting custom attributes
 * (for example, `data-if`, `data-else-if`, `data-else`) on DOM elements and updating their visibility.
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
     * @param {Object} model - The data model containing state (for example, `store` or `data`).
     */
    constructor(dom, model) {
        Logger.DEBUG_LEVEL = model.options.debug ? 4 : 0;
        Logger.debug("Init ConditionalManager")

        this.dom = dom;
        this.model = model;
        this.dependencies = new Map();
        this.conditionalGroups = [];

        this.subscribe();
        
        Logger.debug('Model: ConditionalManager initialized');
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
        Logger.debug('ConditionalManager: Subscribe to store changes');
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
     * within the given `rootElement`. Groups related conditional elements and attach 
     * them to the `conditionalGroups` property for dynamic evaluation.
     *
     * This method identifies `data-if`, `data-else-if`, and `data-else` attributes in the DOM and
     * ensures their relationships are correctly established (for example, ensuring `data-else` elements have
     * preceding `data-if` or `data-else-if` elements). It also handles invalid sequences of attributes
     * and logs warnings for cases where a `data-else` doesn't follow valid prerequisites.
     *
     * After parsing and grouping, conditional groups are evaluated, and their dependencies
     * are registered for reactive re-evaluation when relevant model paths change.
     *
     * @method parseConditionals
     * @param {Element} rootElement - The root DOM element to scan for conditional attributes.
     * @public
     */
    parseConditionals(rootElement) {
        Logger.debug('ConditionalManager: Parse conditionals (data-if, data-else-if, data-else)...');
        const nodes = rootElement.querySelectorAll('[data-if],[data-else-if],[data-else]');

        let currentGroup = [];
        const groups = [];

        nodes.forEach(node => {
            if (node.hasAttribute('data-if')) {
                Logger.debug(`Found data-if in element:`, node);
                if (currentGroup.length) {
                    groups.push(currentGroup);
                }
                currentGroup = [{
                    element: node,
                    type: 'if',
                    expression: node.getAttribute('data-if')
                }];
            } else if (node.hasAttribute('data-else-if')) {
                Logger.debug(`Found data-else-if in element:`, node);
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
                Logger.debug(`Found data-else in element:`, node);
                if (currentGroup.length && this.isAdjacentNode(currentGroup[currentGroup.length - 1].element, node)) {
                    currentGroup.push({
                        element: node,
                        type: 'else',
                        expression: null
                    });

                    groups.push(currentGroup);
                    currentGroup = [];
                } else {
                    console.warn('data-else without previous data-if or data-else-if', node);
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
     *    - {HTMLElement} element: The DOM element.
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

                const result = !conditionMet && ExpressionManager.evaluateExpression(item.expression, context);

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
     * @param {HTMLElement} element - The DOM element to update.
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

            const result = ExpressionManager.evaluateExpression(expression, context);
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

            const variables = ExpressionManager.extractVariables(expression);

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
     * Retrieves all dependencies related to a specific path.
     *
     * This method scans through the dependency map and collects all elements and their details
     * that are associated with the given path. It also includes dependencies that match the base
     * path and/or any sub-paths (for example, 'path' and 'path.sub').
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