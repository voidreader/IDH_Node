/**
 * 캐릭터 강화 보정 수치(1 강화)
 */

var csvData = [];

module.exports.data = csvData;
module.exports.Load = function (fs) {

    //!< 동기 사용.
    var data = fs.readFileSync(process.cwd() + '/Resources/CSV/BStrengthen.txt', 'utf8');
    if (data != null) {
        var row = data.split('\r\n');
        var col;

        var temp;
        //!< Row Parse.
        for (var idx = 0; idx < row.length; idx++) {
            //!< Column Parse.
            col = row[idx].split(',');
            temp = {
                enchant_type: Number(col[0]),   // 1: 강화, 2: 진화, 3: 각성
                character_type: Number(col[1]), // 캐릭터 타입
                strength: Number(col[3]),       // 체력 보정 수치
                damage: Number(col[4]),         // 공격력 보정 수치
                defensive: Number(col[5]),      // 방어력 보정 수치
                action: Number(col[6]),         // 행동력 보정 수치
                agility: Number(col[7]),        // 민첩성 보정 수치
                concentration: Number(col[8]),  // 집중력 보정 수치
                recovery: Number(col[9]),       // 회복력 보정 수치
                mentality: Number(col[10]),     // 정신력 보정 수치
                aggro: Number(col[11])          // 어그로 보정 수치
            };
            csvData.push(temp);
        }
    }
}

module.exports.GetData = function (enchantType, type) {
    for (var i = 0; i < csvData.length; i++)
        if (csvData[i].enchant_type == enchantType && csvData[i].character_type == type)
            return csvData[i];
    return null;
}