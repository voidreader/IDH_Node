var csvData = [];

module.exports.data = csvData;
module.exports.Load = function (fs) {

    //!< 동기 사용.
    var data = fs.readFileSync(process.cwd() + '/Resources/CSV/BRRReward.txt', 'utf8');
    if (data != null) {
        var row = data.split('\r\n');
        var col;

        var temp;
        //!< Row Parse.
        for (var idx = 0; idx < row.length; idx++) {
            //!< Column Parse.
            col = row[idx].split(',');
            temp = {
                id: Number(col[0]),
                difficulty: Number(col[1]),
                standard_name: col[2],
                standard_type: Number(col[3]),
                standard_value: Number(col[4]),
                reward_id: Number(col[5]),
                reward_id_value: Number(col[6]),
                reward_desc: col[7]
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

module.exports.GetDataByDifficulty = function (difficulty) {
    var list = []
    for (var i = 0; i < csvData.length; i++)
        if (csvData[i].difficulty == difficulty)
            list.push(csvData[i]);

    return list;
}