import Model from "../src/index.js";
// Model.DEBUG = true;
Model.info()
const app = new Model({
    counter: 0,
    status: function () {
        return this.counter === 0 ? "Zero" : this.counter > 0 ? "Positive" : "Negative";
    },
})

app.init("#root")

globalThis.updateCounter = (operator) => {
    operator === "-" ? app.data.counter-- : app.data.counter++
}

app.initDevTools({
    enabled: true,
    timeTravel: true,
    maxSnapshots: 50
});

