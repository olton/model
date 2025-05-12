import { describe, it, expect, waitFor } from '@olton/latte'
import ReactiveStore from '../src/reactive/reactive-store.js';
import EventEmitter from '../src/event-emitter/event-emitter.js';

describe('ReactiveStore', () => {
    it('should create a new instance with default options', () => {
        const model = { options: { debug: false } };
        const store = new ReactiveStore({}, model);
        
        expect(store).toBeDefined();
        expect(store instanceof EventEmitter).toBe(true);
        expect(store.state).toBeDefined();
        expect(store.watchers).toBeDefined();
        expect(store.previousState).toBeDefined();
        expect(store.middleware).toBeDefined();
    });

    it('should create a reactive proxy for an object', () => {
        const model = { options: { debug: false } };
        const store = new ReactiveStore({}, model);
        const obj = { name: 'John', age: 30 };
        
        const proxy = store.createReactiveProxy(obj);
        
        expect(proxy.name).toBe('John');
        expect(proxy.age).toBe(30);
    });

    it('should create a reactive proxy for an array', () => {
        const model = { options: { debug: false } };
        const store = new ReactiveStore({}, model);
        const arr = [1, 2, 3];
        
        const proxy = store.createArrayProxy(arr, 'numbers');
        
        expect(proxy.length).toBe(3);
        expect(proxy[0]).toBe(1);
        expect(proxy[1]).toBe(2);
        expect(proxy[2]).toBe(3);
    });

    it('should detect changes in the state', async () => {
        const model = { options: { debug: false } };
        const store = new ReactiveStore({ count: 0 }, model);
        let result = false;
        
        store.on('change', (data) => {
            result = true
        });
        
        store.state.count = 1;
        
        await waitFor(100)

        expect(result).toBeTrue();
        expect(store.state.count).toBe(1);
    });

    it('should add and use validators', () => {
        const model = { options: { debug: false } };
        const store = new ReactiveStore({ age: 25 }, model);
        
        // Initialize validators if not already initialized
        if (!store.validators) {
            store.validators = new Map();
        }
        
        const validator = (value) => value >= 18;
        store.addValidator('age', validator);
        
        expect(store.validators.has('age')).toBe(true);
        expect(store.validators.get('age')).toBe(validator);
    });

    it('should add and use formatters', () => {
        const model = { options: { debug: false } };
        const store = new ReactiveStore({ price: 10 }, model);
        
        // Initialize formatters if not already initialized
        if (!store.formatters) {
            store.formatters = new Map();
        }
        
        const formatter = (value) => `$${value}`;
        store.addFormatter('price', formatter);
        
        expect(store.formatters.has('price')).toBe(true);
        expect(store.formatters.get('price')).toBe(formatter);
    });

    it('should watch a path for changes', async () => {
        const model = { options: { debug: false } };
        const store = new ReactiveStore({ count: 0 }, model);
        let result = false;
        
        store.watch('count', (newValue, oldValue) => {
            result = true;
        });
        
        store.state.count = 1;

        await waitFor(100)

        expect(result).toBeTrue();
    });

    it('should batch updates', async () => {
        const model = { options: { debug: false } };
        const store = new ReactiveStore({ count: 0, total: 0 }, model);
        
        let changeCount = 0;
        store.on('change', () => {
            changeCount++;
        });
        
        let result = false;
        
        store.on('batchComplete', () => {
            result = true;
            // This should be called once after all changes in the batch
        });
        
        store.batch(() => {
            store.state.count = 1;
            store.state.total = 100;
        });

        await waitFor(100)
        // We should have 2 change events (one for each property)
        expect(result).toBeTrue();
        expect(store.state.count).toBe(1);
        expect(store.state.total).toBe(100);
        expect(changeCount).toBe(2);
    });

    it('should detect array changes', () => {
        const model = { options: { debug: false } };
        const store = new ReactiveStore({}, model);
        
        const oldArray = [1, 2, 3];
        const newArray = [1, 3, 4];
        
        const changes = store.detectArrayChanges(newArray, oldArray);

        expect(changes.added[0]).toBeObject({index: 2, item: 4});
        expect(changes.removed[0]).toBeObject({index: 1, item: 2});
    });

    it('should validate paths', () => {
        const model = { options: { debug: false } };
        const store = new ReactiveStore({ user: { name: 'John' } }, model);
        
        expect(store.isValidPath('user.name')).toBe(true);
        expect(store.isValidPath('user.age')).toBe(false);
    });

    it('should destroy the store', () => {
        const model = { options: { debug: false } };
        const store = new ReactiveStore({}, model);
        
        // We can't easily test the internal cleanup, but we can at least
        // verify that the method exists and doesn't throw an error
        expect(() => store.destroy()).not.toThrow();
    });
});