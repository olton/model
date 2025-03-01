const DevToolsWindowStyle = `
    <style>
        #model-devtools-panel  { 
            position: fixed;
            bottom: 0;
            right: 0;
            width: 300px;
            height: 400px;
            background: #242424;
            color: #fff;
            border: 1px solid #333;
            z-index: 9999;
            font-family: monospace;
        
            button {
                height: 20px;
                display: inline-flex;
                align-items: center;
                justify-content: center;
                font-size: 12px;
                border-radius: 4px;
                border: 1px solid #444;
                background: #333;
                color: #fff;
                cursor: pointer;
                
                @media (hover: hover) {
                    &:hover {
                        background: #444;
                    }
                }

                @media (hover: none) {
                    &:hover {
                        background: #444;
                    }
                }
            }
        }        
    </style>
`

const TimeTravelDialogStyle = `
    <style>
        #model-devtools-time-travel-dialog {
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            background: #2a2a2a;
            padding: 10px;
            border: 1px solid #444;
            border-radius: 4px;
            max-height: 80vh;
            overflow-y: auto;
            z-index: 10000;
            color: #fff;
            font-family: monospace;
        
            button {
                height: 20px;
                display: inline-flex;
                align-items: center;
                justify-content: center;
                font-size: 12px;
                border-radius: 4px;
                border: 1px solid #444;
                background: #333;
                color: #fff;
                cursor: pointer;
                
                @media (hover: hover) {
                    &:hover {
                        background: #444;
                    }
                }

                @media (hover: none) {
                    &:hover {
                        background: #444;
                    }
                }
            }
        }
    </style>
`

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
        // Створюємо глобальний об'єкт для доступу з консолі
        window.__MODEL_DEVTOOLS__ = this;

        // Додаємо панель DevTools
        this.createDevToolsPanel();

        // Підписуємося на події моделі
        this.setupModelListeners();
    }

    createDevToolsPanel() {
        const panel = document.createElement('div');
        panel.id = 'model-devtools-panel';
        panel.style.cssText = `display: none;`;

        const header = document.createElement('div');
        header.innerHTML = `
            ${DevToolsWindowStyle}
            <div style="padding: 8px; border-bottom: 1px solid #333; display: flex; justify-content: space-between;">
                <span>Model DevTools</span>
                <div>
                    <button id="devtools-time-travel">Time Travel</button>
                    <button id="devtools-close">×</button>
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

        // Додаємо кнопку для відкриття панелі
        this.createToggleButton();
        
        document.getElementById('devtools-close').onclick = () => this.togglePanel();
        document.getElementById('devtools-time-travel').onclick = () => this.showTimeTravelDialog();
    }

    showTimeTravelDialog() {
        // Створюємо діалог для time travel
        const dialog = document.createElement('div');
        dialog.id = "model-devtools-time-travel-dialog";

        // Формуємо список станів
        const statesList = this.history.map((snapshot, index) => `
            <div class="time-travel-item" style="
                padding: 8px;
                margin: 4px 0;
                border: 1px solid #444;
                cursor: pointer;
                hover: background-color: #333;
            ">
                <div>Time: ${new Date(snapshot.timestamp).toLocaleTimeString()}</div>
                <div>Type: ${snapshot.type}</div>
                <div>Property: ${snapshot.property || snapshot.event || snapshot.path || ''}</div>
                <button style="margin-top: 8px; background: dodgerblue;" onclick="window.__MODEL_DEVTOOLS__.timeTravel(${index})">
                    Go to this state
                </button>
            </div>
        `).join('');

        dialog.innerHTML = `
            ${TimeTravelDialogStyle}
            <div style="display: flex; gap: 10px;">
                <h3 style="margin: 0">Time Travel</h3>
                <button style="margin-left: auto" onclick="this.parentElement.parentElement.remove()">×</button>
            </div>
            <div>${statesList || 'Nothing to show!'}</div>
        `;

        document.body.appendChild(dialog);
        
        if (!statesList) {
            setTimeout(() => {
                dialog.remove();
            }, 2000)
        } 
    }


    createToggleButton() {
        const button = document.createElement('button');
        button.style.cssText = `
            position: fixed;
            bottom: 10px;
            right: 10px;
            z-index: 9998;
            padding: 5px 10px;
            background: #4CAF50;
            color: white;
            border: none;
            border-radius: 4px;
            cursor: pointer;
        `;
        button.textContent = 'Model DevTools';
        button.onclick = () => this.togglePanel();
        document.body.appendChild(button);
    }

    setupModelListeners() {
        // Відстеження змін даних
        this.model.on('change', ({ property, oldValue, newValue }) => {
            this.logChange({
                type: 'data-change',
                property,
                oldValue,
                newValue,
                timestamp: Date.now()
            });
        });

        // Відстеження подій
        this.model.on('*', (eventName, data) => {
            if (eventName !== 'change') {
                this.logChange({
                    type: 'event',
                    event: eventName,
                    data,
                    timestamp: Date.now()
                });
            }
        });

        // Відстеження обчислюваних властивостей
        this.model.on('computedUpdated', ({ key, value }) => {
            this.logChange({
                type: 'computed-update',
                property: key,
                value,
                timestamp: Date.now()
            });
        });

        this.setupArrayObserver();
    }

    setupArrayObserver() {
        const arrayMethods = ['push', 'pop', 'shift', 'unshift', 'splice', 'sort', 'reverse'];

        const observeArray = (array, path) => {
            arrayMethods.forEach(method => {
                const original = array[method];
                array[method] = (...args) => {
                    const oldValue = [...array];
                    const result = original.apply(array, args);

                    this.logChange({
                        type: 'array-operation',
                        path,
                        method,
                        args,
                        oldValue,
                        newValue: [...array],
                        timestamp: Date.now()
                    });

                    return result;
                };
            });
        };

        // Рекурсивно знаходимо та спостерігаємо за всіма масивами в моделі
        const findAndObserveArrays = (obj, parentPath = '') => {
            for (const [key, value] of Object.entries(obj)) {
                const currentPath = parentPath ? `${parentPath}.${key}` : key;

                if (Array.isArray(value)) {
                    observeArray(value, currentPath);
                    // Також перевіряємо елементи масиву на наявність вкладених масивів
                    value.forEach((item, index) => {
                        if (typeof item === 'object' && item !== null) {
                            findAndObserveArrays(item, `${currentPath}[${index}]`);
                        }
                    });
                } else if (typeof value === 'object' && value !== null) {
                    findAndObserveArrays(value, currentPath);
                }
            }
        };

        findAndObserveArrays(this.model.data);
    }

    logChange(entry) {
        if (!this.options.enabled) return;

        // Зберігаємо знімок стану
        if (this.options.timeTravel) {
            this.saveSnapshot(entry);
        }

        // Оновлюємо відображення
        this.updateDisplay();
    }

    saveSnapshot(entry) {
        // Створюємо знімок поточного стану
        const snapshot = {
            ...entry,
            state: JSON.parse(JSON.stringify(this.model.data)),
            computed: Object.fromEntries(
                Object.entries(this.model.computed)
                    .map(([key, comp]) => [key, comp.value])
            )
        };

        // Додаємо до історії
        this.history = this.history.slice(0, this.currentIndex + 1);
        this.history.push(snapshot);
        this.currentIndex++;

        // Обмежуємо кількість знімків
        if (this.history.length > this.options.maxSnapshots) {
            this.history.shift();
            this.currentIndex--;
        }
    }

    updateDisplay() {
        const content = document.getElementById('model-devtools-content');
        if (!content) return;

        const formatValue = (value) => {
            if (Array.isArray(value)) {
                return `Array(${value.length}) ${JSON.stringify(value, null, 2)}`;
            }
            return JSON.stringify(value, null, 2);
        };

        const recentChanges = this.getRecentChanges().map(change => {
            if (change.type === 'array-operation') {
                return {
                    ...change,
                    description: `${change.path}.${change.method}(${change.args.map(arg =>
                        JSON.stringify(arg)).join(', ')})`
                };
            }
            return change;
        });
        
        content.innerHTML = `
            <div class="devtools-section">
                <h3>Current State:</h3>
                <pre>${formatValue(this.model.data)}</pre>
            </div>
            <div class="devtools-section">
                <h3>Computed Values:</h3>
                <pre>${formatValue(this.getComputedValues())}</pre>
            </div>
            <div class="devtools-section">
                <h3>Recent Changes:</h3>
                <pre>${JSON.stringify(recentChanges, null, 2)}</pre>
            </div>
        `;
    }

    getComputedValues() {
        return Object.fromEntries(
            Object.entries(this.model.computed)
                .map(([key, comp]) => [key, comp.value])
        );
    }

    getRecentChanges() {
        return this.history.slice(-5).reverse();
    }

    togglePanel() {
        const panel = document.getElementById('model-devtools-panel');
        if (panel) {
            panel.style.display = panel.style.display === 'none' ? 'block' : 'none';
        }
        console.log(panel.style.display)
    }

    // API для консолі розробника
    inspect(path) {
        const value = this.model.getValueByPath(path);
        console.log(`Value ${path}:`, value);
        return value;
    }

    timeTravel(index) {
        if (!this.options.timeTravel) return;
        if (index < 0 || index >= this.history.length) return;

        const snapshot = this.history[index];
        this.model.loadState(JSON.stringify(snapshot.state));
        this.currentIndex = index;
        console.log(`Transition to a state:`, snapshot);
    }

    // Методи для аналізу продуктивності
    startPerfMonitoring() {
        this.perfMetrics = {
            updates: 0,
            computations: 0,
            startTime: Date.now()
        };

        this.model.on('*', () => {
            this.perfMetrics.updates++;
        });
    }

    getPerfReport() {
        const duration = (Date.now() - this.perfMetrics.startTime) / 1000;
        return {
            totalUpdates: this.perfMetrics.updates,
            updatesPerSecond: this.perfMetrics.updates / duration,
            computationsPerSecond: this.perfMetrics.computations / duration
        };
    }
}

export default ModelDevTools;