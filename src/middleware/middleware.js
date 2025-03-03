/**
 * Manages sequential execution of middleware functions in a chain.
 * Supports:
 * - Async/await middleware functions
 * - Context modification through middleware chain
 * - Sequential processing with next() mechanism
 * - Error validation for middleware registration
 *
 * @class
 * @property {Function[]} middlewares - Array of registered middleware functions
 */
class MiddlewareManager {

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
        if (typeof middleware !== 'function') {
            console.error('MIDDLEWARE should be a function!');
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
}

export default MiddlewareManager;