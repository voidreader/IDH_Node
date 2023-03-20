var csvData = [];

module.exports.data = csvData;
module.exports.Load = function (fs) {

    //!< 동기 사용.
    var data = fs.readFileSync(process.cwd() + '/Resources/CSV/BMakingTime.txt', 'utf8');
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
                time_min: Number(col[1]),
                time_max: Number(col[2]),
                list_name: col[3],
                type: Number(col[4]),
                PerList: []
            };
            let startIndex = 5;
            for(let i = 0; i < 25; i++){
                let index = startIndex + (i * 3);
                let id = Number(col[index]);
                if(id > -1) temp.PerList.push({ ID: id, PER: Number(col[index + 2]) });
            }
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