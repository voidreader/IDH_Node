var csvData = [];

module.exports.data = csvData;
module.exports.Load = function (fs) {

    //!< 동기 사용.
    var data = fs.readFileSync(process.cwd() + '/Resources/CSV/BStage.txt', 'utf8');
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
                r1f1: Number(col[5]),
                r1f2: Number(col[6]),
                r1f3: Number(col[7]),
                r1f4: Number(col[8]),
                r1f5: Number(col[9]),
                r1f6: Number(col[10]),
                r2f1: Number(col[11]),
                r2f2: Number(col[12]),
                r2f3: Number(col[13]),
                r2f4: Number(col[14]),
                r2f5: Number(col[15]),
                r2f6: Number(col[16]),
                r3f1: Number(col[17]),
                r3f2: Number(col[18]),
                r3f3: Number(col[19]),
                r3f4: Number(col[20]),
                r3f5: Number(col[21]),
                r3f6: Number(col[22])
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