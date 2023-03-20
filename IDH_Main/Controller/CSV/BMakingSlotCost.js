var csvData = [];

module.exports.data = csvData;
module.exports.Load = function (fs) {

    //!< 동기 사용.
    var data = fs.readFileSync(process.cwd() + '/Resources/CSV/BMakingSlotCost.txt', 'utf8');
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
                type: Number(col[1]),
                slot_number: Number(col[2]),
                cost1_id: Number(col[3]),
                cost1_value: Number(col[4]),
                time: Number(col[5]),
                cost2_id: Number(col[6]),
                cost2_value: Number(col[7])
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

module.exports.GetTypeList = function (type) {
    var list = [];
    for (var i = 0; i < csvData.length; i++)
        if (csvData[i].type == type)
            list.push(csvData[i]);

    return list;
}