/**
 * 뽑기 확률
 */

var csvData = [];

module.exports.data = csvData;
module.exports.Load = function (fs) {

    //!< 동기 사용.
    var data = fs.readFileSync(process.cwd() + '/Resources/CSV/BGachaPercentage.txt', 'utf8');
    if (data != null) {
        var row = data.split('\r\n');
        var col;

        var temp;
        //!< Row Parse.
        for (var idx = 0; idx < row.length; idx++) {
            //!< Column Parse.
            col = row[idx].split(',');
            temp = {
                id: Number(col[0]),         // ID
                list_name: col[1],          // 이름
                type: Number(col[2]),       // xlsm 참고
                PerList: []
            };
            // 뽑기에서 제외되는 캐릭터 또는 아이템 ID 정보
            for(let i = 1; i < 25; i++){
                let index = i * 3;
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