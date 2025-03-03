
/*!
 * Model v0.11.0
 * Build: 03.03.2025, 11:28:57
 * Copyright 2012-2025 by Serhii Pimenov
 * Licensed under MIT
 */


// src/event-emitter/event-emitter.js
var EventEmitter = class {
  constructor() {
    this.events = /* @__PURE__ */ new Map();
  }
  on(eventName, callback) {
    if (!this.events.has(eventName)) {
      this.events.set(eventName, /* @__PURE__ */ new Set());
    }
    this.events.get(eventName).add(callback);
    return () => this.off(eventName, callback);
  }
  off(eventName, callback) {
    if (this.events.has(eventName)) {
      this.events.get(eventName).delete(callback);
    }
  }
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
  initializeDevTools() {
    window.__MODEL_DEVTOOLS__ = this;
    this.createDevToolsPanel();
    this.setupModelListeners();
  }
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
  createToggleButton() {
    const button = document.createElement("button");
    button.id = "model-dev-tools-toggle-button";
    button.textContent = "\u{1F6E0}";
    button.title = "Model DevTools";
    button.onclick = () => this.togglePanel();
    document.body.appendChild(button);
  }
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
  logChange(entry) {
    if (!this.options.enabled) return;
    if (this.options.timeTravel) {
      this.saveSnapshot(entry);
    }
    this.updateDisplay();
  }
  saveSnapshot(entry) {
    const snapshot = {
      ...entry,
      state: JSON.parse(JSON.stringify(this.model.data)),
      // Получаем все вычисляемые свойства
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
  getRecentChanges() {
    return this.history.slice(-5).reverse();
  }
  togglePanel() {
    const panel = document.getElementById("model-devtools-panel");
    if (panel) {
      panel.style.display = panel.style.display === "none" ? "block" : "none";
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
      console.log(`Time traveled to snapshot ${index}`, snapshot);
    } catch (e) {
      console.error("Error during time travel:", e);
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

// src/dev/logger.js
var Logger = class _Logger {
  static DEBUG_LEVELS = {
    NONE: 0,
    ERROR: 1,
    WARN: 2,
    INFO: 3,
    DEBUG: 4,
    TRACE: 5
  };
  static DEBUG_LEVEL = _Logger.DEBUG_LEVELS.NONE;
  static log(level, message, data) {
    if (level > _Logger.DEBUG_LEVEL) return;
    const styles = {
      error: "color: #ff5555; font-weight: bold",
      warn: "color: #ffaa00; font-weight: bold",
      info: "color: #0080fe; font-weight: bold",
      debug: "color: #00aa00; font-weight: bold",
      trace: "color: #888888",
      data: "color: #555; font-style: italic"
    };
    let styleType;
    let method;
    switch (level) {
      case _Logger.DEBUG_LEVELS.ERROR:
        styleType = "error";
        method = console.error;
        break;
      case _Logger.DEBUG_LEVELS.WARN:
        styleType = "warn";
        method = console.warn;
        break;
      case _Logger.DEBUG_LEVELS.INFO:
        styleType = "info";
        method = console.info;
        break;
      case _Logger.DEBUG_LEVELS.DEBUG:
        styleType = "debug";
        method = console.debug;
        break;
      case _Logger.DEBUG_LEVELS.TRACE:
        styleType = "trace";
        method = console.log;
        break;
      default:
        return;
    }
    console.group(`%c Model: ${message}`, styles[styleType]);
    if (data !== void 0) {
      console.log("%c Data:", styles.data, data);
    }
    console.groupEnd();
  }
  // Методы для удобства
  static error(message, data) {
    _Logger.log(_Logger.DEBUG_LEVELS.ERROR, message, data);
  }
  static warn(message, data) {
    _Logger.log(_Logger.DEBUG_LEVELS.WARN, message, data);
  }
  static info(message, data) {
    _Logger.log(_Logger.DEBUG_LEVELS.INFO, message, data);
  }
  static debug(message, data) {
    _Logger.log(_Logger.DEBUG_LEVELS.DEBUG, message, data);
  }
  static trace(message, data) {
    _Logger.log(_Logger.DEBUG_LEVELS.TRACE, message, data);
  }
};

// src/middleware/middleware.js
var MiddlewareManager = class {
  constructor() {
    this.middlewares = [];
  }
  use(middleware) {
    if (typeof middleware !== "function") {
      console.error("MIDDLEWARE should be a function!");
      return;
    }
    this.middlewares.push(middleware);
  }
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
  constructor(initialState = {}) {
    super();
    this.state = this.createReactiveProxy(initialState);
    this.watchers = /* @__PURE__ */ new Map();
    this.previousState = JSON.parse(JSON.stringify(initialState));
    this.middleware = new middleware_default();
  }
  use(middleware) {
    this.middleware.use(middleware);
  }
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
  // Спеціальний проксі для масивів
  createArrayProxy(array, path) {
    return new Proxy(array, {
      get: (target, prop) => {
        const value = target[prop];
        if (typeof value === "function" && ["push", "pop", "shift", "unshift", "splice", "sort", "reverse"].includes(prop)) {
          return (...args) => {
            const oldArray = [...target];
            const result = target[prop].apply(target, args);
            this.emit("arrayChange", {
              path,
              method: prop,
              args,
              oldValue: oldArray,
              newValue: [...target]
            });
            if (this.watchers.has(path)) {
              this.watchers.get(path).forEach((callback) => {
                callback([...target], oldArray);
              });
            }
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
        const oldValue = target[prop];
        if (oldValue === value) {
          return true;
        }
        if (this.validators?.has(`${path}.${prop}`)) {
          const isValid = this.validators.get(`${path}.${prop}`)(value);
          if (!isValid) return false;
        }
        if (this.formatters?.has(`${path}.${prop}`)) {
          value = this.formatters.get(`${path}.${prop}`)(value);
        }
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
        this.emit("change", {
          path: `${path}[${prop}]`,
          oldValue,
          newValue: value,
          arrayIndex: Number(prop)
        });
        if (this.watchers.has(path)) {
          this.watchers.get(path).forEach((callback) => {
            callback([...target], void 0);
          });
        }
        return true;
      }
    });
  }
  // Спеціалізований метод для масивів
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
  // Специализированные методы для массивов
  // Пример использования:
  // model.applyArrayChanges('users', (users) => users.push({ name: 'Новый пользователь' }));
  applyArrayChanges(path, callback) {
    const array = this.get(path);
    if (!Array.isArray(array)) {
      console.error(`The path ${path} is not an array!`);
      return false;
    }
    const oldArray = [...array];
    const result = callback(array);
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
  // Метод для спостереження за змінами
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
  // Метод для отримання значення за шляхом
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
  // Метод для встановлення значення за шляхом
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
  // Метод для пакетного оновлення 
  batch(updater) {
    this.previousState = JSON.parse(JSON.stringify(this.state));
    if (typeof updater === "function") {
      updater(this.state);
    } else if (typeof updater === "object") {
      Object.entries(updater).forEach(([path, value]) => {
        this.set(path, value);
      });
    }
    this.emit("batchUpdate", {
      previousState: this.previousState,
      currentState: this.state
    });
  }
  // Повертає поточний стан
  getState() {
    return this.state;
  }
  // Повертає попередній стан
  getPreviousState() {
    return this.previousState;
  }
  // Сериалізує стан до JSON
  toJSON() {
    return JSON.stringify(this.state);
  }
  // Відновлює стан з JSON
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
  // Додаємо валідацію
  addValidator(propertyPath, validator) {
    if (!this.validators) {
      this.validators = /* @__PURE__ */ new Map();
    }
    this.validators.set(propertyPath, validator);
  }
  // Додаємо форматування
  addFormatter(propertyPath, formatter) {
    if (!this.formatters) {
      this.formatters = /* @__PURE__ */ new Map();
    }
    this.formatters.set(propertyPath, formatter);
  }
  // Проверка существования пути в модели
  isValidPath(path) {
    try {
      const value = this.get(path);
      return value !== void 0;
    } catch (e) {
      return false;
    }
  }
  destroy() {
    this.state = null;
    this.watchers.clear();
    this.previousState = null;
  }
};

// src/dom/loop-manager.js
var LoopManager = class {
  constructor(domManager, model) {
    this.domManager = domManager;
    this.model = model;
    this.loops = /* @__PURE__ */ new Map();
  }
  // Парсинг циклов в DOM (data-for)
  parseLoops(rootElement) {
    const loopElements = rootElement.querySelectorAll("[data-for]");
    loopElements.forEach((element) => {
      const expression = element.getAttribute("data-for").trim();
      const matches = expression.match(/^\s*(\w+)(?:\s*,\s*(\w+))?\s+in\s+(\w+(?:\.\w+)*)\s*$/);
      if (!matches) {
        console.error("\u041D\u0435\u043A\u043E\u0440\u0440\u0435\u043A\u0442\u043D\u044B\u0439 \u0444\u043E\u0440\u043C\u0430\u0442 \u0432\u044B\u0440\u0430\u0436\u0435\u043D\u0438\u044F data-for:", expression);
        return;
      }
      const [_, itemName, indexName, arrayPath] = matches;
      const array = this.model.store.get(arrayPath);
      if (!Array.isArray(array)) {
        console.error(`\u0417\u043D\u0430\u0447\u0435\u043D\u0438\u0435 \u043F\u043E \u043F\u0443\u0442\u0438 ${arrayPath} \u043D\u0435 \u044F\u0432\u043B\u044F\u0435\u0442\u0441\u044F \u043C\u0430\u0441\u0441\u0438\u0432\u043E\u043C:`, array);
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
  // Обновление части цикла
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
  // Оптимизированный метод для обнаружения изменений в массивах
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
  // Получение всех зарегистрированных циклов
  getLoops() {
    return this.loops;
  }
  // Очистка ресурсов
  destroy() {
    this.loops.clear();
  }
};

// src/dom/conditional-manager.js
var ConditionalManager = class {
  constructor(domManager, model) {
    this.domManager = domManager;
    this.model = model;
    this.virtualDom = /* @__PURE__ */ new Map();
  }
  // Парсим DOM для поиска условных выражений
  parseConditionals(rootElement) {
    const conditionalElements = rootElement.querySelectorAll("[data-if]");
    conditionalElements.forEach((element) => {
      const expression = element.getAttribute("data-if").trim();
      element.__originalDisplay = element.style.display === "none" ? "" : element.style.display;
      const variables = this.extractVariables(expression);
      variables.forEach((variable) => {
        this.domManager.registerDomDependency(variable, element, {
          type: "conditional",
          expression
        });
      });
      this.updateConditional(element, expression);
    });
  }
  // Обновление условного выражения
  updateConditional(element, expression) {
    const currentState = this.virtualDom.get(element);
    const context = { ...this.model.store.getState() };
    const result = this.evaluateExpression(expression, context);
    if (currentState !== result) {
      element.style.display = result ? element.__originalDisplay || "" : "none";
      this.virtualDom.set(element, result);
    }
  }
  // Парсим DOM для поиска атрибутов с привязками
  parseAttributes(rootElement) {
    const elements = rootElement.querySelectorAll("[data-bind]");
    elements.forEach((element) => {
      const bindingExpression = element.getAttribute("data-bind");
      try {
        const bindings = JSON.parse(bindingExpression.replace(/'/g, '"'));
        for (const [attributeName, expression] of Object.entries(bindings)) {
          const variables = this.extractVariables(expression);
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
        console.error("\u041E\u0448\u0438\u0431\u043A\u0430 \u0440\u0430\u0437\u0431\u043E\u0440\u0430 \u043F\u0440\u0438\u0432\u044F\u0437\u043E\u043A \u0430\u0442\u0440\u0438\u0431\u0443\u0442\u043E\u0432:", error);
      }
    });
  }
  // Метод для обновления атрибута на основе выражения
  updateAttribute(element, attributeName, expression) {
    const context = { ...this.model.store.getState() };
    let value;
    if (expression.startsWith("{{") && expression.endsWith("}}")) {
      const path = expression.substring(2, expression.length - 2).trim();
      value = this.model.store.get(path);
    } else {
      value = this.evaluateExpression(expression, context);
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
  // Вспомогательный метод для извлечения переменных из выражения
  extractVariables(expression) {
    const matches = expression.match(/\b[a-zA-Z_]\w*(?:\.[a-zA-Z_]\w*)*\b/g) || [];
    return [...new Set(matches)];
  }
  // Метод для оценки выражения
  evaluateExpression(expression, context) {
    try {
      const func = new Function(...Object.keys(context), `return ${expression}`);
      return func(...Object.values(context));
    } catch (error) {
      console.error("\u041E\u0448\u0438\u0431\u043A\u0430 \u043F\u0440\u0438 \u0432\u044B\u0447\u0438\u0441\u043B\u0435\u043D\u0438\u0438 \u0432\u044B\u0440\u0430\u0436\u0435\u043D\u0438\u044F:", error);
      return false;
    }
  }
  // Освобождение ресурсов
  destroy() {
    this.virtualDom.clear();
  }
};

// src/dom/dom-manager.js
var DOMManager = class {
  constructor(model) {
    this.model = model;
    this.elements = [];
    this.inputs = [];
    this.domDependencies = /* @__PURE__ */ new Map();
    this.virtualDom = /* @__PURE__ */ new Map();
    this.loopManager = new LoopManager(this, model);
    this.conditionalManager = new ConditionalManager(this, model);
  }
  // Регистрация зависимости DOM от свойства
  registerDomDependency(propertyPath, domElement, info) {
    if (!this.domDependencies.has(propertyPath)) {
      this.domDependencies.set(propertyPath, /* @__PURE__ */ new Set());
    }
    this.domDependencies.get(propertyPath).add({
      element: domElement,
      ...info
    });
  }
  // Обработка шаблонных узлов
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
  // Парсим DOM для поиска выражений {{ переменная }}
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
  // Установка значения в input-элемент
  setInputValue(input, value) {
    if (input.type === "checkbox" || input.type === "radio") {
      input.checked = Boolean(value);
    } else {
      input.value = value;
    }
  }
  // Обновление значений в input-элементах при изменении данных модели
  updateInputs(propName, value) {
    this.inputs.forEach((item) => {
      if (item.property === propName) {
        this.setInputValue(item.element, value);
      }
    });
  }
  // Обновляем элементы DOM, которые нуждаются в этом
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
  // Обновление DOM при изменении данных
  updateDOM(propertyPath, value) {
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
    this.domDependencies.forEach((deps, path) => {
      if (path.startsWith(`${propertyPath}.`) || path.startsWith(`${propertyPath}[`)) {
        deps.forEach((dep) => elementsToUpdate.add(dep));
      }
    });
    if (Array.isArray(value) || isArrayMethodChange) {
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
    updates.attribute.forEach((dep) => this.conditionalManager.updateAttribute(dep.element, dep.attribute, dep.expression));
    updates.loop.forEach((dep) => this.loopManager.updateLoopPart(dep.element, dep.arrayPath, value, dep.index));
  }
  // Метод обновления текстового шаблона
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
  // Проверяет, зависит ли путь pathB от пути pathA
  isPathDependency(pathA, pathB) {
    return pathB === pathA || pathB.startsWith(`${pathA}.`) || pathB.startsWith(`${pathA}[`);
  }
  // Находит все зависимые пути
  getDependentPaths(path) {
    const dependentPaths = [];
    this.domDependencies.forEach((_, depPath) => {
      if (this.isPathDependency(path, depPath)) {
        dependentPaths.push(depPath);
      }
    });
    return dependentPaths;
  }
  bindDOM(rootElement) {
    this.loopManager.parseLoops(rootElement);
    this.conditionalManager.parseConditionals(rootElement);
    this.conditionalManager.parseAttributes(rootElement);
    this.parse(rootElement);
    this.updateAllDOM();
  }
  // Добавим метод для валидации и обработки ошибок
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
  // Проверяем наличие циклических зависимостей
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
  // Освобождение ресурсов
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
  // Добавьте этот метод для инициализации обчислюваемых свойств
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
  // Обчислення значення computed властивості
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
  // Допоміжний метод для отримання всіх обчислюваних значень
  all() {
    return Object.fromEntries(
      Object.entries(this.computed).map(([key, comp]) => [key, comp.value])
    );
  }
};

// src/core/model.js
var ModelOptions = {
  id: "model",
  memoizeComputed: true
};
var Model = class extends event_emitter_default {
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
          // Буде заповнено під час першого виклику
        };
        delete data[key];
      }
    }
    this.dom = new DOMManager(this);
    this.store = new ReactiveStore(data);
    this.data = this.store.state;
    this.computedProps = new ComputedProps(this, this.computed);
    this.subscribe();
    this.computedProps.init();
  }
  subscribe() {
    this.store.on("change", (data) => {
      this.dom.updateDOM(data.path, data.newValue);
      this.dom.updateInputs(data.path, data.newValue);
      this.computedProps.update(data.path);
    });
  }
  // Додаємо валідацію
  addValidator(path, validator) {
    this.store.addValidator(path, validator);
  }
  // Додаємо форматування
  addFormatter(path, formatter) {
    this.store.addFormatter(path, formatter);
  }
  // Додаємо middleware
  use(middleware) {
    this.store.use(middleware);
  }
  watch(path, callback) {
    this.store.watch(path, callback);
  }
  // Ініціюємо модель на відповідному DOM елементі
  init(selector) {
    const rootElement = typeof selector === "string" ? document.querySelector(selector) : selector;
    if (!rootElement) {
      Logger.error("The root element was not found!");
      return;
    }
    this.dom.bindDOM(rootElement);
    this.emit("init");
    return this;
  }
  // Ініціюємо DevTools
  initDevTools(options = {}) {
    return new dev_tools_default(this, options);
  }
  destroy() {
    this.dom.destroy();
    this.store.destroy();
    this.emit("destroy");
  }
};
var model_default = Model;

// src/index.js
var version = "0.11.0";
var build_time = "03.03.2025, 11:28:57";
model_default.info = () => {
  console.info(`%c Model %c v${version} %c ${build_time} `, "color: white; font-weight: bold; background: #0080fe", "color: white; background: darkgreen", "color: white; background: #0080fe;");
};
var index_default = model_default;
export {
  index_default as default
};
