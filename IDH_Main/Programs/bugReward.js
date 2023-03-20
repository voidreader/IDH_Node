let mysql = require('mysql'),
    async = require('async'),
    fs = require('fs');
let DB = mysql.createPool({
    "host": "localhost",
    "port": 3306,
    "user": "imageframeAll",
    "password": "imageframe.1120",
    "database": "idh",
    "connectionLimit": 150,
    "waitForConnections": true
});

var dataList = [];
async.waterfall([
    (callback) => {
        DB.query("SELECT B.USER_UID, A.NAME, IFNULL(A.ID, 0) CNT FROM ACCOUNT B LEFT JOIN TEST A ON A.NAME = B.USER_NAME "
            + "WHERE DATE_FORMAT(CREATE_DATE, '%Y-%m-%d') < '2020-01-01' "
            + "ORDER BY IFNULL(A.ID, 0) DESC;", (sErr, targetList) => {
            console.log("FINAL Count : User Count - " + targetList.length);
            for(let i = 0; i < targetList.length; i++){
                let price = 0;
                //if(targetList[i].COUNT < maxPrice) maxPrice = targetList[i].COUNT;


                if (targetList[i].CNT > 100) {
                    price = 0;
                } else if (targetList[i].CNT > 50) {
                    price = 300000;
                } else if (targetList[i].CNT > 20) {
                    price = 700000;
                } else {
                    price = 1000000;
                }   

                if(price > 0) dataList.push({ user: targetList[i].USER_UID, price: price });
            }
            callback(sErr, dataList);
        });
        //callback(null, null);
    }, (userList, callback) => {
        
        var textStr = "";
        async.eachSeries(userList, (user, cb) => {
            //console.log(JSON.stringify(user));
            textStr += "CALL IDH.INSERT_MAIL_MANAGE(1," + user.user + ",'14',2,'3000001'," + user.price + ",'버그 악용 제제','2020/01/22 00:00:00','2020/01/29 00:00:00');\n";
            console.log("CALL IDH.INSERT_MAIL_MANAGE(1," + user.user + ",'14',2,'3000001'," + user.price + ",'버그 악용 제제','2020/01/22 00:00:00','2020/01/29 00:00:00');");
            /*var que = DB.query("",
            [1, obj.user,'14',2,'3000002', obj.price, '펄 사용해 봤어','2020/01/08 00:00:00','2020/01/15 00:00:00'], (error, result) => {*/

            setTimeout(()=> { cb(null); }, 10);
            /*DB.query("SELECT * FROM FRIEND WHERE (USER_UID = ? OR FRIEND_UID = ?) AND ACCEPT = 1 AND ACTIVE = 1  ORDER BY UPDATE_DATE DESC"
            , [user.USER_UID, user.USER_UID], (sErr, sResult) => {
                console.log("USER_UID : " + user.USER_UID + ", LENGTH : " + sResult.length + ", FRIEND_CNT : " + sResult.length / 2);
                //console.log(JSON.stringify(sResult[0]));
                let number = 0;
                async.eachSeries(sResult, (data, ecb) => {
                    if(number > 99) {
                        //console.log(number + " / " + data.USER_UID + " / " + data.FRIEND_UID);
                        //let string = number + " DELETE FROM FRIEND WHERE USER_UID = " + data.USER_UID + " AND FRIEND_UID = " + data.FRIEND_UID;
                        textStr += number + " DELETE FROM FRIEND WHERE USER_UID = " + data.USER_UID + " AND FRIEND_UID = " + data.FRIEND_UID + "\n";
                        DB.query("DELETE FROM FRIEND WHERE USER_UID = " + data.USER_UID + " AND FRIEND_UID = " + data.FRIEND_UID, (qErr, qRes) => {
                            number++;
                            ecb(qErr);
                        });
                    } else {
                        number++;
                        ecb(null);
                    }
                }, (error) => {
                    cb(null);
                });
            }); */
        }, (error) => {
            fs.writeFileSync('bugReward.sql', textStr, 'utf8');
            callback(null);
        });
        /*console.log("Start Creating User : " + idList.length);
        async.eachSeries(idList, (idStr, cb) => {
            let queryStr = "CALL CBTDefaultUserData(?)";
            let args = [idStr];

            //queryStr = "SELECT * FROM ACCOUNT WHERE USER_UID = 2567";
            DB.query(queryStr, args, (sErr, sResult) => {
                cb(sErr);
            });
        }, (error) => { callback(error); });*/
    }
], (error) => {
    if(error) console.log("Error : " + error);
    console.log("Finished check File...!");
    //console.log("End Creating User : " + idList.length);
});