/**
 * 달성도 보상
 */

var csvData = [];

module.exports.data = csvData;
module.exports.Load = function (fs) {

    //!< 동기 사용.
    var data = fs.readFileSync(process.cwd() + '/Resources/CSV/BAccumReward.txt', 'utf8');
    if (data != null) {
        var row = data.split('\r\n');
        var col;

        var temp;
        //!< Row Parse.
        for (var idx = 0; idx < row.length; idx++) {
            //!< Column Parse.
            col = row[idx].split(',');
            temp = {
                uid: Number(col[0]),            // UniqueID
                type: Number(col[1]),           // 0: 일일, 1: 주간, 2: 업적, 3: 퀘스트
                level: Number(col[2]),          // 달성도 레벨
                value: Number(col[3]),          // 달성도 갯수
                reward: Number(col[4]),         // 보상 아이템 ID
                reward_value: Number(col[5])    // 보상 아이템 수량
            };
            csvData.push(temp);
        }
    }
}

module.exports.GetData = function (uid) {
    for (var i = 0; i < csvData.length; i++)
        if (csvData[i].uid == uid)
            return csvData[i];
    return null;
}

module.exports.GetDataByType = function (type) {
    var list = [];
    for (var i = 0; i < csvData.length; i++)
        if (csvData[i].type == type)
            list.push(csvData[i]);
    return list;
}