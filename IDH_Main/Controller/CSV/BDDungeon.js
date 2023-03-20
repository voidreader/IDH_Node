/**
 * 요일 던전
 */

var csvData = [];

module.exports.data = csvData;
module.exports.Load = function (fs) {

    //!< 동기 사용.
    var data = fs.readFileSync(process.cwd() + '/Resources/CSV/BDDungeon.txt', 'utf8');
    if (data != null) {
        var row = data.split('\r\n');
        var col;

        var temp;
        //!< Row Parse.
        for (var idx = 0; idx < row.length; idx++) {
            //!< Column Parse.
            col = row[idx].split(',');
            temp = {
                id: Number(col[0]),                 // ID
                playable_day1: Number(col[1]),      // 활성화 요일
                playable_day2: Number(col[2]),
                playable_day3: Number(col[3]),
                difficulty: Number(col[4]),         // 난이도
                stage_id: Number(col[5]),           // 스테이지 ID
                stage_name: col[6],                 // 스테이지 이름
                power_recommand: Number(col[7]),    // 필요 전투력
                gold_min: Number(col[8]),           // 골드 보상 mix
                gold_max: Number(col[9]),           // 골드 보상 max
                add_exp: Number(col[10]),           // 획득 경험치
                reward: Number(col[11])             // 보상 ID - BDDReward ID 값
            };
            csvData.push(temp);
        }
    }
}

module.exports.GetData = function (id) {
    for (var i = 0; i < csvData.length; i++)
        if (csvData[i].id == id)
            return csvData[i];
    return null;
}