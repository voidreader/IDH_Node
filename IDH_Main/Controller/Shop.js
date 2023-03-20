/**
 * 상점 Controller
 */

var shopList;
var itemSkinList;

// 서버 실행 시 상점 데이터 캐싱
exports.SetShopList = () => {
    getDefaultShopData((error, shop) => {
        if (!error) shopList = shop;
        //console.log(JSON.stringify(shop));
        getDefaultItemSkinData((error, itemSkin) => {
            if (!error) itemSkinList = itemSkin;
            //console.log(JSON.stringify(itemSkinList));
        });
    });
}

module.exports.OnPacket = function (socket) {

    socket.on("REQ_SHOP", function (client) {
        try {
            if (client.ATYPE !== undefined) {

                var packetType = aTypeParser(client.ATYPE);

                if (packetType.cType == "0") {
                    switch (packetType.aType) {
                        case "00": purchaseGoods(socket, client); break;
                        case "01": getLevelUpPackageReward(socket, client); break;
                        case "02": Shop.ProvideDailyReward(socket, client); break;
                        default: break;
                    }
                } else if (packetType.cType == "1") {
                    switch (packetType.aType) {
                        case "00": getShopList(socket, client); break;
                        case "01": getItemSkinList(socket, client); break;
                        default: break;
                    }
                } else if (packetType.cType == "2") {
                    switch (packetType.aType) {
                        case "00": break;
                        default: break;
                    }
                } else if (packetType.cType == "3") {
                    switch (packetType.aType) {
                        case "00": break;
                        default: break;
                    }
                } else {

                }
            }
        } catch (e) { PrintError(e); }
    });
}
/**
 * 
 * 상품 구매
 * shop Table insert
 * 결제 방식에 따라 다르게 구현
 * 
 * 결제 - 게임팟
 *  > 구매 제한 체크(Server) : 체크 후 response
 *  > 게임팟 구매 API 호출(Client) > 결제확인(게임팟) > Server to Server로 아이템 지급
 * 인게임 재화 결제
 *  > 구매 제한 체크 > 재화
 * 
 */

// 상점 구매 요청
// 결제 형식이 게임 내 재화(펄, 골드)인 경우와 결제 방식으로 구분
// 0 : 펄, 1 : 골드, 2 : 결제
// 펄, 골드인 경우 구매제한 체크 후 상품 지급
// 결제인 경우 구매제한 체크
function purchaseGoods(socket, client) {
    let goodsID = client.ID || 0;
    var goodsObj = null;
    var acc = socket.Session.GetAccount();
    var userGoodsObj = null;
    var shopUid = 0;

    async.series([
        (callback) => {
            // 캐싱된 상점 데이터 조회
            goodsObj = getGoods(0, goodsID);
            // 해당 유저 정보를 생성 하기 위해 Json Object 복사
            userGoodsObj = common.cloneObject(goodsObj);

            if (goodsObj.PR >= 0 || (goodsObj.hasOwnProperty("FIRST_BONUS"))) { // goodsObj.PR 구매제한 수치, FIRST_BONUS 첫 구매 보상 있는지 여부
                // 구매 제한 체크
                DB.query("CALL GET_GOODS_COUNT(?,?,?)", [userGoodsObj.TYPE, acc.USER_UID, goodsID], (error, result) => {
                    if (error) callback(error, null);
                    else {
                        // 상점 데이터 타입 - 0: Hot&New, 1: 일일 혜택 상품(월 정액), 2: 레벨업 패키지, 3: 패키지 상품, 4: 아이템 상점
                        switch (userGoodsObj.TYPE) {
                            case 0:
                            case 2:
                            case 3:
                                if (result[0][0].CNT >= goodsObj.PR) callback(2, null);
                                else {
                                    userGoodsObj.PR -= result[0][0].CNT;
                                    if (userGoodsObj.TYPE == 2)
                                        for (let i = 0; i < userGoodsObj.REWARD.length; i++)
                                            userGoodsObj.REWARD[i].REWARD = 0;
                                    callback(null, null);
                                }
                                break;
                            case 4:
                                userGoodsObj.FIRST = true;
                                if(result[0][0].CNT > 0) userGoodsObj.FIRST = false;
                                callback(null, null);
                                break;
                            case 1:
                                if (result[0][0].CNT == 0) userGoodsObj.PR = 1;
                                else if (result[0][0].CNT < goodsObj.PERIOD) userGoodsObj.PR = 0;
                                else userGoodsObj.PR = 1;

                                if (userGoodsObj.PR == 0) callback(2, null);
                                else callback(null, null);
                                break;
                        }
                    }
                });
            } else callback(null, null);
        }, (callback) => {
            // 재화 삭감(골드, 펄)
            // goodsObj.SALE_TYPE(결제 방식) - 0: 골드, 1: 펄, 3: 결제
            if ([0, 1].indexOf(goodsObj.SALE_TYPE) > -1) { // 결제 방식 골드 OR 펄
                let userItemList = socket.Session.GetItems();

                let rewardItemID = DefineItem.GOLD;
                if (goodsObj.SALE_TYPE == 0) rewardItemID = DefineItem.PEARL;

                let itemObj = common.findObjectByKey(userItemList, "ITEM_ID", rewardItemID);
                if (itemObj.ITEM_COUNT < goodsObj.PRICE) callback(2, []);
                else {
                    let rewardList = [{ REWARD_ITEM_ID: rewardItemID, REWARD_ITEM_COUNT: -goodsObj.PRICE, TYPE: 18 }];
                    Item.addRewardItem(socket, rewardList, 0, function (error, result) {
                        callback(error, result);
                    });
                }
            } else callback(3, []); // 결제 상품
        }, (callback) => {
            // 상품 구매 로그 저장
            DB.query("INSERT INTO SHOP (`ID`, `USER_UID`, `START_DATE`) VALUES (?, ?, NOW())", [goodsID, acc.USER_UID], (error, result) => {
                if (error) callback(error, null);
                else {
                    shopUid = result.insertId;
                    userGoodsObj.PR -= 1;
                    callback(null, null);
                }
            });
        }, (callback) => {
            // 상품 메일 지급
            let rewardList = [];
            for (let i = 0; i < goodsObj.REWARD.length; i++) {
                rewardList.push({ REWARD_ITEM_ID: goodsObj.REWARD[i].ID, VALUE: goodsObj.REWARD[i].VALUE });
            }
            Item.SetItemType(rewardList);
            async.eachSeries(rewardList, (item, cb) => {
                Mail.PushMail(acc.USER_UID, goodsObj.MAIL_TYPE, item.ITEM_TYPE, item.REWARD_ITEM_ID, item.VALUE, 0, goodsObj.NAME, CSVManager.BMailString.GetData(goodsObj.MAIL_TYPE).limit, (error, result) => {
                    cb(error);
                });
            }, (error) => { callback(error, null); });
        }
    ], (error, results) => {
        let ansResult = 0;
        let rewardObj = null;
        if(results[1] != null) rewardObj = results[1];
        
        if (error) {
            PrintError(error);
            if (typeof error != "number") ansResult = 1;
            else {
                ansResult = error;
                if(ansResult == 3) ansResult = 0;
            } 
        }
        socket.emit('ANS_SHOP', { 'ATYPE': client.ATYPE, 'result': ansResult, 'GOODS': userGoodsObj, 'REWARD': rewardObj });
    });
}

// 기본 상점 데이터 조건으로 검색
function getGoods(type, param) {
    var goodsObj = null;
    let compareKey = "";
    switch(type) {
        case 0: compareKey = "ID"; break;
        case 1: compareKey = "CODE"; break;
    }
    for (let i = 0; i < shopList.length; i++) {
        for (let j = 0; j < shopList[i].LIST.length; j++)
            if (shopList[i].LIST[j][compareKey] == param) {
                goodsObj = shopList[i].LIST[j];
                break;
            }
    }

    if (goodsObj == null) {
        for (let i = 0; i < itemSkinList.length; i++) {
            for (let j = 0; j < itemSkinList[i].LIST.length; j++)
                if (itemSkinList[i].LIST[j][compareKey] == param) {
                    goodsObj = itemSkinList[i].LIST[j];
                    break;
                }
        }
    }
    return goodsObj;
}

// 기본 데이터(userShopList) + 사용자(구매제한 카운트, 1회성이 아닌 월 패키지의 경우 보상 수령 카운트 계산)
function getShopList(socket, client) {
    var acc = socket.Session.GetAccount();
    var userShopList = common.cloneObject(shopList);
    async.waterfall([
        (callback) => {
            selectDB.query("CALL SELECT_SHOP(?)", [acc.USER_UID], (error, result) => {
                if (error) {
                    callback(error, null);
                } else {
                    let userShopData = result[0];
                    let userShopRewardData = result[1];
                    //console.log("상점 진입 시 " + acc.USER_NAME + "의 패키지 상품 구매 내역 체크");
                    async.eachSeries(userShopList, (shopObj, cb) => {
                        //유저가 구매한 내역과 받은 보상을 체크
                        async.eachSeries(shopObj.LIST, (goods, cb) => {
                            // 상점 타입(goods.TYPE) - 0: Hot&New, 1: 일일 혜택 상품(월 정액), 2: 레벨업 패키지, 3: 패키지 상품, 4: 아이템 상점
                            if ([0, 2, 3].indexOf(goods.TYPE) > -1) {
                                for (let i = 0; i < userShopData.length; i++) {
                                    if (goods.ID == userShopData[i].ID) {
                                        goods.PR -= 1;
                                    }
                                }
                                if (goods.TYPE == 2) {
                                    for (let j = 0; j < goods.REWARD.length; j++) goods.REWARD[j].REWARD = 0;
                                    for (let i = 0; i < userShopRewardData.length; i++) {
                                        for (let j = 0; j < goods.REWARD.length; j++) {
                                            if (goods.REWARD[j].CON == userShopRewardData[i].CONDITION) goods.REWARD[j].REWARD = 1;
                                        }
                                    }
                                }
                                //console.log("goodsID : " + goods.ID + ", goodsName : " + goods.NAME + ", goodsPR : " + goods.PR);
                                cb(null, null);
                            } else if (goods.TYPE == 1) { // 일일 혜택 상품(월 정액), 지급된 내역 조회
                                DB.query("CALL GET_GOODS_COUNT(?,?,?)", [goods.TYPE, acc.USER_UID, goods.ID], (error, result) => {
                                    if (error) cb(error, null);
                                    else {
                                        if (result[0][0].CNT != 0 && result[0][0].CNT < goods.PERIOD) {
                                            goods.PERIOD -= result[0][0].CNT;
                                            goods.PR = 0;
                                        } else {
                                            goods.PR = 1;
                                        }
                                        //console.log("goodsID : " + goods.ID + ", goodsName : " + goods.NAME + ", goodsPR : " + goods.PR);
                                        cb(null, null);
                                    }
                                });
                            } else {
                                //console.log("goodsID : " + goods.ID + ", goodsPR : " + goods.PR);
                                cb(null, null);
                            }
                        }, (error) => {
                            if (error) cb(error, null);
                            else cb(null, null);
                        });
                    }, (error) => {
                        if (error) callback(error, null);
                        else callback(null, null);
                    });
                }
            });
        }
    ], (error, result) => {
        let resResult = 0;
        if (error) {
            PrintError(error);
            resResult = 1;
        }

        socket.emit('ANS_SHOP', { 'ATYPE': client.ATYPE, 'result': resResult, SHOP: userShopList });
    });
}

// 기본 데이터(itemSkinList)  * itemSkinList는 구매제한 카운트 체크 내용이 없어 그대로 리턴
function getItemSkinList(socket, client) {
    var acc = socket.Session.GetAccount();
    var useritemSkinList = common.cloneObject(itemSkinList);
    //console.log("상점 진입 시 " + acc.USER_NAME + "의 아이템 상점 구매 내역 체크");
    selectDB.query("SELECT ID FROM SHOP WHERE USER_UID = ?", [acc.USER_UID], (error, result) => {
        let resResult = 0;
        if (error) {
            PrintError(error);
            resResult = 1;
            socket.emit('ANS_SHOP', { 'ATYPE': client.ATYPE, 'result': resResult, SHOP: useritemSkinList });
        } else {
            async.eachSeries(useritemSkinList, (shopObj, callback) => {
                async.eachSeries(shopObj.LIST, (obj, scb) => {
                    //유저가 구매한 내역과 받은 보상을 체크
                    obj.FIRST = false;
                    if(obj.SORT == 0) {
                        obj.FIRST = true;
                        for(let i = 0; i < result.length; i++){
                            if(obj.ID == result[i].ID){
                                obj.FIRST = false;
                                break;
                            }
                        }
                    } 
                    //console.log("goodsID : " + obj.ID + ", goodsName : " + obj.NAME + ", goodsFIRST : " + obj.FIRST);
                    scb(null);
                }, (error) => {
                    callback(null);
                }); 
            }, (error) => {
                socket.emit('ANS_SHOP', { 'ATYPE': client.ATYPE, 'result': resResult, SHOP: useritemSkinList });
            });
        }
    });
}

// Hot&New, 일일 혜택(월정액), 레벨업 패키지, 패키지 상품 기본 데이터
function getDefaultShopData(callback) {
    selectDB.query("CALL SELECT_SHOP_LIST()", (error, result) => {
        let tempList = [];
        if (!error) {
            tempList = result[0];
            let packageList = result[1];
            let itemSkinList = result[2];

            for (let i = 0; i < tempList.length; i++) {
                tempList[i].LIST = JSON.parse(tempList[i].LIST);
                tempList[i].STRING_ID = 0;

                for (let j = 0; j < tempList[i].LIST.length; j++) {
                    for (let k = 0; k < packageList.length; k++) {
                        if (tempList[i].LIST[j].ID == packageList[k].ID) {
                            tempList[i].LIST[j].TYPE = tempList[i].TYPE;                    // 상점 타입
                            tempList[i].LIST[j].MAIL_TYPE = tempList[i].MAIL_TYPE;          // 메일 지급 시 표기하기 위한 타입
                            tempList[i].LIST[j].NAME = packageList[k].NAME;                 // 상품 이름
                            tempList[i].LIST[j].REWARD = JSON.parse(packageList[k].LIST);   // 지급 아이템 내역
                            tempList[i].LIST[j].PERIOD = tempList[i].PERIOD;                // 판매 기간
                            tempList[i].LIST[j].STRING_ID = packageList[k].STRING_ID;       // 클라이언트가 표기를 위한 텍스트 ID
                            
                            // 지급 아이템 내역
                            for(let l = 0; l < tempList[i].LIST[j].REWARD.length; l++){
                                tempList[i].LIST[j].REWARD[l].ID = parseInt(tempList[i].LIST[j].REWARD[l].ID);          // 보상 아이템 ID
                                tempList[i].LIST[j].REWARD[l].CON = parseInt(tempList[i].LIST[j].REWARD[l].CON);        // 조건(레벨업 패키지에서만 사용)
                                tempList[i].LIST[j].REWARD[l].VALUE = parseInt(tempList[i].LIST[j].REWARD[l].VALUE);    // 보상 아이템 수량
                            }
                            break;
                        }
                    }
                    for(let l = 0; l < itemSkinList.length; l++){
                        if (tempList[i].LIST[j].ID == itemSkinList[l].REWARD_ID) {
                            tempList[i].LIST[j].PR = itemSkinList[l].PR;            // 상품 구매 제한 수치
                            tempList[i].LIST[j].VALUE = itemSkinList[l].PRICE;      // 상품 가격
                            tempList[i].LIST[j].PRICE = itemSkinList[l].PRICE;      // 상품 가격
                            tempList[i].LIST[j].SALE_TYPE = 2;                      // 결제 방식 - 0: 골드, 1: 펄, 3: 결제
                            tempList[i].LIST[j].CODE = itemSkinList[l].CODE;        // 스토어 상품 등록 코드
                            tempList[i].LIST[j].TEXTURE = itemSkinList[l].TEXTURE;  // 상품 Texture ID
                            break;
                        }
                    }
                }
            }
        }
        //for(key in tempList) console.log(JSON.stringify(tempList[key]));
        callback(error, tempList);
    });
}

// 아이템, 스킨 상점 기본 데이터
function getDefaultItemSkinData(callback) {
    selectDB.query("CALL SELECT_SHOP_LIST()", (error, result) => {
        let tempList = [];
        if (!error) {
            let packageList = result[1];
            let itemSkin = result[2];

            let itemList = [];
            let skinList = [];
            for (let i = 0; i < itemSkin.length; i++) {
                itemSkin[i].REWARD = [];
                itemSkin[i].MAIL_TYPE = 10;
                itemSkin[i].STRING_ID = 0;
                if (itemSkin[i].TYPE == 4) {
                    if (itemSkin[i].REWARD_ID > 3000000) {
                        itemSkin[i].REWARD.push({ ID: itemSkin[i].REWARD_ID, VALUE: itemSkin[i].CNT });
                    } else {
                        for (let k = 0; k < packageList.length; k++) {
                            if (itemSkin[i].REWARD_ID == packageList[k].ID) {
                                itemSkin[i].REWARD = JSON.parse(packageList[k].LIST);
                                itemSkin[i].STRING_ID = packageList[k].STRING_ID;
                                break;
                            }
                        }
                    }
                    itemList.push(itemSkin[i]);
                } else if (itemSkin[i].TYPE == 5) {
                    skinList.push(itemSkin[i]);  
                }
            }
            tempList.push(
                {
                    ID: 2000007, TYPE: 4, PRIORITY: 0, NAME: '아이템 상점',
                    LIST: itemList, START_DATE: null, END_DATE: null, BANNER: null
                }
            );
            tempList.push(
                {
                    ID: 2000008, TYPE: 5, PRIORITY: 0, NAME: '스킨 상점',
                    LIST: skinList, START_DATE: null, END_DATE: null, BANNER: null
                }
            );
        }
        //for(key in tempList) console.log(JSON.stringify(tempList[key]));
        callback(error, tempList);
    });
}

//레벨업 패키지 보상 수령
function getLevelUpPackageReward(socket, client) {

    var goodsID = client.ID || null;
    var goodsCondition = client.CON || null;

    if (goodsID == null || goodsCondition == null) {
        // Request Parameter 누락
        socket.emit('ANS_SHOP', { 'ATYPE': client.ATYPE, 'result': 2 });
        return;
    }

    var acc = socket.Session.GetAccount();
    //레벨 패키지 구매 내역, 레벨 조건 확인
    selectDB.query("SELECT * FROM SHOP WHERE USER_UID = ? AND ID = ?", [acc.USER_UID, goodsID], (error, result) => {
        if (error) cb(error, null);
        else {
            if (result.length == 0) {
                // 구매 내역 없음
                socket.emit('ANS_SHOP', { 'ATYPE': client.ATYPE, 'result': 3 });
            } else {
                let goodsObj = null;
                let rewardIndex = null;

                for (let i = 0; i < shopList.length; i++) {
                    for (let j = 0; j < shopList[i].LIST.length; j++)
                        if (shopList[i].LIST[j].ID == goodsID) goodsObj = shopList[i].LIST[j];
                }
                // 레벨업 패키지가 아님
                if (goodsObj.TYPE != 2) {
                    socket.emit('ANS_SHOP', { 'ATYPE': client.ATYPE, 'result': 4 });
                    return;
                }

                for (let i = 0; i < goodsObj.REWARD.length; i++) {
                    if (goodsObj.REWARD[i].CON == goodsCondition) {
                        rewardIndex = i;
                        break;
                    }
                }

                // 비정상 데이터
                if (rewardIndex == null) {
                    socket.emit('ANS_SHOP', { 'ATYPE': client.ATYPE, 'result': 5 });
                    return;
                }

                // 레벨 부족
                if (acc.USER_LEVEL < goodsObj.REWARD[rewardIndex].CON) {
                    socket.emit('ANS_SHOP', { 'ATYPE': client.ATYPE, 'result': 7 });
                    return;
                }

                // 보상 지급 Check
                let shopUid = result[0].UID;

                selectDB.query("SELECT * FROM SHOP_REWARD WHERE SHOP_UID = ? AND `CONDITION` = ?", [shopUid, goodsObj.REWARD[rewardIndex].CON],
                    (error, result) => {
                        if (error) {
                            PrintError(error);
                            socket.emit('ANS_SHOP', { 'ATYPE': client.ATYPE, 'result': 1 });
                        } else {
                            if (result.length > 0) {
                                //지급 완료
                                socket.emit('ANS_SHOP', { 'ATYPE': client.ATYPE, 'result': 6 });
                                return;
                            } else {
                                DB.query("INSERT INTO SHOP_REWARD (`SHOP_UID`, `ID`, `USER_UID`, `CONDITION`) VALUES (?, ?, ?, ?)",
                                    [shopUid, goodsObj.REWARD[rewardIndex].ID, acc.USER_UID, goodsObj.REWARD[rewardIndex].CON], (error, result) => {
                                        if (error) {
                                            socket.emit('ANS_SHOP', { 'ATYPE': client.ATYPE, 'result': 1 });
                                        } else {
                                            // 보상 지급
                                            let rewardList = [{ REWARD_ITEM_ID: goodsObj.REWARD[rewardIndex].ID, VALUE: goodsObj.REWARD[rewardIndex].VALUE }];

                                            Item.SetItemType(rewardList);

                                            Mail.PushMail(acc.USER_UID, goodsObj.MAIL_TYPE, rewardList[0].ITEM_TYPE, rewardList[0].REWARD_ITEM_ID, rewardList[0].VALUE, 0, goodsObj.NAME, 999, (error, result) => {
                                                if (error) {
                                                    socket.emit('ANS_SHOP', { 'ATYPE': client.ATYPE, 'result': 1 });
                                                } else {
                                                    socket.emit('ANS_SHOP', { 'ATYPE': client.ATYPE, 'result': 0, REWARD: { ID: client.ID, CON: client.CON, REWARD: 1 } });
                                                }
                                            });
                                        }
                                    });
                            }
                        }
                    });
            }
        }
    });
}

// 일일 상품(월 정액) 보상 지급
exports.ProvideDailyReward = () => {
    //일일 상품 구매 사용자 검색(금일 보상 지급 받은 사용자 제외) > 보상 지급 > 접속된 유저에게 BroadCasting
    let dailyPackage = null;
    for (let i = 0; i < shopList.length; i++)
        if (shopList[i].TYPE == 1) dailyPackage = shopList[i];
    var period = 0;

    async.eachSeries(dailyPackage.LIST, (package, callback) => {
        period = package.PERIOD;
        //전체 지급 되었는지 확인
        let que = DB.query("CALL GET_DAILY_PACKAGE_COUNT(?)", [package.ID], (error, result) => {
            logging.info(que.sql);
            if (error) callback(error);
            else {
                if (result[0].length > 0) {
                    logging.info(JSON.stringify(result[0]));
                    // 제한 체크
                    async.eachSeries(result[0], (item, cb) => {
                        if(item.CNT < period){
                            //금일 지급 되었는지 확인
                            let sque = selectDB.query("SELECT COUNT(SHOP_UID) CNT FROM SHOP_REWARD WHERE SHOP_UID = ? AND DATE(PAY_DATE) = DATE(NOW())",
                                [item.UID], (error, result) => {
                                    if (error) cb(error)
                                    else {
                                        if (result[0].CNT == 1) cb(null);
                                        else {
                                            let rewardList = [];
                                            let index = item.CNT % 7;   // 보상 아이템 7개 중 순차적으로 지급
                                            rewardList.push({ REWARD_ITEM_ID: package.REWARD[index].ID, VALUE: package.REWARD[index].VALUE });

                                            Item.SetItemType(rewardList);

                                            Mail.PushMail(item.USER_UID, package.MAIL_TYPE, rewardList[0].ITEM_TYPE, rewardList[0].REWARD_ITEM_ID, rewardList[0].VALUE, 0, package.NAME, 999, (error, result) => {
                                                let tque = DB.query("INSERT INTO SHOP_REWARD (`SHOP_UID`, `ID`, `USER_UID`, `CONDITION`) VALUES (?, ?, ?, ?)",
                                                    [item.UID, rewardList[0].REWARD_ITEM_ID, item.USER_UID, null], (error, result) => {
                                                        logging.info(tque.sql);
                                                        cb(error);
                                                    });
                                            });
                                        }
                                    }
                                });
                        } else {
                            cb(null);
                        }
                    }, (error) => { callback(error, null); });
                } else {
                    callback(null);
                }
            }
        });
    }, (error) => {
        if (error) PrintError(error);
        //console.log("finish");
    });
}

exports.CompletePurchase = (req, res) => {
    var purchaseObj = req.query;
    var resResult = 0;
    //userId=2d485044-06c2-48c4-a6ed-4ab53dea88bb&orderId={orderId}&projectId={projectId}&platform=android&productId=f1df9464-40a8-4a66-8421-196c7c661002&store=google&payment={payment}&transactionId={transactionId}&gamepotOrderId={gamepotOrderId}&uniqueId={uniqueId}
    ///Purchase?gamepotOrderId=od_9af8d985fa9e0bba4c4b38462637ae6a90421452c1a202c8&orderId=od_9af8d985fa9e0bba4c4b38462637ae6a90421452c1a202c8&payment=google&platform=android&productId=imageframe.idh.newpackage9900&projectId=541f35d1-99dc-42d0-b6f8-a01f8128775c&store=google&transactionId=GPA.3376-8256-4215-36733&uniqueId=&userId=ed08eb72-1e73-40f9-b0bb-6fe2cf28cb40
    //http://127.0.0.1:4000/Purchase?gamepotOrderId=od_9af8d985fa9e0bba4c4b38462637ae6a90421452c1a202c8&orderId=od_9af8d985fa9e0bba4c4b38462637ae6a90421452c1a202c8&payment=google&platform=android&productId=imageframe.idh.newpackage9900&projectId=541f35d1-99dc-42d0-b6f8-a01f8128775c&store=google&transactionId=GPA.3376-8256-4215-36733&uniqueId=&userId=ed08eb72-1e73-40f9-b0bb-6fe2cf28cb40
    /**
     * 1. 해당 스토어 등록 키 값에 맞는 데이터 조회 
     * 2. DB insert
     * 3. 보상 지급
     * 4. 클라이언트 응답
     * 
     * TYPE - 0 : 패키지, 1 : 월정액, 2 : 레벨업, 3 : 패키지
     */
    var shopUid = 0;
    var acc = null;
    let goodsObj = null;
    var firstFlag = false;
    var firstPurchase = false;

    // 스토어 등록 code 값으로 해당 상품 조회
    let goods = getGoods(1, purchaseObj.productId);
    //console.log(JSON.stringify(purchaseObj));
    async.series([
        (callback) => {
            // GamePot 결제 정보 저장
            DB.query("INSERT INTO `idh`.`purchase` (`USER_ID`, `ORDER_ID`, `PROJECT_ID`, `PLATFORM`, `PRODUCT_ID`, `PRICE`, `STORE`, `PAYMENT`, `TRANSACTION_ID`, `GAMEPOT_ORDER_ID`, `UNIQUE_ID`) "
            + " VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
            , [purchaseObj.userId, purchaseObj.orderId, purchaseObj.projectId, purchaseObj.platform, purchaseObj.productId, goods.PRICE
                , purchaseObj.store, purchaseObj.payment, purchaseObj.transactionId, purchaseObj.gamepotOrderId, purchaseObj.uniqueId], (error, result) => {
                callback(error, null);
            });

        }, (callback) => {
            // 유저 조회
            selectDB.query('SELECT * FROM ACCOUNT WHERE USER_ID = ?', [purchaseObj.userId], function (error, result) {
                if(error){
                    resResult = 1;
                    callback(error, null);
                } else {
                    if(result.length > 0){
                        acc = result[0];
                        callback(null, null);
                    } else {
                        //해당 정보 없음
                        resResult = 3;
                        callback("Can't find user", null);
                    }
                }
            });
        }, (callback) => {
            // 유저 첫 구매 보너스 체크
            DB.query("SELECT * FROM SHOP WHERE USER_UID = ?", [acc.USER_UID], (error, result) => {
                if (error) callback(error, null);
                else {
                    if(result.length == 0) firstPurchase = true;
                    callback(null, null);
                }
            });
        }, (callback) => {
            goodsObj = getGoods(1, purchaseObj.productId);
            //console.log("GOODSOBJ : " + JSON.stringify(goodsObj));
            if(goodsObj.hasOwnProperty("FIRST_BONUS")){ // 해당 아이템 첫 구매 보너스 체크
                DB.query("SELECT * FROM SHOP WHERE USER_UID = ? AND ID = ?", [acc.USER_UID, goodsObj.ID], (error, result) => {
                    if (error) callback(error, null);
                    else {
                        if(result.length == 0) firstFlag = true;
                        callback(null, null);
                    }
                });
            } else {
                callback(null, null);
            }
        }, (callback) => {
            if(goodsObj != null) {
                // 상품 구매 내역 저장
                DB.query("INSERT INTO SHOP (`ID`, `USER_UID`, `START_DATE`) VALUES (?, ?, NOW())", [goodsObj.ID, acc.USER_UID], (error, result) => {
                    if (error) callback(error, null);
                    else {
                        shopUid = result.insertId;
                        //userGoodsObj.PR -= 1;
                        callback(null, null);
                    }
                });
            } else {
                // 존재하지 않는 상품
                callback(3, null);
            }
        }, (callback) => {
            // 보상 지급
            if(goodsObj.TYPE != 2){
                let rewardList = [];

                if(firstPurchase) { // 첫 결제 보상 아이템 지급
                    let firstObj = CSVManager.BShopPackageInfo.GetData(2300001);
                    for (let i = 0; i < firstObj.reward.length; i++) {
                        let obj = { REWARD_ITEM_ID: firstObj.reward[i].ID, VALUE: firstObj.reward[i].VALUE, MAIL_DESC: firstObj.name };
                        rewardList.push(obj);
                    }
                }
                if (goodsObj.TYPE == 1){  //월 정액은 처음 첫번째 보상만 지급
                    let obj = { REWARD_ITEM_ID: goodsObj.REWARD[0].ID, VALUE: goodsObj.REWARD[0].VALUE, MAIL_DESC: goodsObj.NAME, FLAG: true };
                    rewardList.push(obj);
                } else { // TYPE 0, 3, 4(아이템 상점)
                    for (let i = 0; i < goodsObj.REWARD.length; i++) {
                        let obj = { REWARD_ITEM_ID: goodsObj.REWARD[i].ID, VALUE: goodsObj.REWARD[i].VALUE, MAIL_DESC: goodsObj.NAME };
                        //첫 구매 보너스 존재 하는 아이템 현재 TYPE 4 (아이템 상점)
                        if(firstFlag) {
                            obj.VALUE += goodsObj.FIRST_BONUS;
                            obj.MAIL_DESC = goodsObj.DESC;
                        } 
                        rewardList.push(obj);
                    }
                }

                if(rewardList.length > 0) {
                    Item.SetItemType(rewardList);
                    //console.log(JSON.stringify(rewardList));
                    async.eachSeries(rewardList, (item, cb) => {
                        Mail.PushMail(acc.USER_UID, goodsObj.MAIL_TYPE, item.ITEM_TYPE, item.REWARD_ITEM_ID, item.VALUE, 0, item.MAIL_DESC, CSVManager.BMailString.GetData(goodsObj.MAIL_TYPE).limit, (error, result) => {
                            if (goodsObj.TYPE == 1) {  //일일 혜택 상품만 일자 체크를 위해 로그를 쌓는다.
                                if(item.hasOwnProperty("FLAG") && item.FLAG == true) {
                                    let que = DB.query("INSERT INTO SHOP_REWARD (`SHOP_UID`, `ID`, `USER_UID`, `CONDITION`) VALUES (?, ?, ?, ?)",
                                        [shopUid, item.REWARD_ITEM_ID, acc.USER_UID, null], (error, result) => {
                                            //console.log(que.sql);
                                            cb(error);
                                        });
                                } else {
                                    cb(null);
                                }
                            } else {
                                cb(error);
                            }
                        });
                    }, (error) => { callback(error, null); });
                } else {
                    callback(null, null);
                }
            } else {
                //레벨업 패키지 - 보상 X 구입 내역만 남김
                let rewardList = [];

                if(firstPurchase) {
                    let firstObj = CSVManager.BShopPackageInfo.GetData(2300001);
                    for (let i = 0; i < firstObj.reward.length; i++) {
                        let obj = { REWARD_ITEM_ID: firstObj.reward[i].ID, VALUE: firstObj.reward[i].VALUE, MAIL_DESC: firstObj.name };
                        rewardList.push(obj);
                    }
                }
                if(rewardList.length > 0) {
                    Item.SetItemType(rewardList);
                    async.eachSeries(rewardList, (item, cb) => {
                        Mail.PushMail(acc.USER_UID, goodsObj.MAIL_TYPE, item.ITEM_TYPE, item.REWARD_ITEM_ID, item.VALUE, 0, item.MAIL_DESC, CSVManager.BMailString.GetData(goodsObj.MAIL_TYPE).limit, (error, result) => {
                            if (goodsObj.TYPE == 1) {  //일일 혜택 상품만 일자 체크를 위해 로그를 쌓는다.
                                let que = DB.query("INSERT INTO SHOP_REWARD (`SHOP_UID`, `ID`, `USER_UID`, `CONDITION`) VALUES (?, ?, ?, ?)",
                                    [shopUid, item.REWARD_ITEM_ID, acc.USER_UID, null], (error, result) => {
                                        cb(error);
                                    });
                            } else {
                                cb(error);
                            }
                        });
                    }, (error) => { callback(error, null); });
                } else {
                    callback(null, null);
                }
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