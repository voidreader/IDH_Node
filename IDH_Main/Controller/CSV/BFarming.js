/**
 * 파밍
 */

var csvData = [];

module.exports.data = csvData;
module.exports.Load = function (fs) {

    //!< 동기 사용.
    var data = fs.readFileSync(process.cwd() + '/Resources/CSV/BFarming.txt', 'utf8');
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
                chapter: Number(col[1]),            // 오픈 하는 챕터 조건(클라이언트 사용)
                stage: Number(col[2]),              // 파밍 종류
                name: col[3],                       // 파밍 이름
                time: Number(col[4]),               // 소요 시간
                power_value: Number(col[5]),        // 필요 전투력
                condition_type: Number(col[6]),     // 조건 타입 - 1: 전투력, 2: 캐릭터 유형으로 구성, 3: 모두 다른 유형으로 구성, 4: value 이상 성으로 구성, 5: value 이상 등급으로 구성
                condition_value: Number(col[7]),    // 조건 값
                reward: Number(col[8]),             // 보상 ID - BFarmingReward ID
                bsprite_id: Number(col[9]),         // 스프라이트 ID (클라이언트 사용)
                string_id: Number(col[10])          // 클라이언트 사용
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