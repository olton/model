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
            
            .devtools-section:not(:last-child) {
                border-bottom: 1px solid #333;
            }
            
            h3 {
                margin: 0;
            }
        }
        
        #model-dev-tools-toggle-button {
            position: fixed;
            bottom: 10px;
            right: 10px;
            z-index: 9998;
            padding: 5px 10px;
            background: #444;
            color: white;
            border: none;
            border-radius: 4px;
            cursor: pointer;
        }        

        #model-devtools-time-travel-dialog {
            position: fixed;
            bottom: 0;
            right: 300px;
            background: #2a2a2a;
            border: 1px solid #444;
            border-radius: 4px;
            height: 400px;
            width: 300px;
            z-index: 10000;
            color: #fff;
            font-family: monospace;
            
            .time-travel-items {
                padding: 8px; height: calc(100% - 35px); 
                overflow: auto;
                position: relative;
            }
            
            .time-travel-item {
                padding: 8px;
                margin: 4px;
                border: 1px solid #444;
                cursor: pointer;
                hover: background-color: #333;
                
                button {
                    margin-top: 8px;
                    background: dodgerblue;
                }
            }
        }
        
        #model-devtools-panel, #model-devtools-time-travel-dialog {
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
        
        .dev-tools-header {
            padding: 8px; 
            border-bottom: 1px solid #333; 
            display: flex; 
            justify-content: space-between;
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
            <div class="dev-tools-header">
                <span>Model DevTools</span>
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

        // Додаємо кнопку для відкриття панелі
        this.createToggleButton();
        
        document.getElementById('devtools-close').onclick = () => this.togglePanel();
        document.getElementById('devtools-time-travel').onclick = () => this.showTimeTravelDialog();
    }

    showTimeTravelDialog() {
        // Створюємо діалог для time travel
        let dialog = document.getElementById('model-devtools-time-travel-dialog');
        if (!dialog) {
            dialog = document.createElement('div');
            dialog.id = "model-devtools-time-travel-dialog";
        }

        // Формуємо список станів
        const statesList = this.history.map((snapshot, index) => `
            <div class="time-travel-item">
                <div>Time: ${new Date(snapshot.timestamp).toLocaleTimeString()}</div>
                <div>Type: ${snapshot.type}</div>
                <div>Property: ${snapshot.property || snapshot.event || snapshot.path || ''}</div>
                <div>Value: ${snapshot.oldValue + " -> " + snapshot.newValue}</div>
                <button data-time-travel-index="${index}">
                    Go to this state
                </button>
            </div>
        `).join('');

        dialog.innerHTML = `
            <div class="dev-tools-header">
                <span>Time Travel</span>
                <button style="margin-left: auto" onclick="this.parentElement.parentElement.remove()">×</button>
            </div>
            <div class="time-travel-items">${statesList || '<div style="height: 100%; display: flex; align-items: center; justify-content: center;">Nothing to show!</div>'}</div>
        `;

        document.body.appendChild(dialog);
        
        dialog.querySelectorAll('[data-time-travel-index]').forEach(button => {
            button.onclick = () => {
                const index = button.getAttribute('data-time-travel-index');
                this.timeTravel(index);
            }
        })
        
        if (!statesList) {
            setTimeout(() => {
                //dialog.remove();
            }, 2000)
        } 
    }

    createToggleButton() {
        const button = document.createElement('button');
        button.id = "model-dev-tools-toggle-button";
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
        
        const timeTravelDialog = document.getElementById('model-devtools-time-travel-dialog');
        if (timeTravelDialog) {
            this.showTimeTravelDialog();
        }
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
    }

    // API для консолі розробника
    inspect(path) {
        return this.model.getValueByPath(path);
    }

    timeTravel(index) {
        if (!this.options.timeTravel) return;
        if (index < 0 || index >= this.history.length) return;

        const snapshot = this.history[index];
        this.model.loadStateFromSnapshot(snapshot.state);
        this.currentIndex = index;
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