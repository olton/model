/**
 * Extracts unique variable names from a given expression.
 *
 * This function uses a regular expression to find all identifiers
 * in the provided expression. It returns a list of unique variable
 * names, including nested properties (e.g., `obj.prop`).
 *
 * @param {string} expression - The expression to extract variables from.
 * @returns {string[]} An array of unique variable names found in the expression.
 */
export const extractVariables = (expression) => {
    const matches = expression.match(/\b[a-zA-Z_]\w*(?:\.[a-zA-Z_]\w*)*\b/g) || [];
    return [...new Set(matches)];
}

/**
 * Evaluates a JavaScript expression within the provided context.
 *
 * This function creates a new Function instance, injecting the context variables
 * into the function as arguments, and evaluates the given expression. The result
 * of the evaluation is returned. If an error occurs during the evaluation, it is
 * logged to the console, and `false` is returned.
 *
 * @param {string} expression - The JavaScript expression to evaluate.
 * @param {Object} context - An object representing the variables to be used in the expression.
 * @returns {*} The evaluated result of the expression, or `false` if an error occurs.
 */
export const evaluateExpression = (expression, context) => {
    try {
        const func = new Function(...Object.keys(context), `return ${expression}`);
        return func(...Object.values(context));
    } catch (error) {
        console.error('Ошибка при вычислении выражения:', error);
        return false;
    }
}
