/**
 * PVP 등급 조정
 */

var csvData = [];

module.exports.data = csvData;
module.exports.Load = function (fs) {

    //!< 동기 사용.
    var data = fs.readFileSync(process.cwd() + '/Resources/CSV/BAdvancement.txt', 'utf8');
    if (data != null) {
        var row = data.split('\r\n');
        var col;

        var temp;
        //!< Row Parse.
        for (var idx = 0; idx < row.length; idx++) {
            //!< Column Parse.
            col = row[idx].split(',');
            temp = {
                id: Number(col[0]),         // UniqueID
                rateType: Number(col[1]),   // 등급
                limit: Number(col[2]),      // 순위 제한
                advance: Number(col[3])     // 배치될 등급
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

exports.GetDataByRateType = function (rateType) {
    var list = [];
    for (var i = 0; i < csvData.length; i++)
        if (csvData[i].rateType == rateType)
            list.push(csvData[i]);
    return list;
}

