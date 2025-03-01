
/*!
 * Model v0.3.0
 * Build: 01.03.2025, 19:49:19
 * Copyright 2012-2025 by Serhii Pimenov
 * Licensed under MIT
 */


// src/model.js
var ModelOptions = {
  id: "model"
};
var Model = class _Model {
  static DEBUG = false;
  static log = (...args) => {
    if (_Model.DEBUG) {
    }
  };
  constructor(data = {}, options = {}) {
    _Model.log("\u0406\u043D\u0456\u0446\u0456\u0430\u043B\u0456\u0437\u0430\u0446\u0456\u044F Model \u0437 \u0434\u0430\u043D\u0438\u043C\u0438:", data);
    this.options = Object.assign({}, ModelOptions, options);
    this.elements = [];
    this.inputs = [];
    this.computed = {};
    this.watchers = /* @__PURE__ */ new Map();
    this.batchUpdate = false;
    this.loops = /* @__PURE__ */ new Map();
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
  parseLoops(rootElement) {
    _Model.log("\u0428\u0443\u043A\u0430\u0454\u043C\u043E \u0435\u043B\u0435\u043C\u0435\u043D\u0442\u0438 \u0437 m-for");
    const loopElements = rootElement.querySelectorAll("[m-for]");
    _Model.log("\u0417\u043D\u0430\u0439\u0434\u0435\u043D\u043E \u0435\u043B\u0435\u043C\u0435\u043D\u0442\u0456\u0432 \u0437 m-for:", loopElements.length);
    loopElements.forEach((element, index) => {
      const expression = element.getAttribute("m-for").trim();
      _Model.log(`\u041E\u0431\u0440\u043E\u0431\u043A\u0430 \u0435\u043B\u0435\u043C\u0435\u043D\u0442\u0443 ${index}:`, expression);
      const matches = expression.match(/^\s*(\w+)(?:\s*,\s*(\w+))?\s+in\s+(\w+(?:\.\w+)*)\s*$/);
      if (!matches) {
        return;
      }
      const [_, itemName, indexName, arrayPath] = matches;
      _Model.log("\u0420\u043E\u0437\u0456\u0431\u0440\u0430\u043D\u043E \u0432\u0438\u0440\u0430\u0437:", { itemName, indexName, arrayPath });
      const array = this.getValueByPath(arrayPath);
      _Model.log("\u041E\u0442\u0440\u0438\u043C\u0430\u043D\u043E \u043C\u0430\u0441\u0438\u0432:", array);
      if (!Array.isArray(array)) {
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
      _Model.log("\u041E\u043D\u043E\u0432\u043B\u044E\u0454\u043C\u043E \u0446\u0438\u043A\u043B \u0434\u043B\u044F \u0435\u043B\u0435\u043C\u0435\u043D\u0442\u0443");
      this.updateLoop(element);
    });
  }
  updateLoop(element) {
    const loopInfo = this.loops.get(element);
    if (!loopInfo) {
      return;
    }
    const { template, itemName, indexName, arrayPath, parentNode } = loopInfo;
    const array = this.getValueByPath(arrayPath);
    _Model.log("\u041E\u043D\u043E\u0432\u043B\u0435\u043D\u043D\u044F \u0446\u0438\u043A\u043B\u0443 \u0434\u043B\u044F \u043C\u0430\u0441\u0438\u0432\u0443:", array);
    if (!Array.isArray(array)) {
      return;
    }
    const generated = parentNode.querySelectorAll(`[data-generated-for="${arrayPath}"]`);
    generated.forEach((el) => el.remove());
    array.forEach((item, index) => {
      const newNode = template.cloneNode(true);
      newNode.style.display = "";
      newNode.removeAttribute("m-for");
      newNode.setAttribute("data-generated-for", arrayPath);
      this.processTemplateNode(newNode, {
        [itemName]: item,
        [indexName || "index"]: index
      });
      parentNode.insertBefore(newNode, element);
    });
    element.style.display = "none";
  }
  processTemplateNode(node, context) {
    if (node.nodeType === Node.TEXT_NODE) {
      const originalText = node.textContent;
      const newText = node.textContent.replace(/\{\{\s*([^}]+)\s*\}\}/g, (match, path) => {
        path = path.trim();
        const value = context && path in context ? context[path] : this.getValueByPath(path);
        _Model.log("\u0417\u0430\u043C\u0456\u043D\u0430 \u0432 \u0448\u0430\u0431\u043B\u043E\u043D\u0456:", { original: match, path, value });
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
  // bindLoopEvents(node, item, index) {
  //     const clickHandler = node.getAttribute('m-on:click');
  //     if (clickHandler) {
  //         node.addEventListener('click', (event) => {
  //             // Створюємо контекст для обробника
  //             const context = {
  //                 item,
  //                 index,
  //                 event,
  //                 target: event.target
  //             };
  //
  //             // Виконуємо обробник у контексті моделі
  //             this.executeHandler(clickHandler, context);
  //         });
  //     }
  // }
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
  // Метод для отримання значення за шляхом
  getValueByPath(path) {
    _Model.log("\u041E\u0442\u0440\u0438\u043C\u0430\u043D\u043D\u044F \u0437\u043D\u0430\u0447\u0435\u043D\u043D\u044F \u0437\u0430 \u0448\u043B\u044F\u0445\u043E\u043C:", path);
    let value = this.data;
    if (!path) return value;
    const parts = path.split(".");
    for (const part of parts) {
      if (value === void 0 || value === null) {
        return void 0;
      }
      value = value[part];
    }
    _Model.log("\u041E\u0442\u0440\u0438\u043C\u0430\u043D\u0435 \u0437\u043D\u0430\u0447\u0435\u043D\u043D\u044F:", value);
    return value;
  }
  // Збереження стану
  saveState() {
    localStorage.setItem(this.options.id, JSON.stringify(this.data));
  }
  // Відновлення стану
  loadState() {
    const savedState = localStorage.getItem(this.options.id);
    if (savedState) {
      const newState = JSON.parse(savedState);
      this.batch(() => {
        Object.assign(this.data, newState);
      });
    }
  }
  // Парсимо DOM для пошуку умовних виразів
  parseConditionals(rootElement) {
    _Model.log("\u0428\u0443\u043A\u0430\u0454\u043C\u043E \u0435\u043B\u0435\u043C\u0435\u043D\u0442\u0438 \u0437 m-if");
    const conditionalElements = rootElement.querySelectorAll("[m-if]");
    _Model.log("\u0417\u043D\u0430\u0439\u0434\u0435\u043D\u043E \u0435\u043B\u0435\u043C\u0435\u043D\u0442\u0456\u0432 \u0437 m-if:", conditionalElements.length);
    conditionalElements.forEach((element) => {
      const expression = element.getAttribute("m-if").trim();
      _Model.log("\u041E\u0431\u0440\u043E\u0431\u043A\u0430 \u0443\u043C\u043E\u0432\u043D\u043E\u0433\u043E \u0432\u0438\u0440\u0430\u0437\u0443:", expression);
      const originalDisplay = element.style.display;
      const updateVisibility = () => {
        try {
          const context = { ...this.data };
          const result = this.evaluateExpression(expression, context);
          element.style.display = result ? originalDisplay || "" : "none";
          _Model.log(`\u0420\u0435\u0437\u0443\u043B\u044C\u0442\u0430\u0442 \u0432\u0438\u0440\u0430\u0437\u0443 ${expression}:`, result);
        } catch (error) {
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
      return false;
    }
  }
  // Ініціюємо модель на відповідному DOM елементі
  init(selector) {
    const rootElement = typeof selector === "string" ? document.querySelector(selector) : selector;
    if (!rootElement) {
      return;
    }
    this.parseLoops(rootElement);
    this.parseConditionals(rootElement);
    this.parse(rootElement);
    this.updateAllDOM();
    return this;
  }
};
var model_default = Model;

// src/index.js
model_default.info = () => {
};
var index_default = model_default;
export {
  index_default as default
};
