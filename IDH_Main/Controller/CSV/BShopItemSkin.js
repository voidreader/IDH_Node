var csvData = [];

module.exports.data = csvData;
module.exports.Load = function (fs) {

    console.log("BShopItemSkin.txt..."  + process.cwd());
    //!< 동기 사용.
    var data = fs.readFileSync(process.cwd() + '/Resources/CSV/BShopItemSkin.txt', 'utf8');
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
                name: col[2].replace(/\"/g,'').replace(/\#/g,','),
                type: Number(col[3]),
                sort: Number(col[4]),
                reward_id: Number(col[5]),
                cnt: Number(col[6]),
                first_bonus: Number(col[7]),
                sale_type: Number(col[8]),
                price: Number(col[9]),
                code: col[10],
                texture: Number(col[11]),
                payment_limit: Number(col[12]),
                mail_desc: col[14].replace(/\"/g,'').replace(/\#/g,',')
            };
            if(temp.reward_id > -1) csvData.push(temp);
        }
        // console.log("BSHOPITEMSKIN ");
        // console.log(JSON.stringify(csvData));
    }
}

exports.SaveShopItemSkin = () => {
    DB.query("DELETE FROM SHOP_ITEM_SKIN_BASE", (error, result) => {
        if(error) {
            if (error) console.log(error);
        } else {
            async.eachSeries(csvData, (data, callback) => {
                DB.query("INSERT INTO SHOP_ITEM_SKIN_BASE (ID, NAME, TYPE, SORT, REWARD_ID, CNT, FIRST_BONUS, SALE_TYPE, PRICE, CODE, TEXTURE, PR, `DESC`) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) "
                    + "ON DUPLICATE KEY UPDATE NAME = VALUES(NAME), TYPE = VALUES(TYPE), SORT = VALUES(SORT), REWARD_ID = VALUES(REWARD_ID), CNT = VALUES(CNT),"
                    + " FIRST_BONUS = VALUES(FIRST_BONUS), SALE_TYPE = VALUES(SALE_TYPE), PRICE = VALUES(PRICE), CODE = VALUES(CODE), TEXTURE = VALUES(TEXTURE), PR = VALUES(PR), `DESC` = VALUES(`DESC`);",
                    [data.id, data.name, data.type, data.sort, data.reward_id, data.cnt, data.first_bonus, data.sale_type, data.price, data.code, data.texture, data.payment_limit, data.mail_desc], (error, result) => {
                        callback(error);
                    });
            }, (error) => {
                if (error) console.log(error);
            });
        }
    });
}