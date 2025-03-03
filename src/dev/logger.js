/**
 * A utility class for managing logging with various debug levels.
 * Provides methods for logging messages and data with custom styles
 * based on the specified debug level.
 */
export default class Logger {

    /**
     * Enumeration of available debug levels from lowest (NONE) to highest (TRACE).
     * Used to control the verbosity of logging output.
     */
    static DEBUG_LEVELS = {
        NONE: 0,
        ERROR: 1,
        WARN: 2,
        INFO: 3,
        DEBUG: 4,
        TRACE: 5
    };

    /**
     * The current debug level for the Logger class. Determines the types of logs
     * that will be displayed. To adjust the logging behavior, set this property
     * to one of the predefined levels in `Logger.DEBUG_LEVELS`.
     *
     * @type {number}
     * @default Logger.DEBUG_LEVELS.NONE
     */
    static DEBUG_LEVEL = Logger.DEBUG_LEVELS.NONE;

    /**
     * Core logging method that handles message formatting and output.
     * @param {number} level - Debug level from Logger.DEBUG_LEVELS
     * @param {string} message - Message to log
     * @param {any} [data] - Optional data to display
     * @private
     */
    static log(level, message, data) {
        if (level > Logger.DEBUG_LEVEL) return;

        const styles = {
            error: 'color: #ff5555; font-weight: bold',
            warn: 'color: #ffaa00; font-weight: bold',
            info: 'color: #0080fe; font-weight: bold',
            debug: 'color: #00aa00; font-weight: bold',
            trace: 'color: #888888',
            data: 'color: #555; font-style: italic'
        };

        let styleType;
        let method;

        switch (level) {
            case Logger.DEBUG_LEVELS.ERROR:
                styleType = 'error';
                method = console.error;
                break;
            case Logger.DEBUG_LEVELS.WARN:
                styleType = 'warn';
                method = console.warn;
                break;
            case Logger.DEBUG_LEVELS.INFO:
                styleType = 'info';
                method = console.info;
                break;
            case Logger.DEBUG_LEVELS.DEBUG:
                styleType = 'debug';
                method = console.debug;
                break;
            case Logger.DEBUG_LEVELS.TRACE:
                styleType = 'trace';
                method = console.log;
                break;
            default:
                return;
        }

        console.group(`%c Model: ${message}`, styles[styleType]);

        if (data !== undefined) {
            console.log('%c Data:', styles.data, data);
        }

        console.groupEnd();
    }

    /**
     * Logs an error message with an optional data object.
     * This method uses the `Logger.DEBUG_LEVELS.ERROR` level.
     *
     * @param {string} message - The error message to log.
     * @param {any} [data] - Additional data to log alongside the message.
     */
    static error(message, data) {
        Logger.log(Logger.DEBUG_LEVELS.ERROR, message, data);
    }

    /**
     * Logs a warning message with an optional data object.
     * This method uses the `Logger.DEBUG_LEVELS.WARN` level.
     *
     * @param {string} message - The warning message to log.
     * @param {any} [data] - Additional data to log alongside the message.
     */
    static warn(message, data) {
        Logger.log(Logger.DEBUG_LEVELS.WARN, message, data);
    }

    /**
     * Logs an informational message with an optional data object.
     * This method uses the `Logger.DEBUG_LEVELS.INFO` level.
     *
     * @param {string} message - The informational message to log.
     * @param {any} [data] - Additional data to log alongside the message.
     */
    static info(message, data) {
        Logger.log(Logger.DEBUG_LEVELS.INFO, message, data);
    }

    /**
     * Logs a debug message with an optional data object.
     * This method uses the `Logger.DEBUG_LEVELS.DEBUG` level.
     *
     * @param {string} message - The debug message to log.
     * @param {any} [data] - Additional data to log alongside the message.
     */
    static debug(message, data) {
        Logger.log(Logger.DEBUG_LEVELS.DEBUG, message, data);
    }

    /**
     * Logs a trace message with an optional data object.
     * This method uses the `Logger.DEBUG_LEVELS.TRACE` level.
     *
     * @param {string} message - The trace message to log.
     * @param {any} [data] - Additional data to log alongside the message.
     */
    static trace(message, data) {
        Logger.log(Logger.DEBUG_LEVELS.TRACE, message, data);
    }
}