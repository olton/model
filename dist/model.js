
/*!
 * Model v0.3.0
 * Build: 01.03.2025, 10:52:00
 * Copyright 2012-2025 by Serhii Pimenov
 * Licensed under MIT
 */


// src/model.js
var ModelOptions = {
  id: "model"
};
var Model = class {
  constructor(data = {}, options = {}) {
    this.options = Object.assign({}, ModelOptions, options);
    this.elements = [];
    this.inputs = [];
    this.computed = {};
    this.watchers = /* @__PURE__ */ new Map();
    this.batchUpdate = false;
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
  batch(callback) {
    this.batchUpdate = true;
    callback();
    this.batchUpdate = false;
    this.updateAllDOM();
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
  // Новий метод для створення реактивного проксі
  createReactiveProxy(obj, path = "") {
    return new Proxy(obj, {
      set: (target, property, value) => {
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
        target[property] = value;
        const fullPath = path ? `${path}.${property}` : property;
        if (this.watchers.has(fullPath)) {
          this.watchers.get(fullPath).forEach(
            (callback) => callback(value, oldValue)
          );
        }
        if (!this.batchUpdate) {
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
  parse(rootElement) {
    let root;
    if (typeof rootElement === "string") {
      root = document.querySelector(rootElement);
    } else if (rootElement instanceof HTMLElement) {
      root = rootElement;
    } else {
      root = document.body;
    }
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
  // Оновлення значень в input-елементах при зміні даних моделі
  updateInputs(propName, value) {
    this.inputs.forEach((item) => {
      if (item.property === propName) {
        const input = item.element;
        if (input.type === "checkbox" || input.type === "radio") {
          input.checked = Boolean(value);
        } else if (input.value !== String(value)) {
          input.value = value;
        }
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
      const input = item.element;
      if (input.type === "checkbox" || input.type === "radio") {
        input.checked = Boolean(value);
      } else if (input.value !== String(value)) {
        input.value = value;
      }
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
  // Новий метод для отримання значення за шляхом
  getValueByPath(path) {
    if (path in this.computed) {
      return this.evaluateComputed(path);
    }
    const parts = path.split(".");
    let current = this.data;
    for (const part of parts) {
      if (current === void 0 || current === null) {
        return "";
      }
      current = current[part];
    }
    return current;
  }
  // Додаємо збереження стану
  saveState() {
    localStorage.setItem(this.options.id, JSON.stringify(this.data));
  }
  loadState() {
    const savedState = localStorage.getItem(this.options.id);
    if (savedState) {
      const newState = JSON.parse(savedState);
      this.batch(() => {
        Object.assign(this.data, newState);
      });
    }
  }
  // Ініціюємо модель на відповідному DOM елементі
  init(rootElement) {
    this.parse(rootElement);
    this.updateAllDOM();
    return this;
  }
};
var model_default = Model;

// src/index.js
var version = "___VERSION___";
var build_time = "___BUILD_TIME___";
model_default.info = () => {
  console.info(`%c Dom %c v${version} %c ${build_time} `, "color: white; font-weight: bold; background: #0080fe", "color: white; background: darkgreen", "color: white; background: #0080fe;");
};
var index_default = model_default;
export {
  index_default as default
};
