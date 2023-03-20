var csvData = [];

module.exports.data = csvData;
module.exports.Load = function (fs) {

    //!< 동기 사용.
    var data = fs.readFileSync(process.cwd() + '/Resources/CSV/BMyRoom.txt', 'utf8');
    if (data != null) {
        var row = data.split('\r\n');
        var col;

        var temp;

        //!< Row Parse.
        for (var i = 0; i < row.length; i++) {
            //!< Column Parse.
            col = row[i].split(',');
            temp = {
                id: Number(col[0]),
                name: col[1],
                default: Number(col[2]),
                open_type: col[3],
                open_value: col[4],
                satisfaction: [
                    {SATIS: Number(col[5]), EFFECT: Number(col[6]), VALUE: 1 + (Number(col[7]) / 100) },
                    {SATIS: Number(col[8]), EFFECT: Number(col[9]), VALUE: 1 + (Number(col[10]) / 100) },
                    {SATIS: Number(col[11]), EFFECT: Number(col[12]), VALUE: 1 + (Number(col[13]) / 100) },
                    {SATIS: Number(col[14]), EFFECT: Number(col[15]), VALUE: 1 + (Number(col[16]) / 100) }
                ]
            };
            csvData.push(temp);
        }
    }
}

module.exports.GetData = function (id) {
    for (var i = 0; i < csvData.length; i++) {
        if (csvData[i].id == id)
            return csvData[i];
    }
    return null;
}
