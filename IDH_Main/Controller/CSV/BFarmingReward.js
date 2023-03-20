/**
 * 요일 던전 보상
 */

var csvData = [];

module.exports.data = csvData;
module.exports.Load = function (fs) {

    //!< 동기 사용.
    var data = fs.readFileSync(process.cwd() + '/Resources/CSV/BFarmingReward.txt', 'utf8');
    if (data != null) {
        var row = data.split('\r\n');
        var col;

        var temp;
        //!< Row Parse.
        for (var idx = 0; idx < row.length; idx++) {
            //!< Column Parse.
            col = row[idx].split(',');
            temp = {
                id: Number(col[0]),                         // 보상 ID
                depense_coin: Number(col[1]),               // 방어 코인
                approach_coin: Number(col[2]),              // 근접 코인
                magic_coin: Number(col[3]),                 // 마법 코인
                snipe_coin: Number(col[4]),                 // 저격 코인
                support_coin: Number(col[5]),               // 지원 코인
                no_reward_probability: Number(col[6]),      // 보상 안 나올 확률
                reward_id1: Number(col[7]),                 // 보상 아이템 ID
                reward_id1_min: Number(col[8]),             // 보상 아이템 수량 min
                reward_id1_max: Number(col[9]),             // 보상 아이템 수량 max
                reward_id1_probability: Number(col[10]),    // 보상 아이템 획득 확률
                reward_id2: Number(col[11]),
                reward_id2_min: Number(col[12]),
                reward_id2_max: Number(col[13]),
                reward_id2_probability: Number(col[14]),
                reward_id3: Number(col[15]),
                reward_id3_value: Number(col[16]),
                reward_id3_probability: Number(col[17]),
                reward_id4: Number(col[18]),
                reward_id4_value: Number(col[19]),
                reward_id4_probability: Number(col[20]),
                reward_id5: Number(col[21]),
                reward_id5_value: Number(col[22]),
                reward_id5_probability: Number(col[23])
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