import Model from "../src/index.js";
// Model.DEBUG = true;
Model.info()
const app = new Model({
    counter: 0,
    status: function () {
        return this.counter === 0 ? "Zero" : this.counter > 0 ? "Positive" : "Negative";
    },
    items: ["Item 1", "Item 2", "Item 3"],
    user: {
        name: "John Doe",
        age: 30,
        items: ["Item 1", "Item 2", "Item 3"],
    }
})

app.init("#root")

globalThis.updateCounter = (operator) => {
    operator === "-" ? app.data.counter-- : app.data.counter++
}

globalThis.addItem = () => {
    app.data.items.push(`Item ${app.data.items.length + 1}`)
}

app.initDevTools({
    enabled: true,
    timeTravel: true,
    maxSnapshots: 50
});

