var csvData = [];

module.exports.data = csvData;
module.exports.Load = function (fs) {

    //!< 동기 사용.
    var data = fs.readFileSync(process.cwd() + '/Resources/CSV/BMailString.txt', 'utf8');
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
                limit: Number(col[2])
            };
            csvData.push(temp);
        }
    }
}

exports.GetData = function (type) {
    for (var i = 0; i < csvData.length; i++)
        if (csvData[i].type == type)
            return csvData[i];
    return null;
}