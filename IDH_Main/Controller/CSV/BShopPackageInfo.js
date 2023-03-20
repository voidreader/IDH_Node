var csvData = [];

module.exports.data = csvData;
module.exports.Load = function (fs) {

    //!< 동기 사용.
    var data = fs.readFileSync(process.cwd() + '/Resources/CSV/BShopPackageInfo.txt', 'utf8');
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
                name: col[1].replace(/\"/g,''),
                string_id: Number(col[2]),
                reward: []
            };

            for(let i = 1; i < 11; i++){
                let index = (i * 3) + 1;
                if(col[index] > -1){
                    temp.reward.push({ CON: col[index - 1], ID: col[index], VALUE: col[index + 1] });
                }
            }
            csvData.push(temp);
        }
        //console.log("BSHOPPACKAGEINFO );
        //console.log(JSON.stringify(csvData));
    }
}

exports.SaveShopPackageInfo = () => {
    DB.query("DELETE FROM SHOP_PACKAGE_BASE", (error, result) => {
        if(error) {
            if (error) console.log(error);
        } else {
            async.eachSeries(csvData, (data, callback) => {
                let rewardList = [];
                for (let i = 0; i < data.reward.length; i++)
                    if (data.reward[i].ID > -1) rewardList.push(data.reward[i]);
        
                DB.query("INSERT INTO SHOP_PACKAGE_BASE (ID, NAME, STRING_ID, LIST) VALUES(?, ?, ?, ?) "
                    + "ON DUPLICATE KEY UPDATE NAME = VALUES(NAME), STRING_ID = VALUES(STRING_ID), LIST = VALUES(LIST);", [data.id, data.name, data.string_id, JSON.stringify(rewardList)], (error, result) => {
                        callback(error);
                    });
            }, (error) => {
                if (error) console.log(error);
            });
        }
    });
}

module.exports.GetData = function (id) {
    for (var i = 0; i < csvData.length; i++)
        if (csvData[i].id == id)
            return csvData[i];
    return null;
}