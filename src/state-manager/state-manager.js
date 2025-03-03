export default class StateManager {
    constructor(store, options = {}) {
        this.store = store;
        this.options = Object.assign({id: "model"}, options);
    }

    static isStorageAvailable() {
        try {
            const test = '__test__';
            localStorage.setItem(test, test);
            localStorage.removeItem(test);
            return true;
        } catch (e) {
            return false;
        }
    }

    save(){
        if (!StateManager.isStorageAvailable()) {
            console.warn('localStorage is not available');
            return null;
        }

        const dataToSave = JSON.parse(JSON.stringify(this.store.getState()));
        
        const state = {
            data: dataToSave,
            timestamp: Date.now()
        };

        try {
            localStorage.setItem(this.options.id, JSON.stringify(state));
            return state;
        } catch (error) {
            console.error('Error saving state:', error);
            return null;
        }
    }
    
    load(){
        if (!StateManager.isStorageAvailable()) {
            console.warn('localStorage is not available');
            return null;
        }
        
        const savedState = localStorage.getItem(this.options.id);
        
        if (savedState) {
            const parsed = JSON.parse(savedState);
            Object.assign(this.store.state, parsed.data);
            return parsed.data;
        }
    }
    
    snapshot(){}


    // Допоміжний метод перевірки доступності localStorage

    // Збереження стану
    // saveState() {
    //     if (!Model.isStorageAvailable()) {
    //         console.warn('localStorage is not available');
    //         this.emit('saveStateError', { error: new Error('localStorage is not available') });
    //         return null;
    //     }
    //
    //     const dataToSave = JSON.parse(JSON.stringify(this.store.getState()));
    //    
    //     const state = {
    //         data: dataToSave,
    //         computed: Object.fromEntries(
    //             Object.entries(this.computed)
    //                 .map(([key, comp]) => [key, comp.value])
    //         ),
    //         timestamp: Date.now()
    //     };
    //
    //     try {
    //         localStorage.setItem(this.options.id, JSON.stringify(state));
    //         this.emit('saveState', state);
    //         Logger.debug('State saved:', state);
    //         return state;
    //     } catch (error) {
    //         Logger.error('Error saving state:', error);
    //         this.emit('saveStateError', { error, state });
    //         return null;
    //     }
    // }

    // Відновлення стану
    // loadState() {
    //     if (!Model.isStorageAvailable()) {
    //         console.warn('localStorage is not available');
    //         return null;
    //     }
    //    
    //     const savedState = localStorage.getItem(this.options.id);
    //    
    //     if (savedState) {
    //         const parsed = JSON.parse(savedState);
    //         // Оновлюємо основні дані
    //         Object.assign(this.data, parsed.data);
    //        
    //         // Перераховуємо всі обчислювані властивості
    //         if (parsed.computed) {
    //             for (const key of Object.keys(this.computed)) {
    //                 // Викликаємо getter для перерахунку значення
    //                 this.computed[key].value = this.computed[key].getter.call(this.data);
    //             }
    //         }
    //         // Викликаємо подію про завантаження стану
    //         this.emit('loadState', {
    //             data: parsed.data,
    //             computed: this.getComputedValues()
    //         });
    //     }
    // }

    // loadStateFromSnapshot(snapshot) {
    //     if (!snapshot) {
    //         Logger.error('Snapshot is undefined or null');
    //         return;
    //     }
    //
    //     try {
    //         const computed = {}
    //        
    //         for (const key in snapshot) {
    //             if (typeof snapshot[key] === 'function') {
    //                 computed[key] = {
    //                     getter: snapshot[key],
    //                     value: null,
    //                     dependencies: [] // Будет заполнено при первом вызове
    //                 };
    //             } else {
    //                 this.data[key] = snapshot[key];
    //             }
    //         }
    //
    //         // Запускаємо подію про оновлення стану
    //         this.emit('restoreState', {
    //             timestamp: Date.now(),
    //             snapshot
    //         });
    //
    //         return true;
    //     } catch (error) {
    //         Logger.error('Error loading state from snapshot:', error);
    //
    //         // Запускаємо подію про помилку
    //         this.emit('restoreStateError', {
    //             error,
    //             snapshot
    //         });
    //
    //         return false;
    //     }
    // }

    // Автоматичне збереження в localStorage
    // enableAutoSave(interval = 5000) {
    //     this.autoSaveInterval = setInterval(() => {
    //         this.saveState()
    //     }, interval);
    // }

    // Вимкнення автоматичного збереження
    // disableAutoSave() {
    //     clearInterval(this.autoSaveInterval);
    // }
}