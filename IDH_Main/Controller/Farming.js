/**
 * 파밍 Controller
 * 
 */

module.exports.OnPacket = function (socket) {
    socket.on("REQ_FARMING", function (client) {
        try {
            if (client.ATYPE !== undefined) {

                var packetType = aTypeParser(client.ATYPE);

                if (packetType.cType == "0") {
                    switch (packetType.aType) {
                        case "00": createFarming(socket, client); break;
                        default: break;
                    }
                } else if (packetType.cType == "1") {
                    switch (packetType.aType) {
                        case "00": getFarming(socket, client); break;
                        default: break;
                    }
                } else if (packetType.cType == "2") {
                    switch (packetType.aType) {
                        case "00": getFarmingReward(socket, client); break;
                        default: break;
                    }
                } else if (packetType.cType == "3") {
                    switch (packetType.aType) {
                        case "00": cancelFarming(socket, client); break;
                        default: break;
                    }
                } else {

                }
            }
        } catch (e) { PrintError(e); }
    });
}

// 파밍 데이터 조회
function getFarming(socket, client) {
    socket.emit('ANS_FARMING', { 'ATYPE': client.ATYPE, "result": 0, 'FARMING': socket.Session.GetFarming() });
}

// 파밍 시작
function createFarming(socket, client) {
    //console.time("ANS_FARMING_000");
    // FARMING_ID, 참여 CHA_ID
    var acc = socket.Session.GetAccount();
    var characters = socket.Session.GetCharacters();
    var farming = socket.Session.GetFarming();
    var itemList = socket.Session.GetItems();
    var farmingCSVData = null;
    var result = 0;
    var insertFarming = null;
    var updateCharacter = [];
    var curFarming = null;
    var flag = false;
    var obj = {};

    if (client.FARMING_ID == undefined || client.IDLIST == undefined || client.IDLIST.length == 0) {
        result = 1;
        socket.emit('ANS_FARMING', { 'ATYPE': client.ATYPE, 'result': result });
        return;
    }
    if (farming.length == CSVManager.BFarmingCommon.GetData("farming_max_count")) {
        result = 3;
        socket.emit('ANS_FARMING', { 'ATYPE': client.ATYPE, 'result': result });
        return;
    }
    farmingCSVData = CSVManager.BFarming.GetData(client.FARMING_ID);
    //파밍 조건 스토리 데이터 확인 후 해당 챕터 10이상 깼을 경우 비교 해서 통과
    checkFarmingCondition(characters, farmingCSVData, client.IDLIST, itemList, (checkConditionFlag) => {
        if (!checkConditionFlag) {
            result = 4;
            socket.emit('ANS_FARMING', { 'ATYPE': client.ATYPE, 'result': result, "FARMING": curFarming, "CHA_LIST": updateCharacter });
            return;
        }

        var startTime = new Date().format("yyyy-MM-dd HH:mm:ss");
        var endTime = new Date();
        obj.USER_UID = acc.USER_UID;
        obj.FARMING_ID = farmingCSVData.id;
        obj.START_DATE = startTime;
        obj.END_DATE = new Date(endTime.setSeconds(endTime.getSeconds() + farmingCSVData.time)).format("yyyy-MM-dd HH:mm:ss");
        obj.REWARD_ID = farmingCSVData.reward;

        //파밍 진행중인지 확인
        for (var j = 0; j < farming.length; j++) {
            if (farming[j].FARMING_ID == client.FARMING_ID) {
                curFarming = farming[j];
                flag = true;
                break;
            }
        }

        if (flag) {
            result = 2;
            socket.emit('ANS_FARMING', { 'ATYPE': client.ATYPE, 'result': result, "FARMING": curFarming, "CHA_LIST": updateCharacter });
            return;
        }

        async.waterfall([
            function (callback) {
                DB.query('CALL INSERT_FARMING (?,?,?,?,?)', [obj.USER_UID, obj.FARMING_ID, obj.START_DATE, obj.END_DATE, obj.REWARD_ID], function (err, res) {
                    if (!err) {
                        farming.push(res[0][0]);
                        insertFarming = res[0][0];
                        callback(null);
                    } else {
                        callback(err);
                    }
                });
            },
            function (callback) {// 캐릭터 파밍 중인지 판단하기 위한 DISPACH 값 변경
                DB.query('UPDATE CHARAC SET DISPATCH = 1, FARMING_ID = ? WHERE USER_UID = ? AND CHA_UID IN (?) ',
                    [client.FARMING_ID, acc.USER_UID, client.IDLIST], function (err, res) {
                        if (!err) {
                            callback(null);
                        } else {
                            callback(err);
                        }
                    });
            }
        ], function (err, result) {
            var result = 0;
            if (err) {
                PrintError(err);
                result = 1;
            }
            for (var i = 0; i < characters.length; i++) {
                if (client.IDLIST.indexOf(characters[i].CHA_UID) > -1) {
                    characters[i].DISPATCH = 1;
                    characters[i].FARMING_ID = client.FARMING_ID;
                    updateCharacter.push(characters[i]);
                    continue;
                }
            }
            //console.timeEnd("ANS_FARMING_000");
            socket.emit('ANS_FARMING', { 'ATYPE': client.ATYPE, 'result': result, 'FARMING': insertFarming, "CHA_LIST": updateCharacter });
        });
    });
}

// 파밍 전투력 조건 검사
function checkFarmingCondition(characters, farmingCSVData, uidList, itemList, callback) {
    let tempCharacterList = [];
    for (let i = 0; i < characters.length; i++)
        if (uidList.indexOf(characters[i].CHA_UID) >= 0) tempCharacterList.push(CSVManager.BCharacter.GetData(characters[i].CHA_ID));

    let teamList = [];
    for (var j = 0; j < uidList.length; j++) {
        var chaObj = common.findObjectByKey(characters, "CHA_UID", uidList[j]);
        if (chaObj != null) teamList.push(chaObj);
    }
    //전투력 계산 케이스가 아닌 경우 제외 하도록 수정해야 함.
    Character.CalculateCharacterListCombat(teamList[0].USER_UID, itemList, teamList, null, (combat) => {
        let checkConditionFlag = true;
        switch (farmingCSVData.condition_type) {
            case 1:
                if (combat < farmingCSVData.condition_value) checkConditionFlag = false;
                break;
            case 2:
            case 4:
            case 5:
                for (let i = 0; i < tempCharacterList.length; i++) {
                    if (farmingCSVData.condition_type == 2) {
                        if (tempCharacterList[i].character_type != farmingCSVData.condition_value) {
                            checkConditionFlag = false;
                            break;
                        }
                    }
                    if (farmingCSVData.condition_type == 4) {
                        if (tempCharacterList[i].evolution < farmingCSVData.condition_value) {
                            checkConditionFlag = false;
                            break;
                        }
                    }
                    if (farmingCSVData.condition_type == 5) {
                        if (tempCharacterList[i].grade > farmingCSVData.condition_value) {
                            checkConditionFlag = false;
                            break;
                        }
                    }
                }
                break;
            case 3:
                let tempTypeList = [];
                for (let i = 0; i < tempCharacterList.length; i++) {
                    if (tempTypeList.indexOf(tempCharacterList[i].character_type) < 0) {
                        tempTypeList.push(tempCharacterList[i].character_type);
                    } else {
                        checkConditionFlag = false;
                        break;
                    }
                }
                break;
        }
        callback(checkConditionFlag);
    });
}

// 파밍 보상 지급
function getFarmingReward(socket, client) {
    try {
        var acc = socket.Session.GetAccount();
        var userFarmingList = socket.Session.GetFarming();
        var userCharacterList = socket.Session.GetCharacters();
        var farming = null;
        var farmingRewardData = null;
        var result = 0;
        var rewardList = [];

        if (client.IDLIST == undefined || client.IDLIST.length == 0) {
            result = 1;
            socket.emit('ANS_FARMING', { 'ATYPE': client.ATYPE, 'result': result });
            return;
        }


        async.eachSeries(client.IDLIST, function (farmingId, cb) {
            HotTime.GetHotTime((result) => {
                var hotTimeFarming = null;
                for(let i = 0; i < result.length; i++){
                    switch(result[i].TYPE){
                        case 4: hotTimeFarming = 1 + (result[i].VALUE / 100); break;
                    }
                }
                farming = common.findObjectByKey(userFarmingList, "FARMING_ID", farmingId);
    
                if (!farming) {
                    //존재하지 않는 파밍 아이디.
                    result = 2;
                    cb(result);
                } else {
                    farmingRewardData = CSVManager.BFarmingReward.GetData(farming.REWARD_ID);
    
                    var probList = [];
                    var probabilitySum = 0;
                    var period = [0];
                    var pickItemIndex = null;
                    var rewardObj = null;
                    var tempList = [];
    
                    for (key in farmingRewardData) {
                        if (key.indexOf("probability") > -1) {
                            if (farmingRewardData[key] != 0) {
                                probList.push(key.replace("_probability", ""));
                                probabilitySum += farmingRewardData[key] * 100;
                                period.push(probabilitySum);
                            }
                        }
                    }
    
                    var random = Math.floor(Math.random() * probabilitySum);
    
                    for (var i = 0; i < period.length; i++) {
                        if (period[i] <= random && random < period[i + 1]) {
                            pickItemIndex = i;
                            break;
                        }
                    }
                    var pickName = probList[pickItemIndex];
    
                    var reward_item_count = 0;
    
                    if (farmingRewardData[pickName + "_min"] == undefined)
                        reward_item_count = farmingRewardData[pickName + "_value"];
                    else
                        reward_item_count = Utils.Random(farmingRewardData[pickName + "_min"], farmingRewardData[pickName + "_max"]);
    
                    if (pickName != "no_reward")
                        tempList.push({ "REWARD_ITEM_ID": farmingRewardData[pickName], "REWARD_ITEM_COUNT": reward_item_count });

                    let depenseCoin = farmingRewardData.depense_coin;
                    let approachCoin = farmingRewardData.approach_coin;
                    let magicCoin = farmingRewardData.magic_coin;
                    let snipeCoin = farmingRewardData.snipe_coin;
                    let supportCoin = farmingRewardData.support_coin;

                    // 핫타임 적용
                    if(hotTimeFarming != null) {
                        depenseCoin *= hotTimeFarming;
                        approachCoin *= hotTimeFarming;
                        magicCoin *= hotTimeFarming;
                        snipeCoin *= hotTimeFarming;
                        supportCoin *= hotTimeFarming;
                        depenseCoin = parseInt(depenseCoin);
                        approachCoin = parseInt(approachCoin);
                        magicCoin = parseInt(magicCoin);
                        snipeCoin = parseInt(snipeCoin);
                        supportCoin = parseInt(supportCoin);
                    }
                    
                    tempList.push({ "REWARD_ITEM_ID": DefineItem.COIN_DEFENSIVE, "REWARD_ITEM_COUNT": depenseCoin });
                    tempList.push({ "REWARD_ITEM_ID": DefineItem.COIN_PROXIMITY, "REWARD_ITEM_COUNT": approachCoin });
                    tempList.push({ "REWARD_ITEM_ID": DefineItem.COIN_MAGIC_TYPE, "REWARD_ITEM_COUNT": magicCoin });
                    tempList.push({ "REWARD_ITEM_ID": DefineItem.COIN_LONG_RANGE, "REWARD_ITEM_COUNT": snipeCoin });
                    tempList.push({ "REWARD_ITEM_ID": DefineItem.COIN_SUPPORT_TYPE, "REWARD_ITEM_COUNT": supportCoin });
    
                    for (var j = 0; j < tempList.length; j++) {
                        var updateFlag = false;
                        for (var k = 0; k < rewardList.length; k++) {
                            if (tempList[j].REWARD_ITEM_ID == rewardList[k].REWARD_ITEM_ID) {
                                rewardList[k].REWARD_ITEM_COUNT += tempList[j].REWARD_ITEM_COUNT;
                                updateFlag = true;
                            }
                        }
                        if (!updateFlag) {
                            tempList[j].TYPE = 9;
                            rewardList.push(tempList[j]);
                        }
                    }
                    cb(null);
                }
            });
        }, function (error) {
            if (error) {
                PrintError(error);
                socket.emit('ANS_FARMING', { 'ATYPE': client.ATYPE, 'result': result });
            } else {
                Mission.addMission(acc.USER_UID, 8000046, client.IDLIST.length);
                var updateCharacter = [];

                DB.query('CALL DELETE_FARMING(?,?,"' + client.IDLIST.join() + '")', [1, acc.USER_UID], function (aErr, aRes) {
                    if (aErr) {
                        result = 1;
                        socket.emit('ANS_FARMING', { 'ATYPE': client.ATYPE, 'result': result });
                    } else {
                        socket.Session.SetFarming(aRes[0]);

                        Item.addRewardItem(socket, rewardList, 0, function (cErr, cRes) {
                            if (cErr) {
                                result = 1;
                                socket.emit('ANS_FARMING', { 'ATYPE': client.ATYPE, 'result': result });
                            } else {
                                for (var i = 0; i < aRes[1].length; i++) {
                                    for (var j = 0; j < userCharacterList.length; j++) {
                                        if (aRes[1][i].CHA_UID == userCharacterList[j].CHA_UID) {
                                            userCharacterList[j].DISPATCH = 0;
                                            userCharacterList[j].FARMING_ID = 0;
                                            updateCharacter.push(userCharacterList[j]);
                                        }
                                    }
                                }
                                socket.emit('ANS_FARMING',
                                    { 'ATYPE': client.ATYPE, 'result': result, "DELETE_FARMING": client.IDLIST, "CHA_LIST": updateCharacter, "REWARD_LIST": cRes });
                            }
                        });
                    }
                });
            }
        });
    } catch (e) { PrintError(e); }
}

// 파밍 취소
function cancelFarming(socket, client) {
    console.time("ANS_FARMING_300");
    try {
        var acc = socket.Session.GetAccount();
        var characters = socket.Session.GetCharacters();
        var userFarmingList = socket.Session.GetFarming();
        var farming = null;
        var updateCharacter = [];
        var result = 0;

        if (client.FARMING_ID == undefined) {
            result = 1;
            socket.emit('ANS_FARMING', { 'ATYPE': client.ATYPE, 'result': result });
            return;
        }

        farming = common.findObjectByKey(userFarmingList, "FARMING_ID", client.FARMING_ID);

        if (farming == null) {
            result = 2;
            socket.emit('ANS_FARMING', { 'ATYPE': client.ATYPE, 'result': result });
            return;
        }

        DB.query('CALL DELETE_FARMING(?,?,?) ', [0, acc.USER_UID, client.FARMING_ID], function (err, res) {
            var result = 0;
            if (err) {
                PrintError(err);
                result = 1;
            } else {
                //파밍 데이터 제거 및 관련 된 캐릭터 데이터 업데이트
                for (var i = 0; i < userFarmingList.length; i++) {
                    if (userFarmingList[i].FARMING_ID == client.FARMING_ID) {
                        userFarmingList.splice(i, 1);
                        break;
                    }
                }

                for (var i = 0; i < characters.length; i++) {
                    if (characters[i].FARMING_ID == client.FARMING_ID) {
                        characters[i].DISPATCH = 0;
                        characters[i].FARMING_ID = 0;
                        updateCharacter.push(characters[i]);
                        continue;
                    }
                }
                console.timeEnd("ANS_FARMING_300");
                socket.emit('ANS_FARMING', { 'ATYPE': client.ATYPE, 'result': result, "DELETE_FARMING": client.FARMING_ID, "CHA_LIST": updateCharacter });
            }
        });
    } catch (e) { PrintError(e); }
}

//!< 두 날짜가 같은 날 인지 검사.
global.IsSameDate = function (date1, date2) {
    if (date1.getYear() == date2.getYear() &&
        date1.getMonth() == date2.getMonth() &&
        date1.getDate() == date2.getDate()) {
        return true;
    }
    return false;
}