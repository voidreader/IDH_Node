/**
 * 퀘스트
 */

var csvData = [];

module.exports.data = csvData;
module.exports.Load = function (fs) {

    //!< 동기 사용.
    var data = fs.readFileSync(process.cwd() + '/Resources/CSV/BQuest.txt', 'utf8');
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
                id: Number(col[1]),             // 퀘스트 ID
                type: Number(col[2]),           // 0: 스테이지 업적, 1: 업적 획득 후 수집, 2: 계정 생성 이후 수집
                value1: Number(col[3]),         // 조건 1
                value2: Number(col[4]),         // 조건 2
                reward: Number(col[5]),         // 보상 아이템 ID
                reward_value: Number(col[6])    // 보상 아이템 수량
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