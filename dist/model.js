
/*!
 * Model v0.13.0
 * Build: 04.03.2025, 14:22:11
 * Copyright 2012-2025 by Serhii Pimenov
 * Licensed under MIT
 */


// src/event-emitter/event-emitter.js
var EventEmitter = class {
  /**
   * Initializes a new EventEmitter instance.
   * Creates an empty Map where:
   * - Keys are event names (strings)
   * - Values are Sets of callback functions
   */
  constructor() {
    this.events = /* @__PURE__ */ new Map();
  }
  /**
   * Registers a new event listener for the specified event.
   * - Creates new Set for event if it doesn't exist
   * - Adds callback to the Set of listeners
   * - Returns unsubscribe function for cleanup
   *
   * @param {string} eventName - Event identifier
   * @param {Function} callback - Event handler function
   * @returns {Function} Unsubscribe function
   */
  on(eventName, callback) {
    if (!this.events.has(eventName)) {
      this.events.set(eventName, /* @__PURE__ */ new Set());
    }
    this.events.get(eventName).add(callback);
    return () => this.off(eventName, callback);
  }
  /**
   * Removes a specific event listener.
   * - Safely handles non-existent events
   * - Removes only the specified callback
   * - Keeps other listeners for the same event intact
   *
   * @param {string} eventName - Event to unsubscribe from
   * @param {Function} callback - Listener to remove
   */
  off(eventName, callback) {
    if (this.events.has(eventName)) {
      this.events.get(eventName).delete(callback);
    }
  }
  /**
   * Triggers all listeners for the specified event.
   * - Safely handles non-existent events
   * - Executes each listener in try-catch block
   * - Continues execution even if one listener fails
   * - Logs errors without breaking execution
   *
   * @param {string} eventName - Event to trigger
   * @param {*} [data] - Optional data for listeners
   */
  emit(eventName, data) {
    if (this.events.has(eventName)) {
      this.events.get(eventName).forEach((callback) => {
        try {
          callback(data);
        } catch (e) {
          console.error(`Error when performing an event handler ${eventName}:`, e);
        }
      });
    }
  }
};
var event_emitter_default = EventEmitter;

// src/dev/dev-tools.style.js
var DevToolsStyle = `
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
            
            *::-webkit-scrollbar {
              width: 10px;
            }
            
            * {
              scrollbar-width: thin;
            }
            
            .devtools-section {
                padding: 8px;
                margin: 4px;
                border: 1px solid #444;
                cursor: pointer;
                hover: background-color: #333;
                font-size: 12px;
            }
            
            h3 {
                margin: 0;
                font-size: 14px;
                border-bottom: 1px solid #333;
                padding-bottom: 4px;
            }
        }
        
        #model-dev-tools-toggle-button {
            position: fixed;
            bottom: 10px;
            right: 10px;
            z-index: 9998;
            height: 36px;
            width: 36px;
            background: #444;
            color: white;
            border: none;
            border-radius: 4px;
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
        }        

        #model-devtools-time-travel-dialog {
            position: fixed;
            bottom: 0;
            right: 304px;
            background: #2a2a2a;
            border: 1px solid #444;
            border-radius: 4px;
            height: 400px;
            width: 300px;
            z-index: 10000;
            color: #fff;
            font-family: monospace;
            
            *::-webkit-scrollbar {
              width: 10px;
            }
            
            * {
              scrollbar-width: thin;
            }
            
            .time-travel-items {
                padding: 4px; 
                height: calc(100% - 35px); 
                overflow: auto;
                position: relative;
            }
            
            .time-travel-item {
                padding: 8px;
                margin: 4px;
                border: 1px solid #444;
                cursor: pointer;
                hover: background-color: #333;
                font-size: 12px;
                
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
`;
var dev_tools_style_default = DevToolsStyle;

// src/dev/dev-tools.js
var ModelDevTools = class {
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
    const panel = document.createElement("div");
    panel.id = "model-devtools-panel";
    panel.style.cssText = `display: none;`;
    const header = document.createElement("div");
    header.innerHTML = `
            ${dev_tools_style_default}
            <div class="dev-tools-header">
                <span>\u{1F6E0} Model DevTools</span>
                <div>
                    <button id="devtools-time-travel" title="Time Travel">\u23F1</button>
                    <button id="devtools-close" title="Close">\xD7</button>
                </div>
            </div>
        `;
    const content = document.createElement("div");
    content.style.cssText = `
            padding: 8px;
            height: calc(100% - 35px);
            overflow: auto;
        `;
    content.id = "model-devtools-content";
    panel.appendChild(header);
    panel.appendChild(content);
    document.body.appendChild(panel);
    this.createToggleButton();
    document.getElementById("devtools-close").onclick = () => this.togglePanel();
    document.getElementById("devtools-time-travel").onclick = () => this.showTimeTravelDialog();
  }
  /**
   * Displays the Time Travel dialog by:
   * - Creating or reusing existing dialog container
   * - Generating a reversed chronological list of snapshots
   * - Formatting snapshot data (timestamp, type, property, old/new values)
   * - Displaying changes in computed properties and value transitions
   */
  showTimeTravelDialog() {
    let dialog = document.getElementById("model-devtools-time-travel-dialog");
    if (!dialog) {
      dialog = document.createElement("div");
      dialog.id = "model-devtools-time-travel-dialog";
    }
    const statesList = [...this.history].reverse().map((snapshot, index) => `
            <div class="time-travel-item">
                <div>Time: ${new Date(snapshot.timestamp).toLocaleTimeString()}</div>
                <div>Type: ${snapshot.type}</div>
                <div>Property: ${snapshot.property || snapshot.event || snapshot.path || ""}</div>
                <div>Value: ${snapshot.type === "computed-update" ? snapshot.newValue : typeof snapshot.oldValue !== "undefined" && typeof snapshot.newValue !== "undefined" ? `${JSON.stringify(snapshot.oldValue)} -> ${JSON.stringify(snapshot.newValue)}` : JSON.stringify(snapshot.newValue || snapshot.value || "")}</div>
                <button style="display: none" onclick="window.__MODEL_DEVTOOLS__.timeTravel(${this.history.length - 1 - index})">Apply this state</button>
            </div>
        `).join("");
    dialog.innerHTML = `
            <div class="dev-tools-header">
                <span>\u23F1 Time Travel</span>
                <button style="margin-left: auto" onclick="this.parentElement.parentElement.remove()">\xD7</button>
            </div>
            <div class="time-travel-items">${statesList || "Nothing to show!"}</div>
        `;
    document.body.appendChild(dialog);
  }
  /**
   * Creates a toggle button for the Model DevTools panel.
   * The button is appended to the page and provides
   * functionality to show or hide the dev tools panel.
   */
  createToggleButton() {
    const button = document.createElement("button");
    button.id = "model-dev-tools-toggle-button";
    button.textContent = "\u{1F6E0}";
    button.title = "Model DevTools";
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
    this.model.store.on("change", (data) => {
      this.logChange({
        type: "data-change",
        path: data.path,
        oldValue: data.oldValue,
        newValue: data.newValue,
        timestamp: Date.now()
      });
    });
    this.model.store.on("*", (eventName, data) => {
      if (eventName !== "change" && eventName !== "compute" && eventName !== "arrayChange") {
        this.logChange({
          type: "store-event",
          event: eventName,
          data,
          timestamp: Date.now()
        });
      }
    });
    this.model.on("*", (eventName, data) => {
      if (eventName !== "change" && eventName !== "compute") {
        this.logChange({
          type: "model-event",
          event: eventName,
          data,
          timestamp: Date.now()
        });
      }
    });
    this.model.store.on("compute", (data) => {
      this.logChange({
        type: "computed-update",
        property: data.key,
        dependencies: Array.from(data.dependencies),
        newValue: data.value,
        timestamp: Date.now()
      });
    });
    this.model.store.on("arrayChange", (data) => {
      this.logChange({
        type: "array-operation",
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
      ...entry,
      state: JSON.parse(JSON.stringify(this.model.data)),
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
    const content = document.getElementById("model-devtools-content");
    if (!content) return;
    const formatValue = (value) => {
      if (value === void 0) return "undefined";
      if (value === null) return "null";
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
            </div>
`;
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
    const timeTravelDialog = document.getElementById("model-devtools-time-travel-dialog");
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
        dependencies[key] = Array.from(value).map((dep) => ({
          type: dep.type,
          element: dep.element.tagName
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
    if (typeof this.model.computed.all === "function") {
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
      if (this.model.computed && typeof this.model.computed[key] !== "undefined") {
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
    const panel = document.getElementById("model-devtools-panel");
    if (panel) {
      panel.style.display = panel.style.display === "none" ? "block" : "none";
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
        if (typeof this.model.computed.recomputeAll === "function") {
          this.model.computed.recomputeAll();
        } else {
          for (const key in snapshot.computed) {
            if (typeof this.model.computed.evaluate === "function") {
              this.model.computed.evaluate(key, true);
            } else if (typeof this.model.computed.recompute === "function") {
              this.model.computed.recompute(key);
            }
          }
        }
      }
      this.model.dom.updateAllDOM();
      this.currentIndex = index;
      this.options.enabled = origEnabled;
    } catch (e) {
      console.error("Error during time travel:", e);
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
      updates: 0,
      computations: 0,
      domUpdates: 0,
      startTime: Date.now()
    };
    this.model.store.on("change", () => {
      this.perfMetrics.updates++;
    });
    this.model.store.on("compute", () => {
      this.perfMetrics.computations++;
    });
  }
  getPerfReport() {
    const duration = (Date.now() - this.perfMetrics.startTime) / 1e3;
    return {
      totalUpdates: this.perfMetrics.updates,
      updatesPerSecond: this.perfMetrics.updates / duration,
      computationsPerSecond: this.perfMetrics.computations / duration,
      domUpdatesPerSecond: this.perfMetrics.domUpdates / duration
    };
  }
};
var dev_tools_default = ModelDevTools;

// src/middleware/middleware.js
var MiddlewareManager = class {
  /**
   * Creates a new MiddlewareManager instance.
   * Initializes empty array for middleware functions.
   */
  constructor() {
    this.middlewares = [];
  }
  /**
   * Registers a new middleware function.
   * - Validates that middleware is a function
   * - Logs error if invalid middleware provided
   * - Adds valid middleware to execution chain
   *
   * @param {Function} middleware - Function(context, next)
   * @returns {void}
   * @throws {Error} Logs error for non-function middleware
   */
  use(middleware) {
    if (typeof middleware !== "function") {
      console.error("MIDDLEWARE should be a function!");
      return;
    }
    this.middlewares.push(middleware);
  }
  /**
   * Executes middleware chain sequentially.
   * - Maintains execution order using index counter
   * - Creates and passes next() function to each middleware
   * - Supports async middleware execution
   * - Preserves and returns modified context
   * - Stops chain when no more middleware exists
   *
   * @param {Object} context - Data passed through middleware chain
   * @returns {Promise<Object>} Modified context after chain completion
   */
  async process(context) {
    let index = -1;
    const next = async () => {
      index++;
      if (index < this.middlewares.length) {
        await this.middlewares[index](context, next);
      }
    };
    await next();
    return context;
  }
};
var middleware_default = MiddlewareManager;

// src/reactive/reactive-store.js
var ReactiveStore = class extends event_emitter_default {
  /**
   * Initializes a new ReactiveStore.
   * - Creates reactive proxy for state management
   * - Sets up watchers for property observation
   * - Stores previous state for change detection
   * - Initializes middleware system for state updates
   *
   * @param {Object} [initialState={}] - Initial store state
   * @property {Proxy} state - Reactive state object
   * @property {Map} watchers - Property change observers
   * @property {Object} previousState - Last known state
   * @property {MiddlewareManager} middleware - State update pipeline
   */
  constructor(initialState = {}) {
    super();
    this.state = this.createReactiveProxy(initialState);
    this.watchers = /* @__PURE__ */ new Map();
    this.previousState = JSON.parse(JSON.stringify(initialState));
    this.middleware = new middleware_default();
  }
  /**
   * Registers state change middleware.
   * Middleware receives context object with:
   * - prop: Changed property name
   * - oldValue: Previous value
   * - newValue: New value
   * - preventDefault: Control flag
   *
   * @param {Function} middleware - Handler(context, next)
   */
  use(middleware) {
    this.middleware.use(middleware);
  }
  /**
   * Creates reactive proxy for state objects.
   * Features:
   * - Special handling for arrays via separate proxy
   * - Deep reactivity for nested objects
   * - Property path tracking
   * - Value validation support
   * - Value formatting support
   * - Middleware integration
   * - Change prevention capability
   *
   * @param {Object|Array} obj - Target object
   * @param {string} [path=''] - Property path
   * @returns {Proxy} Reactive proxy
   */
  createReactiveProxy(obj, path = "") {
    if (Array.isArray(obj)) {
      return this.createArrayProxy(obj, path);
    }
    return new Proxy(obj, {
      get: (target, prop) => {
        if (typeof prop === "symbol") {
          return target[prop];
        }
        const value = target[prop];
        const fullPath = path ? `${path}.${prop}` : prop;
        if (value && typeof value === "object") {
          return this.createReactiveProxy(value, fullPath);
        }
        return value;
      },
      set: async (target, prop, value) => {
        if (typeof prop === "symbol") {
          target[prop] = value;
          return true;
        }
        const fullPath = path ? `${path}.${prop}` : prop;
        const oldValue = target[prop];
        if (oldValue === value) {
          return true;
        }
        if (this.validators?.has(`${fullPath}`)) {
          const isValid = this.validators.get(`${fullPath}`)(value);
          if (!isValid) return false;
        }
        if (this.formatters?.has(`${fullPath}`)) {
          value = this.formatters.get(`${fullPath}`)(value);
        }
        if (value && typeof value === "object") {
          value = this.createReactiveProxy(value, fullPath);
        }
        const context = {
          prop,
          oldValue,
          newValue: value,
          preventDefault: false
        };
        await this.middleware.process(context);
        if (context.preventDefault) {
          return true;
        }
        target[prop] = value;
        this.emit("change", {
          path: fullPath,
          oldValue,
          newValue: value
        });
        if (this.watchers.has(fullPath)) {
          this.watchers.get(fullPath).forEach((callback) => {
            callback(value, oldValue);
          });
        }
        return true;
      },
      deleteProperty: (target, prop) => {
        if (typeof prop === "symbol") {
          return delete target[prop];
        }
        const fullPath = path ? `${path}.${prop}` : prop;
        const oldValue = target[prop];
        const result = delete target[prop];
        if (result) {
          this.emit("delete", {
            path: fullPath,
            oldValue
          });
          if (this.watchers.has(fullPath)) {
            this.watchers.get(fullPath).forEach((callback) => {
              callback(void 0, oldValue);
            });
          }
        }
        return result;
      }
    });
  }
  /**
   * Creates a reactive proxy for an array.
   * The proxy intercepts standard array methods (e.g., push, pop, shift, etc.)
   * to enable detection and reaction to structural changes in the array.
   * It also ensures that array elements are made reactive.
   *
   * @param {Array} array - The array to be proxied.
   * @param {string} path - The path to the current property in the state tree.
   *
   * @returns {Proxy} A proxy that wraps the given array to make it reactive.
   */
  createArrayProxy(array, path) {
    return new Proxy(array, {
      get: (target, prop) => {
        if (typeof prop === "symbol") {
          return target[prop];
        }
        const value = target[prop];
        if (typeof value === "function" && ["push", "pop", "shift", "unshift", "splice", "sort", "reverse"].includes(prop)) {
          return (...args) => {
            const oldValue = [...target];
            const result = target[prop].apply(target, args);
            const context = {
              prop: path,
              oldValue,
              newValue: target,
              method: prop,
              args,
              preventDefault: false
            };
            this.middleware.process(context).then(() => {
              if (!context.preventDefault) {
                this.emit("arrayChange", {
                  path,
                  method: prop,
                  args,
                  oldValue,
                  newValue: target
                });
                this.emit("change", {
                  path,
                  oldValue,
                  newValue: target,
                  method: prop,
                  args
                });
                if (this.watchers.has(path)) {
                  this.watchers.get(path).forEach((callback) => {
                    callback(target, oldValue);
                  });
                }
              }
            });
            return result;
          };
        }
        if (typeof prop !== "symbol" && !isNaN(Number(prop))) {
          if (value && typeof value === "object") {
            return this.createReactiveProxy(value, `${path}[${prop}]`);
          }
        }
        return value;
      },
      set: async (target, prop, value) => {
        if (typeof prop === "symbol") {
          target[prop] = value;
          return true;
        }
        const fullPath = path ? `${path}.${prop}` : prop;
        const oldValue = target[prop];
        if (oldValue === value) {
          return true;
        }
        if (this.validators?.has(fullPath)) {
          const isValid = this.validators.get(fullPath)(value);
          if (!isValid) return false;
        }
        if (this.formatters?.has(fullPath)) {
          value = this.formatters.get(fullPath)(value);
        }
        target[prop] = value;
        if (value && typeof value === "object") {
          value = this.createReactiveProxy(value, `${path}[${prop}]`);
        }
        const context = {
          prop,
          oldValue,
          newValue: value,
          preventDefault: false
        };
        await this.middleware.process(context);
        if (context.preventDefault) {
          return true;
        }
        target[prop] = value;
        this.middleware.process(context).then(() => {
          if (!context.preventDefault) {
            this.emit("arrayChange", {
              path: fullPath,
              method: null,
              args: null,
              oldValue,
              newValue: value
            });
            this.emit("change", {
              path: fullPath,
              oldValue,
              newValue: value,
              arrayIndex: Number(prop)
            });
            if (this.watchers.has(fullPath)) {
              this.watchers.get(fullPath).forEach((callback) => {
                callback(value, oldValue);
              });
            }
          }
        });
        return true;
      }
    });
  }
  /**
   * Applies the specified array method (e.g., push, pop, splice) on the array
   * located at the given path in the state tree. The function ensures
   * that the changes are reactive by emitting appropriate events and invoking watchers.
   *
   * @param {string} path - The path to the array in the state tree.
   * @param {string} method - The name of the array method to apply (e.g., 'push', 'pop').
   * @param {...any} args - Arguments to pass to the array method.
   *
   * @returns {any} The result of applying the array method to the array.
   */
  applyArrayMethod(path, method, ...args) {
    const array = this.get(path);
    if (!Array.isArray(array)) {
      console.error(`\u041F\u0443\u0442\u044C ${path} \u043D\u0435 \u044F\u0432\u043B\u044F\u0435\u0442\u0441\u044F \u043C\u0430\u0441\u0441\u0438\u0432\u043E\u043C!`);
      return false;
    }
    const oldArray = [...array];
    const result = array[method].apply(array, args);
    this.emit("arrayChange", {
      path,
      method,
      args,
      oldValue: oldArray,
      newValue: [...array]
    });
    this.emit("change", {
      path,
      oldValue: oldArray,
      newValue: [...array]
    });
    if (this.watchers.has(path)) {
      this.watchers.get(path).forEach((callback) => {
        callback([...array], oldArray);
      });
    }
    return result;
  }
  /**
   * Watches for changes to an array located at the specified path in the state tree
   * and applies the provided callback to make modifications.
   * Emitted events ensure that watchers are notified and reactivity is maintained.
   *
   * @param {string} path - The path to the array in the state tree.
   * @param {Function} callback - A function to modify the array.
   *                               Receives the array as an argument and applies changes to it.
   *
   * @returns {any} The result of the callback function applied to the array.
   */
  applyArrayChanges(path, callback) {
    const array = this.get(path);
    if (!Array.isArray(array)) {
      console.error(`The path ${path} is not an array!`);
      return false;
    }
    const oldArray = [...array];
    const result = callback(array);
    this.emit("arrayChange", {
      path,
      method: "custom",
      args: null,
      oldValue: oldArray,
      newValue: [...array]
    });
    this.emit("change", {
      path,
      oldValue: oldArray,
      newValue: [...array]
    });
    if (this.watchers.has(path)) {
      this.watchers.get(path).forEach((callback2) => {
        callback2([...array], oldArray);
      });
    }
    return result;
  }
  /**
   * Detects changes between two arrays, identifying items that were added, removed,
   * or moved. This function compares items by their JSON stringified values.
   *
   * @param {Array} newArray - The new array to compare.
   * @param {Array} [oldArray=[]] - The old array to compare against. Defaults to an empty array.
   *
   * @returns {Object} An object containing the changes between the arrays.
   */
  detectArrayChanges(newArray, oldArray = []) {
    const changes = {
      added: [],
      removed: [],
      moved: []
    };
    for (let i = 0; i < newArray.length; i++) {
      const item = newArray[i];
      const oldIndex = oldArray.findIndex(
        (oldItem) => JSON.stringify(oldItem) === JSON.stringify(item)
      );
      if (oldIndex === -1) {
        changes.added.push({ index: i, item });
      } else if (oldIndex !== i) {
        changes.moved.push({ oldIndex, newIndex: i, item });
      }
    }
    for (let i = 0; i < oldArray.length; i++) {
      const item = oldArray[i];
      const newIndex = newArray.findIndex(
        (newItem) => JSON.stringify(newItem) === JSON.stringify(item)
      );
      if (newIndex === -1) {
        changes.removed.push({ index: i, item });
      }
    }
    return changes;
  }
  /**
   * Watches for changes to the specified path in the state tree
   * and allows the addition of callbacks that execute when changes occur.
   *
   * @param {string} path - The path in the state tree to watch for changes.
   * @param {Function} callback - A function to execute when the value at the path changes.
   *                                The callback receives the new and old values as parameters.
   *
   * @returns {Function} A function to unsubscribe the callback from the watcher.
   */
  watch(path, callback) {
    if (!this.watchers.has(path)) {
      this.watchers.set(path, /* @__PURE__ */ new Set());
    }
    this.watchers.get(path).add(callback);
    return () => {
      if (this.watchers.has(path)) {
        this.watchers.get(path).delete(callback);
      }
    };
  }
  /**
   * Retrieves the value at the specified path in the state tree.
   * @param {string} [path] - The dot-delimited path to the desired value within the state tree.
   * @returns {any} - The value at the specified path or `undefined` if the path does not exist.
   */
  get(path) {
    if (!path) return this.state;
    const parts = path.split(".");
    let value = this.state;
    for (const part of parts) {
      if (value === void 0 || value === null) {
        return void 0;
      }
      value = value[part];
    }
    return value;
  }
  /**
   * Sets a new value at the specified path in the state tree.
   * @param {String} path - The dot-delimited path to the desired value within the state tree.
   * @param {any} value - The new value to set at the specified path.
   */
  set(path, value) {
    const parts = path.split(".");
    let current = this.state;
    for (let i = 0; i < parts.length - 1; i++) {
      if (current[parts[i]] === void 0) {
        current[parts[i]] = {};
      }
      current = current[parts[i]];
    }
    current[parts[parts.length - 1]] = value;
    return value;
  }
  /**
   * Executes the given updater as a batch operation on the state.
   *
   * If the `updater` is a function, it will be invoked with the state as an argument,
   * allowing for multiple updates within a single call. If the `updater` is an object,
   * its key-value pairs will be used to update specific paths in the state.
   *
   * After the batch operation completes, an event (`batchUpdate`) is emitted containing
   * both the previous state (before changes) and the current state (after changes).
   *
   * @param {Function|Object} updater - Either a function to modify the state or an object where keys represent
   *                                    paths (dot-delimited) and values are the new values to set for those paths.
   */
  batch(updater) {
    this.previousState = JSON.parse(JSON.stringify(this.state));
    if (typeof updater === "function") {
      updater(this.state);
    } else if (typeof updater === "object") {
      Object.entries(updater).forEach(([path, value]) => {
        this.set(path, value);
      });
    }
    this.emit("batchComplete", {
      previousState: this.previousState,
      currentState: this.state
    });
  }
  /**
   * Retrieves the current state tree.
   * @returns {Object} The entire state object.
   */
  getState() {
    return this.state;
  }
  /**
   * Retrieves the previous state of the state tree.
   *
   * This method returns the state as it was prior to the last update,
   * enabling comparison or rollback operations if needed.
   *
   * @returns {Object} The previous state object.
   */
  getPreviousState() {
    return this.previousState;
  }
  /**
   * Converts the current state tree to a JSON string.
   *
   * This method serializes the entire state tree into a JSON-formatted string,
   * which can be used for storage, transmission, or debugging purposes.
   *
   * @returns {string} A JSON string representation of the current state.
   */
  toJSON() {
    return JSON.stringify(this.state);
  }
  /**
   * Reconstructs the state tree from a JSON string.
   *
   * This method accepts a JSON-formatted string representing the state,
   * replaces the current state with the contents of the JSON, and emits a `restore` event
   * to notify listeners about the restoration operation. The previous state is preserved
   * for potential comparisons or rollback operations.
   *
   * @param {string} json - A JSON-formatted string representing the new state.
   */
  fromJSON(json) {
    const newState = JSON.parse(json);
    this.previousState = JSON.parse(JSON.stringify(this.state));
    Object.keys(this.state).forEach((key) => {
      delete this.state[key];
    });
    Object.entries(newState).forEach(([key, value]) => {
      this.state[key] = value;
    });
    this.emit("restore", {
      previousState: this.previousState,
      currentState: this.state
    });
  }
  /**
   * Adds a validator function for a specific property in the state tree.
   *
   * The validator function should accept the new value as a parameter
   * and return `true` if the value is valid, or `false` if it is invalid.
   *
   * @param {string} propertyPath - The dot-delimited path to the property in the state tree to validate.
   * @param {Function} validator - A function that checks the validity of the property value.
   */
  addValidator(propertyPath, validator) {
    if (!this.validators) {
      this.validators = /* @__PURE__ */ new Map();
    }
    this.validators.set(propertyPath, validator);
  }
  /**
   * Adds a formatter function for a specific property in the state tree.
   *
   * The formatter function modifies the value of a property before it is returned.
   * This can be helpful when the stored value needs to be presented in a specific format.
   *
   * @param {string} propertyPath - The dot-delimited path to the property in the state tree to format.
   * @param {Function} formatter - A function that transforms the value of the property.
   *                                The function receives the current value as a parameter
   *                                and returns the formatted value.
   */
  addFormatter(propertyPath, formatter) {
    if (!this.formatters) {
      this.formatters = /* @__PURE__ */ new Map();
    }
    this.formatters.set(propertyPath, formatter);
  }
  /**
   * Validates if the provided path exists in the state tree.
   *
   * This method checks whether the specified dot-delimited path
   * in the state tree resolves to a defined value.
   *
   * @param {string} path - The dot-delimited path to validate.
   * @returns {boolean} - `true` if the path exists and has a defined value, `false` otherwise.
   */
  isValidPath(path) {
    try {
      const value = this.get(path);
      return value !== void 0;
    } catch (e) {
      return false;
    }
  }
  /**
   * Destroys the current state object and clears all associated watchers and previous states.
   *
   * This method is useful for cleanup operations, ensuring no residual state,
   * watchers, or references are left in memory.
   */
  destroy() {
    this.state = null;
    this.watchers.clear();
    this.previousState = null;
  }
};

// src/dom/loop-manager.js
var LoopManager = class {
  /**
   * Creates a new instance of LoopManager.
   *
   * @param {Object} domManager - Manages DOM operations and template bindings
   * @param {Object} model - Contains the data store and bindings
   * @property {Map} loops - Stores array loop templates and configurations
   * @property {Array} loopsIn - Stores object loop configurations and elements
   */
  constructor(domManager, model) {
    this.domManager = domManager;
    this.model = model;
    this.loops = /* @__PURE__ */ new Map();
    this.loopsIn = [];
  }
  /**
   * Parses and initializes both array and object loops in the DOM.
   *
   * For data-for loops:
   * - Validates loop expression syntax (item[, index] in array)
   * - Creates template clones for future updates
   * - Registers array dependencies for reactive updates
   * - Performs initial loop rendering
   *
   * For data-in loops:
   * - Validates loop expression (key in object)
   * - Stores original templates
   * - Creates placeholder comments for loop position
   * - Hides original elements
   * - Performs initial object iteration rendering
   *
   * @param {HTMLElement} rootElement - Root element to scan for loop directives
   * @throws {Error} Logs error for invalid loop expressions
   */
  parseLoops(rootElement) {
    const loopElements = rootElement.querySelectorAll("[data-for]");
    loopElements.forEach((element) => {
      const expression = element.getAttribute("data-for").trim();
      const matches = expression.match(/^\s*(\w+)(?:\s*,\s*(\w+))?\s+in\s+(\w+(?:\.\w+)*)\s*$/);
      if (!matches) {
        console.error("Invalid expression format data-for:", expression);
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
      this.domManager.registerDomDependency(arrayPath, element, {
        type: "loop",
        arrayPath
      });
      this.updateLoop(element);
    });
    const inLoops = rootElement.querySelectorAll("[data-in]");
    inLoops.forEach((element) => {
      const attributeValue = element.getAttribute("data-in");
      const match = attributeValue.match(/^\s*(\w+)\s+in\s+(\S+)\s*$/);
      if (!match) {
        console.error(`Invalid data-in syntax: ${attributeValue}`);
        return;
      }
      const [_, keyVar, objectPath] = match;
      const template = element.innerHTML;
      const parent = element.parentNode;
      const placeholder = document.createComment(`data-in: ${attributeValue}`);
      element.style.display = "none";
      parent.insertBefore(placeholder, element);
      this.loopsIn.push({
        type: "in",
        originalElement: element,
        template,
        placeholder,
        objectPath,
        keyVar,
        elements: []
      });
      const objectData = this.model.store.get(objectPath);
      if (objectData && typeof objectData === "object" && !Array.isArray(objectData)) {
        this.updateInLoop(this.loopsIn[this.loopsIn.length - 1], objectData);
      }
    });
  }
  /**
   * Updates the content of object-based loops (`data-in`) when the associated object data changes.
   *
   * This method clears the current DOM elements generated for the loop, then iterates through
   * the provided `objectData` to render new elements based on the loop's template. It uses the
   * `keyVar` for the object's keys and binds the DOM elements for further updates.
   *
   * @param {Object} loop - The loop configuration containing details such as the template,
   *                        placeholder, and object path.
   * @param {Object} objectData - The new object data used to generate loop elements.
   */
  updateInLoop(loop, objectData) {
    loop.elements.forEach((el) => el.remove());
    loop.elements = [];
    if (!objectData || typeof objectData !== "object" || Array.isArray(objectData)) {
      return;
    }
    Object.keys(objectData).forEach((key) => {
      const newElement = loop.originalElement.cloneNode(true);
      newElement.removeAttribute("data-in");
      newElement.style.display = "";
      const itemContext = {
        [loop.keyVar]: key
      };
      newElement.innerHTML = this.processTemplate(loop.template, objectData, key, itemContext);
      loop.placeholder.parentNode.insertBefore(newElement, loop.placeholder.nextSibling);
      loop.elements.push(newElement);
      this.domManager.bindDOM(newElement);
    });
  }
  /**
   * Processes a template string by replacing placeholders with computed values
   * based on the given object data, key, and context.
   *
   * Placeholder syntax: `{{ path }}`, where `path` can refer to variable keys,
   * object properties, or dynamic expressions.
   *
   * @param {string} template - The template string containing placeholders.
   * @param {Object} objectData - The object data used for resolving placeholders.
   * @param {string} key - The current key in the object data.
   * @param {Object} itemContext - The context containing additional data such as the key variable.
   * @returns {string} - The processed template string with placeholders replaced by their respective values.
   */
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
        if (obj && typeof obj === "object") {
          return obj[key] !== void 0 ? obj[key] : "";
        }
      }
      const value = this.model.store.get(path);
      if (value !== void 0) {
        return value;
      }
      return "";
    });
  }
  /**
   * Updates all the loops (`data-for` and `data-in`) when the data in the store changes.
   *
   * Specifically:
   * - Updates array-based loops (`data-for`) if the associated array data changes.
   * - Updates object-based loops (`data-in`) if the associated object or its child properties change.
   *
   * @param {string} path - The path of the data in the store that has changed.
   * @param {*} value - The new value at the given path.
   */
  updateLoops(path, value) {
    this.loops.forEach((loopInfo, element) => {
      if (loopInfo.arrayPath === path) {
        this.updateLoop(element);
      }
    });
    this.loopsIn.forEach((loop) => {
      if (loop.type === "in" && (loop.objectPath === path || path.startsWith(loop.objectPath + "."))) {
        const objectData = this.model.store.get(loop.objectPath);
        if (objectData && typeof objectData === "object") {
          this.updateInLoop(loop, objectData);
        }
      }
    });
  }
  /**
   * Updates the loops and maintains synchronization of the DOM elements
   * based on changes in the store data. Handles both 'data-for' (array-based)
   * and 'data-in' (object-based) loops.
   *
   * - For 'data-for' loops: Refreshes the associated elements when the array changes.
   * - For 'data-in' loops: Synchronizes the DOM with the changes in the object.
   *
   * @param {string} path - Path of the changed data in the store.
   * @param {*} value - New value of the updated data.
   */
  updateLoop(element) {
    const loopInfo = this.loops.get(element) || this.loopsIn.find((loop) => loop.originalElement === element)[0];
    if (!loopInfo) {
      console.error("\u0418\u043D\u0444\u043E\u0440\u043C\u0430\u0446\u0438\u044F \u043E \u0446\u0438\u043A\u043B\u0435 \u043D\u0435 \u043D\u0430\u0439\u0434\u0435\u043D\u0430 \u0434\u043B\u044F \u044D\u043B\u0435\u043C\u0435\u043D\u0442\u0430");
      return;
    }
    const { template, itemName, indexName, arrayPath, parentNode } = loopInfo;
    const array = this.model.store.get(arrayPath);
    if (!Array.isArray(array)) {
      console.error("\u0417\u043D\u0430\u0447\u0435\u043D\u0438\u0435 \u043D\u0435 \u044F\u0432\u043B\u044F\u0435\u0442\u0441\u044F \u043C\u0430\u0441\u0441\u0438\u0432\u043E\u043C:", array);
      return;
    }
    const generated = parentNode.querySelectorAll(`[data-generated-for="${arrayPath}"]`);
    generated.forEach((el) => el.remove());
    array.forEach((item, index) => {
      const newNode = template.cloneNode(true);
      newNode.style.display = "";
      newNode.removeAttribute("data-for");
      newNode.setAttribute("data-generated-for", arrayPath);
      newNode.setAttribute("data-item-index", index);
      this.domManager.processTemplateNode(newNode, {
        [itemName]: item,
        [indexName || "index"]: index
      });
      parentNode.insertBefore(newNode, element);
    });
    element.style.display = "none";
  }
  /**
   * Partially updates a single DOM element within a loop based on changes in
   * the associated array. Specifically:
   * - If the changed index is provided, updates only the element at that index.
   * - If no changed index is provided or if the array length does not match
   *   the number of generated elements, falls back to a full loop update.
   *
   * @param {HTMLElement} element - The loop's original template element.
   * @param {string} arrayPath - The path to the array in the data store associated with this loop.
   * @param {*} changedValue - The updated value in the array (optional).
   * @param {number} changedIndex - The index of the updated value in the array (optional).
   */
  updateLoopPart(element, arrayPath, changedValue, changedIndex) {
    const loopInfo = this.loops.get(element);
    if (!loopInfo) return;
    const { template, itemName, indexName, parentNode } = loopInfo;
    const array = this.model.store.get(arrayPath);
    if (!Array.isArray(array)) return;
    const generated = Array.from(
      parentNode.querySelectorAll(`[data-generated-for="${arrayPath}"]`)
    );
    if (changedIndex === void 0 || generated.length !== array.length) {
      return this.updateLoop(element);
    }
    const elementToUpdate = generated[changedIndex];
    if (elementToUpdate) {
      const newNode = template.cloneNode(true);
      this.domManager.processTemplateNode(newNode, {
        [itemName]: array[changedIndex],
        [indexName || "index"]: changedIndex
      });
      while (elementToUpdate.firstChild) {
        elementToUpdate.removeChild(elementToUpdate.firstChild);
      }
      while (newNode.firstChild) {
        elementToUpdate.appendChild(newNode.firstChild);
      }
      Array.from(newNode.attributes).forEach((attr) => {
        elementToUpdate.setAttribute(attr.name, attr.value);
      });
    }
  }
  /**
   * Returns an object containing the tracked loops in the current instance.
   *
   * @returns {Object} An object with two properties:
   * - `for`: A Map of loops associated with array-based (`data-for`) rendering.
   * - `in`: An array of loops associated with object-based (`data-in`) rendering.
   */
  getLoops() {
    return {
      "for": this.loops,
      "in": this.loopsIn
    };
  }
  /**
   * Destroys all tracked loops by clearing the internal Map of `data-for` loops.
   *
   * This method should be called when the instance is no longer needed
   * to release memory and cleanup loop references.
   */
  destroy() {
    this.loops.clear();
    this.loopsIn = [];
  }
};

// src/dom/conditional-manager.js
var ConditionalManager = class {
  /**
   * Initializes a new instance of the ConditionalManager class.
   *
   * @constructor
   * @param {Object} dom - The root DOM element or DOM-related utilities.
   * @param {Object} model - The data model containing state (e.g., `store` or `data`).
   */
  constructor(dom, model) {
    this.dom = dom;
    this.model = model;
    this.dependencies = /* @__PURE__ */ new Map();
    this.conditionalGroups = [];
    this.subscribe();
  }
  /**
   * Subscribes to the model's store 'change' event to automatically update
   * affected conditional groups when data changes.
   * - Listens for store changes
   * - Identifies affected groups using getGroupsByPath
   * - Triggers updates for affected conditional groups
   *
   * @method subscribe
   * @private
   */
  subscribe() {
    this.model.store.on("change", (data) => {
      const dependentGroups = this.getGroupsByPath(data.path);
      dependentGroups.forEach((group) => {
        this.updateConditionalGroup(group);
      });
    });
  }
  /**
   * Finds all conditional groups that depend on a specific model path.
   * - Uses Set to avoid duplicate groups
   * - Checks direct path matches and path prefix matches
   * - Filters groups based on their expressions
   *
   * @param {string} path - The model path to check dependencies against
   * @returns {Array} Array of unique conditional groups dependent on the path
   * @private
   */
  getGroupsByPath(path) {
    if (!path) {
      return [];
    }
    const result = /* @__PURE__ */ new Set();
    this.conditionalGroups.forEach((group) => {
      const hasDependency = group.some((item) => {
        if (!item.expression) return false;
        return item.expression.includes(path) || path.startsWith(this.extractBasePath(item.expression));
      });
      if (hasDependency) {
        result.add(group);
      }
    });
    return Array.from(result);
  }
  /**
   * Extracts the base path from an expression using regex pattern matching.
   * - Matches valid JavaScript variable names
   * - Returns the first match or empty string
   * - Valid names start with letter/underscore followed by alphanumeric/underscore
   *
   * @param {string} expression - Expression to analyze
   * @returns {string} First valid variable name or empty string
   * @private
   */
  extractBasePath(expression) {
    const matches = expression.match(/[a-zA-Z_][a-zA-Z0-9_]*/g);
    return matches ? matches[0] : "";
  }
  /**
   * Parses and creates a map of conditional elements (`data-if`, `data-else-if`, and `data-else`)
   * within the given `rootElement`. Groups related conditional elements and attaches
   * them to the `conditionalGroups` property for dynamic evaluation.
   *
   * This method identifies `data-if`, `data-else-if`, and `data-else` attributes in the DOM and
   * ensures their relationships are correctly established (e.g., ensuring `data-else` elements have
   * preceding `data-if` or `data-else-if` elements). It also handles invalid sequences of attributes
   * and logs warnings for cases where a `data-else` does not follow valid prerequisites.
   *
   * After parsing and grouping, conditional groups are evaluated, and their dependencies
   * are registered for reactive re-evaluation when relevant model paths change.
   *
   * @method parseConditionals
   * @param {Element} rootElement - The root DOM element to scan for conditional attributes.
   * @public
   */
  parseConditionals(rootElement) {
    const nodes = rootElement.querySelectorAll("[data-if],[data-else-if],[data-else]");
    let currentGroup = [];
    const groups = [];
    nodes.forEach((node) => {
      if (node.hasAttribute("data-if")) {
        if (currentGroup.length) {
          groups.push(currentGroup);
        }
        currentGroup = [{
          element: node,
          type: "if",
          expression: node.getAttribute("data-if")
        }];
      } else if (node.hasAttribute("data-else-if")) {
        if (currentGroup.length && this.isAdjacentNode(currentGroup[currentGroup.length - 1].element, node)) {
          currentGroup.push({
            element: node,
            type: "else-if",
            expression: node.getAttribute("data-else-if")
          });
        } else {
          if (currentGroup.length) {
            groups.push(currentGroup);
          }
          currentGroup = [{
            element: node,
            type: "if",
            expression: node.getAttribute("data-else-if")
          }];
        }
      } else if (node.hasAttribute("data-else")) {
        if (currentGroup.length && this.isAdjacentNode(currentGroup[currentGroup.length - 1].element, node)) {
          currentGroup.push({
            element: node,
            type: "else",
            expression: null
          });
          groups.push(currentGroup);
          currentGroup = [];
        } else {
          console.warn("data-else \u0431\u0435\u0437 \u043F\u0440\u0435\u0434\u0448\u0435\u0441\u0442\u0432\u0443\u044E\u0449\u0435\u0433\u043E data-if \u0438\u043B\u0438 data-else-if", node);
        }
      }
    });
    if (currentGroup.length) {
      groups.push(currentGroup);
    }
    this.conditionalGroups = groups;
    groups.forEach((group) => this.updateConditionalGroup(group));
    this.setupDependencies(nodes);
  }
  /**
   * Checks if two DOM nodes are adjacent siblings, ignoring whitespace nodes.
   *
   * This method iterates over the sibling nodes of `node1` until it encounters
   * either `node2` (indicating adjacency) or another element node that is not
   * a whitespace text node (indicating they are not adjacent).
   *
   * @param {Node} node1 - The first DOM node.
   * @param {Node} node2 - The second DOM node to check adjacency with.
   * @returns {boolean} `true` if `node2` is an adjacent sibling of `node1`, ignoring whitespace; otherwise `false`.
   * @private
   */
  isAdjacentNode(node1, node2) {
    let current = node1.nextSibling;
    while (current) {
      if (current === node2) return true;
      if (current.nodeType === 1 && !this.isWhitespaceNode(current)) return false;
      current = current.nextSibling;
    }
    return false;
  }
  /**
   * Determines if a given DOM node is a whitespace text node.
   *
   * A whitespace text node is a text node (nodeType === 3)
   * whose content consists only of whitespace characters (spaces, tabs, newlines).
   *
   * @param {Node} node - The DOM node to check.
   * @returns {boolean} `true` if the node is a whitespace text node; otherwise `false`.
   * @private
   */
  isWhitespaceNode(node) {
    return node.nodeType === 3 && node.textContent.trim() === "";
  }
  /**
   * Evaluates and updates the visibility of elements within a group of conditionals.
   *
   * A group represents a logical chain of `data-if`, `data-else-if`, and `data-else` elements.
   * This method determines the first condition in the group that evaluates to `true`
   * and sets the corresponding element to be displayed while hiding others.
   *
   * @param {Array<Object>} group - An array representing a logical group of conditionals.
   * Each object in the array contains:
   *    - {Element} element: The DOM element.
   *    - {string} type: The type of conditional ('if', 'else-if', 'else').
   *    - {string|null} expression: The conditional expression, null for 'else'.
   */
  updateConditionalGroup(group) {
    const context = this.model && this.model.store ? { ...this.model.store.getState() } : this.model && this.model.data ? this.model.data : {};
    let conditionMet = false;
    for (const item of group) {
      if (item.type === "if" || item.type === "else-if") {
        const result = !conditionMet && this.evaluateExpression(item.expression, context);
        if (result) {
          item.element.style.display = "";
          conditionMet = true;
        } else {
          item.element.style.display = "none";
        }
      } else if (item.type === "else") {
        item.element.style.display = conditionMet ? "none" : "";
      }
    }
  }
  /**
   * Updates the visibility of DOM elements based on conditional expressions.
   *
   * This method processes groups of elements with `data-if`, `data-else-if`, and `data-else` attributes,
   * updating their visibility based on the evaluation of corresponding expressions.
   *
   * It also sets up dependencies between variables used in the expressions and their corresponding DOM elements,
   * allowing for dynamic updates when the context or variables change.
   *
   * This functionality is used to implement conditional rendering in the DOM.
   *
   * @param {Element} element - The DOM element to update.
   * @param {string} expression - The conditional expression to evaluate.
   * Nodes are expected to contain attributes like `data-if`, `data-else-if`, or `data-else`.
   */
  updateConditional(element, expression) {
    const group = this.findGroupForElement(element);
    if (group) {
      this.updateConditionalGroup(group);
    } else {
      const context = this.model && this.model.store ? { ...this.model.store.getState() } : this.model && this.model.data ? this.model.data : {};
      const result = this.evaluateExpression(expression, context);
      element.style.display = result ? "" : "none";
    }
  }
  /**
   * Finds and returns the group of conditional elements that contains the specified element.
   *
   * This method searches through the existing groups of conditional elements to determine
   * the group where the given element belongs. Each group represents a logical chain of
   * `data-if`, `data-else-if`, and `data-else` elements.
   *
   * @param {Element} element - The DOM element to find the group for.
   * @returns {Array<Object>|null} The group containing the specified element, or `null` if not found.
   * Each group object comprises:
   *    - {Element} element: The DOM element.
   *    - {string} type: The type of conditional ('if', 'else-if', 'else').
   *    - {string|null} expression: The conditional expression, null for 'else'.
   */
  findGroupForElement(element) {
    for (const group of this.conditionalGroups || []) {
      if (group.some((item) => item.element === element)) {
        return group;
      }
    }
    return null;
  }
  /**
   * Sets up and configures the dependencies for the provided DOM nodes.
   *
   * This method scans through the given list of nodes and determines
   * which variables are referenced in their conditional expressions (`data-if`, `data-else-if`).
   * It maps these variables to the corresponding DOM elements, building a dependency tree
   * that allows tracking of changes and their impact on the visibility of elements.
   *
   * @param {NodeList|Array<Element>} nodes - The list of DOM elements to process.
   */
  setupDependencies(nodes) {
    this.dependencies = /* @__PURE__ */ new Map();
    nodes.forEach((element) => {
      let expression;
      if (element.hasAttribute("data-if")) {
        expression = element.getAttribute("data-if");
      } else if (element.hasAttribute("data-else-if")) {
        expression = element.getAttribute("data-else-if");
      } else {
        return;
      }
      const variables = this.extractVariables(expression);
      variables.forEach((variable) => {
        if (!this.dependencies.has(variable)) {
          this.dependencies.set(variable, []);
        }
        this.dependencies.get(variable).push({
          element,
          expression,
          type: element.hasAttribute("data-if") ? "if" : "else-if"
        });
      });
    });
  }
  /**
   * Extracts variables from a given expression string.
   *
   * This method parses the expression and returns a list of variable names that are used
   * in the expression. The variables are determined based on alphanumeric and underscore
   * naming conventions, excluding JavaScript reserved keywords and primitive constants.
   *
   * @param {string} expression - The expression string to extract variables from.
   * @returns {Array<string>} An array of unique variable names found in the expression.
   * Variables are returned in their base form (i.e., the part before any dot notation or brackets).
   */
  extractVariables(expression) {
    const variables = [];
    const parts = expression.split(/[^a-zA-Z0-9_.]/);
    parts.forEach((part) => {
      const varName = part.trim();
      if (varName && /^[a-zA-Z_][a-zA-Z0-9_.]*$/.test(varName)) {
        const baseName = varName.split(".")[0];
        if (!variables.includes(baseName) && baseName !== "true" && baseName !== "false" && baseName !== "null" && baseName !== "undefined" && !isNaN(Number(baseName))) {
          variables.push(baseName);
        }
      }
    });
    return variables;
  }
  /**
   * Retrieves all dependencies related to a specific path.
   *
   * This method scans through the dependencies map and collects all elements and their details
   * that are associated with the given path. It also includes dependencies that match the base
   * path and/or any sub-paths (e.g., 'path' and 'path.sub').
   *
   * @param {string} path - The path of the dependency to look for.
   * @returns {Array<Object>} An array of dependency objects containing:
   *    - {Element} element: The DOM element associated with the dependency.
   *    - {string} expression: The original conditional expression linked to the dependency.
   *    - {string} type: The type of the conditional ('if' or 'else-if').
   */
  getDependenciesByPath(path) {
    const result = [];
    this.dependencies.forEach((deps, variable) => {
      if (variable === path || path.startsWith(variable + ".")) {
        result.push(...deps);
      }
    });
    return result;
  }
  /**
   * Evaluates a given expression within a specific context.
   *
   * This method can handle three types of input:
   * 1. Expressions wrapped in double curly braces (`{{ }}`) are treated as
   *    context paths and their values are retrieved using the `getValueFromContext` method.
   * 2. Ternary, logical, and comparison operations within the expression
   *    are parsed and evaluated using the `parseExpression` method.
   * 3. Literal or primitive values (e.g., numbers, strings, booleans) are directly returned.
   *
   * Any parsing or evaluation errors are caught and logged.
   *
   * @param {string} expression - The expression to evaluate.
   * @param {Object} context - The object representing the evaluation context.
   * @returns {*} The result of evaluating the expression. Returns `false` if an error occurs.
   */
  evaluateExpression(expression, context) {
    try {
      if (expression.startsWith("{{") && expression.endsWith("}}")) {
        const path = expression.substring(2, expression.length - 2).trim();
        return this.getValueFromContext(context, path);
      }
      return this.parseExpression(expression, context);
    } catch (error) {
      console.error("\u041E\u0448\u0438\u0431\u043A\u0430 \u043F\u0440\u0438 \u0432\u044B\u0447\u0438\u0441\u043B\u0435\u043D\u0438\u0438 \u0432\u044B\u0440\u0430\u0436\u0435\u043D\u0438\u044F:", error);
      return false;
    }
  }
  /**
   * Retrieves a value from a given context object based on a dot-separated path.
   *
   * This method allows accessing nested properties or array elements from an object
   * using a path string. If a part of the path references an array, you can include
   * an array index (e.g., 'path.toArray[0]'). If the path is invalid or the property
   * doesn't exist, the method will return undefined.
   *
   * @param {Object} obj - The context object to retrieve values from.
   * @param {string} path - The dot-separated string representing the path to the value.
   * @returns {*} The value located at the specified path, or undefined if not found.
   */
  getValueFromContext(obj, path) {
    if (!path) return obj;
    return path.split(".").reduce((acc, part) => {
      const arrayMatch = part.match(/^([^\[]+)(?:\[(\d+)\])?$/);
      if (arrayMatch) {
        const [_, propName, arrayIndex] = arrayMatch;
        const propValue = acc?.[propName];
        return arrayIndex !== void 0 && Array.isArray(propValue) ? propValue[parseInt(arrayIndex, 10)] : propValue;
      }
      return acc?.[part];
    }, obj);
  }
  /**
   * Parses and evaluates a given expression within a provided context.
   *
   * This method handles several types of expressions, including:
   * 1. Ternary expressions (`condition ? trueValue : falseValue`).
   * 2. Logical expressions with `&&` (AND) and `||` (OR).
   * 3. Comparison expressions (e.g., `===`, `!==`, `>`, `<`, `>=`, `<=`).
   * 4. String literals inside single or double quotes.
   * 5. Numeric literals (integers and floats).
   * 6. Boolean literals (`true`, `false`), and `null`, `undefined`.
   * 7. Context-based values, retrieved using the `getValueFromContext` method if the expression
   *    is not a primitive value or an operation.
   *
   * The method uses recursion to parse and evaluate nested expressions.
   *
   * @param {string} expression - The expression to parse and evaluate.
   * @param {Object} context - The object providing the evaluation context.
   * @returns {*} The evaluated result of the expression, or `undefined` if the path does not exist in the context.
   */
  parseExpression(expression, context) {
    expression = expression.trim();
    const ternaryMatch = expression.match(/(.+?)\s*\?\s*(.+?)\s*:\s*(.+)/);
    if (ternaryMatch) {
      const [_, condition, trueExpr, falseExpr] = ternaryMatch;
      return this.parseExpression(condition, context) ? this.parseExpression(trueExpr, context) : this.parseExpression(falseExpr, context);
    }
    if (expression.includes("&&")) {
      const parts = expression.split("&&");
      return parts.every((part) => this.parseExpression(part.trim(), context));
    }
    if (expression.includes("||")) {
      const parts = expression.split("||");
      return parts.some((part) => this.parseExpression(part.trim(), context));
    }
    const comparisonMatch = expression.match(/(.+?)\s*(===|==|!==|!=|>=|<=|>|<)\s*(.+)/);
    if (comparisonMatch) {
      const [_, left, operator, right] = comparisonMatch;
      const leftValue = this.parseExpression(left.trim(), context);
      const rightValue = this.parseExpression(right.trim(), context);
      switch (operator) {
        case "==":
          return leftValue == rightValue;
        case "===":
          return leftValue === rightValue;
        case "!=":
          return leftValue != rightValue;
        case "!==":
          return leftValue !== rightValue;
        case ">":
          return leftValue > rightValue;
        case "<":
          return leftValue < rightValue;
        case ">=":
          return leftValue >= rightValue;
        case "<=":
          return leftValue <= rightValue;
      }
    }
    if (expression.startsWith("'") && expression.endsWith("'") || expression.startsWith('"') && expression.endsWith('"')) {
      return expression.substring(1, expression.length - 1);
    }
    if (/^-?\d+(\.\d+)?$/.test(expression)) {
      return parseFloat(expression);
    }
    if (expression === "true") return true;
    if (expression === "false") return false;
    if (expression === "null") return null;
    if (expression === "undefined") return void 0;
    return this.getValueFromContext(context, expression);
  }
  /**
   * Cleans up the instance by clearing dependencies and resetting conditional groups.
   *
   * This method should be called to release resources and avoid memory leaks when
   * the instance of the class is no longer required.
   */
  destroy() {
    this.dependencies.clear();
    this.conditionalGroups = [];
  }
};

// src/utils/expression.js
var extractVariables = (expression) => {
  const matches = expression.match(/\b[a-zA-Z_]\w*(?:\.[a-zA-Z_]\w*)*\b/g) || [];
  return [...new Set(matches)];
};
var evaluateExpression = (expression, context) => {
  try {
    const func = new Function(...Object.keys(context), `return ${expression}`);
    return func(...Object.values(context));
  } catch (error) {
    console.error("\u041E\u0448\u0438\u0431\u043A\u0430 \u043F\u0440\u0438 \u0432\u044B\u0447\u0438\u0441\u043B\u0435\u043D\u0438\u0438 \u0432\u044B\u0440\u0430\u0436\u0435\u043D\u0438\u044F:", error);
    return false;
  }
};

// src/dom/attribute-manager.js
var AttributeManager = class {
  constructor(dom, model) {
    this.domManager = dom;
    this.model = model;
  }
  /**
   * Parses the attributes of elements with 'data-bind' attribute within the root element.
   * - Searches for elements with data-bind attribute
   * - Parses JSON binding expressions (converts single quotes to double quotes)
   * - Extracts variables from expressions
   * - Registers DOM dependencies for each variable
   * - Initializes attribute values
   *
   * @param {HTMLElement} rootElement - The root element containing elements with data bindings.
   * @throws {Error} When binding expression parsing fails
   */
  parseAttributes(rootElement) {
    const elements = rootElement.querySelectorAll("[data-bind]");
    elements.forEach((element) => {
      const bindingExpression = element.getAttribute("data-bind");
      try {
        const bindings = JSON.parse(bindingExpression.replace(/'/g, '"'));
        for (const [attributeName, expression] of Object.entries(bindings)) {
          const variables = extractVariables(expression);
          variables.forEach((variable) => {
            this.domManager.registerDomDependency(variable, element, {
              type: "attribute",
              attribute: attributeName,
              expression
            });
          });
          this.updateAttribute(element, attributeName, expression);
        }
      } catch (error) {
        console.error("An error of analysis of attachments:", error);
      }
    });
  }
  /**
   * Updates a DOM element's attribute based on a provided expression.
   * Evaluates the expression using the current state of the application model, and
   * updates the attribute only if its value has changed.
   *
   * - If the expression represents a falsy value (false, null, undefined), the attribute is removed.
   * - If the value is `true`, the attribute is added without a value ("").
   * - Otherwise, the attribute is set to the stringified value of the evaluated expression.
   *
   * @param {HTMLElement} element - The DOM element whose attribute needs to be updated.
   * @param {string} attributeName - The name of the attribute to be updated.
   * @param {string} expression - The expression to be evaluated to determine the attribute's value.
   *
   * Special cases:
   * - Handles template expressions in format {{expression}}
   * - Direct model path access for template expressions
   * - Expression evaluation for non-template strings
   * 
   */
  updateAttribute(element, attributeName, expression) {
    const context = { ...this.model.store.getState() };
    let value;
    if (expression.startsWith("{{") && expression.endsWith("}}")) {
      const path = expression.substring(2, expression.length - 2).trim();
      value = this.model.store.get(path);
    } else {
      value = evaluateExpression(expression, context);
    }
    const previousValue = element.getAttribute(attributeName);
    if (String(value) !== previousValue) {
      if (value === false || value === null || value === void 0) {
        element.removeAttribute(attributeName);
      } else if (value === true) {
        element.setAttribute(attributeName, "");
      } else {
        element.setAttribute(attributeName, String(value));
      }
    }
  }
};

// src/dom/dom-manager.js
var DOMManager = class {
  /**
   * Creates an instance of the DOMManager class, initializing necessary properties and dependencies
   * for managing the DOM in relation to the model. Sets up managers for loops, conditionals, and attributes,
   * and prepares structures for DOM dependencies and virtual DOM.
   *
   * @param {Object} model - The model that serves as the data source for the DOMManager.
   *                         It is used for data binding and template rendering in the DOM.
   */
  constructor(model) {
    this.model = model;
    this.elements = [];
    this.inputs = [];
    this.domDependencies = /* @__PURE__ */ new Map();
    this.virtualDom = /* @__PURE__ */ new Map();
    this.loopManager = new LoopManager(this, model);
    this.conditionalManager = new ConditionalManager(this, model);
    this.attributeManager = new AttributeManager(this, model);
  }
  /**
   * Registers a dependency between a model property path and a DOM element.
   * - Creates a new Set for the property path if it doesn't exist
   * - Adds element and additional info to the dependency set
   * - Supports multiple elements depending on the same property
   *
   * @param {string} propertyPath - Model property path to watch
   * @param {HTMLElement} domElement - DOM element to update
   * @param {Object} info - Additional dependency metadata
   */
  registerDomDependency(propertyPath, domElement, info) {
    if (!this.domDependencies.has(propertyPath)) {
      this.domDependencies.set(propertyPath, /* @__PURE__ */ new Set());
    }
    this.domDependencies.get(propertyPath).add({
      element: domElement,
      ...info
    });
  }
  /**
   * Recursively processes template nodes and replaces placeholders with values.
   * - Handles text nodes: replaces {{expression}} with actual values
   * - For text nodes: compares original and new content to avoid unnecessary updates
   * - For element nodes: recursively processes all child nodes
   * - Supports both context values and model store values
   *
   * @param {Node} node - DOM node to process
   * @param {Object} context - Optional context data for placeholder replacement
   */
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
      Array.from(node.childNodes).forEach((child) => {
        this.processTemplateNode(child, context);
      });
    }
  }
  /**
   * Parses DOM tree for template placeholders and sets up reactive bindings.
   * - Uses TreeWalker to efficiently traverse text nodes
   * - Detects template expressions using regex pattern
   * - Registers dependencies for each found template expression
   * - Preserves original template text for future updates
   * - Handles regex state reset between matches
   *
   * @param {HTMLElement} root - Starting point for DOM traversal
   */
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
      regex.lastIndex = 0;
      while ((match = regex.exec(text)) !== null) {
        const propPath = match[1].trim();
        this.registerDomDependency(propPath, node, {
          type: "template",
          template: originalText
        });
        this.elements.push({
          node,
          propName: propPath,
          template: originalText
        });
      }
      this.virtualDom.set(node, node.textContent);
    }
    const inputs = root.querySelectorAll("[data-model]");
    inputs.forEach((input) => {
      const property = input.getAttribute("data-model");
      const handler = (e) => {
        const value = input.type === "checkbox" || input.type === "radio" ? e.target.checked : e.target.value;
        this.model.store.set(property, value);
      };
      input.__modelInputHandler = handler;
      input.addEventListener("input", handler);
      this.inputs.push({
        element: input,
        property
      });
    });
  }
  /**
   * Sets the value of the input element based on the provided value.
   * For checkboxes and radio buttons, it sets the `checked` property.
   * For other input types, it sets the `value` property.
   *
   * @param {HTMLInputElement} input - The input element to update.
   * @param {*} value - The value to set for the input. For checkboxes and radio buttons, it should be a boolean.
   */
  setInputValue(input, value) {
    if (input.type === "checkbox" || input.type === "radio") {
      input.checked = Boolean(value);
    } else {
      input.value = value;
    }
  }
  /**
   * Updates all input elements associated with the specified property with the provided value.
   * It ensures that the value in the DOM accurately reflects the value in the model.
   *
   * @param {string} propName - The name of the property whose value should be updated in the inputs.
   * @param {*} value - The value to set for the associated inputs.
   */
  updateInputs(propName, value) {
    this.inputs.forEach((item) => {
      if (item.property === propName) {
        this.setInputValue(item.element, value);
      }
    });
  }
  /**
   * Updates all DOM elements based on the current state of the model.
   * This includes:
   * - Text nodes containing template placeholders.
   * - Input elements bound using `data-model` attributes.
   *
   * Iterates through registered nodes and inputs, updating their content
   * or values to reflect the latest model state.
   *
   * Ensures that the UI remains synchronized with the underlying model.
   */
  updateAllDOM() {
    this.elements.forEach((element) => {
      let newContent = element.template;
      newContent = newContent.replace(/\{\{\s*([^}]+)\s*\}\}/g, (match, path) => {
        path = path.trim();
        return this.model.store.get(path);
      });
      element.node.textContent = newContent;
    });
    this.inputs.forEach((item) => {
      const value = this.model.store.get(item.property);
      this.setInputValue(item.element, value);
    });
  }
  /**
   * Updates the DOM elements or attributes whenever a property in the model changes.
   * It resolves what elements depending on the property should be updated,
   * including templates, conditionals, loops, and attributes.
   *
   * @param {string} propertyPath - Path of the property in the model that triggered the change.
   * @param {*} value - New value of the property (could be a primitive, object, or array).
   */
  updateDOM(propertyPath, value) {
    if (!propertyPath) {
      console.warn("Path is undefined in updateDOM");
      return;
    }
    const isArrayMethodChange = value && typeof value === "object" && "method" in value;
    if (isArrayMethodChange) {
      propertyPath = value.path || propertyPath;
    }
    const elementsToUpdate = /* @__PURE__ */ new Set();
    if (this.domDependencies.has(propertyPath)) {
      this.domDependencies.get(propertyPath).forEach(
        (dep) => elementsToUpdate.add(dep)
      );
    }
    const pathParts = propertyPath.split(".");
    let currentPath = "";
    for (let i = 0; i < pathParts.length; i++) {
      currentPath = currentPath ? `${currentPath}.${pathParts[i]}` : pathParts[i];
      if (this.domDependencies.has(currentPath)) {
        this.domDependencies.get(currentPath).forEach(
          (dep) => elementsToUpdate.add(dep)
        );
      }
    }
    const conditionalElements = this.conditionalManager.getDependenciesByPath(propertyPath);
    conditionalElements.forEach((dep) => {
      if (dep.type === "if") {
        this.conditionalManager.updateConditional(dep.element, dep.expression);
      }
    });
    this.domDependencies.forEach((deps, path) => {
      if (path.startsWith(`${propertyPath}.`) || path.startsWith(`${propertyPath}[`)) {
        deps.forEach((dep) => elementsToUpdate.add(dep));
      }
    });
    if (Array.isArray(value) || isArrayMethodChange || typeof value === "object") {
      this.loopManager.updateLoops(propertyPath, value);
    }
    if (elementsToUpdate.size === 0) return;
    const updates = {
      template: [],
      conditional: [],
      loop: [],
      attribute: []
    };
    elementsToUpdate.forEach((dep) => {
      if (dep && dep.type) {
        updates[dep.type].push(dep);
      }
    });
    updates.template.forEach((dep) => this.updateTemplateNode(dep.element, dep.template));
    updates.conditional.forEach((dep) => this.conditionalManager.updateConditional(dep.element, dep.expression));
    updates.attribute.forEach((dep) => this.attributeManager.updateAttribute(dep.element, dep.attribute, dep.expression));
    updates.loop.forEach((dep) => this.loopManager.updateLoopPart(dep.element, dep.arrayPath, value, dep.index));
  }
  /**
   * Updates a template-based DOM node's content with the latest values
   * from the model store.
   *
   * This method uses a Mustache-like syntax (e.g., `{{propertyName}}`)
   * to replace placeholders in the template with actual values retrieved
   * from the model store. If the content changes compared to the virtual DOM,
   * the DOM node is updated, and the new content is recorded in the virtual DOM.
   *
   * @param {HTMLElement} node - The DOM node to update.
   * @param {string} template - The template string containing placeholders
   *                            for dynamic values.
   */
  updateTemplateNode(node, template) {
    const newContent = template.replace(/\{\{\s*([^}]+)\s*\}\}/g, (match, path) => {
      path = path.trim();
      return this.model.store.get(path);
    });
    if (this.virtualDom.get(node) !== newContent) {
      node.textContent = newContent;
      this.virtualDom.set(node, newContent);
    }
  }
  /**
   * Parses and processes attribute bindings in the provided root
   * DOM element. Attributes prefixed with a colon (e.g., `:class`)
   * are treated as dynamic bindings.
   *
   * For each dynamically bound attribute:
   * - Updates the attribute value on the element based on the
   *   current model store state.
   * - Registers a dependency between the element and the attribute
   *   expression in the DOM dependency tracker.
   * - Removes the colon-prefixed attribute from the DOM.
   *
   * @param {HTMLElement} rootElement - The root element to search
   *                                    for attribute bindings.
   */
  parseAttributeBindings(rootElement) {
    const allElements = rootElement.querySelectorAll("*");
    for (const element of allElements) {
      const attributes = element.attributes;
      for (let i = 0; i < attributes.length; i++) {
        const attr = attributes[i];
        if (attr.name.startsWith(":")) {
          const realAttrName = attr.name.substring(1);
          const expression = attr.value;
          this.updateElementAttribute(element, realAttrName, expression);
          this.registerDomDependency(expression, element, {
            type: "attribute",
            attribute: realAttrName,
            expression
          });
          element.removeAttribute(attr.name);
        }
      }
    }
  }
  /**
   * Updates the value of a DOM element's attribute based on the current
   * state of the model store.
   *
   * Dynamically handles specific attributes like `class`, `disabled`,
   * `checked`, `selected`, and `readonly` to ensure they're properly assigned
   * for Boolean or string values. For other attributes, it assigns the value
   * directly.
   *
   * If the value for the given expression cannot be resolved from the model store,
   * a warning is logged to the console.
   *
   * @param {HTMLElement} element - The DOM element whose attribute is being updated.
   * @param {string} attribute - The name of the attribute to update.
   * @param {string} expression - The model store expression to retrieve the value.
   */
  updateElementAttribute(element, attribute, expression) {
    const value = this.model.store.get(expression);
    if (value !== void 0) {
      if (attribute === "class") {
        element.className = value;
      } else if (attribute === "disabled" || attribute === "checked" || attribute === "selected" || attribute === "readonly") {
        if (value) {
          element.setAttribute(attribute, "");
        } else {
          element.removeAttribute(attribute);
        }
      } else {
        element.setAttribute(attribute, value);
      }
    } else {
      console.warn(`Value for ${expression} not found in the model`);
    }
  }
  /**
   * Checks whether the given pathA is a dependency of pathB.
   *
   * A path is considered a dependency if:
   * - It is identical to the other path.
   * - It is a hierarchical descendent of the other path (e.g., pathB starts with pathA).
   * - It is an array element of the other path (e.g., pathB starts with pathA followed by an array index).
   *
   * @param {string} pathA - The base path to check against.
   * @param {string} pathB - The path to verify as a dependency.
   * @returns {boolean} - Returns `true` if pathB is a dependency of pathA, otherwise `false`.
   */
  isPathDependency(pathA, pathB) {
    return pathB === pathA || pathB.startsWith(`${pathA}.`) || pathB.startsWith(`${pathA}[`);
  }
  /**
   * Retrieves all paths from the DOM dependency tracker that are
   * dependent on the given path. A path is considered dependent if:
   * - It is hierarchically related (e.g., path starts with the given path).
   * - It matches exactly with the given path.
   *
   * This method collects and returns all such dependent paths.
   *
   * @param {string} path - The path for which to find dependent paths.
   * @returns {string[]} - An array of dependent paths.
   */
  getDependentPaths(path) {
    const dependentPaths = [];
    this.domDependencies.forEach((_, depPath) => {
      if (this.isPathDependency(path, depPath)) {
        dependentPaths.push(depPath);
      }
    });
    return dependentPaths;
  }
  /**
   * Binds and processes the DOM for data binding, conditional rendering,
   * loops, and attribute updates. This method integrates the different
   * managers and processes involved in setting up the live DOM bindings.
   *
   * Steps performed:
   * 1. Parses loops within the DOM using the loop manager.
   * 2. Parses conditional elements using the conditional manager.
   * 3. Parses standard attributes using the attribute manager.
   * 4. Processes custom attribute bindings (colon-prefixed attributes).
   * 5. Parses any additional elements or bindings.
   * 6. Updates the DOM to reflect the current state of the model.
   *
   * @param {HTMLElement} rootElement - The root element to initiate the DOM binding process.
   */
  bindDOM(rootElement) {
    this.loopManager.parseLoops(rootElement);
    this.conditionalManager.parseConditionals(rootElement);
    this.attributeManager.parseAttributes(rootElement);
    this.parseAttributeBindings(rootElement);
    this.parse(rootElement);
    this.updateAllDOM();
  }
  /**
   * Validates the model for potential issues, including:
   *
   * 1. Cyclic dependencies in computed properties: Ensures that no property in the `computed`
   *    object of the model depends on itself through a chain of other properties.
   * 2. Invalid paths in DOM dependencies: Ensures that all paths used in the DOM template
   *    exist within the model's store.
   *
   * @returns {{errors: Array<Object>, warnings: Array<Object>}} - Returns an object containing arrays
   *          of errors and warnings. Each error or warning is represented as an object with details
   *          about the issue.
   *
   * Errors include:
   * - `CYCLIC_DEPENDENCY`: Indicates a cyclic dependency was found in `computed` properties.
   *   - `property`: The property with the cyclic dependency.
   *   - `message`: Description of the cyclic dependency.
   *
   * Warnings include:
   * - `INVALID_PATH`: Indicates a path used in the DOM does not exist in the model.
   *   - `path`: The invalid path.
   *   - `message`: Description of the invalid path.
   */
  validateModel() {
    const errors = [];
    const warnings = [];
    for (const key in this.model.computed) {
      const visited = /* @__PURE__ */ new Set();
      const cyclePath = this.checkCyclicDependencies(key, visited);
      if (cyclePath) {
        errors.push({
          type: "CYCLIC_DEPENDENCY",
          property: key,
          message: `Cyclic dependence is found: ${cyclePath.join(" -> ")}`
        });
      }
    }
    this.domDependencies.forEach((deps, path) => {
      if (!this.model.store.isValidPath(path)) {
        warnings.push({
          type: "INVALID_PATH",
          path,
          message: `Property ${path} used in the template, but does not exist in the model`
        });
      }
    });
    return { errors, warnings };
  }
  /**
   * Checks for cyclic dependencies in the computed properties of the model.
   *
   * This method recursively traverses the dependencies of a given property to determine
   * if a cyclic dependency exists. A cyclic dependency occurs when a property ultimately
   * depends on itself through a chain of other properties.
   *
   * @param {string} key - The key of the property to check for cyclic dependencies.
   * @param {Set<string>} visited - A set of visited properties during the traversal.
   * @param {string[]} [path=[]] - The current path of dependencies being checked.
   * @returns {string[]|null} - Returns an array representing the cyclic path if a cycle is found,
   *                            otherwise `null`.
   */
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
  /**
   * Destroys the instance by performing cleanup tasks.
   *
   * This method removes event listeners from input elements, clears out
   * internal data structures like `elements`, `inputs`, `domDependencies`,
   * and `virtualDom`, and calls the `destroy` methods of `loopManager` and
   * `conditionalManager`. It is intended to completely clean up the instance
   * and free resources to avoid memory leaks.
   */
  destroy() {
    this.inputs.forEach(({ element }) => {
      if (element.__modelInputHandler) {
        element.removeEventListener("input", element.__modelInputHandler);
        delete element.__modelInputHandler;
      }
    });
    this.elements = [];
    this.inputs = [];
    this.domDependencies.clear();
    this.virtualDom.clear();
    this.loopManager.destroy();
    this.conditionalManager.destroy();
  }
};

// src/reactive/computed.js
var ComputedProps = class {
  constructor(model, computed = {}) {
    this.model = model;
    this.computed = computed;
    this.store = model.store;
  }
  /**
   * Sets up computed properties in the model.
   * - Performs initial evaluation of all computed properties
   * - Defines getter proxies on model.data
   * - Makes computed properties enumerable and configurable
   * - Ensures reactive updates through getter access
   *
   * @method init
   */
  init() {
    for (const key in this.computed) {
      this.evaluate(key);
      Object.defineProperty(this.model.data, key, {
        get: () => this.computed[key].value,
        enumerable: true,
        configurable: true
      });
    }
  }
  /**
   * Evaluates computed property and tracks its dependencies.
   * - Creates proxy for dependency tracking
   * - Handles nested object dependencies
   * - Records all accessed properties during evaluation
   * - Emits computation events with results
   * - Supports forced re-evaluation
   *
   * @method evaluate
   * @param {string} key - Computed property name
   * @param {boolean} [force=false] - Force re-evaluation flag
   * @returns {*} New computed value
   * @emits compute
   */
  evaluate(key, force = false) {
    const computed = this.computed[key];
    const dependencies = /* @__PURE__ */ new Set();
    const dataTracker = new Proxy(this.store.getState(), {
      get: (target, prop) => {
        dependencies.add(prop);
        let value = target[prop];
        if (value && typeof value === "object") {
          return new Proxy(value, {
            get: (obj, nestedProp) => {
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
    this.store.emit("compute", {
      key,
      value: result,
      dependencies
    });
    return result;
  }
  /**
   * Updates computed properties affected by model changes.
   * Checks three types of dependencies:
   * - Direct property matches
   * - Nested property changes (parent changed)
   * - Parent property changes (child changed)
   * Re-evaluates affected computed properties
   *
   * @method update
   * @param {string} changedProp - Changed property path
   */
  update(changedProp) {
    for (const key in this.computed) {
      const computed = this.computed[key];
      const isDependency = computed.dependencies.some((dep) => {
        if (dep === changedProp) return true;
        if (changedProp.startsWith(dep + ".")) return true;
        if (dep.startsWith(changedProp + ".")) return true;
        return false;
      });
      if (isDependency) {
        const newValue = this.evaluate(key);
        this.model.dom.updateDOM(key, newValue);
        this.model.dom.updateInputs(key, newValue);
      }
    }
  }
  /**
   * @method all
   * @description Retrieves all computed properties and their current values.
   * Converts the `computed` object into a plain object, mapping each computed
   * property's name to its current value.
   *
   * @returns {Object} An object containing all computed property names and their values.
   */
  all() {
    return Object.fromEntries(
      Object.entries(this.computed).map(([key, comp]) => [key, comp.value])
    );
  }
};

// src/state-manager/state-manager.js
var StateManager = class _StateManager extends event_emitter_default {
  /**
   * Creates a new StateManager instance.
   * @param {Object} store - The store object to manage state for.
   * @param {Object} [options={}] - Configuration options for the StateManager.
   * @param {string} [options.id="model"] - Unique identifier for the state in localStorage.
   */
  constructor(store, options = {}) {
    super();
    this.store = store;
    this.options = Object.assign({ id: "model" }, options);
  }
  /**
   * Checks if localStorage is available.
   * @returns {boolean}
   */
  static isStorageAvailable() {
    try {
      const test = "__test__";
      localStorage.setItem(test, test);
      localStorage.removeItem(test);
      return true;
    } catch (e) {
      return false;
    }
  }
  /**
   * Saves the current state to localStorage.
   * @returns {{data: any, timestamp: number}|null}
   */
  saveState() {
    if (!_StateManager.isStorageAvailable()) {
      console.warn("localStorage is not available");
      return null;
    }
    const dataToSave = JSON.parse(JSON.stringify(this.store.getState()));
    const state = {
      data: dataToSave,
      timestamp: Date.now()
    };
    try {
      localStorage.setItem(this.options.id, JSON.stringify(state));
      this.emit("saveState", state);
      return state;
    } catch (error) {
      console.error("Error saving state:", error);
      this.emit("saveStateError", error);
      return null;
    }
  }
  /**
   * Restores the state from localStorage.
   * @returns {any|null}
   */
  restoreState() {
    if (!_StateManager.isStorageAvailable()) {
      console.warn("localStorage is not available");
      return null;
    }
    try {
      const savedState = localStorage.getItem(this.options.id);
      if (savedState) {
        const parsed = JSON.parse(savedState);
        Object.assign(this.store.state, parsed.data);
        this.emit("restoreState", parsed);
        return parsed;
      }
    } catch (error) {
      this.emit("restoreStateError", error);
    }
  }
  /**
   * Creates a snapshot of the current state.
   * @returns {{data: any, timestamp: number}|null}
   */
  createSnapshot() {
    if (!_StateManager.isStorageAvailable()) {
      console.warn("localStorage is not available");
      return null;
    }
    const dataToSave = JSON.parse(JSON.stringify(this.store.getState()));
    const snapshot = {
      data: dataToSave,
      timestamp: Date.now()
    };
    this.emit("createSnapshot", snapshot);
    return snapshot;
  }
  /**
   * Restores the state from a snapshot.  
   * @param snapshot
   * @returns {*|null}
   */
  restoreSnapshot(snapshot) {
    if (!_StateManager.isStorageAvailable()) {
      console.warn("localStorage is not available");
      return null;
    }
    if (snapshot) {
      Object.assign(this.store.state, snapshot.data);
      this.emit("restoreSnapshot", snapshot);
      return snapshot;
    }
    return null;
  }
  /**
   * Enables automatic state-saving at a specified interval.
   * @param interval
   */
  enableAutoSave(interval = 5e3) {
    this.autoSaveInterval = setInterval(() => {
      this.saveState();
    }, interval);
  }
  /**
   * Disables automatic state-saving.
   */
  disableAutoSave() {
    clearInterval(this.autoSaveInterval);
  }
};

// src/core/model.js
var ModelOptions = {
  id: "model"
};
var Model = class _Model extends event_emitter_default {
  /**
   * A map for storing registered plugins.
   * @type {Map<string, Function>}
   */
  static plugins = /* @__PURE__ */ new Map();
  /**
   * Creates a new instance of the Model class.
   * @param {Object} [data={}] - Initial data for the model.
   * @param {Object} [options={}] - Configuration options for the model.
   */
  constructor(data = {}, options = {}) {
    super();
    this.options = Object.assign({}, ModelOptions, options);
    this.computed = {};
    for (const key in data) {
      if (typeof data[key] === "function") {
        this.computed[key] = {
          getter: data[key],
          value: null,
          dependencies: []
        };
        delete data[key];
      }
    }
    this.store = new ReactiveStore(data);
    this.data = this.store.state;
    this.dom = new DOMManager(this);
    this.computedProps = new ComputedProps(this, this.computed);
    this.stateManager = new StateManager(this.store);
    this.subscribe();
    this.computedProps.init();
  }
  /**
   * Subscribes to changes from the ReactiveStore and handles DOM updates,
   * input field updates, and computed properties recalculation.
   */
  subscribe() {
    this.store.on("change", (data) => {
      this.dom.updateDOM(data.path, data.newValue);
      this.dom.updateInputs(data.path, data.newValue);
      this.computedProps.update(data.path);
      this.emit("change", data);
    });
    this.store.on("compute", (data) => this.emit("compute", data));
    this.store.on("arrayChange", (data) => this.emit("arrayChange", data));
    this.store.on("batchComplete", (data) => this.emit("batchComplete", data));
    this.stateManager.on("saveState", (data) => this.emit("saveState", data));
    this.stateManager.on("saveStateError", (error) => this.emit("saveStateError", error));
    this.stateManager.on("restoreState", (data) => this.emit("restoreState", data));
    this.stateManager.on("restoreStateError", (error) => this.emit("restoreStateError", error));
    this.stateManager.on("createSnapshot", (data) => this.emit("createSnapshot", data));
    this.stateManager.on("restoreSnapshot", (data) => this.emit("restoreSnapshot", data));
  }
  /**
   * Adds a validator function to a specified path.
   * @param {string} path - Path within the state to attach the validator.
   * @param {Function} validator - Validation function to execute on path changes.
   */
  addValidator(path, validator) {
    this.store.addValidator(path, validator);
  }
  /**
   * Adds a formatter function to a specified path.
   * @param {string} path - Path within the state to attach the formatter.
   * @param {Function} formatter - Formatting function to execute on path changes.
   */
  addFormatter(path, formatter) {
    this.store.addFormatter(path, formatter);
  }
  /**
   * Adds middleware to the ReactiveStore for intercepting and processing state changes.
   * @param {Function} middleware - Middleware function that receives and can modify state changes before they're applied.
   */
  use(middleware) {
    this.store.use(middleware);
  }
  /**
   * Watches a specific path in the state and triggers a callback on changes.
   * @param {string} path - Path to watch.
   * @param {Function} callback - Callback function to execute when the path changes.
   */
  watch(path, callback) {
    this.store.watch(path, callback);
  }
  /**
   * Executes a batch of state changes in a single update cycle.
   * @param callback
   */
  batch(callback) {
    return this.store.batch(callback);
  }
  /**
   * Detects changes between two arrays and returns the differences.
   * @param newArray
   * @param oldArray
   * @returns {{added: [], removed: [], moved: []}}
   */
  diffArrays(newArray, oldArray) {
    return this.store.detectArrayChanges(newArray, oldArray);
  }
  diff() {
  }
  /**
   * Initializes the DOM bindings for the model.
   * @param {string|HTMLElement} selector - Selector or root element to bind on.
   * @returns {Model|undefined} - Returns the model instance, or undefined if the root element is not found.
   */
  init(selector) {
    const rootElement = typeof selector === "string" ? document.querySelector(selector) : selector;
    if (!rootElement) {
      console.error("The root element was not found!");
      return;
    }
    this.dom.bindDOM(rootElement);
    this.emit("init");
    return this;
  }
  /**
   * Initializes development tools for the model.
   * @param {Object} [options={}] - Options for the development tools.
   * @returns {DevTools} - An instance of the DevTools class.
   */
  runDevTools(options = {}) {
    return new dev_tools_default(this, options);
  }
  /**
   * Saves the current state of the model.
   * @returns {{data: *, timestamp: number}|null}
   */
  save() {
    return this.stateManager.saveState();
  }
  /**
   * Restores the model to a previously saved state.
   * @returns {*|null}
   */
  restore() {
    return this.stateManager.restoreState();
  }
  /**
   * Creates a snapshot of the current state.
   * @param _snapshot
   * @returns {*|null|{data: *, timestamp: number}}
   */
  snapshot(_snapshot) {
    if (!_snapshot) {
      return this.stateManager.createSnapshot();
    }
    return this.stateManager.restoreSnapshot(s);
  }
  /**
   * Enables or disables auto-saving of the model's state.
   * @param interval
   */
  autoSave(interval) {
    if (!interval) {
      this.stateManager.disableAutoSave();
    } else {
      this.stateManager.enableAutoSave(interval);
    }
  }
  /**
   * Registers a plugin for the model.
   * @param {string} name - Name of the plugin.
   * @param {Function} plugin - Plugin class or constructor function.
   * @throws {Error} If a plugin with the same name is already registered.
   */
  static registerPlugin(name, plugin) {
    if (_Model.plugins.has(name)) {
      throw new Error(`Plugin ${name} already registered`);
    }
    _Model.plugins.set(name, plugin);
    this.emit("pluginRegistered", name);
  }
  /**
   * Uses a registered plugin by name.
   * @param {string} name - Name of the plugin to use.
   * @param {Object} [options={}] - Options to pass to the plugin.
   * @returns {Model} - Returns the model instance to allow method chaining.
   */
  usePlugin(name, options = {}) {
    const Plugin = _Model.plugins.get(name);
    if (!Plugin) {
      console.error(`Plugin ${name} not found`);
    }
    new Plugin(this, options);
    return this;
  }
  /**
   * Removes a registered plugin by name.
   * @param name
   */
  static removePlugin(name) {
    if (_Model.plugins.has(name)) {
      _Model.plugins.delete(name);
      this.emit("pluginUnregistered", name);
    }
  }
  /**
   * Destroys the model instance and cleans up resources.
   */
  destroy() {
    this.dom.destroy();
    this.store.destroy();
    this.emit("destroy");
  }
};
var model_default = Model;

// src/index.js
var version = "0.13.0";
var build_time = "04.03.2025, 14:22:11";
model_default.info = () => {
  console.info(`%c Model %c v${version} %c ${build_time} `, "color: white; font-weight: bold; background: #0080fe", "color: white; background: darkgreen", "color: white; background: #0080fe;");
};
var index_default = model_default;
export {
  index_default as default
};
