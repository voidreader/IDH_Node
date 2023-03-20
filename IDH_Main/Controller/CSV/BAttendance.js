/**
 * 출석 체크 보상
 */

var csvData = [];

module.exports.data = csvData;
module.exports.Load = function (fs) {

    //!< 동기 사용.
    var data = fs.readFileSync(process.cwd() + '/Resources/CSV/BACheckReward.txt', 'utf8');
    if (data != null) {
        var row = data.split('\r\n');
        var col;

        var temp;
        //!< Row Parse.
        for (var idx = 0; idx < row.length; idx++) {
            //!< Column Parse.
            col = row[idx].split(',');
            if(col[3] > -1){
                temp = {
                    id: Number(col[0]),                 // BACheckID
                    day: Number(col[1]),                // 지급 일자
                    reward_id: Number(col[2]),          // 보상 구분 ID
                    reward_item_id: col[3],             // 보상 아이템 ID
                    reward_item_value: Number(col[4]),  // 보상 아이템 수량
                    reward_mail_string: col[5]          // 보상 메일 상세 내용
                };
                
                csvData.push(temp);
            }
        }
    }
}

module.exports.GetData = function (type, reward_id) {
    for (var i = 0; i < csvData.length; i++)
        if (csvData[i].id == type && csvData[i].reward_id == reward_id)
            return csvData[i];
    return null;
}

module.exports.GetDataListByType = function (id) {
    let list = [];
    for (var i = 0; i < csvData.length; i++)
        if (csvData[i].id == id)
            list.push(csvData[i]);

    return list;
}