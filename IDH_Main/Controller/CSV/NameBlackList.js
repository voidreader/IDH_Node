var csvData = [];

module.exports.data = csvData;
module.exports.Load = function (fs) {
    //!< 동기 사용.
    var data = fs.readFileSync(process.cwd() + '/Resources/CSV/NameBlackList.txt', 'utf8');
    if (data != null) {
        csvData = data.split('\r\n');
    }
}
module.exports.IsFilter = (name, callback) => {
    selectDB.query("SELECT * FROM CONFIG WHERE TYPE = 0", (error, result) => {
        if (error) {
            PrintError(error);
            callback(error, true);
        } else {
            let blackList = result[0].FILTER.split(",");
            let flag = false;
            for (var idx = 0; idx < blackList.length; idx++) {
                if (name.match(RegExp(blackList[idx], "i"))) {
                    //!< 일치 or 포함하는 단어가 있음.
                    flag = true;
                }
            }
            callback(null, flag);
        }
    });
}