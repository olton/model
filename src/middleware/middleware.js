class MiddlewareManager {
    constructor() {
        this.middlewares = [];
    }

    use(middleware) {
        if (typeof middleware !== 'function') {
            throw new Error('MIDDLEWARE should be a function!');
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
}

export default MiddlewareManager;