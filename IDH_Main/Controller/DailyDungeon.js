/**
 * 요일던전 Controller
 * 
 */

module.exports.OnPacket = function (socket) {

    socket.on("REQ_DUNGEON", function (client) {
        try {
            if (client.ATYPE !== undefined) {

                var packetType = aTypeParser(client.ATYPE);

                if (packetType.cType == "0") {
                    switch (packetType.aType) {
                        case "00": break;
                        default: break;
                    }
                } else if (packetType.cType == "1") {
                    switch (packetType.aType) {
                        case "00": startDailyDungeon(socket, client); break;
                        default: break;
                    }
                } else if (packetType.cType == "2") {
                    switch (packetType.aType) {
                        case "00": endDailyDungeon(socket, client); break;
                        case "01": addDungeonTicket(socket, client); break;
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

// 요일 던전 시작
function startDailyDungeon(socket, client) {
    console.time("ANS_DUNGEON_100");

    var acc = socket.Session.GetAccount();
    var userItemList = socket.Session.GetItems();
    var jsonData = { result: 0 };
    jsonData.ATYPE = client.ATYPE;
    jsonData.FRIEND = { ICON: -1, LIST: [], SKILL: -1 };

    //client.DUNGEON_ID, LEVEL, TEAM, FRIEND_UID

    var itemObj = common.findObjectByKey(userItemList, "ITEM_ID", DefineItem.TICKET_DUNGEON);

    if (itemObj.ITEM_COUNT < 1) {
        //티켓 수량 부족
        jsonData.result = 2;
        socket.emit('ANS_DUNGEON', jsonData);
        return;
    }

    var dungeonCSVData = CSVManager.BDDungeon.GetData(client.DUNGEON_ID);

    if (!dungeonCSVData) {
        jsonData.result = 4;
        socket.emit('ANS_DUNGEON', jsonData);
        return;
    }

    async.series([
        (callback) => {
            Character.CalculateTeamCombat(null, client.TEAM, socket, (error, teamPowerSum, statList) => {
                if (error) {
                    jsonData.result = 1;
                    callback(error, null);
                } else {
                    jsonData.STAT = statList;

                    Mission.addMission(acc.USER_UID, 8000025, 1);
                    callback(null, null);
                }
            });
        },
        (callback) => {
            if (client.FRIEND_UID && client.FRIEND_UID != -1) {
                Friend.SetStriker(acc.USER_UID, client.FRIEND_UID);
                Mission.addMission(acc.USER_UID, 8000047, 1);
                DB.query("CALL SELECT_STRIKER(?)", [client.FRIEND_UID], (error, res) => {
                    if (error) {
                        jsonData.result = 5;
                        callback(error, null);
                    } else {
                        if (res[0].length > 0) {
                            jsonData.FRIEND.ICON = res[0][0].CHA_ID;
                            jsonData.FRIEND.UN = res[0][0].USER_NAME;
                            jsonData.FRIEND.SKILL = res[1][0].SKILL;

                            if (jsonData.FRIEND.SKILL > 0 && res[1].length > 0) {
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

                                        jsonData.FRIEND.LIST.push(res[1][i]);
                                    }
                                    callback(null, null);
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
                                    jsonData.FRIEND.LIST.push(tempObj);
                                    callback(null, null);
                                });
                            }
                        } else {
                            callback(null, null);
                        }
                    }
                });
            } else {
                callback(null, null);
            }
        },
        (callback) => {
            //적 캐릭터 스텟 추가
            let stageCSVData = CSVManager.BStage.GetData(dungeonCSVData.stage_id);
            let statList = [];
            let keyList = [];
            for (let key in stageCSVData) {
                if (key != 'id' && stageCSVData[key] > -1) {
                    if (keyList.indexOf(stageCSVData[key]) < 0) {
                        keyList.push(stageCSVData[key]);
                        let chaStat = Character.calculateCharacterCombat({ CHA_ID: stageCSVData[key], ENCHANT: 0 }, [], null);
                        statList.push({
                            CHA_ID: stageCSVData[key],
                            STAT: [0, parseFloat(chaStat.strength.toFixed(2)), parseFloat(chaStat.damage.toFixed(2)), parseFloat(chaStat.defensive.toFixed(2))
                                , parseFloat(chaStat.action.toFixed(2)), parseFloat(chaStat.agility.toFixed(2)), parseFloat(chaStat.concentration.toFixed(2))
                                , parseFloat(chaStat.recovery.toFixed(2)), parseFloat(chaStat.mentality.toFixed(2)), parseFloat(chaStat.aggro.toFixed(2))],
                            AUTORECOVERY: parseFloat(chaStat.autoRecovery.toFixed(2)), CRITICAL: parseFloat(chaStat.critical.toFixed(2))
                        });
                    }
                }
            }
            jsonData.ENEMY = statList;
            callback(null, null);
        }

    ], (error, result) => {
        if (error) PrintError(error);

        console.timeEnd("ANS_DUNGEON_100");
        socket.emit('ANS_DUNGEON', jsonData);
    });
}

// 요일 던전 종료
function endDailyDungeon(socket, client) {
    console.time("ANS_DUNGEON_200");
    //던전/유저/team/보상/도전 횟수 응답 
    var jsonData = { result: 0 };
    jsonData.ATYPE = client.ATYPE;
    var acc = socket.Session.GetAccount();
    var userItemList = socket.Session.GetItems();
    var dungeonCSVData = CSVManager.BDDungeon.GetData(client.DUNGEON_ID);
    var itemObj = common.findObjectByKey(userItemList, "ITEM_ID", DefineItem.TICKET_DUNGEON);
    let team = client.TEAM || 1;

    if (!dungeonCSVData || itemObj.ITEM_COUNT < 1) {
        jsonData.result = 2;
        socket.emit('ANS_DUNGEON', jsonData);
        return;
    }

    var addExp = dungeonCSVData.add_exp;
    if (client.VICTORY == 0) {
        addExp = 0;
    } else {
        Mission.addMission(acc.USER_UID, 8000026, 1);
        Mission.addMissionLog(acc.USER_UID, 8000027, dungeonCSVData.difficulty, 1);
    }

    Account.updateExp(socket, addExp, function (error, result) {
        if (error) jsonData.result = 1;

        jsonData.ACCOUNT = socket.Session.GetAccount();

        var rewardList = [];
        var tempList = [];

        if(client.VICTORY == 1)
            tempList = getDungeonReward(client.DUNGEON_ID, client.VICTORY);

        let goldBuff = 1 + Item.GetItemBuff(socket, team);

        for (var i = 0; i < tempList.length; i++) {
            if (tempList[i].REWARD_ITEM_ID == DefineItem.GOLD) {
                tempList[i].REWARD_ITEM_COUNT *= goldBuff;
                tempList[i].TYPE = 7;
            } 
            rewardList.push(tempList[i]);
        }

        if (client.VICTORY == 1) rewardList.push({ REWARD_ITEM_ID: DefineItem.TICKET_DUNGEON, REWARD_ITEM_COUNT: -1 });

        Item.addRewardItem(socket, rewardList, 0, function (aErr, aRes) {
            console.timeEnd("ANS_DUNGEON_200");
            if (aErr) {
                PrintError(aErr);
                jsonData.result = 1;
            }
            if (aRes != undefined) aRes.REWARD = tempList;
            //REWARD는 보상 표현 해주기 위한 값, 획득 아이템과 획득 재화를 표현해주기 위한 배열.
            jsonData.REWARD = aRes;
            socket.emit("ANS_DUNGEON", jsonData);
        });
    });
}

// 요일 던전 티켓 충전
function addDungeonTicket(socket, client) {
    console.time("ANS_DUNGEON_201");
    var acc = socket.Session.GetAccount();
    var userItemList = socket.Session.GetItems();
    var jsonData = { result: 0 };
    jsonData.ATYPE = client.ATYPE;

    if (acc.ADD_DUNGEON_LIMIT == 0) {
        //하루 추가 가능 횟수 초과
        jsonData.result = 2;
        socket.emit("ANS_DUNGEON", jsonData);
        return;
    }

    var demandPrice = CSVManager.BDDungeonCommon.GetData("dungeon_default_price");
    demandPrice += (CSVManager.BDDungeonCommon.GetData("dungeon_add_count") - acc.ADD_DUNGEON_LIMIT) * CSVManager.BDDungeonCommon.GetData("dungeon_add_price");

    var itemObj = common.findObjectByKey(userItemList, "ITEM_ID", DefineItem.PEARL);

    if (itemObj.ITEM_COUNT < demandPrice) {
        //재화 부족
        jsonData.result = 3;
        socket.emit("ANS_DUNGEON", jsonData);
        return;
    }

    var rewardList = [];
    rewardList.push({ REWARD_ITEM_ID: DefineItem.PEARL, REWARD_ITEM_COUNT: -demandPrice, TYPE: 8 });
    rewardList.push({ REWARD_ITEM_ID: DefineItem.TICKET_DUNGEON, REWARD_ITEM_COUNT: 1 });
    Item.addRewardItem(socket, rewardList, 0, function (aErr, aRes) {
        if (aErr) {
            PrintError(aErr);
        }
        if (aRes != undefined)
            aRes.REWARD = [];

        Account.updateAddDungeonLimit(socket);
        jsonData.ADD_DUNGEON_LIMIT = --acc.ADD_DUNGEON_LIMIT;
        jsonData.REWARD = aRes;
        console.timeEnd("ANS_DUNGEON_201");
        socket.emit("ANS_DUNGEON", jsonData);
    });
}

// 요일 던전 보상
function getDungeonReward(dungeonId, victory) {
    var dungeonCSVData = CSVManager.BDDungeon.GetData(dungeonId);
    var rewardCSVData = CSVManager.BDDReward.GetData(dungeonCSVData.reward);

    var rewardList = [];
    var probList = [];
    var probabilitySum = 0;
    var period = [0];
    var pickItemIndex = null;
    var tempList = [];

    for (key in rewardCSVData) {
        if (key.indexOf("probability_out") > -1) {
            rewardList.push(key.replace("_probability_out", ""));
        }
    }

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

    var dungeonRewardList = [];
    for (var k = 0; k < tempList.length; k++) {
        if (tempList[k].indexOf("_out") < 0) {
            var str = tempList[k].replace("_probability", "");
            var obj = {};
            for (key in rewardCSVData) {
                if (key == str)
                    obj.REWARD_ITEM_ID = rewardCSVData[key];
                if (key == str + "_value") {
                    obj.REWARD_ITEM_COUNT = rewardCSVData[key];
                    if (victory == 0)
                        obj.REWARD_ITEM_COUNT = obj.REWARD_ITEM_COUNT / 10;
                }
            }
            dungeonRewardList.push(obj);
        }
    }

    var goldObj = { "REWARD_ITEM_ID": DefineItem.GOLD, "REWARD_ITEM_COUNT": Utils.Random(dungeonCSVData.gold_min, dungeonCSVData.gold_max) };
    if (victory == 0)
        goldObj.REWARD_ITEM_COUNT = goldObj.REWARD_ITEM_COUNT / 10;

    dungeonRewardList.push(goldObj);

    return dungeonRewardList;
}