/**
 * 마이룸 Common
 * /Project/Document/Table/Common/IDH_Common_180501.xlsm BMyRoomCommon Tab 참고
 */

var csvData = [];

module.exports.data = csvData;
module.exports.Load = function (fs) {

    //!< 동기 사용.
    var data = fs.readFileSync(process.cwd() + '/Resources/CSV/BMyRoomCommon.txt', 'utf8');
    if (data != null) {
        var row = data.split('\r\n');
        var col;

        var temp;

        //!< Row Parse.
        for (var i = 0; i < row.length; i++) {
            //!< Column Parse.
            col = row[i].split(',');
            temp = {
                convert_act: Number(col[0]),
                floor_horizontal: Number(col[1]),
                floor_vertical: Number(col[2]),
                cleanup_consume_act: Number(col[3]),
                check_stain: Number(col[4]),
                stain_probability: Number(col[5]),
                stain_consume_satisfaction: Number(col[6]),
                cleanup_time_item_id0: Number(col[7]),
                cleanup_time_item_id1: Number(col[8]),
                cleanup_time_item_id2: Number(col[9]),
                cleanup_time_item_id3: Number(col[10]),
                cleanup_time_item_id4: Number(col[11]),
                cleanup_time_item_id5: Number(col[12]),
                cleanup_time_item_id6: Number(col[13]),
                character_limit: Number(col[14]),
                item_limit: Number(col[15])
            };
            csvData.push(temp);
        }
    }
}

module.exports.GetData = function (key) {
    return csvData[0][key];
}
