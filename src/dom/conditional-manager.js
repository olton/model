export default class ConditionalManager {
    constructor(domManager, model) {
        this.domManager = domManager;
        this.model = model;
        this.virtualDom = new Map();
    }

    // Парсим DOM для поиска условных выражений
    parseConditionals(rootElement) {
        const conditionalElements = rootElement.querySelectorAll('[data-if]');

        conditionalElements.forEach((element) => {
            const expression = element.getAttribute('data-if').trim();

            // Сохраняем оригинальное значение display
            element.__originalDisplay =
                element.style.display === 'none' ? '' : element.style.display;

            // Регистрируем зависимости
            const variables = this.extractVariables(expression);
            variables.forEach(variable => {
                this.domManager.registerDomDependency(variable, element, {
                    type: 'conditional',
                    expression: expression
                });
            });

            // Начальное обновление
            this.updateConditional(element, expression);
        });
    }

    // Обновление условного выражения
    updateConditional(element, expression) {
        // Получаем текущее состояние
        const currentState = this.virtualDom.get(element);

        // Вычисляем новое состояние
        const context = {...this.model.store.getState()};
        const result = this.evaluateExpression(expression, context);

        // Обновляем DOM только при изменении состояния
        if (currentState !== result) {
            element.style.display = result ?
                (element.__originalDisplay || '') : 'none';
            this.virtualDom.set(element, result);
        }
    }

    // Парсим DOM для поиска атрибутов с привязками
    parseAttributes(rootElement) {
        const elements = rootElement.querySelectorAll('[data-bind]');

        elements.forEach(element => {
            const bindingExpression = element.getAttribute('data-bind');

            try {
                const bindings = JSON.parse(bindingExpression.replace(/'/g, '"'));

                for (const [attributeName, expression] of Object.entries(bindings)) {
                    // Извлекаем переменные из выражения
                    const variables = this.extractVariables(expression);

                    // Регистрируем зависимости
                    variables.forEach(variable => {
                        this.domManager.registerDomDependency(variable, element, {
                            type: 'attribute',
                            attribute: attributeName,
                            expression: expression
                        });
                    });

                    // Начальное обновление атрибута
                    this.updateAttribute(element, attributeName, expression);
                }
            } catch (error) {
                console.error('Ошибка разбора привязок атрибутов:', error);
            }
        });
    }

    // Метод для обновления атрибута на основе выражения
    updateAttribute(element, attributeName, expression) {
        // Вычисляем значение выражения
        const context = {...this.model.store.getState()};
        let value;

        if (expression.startsWith('{{') && expression.endsWith('}}')) {
            // Если это шаблон {{выражение}}
            const path = expression.substring(2, expression.length - 2).trim();
            value = this.model.store.get(path);
        } else {
            // Если это JavaScript выражение
            value = this.evaluateExpression(expression, context);
        }

        // Запоминаем предыдущее значение для предотвращения лишних обновлений DOM
        const previousValue = element.getAttribute(attributeName);

        // Обновляем атрибут только если значение изменилось
        if (String(value) !== previousValue) {
            // Особая обработка для boolean-атрибутов
            if (value === false || value === null || value === undefined) {
                element.removeAttribute(attributeName);
            } else if (value === true) {
                element.setAttribute(attributeName, '');
            } else {
                element.setAttribute(attributeName, String(value));
            }
        }
    }

    // Вспомогательный метод для извлечения переменных из выражения
    extractVariables(expression) {
        const matches = expression.match(/\b[a-zA-Z_]\w*(?:\.[a-zA-Z_]\w*)*\b/g) || [];
        return [...new Set(matches)];
    }

    // Метод для оценки выражения
    evaluateExpression(expression, context) {
        try {
            const func = new Function(...Object.keys(context), `return ${expression}`);
            return func(...Object.values(context));
        } catch (error) {
            console.error('Ошибка при вычислении выражения:', error);
            return false;
        }
    }
    
    // Освобождение ресурсов
    destroy() {
        this.virtualDom.clear();
    }
}