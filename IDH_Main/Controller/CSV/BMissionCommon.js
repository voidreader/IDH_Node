/**
 * 미션 Common
 * /Project/Document/Table/Common/IDH_Common_180501.xlsm BMissionCommon Tab 참고
 */

var csvData = [];

module.exports.data = csvData;
module.exports.Load = function (fs) {

    //!< 동기 사용.
    var data = fs.readFileSync(process.cwd() + '/Resources/CSV/BMissionCommon.txt', 'utf8');
    if (data != null) {
        var row = data.split('\r\n');
        var col;
        var temp;

        //!< Row Parse.
        for (var i = 0; i < row.length; i++) {
            //!< Column Parse.
            col = row[i].split(',');
            temp = {
                reward_limit: Number(col[0]),
                tutorial_limit: Number(col[1]),
                reset_time: Number(col[2]),
                weekly_reset_day: Number(col[3]),
                last_story_achieve_index: Number(col[4]),
                last_quest_index: Number(col[5]),
                last_quest_accum_index: Number(col[6])
            };
            csvData.push(temp);
        }
    }
}

module.exports.GetData = function (key) {
    return csvData[0][key];
}
