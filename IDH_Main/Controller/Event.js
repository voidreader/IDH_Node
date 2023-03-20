/**
 * 이벤트 Controller
 * http 요청 - main_cluster.js 에 이벤트 라인 주석 해제 후 사용
 * 현재까지 진행된 이벤트 - 아이템강화, 펄 사용, 스테이지, 제조
 * 점검 시 http 요청으로 해당 함수 실행하여 데이터 확인 후 주석 부분 해제 하여 메일 지급
 */
var fs = require('fs');

// 아이템 강화 이벤트
exports.EventItemEnchant = (req, res) => {
    var userList = [];
    var dataList = [];
    var targetList = [];
    var maxPrice = 0;
    async.series([
        (callback) => {
            logSelectDB.query("SELECT USER_UID, ITEM_ID, COUNT(ENCHANT) ENCHANT FROM ITEM_ENCHANT WHERE (CREATE_TIME BETWEEN '2019-12-27 00:00:00' AND '2019-12-30 00:00:00') "
             + "GROUP BY USER_UID, ITEM_ID", (sErr, sResult) => {
                targetList = sResult;
                console.log(targetList.length);
                console.log(targetList[0]);
                for(let i = 0; i < targetList.length; i++){
                    if(userList.indexOf(targetList[i].USER_UID) < 0){
                        userList.push(targetList[i].USER_UID);
                        dataList.push({ user: targetList[i].USER_UID, price: 0 });
                    }
                }
                callback(sErr);
            });
            //callback(null);
        },
        (callback) => {                            
            for(let i = 0; i < targetList.length; i++){
                let csvObj = CSVManager.BItem.GetData(targetList[i].ITEM_ID);
                let price = 0;
                switch(csvObj.grade){
                    case 10: price = 500000; break;
                    case 11: price = 50000; break;
                    case 12: price = 10000; break;
                    case 13: price = 2000; break;
                    case 14: price = 500; break;
                }
                price *= targetList[i].ENCHANT;
                // console.log(targetList[i].USER_UID + " / " + targetList[i].ITEM_ID + " / " + csvObj.grade + " / " + price + " / " + targetList[i].ENCHANT);
                for(let j = 0; j < dataList.length; j++){
                    if(dataList[j].user == targetList[i].USER_UID){
                        dataList[j].price += price;
                    }
                }
            }
            callback(null);
        }
    ], (error) => {
        let textStr = "";
        for(let i = 0; i < dataList.length; i++){
            textStr += dataList[i].user + ", ";
            dataList[i].price *= 0.5;
            if(maxPrice < dataList[i].price) maxPrice = dataList[i].price;
            if(dataList[i].price > 0){
                console.log(dataList[i]);
            }
        }
        console.log("maxPrice : " + maxPrice);
        fs.writeFileSync('EventItemEnchant.txt', textStr, 'utf8');
        
        res.json(null);
        /*
        async.eachSeries(dataList, (obj, cb) => {
            if(obj.price > 0) {
                var que = DB.query("CALL IDH.INSERT_MAIL_MANAGE(?,?,?,?,?,?,?,?,?)",
                [1, obj.user,'14',2,'3000001', obj.price, '아이템 강화 이벤트 보상','2020/01/01 00:00:00','2020/01/08 00:00:00'], (error, result) => {
                    console.log(que.sql);
                    cb(error);
                });
            } else {
                cb(null);
            }
        }, (error) => { 
            console.log(error);
            console.log(dataList.length);
            res.json("null");
        });*/
    });
}

// 펄 사용 이벤트
exports.EventPerl = (req, res) => {
    var dataList = [];
    var targetList = [];
    var maxPrice = 0;
    async.series([
        (callback) => {
            logSelectDB.query("SELECT USER_UID, SUM(ITEM_COUNT) COUNT FROM ITEM WHERE (CREATE_TIME BETWEEN '2019-12-24 00:00:00' AND '2020-01-08 00:00:00') "
                + "AND ITEM_ID = 3000002 AND ITEM_COUNT < 0 GROUP BY USER_UID", (sErr, sResult) => {
                targetList = sResult;

                for(let i = 0; i < targetList.length; i++){
                    let price = 0;
                    if(targetList[i].COUNT < maxPrice) maxPrice = targetList[i].COUNT;

                    if(targetList[i].COUNT < -9999) {
                        price = 3000000;
                    } else if (targetList[i].COUNT < -4999) {
                        price = 1300000;
                    } else if (targetList[i].COUNT < -1999) {
                        price = 500000;
                    } else if (targetList[i].COUNT < -999) {
                        price = 200000;
                    }

                    dataList.push({ user: targetList[i].USER_UID, price: price });
                }
                callback(sErr);
            });
        },
        (callback) => {                            
            // for(let i = 0; i < dataList.length; i++){
            //     if(i < 10) console.log(JSON.stringify(dataList[i]));
            // }
            console.log("maxPrice : " + maxPrice);
            callback(null);
        }
    ], (error) => {
        res.json(null);
        /*
        async.eachSeries(dataList, (obj, cb) => {
            if(obj.price > 0) {
                var que = DB.query("CALL IDH.INSERT_MAIL_MANAGE(?,?,?,?,?,?,?,?,?)",
                [1, obj.user,'14',2,'3000002', obj.price, '펄 사용해 봤어','2020/01/08 00:00:00','2020/01/15 00:00:00'], (error, result) => {
                    console.log(que.sql);
                    cb(error);
                });
            } else {
                cb(null);
            }
        }, (error) => { 
            console.log(error);
            console.log(dataList.length);
            res.json("null");
        });*/
    });
}

// 스토리 이벤트
exports.EventStory = () => {
    var dataList = [];
    var targetList = [];
    var maxValue = 0;
    var startDate = "2020-01-08 00:00:00";
    var endDate = "2020-01-15 00:00:00";
    async.series([
        (callback) => {
            logSelectDB.query("SELECT USER_UID, COUNT(STORY_ID) CNT FROM STORY "
            + "WHERE `ATTEMPT_DATE` BETWEEN ? AND ? AND `CLEAR` = 1 "
            + "GROUP BY USER_UID ORDER BY COUNT(STORY_ID) DESC;", [startDate, endDate], (sErr, sResult) => {
                targetList = sResult;
                console.log(targetList.length);
                console.log(targetList[0]);
                for(let i = 0; i < targetList.length; i++){
                    let rewardList = [];
                    if(targetList[i].CNT < maxValue) maxValue = targetList[i].CNT;
                    if(targetList[i].CNT >= 700) {
                        rewardList.push({REWARD_ITEM_ID: 3700014, REWARD_ITEM_COUNT: 5});
                        rewardList.push({REWARD_ITEM_ID: 3000001, REWARD_ITEM_COUNT: 2000000});
                        rewardList.push({REWARD_ITEM_ID: 3000001, REWARD_ITEM_COUNT: 500000});
                        rewardList.push({REWARD_ITEM_ID: 3700013, REWARD_ITEM_COUNT: 5});
                        rewardList.push({REWARD_ITEM_ID: 3000001, REWARD_ITEM_COUNT: 100000});
                    } else if (targetList[i].CNT >= 500) {
                        rewardList.push({REWARD_ITEM_ID: 3000001, REWARD_ITEM_COUNT: 2000000});
                        rewardList.push({REWARD_ITEM_ID: 3000001, REWARD_ITEM_COUNT: 500000});
                        rewardList.push({REWARD_ITEM_ID: 3700013, REWARD_ITEM_COUNT: 5});
                        rewardList.push({REWARD_ITEM_ID: 3000001, REWARD_ITEM_COUNT: 100000});
                    } else if (targetList[i].CNT >= 200) {
                        rewardList.push({REWARD_ITEM_ID: 3000001, REWARD_ITEM_COUNT: 500000});
                        rewardList.push({REWARD_ITEM_ID: 3700013, REWARD_ITEM_COUNT: 5});
                        rewardList.push({REWARD_ITEM_ID: 3000001, REWARD_ITEM_COUNT: 100000});
                    } else if (targetList[i].CNT >= 100) {
                        rewardList.push({REWARD_ITEM_ID: 3700013, REWARD_ITEM_COUNT: 5});
                        rewardList.push({REWARD_ITEM_ID: 3000001, REWARD_ITEM_COUNT: 100000});
                    } else if (targetList[i].CNT >= 50) {
                        rewardList.push({REWARD_ITEM_ID: 3000001, REWARD_ITEM_COUNT: 100000});
                    }

                    dataList.push({ user: targetList[i].USER_UID, rewardList: rewardList });
                }
                callback(sErr);
            });
        },
        (callback) => {                            
            var textStr = "";
            for(let i = 0; i < dataList.length; i++){
                textStr += dataList[i].user + ", ";
                if(i < 10) console.log(JSON.stringify(dataList[i]));
            }
            console.log("MaxValue : " + maxValue);
            fs.writeFileSync('EventStory.txt', textStr, 'utf8');
            callback(null);
        }
    ], (error) => {
        res.json(null);
        
        /*async.eachSeries(dataList, (obj, cb) => {
            if(obj.rewardList.length > 0) {
                Item.SetItemType(obj.rewardList);
                async.eachSeries(obj.rewardList, (rewardObj, ecb) => {
                    var que = DB.query("CALL IDH.INSERT_MAIL_MANAGE(?,?,?,?,?,?,?,?,?)",
                    [1, obj.user,'14', rewardObj.ITEM_TYPE, rewardObj.REWARD_ITEM_ID, rewardObj.REWARD_ITEM_COUNT, '듄쌤의 비수면 특별 강의','2020/01/15 00:00:00','2020/01/22 00:00:00'], (error, result) => {
                        console.log(que.sql);
                        ecb(error);
                    });
                }, (error) => {
                    cb(error);
                });
            } else {
                cb(null);
            }
        }, (error) => { 
            console.log(error);
            console.log(dataList.length);
            res.json("null");
        });*/
    });
}

// 제조 이벤트
exports.EventMaking = () => {
    var dataList = [];
    var targetList = [];
    var maxValue = 0;
    var startDate = "2020-01-08 00:00:00";
    var endDate = "2020-01-15 00:00:00";
    async.series([
        (callback) => {
            logSelectDB.query("SELECT A.USER_UID, COUNT(MAKING_ID) CNT FROM MAKING "
            + "WHERE `TIME` BETWEEN ? AND ? "
            + "GROUP BY USER_UID ORDER BY COUNT(MAKING_ID) DESC;", [startDate, endDate], (sErr, sResult) => {
                targetList = sResult;
                console.log(targetList.length);
                console.log(targetList[0]);
                for(let i = 0; i < targetList.length; i++){
                    let rewardList = [];
                    if(targetList[i].CNT < maxValue) maxValue = targetList[i].CNT;
                    if(targetList[i].CNT >= 200) {
                        rewardList.push({REWARD_ITEM_ID: DefineItem.TICKET_FAST_HERO_MANUFACTURER, REWARD_ITEM_COUNT: 5});
                        rewardList.push({REWARD_ITEM_ID: DefineItem.TICKET_DUNGEON, REWARD_ITEM_COUNT: 3});
                        rewardList.push({REWARD_ITEM_ID: 3700013, REWARD_ITEM_COUNT: 5});
                        rewardList.push({REWARD_ITEM_ID: DefineItem.TICKET_FAST_HERO_MANUFACTURER, REWARD_ITEM_COUNT: 3});
                        rewardList.push({REWARD_ITEM_ID: 3700013, REWARD_ITEM_COUNT: 3});
                        rewardList.push({REWARD_ITEM_ID: DefineItem.TICKET_FAST_EQUIPMENT_MANUFACTURER, REWARD_ITEM_COUNT: 10});
                    } else if (targetList[i].CNT >= 100) {
                        rewardList.push({REWARD_ITEM_ID: 3700013, REWARD_ITEM_COUNT: 5});
                        rewardList.push({REWARD_ITEM_ID: DefineItem.TICKET_FAST_HERO_MANUFACTURER, REWARD_ITEM_COUNT: 3});
                        rewardList.push({REWARD_ITEM_ID: 3700013, REWARD_ITEM_COUNT: 3});
                        rewardList.push({REWARD_ITEM_ID: DefineItem.TICKET_FAST_EQUIPMENT_MANUFACTURER, REWARD_ITEM_COUNT: 10});
                    } else if (targetList[i].CNT >= 50) {
                        rewardList.push({REWARD_ITEM_ID: DefineItem.TICKET_FAST_HERO_MANUFACTURER, REWARD_ITEM_COUNT: 3});
                        rewardList.push({REWARD_ITEM_ID: 3700013, REWARD_ITEM_COUNT: 3});
                        rewardList.push({REWARD_ITEM_ID: DefineItem.TICKET_FAST_EQUIPMENT_MANUFACTURER, REWARD_ITEM_COUNT: 10});
                    } else if (targetList[i].CNT >= 20) {
                        rewardList.push({REWARD_ITEM_ID: 3700013, REWARD_ITEM_COUNT: 3});
                        rewardList.push({REWARD_ITEM_ID: DefineItem.TICKET_FAST_EQUIPMENT_MANUFACTURER, REWARD_ITEM_COUNT: 10});
                    } else if (targetList[i].CNT >= 10) {
                        rewardList.push({REWARD_ITEM_ID: DefineItem.TICKET_FAST_EQUIPMENT_MANUFACTURER, REWARD_ITEM_COUNT: 10});
                    }

                    dataList.push({ user: targetList[i].USER_UID, rewardList: rewardList });
                }
                callback(sErr);
            });
        },
        (callback) => {                            
            var textStr = "";
            for(let i = 0; i < dataList.length; i++){
                textStr += dataList[i].user + ", ";
                if(i < 10) console.log(JSON.stringify(dataList[i]));
            }
            fs.writeFileSync('EventMaking.txt', textStr, 'utf8');
            console.log("MaxValue : " + maxValue);
            callback(null);
        }
    ], (error) => {
        res.json(null);
        
        /*async.eachSeries(dataList, (obj, cb) => {
            if(obj.rewardList.length > 0) {
                Item.SetItemType(obj.rewardList);
                async.eachSeries(obj.rewardList, (rewardObj, ecb) => {
                    var que = DB.query("CALL IDH.INSERT_MAIL_MANAGE(?,?,?,?,?,?,?,?,?)",
                    [1, obj.user,'14', rewardObj.ITEM_TYPE, rewardObj.REWARD_ITEM_ID, rewardObj.REWARD_ITEM_COUNT, '내 영웅은 내가 만든다!','2020/01/22 00:00:00','2020/01/29 00:00:00'], (error, result) => {
                        console.log(que.sql);
                        ecb(error);
                    });
                }, (error) => {
                    cb(error);
                });
            } else {
                cb(null);
            }
        }, (error) => { 
            console.log(error);
            console.log(dataList.length);
            res.json("null");
        });*/
    });
}