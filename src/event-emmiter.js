class EventEmitter {
    constructor() {
        this.events = new Map();
    }

    on(eventName, callback) {
        if (!this.events.has(eventName)) {
            this.events.set(eventName, new Set());
        }
        this.events.get(eventName).add(callback);

        // Повертаємо функцію для відписки
        return () => this.off(eventName, callback);
    }

    off(eventName, callback) {
        if (this.events.has(eventName)) {
            this.events.get(eventName).delete(callback);
        }
    }

    emit(eventName, data) {
        if (this.events.has(eventName)) {
            this.events.get(eventName).forEach(callback => {
                try {
                    callback(data);
                } catch (e) {
                    console.error(`Error when performing an event handler ${eventName}:`, e);
                }
            });
        }
    }
}

export default EventEmitter;