/**
 * 스토리
 */

var csvData = [];

module.exports.data = csvData;
module.exports.Load = function (fs) {

    //!< 동기 사용.
    var data = fs.readFileSync(process.cwd() + '/Resources/CSV/BStory.txt', 'utf8');
    if (data != null) {
        var row = data.split('\r\n');
        var col;

        var temp;
        //!< Row Parse.
        for (var idx = 0; idx < row.length; idx++) {
            //!< Column Parse.
            let rowStr = row[idx];
            let tempSplit = rowStr.split('"');

            if (tempSplit.length > 1) {
                tempSplit[1] = tempSplit[1].replace(/\,/g,'');
                rowStr = tempSplit[0] + tempSplit[1] + tempSplit[2];
            }
        
            col = rowStr.split(',');
            temp = {
                id: Number(col[0]),                     // 스토리 ID
                chapter: Number(col[1]),                // 해당 챕터 번호
                stage: Number(col[2]),                  // 스테이지 번호
                difficulty: Number(col[3]),             // 난이도 - 1: 보통, 2: 어려움, 3: 매우 어려움
                stageId: Number(col[4]),                // 사용 안함
                open_condition: Number(col[5]),         // 해당 스토리 클리어 시 오픈되는 스토리
                stage_name: col[6],                     // 스토리 이름
                power_recommand: Number(col[7]),        // 권장 전투력
                gold_min: Number(col[8]),               // 골드 보상 min
                gold_max: Number(col[9]),               // 골드 보상 max
                add_exp: Number(col[10]),               // 경험치 획득량
                reward: Number(col[11]),                // 보상 ID - BStoryReward ID
                ovk_value: Number(col[12]),             // 오버킬 판정 수치
                ovk_reward_count: Number(col[13]),      // 오버킬 골드 보상 수량
                missionId1: Number(col[14]),            // 스토리 미션 1 ID - BMissionDefine ID
                missionId1_value: Number(col[15]),      // 스토리 미션 1 값
                missionId1_string: Number(col[16]),     // 사용 안함
                missionId2: Number(col[17]),            // 스토리 미션 2 ID - BMissionDefine ID
                missionId2_value: Number(col[18]),      // 스토리 미션 2 값
                missionId2_string: Number(col[19]),     // 사용 안함
                missionId3: Number(col[20]),            // 스토리 미션 3 ID - BMissionDefine ID
                missionId3_value: Number(col[21]),      // 스토리 미션 3 값
                missionId3_string: Number(col[22])      // 사용 안함
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