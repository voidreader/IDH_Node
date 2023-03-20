/**
 * 스토리 Controller
 * Default Data로 1-1 insert 된 상태로 시작
 * 해당 스토리 Clear 시 다음 단계 스토리 Data Insert 하는 방식
 */

module.exports.OnPacket = function (socket) {
    socket.on("REQ_STORY", function (client) {
        try {
            if (client.ATYPE !== undefined) {

                var packetType = aTypeParser(client.ATYPE);

                if (packetType.cType == "0") {
                    switch (packetType.aType) {
                        default: break;
                    }
                } else if (packetType.cType == "1") {
                    switch (packetType.aType) {
                        case "00": getStory(socket, client); break;
                        case "01": startStory(socket, client); break;
                        case "02": clearStory(socket, client); break;
                        case "03": getChapterReward(socket, client); break;
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

// 스토리 정보 조회
function getStory(socket, client) {
    
    socket.emit('ANS_STORY', { 'ATYPE': client.ATYPE, "result": 0, 'STORY_LIST': socket.Session.GetStory() });
}

// 스토리 시작
function startStory(socket, client) {
    console.time("ANS_STORY_201");
	/*
	슬롯 점검, story 단계 확인, 캐릭터 확인, 전투력 검증, 
	*/
    var acc = socket.Session.GetAccount();

    if (client.STORY_ID == undefined || client.TEAM == undefined) {
        result = 9;
        socket.emit('ANS_STORY', { 'ATYPE': client.ATYPE, 'result': result });
        return;
    }
    var userStoryList = socket.Session.GetStory();
    var userItemList = socket.Session.GetItems();

    var result = 0;
    var checkInvenFlag = common.checkItemSlot(socket, 1);
    var checkCharacterFlag = common.checkCharacterSlot(socket, 1);

    //아이템 슬롯 부족
    if (!checkInvenFlag) result = 1;
    if (!checkCharacterFlag) result = 2;

    var storyObj = common.findObjectByKey(userStoryList, "STORY_ID", client.STORY_ID);
    if (storyObj == null) {
        result = 3;
        socket.emit('ANS_STORY', { 'ATYPE': client.ATYPE, 'result': result });
        return;
    }

    var resRewardList = [];
    // 스트라이커 데이터
    var resFriendObj = { ICON: -1, LIST: [], SKILL: -1 };

    var storyCSVData = CSVManager.BStory.GetData(client.STORY_ID);
    var chapterObj = CSVManager.BChapter.GetChapterID(storyCSVData.chapter, storyCSVData.difficulty);

    async.series([
        (scb) => {
            // 행동력 수량 조회
            selectDB.query("CALL SELECT_ITEM(?,?,?,?)", [2, acc.USER_UID, DefineItem.BEHAVIOR, null], function (cErr, cRes) {
                if (cErr) {
                    PrintError(cErr);
                    result = 5;
                    scb(result);
                } else {
                    let actingObj;
                    for (let i = 0; i < userItemList.length; i++) {
                        if (userItemList[i].ITEM_UID == cRes[0][0].ITEM_UID) {
                            userItemList[i].ITEM_COUNT = cRes[0][0].ITEM_COUNT;
                            actingObj = userItemList[i];
                        }
                    }
                    if (actingObj == null || actingObj.ITEM_COUNT < chapterObj.stamina) {
                        result = 6;
                        scb(6);
                    } else {
                        scb(null);
                    }
                }
            });
        },
        (scb) => { 
            // 스트라이커(친구) 데이터 저장 및 전투력 관련 데이터 셋팅
            if (client.FRIEND_UID && client.FRIEND_UID != -1) {
                Friend.SetStriker(acc.USER_UID, client.FRIEND_UID);
                Mission.addMission(acc.USER_UID, 8000047, 1);
                DB.query("CALL SELECT_STRIKER(?)", [client.FRIEND_UID], (error, res) => {
                    if (error) {
                        PrintError(error);
                        result = 5;
                        scb(null);
                    } else {
                        if (res[0].length > 0) {
                            resFriendObj.ICON = res[0][0].CHA_ID;
                            resFriendObj.UN = res[0][0].USER_NAME;
                            resFriendObj.SKILL = res[1][0].SKILL;

                            if (resFriendObj.SKILL > 0 && res[1].length > 0) {
                                Character.CalculateCharacterListCombat(res[1][0].USER_UID, null, res[1], null, (combat, statList) => {
                                    for (let i = 0; i < res[1].length; i++) {
                                        delete res[1][i]["DELEGATE_ICON"];
                                        delete res[1][i]["SKILL"];
                                        delete res[1][i]["ENCHANT"];

                                        for (let j = 0; j < statList.length; j++) {
                                            if (res[1][i].CHA_UID == statList[j].CHA_UID) {
                                                res[1][i].STAT = statList[j].STAT;
                                                res[1][i].AUTORECOVERY = statList[j].AUTORECOVERY;
                                                res[1][i].CRITICAL = statList[j].CRITICAL;
                                                break;
                                            }
                                        }
                                        resFriendObj.LIST.push(res[1][i]);
                                    }
                                    scb(null);
                                });
                            } else {
                                //
                                let tempObj = { CHA_UID: 0, CHA_ID: 0, ENCHANT: 0 };
                                tempObj.CHA_UID = res[0][0].CHA_UID;
                                tempObj.CHA_ID = res[0][0].CHA_ID;
                                tempObj.ENCHANT = res[0][0].ENCHANT;

                                Character.CalculateCharacterListCombat(res[1][0].USER_UID, null, [tempObj], null, (combat, statList) => {
                                    tempObj.STAT = statList[0].STAT;
                                    tempObj.AUTORECOVERY = statList[0].AUTORECOVERY;
                                    tempObj.CRITICAL = statList[0].CRITICAL;
                                    resFriendObj.LIST.push(tempObj);
                                    scb(null);
                                });
                            }
                        } else {
                            scb(null);
                        }
                    }
                });
            } else scb(null);
        },
        (scb) => {
            // 핫 타임 적용
            HotTime.GetHotTime((hotRes) => {
                var hotTimeBehavior = null;
                for(let i = 0; i < hotRes.length; i++){
                    switch(hotRes[i].TYPE){
                        case 3: hotTimeBehavior = hotRes[i].VALUE / 100; break;
                    }
                }
                // result - 0: 정상, 1: 아이템 슬롯 부족, 2: 캐릭터 슬롯 부족
                if ([0, 1, 2].indexOf(result) >= 0) {
                    for (var i = 0; i < userStoryList.length; i++)
                        if (userStoryList[i].STORY_ID == client.STORY_ID) userStoryList[i].ACTIVE = true;
    
                    var rewardList = [];
                    var mileage = chapterObj.stamina * CSVManager.BMyRoomCommon.GetData("convert_act");
                    let stamina = chapterObj.stamina;
                    if(hotTimeBehavior != null) stamina = stamina - (stamina * hotTimeBehavior);
                    stamina = parseInt(stamina);
                    rewardList.push({ REWARD_ITEM_ID: DefineItem.BEHAVIOR, REWARD_ITEM_COUNT: -stamina });
                    rewardList.push({ REWARD_ITEM_ID: DefineItem.MILEAGE, REWARD_ITEM_COUNT: Math.round(mileage * 100) / 100 });
    
                    Item.addRewardItem(socket, rewardList, 0, function (aErr, aRes) {
                        if (aErr) {
                            PrintError(cErr);
                            result = 5;
                            scb(result);
                        } else {
                            resRewardList = aRes;
                            scb(null);
                        }
                    });
                } else scb(null);
            });
        },
        // 내 팀 전투력 계산
        (scb) => { Character.CalculateTeamCombat(null, client.TEAM, socket, (error, result, statList) => { scb(null, statList); }); },
        (scb) => {
            // 난이도 정보
            let stageCSVData = CSVManager.BStage.GetData(storyCSVData.stageId);
            let increase = 0; // 난이도 별 증감치
            switch (storyCSVData.difficulty) {
                case 2: increase = parseFloat(CSVManager.BBattleCommon.GetData("Hard")); break;
                case 3: increase = parseFloat(CSVManager.BBattleCommon.GetData("VeryHard")); break;
            }
            
            // 적 캐릭터 전투력 계산
            let statList = [];
            let keyList = [];
            for (let key in stageCSVData) {
                if (key != 'id' && stageCSVData[key] > -1) {
                    if (keyList.indexOf(stageCSVData[key]) < 0) {
                        keyList.push(stageCSVData[key]);
                        let chaStat = Character.calculateCharacterCombat({ CHA_ID: stageCSVData[key], ENCHANT: 0 }, [], null);
                        
                        let tempObj = {
                            CHA_ID: stageCSVData[key],
                            STAT: [0, chaStat.strength, chaStat.damage, chaStat.defensive, chaStat.action, chaStat.agility,
                                chaStat.concentration, chaStat.recovery, chaStat.mentality, chaStat.aggro],
                                AUTORECOVERY: chaStat.autoRecovery, CRITICAL: chaStat.critical
                            };
                            if (increase != 0) {
                                for (let index in tempObj.STAT)
                                tempObj.STAT[index] = parseFloat((tempObj.STAT[index] * increase).toFixed(2));
                                tempObj.AUTORECOVERY = parseFloat((tempObj.AUTORECOVERY * increase).toFixed(2));
                                tempObj.CRITICAL = parseFloat((tempObj.CRITICAL * increase).toFixed(2));
                            }
                        statList.push(tempObj);
                    }
                }
            }
            scb(null, statList);
        }
    ], (error, results) => {
        // 스토리 미션 데이터
        let missionList = [];
        missionList.push({ ID: storyCSVData.missionId1, V1: storyCSVData.missionId1_value, V2: storyCSVData.missionId1_string });
        missionList.push({ ID: storyCSVData.missionId2, V1: storyCSVData.missionId2_value, V2: storyCSVData.missionId2_string });
        missionList.push({ ID: storyCSVData.missionId3, V1: storyCSVData.missionId3_value, V2: storyCSVData.missionId3_string });
        
        console.timeEnd("ANS_STORY_201");
        socket.emit('ANS_STORY', {
            'ATYPE': client.ATYPE, 'result': result, 'REWARD': resRewardList,
            'FRIEND': resFriendObj, 'STAT': results[3], 'ENEMY': results[4], 'MISSION': missionList
        });
    });
}

// 스토리 완료
function clearStory(socket, client) {
    console.time("ANS_STORY_202");
	/*
	1. 검증(활성화 된 스테이지 인지, 가능한 스테이지 인지)
	2. 다음 스테이지 오픈
    3. 보상 지급
	*/

    var acc = socket.Session.GetAccount();
    var result = 0;
    let aType = client.ATYPE;
    client = JSON.parse(common.CryptoDecrypt(client.data));

    let team = client.TEAM || 1;
    if (client.STORY_ID == undefined || client.CLEAR == undefined || client.MISSION1 == undefined || client.MISSION2 == undefined
        || client.MISSION3 == undefined || client.OVERKILL == undefined) {
        result = 1;
        socket.emit('ANS_STORY', { 'ATYPE': aType, 'result': result });
        return;
    }

    // 활성화 된 스토리 검사
    var userStoryList = socket.Session.GetStory();
    for (var i = 0; i < userStoryList.length; i++) {
        if (userStoryList[i].STORY_ID == client.STORY_ID) {
            if (userStoryList[i].ACTIVE != undefined && userStoryList[i].ACTIVE)
                activeFlag = true;
        }
    }
    var storyObj = common.findObjectByKey(userStoryList, "STORY_ID", client.STORY_ID);

    if (storyObj == null) { // OPEN 되지 않은 STORY_ID
        result = 3;
        socket.emit('ANS_STORY', { 'ATYPE': aType, 'result': result });
        return;
    }

    //해당 스테이지 업데이트 clear, 오픈 스테이지 추가(챕터 변경 되면 REWARD도 추가), 보상 ADDITEM, 경험치 추가 
    var storyReward = getStoryReward(client.STORY_ID, client.CLEAR);
    var storyCSVData = CSVManager.BStory.GetData(client.STORY_ID);
    var addExp = storyCSVData.add_exp;

    var chapterObj = CSVManager.BChapter.GetChapterID(storyCSVData.chapter, storyCSVData.difficulty);

    //인벤토리 가득찬 경우 해당 보상아이템 제외
    var checkInvenFlag = common.checkItemSlot(socket, 1);
    var checkCharacterFlag = common.checkCharacterSlot(socket, 1);

    Item.SetItemType(storyReward);

    let goldBuff = 1 + Item.GetItemBuff(socket, team);
    var reward = [];
    for (let i = 0; i < storyReward.length; i++) {
        if ([99, 0].indexOf(storyReward[i].ITEM_TYPE) < 0) reward.push(storyReward[i]);
        if (storyReward[i].ITEM_TYPE == 2) {
            storyReward[i].REWARD_ITEM_COUNT *= goldBuff;
            storyReward[i].TYPE = 19;
        }
    }

    if (checkCharacterFlag) {
        for (let i = 0; i < storyReward.length; i++)
            if (storyReward[i].ITEM_TYPE == 99) reward.push(storyReward[i]);
    }

    if (checkInvenFlag) {
        for (let i = 0; i < storyReward.length; i++)
            if (storyReward[i].ITEM_TYPE == 0) reward.push(storyReward[i]);
    }

    // 핫 타임 적용
    selectDB.query("SELECT `TYPE`, `VALUE` FROM HOTTIME WHERE START_TIME <= NOW() AND END_TIME >= NOW() AND `ENABLE` = 1", (error, result) => {
        if(error) result = 1;

        var hotTimeExp = null;
        var hotTimeGold = null;
        for(let i = 0; i < result.length; i++){
            switch(result[i].TYPE){
                case 1: hotTimeExp = 1 + (result[i].VALUE / 100); break;
                case 2: hotTimeGold = 1 + (result[i].VALUE / 100); break;
            }
        }

        //스토리 진행 정보 LOG 저장
        logDB.query("INSERT INTO STORY (`STORY_ID`, `USER_UID`, `CLEAR`) VALUES (?, ?, ?)",
            [client.STORY_ID, acc.USER_UID, client.CLEAR], (uErr, uRes) => {
                if (uErr) {
                    PrintError(uErr);
                    result = 1;
                }
                if (client.CLEAR == 0) { // 스토리 실패 - 경험치, 보상 차감하여 지급
                    let failReward = common.findObjectByKeyList(reward, "ITEM_TYPE", 2);
                    addExp = parseInt(addExp / 10);
                    async.series({
                        updateExp: function (callback) {
                            if(hotTimeExp != null) addExp *= hotTimeExp;
                            addExp = parseInt(addExp);
                             Account.updateExp(socket, addExp, callback); 
                            },
                        addItem: function (callback) { 
                            if(hotTimeGold != null) {
                                failReward[0].REWARD_ITEM_COUNT *= hotTimeGold;
                                failReward[0].REWARD_ITEM_COUNT = parseInt(failReward[0].REWARD_ITEM_COUNT);
                            } 
                            Item.addRewardItem(socket, failReward, 0, callback); 
                        }
                    }, function (cErr, cRes) {
                        if (cErr) {
                            PrintError(cErr);
                            result = 1;
                        }
                        socket.emit('ANS_STORY', {
                            'ATYPE': aType, 'result': result, "ACCOUNT": acc,
                            "STORY_LIST": [], "CHAPTER_REWARD_LIST": [], "REWARD": cRes.addItem, "OVERKILL": []
                        });
                    });
                } else {
                    //스토리 성공

                    //스토리 관련 미션 데이터 업데이트
                    Mission.addMission(acc.USER_UID, 8000012, 1);
                    Mission.addMission(acc.USER_UID, 8000013, client.STORY_ID);

                    var userChapterReward = socket.Session.GetChapterReward();
                    var openStage = getOpenStage(userStoryList, client.STORY_ID);
                    var overkillreward = [];
                    
                    if (storyCSVData.ovk_value <= client.OVERKILL) {
                        let ovkRewardCnt = storyCSVData.ovk_reward_count;
                        if(hotTimeGold != null) {
                            ovkRewardCnt *= hotTimeGold;
                            ovkRewardCnt = parseInt(ovkRewardCnt);
                        } 
                        overkillreward.push({ "REWARD_ITEM_ID": 3000001, "REWARD_ITEM_COUNT": ovkRewardCnt, TYPE: 20 });
                        Item.SetItemType(overkillreward);
                        if (!checkCharacterFlag)
                            if (overkillreward[0].ITEM_TYPE == 99)
                                overkillreward = [];
                        if (!checkInvenFlag)
                            if (overkillreward[0].ITEM_TYPE == 0)
                                overkillreward = [];
                    }
    
                    async.series({
                        updateExp: function (callback) {    // 경험치 획득
                            if(hotTimeExp != null) addExp *= hotTimeExp;
                            addExp = parseInt(addExp);
                            
                             Account.updateExp(socket, addExp, callback); 
                        },
                        updateStage: function (callback) {  // 스토리 정보 갱신
                            DB.query("CALL UPDATE_STORY(?,?,?,?,?,?)",
                                [0, acc.USER_UID, client.STORY_ID, client.MISSION1, client.MISSION2, client.MISSION3], function (fErr, fRes) {
                                    if (!fErr) {
                                        var stageObj = null;
                                        for (var i = 0; i < userStoryList.length; i++) {
                                            if (userStoryList[i].STORY_ID == client.STORY_ID) {
                                                userStoryList[i].CLEAR = 1;
                                                userStoryList[i].MISSION1 = client.MISSION1;
                                                userStoryList[i].MISSION2 = client.MISSION2;
                                                userStoryList[i].MISSION3 = client.MISSION3;
                                                userStoryList[i].CNT = fRes[0][0].CNT;
    
                                                stageObj = userStoryList[i];
                                            }
                                        }
                                    }
                                    callback(fErr, stageObj);
                                });
                        },
                        openStage: function (callback) {    // 다음 스토리 개방
                            var addStage = [];
                            async.each(openStage, function (obj, cb) {
                                DB.query("CALL INSERT_STORY(?,?)", [acc.USER_UID, obj.STORY_ID], function (eErr, eRes) {
                                    if (eErr) cb(eErr);
    
                                    userStoryList.push(eRes[0][0]);
                                    addStage.push(eRes[0][0]);
                                    cb(null);
                                });
                            }, function (error) {
                                callback(error, addStage);
                            });
                        },
                        addChapterReward: function (callback) { // 
                            var missionSuccessCount = 0;
                            for (var i = 0; i < userStoryList.length; i++) {
                                var userStoryObj = CSVManager.BStory.GetData(userStoryList[i].STORY_ID);
                                if (storyCSVData.chapter == userStoryObj.chapter && storyCSVData.difficulty == userStoryObj.difficulty) {
                                    if (userStoryList[i].MISSION1 == 1) missionSuccessCount++;
                                    if (userStoryList[i].MISSION2 == 1) missionSuccessCount++;
                                    if (userStoryList[i].MISSION3 == 1) missionSuccessCount++;
                                }
                            }
    
                            var storyCommonCSVData = CSVManager.BStoryCommon.data[0];
                            chapterObj.level = 0;
                            if (storyCommonCSVData.chapter_reward_condition1 <= missionSuccessCount
                                && missionSuccessCount < storyCommonCSVData.chapter_reward_condition2) {
                                chapterObj.level = 1;
                            } else if (storyCommonCSVData.chapter_reward_condition2 <= missionSuccessCount
                                && missionSuccessCount < storyCommonCSVData.chapter_reward_condition3) {
                                chapterObj.level = 2;
                            } else if (storyCommonCSVData.chapter_reward_condition3 <= missionSuccessCount) {
                                chapterObj.level = 3;
                            }
    
                            var existFlag = false;
                            for (var i = 0; i < userChapterReward.length; i++) {
                                if (chapterObj.id == userChapterReward[i].CHAPTER_ID && chapterObj.level == userChapterReward[i].LEVEL)
                                    existFlag = true;
                            }
    
                            if (!existFlag && chapterObj.level > 0) {
                                DB.query("CALL INSERT_CHAPTER_REWARD(?,?,?,?)", [acc.USER_UID, chapterObj.id, chapterObj.level, 0], function (gErr, gRes) {
                                    userChapterReward.push(gRes[0][0]);
                                    callback(gErr, [gRes[0][0]]);
                                });
                            } else callback(null, []);
                        },
                        addItem: function (callback) {  //아이템 지급
                            MyRoom.GetDelegateMyRoomBuff(socket, (buffList) => {
                                if(buffList.length > 0) {
                                    let myRoomAddBuff = null;
                                    for(let i = 0; i < buffList.length; i++){
                                        if(buffList[i].EFFECT == 1) {
                                            myRoomAddBuff = buffList[i];
                                            break;
                                        }
                                    }
                                    if(myRoomAddBuff != null){
    
                                        for(let i = 0; i < reward.length; i++) {
                                            if(reward[i].ITEM_TYPE == 2){
                                                reward[i].REWARD_ITEM_COUNT *= myRoomAddBuff.VALUE;
                                                break;
                                            }
                                        }
                                    }
                                }
                                for(let i = 0; i < reward.length; i++) {
                                    if(reward[i].ITEM_TYPE == 2){
                                        if(hotTimeGold != null) {
                                            reward[i].REWARD_ITEM_COUNT *= hotTimeGold;
                                            reward[i].REWARD_ITEM_COUNT = parseInt(reward[i].REWARD_ITEM_COUNT);
                                        } 
                                        break;
                                    }
                                }
                                Item.addRewardItem(socket, reward, 0, callback); 
                            });
                        },
                        overkillItem: function (callback) { // 오버킬 보상 지급
                            if (overkillreward.length > 0) Item.addRewardItem(socket, overkillreward, 0, callback);
                            else callback(null, []);
                        }
                    }, function (cErr, cRes) {
                        if (cErr) {
                            PrintError(cErr);
                            result = 1;
                        }
                        // 오픈된 스토리 데이터(클라이언트 표기를 위해 전달)
                        cRes.openStage.push(cRes.updateStage);
    
                        //스토리 시작 시 차감된 마일리지 정보(클라이언트 표기를 위해 전달)
                        var mileage = chapterObj.stamina * CSVManager.BMyRoomCommon.GetData("convert_act");
                        cRes.addItem.REWARD.push({ REWARD_ITEM_ID: DefineItem.MILEAGE, REWARD_ITEM_COUNT: Math.round(mileage * 100) / 100 });
                        console.timeEnd("ANS_STORY_202");
                        socket.emit('ANS_STORY', {
                            'ATYPE': aType, 'result': result, "ACCOUNT": acc,
                            "STORY_LIST": cRes.openStage, "CHAPTER_REWARD_LIST": cRes.addChapterReward, "REWARD": cRes.addItem, "OVERKILL": cRes.overkillItem
                        });
                    });
                }
            });

    });
}

// 오픈 될 스토리 데이터 조회 (BStory 기본 데이터 openCondition에 부합하는 스토리 데이터)
function getOpenStage(userStoryList, storyId) {
    var storyCSVData = CSVManager.BStory.data;
    var openStage = [];

    for (var i = 0; i < storyCSVData.length; i++) {
        if (storyCSVData[i].open_condition == storyId) {
            var obj = common.findObjectByKey(userStoryList, "STORY_ID", storyCSVData[i].id);
            if (obj == null) {
                openStage.push({
                    STORY_ID: storyCSVData[i].id, CHAPTER: storyCSVData[i].chapter,
                    DIFFICULTY: storyCSVData[i].difficulty
                });
            }
        }
    }
    return openStage;
}

// 스토리 보상 셋팅
function getStoryReward(storyId, clear) {
    var storyCSVData = CSVManager.BStory.GetData(storyId);
    var rewardCSVData = CSVManager.BStoryReward.GetData(storyCSVData.reward);

    var rewardList = [];
    var probList = [];
    var probabilitySum = 0;
    var period = [0];
    var pickItemIndex = null;
    var tempList = [];

    for (key in rewardCSVData)
        if (key.indexOf("probability_out") > -1) rewardList.push(key.replace("_probability_out", ""));

    for (var i = 0; i < rewardList.length; i++) {
        for (key in rewardCSVData) {
            if (key.indexOf(rewardList[i] + "_probability") > -1) {
                probList.push(key);
                probabilitySum += rewardCSVData[key] * 100;
                period.push(probabilitySum);
            }
        }
        var random = Math.floor(Math.random() * probabilitySum);
        for (var j = 0; j < period.length; j++) {
            if (period[j] <= random && random < period[j + 1]) {
                pickItemIndex = j;
                break;
            }
        }
        tempList.push(probList[pickItemIndex]);
        probList = [];
        probabilitySum = 0;
        period = [0];
        pickItemIndex = null;

    }

    var storyRewardList = [];
    for (var k = 0; k < tempList.length; k++) {
        if (typeof tempList[k] == "string") {
            if (tempList[k].indexOf("_out") < 0) {
                var str = tempList[k].replace("_probability", "");
                var obj = {};
                for (key in rewardCSVData) {
                    if (key == str) obj.REWARD_ITEM_ID = rewardCSVData[key];
                    if (key == str + "_value") {
                        obj.REWARD_ITEM_COUNT = rewardCSVData[key];
                        if (clear == 0) obj.REWARD_ITEM_COUNT = obj.REWARD_ITEM_COUNT / 10;
                    }
                }
                storyRewardList.push(obj);
            }
        }
    }

    var goldObj = { "REWARD_ITEM_ID": DefineItem.GOLD, "REWARD_ITEM_COUNT": Utils.Random(storyCSVData.gold_min, storyCSVData.gold_max) };
    if (clear == 0) goldObj.REWARD_ITEM_COUNT = goldObj.REWARD_ITEM_COUNT / 10;

    storyRewardList.push(goldObj);
    return storyRewardList;
}

// 챕터 보상 지급
function getChapterReward(socket, client) {
    console.time("ANS_STORY_203");
    try {
        var acc = socket.Session.GetAccount();
        var result = 0;
        var chapterCSVData = CSVManager.BChapter.GetData(client.CHAPTER_ID);
        var userChapterReward = socket.Session.GetChapterReward();

        if (client.CHAPTER_ID == undefined || client.LEVEL == undefined) {
            result = 1;
            socket.emit('ANS_STORY', { 'ATYPE': client.ATYPE, 'result': result });
            return;
        }

        var chapterObj = null;
        for (var i = 0; i < userChapterReward.length; i++) {
            if (userChapterReward[i].CHAPTER_ID == client.CHAPTER_ID && userChapterReward[i].LEVEL == client.LEVEL)
                chapterObj = userChapterReward[i];
        }
        if (chapterObj == null) {   // 해당 챕터 데이터 없음
            result = 2;
            socket.emit('ANS_STORY', { 'ATYPE': client.ATYPE, 'result': result });
            return;
        }

        if (chapterObj.REWARD == 1) {   // 지급 완료 상태
            result = 3;
            socket.emit('ANS_STORY', { 'ATYPE': client.ATYPE, 'result': result });
            return;
        }

        var rewardList = [];
        rewardList.push({
            REWARD_ITEM_ID: chapterCSVData["reward_id" + chapterObj.LEVEL],
            REWARD_ITEM_COUNT: chapterCSVData["reward_id" + chapterObj.LEVEL + "_value"]
        });

        //보상지급, 리워드 업데이트
        async.series({
            reward: function (callback) {
                Item.addRewardItem(socket, rewardList, 0, callback);
            },
            updateChapterReward: function (callback) {
                DB.query("CALL INSERT_CHAPTER_REWARD(?,?,?,?)", [acc.USER_UID, chapterObj.CHAPTER_ID, chapterObj.LEVEL, 1], function (bErr, bRes) {
                    var chapterRes = [];
                    for (var i = 0; i < userChapterReward.length; i++) {
                        if (userChapterReward[i].CHAPTER_ID == client.CHAPTER_ID && userChapterReward[i].LEVEL == client.LEVEL) {
                            userChapterReward[i].REWARD = bRes[0][0].REWARD;
                            chapterRes.push(userChapterReward[i]);
                        }
                    }
                    callback(bErr, chapterRes);
                });
            }
        }, function (aErr, aRes) {
            if (aErr) {
                PrintError(cErr);
            }
            console.timeEnd("ANS_STORY_203");
            socket.emit('ANS_STORY', { 'ATYPE': client.ATYPE, 'result': result, "UPDATE_CHAPTER_REWARD": aRes.updateChapterReward, "REWARD": aRes.reward });
        });
    } catch (e) { console.log(e); }
}
