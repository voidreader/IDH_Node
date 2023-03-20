/**
 * 메일 Controller
 */

module.exports.PushMail = function (userUID, mailType, itemType, itemID, itemValue, itemEnchant, mailDesc, interval, cb) {
    var queryResult = null;
    async.waterfall([
        function (callback) {
            if (itemType == 99) {
                let itemCSVObj = CSVManager.BCharacter.GetData(itemID);
                // 경험치 사탕 아이템의 경우 메일 상세 내용 텍스트 추가
                if(itemCSVObj.character_type == 0)
                    mailDesc += "\n 경험치 사탕 x" + itemValue;
            }
            // 보상 지급 메일은 UID = 0 으로 INSERT
            DB.query('CALL INSERT_MAIL(?, ?, ?, ?, ?, ?, ?, ?, ?)', [0, userUID, mailType, itemType, itemID, itemValue, itemEnchant, mailDesc, interval], function (err, result) {
                if (!err) {
                    queryResult = result;
                    callback(null);
                }
                else callback(err);
            });
        }
    ], function (err, result) {
        if (cb) {
            cb(err, queryResult);
        }
    });
}

module.exports.OnPacket = function (socket) {
    // 메일 조회
    // 메일 받기
    // 메일 모두 받기
    socket.on("REQ_MAIL", function (client) {
        try {
            if (client.ATYPE !== undefined) {
                var packetType = aTypeParser(client.ATYPE);

                if (packetType.cType == "0") {
                    switch (packetType.aType) {
                        case "00": receiveMail(socket, client); break;
                        default: break;
                    }
                } else if (packetType.cType == "1") {
                    switch (packetType.aType) {
                        case "00": getMail(socket, client); break;
                        default: break;
                    }
                } else if (packetType.cType == "2") {
                    switch (packetType.aType) {
                        default: break;
                    }
                } else if (packetType.cType == "3") {
                    switch (packetType.aType) {
                        default: break;
                    }
                } else {

                }
            }
        } catch (e) { PrintError(e); }
    });
}

// 메일 조회
function getMail(socket, client) {
    console.time("ANS_MAIL_100");
    var jsonData = { result: 0 };
    var acc = socket.Session.GetAccount();
    jsonData.ATYPE = client.ATYPE;

    async.waterfall([
        (callback) => {
            DB.query("CALL SELECT_MAIL(?,?,?)", [2, acc.USER_UID, 0], (error, result) => {

                if (result[0].length > 0) {
                    async.eachSeries(result[0], (mailObj, cb) => {
                        logDB.query("CALL INSERT_MAIL_LOG(?,?,?,?,?,?,?,?,?)"
                            , [mailObj.USER_UID, mailObj.MAIL_TYPE, mailObj.ITEM_TYPE, mailObj.ITEM_ID, mailObj.ITEM_VALUE,
                            mailObj.ITEM_ENCHANT, mailObj.MAIL_DESC, mailObj.DELETE_DATE, mailObj.CREATE_DATE], (sErr, sResult) => {
                                cb(sErr);
                            });
                    }, (error) => { callback(error); });
                } else { callback(null); }
            });
        }, (callback) => {
            DB.query("CALL DELETE_MAIL(?,?,?)", [2, acc.USER_UID, 0], function (error, result) {
                callback(error);
            });
        }
    ], (error, result) => {
        if (error) {
            PrintError(error);
            jsonData.result = 1;
            socket.emit('ANS_MAIL', jsonData);
        } else {
            DB.query("CALL SELECT_MAIL(?,?,?)", [0, acc.USER_UID, 0], function (error, result) {
                console.timeEnd("ANS_MAIL_100");
                if (error) {
                    PrintError(error);
                    jsonData.result = 1;
                    socket.emit('ANS_MAIL', jsonData);
                    return;
                }
                jsonData.MAIL = result[0];
                socket.emit('ANS_MAIL', jsonData);
            });
        }
    });
}

// 메일 수령
function receiveMail(socket, client) {
    console.time("ANS_MAIL_000");
    var mail_uid = client.MAIL_UID;
    var acc = socket.Session.GetAccount();
    var jsonData = { result: 0 };
    jsonData.ATYPE = client.ATYPE;

    if (mail_uid == undefined) {
        jsonData.result = 1;
        socket.emit("ANS_MAIL", jsonData);
        return;
    }
    var asyncParam = [0, acc.USER_UID, 0];
    if (mail_uid > 0) asyncParam = [1, acc.USER_UID, mail_uid];

    var rewardList = [];
    var deleteListStr = "";

    async.waterfall([
        (callback) => {
            selectDB.query("CALL SELECT_MAIL(?,?,?)", asyncParam, (error, result) => {
                if (error) {
                    jsonData.result = 1;
                    callback(error);
                } else {
                    var mailList = result[0];
                    jsonData.REWARD = [];

                    if (mailList.length > 0) {
                        // 모두 받기에서 뽑기권 메일은 제외
                        if (mail_uid == 0) {
                            for (let i = mailList.length - 1; i > -1; i--)
                                if (mailList[i].ITEM_TYPE == 8) mailList.splice(i, 1);
                        }
                        for (let i = 0; i < mailList.length; i++) {
                            if ([0, 99, 8].indexOf(mailList[i].ITEM_TYPE) > -1) { // 장비, 캐릭터, 뽑기권  개별 관리 되는 상품
                                if(mailList[i].ITEM_TYPE == 8 && mail_uid > 0){
                                    let itemCSVData = CSVManager.BItem.data;
                                    let itemCSVObj = CSVManager.BItem.GetData(mailList[i].ITEM_ID);

                                    let obj = CSVManager.BGachaReward.GetData(itemCSVObj.options[0].TYPE);
                                    let gachaType = 0;
                                    switch(itemCSVObj.effect){
                                        case 3: gachaType = 1; break;
                                        case 4: gachaType = 2; break;
                                        case 5: gachaType = 3; break;
                                    }
                                    
                                    let count = mailList[i].ITEM_VALUE;
                                    let itemType = mailList[i].ITEM_TYPE;
                                    for(let i = 0; i < count; i++){
                                        let randomDrawObj = Gacha.StartRandomDraw(gachaType, itemCSVData, obj);
                                        rewardList.push({ ITEM_TYPE: itemType, REWARD_ITEM_ID: randomDrawObj.REWARD_ITEM_ID, REWARD_ITEM_COUNT: randomDrawObj.REWARD_ITEM_COUNT });
                                    }
                                } else if (mailList[i].ITEM_TYPE == 99) {
                                    let characterCSVObj = CSVManager.BCharacter.GetData(mailList[i].ITEM_ID);
                                    if(characterCSVObj.character_type == 0){
                                        let count = mailList[i].ITEM_VALUE;
                                        let itemType = mailList[i].ITEM_TYPE;
                                        let itemId = mailList[i].ITEM_ID;
                                        for(let i = 0; i < count; i++){
                                            rewardList.push({ ITEM_TYPE: itemType, REWARD_ITEM_ID: itemId, REWARD_ITEM_COUNT: 1 });
                                        }
                                    } else {
                                        rewardList.push({ ITEM_TYPE: mailList[i].ITEM_TYPE, REWARD_ITEM_ID: mailList[i].ITEM_ID, REWARD_ITEM_COUNT: mailList[i].ITEM_VALUE });    
                                    }

                                } else {
                                    rewardList.push({ ITEM_TYPE: mailList[i].ITEM_TYPE, REWARD_ITEM_ID: mailList[i].ITEM_ID, REWARD_ITEM_COUNT: mailList[i].ITEM_VALUE });
                                }
                            } else { // 기본 아이템, 가구 등  ID로 통합 관리 되는 상품
                                //아이템 합산 하여 reward 처리
                                var existFlag = false;
                                for (var j = 0; j < rewardList.length; j++) {
                                    if (mailList[i].ITEM_ID == rewardList[j].REWARD_ITEM_ID) {
                                        existFlag = true;
                                        rewardList[j].REWARD_ITEM_COUNT += mailList[i].ITEM_VALUE;
                                        break;
                                    }
                                }
                                if (!existFlag)
                                    rewardList.push({ ITEM_TYPE: mailList[i].ITEM_TYPE, REWARD_ITEM_ID: mailList[i].ITEM_ID, REWARD_ITEM_COUNT: mailList[i].ITEM_VALUE });
                            }
                        }

                        //뽑기권 
                        var itemCnt = 0;
                        var characCnt = 0;

                        for (let i = 0; i < rewardList.length; i++) {
                            rewardList[i].TYPE = 21;
                            switch (rewardList[i].ITEM_TYPE) {
                                case 0: itemCnt++; break;
                                case 99: characCnt++; break;
                            }
                        }
                        
                        var errorMsg = null;
                        if (itemCnt > 0) {
                            if (!common.checkItemSlot(socket, itemCnt)) {
                                jsonData.result = 3;
                                errorMsg = "Item Slot Full";
                            }
                        }

                        if (characCnt > 0) {
                            if (!common.checkCharacterSlot(socket, characCnt)) {
                                jsonData.result = 4;
                                errorMsg = "Character Slot Full";
                            }
                        }

                        if (errorMsg) callback(errorMsg);
                        else {
                            var queryStr = "INSERT INTO MAIL (USER_UID, MAIL_TYPE, ITEM_TYPE, ITEM_ID, ITEM_VALUE, ITEM_ENCHANT, MAIL_DESC, DELETE_DATE, CREATE_DATE) VALUES ";
                            var addQuery = "";
                            deleteListStr = "(";
                            async.eachSeries(mailList, (mailObj, cb) => {
                                if(addQuery != "") addQuery += ", ";
                                addQuery += "(" + mailObj.USER_UID + ", " + mailObj.MAIL_TYPE + ", " + mailObj.ITEM_TYPE + ", " + mailObj.ITEM_ID + ", " + mailObj.ITEM_VALUE
                                + ", " + mailObj.ITEM_ENCHANT + ", '" + mailObj.MAIL_DESC + "', '" + mailObj.DELETE_DATE + "', '" + mailObj.CREATE_DATE + "')";

                                if(deleteListStr != "(") deleteListStr += ", ";
                                deleteListStr += mailObj.MAIL_UID;

                                cb(null);
                            }, (error) => { 
                                queryStr += addQuery;
                                deleteListStr += ")";
                                // 메일 삭제 전 LOG DB에 내용 저장
                                logDB.query(queryStr, (sErr, sResult) => { callback(sErr); });
                            });
                        }
                    } else {
                        jsonData.result = 2;
                        callback("Empty Mail");
                    }
                }
            });
        }, (callback) => {
            // 아이템 지급 후 메일 삭제
            DB.query("DELETE FROM MAIL WHERE USER_UID = ? AND MAIL_UID IN " + deleteListStr, [acc.USER_UID], (error, result) => {
                if (error) {
                    jsonData.result = 1;
                    callback(error);
                } else {
                    Item.addRewardItem(socket, rewardList, 0, (aErr, aRes) => {
                        if (aErr) {
                            PrintError(aErr);
                            jsonData.result = 1;
                            callback(aErr);
                        } else {
                            if (aRes != undefined) {
                                aRes.REWARD = rewardList;
                            }
                            //REWARD는 보상 표현 해주기 위한 값, 획득 아이템과 획득 재화를 표현해주기 위한 배열.
                            jsonData.REWARD = aRes;
                            callback(null);
                        }
                    });
                }
            });
        }], (error, result) => {
            console.timeEnd("ANS_MAIL_000");
            if (error) {
                PrintError(error);
                socket.emit('ANS_MAIL', jsonData);
                return;
            } else {
                socket.emit("ANS_MAIL", jsonData);
            }
        });
}