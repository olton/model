/**
 * Type definitions for the Model library
 */

declare module 'model' {
  /**
   * Default options for the Model class.
   */
  interface ModelOptions {
    /**
     * Identifier for the model instance
     * @default "model"
     */
    id: string;
    
    /**
     * Whether to use simple expressions in templates
     * @default true
     */
    useSimpleExpressions?: boolean;
    
    /**
     * Enable debug mode for verbose logging
     * @default false
     */
    debug?: boolean;
    
    plugins?: Array<[string, object]>;
  }

  /**
   * Interface for array change detection results
   */
  interface ArrayChanges {
    /**
     * Items added to the array
     */
    added: Array<{index: number, item: any}>;
    
    /**
     * Items removed from the array
     */
    removed: Array<{index: number, item: any}>;
    
    /**
     * Items moved within the array
     */
    moved: Array<{oldIndex: number, newIndex: number, item: any}>;
  }

  /**
   * Interface for computed property definition
   */
  interface ComputedProperty {
    /**
     * Function that calculates the property value
     */
    getter: () => any;
    
    /**
     * Cached value of the computed property
     */
    value: any;
    
    /**
     * List of dependencies for this computed property
     */
    dependencies: string[];
  }

  /**
   * Interface for validation results
   */
  interface ValidationResults {
    /**
     * Array of validation errors
     */
    errors: Array<{
      type: string;
      property?: string;
      path?: string;
      message: string;
    }>;
    
    /**
     * Array of validation warnings
     */
    warnings: Array<{
      type: string;
      property?: string;
      path?: string;
      message: string;
    }>;
  }

  /**
   * Interface for state snapshot
   */
  interface StateSnapshot {
    /**
     * The data in the snapshot
     */
    data: any;
    
    /**
     * Timestamp when the snapshot was created
     */
    timestamp: number;
  }

  /**
   * Interface for middleware context
   */
  interface MiddlewareContext {
    /**
     * Property being changed
     */
    prop: string;
    
    /**
     * Previous value
     */
    oldValue: any;
    
    /**
     * New value
     */
    newValue: any;
    
    /**
     * Flag to prevent the change
     */
    preventDefault: boolean;
    
    /**
     * For array operations, the method being called
     */
    method?: string;
    
    /**
     * For array operations, the arguments to the method
     */
    args?: any[];
  }

  /**
   * Interface for DOM dependency information
   */
  interface DomDependencyInfo {
    /**
     * DOM element
     */
    element: HTMLElement;
    
    /**
     * Type of dependency
     */
    type: string;
    
    /**
     * Original template text for template dependencies
     */
    template?: string;
    
    /**
     * Additional properties
     */
    [key: string]: any;
  }

  /**
   * Interface for input binding
   */
  interface InputBinding {
    /**
     * Input element
     */
    element: HTMLInputElement;
    
    /**
     * Property path bound to the input
     */
    property: string;
  }

  /**
   * A core class for managing reactive data, DOM bindings, computed properties, and more.
   * Extends EventEmitter for event handling capabilities.
   */
  class Model {
    /**
     * A map for storing registered plugins.
     */
    static plugins: Map<string, Function>;

    /**
     * Creates a new instance of the Model class.
     * @param data - Initial data for the model.
     * @param options - Configuration options for the model.
     */
    constructor(data?: Record<string, any>, options?: Partial<ModelOptions>);

    /**
     * The reactive data store
     */
    store: ReactiveStore;

    /**
     * The reactive data object
     */
    data: Record<string, any>;

    /**
     * DOM manager for handling DOM interactions
     */
    dom: DOMManager;

    /**
     * Computed properties manager
     */
    computedProps: ComputedProps;

    /**
     * State manager for saving/restoring state
     */
    stateManager: StateManager;

    /**
     * Configuration options
     */
    options: ModelOptions;

    /**
     * Computed properties definitions
     */
    computed: Record<string, ComputedProperty>;

    /**
     * Adds a validator function to a specified path.
     * @param path - Path within the state to attach the validator.
     * @param validator - Validation function to execute on path changes.
     */
    addValidator(path: string, validator: (value: any) => boolean): void;

    /**
     * Adds a formatter function to a specified path.
     * @param path - Path within the state to attach the formatter.
     * @param formatter - Formatting function to execute on path changes.
     */
    addFormatter(path: string, formatter: (value: any) => any): void;

    /**
     * Adds middleware to the ReactiveStore for intercepting and processing state changes.
     * @param middleware - Middleware function that receives and can modify state changes before they're applied.
     */
    use(middleware: (context: MiddlewareContext, next: () => void) => void): void;

    /**
     * Watches a specific path in the state and triggers a callback on changes.
     * @param path - Path to watch.
     * @param callback - Callback function to execute when the path changes.
     * @returns Function to unsubscribe the watcher
     */
    watch(path: string, callback: (newValue: any, oldValue: any) => void): () => void;

    /**
     * Executes a batch of state changes in a single update cycle.
     * @param callback - Function that performs multiple state changes
     * @returns The result of the callback function
     */
    batch<T>(callback: (state: Record<string, any>) => T): T;

    /**
     * Detects changes between two arrays and returns the differences.
     * @param newArray - The new array to compare
     * @param oldArray - The old array to compare against
     * @returns Object containing added, removed, and moved items
     */
    diffArrays<T>(newArray: T[], oldArray?: T[]): ArrayChanges;

    /**
     * Validates the model for potential issues, including cyclic dependencies
     * in computed properties and invalid paths in DOM dependencies.
     * @returns Object containing arrays of errors and warnings
     */
    validate(): ValidationResults;

    /**
     * Checks for cyclic dependencies in the computed properties of the model.
     * @param key - The key of the property to check for cyclic dependencies.
     * @param visited - A set of visited properties during the traversal.
     * @param path - The current path of dependencies being checked.
     * @returns Returns an array representing the cyclic path if a cycle is found, otherwise null.
     * @private
     */
    _checkCyclicDependencies(key: string, visited: Set<string>, path?: string[]): string[] | null;

    /**
     * Validates a given path to check if it exists in the model's store.
     * @param path - Path to validate
     * @returns Whether the path exists in the store
     */
    validatePath(path: string): boolean;

    /**
     * Initializes the DOM bindings for the model.
     * @param selector - Selector or root element to bind on.
     * @returns The model instance, or undefined if the root element is not found.
     */
    init(selector?: string | HTMLElement): Model | undefined;

    /**
     * Initializes development tools for the model.
     * @param options - Options for the development tools.
     * @returns An instance of the DevTools class.
     */
    runDevTools(options?: Record<string, any>): DevTools;

    /**
     * Saves the current state of the model.
     * @returns The saved state snapshot or null if saving failed
     */
    save(): StateSnapshot | null;

    /**
     * Restores the model to a previously saved state.
     * @returns The restored state or null if restoration failed
     */
    restore(): any | null;

    /**
     * Creates or restores a snapshot of the current state.
     * @param _snapshot - Optional snapshot to restore
     * @returns The created snapshot or the result of restoring the provided snapshot
     */
    snapshot(_snapshot?: StateSnapshot): StateSnapshot | null;

    /**
     * Enables or disables auto-saving of the model's state.
     * @param interval - Interval in milliseconds for auto-saving, or falsy value to disable
     */
    autoSave(interval?: number): void;

    /**
     * Registers a plugin for the model.
     * @param name - Name of the plugin.
     * @param plugin - Plugin class or constructor function.
     * @throws Error if a plugin with the same name is already registered.
     */
    static registerPlugin(name: string, plugin: Function): void;

    /**
     * Uses a registered plugin by name.
     * @param name - Name of the plugin to use.
     * @param options - Options to pass to the plugin.
     * @returns The model instance to allow method chaining.
     */
    usePlugin(name: string, options?: Record<string, any>): Model;

    /**
     * Removes a registered plugin by name.
     * @param name - Name of the plugin to remove
     */
    static removePlugin(name: string): void;

    /**
     * Displays version information in the console
     */
    static info(): void;

    /**
     * Destroys the model instance and cleans up resources.
     */
    destroy(): void;

    /**
     * Subscribe to model events
     * @param event - Event name
     * @param callback - Callback function
     */
    on(event: string, callback: (...args: any[]) => void): void;

    /**
     * Emit an event
     * @param event - Event name
     * @param data - Event data
     */
    emit(event: string, ...data: any[]): void;
  }

  /**
   * Reactive state management store with deep reactivity through Proxy
   */
  class ReactiveStore {
    /**
     * Creates a new ReactiveStore instance
     * @param initialState - Initial state object
     * @param model - Parent model instance
     */
    constructor(initialState?: Record<string, any>, model?: Model);

    /**
     * The reactive state object
     */
    state: Record<string, any>;

    /**
     * Property change observers
     */
    watchers: Map<string, Set<(newValue: any, oldValue: any) => void>>;

    /**
     * Last known state
     */
    previousState: Record<string, any> | null;

    /**
     * State update pipeline
     */
    middleware: MiddlewareManager;

    /**
     * Registers state change middleware.
     * @param middleware - Handler function for middleware
     */
    use(middleware: (context: MiddlewareContext, next: () => void) => void): void;

    /**
     * Creates reactive proxy for state objects.
     * @param obj - Target object
     * @param path - Property path
     * @returns Reactive proxy
     */
    // @ts-ignore
    createReactiveProxy(obj: Record<string, any> | any[], path?: string): Proxy<Record<string, any> | any[]>;

    /**
     * Creates a reactive proxy for an array.
     * @param array - The array to be proxied
     * @param path - The path to the current property
     * @returns A proxy that wraps the given array
     */
    // @ts-ignore
    createArrayProxy(array: any[], path: string): Proxy<any[]>;

    /**
     * Applies the specified array method on the array located at the given path.
     * @param path - The path to the array in the state tree
     * @param method - The name of the array method to apply
     * @param args - Arguments to pass to the array method
     * @returns The result of applying the array method
     */
    applyArrayMethod(path: string, method: string, ...args: any[]): any;

    /**
     * Watches for changes to an array and applies the provided callback.
     * @param path - The path to the array in the state tree
     * @param callback - A function to modify the array
     * @returns The result of the callback function
     */
    applyArrayChanges<T>(path: string, callback: (array: any[]) => T): T | false;

    /**
     * Detects changes between two arrays.
     * @param newArray - The new array to compare
     * @param oldArray - The old array to compare against
     * @returns Object containing the changes between arrays
     */
    detectArrayChanges<T>(newArray: T[], oldArray?: T[]): ArrayChanges;

    /**
     * Watches for changes to the specified path in the state tree.
     * @param path - The path to watch
     * @param callback - Function to execute on changes
     * @returns Function to unsubscribe the watcher
     */
    watch(path: string, callback: (newValue: any, oldValue: any) => void): () => void;

    /**
     * Retrieves the value at the specified path in the state tree.
     * @param path - The path to the desired value
     * @returns The value at the specified path
     */
    get(path?: string): any;

    /**
     * Sets a new value at the specified path in the state tree.
     * @param path - The path to set
     * @param value - The new value
     * @returns The new value
     */
    set(path: string, value: any): any;

    /**
     * Executes the given updater as a batch operation on the state.
     * @param updater - Function or object with updates
     */
    batch<T>(updater: ((state: Record<string, any>) => T) | Record<string, any>): T | void;

    /**
     * Retrieves the current state tree.
     * @returns The entire state object
     */
    getState(): Record<string, any>;

    /**
     * Retrieves the previous state of the state tree.
     * @returns The previous state object
     */
    getPreviousState(): Record<string, any> | null;

    /**
     * Converts the current state tree to a JSON string.
     * @returns A JSON string representation of the current state
     */
    toJSON(): string;

    /**
     * Reconstructs the state tree from a JSON string.
     * @param json - A JSON string representing the new state
     */
    fromJSON(json: string): void;

    /**
     * Adds a validator function for a specific property.
     * @param propertyPath - The path to validate
     * @param validator - Function that checks validity
     */
    addValidator(propertyPath: string, validator: (value: any) => boolean): void;

    /**
     * Adds a formatter function for a specific property.
     * @param propertyPath - The path to format
     * @param formatter - Function that transforms the value
     */
    addFormatter(propertyPath: string, formatter: (value: any) => any): void;

    /**
     * Validates if the provided path exists in the state tree.
     * @param path - The path to validate
     * @returns Whether the path exists
     */
    isValidPath(path: string): boolean;

    /**
     * Destroys the current state object and cleans up resources.
     */
    destroy(): void;

    /**
     * Subscribe to store events
     * @param event - Event name
     * @param callback - Callback function
     */
    on(event: string, callback: (...args: any[]) => void): void;

    /**
     * Emit an event
     * @param event - Event name
     * @param data - Event data
     */
    emit(event: string, ...data: any[]): void;
  }

  /**
   * The DOMManager class handles interactions with the DOM
   */
  class DOMManager {
    /**
     * Creates an instance of the DOMManager class
     * @param model - The model that serves as the data source
     */
    constructor(model: Model);

    /**
     * The model instance
     */
    model: Model;

    /**
     * Array of DOM elements with bindings
     */
    elements: Array<{
      node: Node;
      propName: string;
      template: string;
    }>;

    /**
     * Array of input elements with bindings
     */
    inputs: Array<InputBinding>;

    /**
     * Map of property paths to DOM dependencies
     */
    domDependencies: Map<string, Set<DomDependencyInfo>>;

    /**
     * Map of nodes to their original content
     */
    virtualDom: Map<Node, string>;

    /**
     * Manager for loop constructs
     */
    loopManager: LoopManager;

    /**
     * Manager for conditional rendering
     */
    conditionalManager: ConditionalManager;

    /**
     * Manager for attribute bindings
     */
    attributeManager: AttributeManager;

    /**
     * Manager for event bindings
     */
    eventManager: EventManager;

    /**
     * Registers a dependency between a model property path and a DOM element.
     * @param propertyPath - Model property path to watch
     * @param domElement - DOM element to update
     * @param info - Additional dependency metadata
     */
    registerDomDependency(propertyPath: string, domElement: HTMLElement, info: Record<string, any>): void;

    /**
     * Processes template nodes and replaces placeholders with values.
     * @param node - DOM node to process
     * @param context - Optional context data for placeholder replacement
     */
    processTemplateNode(node: Node, context?: Record<string, any>): void;

    /**
     * Parses DOM tree for template placeholders and sets up reactive bindings.
     * @param root - Starting point for DOM traversal
     */
    parse(root: HTMLElement): void;

    /**
     * Sets the value of the input element based on the provided value.
     * @param input - The input element to update
     * @param value - The value to set
     */
    setInputValue(input: HTMLInputElement, value: any): void;

    /**
     * Updates all input elements associated with the specified property.
     * @param propName - The property name
     * @param value - The value to set
     */
    updateInputs(propName: string, value: any): void;

    /**
     * Updates DOM elements based on a property change.
     * @param path - The property path that changed
     * @param value - The new value
     */
    updateDOM(path: string, value: any): void;

    /**
     * Updates all DOM elements based on the current state.
     */
    updateAllDOM(): void;

    /**
     * Checks if a path is dependent on another path.
     * @param basePath - The base path to check against
     * @param testPath - The path to test for dependency
     * @returns Whether testPath depends on basePath
     */
    isPathDependency(basePath: string, testPath: string): boolean;

    /**
     * Gets all paths that depend on the specified path.
     * @param path - The path for which to find dependent paths
     * @returns Array of dependent paths
     */
    getDependentPaths(path: string): string[];

    /**
     * Binds and processes the DOM for data binding.
     * @param rootElement - The root element to initiate the DOM binding
     */
    bindDOM(rootElement: HTMLElement): void;

    /**
     * Destroys the instance by performing cleanup tasks.
     */
    destroy(): void;
  }

  /**
   * Manages computed properties for the model
   */
  class ComputedProps {
    /**
     * Creates a new ComputedProps instance
     * @param model - The parent model
     * @param computed - Object containing computed property definitions
     */
    constructor(model: Model, computed: Record<string, ComputedProperty>);

    /**
     * Updates computed properties when dependencies change
     * @param path - The path that changed
     * @returns Promise that resolves when updates are complete
     */
    update(path: string): Promise<void>;
  }

  /**
   * Manages state persistence and restoration
   */
  class StateManager {
    /**
     * Creates a new StateManager instance
     * @param store - The reactive store to manage
     */
    constructor(store: ReactiveStore);

    /**
     * Saves the current state
     * @returns The saved state snapshot or null
     */
    saveState(): StateSnapshot | null;

    /**
     * Restores a previously saved state
     * @returns The restored state or null
     */
    restoreState(): any | null;

    /**
     * Creates a snapshot of the current state
     * @returns The created snapshot
     */
    createSnapshot(): StateSnapshot;

    /**
     * Restores a state from a snapshot
     * @param snapshot - The snapshot to restore
     * @returns The restored state
     */
    restoreSnapshot(snapshot: StateSnapshot): any;

    /**
     * Enables automatic state saving
     * @param interval - Interval in milliseconds
     */
    enableAutoSave(interval: number): void;

    /**
     * Disables automatic state saving
     */
    disableAutoSave(): void;

    /**
     * Subscribe to state manager events
     * @param event - Event name
     * @param callback - Callback function
     */
    on(event: string, callback: (...args: any[]) => void): void;

    /**
     * Emit an event
     * @param event - Event name
     * @param data - Event data
     */
    emit(event: string, ...data: any[]): void;
  }

  /**
   * Manages middleware for the reactive store
   */
  class MiddlewareManager {
    /**
     * Creates a new MiddlewareManager instance
     */
    constructor();

    /**
     * Adds middleware to the pipeline
     * @param middleware - Middleware function
     */
    use(middleware: (context: MiddlewareContext, next: () => void) => void): void;

    /**
     * Processes a context through the middleware pipeline
     * @param context - Context object for the middleware
     * @returns Promise that resolves when processing is complete
     */
    process(context: MiddlewareContext): Promise<void>;
  }

  /**
   * Manages loop constructs in templates
   */
  class LoopManager {
    /**
     * Creates a new LoopManager instance
     * @param domManager - The DOM manager
     * @param model - The model instance
     */
    constructor(domManager: DOMManager, model: Model);

    /**
     * Parses loop constructs in the DOM
     * @param root - Root element to start parsing from
     */
    parseLoops(root: HTMLElement): void;

    /**
     * Destroys the instance and cleans up resources
     */
    destroy(): void;
  }

  /**
   * Manages conditional rendering in templates
   */
  class ConditionalManager {
    /**
     * Creates a new ConditionalManager instance
     * @param domManager - The DOM manager
     * @param model - The model instance
     */
    constructor(domManager: DOMManager, model: Model);

    /**
     * Parses conditional constructs in the DOM
     * @param root - Root element to start parsing from
     */
    parseConditionals(root: HTMLElement): void;

    /**
     * Destroys the instance and cleans up resources
     */
    destroy(): void;
  }

  /**
   * Manages attribute bindings in templates
   */
  class AttributeManager {
    /**
     * Creates a new AttributeManager instance
     * @param domManager - The DOM manager
     * @param model - The model instance
     */
    constructor(domManager: DOMManager, model: Model);

    /**
     * Parses attribute bindings in the DOM
     * @param root - Root element to start parsing from
     */
    parseAttributes(root: HTMLElement): void;

    /**
     * Parses special attribute bindings in the DOM
     * @param root - Root element to start parsing from
     */
    parseAttributesBind(root: HTMLElement): void;
  }

  /**
   * Manages event bindings in templates
   */
  class EventManager {
    /**
     * Creates a new EventManager instance
     * @param domManager - The DOM manager
     * @param model - The model instance
     */
    constructor(domManager: DOMManager, model: Model);

    /**
     * Parses event bindings in the DOM
     * @param root - Root element to start parsing from
     */
    parseEvents(root: HTMLElement): void;

    /**
     * Destroys the instance and cleans up resources
     */
    destroy(): void;
  }

  /**
   * Development tools for debugging and inspecting the model
   */
  class DevTools {
    /**
     * Creates a new DevTools instance
     * @param model - The model to inspect
     * @param options - Configuration options
     */
    constructor(model: Model, options?: Record<string, any>);
  }

  /**
   * Event emitter for handling events
   */
  class EventEmitter {
    /**
     * Subscribe to an event
     * @param event - Event name
     * @param callback - Callback function
     */
    on(event: string, callback: (...args: any[]) => void): void;

    /**
     * Subscribe to an event once
     * @param event - Event name
     * @param callback - Callback function
     */
    once(event: string, callback: (...args: any[]) => void): void;

    /**
     * Unsubscribe from an event
     * @param event - Event name
     * @param callback - Callback function
     */
    off(event: string, callback: (...args: any[]) => void): void;

    /**
     * Emit an event
     * @param event - Event name
     * @param args - Event arguments
     */
    emit(event: string, ...args: any[]): void;
  }

  /**
   * Logger utility for debugging
   */
  class Logger {
    /**
     * Debug level (0-4)
     */
    static DEBUG_LEVEL: number;

    /**
     * Log a debug message
     * @param message - Message to log
     * @param args - Additional arguments
     */
    static debug(message: string, ...args: any[]): void;

    /**
     * Log an info message
     * @param message - Message to log
     * @param args - Additional arguments
     */
    static info(message: string, ...args: any[]): void;

    /**
     * Log a warning message
     * @param message - Message to log
     * @param args - Additional arguments
     */
    static warn(message: string, ...args: any[]): void;

    /**
     * Log an error message
     * @param message - Message to log
     * @param args - Additional arguments
     */
    static error(message: string, ...args: any[]): void;
  }

  export default Model;
}