// src/dom/loop-manager.js
export default class LoopManager {
    constructor(domManager, model) {
        this.domManager = domManager;
        this.model = model;
        this.loops = new Map();
        this.loopsIn = []
    }

    // Parsing loops in the DOM (data-for)
    parseLoops(rootElement) {
        const loopElements = rootElement.querySelectorAll('[data-for]');

        loopElements.forEach((element) => {
            const expression = element.getAttribute('data-for').trim();
            const matches = expression.match(/^\s*(\w+)(?:\s*,\s*(\w+))?\s+in\s+(\w+(?:\.\w+)*)\s*$/);

            if (!matches) {
                console.error('Invalid expression format data-for:', expression);
                return;
            }

            const [_, itemName, indexName, arrayPath] = matches;
            const array = this.model.store.get(arrayPath);

            if (!Array.isArray(array)) {
                console.error(`The value in the ${arrayPath} path is not an array:`, array);
                return;
            }

            const template = element.cloneNode(true);

            this.loops.set(element, {
                template,
                itemName,
                indexName,
                arrayPath,
                parentNode: element.parentNode
            });

            // Registering a dependency to update the loop
            this.domManager.registerDomDependency(arrayPath, element, {
                type: 'loop',
                arrayPath
            });

            this.updateLoop(element);
        });

        // Adding data-in processing
        const inLoops = rootElement.querySelectorAll('[data-in]');
        inLoops.forEach(element => {
            const attributeValue = element.getAttribute('data-in');
            const match = attributeValue.match(/^\s*(\w+)\s+in\s+(\S+)\s*$/);

            if (!match) {
                console.error(`Invalid data-in syntax: ${attributeValue}`);
                return;
            }

            const [_, keyVar, objectPath] = match;

            const template = element.innerHTML;
            const parent = element.parentNode;
            const placeholder = document.createComment(`data-in: ${attributeValue}`);

            element.style.display = 'none';
            parent.insertBefore(placeholder, element);

            this.loopsIn.push({
                type: 'in', // тип цикла - объект
                originalElement: element,
                template,
                placeholder,
                objectPath,
                keyVar,
                elements: [] // elements generated for object properties
            });

            const objectData = this.model.store.get(objectPath);
            if (objectData && typeof objectData === 'object' && !Array.isArray(objectData)) {
                this.updateInLoop(this.loopsIn[this.loopsIn.length - 1], objectData);
            }
        });
    }

    // Update loops for objects
    updateInLoop(loop, objectData) {
        loop.elements.forEach(el => el.remove());
        loop.elements = [];

        // If there is no data or it is not an object, do not create elements
        if (!objectData || typeof objectData !== 'object' || Array.isArray(objectData)) {
            return;
        }

        // Traverse the properties of the object and create the
        Object.keys(objectData).forEach(key => {
            const newElement = loop.originalElement.cloneNode(true);
            newElement.removeAttribute('data-in');
            newElement.style.display = '';

            const itemContext = {
                [loop.keyVar]: key,
            };
            
            newElement.innerHTML = this.processTemplate(loop.template, objectData, key, itemContext);

            loop.placeholder.parentNode.insertBefore(newElement, loop.placeholder.nextSibling);

            loop.elements.push(newElement);

            this.domManager.bindDOM(newElement);
        });
    }

    processTemplate(template, objectData, key, itemContext) {
        return template.replace(/\{\{\s*([^}]+)\s*\}\}/g, (match, path) => {
            path = path.trim();
            const keyVar = Object.keys(itemContext)[0];

            if (path === keyVar) {
                return key;
            }

            const bracketRegex = new RegExp(`(\\w+)\\[${keyVar}\\]`);
            const bracketMatch = path.match(bracketRegex);

            if (bracketMatch) {
                const objName = bracketMatch[1];
                const obj = objectData;

                if (obj && typeof obj === 'object') {
                    return obj[key] !== undefined ? obj[key] : '';
                }
            }

            const value = this.model.store.get(path);
            if (value !== undefined) {
                return value;
            }

            return '';
        });
    }
    
    updateLoops(path, value) {
        // data-for
        this.loops.forEach((loopInfo, element) => {
            if (loopInfo.arrayPath === path) {
                this.updateLoop(element);
            }
        });

        // data-in
        this.loopsIn.forEach(loop => {
            if (loop.type === 'in' && (loop.objectPath === path || path.startsWith(loop.objectPath + '.'))) {
                const objectData = this.model.store.get(loop.objectPath);
                if (objectData && typeof objectData === 'object') {
                    this.updateInLoop(loop, objectData);
                }
            }
        });
    }

    updateLoop(element) {
        const loopInfo = this.loops.get(element) || this.loopsIn.find(loop => loop.originalElement === element)[0];
        
        if (!loopInfo) {
            console.error('Информация о цикле не найдена для элемента');
            return;
        }

        const {template, itemName, indexName, arrayPath, parentNode} = loopInfo;
        const array = this.model.store.get(arrayPath);

        if (!Array.isArray(array)) {
            console.error('Значение не является массивом:', array);
            return;
        }

        const generated = parentNode.querySelectorAll(`[data-generated-for="${arrayPath}"]`);
        generated.forEach(el => el.remove());

        array.forEach((item, index) => {
            const newNode = template.cloneNode(true);
            newNode.style.display = '';
            newNode.removeAttribute('data-for');
            newNode.setAttribute('data-generated-for', arrayPath);
            newNode.setAttribute('data-item-index', index);

            this.domManager.processTemplateNode(newNode, {
                [itemName]: item,
                [indexName || 'index']: index
            });

            parentNode.insertBefore(newNode, element);
        });

        element.style.display = 'none';
    }

    updateLoopPart(element, arrayPath, changedValue, changedIndex) {
        const loopInfo = this.loops.get(element);
        if (!loopInfo) return;

        const {template, itemName, indexName, parentNode} = loopInfo;
        const array = this.model.store.get(arrayPath);

        if (!Array.isArray(array)) return;

        const generated = Array.from(
            parentNode.querySelectorAll(`[data-generated-for="${arrayPath}"]`)
        );

        if (changedIndex === undefined || generated.length !== array.length) {
            return this.updateLoop(element);
        }

        const elementToUpdate = generated[changedIndex];
        if (elementToUpdate) {
            const newNode = template.cloneNode(true);

            this.domManager.processTemplateNode(newNode, {
                [itemName]: array[changedIndex],
                [indexName || 'index']: changedIndex
            });

            while (elementToUpdate.firstChild) {
                elementToUpdate.removeChild(elementToUpdate.firstChild);
            }

            while (newNode.firstChild) {
                elementToUpdate.appendChild(newNode.firstChild);
            }

            Array.from(newNode.attributes).forEach(attr => {
                elementToUpdate.setAttribute(attr.name, attr.value);
            });
        }
    }
    
    getLoops() {
        return {
            "for": this.loops,
            "in": this.loopsIn
        }
    }

    destroy() {
        this.loops.clear();
    }
}