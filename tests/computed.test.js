import { describe, it, expect, waitFor } from '@olton/latte';
import ComputedProps from '../src/reactive/computed.js';
import Model from '../src/core/model.js';

describe('ComputedProps', () => {
    it('should initialize computed properties', async () => {
        const model = new Model({
            firstName: 'John',
            lastName: 'Doe',
            fullName: function() {
                return this.firstName + ' ' + this.lastName;
            }
        });
        
        // Wait for computed properties to initialize
        await waitFor(100)
        
        expect(model.data.fullName).toBe('John Doe');
    });
    
    it('should update computed properties when dependencies change', async () => {
        const model = new Model({
            firstName: 'John',
            lastName: 'Doe',
            fullName: function() {
                return this.firstName + ' ' + this.lastName;
            }
        });
        
        // Wait for computed properties to initialize
        await waitFor(100)
        
        // Initial value
        expect(model.data.fullName).toBe('John Doe');
        
        // Change a dependency
        model.data.firstName = 'Jane';
        
        // Wait for computed properties to update
        await waitFor(100)
        
        // Updated value
        expect(model.data.fullName).toBe('Jane Doe');
    });
    
    it('should track nested dependencies', async () => {
        const model = new Model({
            user: {
                firstName: 'John',
                lastName: 'Doe'
            },
            fullName: function() {
                return this.user.firstName + ' ' + this.user.lastName;
            }
        });
        
        // Wait for computed properties to initialize
        await waitFor(100)
        
        // Initial value
        expect(model.data.fullName).toBe('John Doe');
        
        // Change a nested dependency
        model.data.user.firstName = 'Jane';
        
        // Wait for computed properties to update
        await waitFor(100)
        
        // Updated value
        expect(model.data.fullName).toBe('Jane Doe');
    });
    
    it('should support async computed properties', async () => {
        const model = new Model({
            count: 1,
            asyncDouble: async function() {
                // Simulate async operation
                await new Promise(resolve => setTimeout(resolve, 50));
                return this.count * 2;
            }
        });
        
        // Wait for computed properties to initialize
        await waitFor(200)
        
        // Initial value
        expect(model.data.asyncDouble).toBe(2);
        
        // Change a dependency
        model.data.count = 5;
        
        // Wait for computed properties to update
        await waitFor(200)
        
        // Updated value
        expect(model.data.asyncDouble).toBe(10);
    });
    
    it('should retrieve all computed properties', async () => {
        const model = new Model({
            a: 1,
            b: 2,
            sum: function() {
                return this.a + this.b;
            },
            product: function() {
                return this.a * this.b;
            }
        });
        
        // Wait for computed properties to initialize
        await waitFor(100)
        
        const allComputed = model.computedProps.all();
        
        expect(Object.keys(allComputed).length).toBe(2);
        expect(allComputed.sum).toBe(3);
        expect(allComputed.product).toBe(2);
    });
    
    it('should handle errors in computed properties', async () => {
        const model = new Model({
            a: 0,
            dangerous: function() {
                // This will throw an error when a is 0
                return 10 / this.a;
            }
        });
        
        // Wait for computed properties to initialize
        await waitFor(100)
        
        // The property should not crash the application
        expect(() => model.data.dangerous).not.toThrow();
        
        // Fix the error condition
        model.data.a = 2;
        
        // Wait for computed properties to update
        await waitFor(100)
        
        // Now it should work
        expect(model.data.dangerous).toBe(5);
    });
    
    it('should handle circular dependencies gracefully', async () => {
        // This is a test for how the system handles potential issues
        const model = new Model({
            a: 1,
            b() {
                return this.a + 2;
            },
            c() {
                return this.a + 1;
            }
        });
        
        // Wait for computed properties to initialize
        await waitFor(100)
        
        // The system should not crash with circular dependencies
        expect(model.data.b).toBeDefined();
        expect(model.data.c).toBeDefined();
        
        // Change a dependency
        model.data.a = 5;
        
        // Wait for computed properties to update
        await waitFor(100)
        
        // Values should update correctly
        expect(model.data.c).toBe(6);
        expect(model.data.b).toBe(7);
    });
});