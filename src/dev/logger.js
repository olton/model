export default class Logger {
    static DEBUG_LEVELS = {
        NONE: 0,
        ERROR: 1,
        WARN: 2,
        INFO: 3,
        DEBUG: 4,
        TRACE: 5
    };

    static DEBUG_LEVEL = Logger.DEBUG_LEVELS.NONE;

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

        switch(level) {
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

    // Методы для удобства
    static error(message, data) {
        Logger.log(Logger.DEBUG_LEVELS.ERROR, message, data);
    }

    static warn(message, data) {
        Logger.log(Logger.DEBUG_LEVELS.WARN, message, data);
    }

    static info(message, data) {
        Logger.log(Logger.DEBUG_LEVELS.INFO, message, data);
    }

    static debug(message, data) {
        Logger.log(Logger.DEBUG_LEVELS.DEBUG, message, data);
    }

    static trace(message, data) {
        Logger.log(Logger.DEBUG_LEVELS.TRACE, message, data);
    }
}