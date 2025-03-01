import Model from "./model.js";

const version = "___VERSION___";
const build_time = "___BUILD_TIME___";

Model.info = () => {
    console.info(`%c Dom %c v${version} %c ${build_time} `, "color: white; font-weight: bold; background: #0080fe", "color: white; background: darkgreen", "color: white; background: #0080fe;")
}

export default Model;