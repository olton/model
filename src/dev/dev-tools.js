import DevToolsWindowStyle from './dev-tools.style.js';

class ModelDevTools {
    constructor(model, options = {}) {
        this.model = model;
        this.options = {
            enabled: true,
            timeTravel: true,
            maxSnapshots: 50,
            ...options
        };

        this.history = [];
        this.currentIndex = -1;

        this.initializeDevTools();
    }

    initializeDevTools() {
        // Создаем глобальный объект для доступа из консоли
        window.__MODEL_DEVTOOLS__ = this;

        // Добавляем панель DevTools
        this.createDevToolsPanel();

        // Подписываемся на события модели
        this.setupModelListeners();
    }

    createDevToolsPanel() {
        const panel = document.createElement('div');
        panel.id = 'model-devtools-panel';
        panel.style.cssText = `display: none;`;

        const header = document.createElement('div');
        header.innerHTML = `
            ${DevToolsWindowStyle}
            <div class="dev-tools-header">
                <span>🛠 Model DevTools</span>
                <div>
                    <button id="devtools-time-travel" title="Time Travel">⏱</button>
                    <button id="devtools-close" title="Close">×</button>
                </div>
            </div>
        `;

        const content = document.createElement('div');
        content.style.cssText = `
            padding: 8px;
            height: calc(100% - 35px);
            overflow: auto;
        `;
        content.id = 'model-devtools-content';

        panel.appendChild(header);
        panel.appendChild(content);

        document.body.appendChild(panel);

        // Добавляем кнопку для открытия панели
        this.createToggleButton();

        document.getElementById('devtools-close').onclick = () => this.togglePanel();
        document.getElementById('devtools-time-travel').onclick = () => this.showTimeTravelDialog();
    }

    showTimeTravelDialog() {
        // Создаем диалог для time travel
        let dialog = document.getElementById('model-devtools-time-travel-dialog');
        if (!dialog) {
            dialog = document.createElement('div');
            dialog.id = "model-devtools-time-travel-dialog";
        }

        // Формируем список состояний
        const statesList = [...this.history].reverse().map((snapshot, index) => `
            <div class="time-travel-item">
                <div>Time: ${new Date(snapshot.timestamp).toLocaleTimeString()}</div>
                <div>Type: ${snapshot.type}</div>
                <div>Property: ${snapshot.property || snapshot.event || snapshot.path || ''}</div>
                <div>Value: ${snapshot.type === "computed-update" ? snapshot.newValue :
            typeof snapshot.oldValue !== 'undefined' && typeof snapshot.newValue !== 'undefined' ?
                `${JSON.stringify(snapshot.oldValue)} -> ${JSON.stringify(snapshot.newValue)}` :
                JSON.stringify(snapshot.newValue || snapshot.value || '')}</div>
                <button style="display: none" onclick="window.__MODEL_DEVTOOLS__.timeTravel(${this.history.length - 1 - index})">Apply this state</button>
            </div>
        `).join('');

        dialog.innerHTML = `
            <div class="dev-tools-header">
                <span>⏱ Time Travel</span>
                <button style="margin-left: auto" onclick="this.parentElement.parentElement.remove()">×</button>
            </div>
            <div class="time-travel-items">${statesList || 'Nothing to show!'}</div>
        `;

        document.body.appendChild(dialog);
    }

    createToggleButton() {
        const button = document.createElement('button');
        button.id = "model-dev-tools-toggle-button";
        button.textContent = '🛠';
        button.title = 'Model DevTools';
        button.onclick = () => this.togglePanel();
        document.body.appendChild(button);
    }

    setupModelListeners() {
        // Отслеживание изменений данных
        this.model.store.on('change', (data) => {
            this.logChange({
                type: 'data-change',
                path: data.path,
                oldValue: data.oldValue,
                newValue: data.newValue,
                timestamp: Date.now()
            });
        });

        // Отслеживание событий от хранилища
        this.model.store.on('*', (eventName, data) => {
            if (eventName !== 'change' && eventName !== 'compute' && eventName !== 'arrayChange') {
                this.logChange({
                    type: 'store-event',
                    event: eventName,
                    data,
                    timestamp: Date.now()
                });
            }
        });

        // Отслеживание событий модели
        this.model.on('*', (eventName, data) => {
            if (eventName !== 'change' && eventName !== 'compute') {
                this.logChange({
                    type: 'model-event',
                    event: eventName,
                    data,
                    timestamp: Date.now()
                });
            }
        });

        // Отслеживание вычисляемых свойств
        this.model.store.on('compute', (data) => {
            this.logChange({
                type: 'computed-update',
                property: data.key,
                dependencies: Array.from(data.dependencies),
                newValue: data.value,
                timestamp: Date.now()
            });
        });

        // Отслеживание изменений массивов
        this.model.store.on('arrayChange', (data) => {
            this.logChange({
                type: 'array-operation',
                path: data.path,
                method: data.method,
                args: data.args,
                oldValue: data.oldValue,
                newValue: data.newValue,
                timestamp: Date.now()
            });
        });
    }

    logChange(entry) {
        if (!this.options.enabled) return;

        // Сохраняем снимок состояния
        if (this.options.timeTravel) {
            this.saveSnapshot(entry);
        }

        // Обновляем отображение
        this.updateDisplay();
    }

    saveSnapshot(entry) {
        // Создаем снимок текущего состояния
        const snapshot = {
            ...entry,
            state: JSON.parse(JSON.stringify(this.model.data)),
            // Получаем все вычисляемые свойства
            computed: this.getComputedValues()
        };

        // Добавляем в историю
        this.history = this.history.slice(0, this.currentIndex + 1);
        this.history.push(snapshot);
        this.currentIndex++;

        // Ограничиваем количество снимков
        if (this.history.length > this.options.maxSnapshots) {
            this.history.shift();
            this.currentIndex--;
        }
    }

    updateDisplay() {
        const content = document.getElementById('model-devtools-content');
        if (!content) return;

        const formatValue = (value) => {
            if (value === undefined) return 'undefined';
            if (value === null) return 'null';

            try {
                if (Array.isArray(value)) {
                    return `Array(${value.length}) ${JSON.stringify(value, null, 2)}`;
                }
                return JSON.stringify(value, null, 2);
            } catch (e) {
                return String(value);
            }
        };

        const recentChanges = this.getRecentChanges();
        let changes = ``;

        for (const change of recentChanges) {
            let changeContent;

            try {
                // Форматируем timestamp для лучшего отображения
                const formattedChange = {
                    ...change,
                    timestamp: new Date(change.timestamp).toLocaleTimeString()
                };
                changeContent = JSON.stringify(formattedChange, null, 2);
            } catch (e) {
                changeContent = `Error formatting change: ${e.message}`;
            }

            changes += `
            <div style="border-bottom: 1px solid #444; padding-bottom: 8px; overflow-x: auto">
                <pre>${changeContent}</pre>
            </div>\n`;
        }

        // Получаем текущие вычисляемые значения
        const computedValues = this.getComputedValues();

        content.innerHTML = `
        <div class="devtools-section">
            <h3>Current State:</h3>
            <pre>${formatValue(this.model.data)}</pre>
        </div>
        <div class="devtools-section">
            <h3>Computed Values:</h3>
            <pre>${formatValue(computedValues)}</pre>
        </div>
        <div class="devtools-section">
            <h3>DOM Dependencies:</h3>
            <pre>${this.formatDOMDependencies()}</pre>
        </div>
        <div class="devtools-section">
            <h3>Recent Changes:</h3>
            ${changes}
        </div>
    `;

        const timeTravelDialog = document.getElementById('model-devtools-time-travel-dialog');
        if (timeTravelDialog) {
            this.showTimeTravelDialog();
        }
    }

    formatDOMDependencies() {
        try {
            const dependencies = {};
            this.model.dom.domDependencies.forEach((value, key) => {
                dependencies[key] = Array.from(value).map(dep => ({
                    type: dep.type,
                    element: dep.element.tagName
                }));
            });
            return JSON.stringify(dependencies, null, 2);
        } catch (e) {
            return `Error formatting DOM dependencies: ${e.message}`;
        }
    }

    getComputedValues() {
        // Проверяем, есть ли объект computed и метод getAll или get
        if (!this.model.computed) return {};

        if (typeof this.model.computed.all === 'function') {
            return this.model.computed.all();
        }

        // Если нет конкретного метода, пробуем получить свойства через итерацию
        if (this.model.computed.keys && Array.isArray(this.model.computed.keys)) {
            const result = {};
            for (const key of this.model.computed.keys) {
                result[key] = this.model.computed.getValue(key);
            }
            return result;
        }

        // Если всё еще нет данных, пытаемся получить значения из this.model.data
        const computedValues = {};
        for (const key in this.model.data) {
            if (this.model.computed && typeof this.model.computed[key] !== 'undefined') {
                computedValues[key] = this.model.data[key];
            }
        }

        return computedValues;
    }

    getRecentChanges() {
        return this.history.slice(-5).reverse();
    }

    togglePanel() {
        const panel = document.getElementById('model-devtools-panel');
        if (panel) {
            panel.style.display = panel.style.display === 'none' ? 'block' : 'none';
        }
    }

    // API для консоли разработчика
    inspect(path) {
        return this.model.store.get(path);
    }

    timeTravel(index) {
        if (!this.options.timeTravel || true) return;
        if (index < 0 || index >= this.history.length) return;

        const snapshot = this.history[index];

        try {
            // Временно отключаем слушатели, чтобы избежать циклов
            const origEnabled = this.options.enabled;
            this.options.enabled = false;

            // Загружаем состояние из снапшота
            this.model.store.setState(snapshot.state);

            // Обновляем значения вычисляемых свойств
            if (this.model.computed) {
                // Проверяем наличие метода recompute для всех свойств
                if (typeof this.model.computed.recomputeAll === 'function') {
                    this.model.computed.recomputeAll();
                } else {
                    // Если recomputeAll отсутствует, пробуем обновить каждое свойство
                    for (const key in snapshot.computed) {
                        if (typeof this.model.computed.evaluate === 'function') {
                            this.model.computed.evaluate(key, true);
                        } else if (typeof this.model.computed.recompute === 'function') {
                            this.model.computed.recompute(key);
                        }
                    }
                }
            }

            // Обновляем DOM
            this.model.dom.updateAllDOM();

            this.currentIndex = index;
            this.options.enabled = origEnabled;

            console.log(`Time traveled to snapshot ${index}`, snapshot);
        } catch (e) {
            console.error('Error during time travel:', e);
        }
    }

    // Методы для анализа производительности
    startPerfMonitoring() {
        this.perfMetrics = {
            updates: 0,
            computations: 0,
            domUpdates: 0,
            startTime: Date.now()
        };

        this.model.store.on('change', () => {
            this.perfMetrics.updates++;
        });

        this.model.store.on('compute', () => {
            this.perfMetrics.computations++;
        });
    }

    getPerfReport() {
        const duration = (Date.now() - this.perfMetrics.startTime) / 1000;
        return {
            totalUpdates: this.perfMetrics.updates,
            updatesPerSecond: this.perfMetrics.updates / duration,
            computationsPerSecond: this.perfMetrics.computations / duration,
            domUpdatesPerSecond: this.perfMetrics.domUpdates / duration
        };
    }
}

export default ModelDevTools;