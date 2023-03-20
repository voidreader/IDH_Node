var csvData = [];

module.exports.data = csvData;
module.exports.Load = function (fs) {

    //!< 동기 사용.
    var data = fs.readFileSync(process.cwd() + '/Resources/CSV/BMyRoomRandomBox.txt', 'utf8');
    if (data != null) {
        var row = data.split('\r\n');
        var col;

        var temp;
        //!< Row Parse.
        for (var i = 0; i < row.length; i++) {
            //!< Column Parse.
            col = row[i].split(',');
            temp = {
                item_id1: Number(col[0]),
                item_id1_min: Number(col[1]),
                item_id1_max: Number(col[2]),
                item_id1_probability: Number(col[3]),
                item_id2: Number(col[4]),
                item_id2_min: Number(col[5]),
                item_id2_max: Number(col[6]),
                item_id2_probability: Number(col[7]),
                item_id3: Number(col[8]),
                item_id3_min: Number(col[9]),
                item_id3_max: Number(col[10]),
                item_id3_probability: Number(col[11]),
                item_id4: Number(col[12]),
                item_id4_min: Number(col[13]),
                item_id4_max: Number(col[14]),
                item_id4_probability: Number(col[15]),
                item_id5: Number(col[16]),
                item_id5_min: Number(col[17]),
                item_id5_max: Number(col[18]),
                item_id5_probability: Number(col[19]),
                item_id6: Number(col[20]),
                item_id6_min: Number(col[21]),
                item_id6_max: Number(col[22]),
                item_id6_probability: Number(col[23])
            };
            csvData.push(temp);
        }
    }
}

module.exports.GetData = function (key) {
    return csvData[0][key];
}
