/**
 * 뽑기
 */

var csvData = [];

module.exports.data = csvData;
module.exports.Load = function (fs) {

    //!< 동기 사용.
    var data = fs.readFileSync(process.cwd() + '/Resources/CSV/BGacha.txt', 'utf8');
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
                type: Number(col[1]),               // 뽑기 타입 - 1: 캐릭터, 2: 장비, 3: 가구
                group: Number(col[2]),              // 클라이언트 사용
                count_type: Number(col[3]),         // 횟수 타입 - 0: 무료 뽑기, 1: 1회 뽑기, 2: 10회 뽑기
                list_name: col[4],                  // 뽑기 이름
                time: Number(col[5]),               // 다시 뽑는데 필요한 시간
                cost_id: Number(col[6]),            // 소모 아이템 ID
                cost_value: Number(col[7]),         // 소모 아이템 수량
                discount: Number(col[8]),           // 할인(사용 안함)
                final_cost: Number(col[9]),         // 최종 가격(사용 안함)
                reward1: Number(col[10]),           // 보상 1 ID - BGachaReward ID
                reward1_repeat: Number(col[11]),    // 보상 1 반복 횟수
                reward2: Number(col[12]),           // 보상 2 ID - BGachaReward ID
                reward2_repeat: Number(col[13]),    // 보상 2 반복 횟수
                bsprite_id: Number(col[14]),        // 스프라이트 ID (클라이언트 사용)
                string_id: Number(col[15])          // 클라이언트 사용
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