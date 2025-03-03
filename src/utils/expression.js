// Вспомогательный метод для извлечения переменных из выражения
export const extractVariables = (expression) => {
    const matches = expression.match(/\b[a-zA-Z_]\w*(?:\.[a-zA-Z_]\w*)*\b/g) || [];
    return [...new Set(matches)];
}

// Метод для оценки выражения
export const evaluateExpression = (expression, context) => {
    try {
        const func = new Function(...Object.keys(context), `return ${expression}`);
        return func(...Object.values(context));
    } catch (error) {
        console.error('Ошибка при вычислении выражения:', error);
        return false;
    }
}
