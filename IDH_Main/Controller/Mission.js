/**
 * 미션 Controller
 * 
 * 계정 생성 시 daily, weekly, achieve, quest 기본 데이터(일반, 달성도) 추가
 * 
 * 각 미션에 맞는 위치에서 Mission.addMission, 미션 성공 카운트 누적
 * 
 * Daily는 매일, Weekly는 매주 초기화
 * 
 * 미션 진입 getMission
 *  - 해당 미션 달성, 달성도 여부 판단
 * 
 * 미션 보상 지급 receiveReward
 *  - Daily, Weekly는 보상지급
 *  - Achieve는 해당 미션 다음 레벨 로 mission_uid 변경 및 카운트 초기화
 *  - Quest는 다음 미션으로 mission_uid 변경 및 카운트 초기화
 */

module.exports.OnPacket = function (socket) {
    // 일일/주간 미션(10개), 업적(10개), 퀘스트
    socket.on("REQ_MISSION", function (client) {
        try {
            if (client.ATYPE !== undefined) {

                var packetType = aTypeParser(client.ATYPE);

                if (packetType.cType == "0") {
                    switch (packetType.aType) {
                        case "00": receiveReward(socket, client); break;
                        case "01": totalReward(socket, client); break;
                        default: break;
                    }
                } else if (packetType.cType == "1") {
                    switch (packetType.aType) {
                        case "00": getMission(socket, client); break;
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
 * 해당 미션 카운트 추가
 * 미션 ID와 추가 카운트 넘겨주면 해당 미션 있을 경우 UPDATE
 */
exports.addMission = function (user_uid, missionId, value) {
    if (missionId == null || missionId == 0 || value == null || value == 0) {
        return;
    }
    let que = DB.query("CALL ADD_MISSION_CNT(?,?,?)", [user_uid, missionId, value], function (error, result) {
        //console.log(que.sql);
        if (error)
            PrintError(error);
    });
}

/**
 * 데이터 관리가 필요한 미션 카운트 증가
 * 미션 ID와 추가 카운트 넘겨주면 해당 미션 있을 경우 UPDATE
 */
exports.addMissionLog = function (user_uid, missionId, value1, value2) {
    var missionIdList = [8000024, 8000027];

    if (missionIdList.indexOf(missionId) < 0) {
        return;
    }
    var type = 0;

    DB.query("CALL INSERT_MISSION_LOG(?,?,?,?,?)", [type, user_uid, missionId, value1, value2], function (error, result) {
        if (error)
            PrintError(error);
    });
}

// 미션 체크 및 조건 달성한 경우 카운트 증가
exports.ChenckAndUpdateMission = function (type, userUid, missionId, condition) {
    selectDB.query("SELECT * FROM " + type + " WHERE USER_UID = ? AND MISSION_ID = ? AND REWARD = 0", [userUid, missionId], function (error, res) {
        if (error) {
            PrintError(error);
        } else {
            if (res.length > 0) {
                let csvObj;
                switch (type) {
                    case "ACHIEVE":
                        csvObj = CSVManager.BAchieve.GetData(res[0].MISSION_UID);
                        break;
                    case "QUEST":
                        csvObj = CSVManager.BQuest.GetData(res[0].MISSION_UID);
                        break;
                }

                if (condition >= csvObj.value2) {
                    DB.query("UPDATE " + type + " SET VALUE = VALUE + 1 WHERE USER_UID = ? AND MISSION_UID = ? AND REWARD = 0",
                        [userUid, res[0].MISSION_UID], function (err, res) {
                            if (err) {
                                PrintError(err);
                            }
                        });
                }
            }
        }
    });
}

// 미션 데이터 조회
exports.GetMissionData = function (userUid, storyList, callback) {

    let jsonData = { result: 0 };
    console.log("GetMissionData #1");

    selectDB.query("CALL SELECT_MISSION_LOG(?,?)", [0, userUid], function (logErr, logRes) {
        if (logErr) {
            jsonData.result = 1;
            callback(jsonData);
        } else {

            console.log("GetMissionData #2");

            async.parallel({
                daily: function (cb) {
                    selectDB.query("CALL SELECT_MISSION(?,?)", [0, userUid], function (error, result) {
                        if (error) {
                            cb(error, null);
                        } else {
                            console.log("GetMissionData daily");
                            var mission = result[0];
                            if (mission.length > 0) {
                                jsonData.DAILY = setMissionData(CSVManager.BDailyMission.data, mission, 0, logRes[0], storyList);
                            }
                            cb(null, null);
                        }
                    });
                }, weekly: function (cb) {
                    selectDB.query("CALL SELECT_MISSION(?,?)", [1, userUid], function (error, result) {
                        if (error) {
                            cb(error, null);
                        } else {
                            var mission = result[0];
                            if (mission.length > 0) {
                                jsonData.WEEKLY = setMissionData(CSVManager.BWeeklyMission.data, mission, 1, logRes[0], storyList);
                            }
                            cb(null, null);
                        }
                    });
                }, achieve: function (cb) {
                    selectDB.query("CALL SELECT_MISSION(?,?)", [2, userUid], function (error, result) {
                        if (error) {
                            cb(error, null);
                        } else {

                            console.log("GetMissionData achieve");            

                            var mission = result[0];
                            if (mission.length > 0) {
                                jsonData.ACHIEVE = setMissionData(CSVManager.BAchieve.data, mission, 2, logRes[0], storyList);
                                console.log("ACHIEVE in Mission :: " + jsonData.ACHIEVE);
                                
                            }
                            cb(null, null);
                        }
                    });
                }, quest: function (cb) {
                    selectDB.query("CALL SELECT_MISSION(?,?)", [3, userUid], function (error, result) {
                        if (error) {
                            cb(error, null);
                        } else {
                            var mission = result[0];
                            if (mission.length > 0) {
                                jsonData.QUEST = setMissionData(CSVManager.BQuest.data, mission, 3, logRes[0], storyList);
                            }
                            cb(null, null);
                        }
                    });
                }
            }, function (error, results) {
                if (error) {
                    jsonData.result = 1;
                }
                callback(jsonData);
            });
        }
    });
}

// 미션 조회
function getMission(socket, client) {
    console.log('getMission Called');
    
    console.time("ANS_MISSION_100");
    var acc = socket.Session.GetAccount();
    var storyList = socket.Session.GetStory();
    Mission.GetMissionData(acc.USER_UID, storyList, (jsonObj) => {
        async.series([
            (callback) => {
                // 기본 테이블 스토리 관련 미션 추가 시
                // 마지막 스토리 업적 INDEX를 조회 하여 다음 UID로 업데이트
                let lastStoryAchieveObj = null;
                for (let i = 0; i < jsonObj.ACHIEVE.LIST.length; i++) {
                    
                    if(jsonObj.ACHIEVE.LIST[i].UID == CSVManager.BMissionCommon.GetData("last_story_achieve_index") && jsonObj.ACHIEVE.LIST[i].R == 1) {
                        lastStoryAchieveObj = jsonObj.ACHIEVE.LIST[i];
                        break;
                    }
                }
                if (lastStoryAchieveObj != null) {
                    let next = CSVManager.BAchieve.GetNextData(lastStoryAchieveObj.UID);
                    if (next != null) {
                        DB.query("UPDATE ACHIEVE SET MISSION_UID = ?, REWARD = 0 WHERE USER_UID = ? AND MISSION_UID = ?",
                                [next.uid, acc.USER_UID, lastStoryAchieveObj.UID], (error, result) => {
                                    callback(error, null);
                                });
                    } else {
                        callback(null, null);
                    }
                } else {
                    callback(null, null);
                }
            }, (callback) => {
                // 기본 테이블 퀘스트 데이터 추가 시 마지막 퀘스트 INDEX를 조회 하여 다음 퀘스트 데이터 추가
                let lastQuestObj = jsonObj.QUEST.LIST[jsonObj.QUEST.LIST.length - 1];
                if (lastQuestObj.UID == CSVManager.BMissionCommon.GetData("last_quest_index") && lastQuestObj.R == 1) {
                    //다음 퀘스트 생성
                    let next = CSVManager.BQuest.GetData(lastQuestObj.UID + 1);
                    if (next != null) {
                        DB.query("INSERT INTO `quest` (`USER_UID`, `MISSION_UID`, `MISSION_ID`, `VALUE`, `REWARD`) VALUES (?, ?, ?, 0, 0)",
                            [acc.USER_UID, next.uid, next.id], (error, result) => {
                                callback(error, null);
                            });
                    } else {
                        callback(null, null);
                    }
                } else {
                    callback(null, null);
                }
            }, (callback) => {
                // 기본 테이블 퀘스트 달성도 데이터 추가 시 마지막 퀘스트 달성도 INDEX를 조회 하여 다음 퀘스트 데이터 추가
                let lastQuestTopObj = jsonObj.QUEST.TOP[jsonObj.QUEST.TOP.length - 1];
                if (lastQuestTopObj.UID == CSVManager.BMissionCommon.GetData("last_quest_accum_index") && lastQuestTopObj.R == 1) {
                    //다음 달성도 생성
                    let topNext = CSVManager.BAccumReward.GetData(lastQuestTopObj.UID + 1);
                    if (topNext != null) {
                        DB.query("INSERT INTO `quest` (`USER_UID`, `MISSION_UID`, `MISSION_ID`, `VALUE`, `REWARD`) VALUES (?, ?, ?, 0, 0)",
                        [acc.USER_UID, topNext.uid, 0], (error, result) => {
                            callback(error, null);
                        });
                    } else {
                        callback(null, null);
                    }
                } else {
                    callback(null, null);
                }
            }
        ], (error) => {
            if(error) console.log(error);
            jsonObj.ATYPE = client.ATYPE;
            console.timeEnd("ANS_MISSION_100");
            socket.emit("ANS_MISSION", jsonObj);
        });
    });
}

// 일일/주간/업적/퀘스트 및 각 달성도 데이터 셋팅
function setMissionData(csvData, missionList, type, logRes, storyList) {
    let mList = [];
    let tList = [];
    //Mission Data : { UID: 미션 UID, V: 미션카운트, R: 보상 지급 여부 }
    for (var i = 0; i < csvData.length; i++) {
        for (var j = 0; j < missionList.length; j++) {
            if (csvData[i].uid == missionList[j].MISSION_UID) {
                var missionObj = { UID: missionList[j].MISSION_UID, V: missionList[j].VALUE, R: missionList[j].REWARD };
                switch (missionList[j].MISSION_ID) {
                    case 8000013:
                        if (missionObj.V != 0) {
                            missionObj.V = 0;
                            let storyObj = common.findObjectByKey(storyList, "STORY_ID", csvData[i].value2);
                            if(storyObj != null && storyObj.CLEAR == 1) missionObj.V = 1;
                        } else missionObj.V = 0;
                        break;
                    case 8000030:
                        if (missionList[j].VALUE != 0 && csvData[i].value2 <= missionList[j].VALUE)
                            missionObj.V = 1;
                        else
                            missionObj.V = 0;
                        break;
                    case 8000024: case 8000027:
                        missionObj.V = 0;
                        for (var k = 0; k < logRes.length; k++) {
                            if (csvData[i].id == logRes[k].MISSION_ID && csvData[i].value1 == logRes[k].VALUE1) {
                                missionObj.V = logRes[k].VALUE2;
                            }
                        }
                        break;
                    default:
                        missionObj.V = missionList[j].VALUE;
                        break;
                }
                mList.push(missionObj);
            }
        }
    }
    // 달성도
    for (var k = 0; k < missionList.length; k++) {
        if (missionList[k].MISSION_UID.toString().substr(0, 2) == "85") {
            var csvObj = CSVManager.BAccumReward.GetData(missionList[k].MISSION_UID);
            if (csvObj != null) {
                if (csvObj.type == type) {
                    tList.push({ UID: missionList[k].MISSION_UID, V: missionList[k].VALUE, R: missionList[k].REWARD });
                }
            }
        }
    }
    return { TOP: tList, LIST: mList };
}

// 미션 관련 기본 데이터 파일 조회
function GetCSVObj(type, missionUid) {
    var obj = {};
    switch (type) {
        case 0: obj = CSVManager.BDailyMission.GetData(missionUid); break;
        case 1: obj = CSVManager.BWeeklyMission.GetData(missionUid); break;
        case 2: obj = CSVManager.BAchieve.GetData(missionUid); break;
        case 3: obj = CSVManager.BQuest.GetData(missionUid); break;
        case 4: obj = CSVManager.BAccumReward.GetData(missionUid); break;
    }
    return obj;
}

// 미션 보상 수령
function receiveReward(socket, client) {
    console.time("ANS_MISSION_000");
    var acc = socket.Session.GetAccount();
    var storyList = socket.Session.GetStory();
    var m_type = client.T;
    var m_uid = client.UID;


    if (m_type == undefined || m_uid == undefined) {
        socket.emit("ANS_MISSION", { result: 1, ATYPE: client.ATYPE });
        return;
    }
    async.waterfall([
        function (callback) {
            if (m_uid == 0) {
                selectDB.query("CALL SELECT_MISSION(?,?)", [m_type, acc.USER_UID], function (error, result) {
                    if (error) {
                        callback(error, null);
                    } else {
                        if (result[0].length > 0) {
                            var uidList = [];
                            for (var i = 0; i < result[0].length; i++) {
                                if (result[0][i].MISSION_UID < 8500000 && result[0][i].REWARD == 0)
                                    uidList.push(result[0][i].MISSION_UID);
                            }
                            callback(null, uidList);
                        } else {
                            callback("Mission Empty", null);
                        }
                    }
                });
            } else {
                callback(null, [m_uid]);
            }
        }], function (error, uidList) {
            if (error) {
                PrintError(error);
                socket.emit("ANS_MISSION", { result: 1, ATYPE: client.ATYPE });
            } else {
                GetMissionReward(acc.USER_UID, m_type, m_uid, uidList, storyList, function (gErr, jsonData) {
                    jsonData.ATYPE = client.ATYPE;
                    if (gErr) {
                        jsonData.result = 1;
                        PrintError(gErr);
                        if (gErr == 2)
                            jsonData.result = 2;
                    }
                    console.timeEnd("ANS_MISSION_000");
                    socket.emit("ANS_MISSION", jsonData);
                });
            }
        });
}

// 미션 보상 아이템 조회 및 미션 다음 레벨로 증가
function GetMissionReward(user_uid, m_type, uid, uidList, storyList, callback) {

    var jsonData = { result: 0, TOP: [], LIST: [], REWARD: [] };
    var rewardList = [];

    async.eachSeries(uidList, function (m_uid, eCallback) {

        var CSVObj = GetCSVObj(m_type, m_uid);
        var nextUid = 0;
        var nextId = 0;
        var nextValue = 0;

        switch (m_type) {
            case 2:
                var next = CSVManager.BAchieve.GetNextData(m_uid);
                if (next != undefined && next.id == CSVObj.id) {
                    nextUid = next.uid || 0;
                    nextId = next.id || 0;
                }
                break;
            case 3:
                var next = CSVManager.BQuest.GetData(m_uid + 1);
                if (next != undefined) {
                    nextUid = next.uid || 0;
                    nextId = next.id || 0;
                    nextValue = next.value2;
                }
                break;
        }

        var sValue = 0;
        var sValue1 = 0;

        var missionID = CSVObj.id;
        switch (missionID) {
            case 8000013: case 8000030:
                sValue = CSVObj.value2;
                break;
            case 8000024: case 8000027:
                sValue1 = CSVObj.value1;
                sValue = CSVObj.value2;
                break;
            default:
                sValue = CSVObj.value1;
                break;
        }

        async.series([
            (callback) => {
                if(missionID == 8000013) {
                    // 스토리 관련 미션
                    let storyObj = common.findObjectByKey(storyList, "STORY_ID", sValue);
                    sValue1 = 0;
                    
                    if(storyObj != null && storyObj.CLEAR == 1) sValue1 = sValue;
                }
                callback(null);
            }, (callback) => {
                DB.query("CALL UPDATE_MISSION_REWARD(?,?,?,?,?,?,?,?)", [m_type, user_uid, m_uid, sValue, nextUid, nextId, nextValue, sValue1], function (wErr, wRes) {
                    if (wRes[0] == undefined) {
                        //uidList가 전체 리스트 
                        if (uid == 0) callback(null);
                        else callback(2);
                    } else {
                        rewardList.push({ REWARD_ITEM_ID: CSVObj.reward, REWARD_ITEM_COUNT: CSVObj.reward_value, REWARD_DESC: GetMissionRewardStrnig(CSVObj) });
                        var missionObj = wRes[0][0];
                        let CSVObj2 = GetCSVObj(m_type, missionObj.UID);
                        switch (missionID) {
                            case 8000013:
                                if (missionObj.V != 0) {
                                    missionObj.V = 0;
                                    let storyObj = common.findObjectByKey(storyList, "STORY_ID", CSVObj2.value2);
                                    if(storyObj != null && storyObj.CLEAR == 1) missionObj.V = 1;
                                } else missionObj.V = 0;
                                break;
                            case 8000030:
                                if (missionObj.V != 0 && CSVObj2.value2 <= missionObj.V)
                                    missionObj.V = 1;
                                else
                                    missionObj.V = 0;
                                break;
                            case 8000024: case 8000027:
                                missionObj.V = 0;
                                for (var k = 0; k < wRes[2].length; k++) {
                                    if (CSVObj2.value1 == wRes[2][k].VALUE1) {
                                        missionObj.V = wRes[2][k].VALUE2;
                                    }
                                }
                                break;
                        }
        
                        jsonData.LIST.push(missionObj);
                        jsonData.TOP = wRes[1];
        
                        if ([2, 3].indexOf(m_type) > -1) {
                            var curTop = wRes[1][0];
                            var topNextUid = 0;
                            var topCSVObj = GetCSVObj(4, curTop.UID);
        
                            if (curTop.V + 1 == topCSVObj.value) {
                                var topNext = CSVManager.BAccumReward.GetData(curTop.UID + 1);
                                if (topNext != undefined && topNext.type == m_type) {
                                    topNextUid = topNext.uid || 0;
                                }
                            }
                            //달성도
                            DB.query("CALL UPDATE_ACCUM_CNT(?,?,?,?,?,?)", [m_type, user_uid, curTop.UID, topCSVObj.value, topNextUid, 0], function (tErr, tRes) {
                                if (tErr) {
                                    callback(tErr);
                                } else {
                                    jsonData.TOP = tRes[0];
                                    callback(null);
                                }
                            });
                        } else {
                            callback(wErr);
                        }
                    }
                });

            }
        ], (error, result) => {
            eCallback(error);
        });
    }, function (error) {
        if (error) {
            callback(error, jsonData);
        } else {
            Item.SetItemType(rewardList);
            // 메일 알림
            Notification.Notify("MAIL", user_uid);

            async.eachSeries(rewardList, function (obj, cb) {
                // 보상 메일 지급
                Mail.PushMail(user_uid, m_type + 1, obj.ITEM_TYPE, obj.REWARD_ITEM_ID, obj.REWARD_ITEM_COUNT, 0, obj.REWARD_DESC, CSVManager.BMailString.GetData(m_type + 1).limit, function (mErr, mRes) {
                    cb(mErr);
                });
            }, function (error) {
                callback(error, jsonData);
            });
        }
    });
}

// 달성도 보상 수령
function totalReward(socket, client) {
    console.time("ANS_MISSION_001");
    // 달성도
    var acc = socket.Session.GetAccount();
    var jsonData = { result: 0 };
    jsonData.ATYPE = client.ATYPE;

    var m_type = client.T;
    var m_uid = client.UID;

    if (m_type == undefined || m_uid == undefined || m_uid == 0) {
        jsonData.result = 1;
        socket.emit("ANS_MISSION", jsonData);
        return;
    }

    var CSVObj = GetCSVObj(4, m_uid);
    DB.query("CALL CHECK_ACCUM(?,?,?,?)", [m_type, acc.USER_UID, m_uid, CSVObj.value], function (error, result) {
        if (error) {
            jsonData.result = 1;
            socket.emit("ANS_MISSION", jsonData);
        } else {
            if (result[0][0].RESULT == 1) {
                jsonData.TOP = result[1];

                var mailDesc = "";
                switch (m_type) {
                    case 0: mailDesc = "일일 미션 레벨 " + CSVObj.level + " 달성"; break;
                    case 1: mailDesc = "주간 미션 레벨 " + CSVObj.level + " 달성"; break;
                    case 2: mailDesc = "업적 레벨 " + CSVObj.level + " 달성"; break;
                    case 3: mailDesc = "퀘스트 레벨 " + CSVObj.level + " 달성"; break;
                }
                //보상
                var rewardList = [{ REWARD_ITEM_ID: CSVObj.reward, REWARD_ITEM_COUNT: CSVObj.reward_value, REWARD_DESC: mailDesc }];
                Item.SetItemType(rewardList);

                // 메일 알림
                Notification.Notify("MAIL", acc.USER_UID);

                Mail.PushMail(acc.USER_UID, m_type + 1, rewardList[0].ITEM_TYPE, rewardList[0].REWARD_ITEM_ID, rewardList[0].REWARD_ITEM_COUNT, 0,
                    rewardList[0].REWARD_DESC, CSVManager.BMailString.GetData(m_type + 1).limit, function (mErr, mRes) {

                        console.timeEnd("ANS_MISSION_001");
                        socket.emit("ANS_MISSION", jsonData);
                    });
            } else {
                //Error 값 부족
                jsonData.result = 2;
                socket.emit("ANS_MISSION", jsonData);
            }
        }
    });
}

// 미션 이름 셋팅
function GetMissionRewardStrnig(CSVObj) {
    var rewardDesc = CSVManager.BMissionDefine.GetData(CSVObj.id).string;
    try {
        var value1 = CSVObj.value1;
        var value2 = CSVObj.value2;
        if (rewardDesc.indexOf('{0}') > -1 || rewardDesc.indexOf('{1}') > -1) {
            switch (CSVObj.id) {
                case 8000013:
                    value2 = CSVManager.BStory.GetData(value2).stage_name;
                    break;
                case 8000024: case 8000027:
                    switch (value2) {
                        case 1: value2 = "보통"; break;
                        case 2: value2 = "어려움"; break;
                        case 3: value2 = "매우 어려움"; break;
                    }
                    break;
                case 8000030:
                    value2 = CSVManager.BRateReward.GetData(value2).rateName;
                    break;
            }
            rewardDesc = sf(rewardDesc, value1, value2);
        }

    } catch (e) {
        PrintError(e);
    }
    return rewardDesc;
}