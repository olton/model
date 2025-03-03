/**
 * Implementation of the Observer pattern via EventEmitter.
 * Provides event handling functionality with:
 * - Event subscription with automatic cleanup
 * - Event unsubscription
 * - Event emission with error handling
 * - Support for multiple listeners per event
 *
 * @class
 * @property {Map<string, Set<Function>>} events - Stores event listeners
 */
class EventEmitter {

    /**
     * Initializes a new EventEmitter instance.
     * Creates an empty Map where:
     * - Keys are event names (strings)
     * - Values are Sets of callback functions
     */
    constructor() {
        this.events = new Map();
    }

    /**
     * Registers a new event listener for the specified event.
     * - Creates new Set for event if it doesn't exist
     * - Adds callback to the Set of listeners
     * - Returns unsubscribe function for cleanup
     *
     * @param {string} eventName - Event identifier
     * @param {Function} callback - Event handler function
     * @returns {Function} Unsubscribe function
     */
    on(eventName, callback) {
        if (!this.events.has(eventName)) {
            this.events.set(eventName, new Set());
        }
        this.events.get(eventName).add(callback);

        return () => this.off(eventName, callback);
    }

    /**
     * Removes a specific event listener.
     * - Safely handles non-existent events
     * - Removes only the specified callback
     * - Keeps other listeners for the same event intact
     *
     * @param {string} eventName - Event to unsubscribe from
     * @param {Function} callback - Listener to remove
     */
    off(eventName, callback) {
        if (this.events.has(eventName)) {
            this.events.get(eventName).delete(callback);
        }
    }

    /**
     * Triggers all listeners for the specified event.
     * - Safely handles non-existent events
     * - Executes each listener in try-catch block
     * - Continues execution even if one listener fails
     * - Logs errors without breaking execution
     *
     * @param {string} eventName - Event to trigger
     * @param {*} [data] - Optional data for listeners
     */
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