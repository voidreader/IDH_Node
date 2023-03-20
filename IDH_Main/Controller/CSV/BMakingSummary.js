var csvData = [];

module.exports.data = csvData;
module.exports.Load = function (fs) {

    //!< 동기 사용.
    var data = fs.readFileSync(process.cwd() + '/Resources/CSV/BMakingSummary.txt', 'utf8');
    if (data != null) {
        var row = data.split('\r\n');
        var col;

        var temp;
        //!< Row Parse.
        for (var idx = 0; idx < row.length; idx++) {
            //!< Column Parse.
            col = row[idx].split(',');
            temp = {
                type: Number(col[0]),
                range_min: Number(col[1]),
                range_max: Number(col[2]),
                reward1: Number(col[3]),
                reward1_probability: Number(col[4]),
                reward2: Number(col[5]),
                reward2_probability: Number(col[6]),
                reward3: Number(col[7]),
                reward3_probability: Number(col[8]),
                reward4: Number(col[9]),
                reward4_probability: Number(col[10]),
                reward5: Number(col[11]),
                reward5_probability: Number(col[12])
            };
            csvData.push(temp);
        }
    }
}

module.exports.GetTypeList = function (type) {
    var list = [];
    for (var i = 0; i < csvData.length; i++)
        if (csvData[i].type == type)
            list.push(csvData[i]);

    return list;
}