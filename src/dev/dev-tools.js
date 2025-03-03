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
        // We create a global object for access from the console
        window.__MODEL_DEVTOOLS__ = this;

        // Add the Devtools panel
        this.createDevToolsPanel();

        // We subscribe to the events of the model
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

        // Add a button for opening the panel
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
        // Tracking data changes
        this.model.store.on('change', (data) => {
            this.logChange({
                type: 'data-change',
                path: data.path,
                oldValue: data.oldValue,
                newValue: data.newValue,
                timestamp: Date.now()
            });
        });

        // Tracking events from the storage
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

        // Tracking the events of the model
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

        // Tracking the calculated properties
        this.model.store.on('compute', (data) => {
            this.logChange({
                type: 'computed-update',
                property: data.key,
                dependencies: Array.from(data.dependencies),
                newValue: data.value,
                timestamp: Date.now()
            });
        });

        // Tracking changes in arrays
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

        // We retain a picture of the condition
        if (this.options.timeTravel) {
            this.saveSnapshot(entry);
        }

        // We update the display
        this.updateDisplay();
    }

    saveSnapshot(entry) {
        // We create a picture of the current state
        const snapshot = {
            ...entry,
            state: JSON.parse(JSON.stringify(this.model.data)),
            // We get all the calculated properties
            computed: this.getComputedValues()
        };

        // Add to history
        this.history = this.history.slice(0, this.currentIndex + 1);
        this.history.push(snapshot);
        this.currentIndex++;

        // Limit the number of snapshots
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
                // We format the Timestamp for a better display
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

        // We get current calculated values
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
        // We check if there is an object of Computed and the Getall or Get method
        if (!this.model.computed) return {};

        if (typeof this.model.computed.all === 'function') {
            return this.model.computed.all();
        }

        // If there is no specific method, we try to obtain properties through iteration
        if (this.model.computed.keys && Array.isArray(this.model.computed.keys)) {
            const result = {};
            for (const key of this.model.computed.keys) {
                result[key] = this.model.computed.getValue(key);
            }
            return result;
        }

        // If there is still no data, we are trying to get values from this.model.data
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
            // Temporarily turn off the listeners to avoid cycles
            const origEnabled = this.options.enabled;
            this.options.enabled = false;

            // We load the condition from the snapshot
            this.model.store.setState(snapshot.state);

            // Update the values of the calculated properties
            if (this.model.computed) {
                // Check the presence of the Recompute method for all properties
                if (typeof this.model.computed.recomputeAll === 'function') {
                    this.model.computed.recomputeAll();
                } else {
                    // If the Recompteall is absent, we try to update each property
                    for (const key in snapshot.computed) {
                        if (typeof this.model.computed.evaluate === 'function') {
                            this.model.computed.evaluate(key, true);
                        } else if (typeof this.model.computed.recompute === 'function') {
                            this.model.computed.recompute(key);
                        }
                    }
                }
            }

            // We update DOM
            this.model.dom.updateAllDOM();

            this.currentIndex = index;
            this.options.enabled = origEnabled;
        } catch (e) {
            console.error('Error during time travel:', e);
        }
    }

    // Methods for analysis of performance
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