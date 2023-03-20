/*
 * 쿠폰 사용 Controller
 */

exports.CompleteCoupon = (req, res) => {
    //GamePot 요청 Sample
    //http://127.0.0.1:4000/Coupon?itemId=%5B%7B%22item_id%22%3A%2257cc57e7-410e-416a-b093-a97b7c847b37%22%2C%22store_item_id%22%3A%223000002%22%2C%22count%22%3A1200%7D%5D&platform=android&projectId=541f35d1-99dc-42d0-b6f8-a01f8128775c&store=google&userData=&userId=ff1caddc-cf3c-43db-a8d9-2acf862cb912

    var purchaseObj = req.query;
    let resResult = 0;
    var resObj = {ATYPE: "001", result: resResult, REWARD: []};
    var acc = null;

    async.waterfall([
        (callback) => {
            // 쿠폰 사용 내역 저장
            DB.query("INSERT INTO `idh`.`coupon` (`USER_ID`, `PROJECT_ID`, `PLATFORM`, `STORE`, `ITEM_ID`) VALUES (?, ?, ?, ?, ?)"
            , [purchaseObj.userId, purchaseObj.projectId, purchaseObj.platform, purchaseObj.store, purchaseObj.itemId], (error, result) => {
                //console.log("Step 1");
                if(error){
                    resResult = 1;
                    callback(error);
                } else {
                    try{
                        var tempList = JSON.parse(purchaseObj.itemId);
                        for(let i = 0; i < tempList.length; i++){
                            let itemObj = {};
                            itemObj.REWARD_ITEM_ID = tempList[i].store_item_id;
                            itemObj.REWARD_ITEM_COUNT = tempList[i].count;
                            itemObj.REWARD_DESC = "쿠폰 사용 보상";
                            resObj.REWARD.push(itemObj);
                        }
                        callback(null);
                    } catch(e) {
                        resResult = 2;
                        callback(e);
                    }
                }
            });
        }, (callback) => {
            // 해당 유저 조회
            selectDB.query('SELECT * FROM ACCOUNT WHERE USER_ID = ?', [purchaseObj.userId], function (error, result) {
                if(error){
                    resResult = 1;
                    callback(error);
                } else {
                    if(result.length > 0){
                        acc = result[0];
                        callback(null);
                    } else {
                        //해당 정보 없음
                        resResult = 3;
                        callback("Can't find user");
                    }
                }
            });
        }, (callback) => {
            // 보상 지급
            if(resObj.REWARD.length > 0){
                Item.SetItemType(resObj.REWARD);
                async.eachSeries(resObj.REWARD, (item, cb) => {
                    Mail.PushMail(acc.USER_UID, 16, item.ITEM_TYPE, item.REWARD_ITEM_ID, item.REWARD_ITEM_COUNT, 0,
                        item.REWARD_DESC, CSVManager.BMailString.GetData(16).limit, (mErr, mRes) => { cb(null) });
                }, (error) => {
                    if(error){
                        resResult = 1;
                        callback(error);
                    } else {
                        callback(null);
                    }
                });
            } else {
                callback("Can't find reward");
            }
        }
    ], (error, result) => {
        if(error) {
            PrintError(error);
            res.json({ "status": 0, "message" : "Error" });
        } else {
            res.json({ "status": 1, "message" : "" });
        }
    });
}


