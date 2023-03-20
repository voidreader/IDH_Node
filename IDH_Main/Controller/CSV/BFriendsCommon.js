/**
 * 친구 Common
 * /Project/Document/Table/Common/IDH_Common_180501.xlsm BFriendsCommon Tab 참고
 */

var csvData = [];

module.exports.data = csvData;
module.exports.Load = function (fs) {

    //!< 동기 사용.
    var data = fs.readFileSync(process.cwd() + '/Resources/CSV/BFriendsCommon.txt', 'utf8');
    if (data != null) {
        var row = data.split('\r\n');
        var col;

        var temp;

        //!< Row Parse.
        for (var i = 0; i < row.length; i++) {
            //!< Column Parse.
            col = row[i].split(',');
            temp = {
                default_friends_count: Number(col[0]),
                add_count: Number(col[1]),
                max_friends_count: Number(col[2]),
                max_delete_count: Number(col[3]),
                request_waiting_days: Number(col[4]),
                display_recommand_count: Number(col[5]),
                search_coefficient_min: Number(col[6]),
                search_coefficient_max: Number(col[7]),
                mission_display_friends_count: Number(col[8]),
                mission_display_recommand_friends_count: Number(col[9]),
                striker_reuse_time: Number(col[10]),
                friendShipPoint_reuse_time: Number(col[11])
            };
            csvData.push(temp);
        }
    }
}

module.exports.GetData = function (key) {
    return csvData[0][key];
}
