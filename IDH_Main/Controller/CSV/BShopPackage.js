var csvData = [];

module.exports.data = csvData;
module.exports.Load = function (fs) {

    //!< 동기 사용.
    var data = fs.readFileSync(process.cwd() + '/Resources/CSV/BShopPackage.txt', 'utf8');
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
                type: Number(col[1]),
                priority: Number(col[2]),
                mail_type: Number(col[3]),
                name: col[4],
                reward: [
                    { ID: Number(col[5]) },
                    { ID: Number(col[6]) },
                    { ID: Number(col[7]) },
                    { ID: Number(col[8]) },
                ],
                start_date: col[9],
                end_date: col[10],
                period: col[11]
            };
            csvData.push(temp);
        }
        //console.log("BSHOPPACKAGE ");
        //console.log(JSON.stringify(csvData[0]));
    }
}

exports.SaveShopPackage = () => {
    DB.query("DELETE FROM SHOP_BASE", (error, result) => {
        if(error) {
            callback(error);
        } else {
            async.eachSeries(csvData, (data, callback) => {
                let rewardList = [];
                for (let i = 0; i < data.reward.length; i++)
                    if (data.reward[i].ID > -1) rewardList.push(data.reward[i]);

                let startDate = data.start_date == -1 ? null : data.start_date;
                let endDate = data.end_date == -1 ? null : data.end_date;

                DB.query("INSERT INTO SHOP_BASE (ID, TYPE, PRIORITY, MAIL_TYPE, NAME, LIST, START_DATE, END_DATE, PERIOD) VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?) "
                    + "ON DUPLICATE KEY UPDATE TYPE = VALUES(TYPE), PRIORITY = VALUES(PRIORITY), MAIL_TYPE = VALUES(MAIL_TYPE), NAME = VALUES(NAME), LIST = VALUES(LIST), "
                    + "START_DATE = VALUES(START_DATE), END_DATE = VALUES(END_DATE), PERIOD = VALUES(PERIOD);",
                    [data.id, data.type, data.priority, data.mail_type, data.name, JSON.stringify(rewardList), startDate, endDate, data.period], (error, result) => {
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