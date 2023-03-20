/**
 * 뽑기 1차 분류
 */

var csvData = [];

module.exports.data = csvData;
module.exports.Load = function (fs) {

    //!< 동기 사용.
    var data = fs.readFileSync(process.cwd() + '/Resources/CSV/BGachaReward.txt', 'utf8');
    if (data != null) {
        var row = data.split('\r\n');
        var col;

        var temp;
        //!< Row Parse.
        for (var idx = 0; idx < row.length; idx++) {
            //!< Column Parse.
            col = row[idx].split(',');
            temp = {
                id: Number(col[0]),                     // ID
                list_name: col[1],                      // 뽑기 이름
                reward1: Number(col[2]),                // 등급별 뽑기 ID - BGachaPercentage ID
                reward1_name: col[3],                   // 보상 이름
                reward1_probability: Number(col[4]),    // 보상 확률
                reward2: Number(col[5]),
                reward2_name: col[6],
                reward2_probability: Number(col[7]),
                reward3: Number(col[8]),
                reward3_name: col[9],
                reward3_probability: Number(col[10]),
                reward4: Number(col[11]),
                reward4_name: col[12],
                reward4_probability: Number(col[13]),
                reward5: Number(col[14]),
                reward5_name: col[15],
                reward5_probability: Number(col[16])
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