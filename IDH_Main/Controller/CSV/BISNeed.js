/**
 * 아이템 강화 시 필요 재화 및 경험치
 */

var csvData = [];

module.exports.data = csvData;
module.exports.Load = function (fs) {

    //!< 동기 사용.
    var data = fs.readFileSync(process.cwd() + '/Resources/CSV/BISNeed.txt', 'utf8');
    if (data != null) {
        var row = data.split('\r\n');
        var col;

        var temp;

        //!< Row Parse.
        for (var i = 0; i < row.length; i++) {
            //!< Column Parse.
            col = row[i].split(',');
            temp = {
                grade: Number(col[0]),          // 아이템 등급
                enchant_lvl: Number(col[1]),    // 강화 수치
                exp: Number(col[2]),            // 필요 경험치
                gold: Number(col[3]),           // 필요 골드
                cash: Number(col[4])            // 필요 캐쉬
            };
            csvData.push(temp);
        }
    }
}

module.exports.GetData = function (grade, enchant_lvl) {
    for (var i = 0; i < csvData.length; i++)
        if (csvData[i].grade == grade && csvData[i].enchant_lvl == enchant_lvl)
            return csvData[i];
    return null;
}