/**
 * 아이템 Controller
 */

// 골드, 캐쉬 수량 업데이트
exports.UpdateMoney = function (socket, desc, type, price, cb) {
    var acc = socket.Session.GetAccount();
    var userItemList = socket.Session.GetItems();

    var queryStr = "";
    var targetObj = null;
    var itemId = 0;
    if (type == "gold") {
        queryStr = "CALL UPDATE_GOLD(?,?,?,?)";
        for (var i = 0; i < userItemList.length; i++) {
            if (userItemList[i].ITEM_ID == DefineItem.GOLD) {
                targetObj = {};
                targetObj.ITEM_UID = userItemList[i].ITEM_UID;
                itemId = userItemList[i].ITEM_ID;
            }
        }
    } else {
        queryStr = "CALL UPDATE_CASH(?,?,?,?)";
        for (var i = 0; i < userItemList.length; i++) {
            if (userItemList[i].ITEM_ID == DefineItem.PEARL) {
                targetObj = {};
                targetObj.ITEM_UID = userItemList[i].ITEM_UID;
                itemId = userItemList[i].ITEM_ID;
            }
        }
    }

    if (targetObj == null) {
        cb("Not found item", null);
        return;
    }

    DB.query(queryStr, [acc.USER_UID, targetObj.ITEM_UID, price, desc], function (error, result) {
        if (!error) {
            for (var i = 0; i < userItemList.length; i++) {
                if (userItemList[i].ITEM_UID == targetObj.ITEM_UID) {
                    userItemList[i].ITEM_COUNT += price;
                    break;
                }
            }
            logDB.query("CALL INSERT_ITEM_LOG(?,?,?,?)", [acc.USER_UID, itemId, price, desc], function (error, res) {
                cb(error, result[0]);
            });
        } else {
            cb(error, null);
        }
    });
}

// 아이템 별 타입 설정
exports.SetItemType = function (rewardList) {
    if (rewardList.length > 0) {
        for (let i = 0; i < rewardList.length; i++) {
            if (rewardList[i].hasOwnProperty("REWARD_ITEM_ID") && rewardList[i].REWARD_ITEM_ID != null) {
                if (rewardList[i].REWARD_ITEM_ID.toString().substr(0, 1) == 1) rewardList[i].ITEM_TYPE = 99;
                else rewardList[i].ITEM_TYPE = CSVManager.BItem.GetInventoryType(rewardList[i].REWARD_ITEM_ID);
            }
        }
    }
}

// 캐릭터, 아이템 지급
exports.addRewardItem = function (socket, rewardList, type, callback) {
	/* item_type
	0 - 장비
	1 - 코인 O
	2 - 머니 O
	3 - 캐쉬 O
    5 - 가구
    99 - 캐릭터
    type - 0 일반, 1 가챠 (사용 안함)
	중첩가능한 타입(1,2,3,5)만 보상 아이템과 합산 아이템 카운트가 필요.
	*/
    var acc = socket.Session.GetAccount();
    var userItemList = socket.Session.GetItems();
    var userCharacters = socket.Session.GetCharacters();
    var resObj = { REWARD: [], CHA_LIST: [], ITEM_LIST: [] };

    // 아이템 타입 설정
    Item.SetItemType(rewardList);

    var chaFlag = false;
    var furnFlag = false;
    async.eachSeries(rewardList, function (rewardObj, cb) {
        switch (rewardObj.ITEM_TYPE) {
            case 99:
                chaFlag = true;

                let grade = CSVManager.BCharacter.GetData(rewardObj.REWARD_ITEM_ID).grade;

                DB.query("CALL INSERT_CHARACTER(?,?,?,?)", [acc.USER_UID, rewardObj.REWARD_ITEM_ID, Character.getCharacterExp(rewardObj.REWARD_ITEM_ID), grade], function (cErr, cRes) {

                    if (cErr) {
                        cb(cErr);
                        return;
                    }
                    // 도감 데이터 저장
                    Book.saveBook(rewardObj.ITEM_TYPE, acc.USER_UID, [rewardObj]);

                    userCharacters.push(cRes[0][0]);
                    resObj.REWARD.push(rewardObj);
                    resObj.CHA_LIST.push(cRes[0][0]);
                    cb(null);
                });
                break;
            case 5:
                furnFlag = true;
                var targetObj = null;
                for (var i = 0; i < userItemList.length; i++) {
                    if (userItemList[i].ITEM_ID == rewardObj.REWARD_ITEM_ID)
                        targetObj = userItemList[i];
                }
                // 도감 데이터 저장
                Book.saveBook(rewardObj.ITEM_TYPE, acc.USER_UID, [rewardObj]);
                if (targetObj != null) {
                    DB.query("CALL UPDATE_ITEM(?,?,?,?,?,?,?)", [0, acc.USER_UID, targetObj.ITEM_UID, rewardObj.REWARD_ITEM_COUNT, null, null, null], function (cErr, cRes) {
                        if (cErr) {
                            cb(cErr);
                            return;
                        }
                        var itemObj = null;
                        for (var i = 0; i < userItemList.length; i++) {
                            if (userItemList[i].ITEM_UID == cRes[0][0].ITEM_UID) {
                                userItemList[i].ITEM_COUNT += rewardObj.REWARD_ITEM_COUNT;
                                itemObj = userItemList[i];
                            }
                        }

                        resObj.REWARD.push(rewardObj);
                        resObj.ITEM_LIST.push(itemObj);
                        cb(null);
                    });
                } else {
                    DB.query("CALL INSERT_ITEM(?,?,?,?,?,?,?)", [0, acc.USER_UID, rewardObj.REWARD_ITEM_ID, rewardObj.REWARD_ITEM_COUNT, null, null, 0], function (cErr, cRes) {
                        if (cErr) {
                            cb(cErr);
                            return;
                        }
                        cRes[0][0].MYROOM_ITEM_COUNT = 0;

                        userItemList.push(cRes[0][0]);
                        resObj.REWARD.push(rewardObj);
                        resObj.ITEM_LIST.push(cRes[0][0]);
                        cb(null);
                    });
                }
                break;
            case 3:
                cashFlag = true;
                var targetObj = null;
                for (var i = 0; i < userItemList.length; i++) {
                    if (userItemList[i].ITEM_ID == rewardObj.REWARD_ITEM_ID)
                        targetObj = userItemList[i];
                }
                if(rewardObj.TYPE == undefined)
                    rewardObj.TYPE = 0;

                if (targetObj != null) {
                    DB.query("CALL UPDATE_CASH(?,?,?,?)", [acc.USER_UID, targetObj.ITEM_UID, rewardObj.REWARD_ITEM_COUNT, rewardObj.TYPE], function (error, result) {
                        if (!error) {
                            for (var i = 0; i < userItemList.length; i++) {
                                if (userItemList[i].ITEM_UID == targetObj.ITEM_UID) {
                                    userItemList[i].ITEM_COUNT += rewardObj.REWARD_ITEM_COUNT;
                                    break;
                                }
                            }
                            resObj.REWARD.push(rewardObj);
                            resObj.ITEM_LIST.push(result[0][0]);
                            // 캐쉬 사용 로그 저장
                            logDB.query("CALL INSERT_ITEM_LOG(?,?,?,?)", [acc.USER_UID, rewardObj.REWARD_ITEM_ID, rewardObj.REWARD_ITEM_COUNT, rewardObj.TYPE], function (error, result) {
                                cb(error);
                            });
                        } else {
                            cb(error);
                            return;
                        }
                    });
                } else {
                    DB.query("CALL INSERT_ITEM(?,?,?,?,?,?,?)", [0, acc.USER_UID, rewardObj.REWARD_ITEM_ID, rewardObj.REWARD_ITEM_COUNT, null, null, 0], function (cErr, cRes) {
                        if (cErr) {
                            cb(cErr);
                            return;
                        }
                        userItemList.push(cRes[0][0]);
                        resObj.REWARD.push(rewardObj);
                        resObj.ITEM_LIST.push(cRes[0][0]);
                        // 캐쉬 사용 로그 저장
                        logDB.query("CALL INSERT_ITEM_LOG(?,?,?,?)", [acc.USER_UID, rewardObj.REWARD_ITEM_ID, rewardObj.REWARD_ITEM_COUNT, rewardObj.TYPE], function (error, res) {
                            cb(error);
                        });
                    });
                }
                break;
            case 2:
                moneyFlag = rewardObj.REWARD_ITEM_COUNT;
                var targetObj = null;
                for (var i = 0; i < userItemList.length; i++) {
                    if (userItemList[i].ITEM_ID == rewardObj.REWARD_ITEM_ID)
                        targetObj = userItemList[i];
                }

                if(rewardObj.TYPE == undefined)
                    rewardObj.TYPE = 0;
                if (targetObj != null) {
                    DB.query("CALL UPDATE_GOLD(?,?,?,?)", [acc.USER_UID, targetObj.ITEM_UID, rewardObj.REWARD_ITEM_COUNT, rewardObj.TYPE], function (error, result) {
                        if (!error) {
                            for (var i = 0; i < userItemList.length; i++) {
                                if (userItemList[i].ITEM_UID == targetObj.ITEM_UID) {
                                    userItemList[i].ITEM_COUNT += rewardObj.REWARD_ITEM_COUNT;
                                    break;
                                }
                            }
                            resObj.REWARD.push(rewardObj);
                            resObj.ITEM_LIST.push(result[0][0]);
                            // 골드 사용 로그 저장
                            logDB.query("CALL INSERT_ITEM_LOG(?,?,?,?)", [acc.USER_UID, rewardObj.REWARD_ITEM_ID, rewardObj.REWARD_ITEM_COUNT, rewardObj.TYPE], function (error, res) {
                                cb(error);
                            });
                        } else {
                            cb(error);
                            return;
                        }
                    });
                } else {
                    DB.query("CALL INSERT_ITEM(?,?,?,?,?,?,?)", [0, acc.USER_UID, rewardObj.REWARD_ITEM_ID, rewardObj.REWARD_ITEM_COUNT, null, null, 0], function (cErr, cRes) {
                        if (cErr) {
                            cb(cErr);
                            return;
                        }
                        userItemList.push(cRes[0][0]);
                        resObj.REWARD.push(rewardObj);
                        resObj.ITEM_LIST.push(cRes[0][0]);
                        // 골드 사용 로그 저장
                        logDB.query("CALL INSERT_ITEM_LOG(?,?,?,?)", [acc.USER_UID, rewardObj.REWARD_ITEM_ID, rewardObj.REWARD_ITEM_COUNT, rewardObj.TYPE], function (error, res) {
                            cb(error);
                        });
                    });
                }
                break;
            case 1:
                coinFlag = true;
                var targetObj = null;
                for (var i = 0; i < userItemList.length; i++) {
                    if (userItemList[i].ITEM_ID == rewardObj.REWARD_ITEM_ID)
                        targetObj = userItemList[i];
                }
                if(rewardObj.TYPE == undefined) rewardObj.TYPE = 0;

                if (targetObj != null) {
                    let queryType = 0;
                    if(rewardObj.REWARD_ITEM_ID == 3000012 && targetObj.ITEM_COUNT < acc.MILEAGE)
                        queryType = 5;

                    if(rewardObj.REWARD_ITEM_ID == 3000011) {
                        if(targetObj.ITEM_COUNT < CSVManager.BPvPCommon.GetData('pvp_limit'))
                            queryType = 5;
                    }

                    DB.query("CALL UPDATE_ITEM(?,?,?,?,?,?,?)", [queryType, acc.USER_UID, targetObj.ITEM_UID, rewardObj.REWARD_ITEM_COUNT, null, null, null], function (cErr, cRes) {
                        if (cErr) {
                            cb(cErr);
                            return;
                        }
                        for (var i = 0; i < userItemList.length; i++) {
                            if (userItemList[i].ITEM_UID == targetObj.ITEM_UID) {
                                userItemList[i].ITEM_COUNT += rewardObj.REWARD_ITEM_COUNT;
                            }
                        }

                        resObj.REWARD.push(rewardObj);
                        resObj.ITEM_LIST.push(cRes[0][0]);
                        // 각종 재화 사용 로그 저장
                        logDB.query("CALL INSERT_ITEM_LOG(?,?,?,?)", [acc.USER_UID, rewardObj.REWARD_ITEM_ID, rewardObj.REWARD_ITEM_COUNT, rewardObj.TYPE], function (error, res) {
                            cb(error);
                        });
                    });

                } else {
                    DB.query("CALL INSERT_ITEM(?,?,?,?,?,?,?)", [0, acc.USER_UID, rewardObj.REWARD_ITEM_ID, rewardObj.REWARD_ITEM_COUNT, null, null, 0], function (cErr, cRes) {
                        if (cErr) {
                            cb(cErr);
                            return;
                        }
                        userItemList.push(cRes[0][0]);
                        resObj.REWARD.push(rewardObj);
                        resObj.ITEM_LIST.push(cRes[0][0]);
                        // 각종 재화 사용 로그 저장
                        logDB.query("CALL INSERT_ITEM_LOG(?,?,?,?)", [acc.USER_UID, rewardObj.REWARD_ITEM_ID, rewardObj.REWARD_ITEM_COUNT, rewardObj.TYPE], function (error, res) {
                            cb(error);
                        });
                    });
                }
                break;
            case 0:
                itemFlag = true;
                // 도감 데이터 저장
                Book.saveBook(rewardObj.ITEM_TYPE, acc.USER_UID, [rewardObj]);

                // 아이템 접두사 및 옵션 값 셋팅
                addItemPrefixAndOption(rewardObj, function (prefix, options) {

                    let grade = CSVManager.BItem.GetData(rewardObj.REWARD_ITEM_ID).grade;

                    DB.query("CALL INSERT_ITEM(?,?,?,?,?,?,?)", [1, acc.USER_UID, rewardObj.REWARD_ITEM_ID, 1, prefix, options, grade], function (cErr, cRes) {
                        if (cErr) {
                            cb(cErr);
                            return;
                        }
                        Item.itemParseJson(cRes[0][0]);
                        userItemList.push(cRes[0][0]);
                        
                        rewardObj.PREFIX = cRes[0][0].PREFIX;
                        rewardObj.OPTIONS = cRes[0][0].OPTIONS;
                        
                        let tempObj = null;
                        if (rewardObj.GRADE == 10) tempObj = { UN: acc.USER_NAME, GRADE: rewardObj.GRADE, NAME: rewardObj.NAME };
                        
                        if (tempObj != null) {
                            let chaObj = common.findObjectByKey(userCharacters, "CHA_UID", acc.DELEGATE_ICON);
                            if (chaObj != null) tempObj.UDI = chaObj.CHA_ID;
                            tempObj.NAME = CSVManager.BRuleItemEffect.GetData(rewardObj.PREFIX.ID).name + " " + tempObj.NAME;
                            Chatting.SendRareItemAcquisitionMessage(socket, [tempObj]);
                        }

                        resObj.REWARD.push(rewardObj);
                        resObj.ITEM_LIST.push(cRes[0][0]);
                        cb(null);
                    });
                });
                break;
            default: cb(null); break;
        }
    }, function (error) {
        if (error) {
            PrintError(error);
        }

        //check item
        if (furnFlag) {
            var cnt = 0;
            var sort = [];
            for (var i = 0; i < userItemList.length; i++) {
                if (userItemList[i].ITEM_ID != undefined) {
                    if (userItemList[i].ITEM_ID.toString().substr(0, 2) == 36) {
                        cnt++;

                        var effect = CSVManager.BItem.GetEffect(userItemList[i].ITEM_ID);
                        if (sort.indexOf(effect) < 0) sort.push(effect);
                    }
                }
            }
            // 가구 관련 미션
            Mission.addMission(acc.USER_UID, 8000038, cnt);
            Mission.addMission(acc.USER_UID, 8000039, sort.length);
        }
        // 캐릭터 관련 미션
        if (chaFlag) Mission.addMission(acc.USER_UID, 8000042, userCharacters.length);

        callback(error, resObj);
    });
}

// 캐릭터, 아이템 지급(속도 개선을 위해 List형태로 지급 되는 보상)
exports.savedRewardListByType = function (socket, type, rewardList, callback) {
	/* type
	0 - 장비
	1 - 코인 O
	2 - 머니 O
	3 - 캐쉬 O
    5 - 가구
    99 - 캐릭터
	중첩가능한 타입(1,2,3,5)만 보상 아이템과 합산 아이템 카운트가 필요.
	*/
    var acc = socket.Session.GetAccount();
    var resObj = { REWARD: [], CHA_LIST: [], ITEM_LIST: [] };
    var funitureTempList = [];

    var nextUidSearchQuery = "SELECT IFNULL(MAX(ITEM_UID), 0) + 1 NEXT_UID FROM ITEM WHERE USER_UID = ?";
    var insertQuery = "INSERT INTO ITEM (ITEM_UID, USER_UID, ITEM_ID, ITEM_COUNT, PREFIX, OPTIONS) VALUES ";
    var addQuery = "";

    var userItemList = [];
    var userCharacters = [];
    
    if(type == 99) {
        nextUidSearchQuery = "SELECT IFNULL(MAX(CHA_UID), 0) + 1 NEXT_UID FROM CHARAC WHERE USER_UID = ?";
        insertQuery = "INSERT INTO CHARAC (CHA_UID, USER_UID, CHA_ID, `EXP`) VALUES ";
    } else if (type == 5) {
        insertQuery = "INSERT INTO ITEM (ITEM_UID, USER_UID, ITEM_ID, ITEM_COUNT) VALUES ";
    }

    if([0, 5].indexOf(type) > -1) userItemList = socket.Session.GetItems();
    else userCharacters = socket.Session.GetCharacters();
    
    async.waterfall([
        (wcb) => {
            // type 별 해당 max count 조회
            selectDB.query(nextUidSearchQuery, [acc.USER_UID], (error, result) => {
                if(error){
                    wcb(1, null);
                } else {
                    if(result.length > 0) wcb(null, result[0].NEXT_UID);
                    else wcb(2, null);
                }
            });
        }, (next_uid, wcb) => {
            if(type == 0) {
                async.eachSeries(rewardList, function (rewardObj, cb) {
                    addItemPrefixAndOption(rewardObj, function (prefix, options) {
                        rewardObj.PREFIX = prefix;
                        rewardObj.OPTIONS = options;
                        cb(null);
                    });
                }, (error) => {
                    wcb(null, next_uid);
                });        
            } else if(type == 5) {
                let tempList = [];
                funitureTempList = common.cloneObject(rewardList);
                for(let i = 0; i < rewardList.length; i++){
                    let flag = false;
                    for(let j = 0; j < tempList.length; j++){
                        if(rewardList[i].REWARD_ITEM_ID == tempList[j].REWARD_ITEM_ID){
                            tempList[j].REWARD_ITEM_COUNT += rewardList[i].REWARD_ITEM_COUNT;
                            flag = true;
                            break;
                        }
                    }
                    if(!flag) tempList.push(rewardList[i]);
                }
                rewardList = tempList;
                wcb(null, next_uid);
            } else {
                wcb(null, next_uid);
            }
        }, (next_uid, wcb) => {
            // 쿼리 생성

            async.eachSeries(rewardList, function (rewardObj, cb) {
                if(addQuery != "") addQuery += ", ";
                rewardObj.UID = next_uid;

                switch(type) {
                    case 99:
                        rewardObj.EXP = Character.getCharacterExp(rewardObj.REWARD_ITEM_ID);
                        addQuery += "(" + rewardObj.UID + ", " + acc.USER_UID + ", " + rewardObj.REWARD_ITEM_ID + ", " + rewardObj.EXP + ")";
                        next_uid++;
                        break;
                    case 0:
                        addQuery += "(" + rewardObj.UID + ", " + acc.USER_UID + ", " + rewardObj.REWARD_ITEM_ID + ", " + 1 + ", '" + rewardObj.PREFIX + "', '" + rewardObj.OPTIONS + "')";
                        next_uid++;
                        break;
                    case 5:
                        let itemObj = common.findObjectByKey(userItemList, "ITEM_ID", rewardObj.REWARD_ITEM_ID);
                        let updateCnt = 1;
                        if(itemObj !== null) {
                            rewardObj.UID = itemObj.ITEM_UID;
                            updateCnt += itemObj.ITEM_COUNT;
                        } else {
                            next_uid++;
                        }
                        addQuery += "(" + rewardObj.UID + ", " + acc.USER_UID + ", " + rewardObj.REWARD_ITEM_ID + ", " + updateCnt + ")";
                        break;
                    }
                    
                    cb(null);
            }, (error) => {
                let queryStr = insertQuery + addQuery;
                if(type == 5) queryStr += " ON DUPLICATE KEY UPDATE ITEM_COUNT = VALUES(ITEM_COUNT)";
                let que = DB.query(queryStr, (error, result) => {
                    wcb(error);
                });
            });
        }, (wcb) => {
            var now = new Date().format("yyyy-MM-dd HH:mm:ss");
            // 도감 데이터 저장
            Book.saveBook(type, acc.USER_UID, rewardList);
            if(type == 99) {
                for(let i = 0; i < rewardList.length; i++){
                    rewardList[i].ITEM_TYPE = type;
                    //rewardList[i].CREATE_DATE = now;
                    let cacheObj = { CHA_UID: rewardList[i].UID, CHA_ID: rewardList[i].REWARD_ITEM_ID, EXP: rewardList[i].EXP, ENCHANT: 0, 
                        DISPATCH: 0, FARMING_ID: 0, TEAM: 0, MYROOM_ID: 0, CREATE_DATE: now };
                    userCharacters.push(cacheObj);
                    resObj.REWARD.push(rewardList[i]);
                    resObj.CHA_LIST.push(cacheObj);
                }
            } else if(type == 5) {
                for(let i = 0; i < rewardList.length; i++){
                    let itemObj = null;
                    for (var j = 0; j < userItemList.length; j++) {
                        if (userItemList[j].ITEM_UID == rewardList[i].UID) {
                            userItemList[j].ITEM_COUNT += rewardList[i].REWARD_ITEM_COUNT;
                            itemObj = userItemList[j];
                            flag = true;
                            break;
                        }
                    }

                    if(itemObj != null){
                        resObj.ITEM_LIST.push(itemObj);
                    } else {
                        let funitureObj = { ITEM_UID: rewardList[i].UID, CHA_UID: 0, ITEM_ID: rewardList[i].REWARD_ITEM_ID, EXP: 0, 
                            ENCHANT: 0, ITEM_COUNT: 1, PREFIX: null, OPTIONS: null, CREATE_DATE: now, MYROOM_ITEM_COUNT: 0};
                        userItemList.push(funitureObj);
                        resObj.ITEM_LIST.push(funitureObj);
                    }
                }
                for(let j = 0; j < funitureTempList.length; j++){
                    funitureTempList[j].ITEM_TYPE = type;
                    resObj.REWARD.push(funitureTempList[j]);
                }

            } else if(type == 0) {
                let userCharacters = socket.Session.GetCharacters();
                for(let i = 0; i < rewardList.length; i++){
                    rewardList[i].ITEM_TYPE = type;
                    rewardList[i].MYROOM_ITEM_COUNT = 0;

                    Item.itemParseJson(rewardList[i]);

                    let cacheObj = { ITEM_UID: rewardList[i].UID, CHA_UID: 0, ITEM_ID: rewardList[i].REWARD_ITEM_ID, EXP: 0, ENCHANT: 0, 
                        ITEM_COUNT: 1, PREFIX: rewardList[i].PREFIX, OPTIONS: rewardList[i].OPTIONS, CREATE_DATE: now, MYROOM_ITEM_COUNT: 0};

                    userItemList.push(cacheObj);
                    
                    let tempObj = null;
                    if (rewardList[i].GRADE == 10) tempObj = { UN: acc.USER_NAME, GRADE: rewardList[i].GRADE, NAME: rewardList[i].NAME };
                    
                    if (tempObj != null) {
                        let chaObj = common.findObjectByKey(userCharacters, "CHA_UID", acc.DELEGATE_ICON);
                        if (chaObj != null) tempObj.UDI = chaObj.CHA_ID;
                        tempObj.NAME = CSVManager.BRuleItemEffect.GetData(rewardList[i].PREFIX.ID).name + " " + tempObj.NAME;
                        Chatting.SendRareItemAcquisitionMessage(socket, [tempObj]);
                    }
                    resObj.REWARD.push(rewardList[i]);
                    resObj.ITEM_LIST.push(cacheObj);
                }
            }
            wcb(null);
        }, (wcb) => {
            // 일별 생성된 캐릭터, 아이템 등급별 카운트 저장
            if ([99,0].indexOf(type) > -1) {
                async.eachSeries(rewardList, function (rewardObj, cb) {
                    let grade = 0;
                    if(type == 99) grade = CSVManager.BCharacter.GetData(rewardObj.REWARD_ITEM_ID).grade;
                    else grade = CSVManager.BItem.GetData(rewardObj.REWARD_ITEM_ID).grade;
                    DB.query("CALL ADD_CARD_COUNT(?, ?)", [type, grade], (error, result) => {
                        cb(error);
                    });
                }, (error) => {
                    wcb(error);
                });
            } else {
                wcb(null);
            }
        }
    ], (error) => {
        if (type == 99) {
            // 캐릭터 관련 미션
            Mission.addMission(acc.USER_UID, 8000042, userCharacters.length);
        } else if (type == 5) {
            var cnt = 0;
            var sort = [];
            for (var i = 0; i < userItemList.length; i++) {
                if (userItemList[i].ITEM_ID != undefined) {
                    if (userItemList[i].ITEM_ID.toString().substr(0, 2) == 36) {
                        cnt++;

                        var effect = CSVManager.BItem.GetEffect(userItemList[i].ITEM_ID);
                        if (sort.indexOf(effect) < 0) sort.push(effect);
                    }
                }
            }
            // 가구 관련 미션
            Mission.addMission(acc.USER_UID, 8000038, cnt);
            Mission.addMission(acc.USER_UID, 8000039, sort.length);
        }
        callback(error, resObj);
    });
}

// Database에서 조회한 아이템 접두사, 옵션 정보 JSON.parsing
exports.itemParseJson = function (obj) {
    try {
        if (obj.PREFIX != null) {
            obj.PREFIX = JSON.parse(obj.PREFIX);
            obj.PREFIX.VALUE = parseFloat(obj.PREFIX.VALUE);
        }
        if (obj.OPTIONS != null) {
            obj.OPTIONS = JSON.parse(obj.OPTIONS);
            for (var i = 0; i < obj.OPTIONS.length; i++) {
                if (typeof obj.OPTIONS[i].VALUE == "string") {
                    obj.OPTIONS[i].VALUE = parseFloat(obj.OPTIONS[i].VALUE);
                }
            }
        }
    } catch (e) {
        PrintError(e);
    }
}

// 아이템 획득 시 접두사, 옵션 결정
function addItemPrefixAndOption(rewardObj, callback) {
    var itemObj = CSVManager.BItem.GetData(rewardObj.REWARD_ITEM_ID);
    let pickName = getRandomOption(itemObj.prefix_type);
    let prefix = getRandomOptionValue(pickName);

    //옵션 추가(접두사랑 동일한 방식)
    let options = [];
    for (let i = 0; i < itemObj.options.length; i++) {
        let obj = { ID: 0, VALUE: 0 };
        if (itemObj.options[i].ID > 0) {
            if (itemObj.options[i].TYPE == 2) {
                obj.ID = itemObj.options[i].ID;
                obj.VALUE = getRandomOptionValue(itemObj.options[i].ID).VALUE;
            } else {
                let pickName = getRandomOption(itemObj.options[i].ID);
                obj = getRandomOptionValue(pickName);
            }
        }
        options.push(obj);
    }
    callback(JSON.stringify(prefix), JSON.stringify(options));
}

// 아이템 접두사 셋팅
function getRandomOption(prefixType) {
    let ruleItemEffectGroup = CSVManager.BRuleItemEffect.GetGroupData(prefixType);

    let pickName = "";
    let probList = [];
    let probabilitySum = 0;
    let period = [0];
    let pickItemIndex = null;

    for (let i = 0; i < ruleItemEffectGroup.length; i++) {
        probList.push(ruleItemEffectGroup[i].id);
        probabilitySum += ruleItemEffectGroup[i].pick_probability;
        period.push(probabilitySum);
    }

    let random = Math.floor(Math.random() * probabilitySum);

    for (let j = 0; j < period.length; j++) {
        if (period[j] <= random && random < period[j + 1]) {
            pickItemIndex = j;
            break;
        }
    }
    pickName = probList[pickItemIndex];
    return pickName;
}

// 아이템 옵션 값 셋팅
function getRandomOptionValue(id) {
    let ruleItemEffect = CSVManager.BRuleItemEffect.GetData(id);
    let probList = [];
    let probabilitySum = 0;
    let period = [0];
    let pickItemIndex = null;

    for (key in ruleItemEffect) {
        if (key != "pick_probability" && key.indexOf("probability") > -1) {
            probList.push(key.replace("_probability", ""));
            probabilitySum += ruleItemEffect[key];
            period.push(probabilitySum);
        }
    }
    let random = Math.floor(Math.random() * probabilitySum);

    for (let j = 0; j < period.length; j++) {
        if (period[j] <= random && random < period[j + 1]) {
            pickItemIndex = j;
            break;
        }
    }
    let pickName = probList[pickItemIndex];
    let option = { ID: ruleItemEffect.id, VALUE: 0 };

    option.VALUE = Utils.Random(ruleItemEffect[pickName + "_min"], ruleItemEffect[pickName + "_max"]);

    return option;
}

// 아이템 버프 계산
exports.GetItemBuff = (socket, teamID) => {
    let userTeamList = socket.Session.GetTeam();
    let userCharacter = socket.Session.GetCharacters();
    let userItemList = socket.Session.GetItems();

    let goldBuffTotal = 0;
    for (let i = 0; i < userTeamList.length; i++) {
        if (userTeamList[i].TEAM == teamID) {
            let obj = common.findObjectByKey(userCharacter, "CHA_UID", userTeamList[i].CHA_UID);
            for (let j = 0; j < userItemList.length; j++) {
                if (userItemList[j].CHA_UID == obj.CHA_UID) {
                    if (userItemList[j].PREFIX.hasOwnProperty("ID") && userItemList[j].PREFIX.ID == 1) {
                        userItemList[j].PREFIX.VALUE = parseFloat(userItemList[j].PREFIX.VALUE);
                        let prefixEnchant = CSVManager.BItemStrenghten.GetData("prefix_enchant");
                        let buff = (userItemList[j].PREFIX.VALUE * parseFloat(Math.pow(prefixEnchant, userItemList[j].ENCHANT))) / 100;
                        goldBuffTotal += buff;
                    }
                }
            }
        }
    }
    return parseFloat(goldBuffTotal.toFixed(2));
}


module.exports.OnPacket = function (socket) {

    socket.on("REQ_ITEM", function (client) {
        try {
            if (client.ATYPE !== undefined) {
                var packetType = aTypeParser(client.ATYPE);

                if (packetType.cType == "0") {
                    switch (packetType.aType) {
                        case "00": Item.GetItemBuff(); break;
                        default: break;
                    }
                } else if (packetType.cType == "1") {
                    switch (packetType.aType) {
                        default: break;
                    }
                } else if (packetType.cType == "2") {
                    switch (packetType.aType) {
                        case "00": addPeriodItem(socket, client); break;
                        case "01": equipItem(socket, client); break;
                        case "02": changeEquipItem(socket, client); break;
                        case "03": unequipItem(socket, client); break;
                        case "04": addExp(socket, client); break;
                        case "05": setEnchant(socket, client); break;
                        default: break;
                    }
                } else if (packetType.cType == "3") {
                    switch (packetType.aType) {
                        case "00": saleItem(socket, client); break;
                        default: break;
                    }
                } else {

                }
            }
        } catch (e) { PrintError(e); }
    });
};

// 주기적으로 추가 되는 아이템
function addPeriodItem(socket, client) {
    console.time("ANS_ITEM_200");
    var acc = socket.Session.GetAccount();
    var itemId = client.ITEM_ID;
    var jsonData = { result: 0 };
    jsonData.ATYPE = client.ATYPE;

    if (itemId == undefined) {
        jsonData.result = 1;
        socket.emit('ANS_ITEM', jsonData);
        return;
    }

    var limit = 0;
    var add_time = 0;

    switch (itemId) {
        case DefineItem.TICKET_PVP: //PVP 티켓
            limit = CSVManager.BPvPCommon.GetData("pvp_limit");
            add_time = CSVManager.BPvPCommon.GetData("pvp_add_time");
            break;
        case DefineItem.BEHAVIOR: //행동력
            limit = acc.MILEAGE;
            add_time = CSVManager.BStaminaCommon.GetData("acting_add_time");
            break;
    }


    var userItems = socket.Session.GetItems();
    let item = common.findObjectByKey(userItems, "ITEM_ID", DefineItem.BEHAVIOR);
    if (itemId == DefineItem.BEHAVIOR && item.ITEM_COUNT > limit) {
        jsonData.ITEM = [item];
        socket.emit("ANS_ITEM", jsonData);
    } else {
        DB.query("CALL ADD_AUTO_ITEM(?,?,?,?)", [acc.USER_UID, itemId, limit, add_time], function (error, result) {
            if (error) {
                jsonData.result = 1;
            } else {
                for (var i = 0; i < userItems.length; i++) {
                    if (userItems[i].ITEM_ID == itemId)
                        userItems[i].ITEM_COUNT += result[0][0].ITEM_COUNT;
                }
                jsonData.ITEM = result[0];
                console.timeEnd("ANS_ITEM_200");
                socket.emit("ANS_ITEM", jsonData);
            }
        });
    }
}

// 아이템 판매
function saleItem(socket, client) {
    console.time("ANS_ITEM_300");
    try {
        var saleList = client.SALELIST;
        var itemData = CSVManager.BItem.data;
        var acc = socket.Session.GetAccount();
        var userItems = socket.Session.GetItems();
        var saleItems = [];
        var salePrice = 0;

        if (client.SALELIST == undefined || client.SALELIST.length == 0) {
            result = 1;
            socket.emit('ANS_ITEM', { 'ATYPE': client.ATYPE, 'result': result });
            return;
        }

        let myRoomFlag = false;
        //해당 아이템이 1개인 경우 삭제 or 가감
        for (let i = 0; i < saleList.length; i++) {
            for (let j = 0; j < userItems.length; j++) {
                
                if (saleList[i].ITEM_UID == userItems[j].ITEM_UID) {
                    saleList[i].ITEM_ID = userItems[j].ITEM_ID;
                    let itemObj = CSVManager.BItem.GetData(saleList[i].ITEM_ID);
                    //if (itemObj.type == 5) {
                    if(userItems[j].ITEM_ID > 3600000 && userItems[j].ITEM_ID < 3700000) {
                        if (userItems[j].MYROOM_ITEM_COUNT == userItems[j].ITEM_COUNT) {
                            myRoomFlag = true;
                            break;
                        }
                    }

                    if (saleList[i].ITEM_COUNT == userItems[j].ITEM_COUNT)
                        saleList[i].DELETE_FLAG = true;
                    else
                        saleList[i].DELETE_FLAG = false;

                    saleItems.push(saleList[i]);
                    break;
                }
            }
        }
        if (myRoomFlag) {
            result = 2;
            socket.emit('ANS_ITEM', { 'ATYPE': client.ATYPE, 'result': result });
            return;
        }

        // 아이템 * 수량으로 판매 금액 정산
        for (let k = 0; k < saleItems.length; k++) {
            for (let l = 0; l < itemData.length; l++) {
                if (saleItems[k].ITEM_ID == itemData[l].id) {
                    salePrice += itemData[l].resell_price * saleItems[k].ITEM_COUNT;
                }
            }
        }

        async.each(saleItems, function (obj, cb) {
            if (obj.DELETE_FLAG) {
                DB.query("CALL DELETE_ITEM(?,?)", [acc.USER_UID, obj.ITEM_UID], function (error, result) {
                    if (!error) {
                        //아이템 삭제
                        for (var i = 0; i < userItems.length; i++) {
                            if (userItems[i].ITEM_UID == obj.ITEM_UID)
                                userItems.splice(i, 1);
                        }
                        cb(null);
                    } else {
                        cb(error);
                    }
                });
            } else {
                DB.query("CALL UPDATE_ITEM(?,?,?,?,?,?,?)", [0, acc.USER_UID, obj.ITEM_UID, -obj.ITEM_COUNT, null, null, null], function (error, result) {
                    if (!error) {
                        //아이템 업데이트
                        for (var i = 0; i < userItems.length; i++) {
                            if (userItems[i].ITEM_UID == obj.ITEM_UID)
                                userItems[i].ITEM_COUNT -= obj.ITEM_COUNT;
                        }
                        cb(null);
                    } else {
                        cb(error);
                    }
                });
            }
        }, function (err) {
            var result = 0;
            if (err) {
                PrintError(err);
                result = 1;
                socket.emit('ANS_ITEM', { 'ATYPE': client.ATYPE, 'result': result, "SALELIST": [] });
            } else {
                Item.UpdateMoney(socket, 4, "gold", salePrice, function (error, uRes) {
                    console.timeEnd("ANS_ITEM_300");
                    if (!error) {
                        var saleItemList = [];
                        for (var i = 0; i < userItems.length; i++) {
                            for (var j = 0; j < saleItems.length; j++) {
                                if (userItems[i].ITEM_UID == saleItems[j].ITEM_UID)
                                    saleItemList.push(userItems[i]);
                            }
                        }
                        logging.info("[" + acc.USER_NAME + "] - saleItem result " + result + " - SALELIST : " + JSON.stringify(saleItemList) + ", GOLD : " + JSON.stringify(uRes));
                        socket.emit('ANS_ITEM', { 'ATYPE': client.ATYPE, 'result': result, "GOLD": uRes, "SALELIST": saleItemList });
                    } else {
                        socket.emit('ANS_ITEM', { 'ATYPE': client.ATYPE, 'result': result, "GOLD": null, "SALELIST": [] });
                    }
                });
            }
        });
    } catch (e) { PrintError(e); }
}

/**
 * 아이템 장착
 * client.T, client.IL
 * 캐릭터, 아이템 보유 확인
 * 다른 캐릭터 장착 여부 확인 = > 장착 중인 캐릭터 응답
 * 해당 위치 아이템 장착 여부
 * 장착 후 IL 응답
 */
function equipItem(socket, client) {
    console.time("ANS_ITEM_201");
    var jsonData = { "ATYPE": client.ATYPE, "result": 0, ITEM_LIST: [] };

    if (client.T == undefined || client.T.length == 0 || client.IL == undefined || client.IL.length == 0) {
        jsonData.result = 1;
        socket.emit('ANS_ITEM', jsonData);
        return;
    }

    var acc = socket.Session.GetAccount();


    var target = client.T;
    var itemList = client.IL;

    let chaExistFlag = Character.checkCharacter(socket, target);

    if (!chaExistFlag) {
        //존재하지 않은 CHA_UID
        jsonData.result = 3;
        socket.emit("ANS_ITEM", jsonData);
        return;
    }

    let itemExistFlag = Item.checkItem(socket, itemList);

    if (!itemExistFlag) {
        //존재하지 않는 ITEM_UID
        jsonData.result = 4;
        socket.emit("ANS_ITEM", jsonData);
        return;
    }

    var userItemList = socket.Session.GetItems();
    let tempChaEffectList = [];
    let tempEffect = [];


    let userChaList = socket.Session.GetCharacters();
    let targetd = common.findObjectByKey(userChaList, "CHA_UID", client.T[0]);
    Character.CalculateCharacterListCombat(acc.USER_UID, null, [targetd], null, (combat, statList) => {

    });

    for (var i = 0; i < userItemList.length; i++) {
        if (userItemList[i].CHA_UID == target[0])
            tempChaEffectList.push(CSVManager.BItem.GetEffect(userItemList[i].ITEM_ID));

        if (itemList.indexOf(userItemList[i].ITEM_UID) > -1) {
            let chaUid = userItemList[i].CHA_UID;
            if (chaUid > 0) {
                jsonData.CHA_UID = chaUid;
                break;
            }
            tempEffect.push(CSVManager.BItem.GetEffect(userItemList[i].ITEM_ID));
        }
    }

    if (jsonData.CHA_UID != undefined && jsonData.CHA_UID > 0) {
        //해당 아이템 장착 중
        jsonData.result = 5;
        socket.emit("ANS_ITEM", jsonData);
        return;
    }
    let flag = false;
    for (var i = 0; i < tempChaEffectList.length; i++) {
        if (tempEffect.indexOf(tempChaEffectList[i]) > -1) {
            flag = true;
            break;
        }
    }
    if (flag) {
        //현재 해당 위치 장비 착용중
        jsonData.result = 6;
        socket.emit("ANS_ITEM", jsonData);
        return;
    }

    Mission.addMission(acc.USER_UID, 8000050, 1);

    //해당 아이템 cha_uid 업데이트
    async.eachSeries(itemList, function (itemUid, callback) {
        DB.query("CALL UPDATE_ITEM(?,?,?,?,?,?,?)", [1, acc.USER_UID, itemUid, target[0], null, null, null], function (error, result) {
            if (!error) {
                Item.itemParseJson(result[0][0]);
                jsonData.ITEM_LIST.push(result[0][0]);
                //동기화
                for (var i = 0; i < userItemList.length; i++) {
                    if (result[0][0].ITEM_UID == userItemList[i].ITEM_UID) {
                        userItemList[i].CHA_UID = result[0][0].CHA_UID;
                        break;
                    }
                }
            }
            callback(error);
        });
    }, function (error) {
        if (error) {
            PrintError(error);
            jsonData.result = 2;
        }
        let wearingArea = [11,12,13,14,15];
        let wearingCnt = wearingArea.length;
        for (var i = 0; i < userItemList.length; i++) {
            if (userItemList[i].CHA_UID == target[0]) {
                let effect = CSVManager.BItem.GetEffect(userItemList[i].ITEM_ID);
                if(wearingArea.indexOf(effect) > -1) wearingCnt--;
            }
        }
        if(wearingCnt == 0) Mission.addMission(acc.USER_UID, 8000051, 1);
    
        console.timeEnd("ANS_ITEM_201");
        socket.emit('ANS_ITEM', jsonData);
    });
}

/**
 * 아이템 장착 대상 변경
 * client.T, client.IL
 * 해당 위치 착용 여부 확인
 * CHA_UID 변경 후 IL 응답
 */
function changeEquipItem(socket, client) {
    console.time("ANS_ITEM_202");
    var jsonData = { "ATYPE": client.ATYPE, "result": 0, ITEM_LIST: [] };
    var acc = socket.Session.GetAccount();

    if (client.T == undefined || client.T.length == 0 || client.T.length > 1 || client.IL == undefined || client.IL.length == 0 || client.IL.length > 1) {
        jsonData.result = 1;
        socket.emit('ANS_ITEM', jsonData);
        return;
    }

    var target = client.T;
    var itemList = client.IL;

    let tempChaEffectList = [];
    let tempEffect = 0;

    var userItemList = socket.Session.GetItems();

    for (var i = 0; i < userItemList.length; i++) {
        if (userItemList[i].CHA_UID == target[0])
            tempChaEffectList.push(CSVManager.BItem.GetEffect(userItemList[i].ITEM_ID));

        if (itemList.indexOf(userItemList[i].ITEM_UID) > -1)
            tempEffect = CSVManager.BItem.GetEffect(userItemList[i].ITEM_ID);
    }

    if (tempChaEffectList.indexOf(tempEffect) > -1) {
        //현재 해당 위치 장비 착용중
        jsonData.result = 3;
        socket.emit("ANS_ITEM", jsonData);
        return;
    }

    DB.query("CALL UPDATE_ITEM(?,?,?,?,?,?,?)", [1, acc.USER_UID, itemList[0], target[0], null, null, null], function (error, result) {
        if (error) {
            PrintError(error);
            jsonData.result = 2;
        } else {
            Item.itemParseJson(result[0][0]);
            jsonData.ITEM_LIST.push(result[0][0]);
            //동기화
            for (var i = 0; i < userItemList.length; i++) {
                if (result[0][0].ITEM_UID == userItemList[i].ITEM_UID) {
                    userItemList[i].CHA_UID = result[0][0].CHA_UID;
                    break;
                }
            }
        }
        console.timeEnd("ANS_ITEM_202");
        socket.emit('ANS_ITEM', jsonData);
    });
}

/**
 * 아이템 장착 해제
 * client.IL
 * 아이템 보유 확인
 * CHA_UID 변경 후 IL 응답
 */
function unequipItem(socket, client) {
    console.time("ANS_ITEM_203");
    var jsonData = { "ATYPE": client.ATYPE, "result": 0, ITEM_LIST: [] };
    var acc = socket.Session.GetAccount();

    if (client.IL == undefined || client.IL.length == 0) {
        jsonData.result = 1;
        socket.emit('ANS_ITEM', jsonData);
        return;
    }

    var userItemList = socket.Session.GetItems();
    var itemList = client.IL;


    async.eachSeries(itemList, function (itemUid, callback) {
        DB.query("CALL UPDATE_ITEM(?,?,?,?,?,?,?)", [2, acc.USER_UID, itemUid, null, null, null, null], function (error, result) {
            if (error) {
                PrintError(error);
            } else {
                Item.itemParseJson(result[0][0]);
                jsonData.ITEM_LIST.push(result[0][0]);
                //동기화
                for (var i = 0; i < userItemList.length; i++) {
                    if (result[0][0].ITEM_UID == userItemList[i].ITEM_UID) {
                        userItemList[i].CHA_UID = result[0][0].CHA_UID;
                        break;
                    }
                }
            }
            callback(error);
        });
    }, function (error) {
        if (error) {
            PrintError(error);
            jsonData.result = 2;
        }
        console.timeEnd("ANS_ITEM_203");
        socket.emit('ANS_ITEM', jsonData);
    });
}

/**
* 아이템 재료넣기
* T: 타겟 uid, 재료 uidList
* - 필요 재화 : 아이템
 * - 전송 데이터 검사
* - 전송된 아이템 UID 검사
 * - inventype 검사 장비 인지.
* - 타겟 아이템 강화 필요 경험치와 재료 합산 경험치 비교
* 
* - 타겟 아이템 경험치 합산, 재료 아이템 삭제, 재화 차감 및 서버 데이터 동기화
* - 강화된 데이터 리턴
* */
function addExp(socket, client) {
    //재료 사용시 팀 배치된 케릭터 제외 추가
    console.time("ANS_ITEM_204");
    var jsonData = { result: 0 };
    jsonData.ATYPE = client.ATYPE;
    var acc = socket.Session.GetAccount();

    var target = client.T;
    var uidList = client.IL;
    //데이터 누락
    if (target == null || target.length == 0 || uidList == null || uidList.length == 0) {
        jsonData.result = 1;
        socket.emit("ANS_ITEM", jsonData);
        return;
    }
    var itemList = target.concat(uidList);

    var sumExp = 0;

    //존재하지 않는 UID
    if (!Item.checkItem(socket, itemList)) {
        jsonData.result = 3;
        socket.emit("ANS_ITEM", jsonData);
        return;
    }
    //재료 EXP 계산
    var userItems = socket.Session.GetItems();
    var targetObj = common.findObjectByKey(userItems, "ITEM_UID", target[0]);
    var targetCSV = CSVManager.BItem.GetData(targetObj.ITEM_ID);

    for (var i = 0; i < userItems.length; i++) {
        if (itemList.indexOf(userItems[i].ITEM_UID) > -1) {
            if (target[0] != userItems[i].ITEM_UID) {
                var tempObj = common.findObjectByKey(userItems, "ITEM_UID", userItems[i].ITEM_UID);
                var tempCSV = CSVManager.BItem.GetData(tempObj.ITEM_ID);
                sumExp += tempCSV.exp;
            }
        }
    }

    var nextSNeed = CSVManager.BISNeed.GetData(targetCSV.grade, targetObj.ENCHANT + 1);

    if (nextSNeed == null) {
        jsonData.result = 4;
        socket.emit("ANS_ITEM", jsonData);
        return;
    }

    sumExp += targetObj.EXP;
    if (sumExp >= nextSNeed.exp) {
        sumExp = nextSNeed.exp;
    }

    sumExp -= targetObj.EXP;

    async.waterfall([
        function (callback) {
            //삭제
            DB.query('DELETE FROM ITEM WHERE USER_UID = ? AND ITEM_UID IN (?)', [acc.USER_UID, uidList], function (err, res) {
                callback(null);
            });
        }, function (callback) {
            DB.query("CALL UPDATE_ITEM(?,?,?,?,?,?,?)", [3, acc.USER_UID, targetObj.ITEM_UID, sumExp, null, null, null], function (err, res) {
                if (err) { callback(err); } else {
                    Item.itemParseJson(res[0][0]);
                    jsonData.ITEM_LIST = res[0];
                    // 아이템 강화 수치 변경
                    for (let i = 0; i < userItems.length; i++) {
                        if (userItems[i].ITEM_UID == targetObj.ITEM_UID)
                            userItems[i].EXP = res[0][0].EXP;
                    }
                    callback(null);
                }
            });
        }, function (callback) {
            DB.query('CALL SELECT_ITEM(?,?,?,?)', [0, acc.USER_UID, null, null], function (err, res) {
                if (err) { callback(err); } else {
                    for (var i = 0; i < res[0].length; i++)
                        Item.itemParseJson(res[0][i]);
                    socket.Session.SetItems(res[0]);
                    callback(null);
                }
            });
        }
    ], function (error, result) {
        //동기화, 응답
        if (error) {
            PrintError(error);
            jsonData.result = 2;
        }
        console.timeEnd("ANS_ITEM_204");
        socket.emit("ANS_ITEM", jsonData);
    });
}

/**
 * 아이템 강화
 * T: 타겟 uid
 * - 필요 재화 : 재화
 * - 전송 데이터 검사
 * - 전송된 아이템 UID 검사
 * - 필요 재화 검사
 * - 타겟 uid 강화 제한 검사
 * - 타겟 캐릭터 강화 필요 경험치 비교
 * 
 * - 타겟 캐릭터 강화, 재료 캐릭터 삭제, 재화 차감 및 서버 데이터 동기화
 * - 강화된 데이터 리턴
 * */
function setEnchant(socket, client) {
    //재료 사용시 팀 배치된 케릭터 제외 추가
    console.time("ANS_ITEM_205");
    var jsonData = { result: 0 };
    jsonData.ATYPE = client.ATYPE;
    var acc = socket.Session.GetAccount();

    var target = client.T;
    //데이터 누락
    if (target == null || target.length == 0) {
        jsonData.result = 1;
        socket.emit("ANS_ITEM", jsonData);
        return;
    }
    //존재하지 않는 UID
    if (!Item.checkItem(socket, target)) {
        jsonData.result = 3;
        socket.emit("ANS_ITEM", jsonData);
        return;
    }

    var userItems = socket.Session.GetItems();
    var targetObj = common.findObjectByKey(userItems, "ITEM_UID", target[0]);
    var targetCSV = CSVManager.BItem.GetData(targetObj.ITEM_ID);
    var nextSNeed = CSVManager.BISNeed.GetData(targetCSV.grade, targetObj.ENCHANT + 1);

    if (nextSNeed == null) {
        //최대 강화 단계
        jsonData.result = 4;
        socket.emit("ANS_ITEM", jsonData);
        return;
    }

    if (targetObj.EXP != nextSNeed.exp) {
        //경험치 부족
        jsonData.result = 5;
        socket.emit("ANS_ITEM", jsonData);
        return;
    }

    var rewardList = [];
    if (nextSNeed.gold > 0) {
        if (Item.getSingleItemCount(socket, DefineItem.GOLD) < nextSNeed.gold) {
            //재화 부족
            jsonData.result = 6;
            socket.emit("ANS_ITEM", jsonData);
            return;
        }
        rewardList.push({ "REWARD_ITEM_ID": DefineItem.GOLD, "REWARD_ITEM_COUNT": -nextSNeed.gold, TYPE: 12 });
    }

    //재화 차감, 캐릭터 강화, 캐릭터 삭제, 동기화
    async.waterfall([function (callback) {
        Item.addRewardItem(socket, rewardList, 0, function (err, res) {
            if (err) { callback(err); } else { jsonData.REWARD = res; callback(null); }
        });
    }, function (callback) {
        targetObj.PREFIX.VALUE = (targetObj.PREFIX.VALUE * CSVManager.BItemStrenghten.GetData("prefix_enchant")).toFixed(1);

        for (var i = 0; i < targetObj.OPTIONS.length; i++) {
            targetObj.OPTIONS[i].VALUE = (targetObj.OPTIONS[i].VALUE * CSVManager.BItemStrenghten.GetData("option_enchant")).toFixed(1);
        }
        //인첸트
        DB.query("CALL UPDATE_ITEM(?,?,?,?,?,?,?)",
            [4, acc.USER_UID, targetObj.ITEM_UID, null, null, JSON.stringify(targetObj.PREFIX), JSON.stringify(targetObj.OPTIONS)], function (err, res) {
                if (err) { callback(err); } else {
                    Item.itemParseJson(res[0][0]);
                    jsonData.ITEM_LIST = res[0];
                    for (let i = 0; i < userItems.length; i++) {
                        if (userItems[i].ITEM_UID == targetObj.ITEM_UID) {
                            userItems[i].ENCHANT = res[0][0].ENCHANT;
                            userItems[i].PREFIX = res[0][0].PREFIX;
                            userItems[i].OPTIONS = res[0][0].OPTIONS;
                        }
                    }
                    logDB.query("INSERT INTO ITEM_ENCHANT (`USER_UID`, `ITEM_ID`, `ENCHANT`) VALUES (?, ?, ?);"
                        , [acc.USER_UID, targetObj.ITEM_ID, res[0][0].ENCHANT], (error, result) => {
                        callback(error);
                    });
                    //callback(null);
                }
            });
    }], function (error, result) {
        //동기화, 응답
        if (error) {
            PrintError(error);
            jsonData.result = 2;
        }
        console.timeEnd("ANS_ITEM_205");
        socket.emit("ANS_ITEM", jsonData);
    });
}

// 아이템 데이터 검증
exports.checkItem = function (socket, itemList) {
    let userItemList = socket.Session.GetItems();

    let itemExistCount = 0;
    for (var i = 0; i < userItemList.length; i++) {
        if (itemList.indexOf(userItemList[i].ITEM_UID) > -1) {
            itemExistCount++;
        }
    }

    if (itemExistCount == itemList.length)
        return true;
    else
        return false;
}

// 아이템 카운트 조회
exports.getSingleItemCount = function (socket, itemId) {
    return common.findObjectByKey(socket.Session.GetItems(), "ITEM_ID", itemId).ITEM_COUNT;
}