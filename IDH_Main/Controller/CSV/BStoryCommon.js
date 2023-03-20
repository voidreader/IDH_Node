/**
 * 스토리 Common
 * /Project/Document/Table/Common/IDH_Common_180501.xlsm BStoryCommon Tab 참고
 */

var csvData = [];

module.exports.data = csvData;
module.exports.Load = function (fs) {

    //!< 동기 사용.
    var data = fs.readFileSync(process.cwd() + '/Resources/CSV/BStoryCommon.txt', 'utf8');
    if (data != null) {
        var row = data.split('\r\n');
        var col;

        var temp;

        //!< Row Parse.
        for (var i = 0; i < row.length; i++) {
            //!< Column Parse.
            col = row[i].split(',');
            temp = {
                chapter_reward_condition1: Number(col[0]),
                chapter_reward_condition2: Number(col[1]),
                chapter_reward_condition3: Number(col[2]),
                max_chapter: Number(col[3]),
                check_last_nomal_story: Number(col[4]),
                check_last_hard_story: Number(col[5]),
                check_last_very_hard_story: Number(col[6])
            };
            csvData.push(temp);
        }
    }
}

module.exports.GetData = function (key) {
    return csvData[0][key];
}
