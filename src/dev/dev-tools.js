import DevToolsWindowStyle from './dev-tools.style.js';

/**
 * A class for debugging and monitoring changes in a model's data and store events.
 * Provides functionalities like time travel debugging, change logging, and more.
 *
 * @class ModelDevTools
 * @param {Object} model - The model instance to be monitored.
 * @param {Object} [options={}] - Configuration options for the dev tools.
 * @param {boolean} [options.enabled=true] - Whether the dev tools are enabled.
 * @param {boolean} [options.timeTravel=true] - Whether time travel debugging is enabled.
 * @param {number} [options.maxSnapshots=50] - Maximum number of snapshots to retain for time travel.
 */
class ModelDevTools {
    constructor(model, options = {}) {
        this.model = model;
        this.options = {
            enabled: true, timeTravel: true, maxSnapshots: 50, ...options
        };

        this.history = [];
        this.currentIndex = -1;

        this.initializeDevTools();
    }

    /**
     * Initializes the model development tools by:
     * - Creating a global reference at window.__MODEL_DEVTOOLS__
     * - Creating the dev tools panel in the DOM
     * - Setting up model event listeners for debugging
     */
    initializeDevTools() {
        window.__MODEL_DEVTOOLS__ = this;
        this.createDevToolsPanel();
        this.setupModelListeners();
    }

    /**
     * Creates the development tools panel in the DOM with:
     * - A header with title and control buttons
     * - Content area for debugging information
     * - Styling from DevToolsWindowStyle
     * - Close and Time Travel buttons with event handlers
     * - Toggle button for panel visibility
     */
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

        this.createToggleButton();

        document.getElementById('devtools-close').onclick = () => this.togglePanel();
        document.getElementById('devtools-time-travel').onclick = () => this.showTimeTravelDialog();
    }

    /**
     * Displays the Time Travel dialog by:
     * - Creating or reusing existing dialog container
     * - Generating a reversed chronological list of snapshots
     * - Formatting snapshot data (timestamp, type, property, old/new values)
     * - Displaying changes in computed properties and value transitions
     */
    showTimeTravelDialog() {

        let dialog = document.getElementById('model-devtools-time-travel-dialog');
        if (!dialog) {
            dialog = document.createElement('div');
            dialog.id = "model-devtools-time-travel-dialog";
        }

        const statesList = [...this.history].reverse().map((snapshot, index) => `
            <div class="time-travel-item">
                <div>Time: ${new Date(snapshot.timestamp).toLocaleTimeString()}</div>
                <div>Type: ${snapshot.type}</div>
                <div>Property: ${snapshot.property || snapshot.event || snapshot.path || ''}</div>
                <div>Value: ${snapshot.type === "computed-update" ? snapshot.newValue : typeof snapshot.oldValue !== 'undefined' && typeof snapshot.newValue !== 'undefined' ? `${JSON.stringify(snapshot.oldValue)} -> ${JSON.stringify(snapshot.newValue)}` : JSON.stringify(snapshot.newValue || snapshot.value || '')}</div>
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

    /**
     * Creates a toggle button for the Model DevTools panel.
     * The button is appended to the page and provides
     * functionality to show or hide the dev tools panel.
     */
    createToggleButton() {
        const button = document.createElement('button');
        button.id = "model-dev-tools-toggle-button";
        button.textContent = '🛠';
        button.title = 'Model DevTools';
        button.onclick = () => this.togglePanel();
        document.body.appendChild(button);
    }

    /**
     * Sets up listeners for the model and its store to track and log changes,
     * events, computed property updates, and array operations. This enables
     * the Model DevTools to record snapshot history, provide time travel
     * functionality, and update the display with relevant data changes.
     */
    setupModelListeners() {

        this.model.store.on('change', (data) => {
            this.logChange({
                type: 'data-change', path: data.path, oldValue: data.oldValue, newValue: data.newValue, timestamp: Date.now()
            });
        });

        this.model.store.on('*', (eventName, data) => {
            if (eventName !== 'change' && eventName !== 'compute' && eventName !== 'arrayChange') {
                this.logChange({
                    type: 'store-event', event: eventName, data, timestamp: Date.now()
                });
            }
        });

        this.model.on('*', (eventName, data) => {
            if (eventName !== 'change' && eventName !== 'compute') {
                this.logChange({
                    type: 'model-event', event: eventName, data, timestamp: Date.now()
                });
            }
        });

        this.model.store.on('compute', (data) => {
            this.logChange({
                type: 'computed-update', property: data.key, dependencies: Array.from(data.dependencies), newValue: data.value, timestamp: Date.now()
            });
        });

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

    /**
     * Logs a change entry and updates the Model DevTools display if enabled.
     *
     * - If the `timeTravel` option is enabled, the method saves a snapshot of the current state.
     * - Updates the DevTools display to reflect the new changes.
     *
     * @param {Object} entry - The change entry to log.
     * @param {string} entry.type - The type of change (e.g., 'data-change', 'model-event', etc.).
     * @param {string} [entry.path] - Path of the property being changed (if applicable).
     * @param {any} [entry.oldValue] - The previous value of the changed property (if applicable).
     * @param {any} [entry.newValue] - The new value of the changed property (if applicable).
     * @param {string} [entry.event] - The event name associated with the change (if applicable).
     * @param {number} entry.timestamp - A timestamp indicating when the change occurred.
     */
    logChange(entry) {
        if (!this.options.enabled) return;

        if (this.options.timeTravel) {
            this.saveSnapshot(entry);
        }

        this.updateDisplay();
    }

    /**
     * Saves a snapshot of the current model state, including computed properties and relevant metadata.
     *
     * - Trims the history to ensure the size does not exceed `maxSnapshots`.
     * - Updates the snapshot history and current snapshot index.
     *
     * @param {Object} entry - The change entry that triggered the snapshot.
     * @param {string} entry.type - The type of change (e.g., 'data-change', 'model-event', etc.).
     * @param {string} [entry.path] - Path of the property being changed (if applicable).
     * @param {any} [entry.oldValue] - The previous value before the change (if applicable).
     * @param {any} [entry.newValue] - The new value after the change (if applicable).
     * @param {number} entry.timestamp - A timestamp indicating when the change occurred.
     */
    saveSnapshot(entry) {

        const snapshot = {
            ...entry, state: JSON.parse(JSON.stringify(this.model.data)),

            computed: this.getComputedValues()
        };

        this.history = this.history.slice(0, this.currentIndex + 1);
        this.history.push(snapshot);
        this.currentIndex++;

        if (this.history.length > this.options.maxSnapshots) {
            this.history.shift();
            this.currentIndex--;
        }
    }

    /**
     * Updates the display of the Model DevTools.
     *
     * - Retrieves and formats the current state, computed values, DOM dependencies, and
     *   recent changes in the model.
     * - Creates and dynamically sets the innerHTML content of the Model DevTools panel.
     * - Triggers the time travel dialog if the corresponding element is present.
     *
     * This method ensures that the visual representation of the model remains up-to-date
     * for debugging and monitoring purposes.
     */
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

                const formattedChange = {
                    ...change, timestamp: new Date(change.timestamp).toLocaleTimeString()
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

    /**
     * Formats and returns a structured representation of model's DOM dependencies.
     *
     * - Loops through the DOM dependencies managed in the model.
     * - Converts the `Map` structure into a plain object for easier inspection.
     * - Each dependency entry includes the type of dependency and the tag name of the associated element.
     *
     * @returns {string} A JSON string representing the formatted DOM dependencies.
     */
    formatDOMDependencies() {
        try {
            const dependencies = {};
            this.model.dom.domDependencies.forEach((value, key) => {
                dependencies[key] = Array.from(value).map(dep => ({
                    type: dep.type, element: dep.element.tagName
                }));
            });
            return JSON.stringify(dependencies, null, 2);
        } catch (e) {
            return `Error formatting DOM dependencies: ${e.message}`;
        }
    }

    /**
     * Retrieves computed values from the model and returns them in a structured format.
     *
     * - If the model's `computed.all` function is available, all computed values are fetched at once.
     * - If the model has a list of computed keys, their values are retrieved individually.
     * - Falls back to iterating over model data keys and extracting computed values if present.
     *
     * @returns {Object} An object containing the computed values from the model.
     */
    getComputedValues() {

        if (!this.model.computed) return {};

        if (typeof this.model.computed.all === 'function') {
            return this.model.computed.all();
        }

        if (this.model.computed.keys && Array.isArray(this.model.computed.keys)) {
            const result = {};
            for (const key of this.model.computed.keys) {
                result[key] = this.model.computed.getValue(key);
            }
            return result;
        }

        const computedValues = {};
        for (const key in this.model.data) {
            if (this.model.computed && typeof this.model.computed[key] !== 'undefined') {
                computedValues[key] = this.model.data[key];
            }
        }

        return computedValues;
    }

    /**
     * Retrieves the most recent changes from the history.
     *
     * - This method fetches the last 5 changes from the `history` array.
     * - The returned changes are reversed to display the most recent change first.
     *
     * @returns {Array} An array of recent changes from the history.
     */
    getRecentChanges() {
        return this.history.slice(-5).reverse();
    }

    /**
     * Toggles the visibility of the development tools panel.
     *
     * - If the panel is currently hidden (`display: none`), it will be made visible.
     * - If the panel is currently visible, it will be hidden.
     */
    togglePanel() {
        const panel = document.getElementById('model-devtools-panel');
        if (panel) {
            panel.style.display = panel.style.display === 'none' ? 'block' : 'none';
        }
    }

    /**
     * Retrieves the data stored at the specified path in the model's store.
     *
     * - The `path` parameter is used to access specific data within the store.
     * - The method returns the value found at the given path.
     *
     * @param {string} path - The dot-notated path to retrieve the value from the store.
     * @returns {*} The data stored at the specified path.
     */
    inspect(path) {
        return this.model.store.get(path);
    }

    /**
     * Toggles the visibility of the development tools panel in the UI.
     *
     * - The method checks the current display state of the panel element.
     * - If the panel is hidden (`display: none`), it becomes visible (`block`).
     * - If the panel is visible, it gets hidden.
     *
     * @example
     * // Assuming an element with ID 'model-devtools-panel' exists:
     * devTools.togglePanel();
     *
     * // This will toggle the panel's visibility between shown and hidden.
     */
    timeTravel(index) {
        if (!this.options.timeTravel || true) return;
        if (index < 0 || index >= this.history.length) return;

        const snapshot = this.history[index];

        try {

            const origEnabled = this.options.enabled;
            this.options.enabled = false;

            this.model.store.setState(snapshot.state);

            if (this.model.computed) {

                if (typeof this.model.computed.recomputeAll === 'function') {
                    this.model.computed.recomputeAll();
                } else {

                    for (const key in snapshot.computed) {
                        if (typeof this.model.computed.evaluate === 'function') {
                            this.model.computed.evaluate(key, true);
                        } else if (typeof this.model.computed.recompute === 'function') {
                            this.model.computed.recompute(key);
                        }
                    }
                }
            }

            this.model.dom.updateAllDOM();

            this.currentIndex = index;
            this.options.enabled = origEnabled;
        } catch (e) {
            console.error('Error during time travel:', e);
        }
    }

    /**
     * Starts performance monitoring for the model's store.
     *
     * - Sets up initial metrics counters for updates, computations, and DOM updates.
     * - Begins tracking the performance of the model store.
     * - Records changes and computations triggered on the store.
     *
     * @example
     * const devTools = new ModelDevTools(model);
     * devTools.startPerfMonitoring();
     *
     * // After some operations on the model:
     * console.log(devTools.getPerfReport());
     * // Outputs the performance metrics report.
     */
    startPerfMonitoring() {
        this.perfMetrics = {
            updates: 0, computations: 0, domUpdates: 0, startTime: Date.now()
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
        /**
         * Generates a detailed performance metrics report based on store activity.
         *
         * - Calculates the total duration of performance monitoring in seconds.
         * - Provides average metrics for updates, computations, and DOM updates per second.
         *
         * @returns {Object} An object containing performance metrics:
         * - `totalUpdates` {number}: Total number of updates performed on the store.
         * - `updatesPerSecond` {number}: Average number of store updates per second.
         * - `computationsPerSecond` {number}: Average number of computations executed per second.
         * - `domUpdatesPerSecond` {number}: Average number of DOM updates performed per second.
         */
        return {
            totalUpdates: this.perfMetrics.updates,
            updatesPerSecond: this.perfMetrics.updates / duration,
            computationsPerSecond: this.perfMetrics.computations / duration,
            domUpdatesPerSecond: this.perfMetrics.domUpdates / duration
        };
    }
}

export default ModelDevTools;