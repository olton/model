// src/dom/loop-manager.js
export default class LoopManager {
    constructor(domManager, model) {
        this.domManager = domManager;
        this.model = model;
        this.loops = new Map();
        this.loopsIn = []
    }

    // Парсинг циклов в DOM (data-for)
    parseLoops(rootElement) {
        const loopElements = rootElement.querySelectorAll('[data-for]');

        loopElements.forEach((element) => {
            const expression = element.getAttribute('data-for').trim();
            const matches = expression.match(/^\s*(\w+)(?:\s*,\s*(\w+))?\s+in\s+(\w+(?:\.\w+)*)\s*$/);

            if (!matches) {
                console.error('Некорректный формат выражения data-for:', expression);
                return;
            }

            const [_, itemName, indexName, arrayPath] = matches;
            const array = this.model.store.get(arrayPath);

            if (!Array.isArray(array)) {
                console.error(`Значение по пути ${arrayPath} не является массивом:`, array);
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

            // Регистрируем зависимость для обновления цикла
            this.domManager.registerDomDependency(arrayPath, element, {
                type: 'loop',
                arrayPath
            });

            this.updateLoop(element);
        });

        // Добавляем обработку data-in
        const inLoops = rootElement.querySelectorAll('[data-in]');
        inLoops.forEach(element => {
            const attributeValue = element.getAttribute('data-in');
            const match = attributeValue.match(/^\s*(\w+)\s+in\s+(\S+)\s*$/);

            if (!match) {
                console.error(`Invalid data-in syntax: ${attributeValue}`);
                return;
            }

            const [_, keyVar, objectPath] = match;

            // Сохраняем шаблон
            const template = element.innerHTML;
            const parent = element.parentNode;
            const placeholder = document.createComment(`data-in: ${attributeValue}`);

            // Скрываем оригинальный элемент
            element.style.display = 'none';
            parent.insertBefore(placeholder, element);

            // Сохраняем информацию для обновления
            this.loopsIn.push({
                type: 'in', // тип цикла - объект
                originalElement: element,
                template,
                placeholder,
                objectPath,
                keyVar,
                elements: [] // элементы, сгенерированные для свойств объекта
            });

            // Генерируем элементы при первом рендеринге
            const objectData = this.model.store.get(objectPath);
            if (objectData && typeof objectData === 'object' && !Array.isArray(objectData)) {
                this.updateInLoop(this.loopsIn[this.loopsIn.length - 1], objectData);
            }
        });
    }

    updateInLoop(loop, objectData) {
        // Очищаем предыдущие элементы
        loop.elements.forEach(el => el.remove());
        loop.elements = [];

        // Если данных нет или это не объект, не создаем элементы
        if (!objectData || typeof objectData !== 'object' || Array.isArray(objectData)) {
            return;
        }

        // Обходим свойства объекта и создаем элементы
        Object.keys(objectData).forEach(key => {
            // Создаем новый элемент на основе шаблона
            const newElement = loop.originalElement.cloneNode(true);
            newElement.removeAttribute('data-in');
            newElement.style.display = '';

            // Создаем контекст для данного ключа
            const itemContext = {
                [loop.keyVar]: key,
            };
            
            // Заполняем шаблон значениями
            newElement.innerHTML = this.processTemplate(loop.template, objectData, key, itemContext);

            // Добавляем элемент в DOM
            loop.placeholder.parentNode.insertBefore(newElement, loop.placeholder.nextSibling);

            // Сохраняем созданный элемент
            loop.elements.push(newElement);

            // Обрабатываем вложенные директивы
            this.domManager.bindDOM(newElement);
        });
    }

    processTemplate(template, objectData, key, itemContext) {
        return template.replace(/\{\{\s*([^}]+)\s*\}\}/g, (match, path) => {
            path = path.trim();
            const keyVar = Object.keys(itemContext)[0];

            // Случай 1: Если путь точно равен имени переменной ключа
            if (path === keyVar) {
                return key;
            }

            // Случай 2: Обращение к объекту по ключу (например: objectPath[keyVar])
            const bracketRegex = new RegExp(`(\\w+)\\[${keyVar}\\]`);
            const bracketMatch = path.match(bracketRegex);

            if (bracketMatch) {
                const objName = bracketMatch[1];
                const obj = objectData;

                if (obj && typeof obj === 'object') {
                    return obj[key] !== undefined ? obj[key] : '';
                }
            }

            // Случай 3: Доступ к данным вне цикла
            const value = this.model.store.get(path);
            if (value !== undefined) {
                return value;
            }

            return '';
        });
    }
    
    // Обновление всех циклов
    updateLoops(path, value) {
        this.loops.forEach((loopInfo, element) => {
            if (loopInfo.arrayPath === path) {
                this.updateLoop(element);
            }
        });

        // Добавляем обработку изменения для data-in
        this.loopsIn.forEach(loop => {
            if (loop.type === 'in' && (loop.objectPath === path || path.startsWith(loop.objectPath + '.'))) {
                const objectData = this.model.store.get(loop.objectPath);
                if (objectData && typeof objectData === 'object') {
                    this.updateInLoop(loop, objectData);
                }
            }
        });
    }

    // Обновление конкретного цикла
    updateLoop(element) {
        const loopInfo = this.loops.get(element);
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

        // Удаляем предыдущие сгенерированные элементы
        const generated = parentNode.querySelectorAll(`[data-generated-for="${arrayPath}"]`);
        generated.forEach(el => el.remove());

        // Создаем новые элементы
        array.forEach((item, index) => {
            const newNode = template.cloneNode(true);
            newNode.style.display = '';
            newNode.removeAttribute('data-for');
            newNode.setAttribute('data-generated-for', arrayPath);
            newNode.setAttribute('data-item-index', index);

            // Заменяем переменные в шаблоне
            this.domManager.processTemplateNode(newNode, {
                [itemName]: item,
                [indexName || 'index']: index
            });

            parentNode.insertBefore(newNode, element);
        });

        // Скрываем оригинальный шаблон
        element.style.display = 'none';
    }

    // Обновление части цикла
    updateLoopPart(element, arrayPath, changedValue, changedIndex) {
        const loopInfo = this.loops.get(element);
        if (!loopInfo) return;

        const {template, itemName, indexName, parentNode} = loopInfo;
        const array = this.model.store.get(arrayPath);

        if (!Array.isArray(array)) return;

        // Получаем существующие сгенерированные элементы
        const generated = Array.from(
            parentNode.querySelectorAll(`[data-generated-for="${arrayPath}"]`)
        );

        // Если изменений больше, чем элементов или изменен индекс не указан, обновляем все
        if (changedIndex === undefined || generated.length !== array.length) {
            return this.updateLoop(element);
        }

        // Обновляем только измененный элемент
        const elementToUpdate = generated[changedIndex];
        if (elementToUpdate) {
            // Создаем новый элемент на основе шаблона
            const newNode = template.cloneNode(true);

            // Применяем контекст для нового элемента
            this.domManager.processTemplateNode(newNode, {
                [itemName]: array[changedIndex],
                [indexName || 'index']: changedIndex
            });

            // Заменяем только содержимое, без удаления элемента
            while (elementToUpdate.firstChild) {
                elementToUpdate.removeChild(elementToUpdate.firstChild);
            }

            while (newNode.firstChild) {
                elementToUpdate.appendChild(newNode.firstChild);
            }

            // Копируем атрибуты
            Array.from(newNode.attributes).forEach(attr => {
                elementToUpdate.setAttribute(attr.name, attr.value);
            });
        }
    }

    // Оптимизированный метод для обнаружения изменений в массивах
    detectArrayChanges(newArray, oldArray = []) {
        const changes = {
            added: [],
            removed: [],
            moved: []
        };

        // Находим добавленные и перемещенные элементы
        for (let i = 0; i < newArray.length; i++) {
            const item = newArray[i];
            const oldIndex = oldArray.findIndex(oldItem =>
                JSON.stringify(oldItem) === JSON.stringify(item)
            );

            if (oldIndex === -1) {
                changes.added.push({ index: i, item });
            } else if (oldIndex !== i) {
                changes.moved.push({ oldIndex, newIndex: i, item });
            }
        }

        // Находим удаленные элементы
        for (let i = 0; i < oldArray.length; i++) {
            const item = oldArray[i];
            const newIndex = newArray.findIndex(newItem =>
                JSON.stringify(newItem) === JSON.stringify(item)
            );

            if (newIndex === -1) {
                changes.removed.push({ index: i, item });
            }
        }

        return changes;
    }

    // Получение всех зарегистрированных циклов
    getLoops() {
        return this.loops;
    }

    // Очистка ресурсов
    destroy() {
        this.loops.clear();
    }
}