/**
 * 스토리 챕터
 */

var csvData = [];

module.exports.data = csvData;
module.exports.Load = function (fs) {

    //!< 동기 사용.
    var data = fs.readFileSync(process.cwd() + '/Resources/CSV/BChapter.txt', 'utf8');
    if (data != null) {
        var row = data.split('\r\n');
        var col;

        var temp;
        //!< Row Parse.
        for (var idx = 0; idx < row.length; idx++) {
            //!< Column Parse.
            col = row[idx].split(',');
            temp = {
                id: Number(col[0]),                     // 챕터 ID
                chapter: Number(col[1]),                // 챕터 번호
                difficulty: Number(col[2]),             // 난이도 - 1: 보통, 2: 어려움, 3: 매우 어려움
                chapter_name: col[3],                   // 챕터 이름
                chapter_stroy_string: Number(col[4]),   // 챕터 내용 ID (클라이언트 사용)
                stamina: Number(col[5]),                // 행동력 소모량
                reward_id1: Number(col[6]),             // 보상 아이템 1 ID
                reward_id1_value: Number(col[7]),       // 보상 아이템 1 수량
                reward_id2: Number(col[8]),             // 보상 아이템 2 ID
                reward_id2_value: Number(col[9]),       // 보상 아이템 2 수량
                reward_id3: Number(col[10]),            // 보상 아이템 3 ID
                reward_id3_value: Number(col[11]),      // 보상 아이템 3 수량
                bspriteId: Number(col[12])              // 챕터 이미지 ID (클라이언트 사용)
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

exports.GetChapterID = function (chapter, difficulty) {
    for (var i = 0; i < csvData.length; i++)
        if (csvData[i].chapter == chapter && csvData[i].difficulty == difficulty)
            return csvData[i];
    return null;
}
