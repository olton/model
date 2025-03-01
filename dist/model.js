
/*!
 * Model v0.5.0
 * Build: 01.03.2025, 22:08:16
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
            
            .time-travel-item {
                padding: 8px;
                margin: 4px 0;
                border: 1px solid #444;
                cursor: pointer;
                hover: background-color: #333;
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
            <div style="padding: 8px; border-bottom: 1px solid #333; display: flex; justify-content: space-between;">
                <span>Model DevTools</span>
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
    const dialog = document.createElement("div");
    dialog.id = "model-devtools-time-travel-dialog";
    const statesList = this.history.map((snapshot, index) => `
            <div class="time-travel-item">
                <div>Time: ${new Date(snapshot.timestamp).toLocaleTimeString()}</div>
                <div>Type: ${snapshot.type}</div>
                <div>Property: ${snapshot.property || snapshot.event || snapshot.path || ""}</div>
                <div>Value: ${snapshot.oldValue + " -> " + snapshot.newValue}</div>
                <button style="margin-top: 8px; background: dodgerblue;" onclick="window.__MODEL_DEVTOOLS__.timeTravel(${index})">
                    Go to this state
                </button>
            </div>
        `).join("");
    dialog.innerHTML = `
            <div style="display: flex; gap: 10px;">
                <h3 style="margin: 0">Time Travel</h3>
                <button style="margin-left: auto" onclick="this.parentElement.parentElement.remove()">\xD7</button>
            </div>
            <div>${statesList || "Nothing to show!"}</div>
        `;
    document.body.appendChild(dialog);
    if (!statesList) {
      setTimeout(() => {
        dialog.remove();
      }, 2e3);
    }
  }
  createToggleButton() {
    const button = document.createElement("button");
    button.id = "model-dev-tools-toggle-button";
    button.textContent = "Model DevTools";
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
      if (eventName !== "change") {
        this.logChange({
          type: "event",
          event: eventName,
          data,
          timestamp: Date.now()
        });
      }
    });
    this.model.on("computedUpdated", ({ key, value }) => {
      this.logChange({
        type: "computed-update",
        property: key,
        value,
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
    this.model.loadState(JSON.stringify(snapshot.state));
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
  id: "model"
};
var Model = class _Model extends event_emmiter_default {
  static DEBUG = false;
  static log = (...args) => {
    if (_Model.DEBUG) {
      console.log(...args);
    }
  };
  constructor(data = {}, options = {}) {
    _Model.log("Model initialization with data:", data);
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
    for (const key in data) {
      if (typeof data[key] === "function") {
        this.computed[key] = {
          getter: data[key],
          value: null,
          dependencies: []
          // Будет заполнено при первом вызове
        };
        delete data[key];
      }
    }
    this.data = this.createReactiveProxy(data);
  }
  // Парсимо DOM для пошуку циклів
  parseLoops(rootElement) {
    _Model.log("Looking for items with data-for");
    const loopElements = rootElement.querySelectorAll("[data-for]");
    _Model.log("Found items from data-for:", loopElements.length);
    loopElements.forEach((element, index) => {
      const expression = element.getAttribute("data-for").trim();
      _Model.log(`Element processing ${index}:`, expression);
      const matches = expression.match(/^\s*(\w+)(?:\s*,\s*(\w+))?\s+in\s+(\w+(?:\.\w+)*)\s*$/);
      if (!matches) {
        console.error("Incorrect format of expression data-for:", expression);
        return;
      }
      const [_, itemName, indexName, arrayPath] = matches;
      _Model.log("The expression is dismantled:", { itemName, indexName, arrayPath });
      const array = this.getValueByPath(arrayPath);
      _Model.log("An array was obtained:", array);
      if (!Array.isArray(array)) {
        console.error(`The value in the way ${arrayPath} is not an array:`, array);
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
      _Model.log("Update the cycle for the item");
      this.updateLoop(element);
    });
  }
  // Оновлюємо цикл
  updateLoop(element) {
    const loopInfo = this.loops.get(element);
    if (!loopInfo) {
      console.error("No cycle information found for an item");
      return;
    }
    const { template, itemName, indexName, arrayPath, parentNode } = loopInfo;
    const array = this.getValueByPath(arrayPath);
    _Model.log("Update cycle for array:", array);
    if (!Array.isArray(array)) {
      console.error("The value is not an array:", array);
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
        _Model.log("Replacement in the template:", { original: match, path, value });
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
  setValueByPath(path, value) {
    _Model.log("Setting value by path:", { path, value });
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
  // Оновлюємо метод createArrayProxy
  createArrayProxy(array, path = "") {
    return new Proxy(array, {
      get: (target, property) => {
        _Model.log("ArrayProxy get:", { path, property });
        return target[property];
      },
      set: (target, property, value) => {
        _Model.log("ArrayProxy set:", { path, property, value });
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
  // Новий метод для створення реактивного проксі
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
  // Вычисление значения computed свойства
  evaluateComputed(key) {
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
  // Обновление вычисляемых свойств при изменении зависимостей
  updateComputedProperties(changedProp) {
    for (const key in this.computed) {
      const computed = this.computed[key];
      if (computed.dependencies.includes(changedProp)) {
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
      null,
      false
    );
    let node;
    const regex = /\{\{\s*([^}]+)\s*\}\}/g;
    while (node = walker.nextNode()) {
      let match;
      const text = node.textContent;
      const originalText = text;
      while ((match = regex.exec(text)) !== null) {
        const propPath = match[1].trim();
        this.elements.push({
          node,
          propName: propPath,
          template: originalText
        });
      }
    }
    const inputs = root.querySelectorAll("[data-model]");
    inputs.forEach((input) => {
      const property = input.getAttribute("data-model");
      this.inputs.push({
        element: input,
        property
      });
      input.addEventListener("input", (e) => {
        const value = e.target.value;
        const path = property.split(".");
        let current = this.data;
        for (let i = 0; i < path.length - 1; i++) {
          current = current[path[i]];
        }
        current[path[path.length - 1]] = value;
      });
    });
  }
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
  // Оновлюємо метод updateDOM для підтримки вкладених шляхів
  updateDOM(propertyPath, value) {
    this.elements.forEach((element) => {
      const isAffected = element.propName === propertyPath || element.propName.startsWith(propertyPath + ".") || propertyPath.startsWith(element.propName + ".");
      if (isAffected) {
        let newContent = element.template;
        newContent = newContent.replace(/\{\{\s*([^}]+)\s*\}\}/g, (match, path) => {
          path = path.trim();
          return this.getValueByPath(path);
        });
        element.node.textContent = newContent;
      }
    });
  }
  // Метод для отримання значення за шляхом
  getValueByPath(path) {
    _Model.log("\u041E\u0442\u0440\u0438\u043C\u0430\u043D\u043D\u044F \u0437\u043D\u0430\u0447\u0435\u043D\u043D\u044F \u0437\u0430 \u0448\u043B\u044F\u0445\u043E\u043C:", path);
    let value = this.data;
    if (!path) return value;
    const parts = path.split(".");
    for (const part of parts) {
      if (value === void 0 || value === null) {
        console.error(`The way ${path} broke off on ${part}`);
        return void 0;
      }
      value = value[part];
    }
    _Model.log("The value received:", value);
    return value;
  }
  // Збереження стану
  saveState() {
    const state = {
      data: this.data,
      computed: Object.fromEntries(
        Object.entries(this.computed).map(([key, comp]) => [key, comp.value])
      )
    };
    localStorage.setItem(this.options.id, JSON.stringify(state));
    _Model.log("State saved:", state);
    this.emit("saveState", state);
    return state;
  }
  // Відновлення стану
  loadState() {
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
  // Допоміжний метод для отримання всіх обчислюваних значень
  getComputedValues() {
    return Object.fromEntries(
      Object.entries(this.computed).map(([key, comp]) => [key, comp.value])
    );
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
  // Парсимо DOM для пошуку умовних виразів
  parseConditionals(rootElement) {
    _Model.log("Looking for items with data-if");
    const conditionalElements = rootElement.querySelectorAll("[data-if]");
    _Model.log("Found items from data-if:", conditionalElements.length);
    conditionalElements.forEach((element) => {
      const expression = element.getAttribute("data-if").trim();
      _Model.log("Processing of conditional expression:", expression);
      const originalDisplay = element.style.display;
      const updateVisibility = () => {
        try {
          const context = { ...this.data };
          const result = this.evaluateExpression(expression, context);
          element.style.display = result ? originalDisplay || "" : "none";
          _Model.log(`The result of the expression ${expression}:`, result);
        } catch (error) {
          console.error("Error in processing data-if:", error);
        }
      };
      const variables = this.extractVariables(expression);
      variables.forEach((variable) => {
        this.watch(variable, () => updateVisibility());
      });
      updateVisibility();
    });
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
      console.error("Error when evaluating expression:", error);
      return false;
    }
  }
  // Ініціюємо модель на відповідному DOM елементі
  init(selector) {
    const rootElement = typeof selector === "string" ? document.querySelector(selector) : selector;
    if (!rootElement) {
      console.error("The root element was not found!");
      return;
    }
    this.parseLoops(rootElement);
    this.parseConditionals(rootElement);
    this.parse(rootElement);
    this.updateAllDOM();
    return this;
  }
  // Ініціюємо DevTools
  initDevTools(options = {}) {
    return new dev_tools_default(this, options);
  }
};
var model_default = Model;

// src/index.js
var version = "0.5.0";
var build_time = "01.03.2025, 22:08:16";
model_default.info = () => {
  console.info(`%c Model %c v${version} %c ${build_time} `, "color: white; font-weight: bold; background: #0080fe", "color: white; background: darkgreen", "color: white; background: #0080fe;");
};
var index_default = model_default;
export {
  index_default as default
};
