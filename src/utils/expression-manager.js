export default class ExpressionManager {
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
    static evaluateExpression(expression, context) {
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
    static getValueFromContext(obj, path) {
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
    static parseExpression(expression, context) {
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
     * Extracts variables from a given expression string.
     *
     * This method parses the expression and returns a list of variable names that are used
     * in the expression. The variables are determined based on alphanumeric and underscore
     * naming conventions, excluding JavaScript reserved keywords and primitive constants.
     *
     * @param {string} expression - The expression string to extract variables from.
     * @returns {Array<string>} An array of unique variable names found in the expression.
     * Variables are returned in their base form (in other words, the part before any dot notation or brackets).
     */
    static extractVariables(expression) {
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
}