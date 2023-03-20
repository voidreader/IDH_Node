/**
 * PVP 등급 정보 및 보상
 */

var csvData = [];

module.exports.data = csvData;
module.exports.Load = function (fs) {

    //!< 동기 사용.
    var data = fs.readFileSync(process.cwd() + '/Resources/CSV/BRateReward.txt', 'utf8');
    if (data != null) {
        var row = data.split('\r\n');
        var col;

        var temp;
        //!< Row Parse.
        for (var idx = 0; idx < row.length; idx++) {
            //!< Column Parse.
            col = row[idx].split(',');
            temp = {
                id: Number(col[0]),             // UniqueID
                rateName: col[1],               // 등급명
                reward_gold: Number(col[2]),    // 골드 보상 수량
                reward_cash: Number(col[3])     // 펄 보상 수량
            };
            csvData.push(temp);
        }
    }
}

exports.GetData = function (id) {
    for (var i = 0; i < csvData.length; i++)
        if (csvData[i].id == id)
            return csvData[i];
    return null;
}

exports.GetNextID = function (id) {
    var nextID = 0;
    for (var i = 0; i < csvData.length; i++)
        if (csvData[i].id == id)
            nextID = csvData[i + 1].id;
    return nextID;
}

