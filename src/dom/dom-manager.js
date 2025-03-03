import LoopManager from "./loop-manager.js";
import ConditionalManager from "./conditional-manager.js";
import AttributeManager from "./attribute-manager.js";

export default class DOMManager {
    constructor(model) {
        this.model = model;
        this.elements = [];
        this.inputs = [];
        this.domDependencies = new Map();
        this.virtualDom = new Map();
        
        this.loopManager = new LoopManager(this, model);
        this.conditionalManager = new ConditionalManager(this, model);
        this.attributeManager = new AttributeManager(this, model);
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

        // Обновляем условные элементы
        const conditionalElements = this.conditionalManager.getDependenciesByPath(propertyPath);
        conditionalElements.forEach(dep => {
            if (dep.type === 'if') {
                this.conditionalManager.updateConditional(dep.element, dep.expression);
            }
        });

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
        updates.conditional.forEach(dep => this.conditionalManager.updateConditional(dep.element, dep.expression));
        updates.attribute.forEach(dep => this.attributeManager.updateAttribute(dep.element, dep.attribute, dep.expression));
        updates.loop.forEach(dep => this.loopManager.updateLoopPart(dep.element, dep.arrayPath, value, dep.index));
    }
    
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
    
    bindDOM(rootElement){
        this.loopManager.parseLoops(rootElement);
        this.conditionalManager.parseConditionals(rootElement);
        this.attributeManager.parseAttributes(rootElement);
        this.parse(rootElement);
        this.updateAllDOM();
    }

    // Добавим метод для валидации и обработки ошибок
    validateModel() {
        const errors = [];
        const warnings = [];

        // Проверяем наличие циклических зависимостей в computed свойствах
        for (const key in this.model.computed) {
            const visited = new Set();
            const cyclePath = this.checkCyclicDependencies(key, visited);
            if (cyclePath) {
                errors.push({
                    type: 'CYCLIC_DEPENDENCY',
                    property: key,
                    message: `Cyclic dependence is found: ${cyclePath.join(' -> ')}`
                });
            }
        }

        // Проверка на невалидные выражения в шаблонах
        this.domDependencies.forEach((deps, path) => {
            if (!this.model.store.isValidPath(path)) {
                warnings.push({
                    type: 'INVALID_PATH',
                    path,
                    message: `Property ${path} used in the template, but does not exist in the model`
                });
            }
        });

        return { errors, warnings };
    }

    // Проверяем наличие циклических зависимостей
    checkCyclicDependencies(key, visited, path = []) {
        if (visited.has(key)) {
            return [...path, key];
        }

        visited.add(key);
        path.push(key);

        const computed = this.model.computed[key];
        if (!computed || !computed.dependencies) {
            return null;
        }

        for (const dep of computed.dependencies) {
            if (dep in this.model.computed) {
                const cyclePath = this.checkCyclicDependencies(dep, new Set(visited), [...path]);
                if (cyclePath) {
                    return cyclePath;
                }
            }
        }

        return null;
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
        
        this.loopManager.destroy();
        this.conditionalManager.destroy();
    }
}