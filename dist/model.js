
/*!
 * Model v0.11.0
 * Build: 04.03.2025, 14:21:20
 * Copyright 2012-2025 by Serhii Pimenov
 * Licensed under MIT
 */


// src/event-emmiter.js
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
var event_emmiter_default = EventEmitter;

// src/middleware.js
var MiddlewareManager = class {
  constructor() {
    this.middlewares = [];
  }
  use(middleware) {
    if (typeof middleware !== "function") {
      throw new Error("MIDDLEWARE should be a function!");
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

// src/dev-tools.js
var DevToolsWindowStyle = `
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
            ${DevToolsWindowStyle}
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
                <div>Value: ${snapshot.type === "computed-update" ? snapshot.newValue : snapshot.oldValue + " -> " + snapshot.newValue}</div>
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
    if (!statesList) {
      setTimeout(() => {
      }, 2e3);
    }
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
    this.model.on("change", ({ property, oldValue, newValue }) => {
      this.logChange({
        type: "data-change",
        property,
        oldValue,
        newValue,
        timestamp: Date.now()
      });
    });
    this.model.on("*", (eventName, data) => {
      if (eventName !== "change" && eventName !== "compute") {
        this.logChange({
          type: "event",
          event: eventName,
          data,
          timestamp: Date.now()
        });
      }
    });
    this.model.on("compute", ({ key, value }) => {
      this.logChange({
        type: "computed-update",
        property: key,
        newValue: value,
        timestamp: Date.now()
      });
    });
    this.setupArrayObserver();
  }
  setupArrayObserver() {
    const arrayMethods = ["push", "pop", "shift", "unshift", "splice", "sort", "reverse"];
    const observeArray = (array, path) => {
      arrayMethods.forEach((method) => {
        const original = array[method];
        array[method] = (...args) => {
          const oldValue = [...array];
          const result = original.apply(array, args);
          this.logChange({
            type: "array-operation",
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
    const findAndObserveArrays = (obj, parentPath = "") => {
      for (const [key, value] of Object.entries(obj)) {
        const currentPath = parentPath ? `${parentPath}.${key}` : key;
        if (Array.isArray(value)) {
          observeArray(value, currentPath);
          value.forEach((item, index) => {
            if (typeof item === "object" && item !== null) {
              findAndObserveArrays(item, `${currentPath}[${index}]`);
            }
          });
        } else if (typeof value === "object" && value !== null) {
          findAndObserveArrays(value, currentPath);
        }
      }
    };
    findAndObserveArrays(this.model.data);
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
      computed: Object.fromEntries(
        Object.entries(this.model.computed).map(([key, comp]) => [key, comp.value])
      )
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
      if (Array.isArray(value)) {
        return `Array(${value.length}) ${JSON.stringify(value, null, 2)}`;
      }
      return JSON.stringify(value, null, 2);
    };
    const recentChanges = this.getRecentChanges().map((change) => {
      if (change.type === "array-operation") {
        return {
          ...change,
          description: `${change.path}.${change.method}(${change.args.map((arg) => JSON.stringify(arg)).join(", ")})`
        };
      }
      return change;
    });
    let changes = ``;
    for (const change of recentChanges) {
      changes += `
                <div style="border-bottom: 1px solid #444; padding-bottom: 8px; overflow-x: auto">
                    <pre>${JSON.stringify({ ...change, timestamp: new Date(change.timestamp).toLocaleTimeString() }, null, 2)}</pre>
                </div>
`;
    }
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
                ${changes}
            </div>
        `;
    const timeTravelDialog = document.getElementById("model-devtools-time-travel-dialog");
    if (timeTravelDialog) {
      this.showTimeTravelDialog();
    }
  }
  getComputedValues() {
    return Object.fromEntries(
      Object.entries(this.model.computed).map(([key, comp]) => [key, comp.value])
    );
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
    this.model.on("*", () => {
      this.perfMetrics.updates++;
    });
  }
  getPerfReport() {
    const duration = (Date.now() - this.perfMetrics.startTime) / 1e3;
    return {
      totalUpdates: this.perfMetrics.updates,
      updatesPerSecond: this.perfMetrics.updates / duration,
      computationsPerSecond: this.perfMetrics.computations / duration
    };
  }
};
var dev_tools_default = ModelDevTools;

// src/model.js
var ModelOptions = {
  id: "model",
  memoizeComputed: true
};
var Model = class _Model extends event_emmiter_default {
  static DEBUG_LEVELS = {
    NONE: 0,
    ERROR: 1,
    WARN: 2,
    INFO: 3,
    DEBUG: 4,
    TRACE: 5
  };
  static DEBUG_LEVEL = _Model.DEBUG_LEVELS.NONE;
  static log(level, message, data) {
    if (level > _Model.DEBUG_LEVEL) return;
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
      case _Model.DEBUG_LEVELS.ERROR:
        styleType = "error";
        method = console.error;
        break;
      case _Model.DEBUG_LEVELS.WARN:
        styleType = "warn";
        method = console.warn;
        break;
      case _Model.DEBUG_LEVELS.INFO:
        styleType = "info";
        method = console.info;
        break;
      case _Model.DEBUG_LEVELS.DEBUG:
        styleType = "debug";
        method = console.debug;
        break;
      case _Model.DEBUG_LEVELS.TRACE:
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
    _Model.log(_Model.DEBUG_LEVELS.ERROR, message, data);
  }
  static warn(message, data) {
    _Model.log(_Model.DEBUG_LEVELS.WARN, message, data);
  }
  static info(message, data) {
    _Model.log(_Model.DEBUG_LEVELS.INFO, message, data);
  }
  static debug(message, data) {
    _Model.log(_Model.DEBUG_LEVELS.DEBUG, message, data);
  }
  static trace(message, data) {
    _Model.log(_Model.DEBUG_LEVELS.TRACE, message, data);
  }
  constructor(data = {}, options = {}) {
    _Model.debug("Model initialization with data:", data);
    super();
    this.options = Object.assign({}, ModelOptions, options);
    this.elements = [];
    this.inputs = [];
    this.computed = {};
    this.watchers = /* @__PURE__ */ new Map();
    this.batchProcessing = false;
    this.loops = /* @__PURE__ */ new Map();
    this.events = /* @__PURE__ */ new Map();
    this.middleware = new middleware_default();
    this.autoSaveInterval = null;
    this.domDependencies = /* @__PURE__ */ new Map();
    this.virtualDom = /* @__PURE__ */ new Map();
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
    this.data = this.createReactiveProxy(data);
  }
  // Метод реєстрації залежності DOM від властивості
  registerDomDependency(propertyPath, domElement, info) {
    if (!this.domDependencies.has(propertyPath)) {
      this.domDependencies.set(propertyPath, /* @__PURE__ */ new Set());
    }
    this.domDependencies.get(propertyPath).add({
      element: domElement,
      ...info
    });
  }
  // Парсимо DOM для пошуку циклів
  parseLoops(rootElement) {
    _Model.debug("Looking for items with data-for...");
    const loopElements = rootElement.querySelectorAll("[data-for]");
    _Model.debug("Found items from data-for:", loopElements.length);
    loopElements.forEach((element, index) => {
      const expression = element.getAttribute("data-for").trim();
      _Model.debug(`Element processing ${index}:`, expression);
      const matches = expression.match(/^\s*(\w+)(?:\s*,\s*(\w+))?\s+in\s+(\w+(?:\.\w+)*)\s*$/);
      if (!matches) {
        console.error("Incorrect format of expression data-for:", expression);
        return;
      }
      const [_, itemName, indexName, arrayPath] = matches;
      _Model.debug("The expression is dismantled:", { itemName, indexName, arrayPath });
      const array = this.getValueByPath(arrayPath);
      _Model.debug("An array was obtained:", array);
      if (!Array.isArray(array)) {
        _Model.error(`The value in the path ${arrayPath} is not an array:`, array);
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
      _Model.debug("Update the loop for the item");
      this.updateLoop(element);
    });
  }
  // Оновлюємо цикл
  updateLoop(element) {
    const loopInfo = this.loops.get(element);
    if (!loopInfo) {
      _Model.error("No loop information found for an item");
      return;
    }
    const { template, itemName, indexName, arrayPath, parentNode } = loopInfo;
    const array = this.getValueByPath(arrayPath);
    _Model.debug("Update loop for array:", array);
    if (!Array.isArray(array)) {
      _Model.error("The value is not an array:", array);
      return;
    }
    const generated = parentNode.querySelectorAll(`[data-generated-for="${arrayPath}"]`);
    generated.forEach((el) => el.remove());
    array.forEach((item, index) => {
      const newNode = template.cloneNode(true);
      newNode.style.display = "";
      newNode.removeAttribute("data-for");
      newNode.setAttribute("data-generated-for", arrayPath);
      this.processTemplateNode(newNode, {
        [itemName]: item,
        [indexName || "index"]: index
      });
      parentNode.insertBefore(newNode, element);
    });
    element.style.display = "none";
  }
  // Обробка шаблонних вузлів
  processTemplateNode(node, context) {
    if (node.nodeType === Node.TEXT_NODE) {
      const originalText = node.textContent;
      const newText = node.textContent.replace(/\{\{\s*([^}]+)\s*\}\}/g, (match, path) => {
        path = path.trim();
        const value = context && path in context ? context[path] : this.getValueByPath(path);
        _Model.debug("Replacement in the template:", { original: match, path, value });
        return value;
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
  // Пакетне оновлення: аргумент - функція або об'єкт
  batch(callback) {
    this.batchProcessing = true;
    try {
      if (typeof callback === "function") {
        callback();
      } else {
        for (const [path, value] of Object.entries(callback)) {
          this.setValueByPath(path, value);
        }
      }
    } finally {
      this.updateAllDOM();
      this.batchProcessing = false;
      this.emit("batchComplete");
    }
  }
  // Метод для встановлення значення за шляхом
  setValueByPath(path, value) {
    _Model.debug("Setting value by path:", { path, value });
    const parts = path.split(".");
    let current = this.data;
    for (let i = 0; i < parts.length - 1; i++) {
      if (!(parts[i] in current)) {
        current[parts[i]] = {};
      }
      current = current[parts[i]];
    }
    current[parts[parts.length - 1]] = value;
  }
  // Метод для отримання значення за шляхом
  getValueByPath(path) {
    _Model.debug("Obtaining value by way:", path);
    let value = this.data;
    if (!path) return value;
    const parts = path.split(".");
    for (const part of parts) {
      if (value === void 0 || value === null) {
        _Model.error(`The way ${path} broke off on ${part}`);
        return void 0;
      }
      value = value[part];
    }
    _Model.debug("The value received:", value);
    return value;
  }
  // Додаємо спостерігачів (watchers)
  watch(propertyPath, callback) {
    if (!this.watchers.has(propertyPath)) {
      this.watchers.set(propertyPath, /* @__PURE__ */ new Set());
    }
    this.watchers.get(propertyPath).add(callback);
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
  // Додаємо middleware
  use(middleware) {
    this.middleware.use(middleware);
  }
  // Створення реактивного проксі для масиву
  createArrayProxy(array, path = "") {
    return new Proxy(array, {
      get: (target, property) => {
        _Model.debug("ArrayProxy get:", { path, property });
        return target[property];
      },
      set: (target, property, value) => {
        _Model.debug("ArrayProxy set:", { path, property, value });
        if (typeof property === "symbol") {
          target[property] = value;
          return true;
        }
        target[property] = value;
        this.loops.forEach((loopInfo, element) => {
          if (loopInfo.arrayPath === path) {
            this.updateLoop(element);
          }
        });
        return true;
      }
    });
  }
  // Створення реактивного проксі
  createReactiveProxy(obj, path = "") {
    if (Array.isArray(obj)) {
      return this.createArrayProxy(obj, path);
    }
    return new Proxy(obj, {
      set: async (target, property, value) => {
        if (typeof property === "symbol") {
          target[property] = value;
          return true;
        }
        if (this.validators?.has(`${path}.${property}`)) {
          const isValid = this.validators.get(`${path}.${property}`)(value);
          if (!isValid) return false;
        }
        if (this.formatters?.has(`${path}.${property}`)) {
          value = this.formatters.get(`${path}.${property}`)(value);
        }
        if (value && typeof value === "object") {
          value = this.createReactiveProxy(
            value,
            path ? `${path}.${property}` : property
          );
        }
        const oldValue = target[property];
        const context = {
          property,
          oldValue,
          newValue: value,
          preventDefault: false
        };
        await this.middleware.process(context);
        if (context.preventDefault) {
          return true;
        }
        target[property] = context.newValue;
        this.emit("change", {
          property,
          oldValue,
          newValue: context.newValue
        });
        const fullPath = path ? `${path}.${property}` : property;
        if (this.watchers.has(fullPath)) {
          this.watchers.get(fullPath).forEach(
            (callback) => callback(value, oldValue)
          );
        }
        if (!this.batchProcessing) {
          this.updateDOM(fullPath, value);
          this.updateInputs(fullPath, value);
          this.updateComputedProperties(fullPath);
        }
        return true;
      },
      get: (target, property) => {
        if (typeof property === "symbol") {
          return target[property];
        }
        const fullPath = path ? `${path}.${property}` : property;
        if (fullPath in this.computed) {
          return this.evaluateComputed(fullPath);
        }
        const value = target[property];
        if (value && typeof value === "object") {
          return this.createReactiveProxy(
            value,
            fullPath
          );
        }
        return value;
      }
    });
  }
  // Обчислення значення computed властивості
  evaluateComputed(key, force = false) {
    const computed = this.computed[key];
    const dependencies = /* @__PURE__ */ new Set();
    const dataTracker = new Proxy(this.data, {
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
    this.emit("compute", {
      key,
      value: result,
      dependencies
    });
    return result;
  }
  // Оновлення обчислюваних властивостей при зміні залежностей
  updateComputedProperties(changedProp) {
    for (const key in this.computed) {
      const computed = this.computed[key];
      if (computed.dependencies.includes(changedProp)) {
        console.log(`Updating computed property: ${key}`);
        const newValue = this.evaluateComputed(key);
        this.updateDOM(key, newValue);
        this.updateInputs(key, newValue);
      }
    }
  }
  // Парсимо DOM для пошуку виразів {{ змінна }}
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
        this.setValueByPath(property, value);
      };
      input.__modelInputHandler = handler;
      input.addEventListener("input", handler);
      this.inputs.push({
        element: input,
        property
      });
    });
  }
  // Встановлення значення в input-елемент
  setInputValue(input, value) {
    if (input.type === "checkbox" || input.type === "radio") {
      input.checked = Boolean(value);
    } else {
      input.value = value;
    }
  }
  // Оновлення значень в input-елементах при зміні даних моделі
  updateInputs(propName, value) {
    this.inputs.forEach((item) => {
      if (item.property === propName) {
        this.setInputValue(item.element, value);
      }
    });
  }
  // Оновлюємо элементи DOM, які того потребують
  updateAllDOM() {
    this.elements.forEach((element) => {
      let newContent = element.template;
      newContent = newContent.replace(/\{\{\s*([^}]+)\s*\}\}/g, (match, path) => {
        path = path.trim();
        return this.getValueByPath(path);
      });
      element.node.textContent = newContent;
    });
    this.inputs.forEach((item) => {
      const value = this.getValueByPath(item.property);
      this.setInputValue(item.element, value);
    });
  }
  // Оновлення DOM при зміні даних
  updateDOM(propertyPath, value) {
    if (!this.domDependencies.has(propertyPath)) return;
    const affectedElements = this.domDependencies.get(propertyPath);
    if (affectedElements.size === 0) return;
    const updates = {
      template: [],
      conditional: [],
      loop: []
    };
    affectedElements.forEach((dep) => {
      updates[dep.type].push(dep);
    });
    updates.template.forEach((dep) => this.updateTemplateNode(dep.element, dep.template));
    updates.conditional.forEach((dep) => this.updateConditional(dep.element, dep.expression));
    updates.loop.forEach((dep) => this.updateLoopPart(dep.element, dep.arrayPath, value, dep.index));
  }
  // Парсимо DOM для пошуку умовних виразів
  parseConditionals(rootElement) {
    const conditionalElements = rootElement.querySelectorAll("[data-if]");
    conditionalElements.forEach((element) => {
      const expression = element.getAttribute("data-if").trim();
      element.__originalDisplay = element.style.display === "none" ? "" : element.style.display;
      const variables = this.extractVariables(expression);
      variables.forEach((variable) => {
        this.registerDomDependency(variable, element, {
          type: "conditional",
          expression
        });
      });
      this.updateConditional(element, expression);
    });
  }
  // Оновлення умовного виразу
  updateConditional(element, expression) {
    const currentState = this.virtualDom.get(element);
    const context = { ...this.data };
    const result = this.evaluateExpression(expression, context);
    if (currentState !== result) {
      element.style.display = result ? element.__originalDisplay || "" : "none";
      this.virtualDom.set(element, result);
    }
  }
  // Оновлення частини циклу
  updateLoopPart(element, arrayPath, changedValue, changedIndex) {
    const loopInfo = this.loops.get(element);
    if (!loopInfo) return;
    const { template, itemName, indexName, parentNode } = loopInfo;
    const array = this.getValueByPath(arrayPath);
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
      this.processTemplateNode(newNode, {
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
  // Метод оновлення текстового шаблону
  updateTemplateNode(node, template) {
    const newContent = template.replace(/\{\{\s*([^}]+)\s*\}\}/g, (match, path) => {
      path = path.trim();
      return this.getValueByPath(path);
    });
    if (this.virtualDom.get(node) !== newContent) {
      node.textContent = newContent;
      this.virtualDom.set(node, newContent);
    }
  }
  // Допоміжний метод перевірки доступності localStorage
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
  // Збереження стану
  saveState() {
    if (!_Model.isStorageAvailable()) {
      console.warn("localStorage is not available");
      this.emit("saveStateError", { error: new Error("localStorage is not available") });
      return null;
    }
    const dataToSave = JSON.parse(JSON.stringify(this.data));
    const state = {
      data: dataToSave,
      computed: Object.fromEntries(
        Object.entries(this.computed).map(([key, comp]) => [key, comp.value])
      ),
      timestamp: Date.now()
    };
    try {
      localStorage.setItem(this.options.id, JSON.stringify(state));
      this.emit("saveState", state);
      _Model.debug("State saved:", state);
      return state;
    } catch (error) {
      _Model.error("Error saving state:", error);
      this.emit("saveStateError", { error, state });
      return null;
    }
  }
  // Відновлення стану
  loadState() {
    if (!_Model.isStorageAvailable()) {
      console.warn("localStorage is not available");
      return null;
    }
    const savedState = localStorage.getItem(this.options.id);
    if (savedState) {
      const parsed = JSON.parse(savedState);
      Object.assign(this.data, parsed.data);
      if (parsed.computed) {
        for (const key of Object.keys(this.computed)) {
          this.computed[key].value = this.computed[key].getter.call(this.data);
        }
      }
      this.emit("loadState", {
        data: parsed.data,
        computed: this.getComputedValues()
      });
    }
  }
  loadStateFromSnapshot(snapshot) {
    if (!snapshot) {
      _Model.error("Snapshot is undefined or null");
      return;
    }
    try {
      const computed = {};
      for (const key in snapshot) {
        if (typeof snapshot[key] === "function") {
          computed[key] = {
            getter: snapshot[key],
            value: null,
            dependencies: []
            // Будет заполнено при первом вызове
          };
        } else {
          this.data[key] = snapshot[key];
        }
      }
      this.emit("restoreState", {
        timestamp: Date.now(),
        snapshot
      });
      return true;
    } catch (error) {
      _Model.error("Error loading state from snapshot:", error);
      this.emit("restoreStateError", {
        error,
        snapshot
      });
      return false;
    }
  }
  // Автоматичне збереження в localStorage
  enableAutoSave(interval = 5e3) {
    this.autoSaveInterval = setInterval(() => {
      this.saveState();
    }, interval);
  }
  // Вимкнення автоматичного збереження
  disableAutoSave() {
    clearInterval(this.autoSaveInterval);
  }
  // Допоміжний метод для отримання всіх обчислюваних значень
  getComputedValues() {
    return Object.fromEntries(
      Object.entries(this.computed).map(([key, comp]) => [key, comp.value])
    );
  }
  // Допоміжний метод для вилучення змінних з виразу
  extractVariables(expression) {
    const matches = expression.match(/\b[a-zA-Z_]\w*(?:\.[a-zA-Z_]\w*)*\b/g) || [];
    return [...new Set(matches)];
  }
  // Метод для оцінки виразу
  evaluateExpression(expression, context) {
    try {
      const func = new Function(...Object.keys(context), `return ${expression}`);
      return func(...Object.values(context));
    } catch (error) {
      _Model.error("Error when evaluating expression:", error);
      return false;
    }
  }
  // Ініціюємо модель на відповідному DOM елементі
  init(selector) {
    const rootElement = typeof selector === "string" ? document.querySelector(selector) : selector;
    if (!rootElement) {
      _Model.error("The root element was not found!");
      return;
    }
    this.parseLoops(rootElement);
    this.parseConditionals(rootElement);
    this.parse(rootElement);
    this.updateAllDOM();
    this.emit("init");
    return this;
  }
  // Ініціюємо DevTools
  initDevTools(options = {}) {
    return new dev_tools_default(this, options);
  }
  // Специализированные методы для массивов
  // Пример использования:
  // model.applyArrayChanges('users', (users) => users.push({ name: 'Новый пользователь' }));
  applyArrayChanges(arrayPath, callback) {
    const array = this.getValueByPath(arrayPath);
    if (!Array.isArray(array)) {
      _Model.error(`The path ${arrayPath} is not an array!`);
      return false;
    }
    this.batchProcessing = true;
    let result;
    try {
      result = callback(array);
      this.loops.forEach((loopInfo, element) => {
        if (loopInfo.arrayPath === arrayPath) {
          this.updateLoop(element);
        }
      });
    } finally {
      this.batchProcessing = false;
      this.updateAllDOM();
    }
    return result;
  }
  // Добавим метод для валидации и обработки ошибок
  validateModel() {
    const errors = [];
    const warnings = [];
    for (const key in this.computed) {
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
      if (!this.isValidPath(path)) {
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
    const computed = this.computed[key];
    if (!computed || !computed.dependencies) {
      return null;
    }
    for (const dep of computed.dependencies) {
      if (dep in this.computed) {
        const cyclePath = this.checkCyclicDependencies(dep, new Set(visited), [...path]);
        if (cyclePath) {
          return cyclePath;
        }
      }
    }
    return null;
  }
  // Проверка существования пути в модели
  isValidPath(path) {
    try {
      const value = this.getValueByPath(path);
      return value !== void 0;
    } catch (e) {
      return false;
    }
  }
  destroy() {
    this.disableAutoSave();
    this.inputs.forEach(({ element }) => {
      element.removeEventListener("input", element.__modelInputHandler);
    });
    this.elements = [];
    this.inputs = [];
    this.domDependencies.clear();
    this.virtualDom.clear();
    this.watchers.clear();
    this.loops.clear();
    this.events.clear();
    this.emit("destroy");
  }
};
var model_default = Model;

// src/index.js
var version = "0.11.0";
var build_time = "04.03.2025, 14:21:20";
model_default.info = () => {
  console.info(`%c Model %c v${version} %c ${build_time} `, "color: white; font-weight: bold; background: #0080fe", "color: white; background: darkgreen", "color: white; background: #0080fe;");
};
var index_default = model_default;
export {
  index_default as default
};
