import {evaluateExpression, extractVariables} from "../utils/expression.js";

export default class AttributeManager {
    constructor(dom, model) {
        this.domManager = dom;
        this.model = model;
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
                    const variables = extractVariables(expression);

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
            value = evaluateExpression(expression, context);
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

}