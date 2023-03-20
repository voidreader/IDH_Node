/**
 * 계정 Controller
 * 
 */

 // 친구 삭제 시 하루 삭제 가능 수치 차감
 exports.updateDelLimit = function (socket) {
    var acc = socket.Session.GetAccount();
    DB.query("CALL UPDATE_ACCOUNT(?,?,?,?,?)", [2, acc.USER_UID, null, null, null], function (error, result) {
        if (error) {

            PrintError(error);
        }
        acc.DEL_FRIEND_LIMIT = result[0][0].DEL_FRIEND_LIMIT;
    });
}

// 요일 던전 추가 구매 시 하루 충전 가능 수치 차감
exports.updateAddDungeonLimit = function (socket) {
    var acc = socket.Session.GetAccount();
    DB.query("CALL UPDATE_ACCOUNT(?,?,?,?,?)", [4, acc.USER_UID, null, null, null], function (error, result) {
        if (error)
            PrintError(error);
        acc.ADD_DUNGEON_LIMIT = result[0][0].ADD_DUNGEON_LIMIT;
    });
}

/**
 *  유저 경험치 증가
 *  레벨 업 시 행동력 충전
 *  레벨 및 경험치 업데이트
 *  레벨 달성 보상 지급
 */
exports.updateExp = function (socket, amount, cb) {

    if (amount > 0) {
        //
        var acc = socket.Session.GetAccount();
        var sumExp = acc.USER_EXP + amount;
        var checkLevel = CSVManager.BExp.CheckLevel(acc.USER_EXP, sumExp);
        var level = acc.USER_LEVEL;

        sumExp = checkLevel.SUMEXP;

        if (checkLevel.UP == true) {
            
            let interval = checkLevel.UPLEVEL - acc.USER_LEVEL;
            level = checkLevel.UPLEVEL;

            var addMileageLimit = CSVManager.BStaminaCommon.GetData("acting_level_up") || 0;
            acc.MILEAGE += addMileageLimit * interval;
            checkLevel.MILEAGE_REWARD = [];

            if (checkLevel.ACT == true) {
                var userItemList = socket.Session.GetItems();
                var itemObj = common.findObjectByKey(userItemList, "ITEM_ID", DefineItem.BEHAVIOR);
                if (itemObj != null && itemObj.ITEM_COUNT < acc.MILEAGE)
                    checkLevel.MILEAGE_REWARD.push({ REWARD_ITEM_ID: itemObj.ITEM_ID, REWARD_ITEM_COUNT: acc.MILEAGE - itemObj.ITEM_COUNT });
            }
        }
        async.waterfall([
            function (callback) {
                DB.query('CALL UPDATE_ACCOUNT(?,?,?,?,?)', [3, acc.USER_UID, sumExp, level, acc.MILEAGE], function (err) {
                    if (!err) {
                        acc.USER_LEVEL = level;
                        acc.USER_EXP = sumExp;
                        callback(null);
                    }
                    else callback(err);
                });
            },
            function (callback) {
                if (checkLevel.UP == true) {
                    Item.addRewardItem(socket, checkLevel.MILEAGE_REWARD, 0, function (cErr, cRes) {
                        var result = 0;
                        if (cErr) {
                            result = 1;
                            socket.emit('ANS_LEVEL', { 'result': result, "REWARD": [], "ACCOUNT": acc });
                        } else {
                            if (checkLevel.REWARD.length > 0) {
                                Item.SetItemType(checkLevel.REWARD);
                                async.eachSeries(checkLevel.REWARD, function (obj, cb) {
                                    Mail.PushMail(acc.USER_UID, 15, obj.ITEM_TYPE, obj.REWARD_ITEM_ID, obj.REWARD_ITEM_COUNT, 0,
                                        "레벨 달성 보상", CSVManager.BMailString.GetData(15).limit, (mErr, mRes) => { cb(mErr); });
                                }, function (error) {
                                    if (error != null) {
                                        PrintError(error);
                                        result = 1;
                                    }
                                    socket.emit('ANS_LEVEL', { 'result': result, "REWARD": cRes, "ACCOUNT": acc });
                                });
                            } else {
                                result = 1;
                                socket.emit('ANS_LEVEL', { 'result': result, "REWARD": cRes, "ACCOUNT": acc });
                            }
                        }
                        callback(cErr);
                    });
                }
                else callback(null);
            }
        ], function (err, result) {
            cb(err, result);
        });
    }
    else cb(null, null);
} // end of updateExp

// 레벨 달성 보상 CBT에서 사용 현재 사용 안함
function PushCBTEventReward(acc, level) {
    let rewardList = [];
    switch (level) {
        case 10:
            rewardList.push({ REWARD_ITEM_ID: DefineItem.COIN_DEFENSIVE, REWARD_ITEM_COUNT: 500 });
            rewardList.push({ REWARD_ITEM_ID: DefineItem.COIN_LONG_RANGE, REWARD_ITEM_COUNT: 500 });
            rewardList.push({ REWARD_ITEM_ID: DefineItem.COIN_MAGIC_TYPE, REWARD_ITEM_COUNT: 500 });
            rewardList.push({ REWARD_ITEM_ID: DefineItem.COIN_PROXIMITY, REWARD_ITEM_COUNT: 500 });
            rewardList.push({ REWARD_ITEM_ID: DefineItem.COIN_SUPPORT_TYPE, REWARD_ITEM_COUNT: 500 });
            break;
        case 15: rewardList.push({ REWARD_ITEM_ID: DefineItem.BEHAVIOR, REWARD_ITEM_COUNT: 200 }); break;
        case 20:
            rewardList.push({ REWARD_ITEM_ID: DefineItem.COIN_DEFENSIVE, REWARD_ITEM_COUNT: 1000 });
            rewardList.push({ REWARD_ITEM_ID: DefineItem.COIN_LONG_RANGE, REWARD_ITEM_COUNT: 1000 });
            rewardList.push({ REWARD_ITEM_ID: DefineItem.COIN_MAGIC_TYPE, REWARD_ITEM_COUNT: 1000 });
            rewardList.push({ REWARD_ITEM_ID: DefineItem.COIN_PROXIMITY, REWARD_ITEM_COUNT: 1000 });
            rewardList.push({ REWARD_ITEM_ID: DefineItem.COIN_SUPPORT_TYPE, REWARD_ITEM_COUNT: 1000 });
            break;
        case 30: rewardList.push({ REWARD_ITEM_ID: DefineItem.PEARL, REWARD_ITEM_COUNT: 500 }); break;
    }
    if (rewardList.length > 0) {
        Item.SetItemType(rewardList);
        async.eachSeries(rewardList, function (obj, cb) {
            Mail.PushMail(acc.USER_UID, 14, obj.ITEM_TYPE, obj.REWARD_ITEM_ID, obj.REWARD_ITEM_COUNT, 0,
                level + "레벨 달성 보상", CSVManager.BMailString.GetData(14).limit, (mErr, mRes) => { cb(mErr); });
        }, function (error) {
            if (error != null) PrintError(error);
        });
    }
}


module.exports.OnPacket = function (socket) {

    // 클라이언트 접속 해제 시 LOGIN_DATE 업데이트.
    socket.on('disconnect', function (reason) {
        console.time("socket_disconnect");
        try {
            if (socket.Session != null) {
                var acc = socket.Session.GetAccount();
                if (acc != null) {
                    logging.info('[' + acc.USER_NAME + '] Logout. Reason : ' + reason);
                    DB.query("CALL UPDATE_ACCOUNT_LOGIN_DATE(?, '', ?)", [acc.USER_UID, 0], function (err) {
                        PrintError(err);

                        console.timeEnd("socket_disconnect");
                    });
                }
            } else {
                logging.error('User Disconnected. Reason : ' + reason);
            }
            SetProcessName(io.engine.clientsCount);
        } catch (e) { PrintError(e); }
    });

    // 클라이언트 ACCOUNT 관련 요청.
    socket.on("REQ_ACCOUNT", function (client) {
        try {
            if (client.ATYPE !== undefined) {
                var packetType = aTypeParser(client.ATYPE);

                if (packetType.cType == "0") {
                    switch (packetType.aType) {
                        case "00": createAccount(socket, client); break;
                        default: break;
                    }
                } else if (packetType.cType == "1") {
                    switch (packetType.aType) {
                        case "00": loginAccount(socket, client); break;
                        case "01": break;
                        case "02": Account.Reconnect(socket, client, function (callback) { }); break;
                        default: break;
                    }
                } else if (packetType.cType == "2") {
                    switch (packetType.aType) {
                        case "00": updateAccountCharacter(socket, client); break;
                        case "01": updateAccountDelegateCharacter(socket, client); break;
                        case "02": updateAccountDelegateMyRoom(socket, client); break;
                        case "03": updateAccountInven(socket, client); break;
                        case "04": updateTutorial(socket, client); break;
                        case "05": leaveAccount(socket, client); break;
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

};

// 유저 소켓 리커넥트 시 유저 세션 생성, 데이터 로드 및 LOGIN_DATE 업데이트
module.exports.Reconnect = function (socket, client, cb) {
    try {
        var resultCode = 0;
        var resultData = { result: 0 };

        async.waterfall([
            function (callback) { //!< 세션 생성 및 로그인.
                socket.Session = new SessionManager;
                socket.Session.UserLogin(socket, client, function (err) {
                    callback(err);
                });
            }, function (callback) { //!< 유저 세션 로드.
                socket.Session.LoadUserSessionInfo();
                var acc = socket.Session.GetAccount();
                DB.getConnection((error, connection) => {
                    if(error) {
                        callback(error);
                        connection.release();
                    } else {
                        connection.query('CALL UPDATE_ACCOUNT_LOGIN_DATE(?, ?, ?)', [acc.USER_UID, socket.id, common.dateDiff(acc.LOGIN_DATE, new Date().format("yyyy-MM-dd HH:mm:ss"))], function (err, result) {
                            connection.release();
                            logging.info('[' + acc.USER_NAME + '] Reconnect Login');
                            callback(err);
                        });
                    }
                });
            }
        ], function (err, result) {
            if (err) {
                PrintError(err);
                resultData.result = Number(err);
            }
            resultData.ATYPE = client.ATYPE;
            socket.emit('ANS_ACCOUNT', resultData);
            cb(null);
        });
    } catch (e) { PrintError(e); }
}

// 계정 생성 후 기본 데이터 셋팅.
// 현재 실 서버용 setMaxUserUid로 셋팅 되어 있음
// 테스트 서버의 경우 테스트 서버데이터로 변경 해야 함(setMaxUserUid와 pvp 기본데이터 생성 부분 확인 바람)
function SetAccountBaseSettings(userIndex, cb) {
    try {
        var BItem = CSVManager.BItem.data;

        var defaultCharacter = [1000002, 1000032, 1000112];
        var tempDefaultCharacter = JSON.parse(JSON.stringify(defaultCharacter));
        var tempCharacter = [1000091, 1000091];
        tempDefaultCharacter = tempDefaultCharacter.concat(tempCharacter);

        var defaultItems = [DefineItem.GOLD, DefineItem.PEARL, DefineItem.COIN_DEFENSIVE, DefineItem.COIN_PROXIMITY, DefineItem.COIN_MAGIC_TYPE,
        DefineItem.COIN_LONG_RANGE, DefineItem.COIN_SUPPORT_TYPE, DefineItem.TICKET_FAST_HERO_MANUFACTURER, DefineItem.TICKET_FAST_EQUIPMENT_MANUFACTURER, DefineItem.FRIENDSHIP_TOKEN,
        DefineItem.TICKET_PVP, DefineItem.BEHAVIOR, DefineItem.TICKET_DUNGEON, DefineItem.TICKET_RAID,
            3100020];

        var delegate_icon = 0;
        // 실 서버 데이터
        // var setMaxUserUid = 500000;

        // 테스트 서버 데이터
        var setMaxUserUid = 0;

        async.waterfall([
            function (callback) { //!< 기본 캐릭터 지급
                if(userIndex > setMaxUserUid) {
                    async.eachSeries(tempDefaultCharacter, function (id, ecb) {
                        DB.query("CALL INSERT_CHARACTER(?,?,?,?)", [userIndex, id, Character.getCharacterExp(id), 0], function (error, result) {
                            if (error) {
                                ecb(error);
                            } else {
                                if (id == 1000002) delegate_icon = result[0][0].CHA_UID;
                                ecb(null);
                            }
                        });
                    }, function (err) {
                        if (err)
                            PrintError(err);
                        callback(err);
                    });
                } else {
                    callback(null);
                }
            },
            function (callback) { //!< 기본 아이템 지급
                if(userIndex > setMaxUserUid) {
                    //머니, 캐쉬, 아이템 리스트
                    var inputData = [];
                    for (var i = 0; i < BItem.length; i++) {
                        if (defaultItems.indexOf(BItem[i].id) > -1) {
                            var obj = {};
                            obj.ITEM_ID = BItem[i].id;
                            obj.ITEM_COUNT = 0;
                            switch (obj.ITEM_ID) {
                                case DefineItem.GOLD: obj.ITEM_COUNT = CSVManager.BWealthCommon.GetData("default_gold"); break;
                                case DefineItem.PEARL: obj.ITEM_COUNT = CSVManager.BWealthCommon.GetData("default_cash"); break;
                                case DefineItem.COIN_DEFENSIVE: obj.ITEM_COUNT = 100; break;
                                case DefineItem.COIN_PROXIMITY: obj.ITEM_COUNT = 100; break;
                                case DefineItem.COIN_MAGIC_TYPE: obj.ITEM_COUNT = 100; break;
                                case DefineItem.COIN_LONG_RANGE: obj.ITEM_COUNT = 100; break;
                                case DefineItem.COIN_SUPPORT_TYPE: obj.ITEM_COUNT = 100; break;
                                case DefineItem.TICKET_PVP: obj.ITEM_COUNT = CSVManager.BPvPCommon.GetData("default_pvp"); break;
                                case DefineItem.BEHAVIOR: obj.ITEM_COUNT = CSVManager.BStaminaCommon.GetData("default_acting"); break;
                                case DefineItem.TICKET_DUNGEON: obj.ITEM_COUNT = CSVManager.BDDungeonCommon.GetData("default_dungeon"); break;
                                case DefineItem.TICKET_RAID: obj.ITEM_COUNT = CSVManager.BPvECommon.GetData("default_raid"); break;
                                case 3100020: obj.ITEM_COUNT = 1;
                                    obj.PREFIX = '{"ID": 3, "VALUE": 3}',
                                        obj.OPTIONS = '[{"ID": 14, "VALUE": 50}, {"ID": 0, "VALUE": 0}, {"ID": 0, "VALUE": 0}, {"ID": 0, "VALUE": 0}]'; break;
                                default: obj.ITEM_COUNT = 0; break;
                            }
                            inputData.push(obj);
                        }
                    }
                    async.eachSeries(inputData, function (eObj, ecb) {
                        DB.query("CALL INSERT_ITEM(?,?,?,?,?,?,?)", [1, userIndex, eObj.ITEM_ID, eObj.ITEM_COUNT, eObj.PREFIX, eObj.OPTIONS, 0], function (error, result) {
                            if (error) {
                                ecb(error);
                            } else {
                                ecb(null);
                            }
                        });
                    }, function (err) {
                        if (err)
                            PrintError(err);
    
                        callback(err);
                    });
                } else {
                    callback(null);
                }
            },
            function (callback) { //!< 마이룸 지급.
                if(userIndex > setMaxUserUid) {
                    var myRoomList = CSVManager.BMyRoom.data;
                    var defaultList = [];
                    for (var i = 0; i < myRoomList.length; i++) {
                        if (myRoomList[i].default == 0)
                            defaultList.push(myRoomList[i].id);
                    }
                    async.each(defaultList, function (id, ecb) {
                        DB.query("CALL INSERT_MYROOM(?,?,?)", [0, userIndex, id], function (error, result) {
                            if (error)
                                ecb(error);
                            else
                                ecb(null);
                        });
                    }, function (err) {
                        if (err)
                            PrintError(err);
    
                        callback(err);
                    });
                } else {
                    callback(null);
                }
            },
            function (callback) { //!< 제조 슬롯 지급.
                if(userIndex > setMaxUserUid) {
                    var CSVMakingSlotCost = CSVManager.BMakingSlotCost.data;
                    var defaultSlot = [];
    
                    var flag = false;
                    for (var i = 0; i < CSVMakingSlotCost.length; i++) {
                        if (!flag) {
                            if (CSVMakingSlotCost[i].cost1_id == 0 && CSVMakingSlotCost[i].cost2_id == 0) {
                                CSVMakingSlotCost[i].status = 2;
                                defaultSlot.push(CSVMakingSlotCost[i]);
                            } else {
                                CSVMakingSlotCost[i].status = 0;
                                defaultSlot.push(CSVMakingSlotCost[i]);
                                flag = true;
                            }
                        }
                        if (CSVMakingSlotCost[i].cost1_id == -1 && CSVMakingSlotCost[i].cost2_id == -1)
                            flag = false;
                    }
    
                    async.each(defaultSlot, function (obj, ecb) {
                        DB.query("CALL INSERT_MAKING(?,?,?,?)", [userIndex, obj.id, obj.type, obj.status], function (error, result) {
                            if (error) {
                                ecb(error);
                            } else {
                                ecb(null);
                            }
                        });
                    }, function (err) {
                        if (err)
                            PrintError(err);
    
                        callback(err);
                    });
                } else {
                    callback(null);
                }
            },
            function (callback) { //!< 스토리 관련 기본 데이터.
                if(userIndex > setMaxUserUid) {
                    var storyCSVData = CSVManager.BStory.data;
                    DB.query("CALL INSERT_STORY(?,?)", [userIndex, storyCSVData[0].id], function (aErr, aRes) {
                        if (aErr) {
                            PrintError(aErr);
                        }
                        callback(aErr);
                    });
                } else {
                    callback(null);
                }
            },
            function (callback) { //!< 기본 캐릭터 대표팀으로 설정.
                if(userIndex > setMaxUserUid) {
                    let q = DB.query("INSERT INTO `idh`.`team` (`USER_UID`, `CHA_UID`, `TEAM`, `POSITION`, `SKILL`) VALUES "
                        + "('" + userIndex + "', '1', '1', '2', '0'),"
                        + "('" + userIndex + "', '1', '5', '2', '0'),"
                        + "('" + userIndex + "', '2', '1', '0', '0'),"
                        + "('" + userIndex + "', '2', '5', '0', '0'),"
                        + "('" + userIndex + "', '3', '1', '1', '0'),"
                        + "('" + userIndex + "', '3', '5', '1', '0');"
                        , (aErr, aRes) => {
    
                            if (aErr) {
                                PrintError(aErr);
                            }
                            callback(aErr);
                        });
                } else {
                    callback(null);
                }
            },
            function (callback) { //!< PVP 관련 기본 데이터.
                // 실 서버 데이터
				//if(userIndex > 100000) {
                // 테스트 서버 데이터
                if(userIndex > setMaxUserUid) {
                    DB.query("CALL INSERT_PVP(?,?,?,?,?,?,?,?,?,?,?,?,?)",
                        [0, userIndex, CSVManager.BRateReward.data[0].id, 0, 0, 0, 0, 0, 0, null, 0, 0, CSVManager.BPvPCommon.GetData("rechallenge_count")], function (aErr, aRes) {
                            if (aErr) {
                                PrintError(aErr);
                            }
                            callback(aErr);
                        });
                } else {
                    callback(null);
                }
            },
            function (callback) { //!< MISSION 데이터.
                if(userIndex > setMaxUserUid) {
                    var missionList = (CSVManager.BDailyMission.data).concat(CSVManager.BWeeklyMission.data);
                    var accumReward = CSVManager.BAccumReward.data;
    
                    for (var i = 0; i < accumReward.length; i++) {
                        if ([0, 1].indexOf(accumReward[i].type) > -1) {
                            accumReward[i].id = accumReward[i].type;
                            missionList.push(accumReward[i]);
                        }
                    }
                    async.each(missionList, function (mObj, cb) {
                        DB.query("CALL INSERT_MISSION(?,?,?,?)", [0, userIndex, mObj.uid, mObj.id], function (aErr, aRes) {
                            cb(aErr);
                        });
                    }, function (error) {
                        callback(error);
                    });
                } else {
                    callback(null);
                }
            },
            function (callback) { //!< ACHIEVE 데이터.
                if(userIndex > setMaxUserUid) {
                    var achieveList = [];
                    var achieveCSVData = CSVManager.BAchieve.data;
                    var accumReward = CSVManager.BAccumReward.data;
    
                    for (var j = 0; j < achieveCSVData.length; j++) {
                        if (achieveCSVData[j].level == 1)
                            achieveList.push(achieveCSVData[j]);
                    }
    
                    for (var i = 0; i < accumReward.length; i++) {
                        if (accumReward[i].type == 2 && accumReward[i].level == 1) {
                            accumReward[i].id = accumReward[i].type;
                            achieveList.push(accumReward[i]);
                        }
                    }
    
                    async.each(achieveList, function (mObj, cb) {
                        DB.query("CALL INSERT_MISSION(?,?,?,?)", [1, userIndex, mObj.uid, mObj.id], function (aErr, aRes) {
                            cb(aErr);
                        });
                    }, function (error) {
                        callback(error);
                    });
                } else {
                    callback(null);
                }
            },
            function (callback) { //!< QUEST 데이터.
                if(userIndex > setMaxUserUid) {
                    var questList = [CSVManager.BQuest.data[0]];
                    var accumReward = CSVManager.BAccumReward.data;
    
                    for (var i = 0; i < accumReward.length; i++) {
                        if (accumReward[i].type == 3 && accumReward[i].level == 1) {
                            accumReward[i].id = accumReward[i].type;
                            questList.push(accumReward[i]);
                        }
                    }
    
                    async.each(questList, function (mObj, cb) {
                        DB.query("CALL INSERT_MISSION(?,?,?,?)", [2, userIndex, mObj.uid, mObj.id], function (aErr, aRes) {
                            cb(aErr);
                        });
                    }, function (error) {
                        callback(error);
                    });
                } else {
                    callback(null);
                }
            },
            function (callback) { //!< 계정 관련 초기화
                Mission.addMission(userIndex, 8000043, 1);
                if(userIndex > setMaxUserUid) {
                    DB.query('CALL UPDATE_DEFALUT_ACCOUNT(?,?,?,?,?,?)',
                        [userIndex, CSVManager.BCharacterCommon.GetData("default_character_slot_count"),
                            //[userIndex, 150, //FGT
                            CSVManager.BInventoryCommon.GetData("default_invent_slot_count"), delegate_icon,
                            CSVManager.BStaminaCommon.GetData("default_acting"), CSVManager.BFriendsCommon.GetData("max_delete_count")],
                        function (err, result) {
                            if (err)
                                PrintError(err);
    
                            callback(err);
                        });
                } else {
                    callback(null);
                }
            }
        ], function (err, result) {
            cb(err);
        });

    } catch (e) { PrintError(e); }
}

// 클라이언트 계정 생성.
function createAccount(socket, client) {
    try {

        console.time("ANS_ACCOUNT_Create");
        var jsonData = { result: 0 };
        var userIndex = 0;
        jsonData.ATYPE = client.ATYPE;
        client = JSON.parse(common.CryptoDecrypt(client.data));

        async.waterfall([
            function (callback) {
                logging.info("CreateAccount Try : " + JSON.stringify(client));
                if (client.USER_NAME !== undefined && client.USER_NAME.length > 1 && client.USER_NAME.length < 10) { //!< 2~10자.
                    if (client.USER_NAME.match(RegExp('[^\uAC00-\uD7A3xfe0-9a-zA-Z\\s]')) == null && client.USER_NAME.search(/\s/) == -1) { //!< 공백, 자음,모음 체크. 공백 체크 안됨.
                        callback(null);
                    } else {
                        callback(2);
                    }
                } else {
                    callback(2);
                }
            },
            function (callback) { //!< 필터링 단어 목록 체크 (정규식).
                CSVManager.NameBlackList.IsFilter(client.USER_NAME, (result) => {
                    if (result) callback(2);
                    else callback(null);
                });
            },
            function (callback) { //!< 동일한 이름의 계정이 있는지 검색.
                DB.query('SELECT USER_UID FROM ACCOUNT WHERE USER_NAME = ?', [client.USER_NAME], function (err, result) {
                    if (err) {
                        callback(err);
                    } else {
                        if (result.length == 0) {
                            callback(null);
                        } else {
                            callback(1);
                        }
                    }
                });
            },
            function (callback) { //!< 중복 계정이 있는지 검색 or 탈퇴 예정 계정인지 검색.
                if ([1,2,3,4].indexOf(client.TYPE) > -1) client.UDID = client.LTID || "";
                DB.query("SELECT USER_ID, USER_UID, USER_NAME, USER_TYPE, USER_LEVEL, USER_EXP, DATE_FORMAT(LOGIN_DATE, '%Y-%m-%d') LOGIN_DATE, "
                    + "CHARACTER_SLOT, INVEN_SLOT, DEL_FRIEND_LIMIT, ADD_DUNGEON_LIMIT, DELEGATE_ICON, COMM, DELEGATE_MYROOM, MILEAGE, "
                    + "LOGIN_ID, BLOCK_FLAG, PICK_TIME, PAYMENT_DATE, DROP_FLAG, DROP_DATE, TUTORIAL "
                    + "FROM ACCOUNT WHERE USER_ID = ? AND USER_TYPE = ?", [client.UDID, client.TYPE], function (err, result) {
                        if (!err) {
                            if (result.length == 0) {
                                callback(null);
                            } else {
                                if (result[0].DROP_FLAG == 1) {
                                    jsonData.DROP_DATE = result[0].DROP_DATE;
                                    callback(3); //!< 탈퇴 예정 계정.
                                } else {
                                    callback(4); //!< 중복.
                                }
                            }
                        } else {
                            callback(err);
                        }
                    });
            },
            function (callback) { //!< 계정 생성 & USER_UID 조회.
                logging.info("CreateAccount Success : " + JSON.stringify(client));
                DB.query('CALL INSERT_ACCOUNT(?, ?, ?)', [client.UDID, client.USER_NAME, client.TYPE], function (err, result) {
                    if (!err) {
                        userIndex = result[0][0].USER_UID;

                        SetAccountBaseSettings(userIndex, function (err) {
                            DB.query('CALL UPDATE_DEFALUT_ACCOUNT(?,?,?,?,?,?)',
                                [userIndex, CSVManager.BCharacterCommon.GetData("default_character_slot_count"),
                                    CSVManager.BInventoryCommon.GetData("default_invent_slot_count"), 1,
                                    CSVManager.BStaminaCommon.GetData("default_acting"), CSVManager.BFriendsCommon.GetData("max_delete_count")],
                                (err, result) => {
                                    if (err) PrintError(err);
                                    callback(err);
                                });
                        });
                    } else {
                        callback(err);
                    }
                });
            }
        ], function (err, result) {
            if (err != null) {
                PrintError(err);
                jsonData.result = Number(err);
            }
            console.timeEnd('ANS_ACCOUNT_Create');
            socket.emit('ANS_ACCOUNT', jsonData);
        });

    } catch (e) { PrintError(e); }
}

// 유저 로그인
function loginAccount(socket, client) {
    try {
        console.time("ANS_ACCOUNT_Login");
        var resultData = { result: 0, ATYPE: client.ATYPE };
        var acc = null;
        client = JSON.parse(common.CryptoDecrypt(client.data));
        let userDataObj = {};
        async.waterfall([
            function (callback) { //!< 세션 생성 및 로그인.
                socket.Session = new SessionManager;
                socket.Session.UserLogin(socket, client, function (err, result) {
                    if (Object.keys(result).length > 0)
                        userDataObj.DROP_DATE = result.DROP_DATE;
                    callback(err);
                });
            },
            function (callback) { //!< 유저 세션 로드.
                socket.Session.LoadUserSessionInfo();

                acc = socket.Session.GetAccount();
                userDataObj.current_time = new Date().format("yyyy-MM-dd HH:mm:ss");
                userDataObj.name = acc.USER_NAME;
                userDataObj.level = acc.USER_LEVEL;
                userDataObj.exp = acc.USER_EXP;
                userDataObj.del_friend_limit = acc.DEL_FRIEND_LIMIT;
                userDataObj.add_dungeon_limit = acc.ADD_DUNGEON_LIMIT;
                userDataObj.delegate_icon = acc.DELEGATE_ICON;
                userDataObj.comment = acc.COMM;
                userDataObj.mileage = acc.MILEAGE;
                userDataObj.character_slot = acc.CHARACTER_SLOT;
                userDataObj.inven_slot = acc.INVEN_SLOT;
                userDataObj.battle_common = CSVManager.BBattleCommon.data;

                //에셋번들 openssl 암호화 키 (imageframe.game)
                userDataObj.dkey = "21FBE3FADEEE96A5CE4E366F6AE05DB7";
                userDataObj.div = "9E3BCEF4E0BC8F94";

                try { userDataObj.tutorial = JSON.parse(acc.TUTORIAL);
                } catch (e) { console.log(e); }
                
                try { userDataObj.push = JSON.parse(acc.PUSH);
                } catch (e) { console.log(e); }

                logging.info('[' + acc.USER_NAME + '] Login');
                callback(null);
            }
        ], function (err, result) {
            if (err) {
                PrintError(err);
                resultData.result = Number(err);
            }
            resultData.data = common.CryptoEncrypt(userDataObj);
            console.timeEnd("ANS_ACCOUNT_Login");
            socket.emit('ANS_ACCOUNT', resultData);

            // 공지사항 조회
            logSelectDB.query("SELECT `TYPE`, `CONTENT`, DATE_FORMAT(START_TIME, '%Y-%m-%d %T') START_TIME, "
                + "DATE_FORMAT(END_TIME, '%Y-%m-%d %T') END_TIME, `INTERVAL`, `ACTIVE` FROM NOTICE", (error, result) => {
                if(error) {
                    console.log("NotifyNotice Error : " + error);
                } else {
                    socket.emit('ANS_NOTIFY', { ATYPE: '106', NOTICE: result });
                }
            });
        });
    } catch (e) { PrintError(e); }
}

// 캐릭터 슬롯 증가
function updateAccountCharacter(socket, client) {
    console.time("ANS_ACCOUNT_200");
    try {
        var acc = socket.Session.GetAccount();
        var items = socket.Session.GetItems();
        var cha_slot_lvl = parseInt(((acc.CHARACTER_SLOT - CSVManager.BCharacterCommon.GetData("default_character_slot_count")) / 20)) + 1;
        var result = 0;

        var addSlot = CSVManager.BCharacterCommon.GetData("character_slot_count_expansion" + cha_slot_lvl);
        var consumeCash = CSVManager.BCharacterCommon.GetData("character_slot_cash_expansion" + cha_slot_lvl);

        if (addSlot == undefined || consumeCash == undefined) {
            result = 3;
            socket.emit('ANS_ACCOUNT', { 'ATYPE': client.ATYPE, 'result': result });
            return;
        }
        var cash = null;
        for (var i = 0; i < items.length; i++) {
            if (items[i].ITEM_ID == DefineItem.PEARL) {
                cash = items[i];
                break;
            }
        }

        if (cash) {
            if (cash.ITEM_COUNT < consumeCash) {
                result = 1;
                socket.emit('ANS_ACCOUNT', { 'ATYPE': client.ATYPE, 'result': result });
                return;
            }
        } else {
            result = 2;
            socket.emit('ANS_ACCOUNT', { 'ATYPE': client.ATYPE, 'result': result });
            return;
        }


        DB.query('CALL UPDATE_ACCOUNT(?,?,?,?,?)', [0, acc.USER_UID, addSlot, null, null], function (err, res) {
            if (!err) {
                acc.CHARACTER_SLOT += addSlot;

                Item.UpdateMoney(socket, 1, "cash", -consumeCash, function (cErr, cRes) {
                    if (cErr) {
                        PrintError(cErr);
                        result = 2;
                    } else {
                        console.timeEnd("ANS_ACCOUNT_200");
                        socket.emit('ANS_ACCOUNT', { 'ATYPE': client.ATYPE, 'result': result, 'DATA': { CHARACTER_SLOT: acc.CHARACTER_SLOT, CASH: cRes[0] } });
                    }

                });
            } else {
                PrintError(err);
                result = 2;
                socket.emit('ANS_ACCOUNT', { 'ATYPE': client.ATYPE, 'result': result, 'DATA': null });
            }
        });

    } catch (e) { PrintError(e); }
}

// 인벤토리 슬롯 증가
function updateAccountInven(socket, client) {
    console.time("ANS_ACCOUNT_203");
    try {
        var acc = socket.Session.GetAccount();
        var items = socket.Session.GetItems();
        var inven_slot_lvl = parseInt(((acc.INVEN_SLOT - CSVManager.BInventoryCommon.GetData("default_invent_slot_count")) / 10)) + 1;
        var result = 0;

        var addSlot = CSVManager.BInventoryCommon.GetData("expand_invent_slot" + inven_slot_lvl);
        var consumeCash = CSVManager.BInventoryCommon.GetData("expand_invent_cash" + inven_slot_lvl);
        var cash = null;
        if (addSlot == undefined || consumeCash == undefined) {
            result = 3;
            socket.emit('ANS_ACCOUNT', { 'ATYPE': client.ATYPE, 'result': result });
            return;
        }
        for (var i = 0; i < items.length; i++) {
            if (items[i].ITEM_ID == DefineItem.PEARL) {
                cash = items[i];
                break;
            }
        }

        if (cash) {
            if (cash.ITEM_COUNT < consumeCash) {
                result = 1;
                socket.emit('ANS_ACCOUNT', { 'ATYPE': client.ATYPE, 'result': result });
                return;
            }
        } else {
            result = 2;
            socket.emit('ANS_ACCOUNT', { 'ATYPE': client.ATYPE, 'result': result });
            return;
        }

        DB.query('CALL UPDATE_ACCOUNT(?,?,?,?,?)', [1, acc.USER_UID, addSlot, null, null], function (err, res) {
            if (!err) {
                acc.INVEN_SLOT += addSlot;

                Item.UpdateMoney(socket, 2, "cash", -consumeCash, function (cErr, cRes) {
                    console.timeEnd("ANS_ACCOUNT_203");
                    if (cErr) {
                        PrintError(err);
                        result = 2;
                        socket.emit('ANS_ACCOUNT', { 'ATYPE': client.ATYPE, 'result': result, 'DATA': null });
                    } else {
                        socket.emit('ANS_ACCOUNT', { 'ATYPE': client.ATYPE, 'result': result, 'DATA': { INVEN_SLOT: acc.INVEN_SLOT, CASH: cRes[0] } });
                    }
                });
            } else {
                PrintError(err);
                result = 2;
                socket.emit('ANS_ACCOUNT', { 'ATYPE': client.ATYPE, 'result': result, 'DATA': null });
            }
        });

    } catch (e) { PrintError(e); }
}

// 대표 캐릭터 및 자기소개 설정
function updateAccountDelegateCharacter(socket, client) {
    try {
        console.time("ANS_ACCOUNT_201");
        var result = 0;

        if (client.DELEGATE_ICON == undefined || client.COMMENT == undefined) {
            result = 1;
            socket.emit('ANS_ACCOUNT', { 'ATYPE': client.ATYPE, 'result': result });
            return;
        }

        var acc = socket.Session.GetAccount();

        DB.query('UPDATE ACCOUNT SET DELEGATE_ICON = ?, COMM = ? WHERE USER_UID = ? '
            , [client.DELEGATE_ICON, client.COMMENT, acc.USER_UID], function (err, res) {
                if (err) {
                    PrintError(err);
                    result = 1;
                } else {
                    acc.DELEGATE_ICON = client.DELEGATE_ICON;
                    acc.COMM = client.COMMENT;
                }
                console.timeEnd("ANS_ACCOUNT_201");
                socket.emit('ANS_ACCOUNT', { 'ATYPE': client.ATYPE, 'result': result });
            });

    } catch (e) { PrintError(e); }
}

// 대표룸 설정
function updateAccountDelegateMyRoom(socket, client) {
    console.time("ANS_ACCOUNT_202");
    try {
        var result = 0;
        if (client.DELEGATE_MYROOM == undefined) {
            result = 1;
            socket.emit('ANS_ACCOUNT', { 'ATYPE': client.ATYPE, 'result': result });
            return;
        }
        var acc = socket.Session.GetAccount();

        DB.query('UPDATE ACCOUNT SET DELEGATE_MYROOM = ? WHERE USER_UID = ? '
            , [client.DELEGATE_MYROOM, acc.USER_UID], function (err, res) {
                if (err) {
                    PrintError(err);
                    result = 1;
                } else {
                    acc.DELEGATE_MYROOM = client.DELEGATE_MYROOM;
                }
                console.timeEnd("ANS_ACCOUNT_202");
                socket.emit('ANS_ACCOUNT', { 'ATYPE': client.ATYPE, 'result': result });
            });

    } catch (e) { PrintError(e); }
}

// 튜토리얼 진행 단계 저장
function updateTutorial(socket, client) {
    console.time("ANS_ACCOUNT_204");
    let result = 0;
    let tutorialObj = client.TUTORIAL || null;
    let acc = socket.Session.GetAccount();

    if (typeof tutorialObj != "object") {
        result = 2;
        socket.emit('ANS_ACCOUNT', { 'ATYPE': client.ATYPE, 'result': result });
        return;
    }

    let keyList = ['main', 'dungeon', 'raid', 'pvp', 'myroom', 'manufact', 'farming', 'mission', 'mail'];
    let checkFlag = true;
    for (let i = 0; i < keyList.length; i++) {
        if (tutorialObj.hasOwnProperty(keyList[i]) == false) {
            checkFlag = false;
            break;
        }
    }

    if (!checkFlag) {
        result = 2;
        socket.emit('ANS_ACCOUNT', { 'ATYPE': client.ATYPE, 'result': result });
        return;
    }

    try { tutorialObj = JSON.stringify(tutorialObj); } catch (error) { PrintError(error); }
    if (tutorialObj == 'null') {
        result = 2;
        socket.emit('ANS_ACCOUNT', { 'ATYPE': client.ATYPE, 'result': result });
        return;
    }

    DB.query('UPDATE ACCOUNT SET TUTORIAL = ? WHERE USER_UID = ?', [tutorialObj, acc.USER_UID], function (error, res) {
        if (error) {
            PrintError(error);
            result = 1;
        }
        console.timeEnd("ANS_ACCOUNT_204");
        socket.emit('ANS_ACCOUNT', { 'ATYPE': client.ATYPE, 'result': result });
    });
}

// 유저 탈퇴
function leaveAccount(socket, client) {
    let acc = socket.Session.GetAccount();
    let resResult = 0;

    DB.query("UPDATE ACCOUNT SET DROP_FLAG=1, DROP_DATE= NOW() WHERE USER_UID = ?", [acc.USER_UID], (error, result) => {
        if(error){
            PrintError(error);
            resResult = 1;
        }
        socket.emit('ANS_ACCOUNT', { 'ATYPE': client.ATYPE, 'result': resResult });
    });
}