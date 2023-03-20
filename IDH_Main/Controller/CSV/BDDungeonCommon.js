/**
 * 요일던전 Common
 * /Project/Document/Table/Common/IDH_Common_180501.xlsm BDDungeonCommon Tab 참고
 */

var csvData = [];

module.exports.data = csvData;
module.exports.Load = function (fs) {

    //!< 동기 사용.
    var data = fs.readFileSync(process.cwd() + '/Resources/CSV/BDDungeonCommon.txt', 'utf8');
    if (data != null) {
        var row = data.split('\r\n');
        var col;

        var temp;

        //!< Row Parse.
        for (var i = 0; i < row.length; i++) {
            //!< Column Parse.
            col = row[i].split(',');
            temp = {
                default_dungeon: Number(col[0]),
                dungeon_add_count: Number(col[1]),
                dungeon_default_price: Number(col[2]),
                dungeon_add_price: Number(col[3]),
                dungeon_reset_time: Number(col[4])
            };
            csvData.push(temp);
        }
    }
}

module.exports.GetData = function (key) {
    return csvData[0][key];
}
