// src/dom/loop-manager.js
export default class LoopManager {
    constructor(domManager, model) {
        this.domManager = domManager;
        this.model = model;
        this.loops = new Map();
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
    }

    // Обновление всех циклов
    updateLoops(arrayPath, value) {
        this.loops.forEach((loopInfo, element) => {
            if (loopInfo.arrayPath === arrayPath) {
                this.updateLoop(element);
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