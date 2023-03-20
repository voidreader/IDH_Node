const moment = require("moment");

module.exports.debug = (msg) => {
    console.log(moment().format("HH:mm:ss") + " - DEBUG : " + msg);
}

module.exports.info = (msg) => {
    console.log(moment().format("HH:mm:ss") + " - INFO : " + msg);
}

module.exports.error = (msg) => {
    console.log(moment().format("HH:mm:ss") + " - ERROR : " + msg);
}
