/**
 * 파밍 Common
 */

var csvData = [];

module.exports.data = csvData;
module.exports.Load = function (fs) {

    //!< 동기 사용.
    var data = fs.readFileSync(process.cwd() + '/Resources/CSV/BFarmingCommon.txt', 'utf8');
    if (data != null) {
        var row = data.split('\r\n');
        var col;

        var temp;

        //!< Row Parse.
        for (var i = 0; i < row.length; i++) {
            //!< Column Parse.
            col = row[i].split(',');
            temp = {
                farming_max_count: Number(col[0])   // 최대로 파밍 보낼 수 있는 팀
            };
            csvData.push(temp);
        }
    }
}

module.exports.GetData = function (key) {
    return csvData[0][key];
}
