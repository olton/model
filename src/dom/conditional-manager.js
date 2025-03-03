export default class ConditionalManager {
    constructor(dom, model) {
        this.dom = dom;
        this.model = model;
        this.dependencies = new Map();
        this.conditionalGroups = [];
        
        this.subscribe();
    }

    subscribe() {
        // console.log(this.model.store);
        this.model.store.on('change', (data) => {
            // Обновляем все группы условных директив, зависящие от измененного пути
            const dependentGroups = this.getGroupsByPath(data.path);
            dependentGroups.forEach(group => {
                this.updateConditionalGroup(group);
            });
        });
    }

    // Получение групп, зависящих от указанного пути
    getGroupsByPath(path) {
        const result = new Set();

        this.conditionalGroups.forEach(group => {
            const hasDependency = group.some(item => {
                if (!item.expression) return false;

                // Проверяем, содержит ли выражение указанный путь
                return item.expression.includes(path) ||
                    path.startsWith(this.extractBasePath(item.expression));
            });

            if (hasDependency) {
                result.add(group);
            }
        });

        return Array.from(result);
    }

    // Извлечение базового пути из выражения (например, из "counter > 0" извлекаем "counter")
    extractBasePath(expression) {
        const matches = expression.match(/[a-zA-Z_][a-zA-Z0-9_]*/g);
        return matches ? matches[0] : '';
    }
    
    parseConditionals(rootElement) {
        // Находим все элементы с условными директивами в порядке их следования в DOM
        const nodes = rootElement.querySelectorAll('[data-if],[data-else-if],[data-else]');

        // Группируем связанные условные элементы
        let currentGroup = [];
        const groups = [];

        nodes.forEach(node => {
            if (node.hasAttribute('data-if')) {
                // Если нашли новый data-if, начинаем новую группу
                if (currentGroup.length) {
                    groups.push(currentGroup);
                }
                currentGroup = [{
                    element: node,
                    type: 'if',
                    expression: node.getAttribute('data-if')
                }];
            } else if (node.hasAttribute('data-else-if')) {
                // Проверяем, что это продолжение текущей группы
                if (currentGroup.length && this.isAdjacentNode(currentGroup[currentGroup.length-1].element, node)) {
                    currentGroup.push({
                        element: node,
                        type: 'else-if',
                        expression: node.getAttribute('data-else-if')
                    });
                } else {
                    // Если это не продолжение, начинаем новую группу (обрабатываем как if)
                    if (currentGroup.length) {
                        groups.push(currentGroup);
                    }
                    currentGroup = [{
                        element: node,
                        type: 'if', // Рассматриваем как обычный if
                        expression: node.getAttribute('data-else-if')
                    }];
                }
            } else if (node.hasAttribute('data-else')) {
                // Проверяем, что это продолжение текущей группы
                if (currentGroup.length && this.isAdjacentNode(currentGroup[currentGroup.length-1].element, node)) {
                    currentGroup.push({
                        element: node,
                        type: 'else',
                        expression: null
                    });

                    // else всегда завершает группу
                    groups.push(currentGroup);
                    currentGroup = [];
                } else {
                    // Если это не продолжение, игнорируем (else должен следовать за if/else-if)
                    console.warn('data-else без предшествующего data-if или data-else-if', node);
                }
            }
        });

        // Добавляем последнюю группу, если она есть
        if (currentGroup.length) {
            groups.push(currentGroup);
        }

        // Обновляем каждую группу условных элементов
        this.conditionalGroups = groups;
        groups.forEach(group => this.updateConditionalGroup(group));

        // Настраиваем карту зависимостей
        this.setupDependencies(nodes);
    }

    // Проверяет, являются ли узлы соседними в DOM
    isAdjacentNode(node1, node2) {
        // Проверяем, что node2 идет сразу после node1 или разделен только пробельными узлами
        let current = node1.nextSibling;
        while (current) {
            if (current === node2) return true;
            if (current.nodeType === 1 && !this.isWhitespaceNode(current)) return false;
            current = current.nextSibling;
        }
        return false;
    }

    // Проверяет, является ли узел пробельным
    isWhitespaceNode(node) {
        return node.nodeType === 3 && node.textContent.trim() === '';
    }

    updateConditionalGroup(group) {
        // Получаем состояние из модели безопасным способом
        const context = this.model && this.model.store ?
            {...this.model.store.getState()} :
            this.model && this.model.data ? this.model.data : {};

        let conditionMet = false;

        for (const item of group) {
            if (item.type === 'if' || item.type === 'else-if') {
                // Вычисляем условие только если предыдущие не сработали
                const result = !conditionMet && this.evaluateExpression(item.expression, context);

                if (result) {
                    // Показываем этот элемент
                    item.element.style.display = '';
                    conditionMet = true;
                } else {
                    // Скрываем элемент
                    item.element.style.display = 'none';
                }
            } else if (item.type === 'else') {
                // Показываем else только если ни одно из предыдущих условий не сработало
                item.element.style.display = conditionMet ? 'none' : '';
            }
        }
    }

    updateConditional(element, expression) {
        // Обновляем всю группу, если элемент входит в группу
        const group = this.findGroupForElement(element);
        if (group) {
            this.updateConditionalGroup(group);
        } else {
            // Для одиночных if-элементов
            const context = this.model && this.model.store ?
                {...this.model.store.getState()} :
                this.model && this.model.data ? this.model.data : {};

            const result = this.evaluateExpression(expression, context);
            element.style.display = result ? '' : 'none';
        }
    }

    findGroupForElement(element) {
        // Находим группу, содержащую данный элемент
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
                return; // data-else не имеет выражения
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
        // Простой вариант извлечения переменных из выражения
        // Можно улучшить для сложных выражений
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

    // Безопасная оценка выражений
    evaluateExpression(expression, context) {
        try {
            // Проверка на шаблоны {{path}}
            if (expression.startsWith('{{') && expression.endsWith('}}')) {
                const path = expression.substring(2, expression.length - 2).trim();
                return this.getValueByPath(context, path);
            }

            return this.parseExpression(expression, context);
        } catch (error) {
            console.error('Ошибка при вычислении выражения:', error);
            return false;
        }
    }

    // Получение значения по пути в объекте
    getValueByPath(obj, path) {
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

    // Безопасный парсинг выражений
    parseExpression(expression, context) {
        expression = expression.trim();

        // Обработка тернарного оператора
        const ternaryMatch = expression.match(/(.+?)\s*\?\s*(.+?)\s*:\s*(.+)/);
        if (ternaryMatch) {
            const [_, condition, trueExpr, falseExpr] = ternaryMatch;
            return this.parseExpression(condition, context)
                ? this.parseExpression(trueExpr, context)
                : this.parseExpression(falseExpr, context);
        }

        // Логические операторы
        if (expression.includes('&&')) {
            const parts = expression.split('&&');
            return parts.every(part => this.parseExpression(part.trim(), context));
        }

        if (expression.includes('||')) {
            const parts = expression.split('||');
            return parts.some(part => this.parseExpression(part.trim(), context));
        }

        // Операторы сравнения
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

        // Строковые литералы
        if ((expression.startsWith("'") && expression.endsWith("'")) ||
            (expression.startsWith('"') && expression.endsWith('"'))) {
            return expression.substring(1, expression.length - 1);
        }

        // Числовые литералы
        if (/^-?\d+(\.\d+)?$/.test(expression)) {
            return parseFloat(expression);
        }

        // Булевы литералы и null/undefined
        if (expression === 'true') return true;
        if (expression === 'false') return false;
        if (expression === 'null') return null;
        if (expression === 'undefined') return undefined;

        // Получение значения из контекста
        return this.getValueByPath(context, expression);
    }
    
    destroy() {
        this.dependencies.clear();
        this.conditionalGroups = [];
    }
}