import { describe, it, expect, spy, mock, waitFor } from '@olton/latte'
import Model from '../src/core/model.js';
import ModelPlugin from '../src/plugin/index.js';

// Simple spy function to replace jest.spyOn
function createSpy(obj, methodName) {
    const originalMethod = obj[methodName];
    const calls = [];

    obj[methodName] = function(...args) {
        calls.push(args);
        return originalMethod.apply(this, args);
    };

    return {
        calls,
        mockRestore: function() {
            obj[methodName] = originalMethod;
        }
    };
}

// Simple mock function to replace jest.fn()
function createMock() {
    const calls = [];
    const mock = function(...args) {
        calls.push(args);
    };
    mock.calls = calls;
    return mock;
}

describe('Model', () => {
    it('should create a new instance with default options', () => {
        const model = new Model();
        expect(model.options.id).toBe('model');
        expect(model.options.useSimpleExpressions).toBeTrue();
        expect(model.options.debug).toBeFalse();
    });

    it('should create a new instance with custom options', () => {
        const model = new Model({}, { id: 'custom-model', debug: false });
        expect(model.options.id).toBe('custom-model');
    });

    it('should register computed properties', () => {
        const model = new Model({
            firstName: 'John',
            lastName: 'Doe',
            fullName: function() {
                return this.firstName + ' ' + this.lastName;
            }
        });

        expect(model.computed.fullName).toBeDefined();
        expect(typeof model.computed.fullName.getter).toBe('function');
    });

    it('should add validator to a path', () => {
        const model = new Model({ age: 25 });
        const validator = mock(value => value >= 18);

        model.addValidator('age', validator);

        model.data.age = 17;
        
        expect(validator).toHaveBeenCalled();
        expect(model.data.age).toBe(25);
    });

    it('should add formatter to a path', async () => {
        const model = new Model({ price: 10 });
        const formatter = mock( value => `$${value}` );

        model.addFormatter('price', formatter);
        model.data.price = 20

        await waitFor(100); // Wait for the formatter to be called
        
        expect(formatter).toHaveBeenCalled();
        expect(model.data.price).toBe('$20');
    });

    it('should use middleware', async () => {
        const model = new Model({ count: 0 });
        const middleware = mock( v => v + 1);

        model.use(middleware);
        
        model.data.count = 1;
        await waitFor(100); // Wait for the middleware to be called

        expect(middleware).toHaveBeenCalled();
        expect(model.data.count).toBe(1);
    });

    it('should watch a path for changes', () => {
        const model = new Model({ count: 0 });
        const callback = mock();

        // Spy on the store's watch method
        model.store.watch = mock();

        model.watch('count', callback);

        expect(model.store.watch).toHaveBeenCalled();
    });

    it('should batch updates', () => {
        const model = new Model({ count: 0, total: 0 });

        // Spy on the store's batch method
        model.store.batch = mock();

        const callback = () => {
            model.data.count = 1;
            model.data.total = 100;
        };

        model.batch(callback);

        expect(model.store.batch).toHaveBeenCalled();
    });

    it('should validate paths', () => {
        const model = new Model({ user: { name: 'John' } });

        expect(model.validatePath('user.name')).toBeTrue();
        expect(model.validatePath('user.age')).toBeFalse();
    });

    it('should save and restore state', () => {
        const model = new Model({ count: 0 });

        // Spy on the stateManager's methods
        model.stateManager.saveState = mock(() => JSON.stringify({ data: { count: 0 }, timestamp: 1747033007280 }));
        model.stateManager.restoreState = mock()

        model.save();
        expect(model.stateManager.saveState).toHaveBeenCalled("Save state not called");
        
        model.restore();
        expect(model.stateManager.restoreState).toHaveBeenCalled("Restore state not called");
    });

    it('should create and restore snapshots', async () => {
        const model = new Model({ count: 0 }, {debug: false});

        // Spy on the stateManager's methods
        model.stateManager.createSnapshot = mock(() => JSON.stringify({ data: { count: 0 }, timestamp: 1747033007280 }));
        model.stateManager.restoreSnapshot = mock();

        const snapshot = model.snapshot();
        expect(model.stateManager.createSnapshot).toHaveBeenCalled("Create snapshot not called");

        model.snapshot(snapshot);
        expect(model.stateManager.restoreSnapshot).toHaveBeenCalled("Restore snapshot not called");
    });

    it('should enable and disable auto-save', () => {
        const model = new Model({ count: 0 });

        // Spy on the stateManager's methods
        model.stateManager.enableAutoSave = mock();
        model.stateManager.disableAutoSave = mock();

        model.autoSave(1000);
        model.autoSave(null);

        expect(model.stateManager.enableAutoSave).toHaveBeenCalled();
        expect(model.stateManager.disableAutoSave).toHaveBeenCalled();
    });

    it('should register and use plugins', async () => {
        class MyPlugin extends ModelPlugin {
            constructor(model, options) {
                super(model);
                this.options = options;
                this.model = model;
            }

            run() {
                this.model.data.count = 10;  // У batch змінювати можна безпосередньо
            }
        }

        const model = new Model({
            count: 2
        }, { 
            plugins: [
                { name: 'test', plugin: MyPlugin, options: { someOption: true } }
            ] 
        });
        
        
        expect(() => {
            model.registerPlugin('test', MyPlugin)
        }).toThrow();

        model.usePlugin('test');        
        await waitFor(100); // Wait for the plugin to run
        expect(model.data.count).toBe(10);

        // Clean up
        model.removePlugin('test');
        expect(model.plugins.has('test')).toBeFalse();
    });

    it('should destroy the model', () => {
        const model = new Model();

        // Spy on the dom's and store's destroy methods
        model.dom.destroy = mock();
        model.store.destroy = mock();

        model.destroy();

        expect(model.dom.destroy).toHaveBeenCalled();
        expect(model.store.destroy).toHaveBeenCalled();
    });
});
