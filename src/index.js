import Model from "./core/model.js";
import ModelPlugin from "./plugin/index.js";

const version = "__VERSION__";
const build_time = "__BUILD_TIME__";

Model.info = () => {
    console.info(`%c Model %c v${version} %c ${build_time} `, "color: white; font-weight: bold; background: #0080fe", "color: white; background: darkgreen", "color: white; background: #0080fe;")
}

export default Model;
export { ModelPlugin };