/**
 * 행동력 Common
 * /Project/Document/Table/Common/IDH_Common_180501.xlsm BStaminaCommon Tab 참고
 */

var csvData = [];

module.exports.data = csvData;
module.exports.Load = function (fs) {

    //!< 동기 사용.
    var data = fs.readFileSync(process.cwd() + '/Resources/CSV/BStaminaCommon.txt', 'utf8');
    if (data != null) {
        var row = data.split('\r\n');
        var col;

        var temp;

        //!< Row Parse.
        for (var i = 0; i < row.length; i++) {
            //!< Column Parse.
            col = row[i].split(',');
            temp = {
                acting_limit: Number(col[0]),
                default_acting: Number(col[1]),
                acting_level_up: Number(col[2]),
                acting_add_time: Number(col[3]),
                level_up_reward_limit: Number(col[4])
            };
            csvData.push(temp);
        }
    }
}

module.exports.GetData = function (key) {
    return csvData[0][key];
}
