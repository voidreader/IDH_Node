/**
 * 캐릭터
 */

var csvData = [];

module.exports.data = csvData;
module.exports.Load = function (fs) {

    //!< 동기 사용.
    var data = fs.readFileSync(process.cwd() + '/Resources/CSV/BCharacter.txt', 'utf8');
    if (data != null) {
        var row = data.split('\r\n');
        var col;

        var temp;
        //!< Row Parse.
        for (var idx = 0; idx < row.length; idx++) {
            //!< Column Parse.
            col = row[idx].split(',');
            temp = {
                id: Number(col[0]),             // 캐릭터 INDEX
                sort: Number(col[1]),           // 캐릭터 대분류(ex - 고등학생 나가, SPOON 나가, 청년 나가 동일)
                index: Number(col[2]),          // 동종 구분
                grade: Number(col[3]),          // 등급 - 0: SSS, 1: SS, 2: S, 3: A, 4: B 
                evolution: Number(col[4]),      // 진화 단계
                name: col[5],                   // 캐릭터 이름
                explanation: Number(col[6]),    // 캐릭터 설명 ID (클라이언트 사용)
                character_type: Number(col[7]), // 캐릭터 타입 (클라이언트 사용)
                attack_type: Number(col[8]),    // 캐릭터 공격 타입 (클라이언트 사용)
                strength: Number(col[9]),       // 체력
                damage: Number(col[10]),        // 공격력
                defensive: Number(col[11]),     // 방어력
                action: Number(col[12]),        // 행동력
                agility: Number(col[13]),       // 민첩성
                concentration: Number(col[14]), // 집중력
                recovery: Number(col[15]),      // 회복력
                mentality: Number(col[16]),     // 정신력
                aggro: Number(col[17]),         // 어그로
                skill: Number(col[18]),         // 스킬 ID (클라이언트 사용)
                resell_price: Number(col[26]),  // 판매 금액
                enchant_exp: Number(col[28])    // 재료 사용 시 증가되는 경험치량
            };
            csvData.push(temp);
        }
    }
}

exports.GetData = function (id) {
    for (var idx = 0; idx < csvData.length; idx++)
        if (csvData[idx].id == id)
            return csvData[idx];
    return null;
}

exports.GetGradeList = function (grade) {
    var list = [];
    for (var i = 0; i < csvData.length; i++)
        if (csvData[i].index > 0 && csvData[i].grade == grade)
            list.push(csvData[i]);
    return list;
}

module.exports.GetGrade = function (index) {
    for (var idx = 0; idx < csvData.length; idx++)
        if (csvData[idx].index == index)
            return csvData[idx].grade;
    return 0;
}
module.exports.GetEvolutionList = function (evolution) {
    var list = [];
    for (var i = 0; i < csvData.length; i++)
        if (csvData[i].evolution == evolution && csvData[i].index > 0)
            list.push(csvData[i]);
    return list;
}