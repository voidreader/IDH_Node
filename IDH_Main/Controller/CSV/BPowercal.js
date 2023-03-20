/**
 * 전투력 계산 시 유형별 스탯 보정 수치
 */

var csvData = [];

module.exports.data = csvData;
module.exports.Load = function (fs) {

    //!< 동기 사용.
    var data = fs.readFileSync(process.cwd() + '/Resources/CSV/BPowercal.txt', 'utf8');
    if (data != null) {
        var row = data.split('\r\n');
        var col;

        var temp;
        //!< Row Parse.
        for (var idx = 0; idx < row.length; idx++) {
            //!< Column Parse.
            col = row[idx].split(',');
            //"strength", "damage", "defensive", "action", "agility", "concentration", "recovery", "mentality", "aggro"
            temp = {
                type: Number(col[0]),           // 캐릭터 타입
                strength: Number(col[1]),       // 체력
                damage: Number(col[2]),         // 공격력
                defensive: Number(col[3]),      // 방어력
                action: Number(col[4]),         // 행동력
                agility: Number(col[5]),        // 민첩성
                concentration: Number(col[6]),  // 집중력
                recovery: Number(col[7]),       // 회복력
                mentality: Number(col[8]),      // 정신력
                aggro: Number(col[9])           // 어그로
            };
            csvData.push(temp);
        }
    }
}

module.exports.GetData = function (type) {
    for (var i = 0; i < csvData.length; i++)
        if (csvData[i].type == type)
            return csvData[i];
    return null;
}
