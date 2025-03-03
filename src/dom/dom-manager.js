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

    // Registration Dependencies DOM on Properties
    registerDomDependency(propertyPath, domElement, info) {
        if (!this.domDependencies.has(propertyPath)) {
            this.domDependencies.set(propertyPath, new Set());
        }
        this.domDependencies.get(propertyPath).add({
            element: domElement,
            ...info
        });
    }
    
    // Processes template adverbs
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
            // Processing of subsidiary elements
            Array.from(node.childNodes).forEach(child => {
                this.processTemplateNode(child, context);
            });
        }
    }

    // Parsim DOM to search for expressions {{variable}}
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

                // We register the dependence
                this.registerDomDependency(propPath, node, {
                    type: 'template',
                    template: originalText
                });

                // For compatibility with existing code
                this.elements.push({
                    node,
                    propName: propPath,
                    template: originalText
                });
            }

            // We keep the initial state in Virtualdom
            this.virtualDom.set(node, node.textContent);
        }

        // We find all Input elements with the Data-Model attribute
        const inputs = root.querySelectorAll('[data-model]');
        inputs.forEach(input => {
            const property = input.getAttribute('data-model');

            // Create a handler and save on an element
            const handler = (e) => {
                const value = input.type === 'checkbox' || input.type === 'radio'
                    ? e.target.checked
                    : e.target.value;

                this.model.store.set(property, value);
            };

            // We keep a link to the handle for the possibility of removing
            input.__modelInputHandler = handler;

            input.addEventListener('input', handler);

            this.inputs.push({
                element: input,
                property: property
            });
        });
    }

    // Setting the value in the Input element
    setInputValue(input, value) {
        if (input.type === 'checkbox' || input.type === 'radio') {
            input.checked = Boolean(value);
        } else {
            input.value = value;
        }
    }

    // Updating values in Input-elements when changing these models
    updateInputs(propName, value) {
        this.inputs.forEach(item => {
            if (item.property === propName) {
                this.setInputValue(item.element, value);
            }
        });
    }

    // We update the DOM elements that need this
    updateAllDOM() {
        // Update all the elements with templates
        this.elements.forEach(element => {
            let newContent = element.template;
            newContent = newContent.replace(/\{\{\s*([^}]+)\s*\}\}/g, (match, path) => {
                path = path.trim();
                return this.model.store.get(path);
            });
            element.node.textContent = newContent;
        });

        // We update all the inputs
        this.inputs.forEach(item => {
            const value = this.model.store.get(item.property);
            this.setInputValue(item.element, value);
        });
    }

    // DOM update when changing data
    updateDOM(propertyPath, value) {
        // We check whether this is an object of change from ApplyarrayMethod
        const isArrayMethodChange = value && typeof value === 'object' && 'method' in value;

        if (isArrayMethodChange) {
            // We use PATH from the object of change when changing the array
            propertyPath = value.path || propertyPath;
        }

        // We find all dependent elements - direct and associated with parental ways
        const elementsToUpdate = new Set();

        // Добавляем прямые совпадения
        if (this.domDependencies.has(propertyPath)) {
            this.domDependencies.get(propertyPath).forEach(dep =>
                elementsToUpdate.add(dep)
            );
            // const deps = this.domDependencies.get(propertyPath);
            // for (const { element, meta } of deps) {
            //     console.log(element, meta);
            //     // Обрабатываем разные типы зависимостей
            //     if (meta && meta.type) { 
            //         switch (meta.type) {
            //             case 'attribute':
            //                 // Обработка атрибутов
            //                 // this.updateElementAttribute(element, meta.attribute, meta.expression);
            //                 break;
            //         }
            //     }
            // }
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
        if (Array.isArray(value) || isArrayMethodChange || typeof value === 'object') {
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

    parseAttributeBindings(rootElement) {
        // Получаем все элементы внутри rootElement
        const allElements = rootElement.querySelectorAll('*');

        // Обходим все элементы
        for (const element of allElements) {
            // Получаем все атрибуты элемента
            const attributes = element.attributes;

            for (let i = 0; i < attributes.length; i++) {
                const attr = attributes[i];

                // Проверяем, начинается ли имя атрибута с двоеточия (:)
                if (attr.name.startsWith(':')) {
                    // Получаем реальное имя атрибута (без двоеточия)
                    const realAttrName = attr.name.substring(1);

                    // Получаем выражение из значения атрибута
                    const expression = attr.value;

                    // Устанавливаем начальное значение атрибута
                    this.updateElementAttribute(element, realAttrName, expression);

                    // Регистрируем зависимость для обновления атрибута при изменении данных
                    this.registerDomDependency(expression, element, {
                        type: 'attribute',
                        attribute: realAttrName,
                        expression: expression
                    });

                    // Удаляем директиву :attribute
                    element.removeAttribute(attr.name);
                }
            }
        }
    }

    // Метод для обновления атрибута элемента
    updateElementAttribute(element, attribute, expression) {
        const value = this.model.store.get(expression);

        if (value !== undefined) {
            // Обрабатываем особые случаи для некоторых атрибутов
            if (attribute === 'class') {
                element.className = value;
            } else if (attribute === 'disabled' ||
                attribute === 'checked' ||
                attribute === 'selected' ||
                attribute === 'readonly') {
                // Булевы атрибуты
                if (value) {
                    element.setAttribute(attribute, '');
                } else {
                    element.removeAttribute(attribute);
                }
            } else {
                element.setAttribute(attribute, value);
            }
        } else {
            console.warn(`Значение для ${expression} не найдено в модели`);
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
        this.parseAttributeBindings(rootElement); // Обработка атрибутов (:attribute)
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