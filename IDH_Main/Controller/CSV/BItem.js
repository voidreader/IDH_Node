/**
 * 아이템
 */

var csvData = [];

module.exports.data = csvData;
module.exports.Load = function (fs) {

    //!< 동기 사용.
    var data = fs.readFileSync(process.cwd() + '/Resources/CSV/BItem.txt', 'utf8');
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
                name: col[1],
                grade: Number(col[2]),
                type: Number(col[3]),
                attr: Number(col[4]),
                stack: Number(col[5]),
                inven: Number(col[6]),
                effect: Number(col[7]),
                lvl_limit: Number(col[8]),
                equip_type: Number(col[9]),
                prefix_type: Number(col[10]),
                prefix_id: Number(col[11]),
                options: [
                    {
                        TYPE: Number(col[12]), ID: Number(col[13])
                    },
                    {
                        TYPE: Number(col[14]), ID: Number(col[15])
                    },
                    {
                        TYPE: Number(col[16]), ID: Number(col[17])
                    },
                    {
                        TYPE: Number(col[18]), ID: Number(col[19])
                    }
                ],
                texture: Number(col[20]),
                in_game_texture: Number(col[21]),
                description_id: Number(col[22]),
                resell_flag: Number(col[23]),
                resell_price: Number(col[24]),
                exp: Number(col[28])
            };
            csvData.push(temp);
        }
    }
}

module.exports.GetData = function (id) {
    let tempObj = null;
    for (var i = 0; i < csvData.length; i++) {
        if (csvData[i].id == id){
            tempObj = csvData[i];
            break;
        }
    }
    return tempObj;
}

module.exports.GetGrade = function (id) {
    for (var i = 0; i < csvData.length; i++)
        if (csvData[i].id == id)
            return csvData[i].grade;
    return 0;
}
module.exports.GetGradeList = function (grade) {
    var list = [];
    for (var i = 0; i < csvData.length; i++)
        if (csvData[i].grade == grade)
            list.push(csvData[i]);
    return list;
}

module.exports.GetEffect = function (id) {
    for (var i = 0; i < csvData.length; i++)
        if (csvData[i].id == id)
            return csvData[i].effect;
    return -1;
}

module.exports.GetInventoryType = function (id) {
    for (var i = 0; i < csvData.length; i++) {
        if (csvData[i].id == id) {
            return csvData[i].type;
        }
    }
    return -1;
}
