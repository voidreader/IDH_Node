/**
 * 캐릭터 강화 시 필요 재화 및 경험치
 */

var csvData = [];

module.exports.data = csvData;
module.exports.Load = function (fs) {

    //!< 동기 사용.
    var data = fs.readFileSync(process.cwd() + '/Resources/CSV/BSNeed.txt', 'utf8');
    if (data != null) {
        var row = data.split('\r\n');
        var col;

        var temp;

        //!< Row Parse.
        for (var i = 0; i < row.length; i++) {
            //!< Column Parse.
            col = row[i].split(',');
            temp = {
                evolution_lvl: Number(col[0]),  // 진화단계
                enchant_lvl: Number(col[1]),    // 강화단계
                exp: Number(col[2]),            // 필요 경험치
                gold: Number(col[3]),           // 필요 골드
                cash: Number(col[4]),           // 필요 코인
                itemID : Number(col[5]),        // 필요한 아이템 ID
                ncount : Number(col[6]),          // 필요한 개수
                uchaID : Number(col[7]),        // 사용되는 캐릭터 ID
                character_lvl : Number(col[8]) // 캐릭터 레벨 
            };
            csvData.push(temp);
        }
    }
}

module.exports.GetData = function (evolution_lvl, enchant_lvl) {
    for (var i = 0; i < csvData.length; i++)
        if (csvData[i].evolution_lvl == evolution_lvl && csvData[i].enchant_lvl == enchant_lvl)
            return csvData[i];
    return null;
}