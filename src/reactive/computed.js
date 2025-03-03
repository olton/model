import Logger from "../dev/logger.js";

export default class ComputedProps {
    constructor(model, computed = {}) {
        this.model = model;
        this.computed = computed;
        this.store = model.store;
    }

    // Добавьте этот метод для инициализации обчислюваемых свойств
    init() {
        for (const key in this.computed) {
            // Вычисляем начальное значение
            this.evaluate(key);

            // Делаем свойство доступным через this.data
            Object.defineProperty(this.model.data, key, {
                get: () => this.computed[key].value,
                enumerable: true,
                configurable: true
            });
        }
    }

    // Обчислення значення computed властивості
    evaluate(key, force = false) {
        const computed = this.computed[key];

        const dependencies = new Set();
        const dataTracker = new Proxy(this.store.getState(), {
            get: (target, prop) => {
                // Додаємо базову властивість до залежностей
                dependencies.add(prop);

                // Отримуємо значення
                let value = target[prop];

                // Якщо значення є об'єктом, створюємо для нього проксі для відслідковування
                if (value && typeof value === 'object') {
                    return new Proxy(value, {
                        get: (obj, nestedProp) => {
                            // Додаємо повний шлях до залежностей
                            dependencies.add(`${prop}.${nestedProp}`);
                            return obj[nestedProp];
                        }
                    });
                }

                return value;
            }
        });

        const result = computed.getter.call(dataTracker);
        computed.dependencies = [...dependencies];
        computed.value = result;

        this.store.emit('compute', {
            key,
            value: result,
            dependencies,
        });

        return result;
    }

    update(changedProp) {
        for (const key in this.computed) {
            const computed = this.computed[key];

            // Улучшенная проверка зависимостей
            const isDependency = computed.dependencies.some(dep => {
                // Проверяем точное совпадение
                if (dep === changedProp) return true;

                // Проверяем, является ли изменившееся свойство частью зависимости
                // Например, если изменилось user.name, а зависимость - user
                if (changedProp.startsWith(dep + '.')) return true;

                // Проверяем, является ли зависимость частью изменившегося свойства
                // Например, если изменилось user, а зависимость - user.name
                if (dep.startsWith(changedProp + '.')) return true;

                return false;
            });

            if (isDependency) {
                Logger.debug(`Updating computed property: ${key}`);
                const newValue = this.evaluate(key);

                // Оновлюємо DOM для обчислюваної властивості
                this.model.dom.updateDOM(key, newValue);
                this.model.dom.updateInputs(key, newValue);
            }
        }
    }

    // Допоміжний метод для отримання всіх обчислюваних значень
    get() {
        return Object.fromEntries(
            Object.entries(this.computed)
                .map(([key, comp]) => [key, comp.value])
        );
    }
}