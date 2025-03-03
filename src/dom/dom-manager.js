// src/dom-adapter/dom-adapter.js
import LoopManager from "./loop-manager.js";

export default class DOMManager {
    constructor(model) {
        this.model = model;
        this.elements = [];
        this.inputs = [];
        this.domDependencies = new Map();
        this.virtualDom = new Map();
        // this.loops = new Map();
        
        this.loopManager = new LoopManager(this, model);
    }

    // Регистрация зависимости DOM от свойства
    registerDomDependency(propertyPath, domElement, info) {
        if (!this.domDependencies.has(propertyPath)) {
            this.domDependencies.set(propertyPath, new Set());
        }
        this.domDependencies.get(propertyPath).add({
            element: domElement,
            ...info
        });
    }

    // Парсим DOM для поиска циклов (data-for)
    // parseLoops(rootElement) {
    //     const loopElements = rootElement.querySelectorAll('[data-for]');
    //
    //     loopElements.forEach((element, index) => {
    //         const expression = element.getAttribute('data-for').trim();
    //         const matches = expression.match(/^\s*(\w+)(?:\s*,\s*(\w+))?\s+in\s+(\w+(?:\.\w+)*)\s*$/);
    //
    //         if (!matches) {
    //             console.error('Incorrect format of expression data-for:', expression);
    //             return;
    //         }
    //
    //         const [_, itemName, indexName, arrayPath] = matches;
    //         const array = this.model.store.get(arrayPath);
    //
    //         if (!Array.isArray(array)) {
    //             console.error(`The value in the path ${arrayPath} is not an array:`, array);
    //             return;
    //         }
    //
    //         const template = element.cloneNode(true);
    //
    //         this.loops.set(element, {
    //             template,
    //             itemName,
    //             indexName,
    //             arrayPath,
    //             parentNode: element.parentNode
    //         });
    //
    //         this.updateLoop(element);
    //     });
    // }

    // Обновляем цикл
    // updateLoop(element) {
    //     const loopInfo = this.loops.get(element);
    //     if (!loopInfo) {
    //         console.error('No loop information found for an item');
    //         return;
    //     }
    //
    //     const {template, itemName, indexName, arrayPath, parentNode} = loopInfo;
    //     const array = this.model.store.get(arrayPath);
    //
    //     if (!Array.isArray(array)) {
    //         console.error('The value is not an array:', array);
    //         return;
    //     }
    //
    //     // Удаляем предыдущие сгенерированные элементы
    //     const generated = parentNode.querySelectorAll(`[data-generated-for="${arrayPath}"]`);
    //     generated.forEach(el => el.remove());
    //
    //     // Создаем новые элементы
    //     array.forEach((item, index) => {
    //         const newNode = template.cloneNode(true);
    //         newNode.style.display = '';
    //         newNode.removeAttribute('data-for');
    //         newNode.setAttribute('data-generated-for', arrayPath);
    //
    //         // Заменяем переменные в шаблоне
    //         this.processTemplateNode(newNode, {
    //             [itemName]: item,
    //             [indexName || 'index']: index
    //         });
    //
    //         parentNode.insertBefore(newNode, element);
    //     });
    //
    //     // Скрываем оригинальный шаблон
    //     element.style.display = 'none';
    // }

    // Обработка шаблонных узлов
    processTemplateNode(node, context) {
        if (node.nodeType === Node.TEXT_NODE) {
            const originalText = node.textContent;
            const newText = node.textContent.replace(/\{\{\s*([^}]+)\s*\}\}/g, (match, path) => {
                path = path.trim();
                return context && path in context ? context[path] : this.model.store.get(path);
            });
            if (originalText !== newText) {
                node.textContent = newText;
            }
        } else if (node.nodeType === Node.ELEMENT_NODE) {
            // Обработка дочерних элементов
            Array.from(node.childNodes).forEach(child => {
                this.processTemplateNode(child, context);
            });
        }
    }

    // Парсим DOM для поиска выражений {{ переменная }}
    parse(root) {
        const walker = document.createTreeWalker(
            root,
            NodeFilter.SHOW_TEXT,
            null
        );

        let node;
        const regex = /\{\{\s*([^}]+)\s*\}\}/g;

        while (node = walker.nextNode()) {
            let match;
            const text = node.textContent;
            const originalText = text;

            // Сбрасываем индекс, чтобы проверить все совпадения заново
            regex.lastIndex = 0;

            while ((match = regex.exec(text)) !== null) {
                const propPath = match[1].trim();

                // Регистрируем зависимость
                this.registerDomDependency(propPath, node, {
                    type: 'template',
                    template: originalText
                });

                // Для совместимости с существующим кодом
                this.elements.push({
                    node,
                    propName: propPath,
                    template: originalText
                });
            }

            // Сохраняем начальное состояние в virtualDom
            this.virtualDom.set(node, node.textContent);
        }

        // Находим все input-элементы с атрибутом data-model
        const inputs = root.querySelectorAll('[data-model]');
        inputs.forEach(input => {
            const property = input.getAttribute('data-model');

            // Создаем обработчик и сохраняем на элементе
            const handler = (e) => {
                const value = input.type === 'checkbox' || input.type === 'radio'
                    ? e.target.checked
                    : e.target.value;

                this.model.store.set(property, value);
            };

            // Сохраняем ссылку на обработчик для возможности удаления
            input.__modelInputHandler = handler;

            input.addEventListener('input', handler);

            this.inputs.push({
                element: input,
                property: property
            });
        });
    }

    // Установка значения в input-элемент
    setInputValue(input, value) {
        if (input.type === 'checkbox' || input.type === 'radio') {
            input.checked = Boolean(value);
        } else {
            input.value = value;
        }
    }

    // Обновление значений в input-элементах при изменении данных модели
    updateInputs(propName, value) {
        this.inputs.forEach(item => {
            if (item.property === propName) {
                this.setInputValue(item.element, value);
            }
        });
    }

    // Обновляем элементы DOM, которые нуждаются в этом
    updateAllDOM() {
        // Обновляем все элементы с шаблонами
        this.elements.forEach(element => {
            let newContent = element.template;
            newContent = newContent.replace(/\{\{\s*([^}]+)\s*\}\}/g, (match, path) => {
                path = path.trim();
                return this.model.store.get(path);
            });
            element.node.textContent = newContent;
        });

        // Обновляем все инпуты
        this.inputs.forEach(item => {
            const value = this.model.store.get(item.property);
            this.setInputValue(item.element, value);
        });
    }

    // Обновление DOM при изменении данных
    updateDOM(propertyPath, value) {
        // Проверяем, является ли это объектом изменения из applyArrayMethod
        const isArrayMethodChange = value && typeof value === 'object' && 'method' in value;

        if (isArrayMethodChange) {
            // Используем path из объекта изменения при изменении массива
            propertyPath = value.path || propertyPath;
        }

        // Находим все зависимые элементы - прямые и ассоциированные с родительскими путями
        const elementsToUpdate = new Set();

        // Добавляем прямые совпадения
        if (this.domDependencies.has(propertyPath)) {
            this.domDependencies.get(propertyPath).forEach(dep =>
                elementsToUpdate.add(dep)
            );
        }

        // Добавляем элементы, зависящие от родительского пути
        // Например, если изменяется user.address.city, обновляем зависимости от user и user.address
        const pathParts = propertyPath.split('.');
        let currentPath = '';
        for (let i = 0; i < pathParts.length; i++) {
            currentPath = currentPath ? `${currentPath}.${pathParts[i]}` : pathParts[i];
            if (this.domDependencies.has(currentPath)) {
                this.domDependencies.get(currentPath).forEach(dep =>
                    elementsToUpdate.add(dep)
                );
            }
        }

        // Обновляем элементы, зависящие от дочерних путей
        // Например, если изменяется user, обновляем зависимости от user.name, user.address и т.д.
        this.domDependencies.forEach((deps, path) => {
            if (path.startsWith(`${propertyPath}.`) || path.startsWith(`${propertyPath}[`)) {
                deps.forEach(dep => elementsToUpdate.add(dep));
            }
        });

        // Обновляем циклы для массивов
        if (Array.isArray(value) || isArrayMethodChange) {
            this.loopManager.updateLoops(propertyPath, value);
        }

        if (elementsToUpdate.size === 0) return;

        // Группируем обновления по типу для уменьшения перерисовок
        const updates = {
            template: [],
            conditional: [],
            loop: [],
            attribute: []
        };

        elementsToUpdate.forEach(dep => {
            if (dep && dep.type) {
                updates[dep.type].push(dep);
            }
        });

        // Обрабатываем по группам
        updates.template.forEach(dep => this.updateTemplateNode(dep.element, dep.template));
        updates.conditional.forEach(dep => this.updateConditional(dep.element, dep.expression));
        updates.loop.forEach(dep => this.loopManager.updateLoopPart(dep.element, dep.arrayPath, value, dep.index));
        updates.attribute.forEach(dep => this.updateAttribute(dep.element, dep.attribute, dep.expression));
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
                this.registerDomDependency(variable, element, {
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

    // Обновление части цикла
    // updateLoopPart(element, arrayPath, changedValue, changedIndex) {
    //     const loopInfo = this.loops.get(element);
    //     if (!loopInfo) return;
    //
    //     const {template, itemName, indexName, parentNode} = loopInfo;
    //     const array = this.model.store.get(arrayPath);
    //
    //     if (!Array.isArray(array)) return;
    //
    //     // Получаем существующие сгенерированные элементы
    //     const generated = Array.from(
    //         parentNode.querySelectorAll(`[data-generated-for="${arrayPath}"]`)
    //     );
    //
    //     // Если изменений больше, чем элементов, обновляем все
    //     if (changedIndex === undefined || generated.length !== array.length) {
    //         return this.updateLoop(element);
    //     }
    //
    //     // Обновляем только измененный элемент
    //     const elementToUpdate = generated[changedIndex];
    //     if (elementToUpdate) {
    //         // Создаем новый элемент на основе шаблона
    //         const newNode = template.cloneNode(true);
    //
    //         // Применяем контекст для нового элемента
    //         this.processTemplateNode(newNode, {
    //             [itemName]: array[changedIndex],
    //             [indexName || 'index']: changedIndex
    //         });
    //
    //         // Заменяем только содержимое, без удаления элемента
    //         while (elementToUpdate.firstChild) {
    //             elementToUpdate.removeChild(elementToUpdate.firstChild);
    //         }
    //
    //         while (newNode.firstChild) {
    //             elementToUpdate.appendChild(newNode.firstChild);
    //         }
    //
    //         // Копируем атрибуты
    //         Array.from(newNode.attributes).forEach(attr => {
    //             elementToUpdate.setAttribute(attr.name, attr.value);
    //         });
    //     }
    // }

    // Метод обновления текстового шаблона
    updateTemplateNode(node, template) {
        const newContent = template.replace(/\{\{\s*([^}]+)\s*\}\}/g, (match, path) => {
            path = path.trim();
            return this.model.store.get(path);
        });

        // Обновляем DOM только если содержимое изменилось
        if (this.virtualDom.get(node) !== newContent) {
            node.textContent = newContent;
            this.virtualDom.set(node, newContent);
        }
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
                        this.registerDomDependency(variable, element, {
                            type: 'attribute',
                            attribute: attributeName,
                            expression: expression
                        });
                    });

                    // Начальное обновление атрибута
                    this.updateAttribute(element, attributeName, expression);
                }
            } catch (error) {
                console.error('An error of analysis of attachments:', error);
            }
        });
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
            console.error('Error when evaluating expression:', error);
            return false;
        }
    }

    // Проверяет, зависит ли путь pathB от пути pathA
    isPathDependency(pathA, pathB) {
        return pathB === pathA ||
            pathB.startsWith(`${pathA}.`) ||
            pathB.startsWith(`${pathA}[`);
    }

    // Находит все зависимые пути
    getDependentPaths(path) {
        const dependentPaths = [];
        this.domDependencies.forEach((_, depPath) => {
            if (this.isPathDependency(path, depPath)) {
                dependentPaths.push(depPath);
            }
        });
        return dependentPaths;
    }

    // Оптимизированный метод для обнаружения изменений в массивах
    // detectArrayChanges(newArray, oldArray = []) {
    //     const changes = {
    //         added: [],
    //         removed: [],
    //         moved: []
    //     };
    //
    //     // Находим добавленные и перемещенные элементы
    //     for (let i = 0; i < newArray.length; i++) {
    //         const item = newArray[i];
    //         const oldIndex = oldArray.findIndex(oldItem =>
    //             JSON.stringify(oldItem) === JSON.stringify(item)
    //         );
    //
    //         if (oldIndex === -1) {
    //             changes.added.push({ index: i, item });
    //         } else if (oldIndex !== i) {
    //             changes.moved.push({ oldIndex, newIndex: i, item });
    //         }
    //     }
    //
    //     // Находим удаленные элементы
    //     for (let i = 0; i < oldArray.length; i++) {
    //         const item = oldArray[i];
    //         const newIndex = newArray.findIndex(newItem =>
    //             JSON.stringify(newItem) === JSON.stringify(item)
    //         );
    //
    //         if (newIndex === -1) {
    //             changes.removed.push({ index: i, item });
    //         }
    //     }
    //
    //     return changes;
    // }

    bindDOM(rootElement){
        this.loopManager.parseLoops(rootElement);
        this.parseConditionals(rootElement);
        this.parseAttributes(rootElement);
        this.parse(rootElement);
        this.updateAllDOM();
    }
    
    // Освобождение ресурсов
    destroy() {
        // Удаляем обработчики событий с инпутов
        this.inputs.forEach(({ element }) => {
            if (element.__modelInputHandler) {
                element.removeEventListener('input', element.__modelInputHandler);
                delete element.__modelInputHandler;
            }
        });

        // Очищаем все коллекции
        this.elements = [];
        this.inputs = [];
        this.domDependencies.clear();
        this.virtualDom.clear();
        // this.loops.clear();
    }
}