var csvData = [];

module.exports.data = csvData;
module.exports.Load = function (fs) {

    //!< 동기 사용.
    var data = fs.readFileSync(process.cwd() + '/Resources/CSV/BRuleItemEffect.txt', 'utf8');
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
                group: Number(col[1]),
                name: col[2],
                sub_description: col[3],
                pick_probability: Number(col[4]),
                effect_id: Number(col[5]),
                effect_type: Number(col[6]),
                period1_min: Number(col[7]),
                period1_max: Number(col[8]),
                period1_probability: Number(col[9]),
                period2_min: Number(col[10]),
                period2_max: Number(col[11]),
                period2_probability: Number(col[12]),
                period3_min: Number(col[13]),
                period3_max: Number(col[14]),
                period3_probability: Number(col[15])
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

exports.GetGroupData = function (group) {
    var list = [];
    for (var i = 0; i < csvData.length; i++)
        if (csvData[i].group == group)
            list.push(csvData[i]);

    return list;
}