import Model from "../src/index.js";
Model.info()
const app = new Model({
    counter: 10,
    status() {
        return this.counter === 0 ? "Zero" : this.counter > 0 ? "Positive" : "Negative";
    },
    items: ["Item 1", "Item 2", "Item 3"],
    user: {
        name: "John Doe",
        address: {
            city: "New York",
            country: "USA"
        },
        age: 30,
        items: ["Item 1", "Item 2", "Item 3"],
    },
    fullAddress(){
        return `${this.user.address.city}, ${this.user.address.country}`;
    },
    data: {
        name: "John Doe",
        age: 20,
        address: "New York, USA"
    },
    path_to_image: "https://picsum.photos/id/1/200/300",
    is_disabled: true,
})

app.init("#root")

globalThis.updateCounter = (operator) => {
    operator === "-" ? app.data.counter-- : app.data.counter++
}

globalThis.addItem = () => {
    // app.data.items.push(`Item ${app.data.items.length + 1}`)
    app.store.applyArrayMethod('items', 'push', `Item ${app.data.items.length + 1}`);
    // app.store.applyArrayChanges('items', items => items.push(`Item ${app.data.items.length + 1}`));
}

app.initDevTools({
    enabled: true,
    timeTravel: true,
    maxSnapshots: 50
});

