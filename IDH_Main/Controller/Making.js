/**
 * 제조 Controller
 */

module.exports.OnPacket = function (socket) {
    socket.on("REQ_MAKING", function (client) {
        try {
            if (client.ATYPE !== undefined) {

                var packetType = aTypeParser(client.ATYPE);

                if (packetType.cType == "0") {
                    switch (packetType.aType) {
                        case "00": makingReward(socket, client); break;
                        case "01": immediateMaking(socket, client); break;
                        case "02": allMakingReward(socket, client); break;
                        default: break;
                    }
                } else if (packetType.cType == "1") {
                    switch (packetType.aType) {
                        case "00": getMaking(socket, client); break;
                        default: break;
                    }
                } else if (packetType.cType == "2") {
                    switch (packetType.aType) {
                        case "00": openMaker(socket, client); break;
                        case "01": making(socket, client); break;
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

// 완료된 제조 아이템 수령
function makingReward(socket, client) {
    console.time("ANS_MAKING_000");
    var acc = socket.Session.GetAccount();
    var result = 0;

    if (client.MAKING_ID == undefined) {
        result = 1;
        socket.emit('ANS_MAKING', { 'ATYPE': client.ATYPE, 'result': result });
        return;
    }

    var makingCSVData = CSVManager.BMakingSlotCost.GetData(client.MAKING_ID);

    var checkFlag = true;
    if (makingCSVData.type == 1)
        checkFlag = common.checkCharacterSlot(socket, 1);
    else if(makingCSVData.type == 2)
        checkFlag = common.checkItemSlot(socket, 1);

    if (!checkFlag) {
        result = 2;
        socket.emit('ANS_MAKING', { 'ATYPE': client.ATYPE, 'result': result });
        return;
    }


    selectDB.query("CALL SELECT_MAKING(?,?,?)", [2, acc.USER_UID, client.MAKING_ID], function (aErr, aRes) {
        if (aErr) {
            PrintError(aErr);
            result = 1;
            socket.emit('ANS_MAKING', { 'ATYPE': client.ATYPE, 'result': result });
            return;
        }
        if (aRes[0].length > 0) {
            var makingObj = aRes[0][0];
            if (makingObj.FLAG == 0) {
                if (makingObj.REWARD_ITEM_ID != null) {
                    var rewardList = [{ REWARD_ITEM_ID: makingObj.REWARD_ITEM_ID, REWARD_ITEM_COUNT: 1 }];
                    DB.query("CALL UPDATE_MAKING(?,?,?,?,?)", [3, acc.USER_UID, client.MAKING_ID, null, null], function (bErr, bRes) {
                        // 이벤트를 위한 제조 내역 LOG DB에 저장
                        logDB.query("INSERT INTO MAKING (USER_UID, MAKING_ID, COUNT) VALUES (?, ?, ?)", [acc.USER_UID, client.MAKING_ID, 1], (lErr, lRes) => {
                            if (bErr) {
                                PrintError(bErr);
                                result = 1;
                                socket.emit('ANS_MAKING', { 'ATYPE': client.ATYPE, 'result': result });
                                return;
                            }
                            Item.addRewardItem(socket, rewardList, 0, function (cErr, cRes) {
                                if (cErr) {
                                    PrintError(cErr);
                                    result = 1;
                                    socket.emit('ANS_MAKING', { 'ATYPE': client.ATYPE, 'result': result });
                                    return;
                                }
                                // 영웅 1 장비 2 가구 3
                                switch (makingCSVData.type) {
                                    case 1: Mission.addMission(acc.USER_UID, 8000031, 1); break;
                                    case 2: Mission.addMission(acc.USER_UID, 8000032, 1); break;
                                    case 3: Mission.addMission(acc.USER_UID, 8000033, 1); break;
                                }
                                console.timeEnd("ANS_MAKING_000");
                                socket.emit('ANS_MAKING', { 'ATYPE': client.ATYPE, 'result': result, "MAKING": bRes[0], "REWARD": cRes });
                            });
                        });
                    });
                } else {
                    // 보상 아이템 에러
                    result = 5;
                    socket.emit('ANS_MAKING', { 'ATYPE': client.ATYPE, 'result': result });
                }
            } else {
                // 종료 시간 남음.
                result = 3;
                socket.emit('ANS_MAKING', { 'ATYPE': client.ATYPE, 'result': result });
            }
        } else {
            //잘못된 MAKING ID
            result = 4;
            socket.emit('ANS_MAKING', { 'ATYPE': client.ATYPE, 'result': result });
        }
    });
}

// 완료된 제조 모두 받기
function allMakingReward(socket, client) {
    console.time("ANS_MAKING_002");
    var acc = socket.Session.GetAccount();
    var resResult = 0;
    var makingType = client.TYPE || 0;

    // type
    if (makingType == 0) { // 1: 캐릭터, 2: 아이템, 3: 가구
        resResult = 1;
        socket.emit('ANS_MAKING', { 'ATYPE': client.ATYPE, 'result': resResult });
        return;
    }
    async.waterfall([
        (callback) => {
            // 완료된 제조 리스트 조회
            selectDB.query("CALL SELECT_MAKING(?,?,?)", [3, acc.USER_UID, makingType], function (error, result) {
                if (error) {
                    callback(error, null);
                } else {
                    var makingList = result[0];
    
                    if (makingList.length > 0) {
                        var checkFlag = true;
                        if (makingType == 1)
                            checkFlag = common.checkCharacterSlot(socket, makingList.length);
                        else if(makingType == 2)
                            checkFlag = common.checkItemSlot(socket, makingList.length);
                    
                        if (!checkFlag) {
                            resResult = 2;
                            socket.emit('ANS_MAKING', { 'ATYPE': client.ATYPE, 'result': resResult });
                            return;
                        }        
                        callback(null, makingList);
                    } else {
                        callback(3, null);
                    }
                }
            });
        }, (makingList, callback) => {
            // 보상 생성 및 지급, 미션 업데이트
            let rewardList = [];
            if ( [1,2].indexOf(makingType) > -1 ) {
                for (let i = 0; i < makingList.length; i++) {
                    rewardList.push({ REWARD_ITEM_ID: makingList[i].REWARD_ITEM_ID, REWARD_ITEM_COUNT: 1 });
                }
            } else {
                for (let i = 0; i < makingList.length; i++) {
                    let flag = false;
                    
                    for (let j = 0; j < rewardList.length; j++) {
                        if(makingList[i].REWARD_ITEM_ID == rewardList[j].REWARD_ITEM_ID) {
                            makingList[i].REWARD_ITEM_COUNT += 1;
                            rewardList[j].REWARD_ITEM_COUNT += 1;
                            flag = true;
                            break;
                        } 
                    }
                    if(!flag) rewardList.push({ REWARD_ITEM_ID: makingList[i].REWARD_ITEM_ID, REWARD_ITEM_COUNT: 1 });
                }
            }
            Item.addRewardItem(socket, rewardList, 0, function (error, result) {
                // 영웅 1 장비 2 가구 3
                switch (makingType) {
                    case 1: Mission.addMission(acc.USER_UID, 8000031, rewardList.length); break;
                    case 2: Mission.addMission(acc.USER_UID, 8000032, rewardList.length); break;
                    case 3: 
                        let rewardCnt = 0;
                        for (let i = 0; i < rewardList.length; i++)
                            rewardCnt += rewardList[i].REWARD_ITEM_COUNT;
                        Mission.addMission(acc.USER_UID, 8000033, rewardCnt); 
                        break;
                }
                callback(error, makingList, result);
            });

        }, (makingList, rewardList, callback) => {
            // 제조 리스트 업데이트
            DB.query("CALL UPDATE_MAKING(?,?,?,?,?)", [4, acc.USER_UID, makingType, null, null], function (error, result) {
                if(error) {
                    callback(error, null, null);
                } else {
                    let responseMakingList = [];
                    let updatedMakingList = result[0];
                    for (let i = 0; i < updatedMakingList.length; i++) {
                        for (let j = 0; j < makingList.length; j++) {
                            if(updatedMakingList[i].MAKING_ID == makingList[j].MAKING_ID) {
                                responseMakingList.push(updatedMakingList[i]);
                                break;
                            }
                        }
                    }
                    async.eachSeries(responseMakingList, (makingObj, cb) => {
                        // 제조 내역 LOG DB 저장
                        logDB.query("INSERT INTO MAKING (USER_UID, MAKING_ID, COUNT) VALUES (?, ?, ?)", [acc.USER_UID, makingObj.MAKING_ID, 1], (error, result) => {
                            cb(error);
                        });
                    }, (error) => {
                        callback(error, responseMakingList, rewardList);
                    });
                }
            });
        }
    ], (error, responseMakingList, rewardList) => {
        console.timeEnd("ANS_MAKING_002");
        if(error) {
            if(typeof error == 'number') resResult = error;
            else resResult = 1;
            console.log(error);
            socket.emit('ANS_MAKING', { 'ATYPE': client.ATYPE, 'result': resResult, "MAKING": [], "REWARD": [] });
        } else {
            socket.emit('ANS_MAKING', { 'ATYPE': client.ATYPE, 'result': resResult, "MAKING": responseMakingList, "REWARD": rewardList });
        } 
    });
}

// 코인 사용량에 따른 보상 결정
function getRewardItem(socket, client, callback) {
    var makingCSVdata = CSVManager.BMakingSlotCost.GetData(client.MAKING_ID);
    var makingSummaryCSVList = CSVManager.BMakingSummary.GetTypeList(makingCSVdata.type);
    var makingTimeCSVData = null;
    var makingSummaryCSVData = null;
    var consumeCoinList = client.MONEY || [];

    var userItemList = socket.Session.GetItems();
    var rewardList = [];
    var sumItemCount = 0;

    for (let i = 0; i < consumeCoinList.length; i++) {
        sumItemCount += consumeCoinList[i].ITEM_COUNT;
        var itemObj = common.findObjectByKey(userItemList, "ITEM_UID", consumeCoinList[i].ITEM_UID);
        rewardList.push({ REWARD_ITEM_ID: itemObj.ITEM_ID, REWARD_ITEM_COUNT: -consumeCoinList[i].ITEM_COUNT, TYPE: 13 });
    }

    for (let j = 0; j < makingSummaryCSVList.length; j++) {
        if (makingSummaryCSVList[j].range_min <= sumItemCount && sumItemCount <= makingSummaryCSVList[j].range_max)
            makingSummaryCSVData = makingSummaryCSVList[j];
    }

    var probList = [];
    var probabilitySum = 0;
    var period = [0];
    var pickItemIndex = null;

    for (key in makingSummaryCSVData) {
        if (key.indexOf("probability") > -1) {
            if (makingSummaryCSVData[key] != 0) {
                probList.push(key.replace("_probability", ""));
                probabilitySum += makingSummaryCSVData[key] * 100000;
                period.push(probabilitySum);
            }
        }
    }

    var random = Math.floor(Math.random() * probabilitySum) + 1;

    for (let k = 0; k < period.length; k++) {
        if (period[k] <= random && random < period[k + 1]) {
            pickItemIndex = k;
            break;
        }
    }
    var pickName = probList[pickItemIndex];
    makingTimeCSVData = CSVManager.BMakingTime.GetData(makingSummaryCSVData[pickName]); // 등급 데이터 추출

    var makingObj = { MAKING_ID: client.MAKING_ID, TIME: Utils.Random(makingTimeCSVData.time_min, makingTimeCSVData.time_max), REWARD_ITEM_ID: 0 };
    // 사용된 코인에 따른 속성 값 추출
    getRewardType(consumeCoinList, function (itemUID) {
        var userItemList = socket.Session.GetItems();
        var tempObj = null;
        if ([1, 2].indexOf(makingSummaryCSVData.type) > -1) {

            var itemObj = common.findObjectByKey(userItemList, "ITEM_UID", itemUID);
            var type = 0;

            switch (itemObj.ITEM_ID) {
                case DefineItem.COIN_DEFENSIVE: type = 1; break; // 방어형
                case DefineItem.COIN_PROXIMITY: type = 2; break; // 근접형
                case DefineItem.COIN_MAGIC_TYPE: type = 3; break; // 마법형
                case DefineItem.COIN_LONG_RANGE: type = 4; break; // 저격형
                case DefineItem.COIN_SUPPORT_TYPE: type = 5; break; // 지원형
            }

            var targetList = [];
            if (makingSummaryCSVData.type == 1) {
                let tempCharacList = CSVManager.BCharacter.GetGradeList(makingTimeCSVData.type);
                let perList = makingTimeCSVData.PerList;
                if(perList.length > 0){
                    for (let i = 0; i < perList.length; i++) {
                        for(let j = tempCharacList.length - 1; j > -1; j--){
                            if(perList[i].ID == tempCharacList[j].id){
                                tempCharacList.splice(j, 1);
                                break;
                            }
                        }
                    }
                }

                let characterCSVData = [];
                for (let i = 0; i < tempCharacList.length; i++) {
                    switch (makingTimeCSVData.type) {
                        case 0: if (tempCharacList[i].evolution == 5) characterCSVData.push(tempCharacList[i]); break;
                        case 1: if (tempCharacList[i].evolution == 4) characterCSVData.push(tempCharacList[i]); break;
                        case 2: if (tempCharacList[i].evolution == 3) characterCSVData.push(tempCharacList[i]); break;
                        case 3: if (tempCharacList[i].evolution == 2) characterCSVData.push(tempCharacList[i]); break;
                        case 4: if (tempCharacList[i].evolution == 1) characterCSVData.push(tempCharacList[i]); break;
                        default: break;
                    }
                }
                for (let i = 0; i < characterCSVData.length; i++) {
                    if (characterCSVData[i].character_type == type) targetList.push(characterCSVData[i]);
                }
            } else if (makingSummaryCSVData.type == 2) {
                var itemCSVData = CSVManager.BItem.GetGradeList(makingTimeCSVData.type);
                for (let i = 0; i < itemCSVData.length; i++) {
                    if (itemCSVData[i].equip_type == type) targetList.push(itemCSVData[i]);
                }
            }
            tempObj = Utils.GetRandomArray(targetList);
            //console.log("making : getRewardItem : " + JSON.stringify(makingSummaryCSVData));
        } else {
            var itemCSVData = CSVManager.BItem.GetGradeList(makingTimeCSVData.type);
            let perList = makingTimeCSVData.PerList;
            if(perList.length > 0){
                for (let i = 0; i < perList.length; i++) {
                    for(let j = itemCSVData.length - 1; j > -1 ; j--){
                        if(perList[i].ID == itemCSVData[j].id){
                            itemCSVData.splice(j, 1);
                            break;
                        }
                    }
                }
            }
            tempObj = Utils.GetRandomArray(itemCSVData);
        }
        makingObj.REWARD_ITEM_ID = tempObj.id;
        callback({ MAKING: makingObj, REWARD: rewardList });
    });
}

// 사용된 코인에 따른 속성 값 추출
function getRewardType(consumeCoinList, callback) {
    var limit = CSVManager.BMakingCommon.GetData("type_probability_limit");
    var total = 0;

    for (var i = 0; i < consumeCoinList.length; i++)
        total += consumeCoinList[i].ITEM_COUNT;

    var restZeroCnt = 0;
    var restPer = 0;
    for (var i = 0; i < consumeCoinList.length; i++) {
        consumeCoinList[i].PER = parseFloat((consumeCoinList[i].ITEM_COUNT / total * 100).toFixed(5));
        consumeCoinList[i].REST = 0;
        if (consumeCoinList[i].PER > limit) {
            consumeCoinList[i].REST = parseFloat((consumeCoinList[i].PER - limit).toFixed(5));
            consumeCoinList[i].PER = limit;
            restPer += consumeCoinList[i].REST;
        } else
            restZeroCnt++;
    }

    for (var j = 0; j < consumeCoinList.length; j++) {
        if (consumeCoinList[j].REST == 0)
            consumeCoinList[j].PER += parseFloat((restPer / restZeroCnt).toFixed(5));
    }

    var probList = [];
    var probabilitySum = 0;
    var period = [0];
    var pickItemIndex = null;

    for (var i = 0; i < consumeCoinList.length; i++) {
        probList.push(consumeCoinList[i].ITEM_UID);
        probabilitySum += consumeCoinList[i].PER * 100000;
        period.push(probabilitySum);
    }
    var random = Math.floor(Math.random() * probabilitySum);

    for (var i = 0; i < period.length; i++) {
        if (period[i] <= random && random < period[i + 1]) {
            pickItemIndex = i;
            break;
        }
    }
    var pickName = probList[pickItemIndex];
    callback(pickName);
}

// 제조 즉시 지급
function immediateMaking(socket, client) {
    console.time("ANS_MAKING_001");
    var result = 0;
    var acc = socket.Session.GetAccount();

    if (client.MAKING_ID == undefined) {
        result = 1;
        socket.emit('ANS_MAKING', { 'ATYPE': client.ATYPE, 'result': result });
        return;
    }

    var userItemList = socket.Session.GetItems();
    var makingCSVData = CSVManager.BMakingSlotCost.GetData(client.MAKING_ID);

    var checkFlag = true;

    if (makingCSVData.type == 1) {
        checkFlag = common.checkCharacterSlot(socket, 1);
        var ticket = common.findObjectByKey(userItemList, "ITEM_ID", DefineItem.TICKET_FAST_HERO_MANUFACTURER);
        if (ticket == null || ticket.ITEM_COUNT < 1) {
            result = 3;
            socket.emit('ANS_MAKING', { 'ATYPE': client.ATYPE, 'result': result });
            return;
        }
    } else if (makingCSVData.type == 2) {
        checkFlag = common.checkItemSlot(socket, 1);
        var ticket = common.findObjectByKey(userItemList, "ITEM_ID", DefineItem.TICKET_FAST_EQUIPMENT_MANUFACTURER);
        if (ticket == null || ticket.ITEM_COUNT < 1) {
            result = 3;
            socket.emit('ANS_MAKING', { 'ATYPE': client.ATYPE, 'result': result });
            return;
        }
    }

    if (!checkFlag) {
        result = 2;
        socket.emit('ANS_MAKING', { 'ATYPE': client.ATYPE, 'result': result });
        return;
    }

    selectDB.query("CALL SELECT_MAKING(?,?,?)", [2, acc.USER_UID, client.MAKING_ID], function (aErr, aRes) {
        if (aErr) {
            PrintError(aErr);
            result = 1;
            socket.emit('ANS_MAKING', { 'ATYPE': client.ATYPE, 'result': result });
            return;
        }
        if (aRes[0].length > 0) {
            var makingObj = aRes[0][0];
            if (makingObj.REWARD_ITEM_ID != null) {
                var rewardList = [{ REWARD_ITEM_ID: makingObj.REWARD_ITEM_ID, REWARD_ITEM_COUNT: 1 }];

                var makingCSVData = CSVManager.BMakingSlotCost.GetData(client.MAKING_ID);
                var rewardObj = null;

                if (makingCSVData.type == 1)
                    rewardObj = { REWARD_ITEM_ID: DefineItem.TICKET_FAST_HERO_MANUFACTURER, REWARD_ITEM_COUNT: -1 };
                else
                    rewardObj = { REWARD_ITEM_ID: DefineItem.TICKET_FAST_EQUIPMENT_MANUFACTURER, REWARD_ITEM_COUNT: -1 };

                rewardList.push(rewardObj);

                DB.query("CALL UPDATE_MAKING(?,?,?,?,?)", [3, acc.USER_UID, client.MAKING_ID, null, null], function (bErr, bRes) {
                    logDB.query("INSERT INTO MAKING (USER_UID, MAKING_ID, COUNT) VALUES (?, ?, ?)", [acc.USER_UID, client.MAKING_ID, 1], (lErr, lRes) => {
                        if (bErr) {
                            PrintError(bErr);
                            result = 1;
                            socket.emit('ANS_MAKING', { 'ATYPE': client.ATYPE, 'result': result });
                            return;
                        }
                        Item.addRewardItem(socket, rewardList, 0, function (cErr, cRes) {
                            console.timeEnd("ANS_MAKING_001");
                            if (cErr) {
                                PrintError(cErr);
                                result = 1;
                                socket.emit('ANS_MAKING', { 'ATYPE': client.ATYPE, 'result': result });
                                return;
                            }
                            switch (makingCSVData.type) {
                                case 1: Mission.addMission(acc.USER_UID, 8000031, 1); break;
                                case 2: Mission.addMission(acc.USER_UID, 8000032, 1); break;
                                case 3: Mission.addMission(acc.USER_UID, 8000033, 1); break;
                            }
                            socket.emit('ANS_MAKING', { 'ATYPE': client.ATYPE, 'result': result, "MAKING": bRes[0], "REWARD": cRes });
                        });
                    });
                });
            } else {
                // 보상 아이템 에러
                result = 5;
                socket.emit('ANS_MAKING', { 'ATYPE': client.ATYPE, 'result': result });
            }

        } else {
            //잘못된 MAKING ID
            result = 4;
            socket.emit('ANS_MAKING', { 'ATYPE': client.ATYPE, 'result': result });
        }
    });
}

// 제조 시작
function making(socket, client) {
    console.time("ANS_MAKING_201");
    var result = 0;
    var acc = socket.Session.GetAccount();

    if (client.MAKING_ID == undefined || client.MONEY == undefined || client.MONEY.length < 5) {
        result = 1;
        socket.emit('ANS_MAKING', { 'ATYPE': client.ATYPE, 'result': result });
        return;
    }

    var userItemList = socket.Session.GetItems();
    var checkMoneyFlag = false;
    var errorFlag = false;

    for (var i = 0; i < client.MONEY.length; i++) {
        if (client.MONEY[i].ITEM_COUNT < 100)
            checkMoneyFlag = true;
    }

    for (var i = 0; i < client.MONEY.length; i++) {
        for (var j = 0; j < userItemList.length; j++) {
            if (client.MONEY[i].ITEM_UID == userItemList[j].ITEM_UID) {
                if (userItemList[j].ITEM_COUNT < client.MONEY[i].ITEM_COUNT) {
                    errorFlag = true;
                    break;
                }
            }
        }
    }

    if (checkMoneyFlag || errorFlag) {
        result = 2;
        socket.emit('ANS_MAKING', { 'ATYPE': client.ATYPE, 'result': result });
        return;
    }

    selectDB.query("CALL SELECT_MAKING(?,?,?)", [1, acc.USER_UID, client.MAKING_ID], function (aErr, aRes) {
        if (aErr) {
            PrintError(aErr);
            result = 1;
            socket.emit('ANS_MAKING', { 'ATYPE': client.ATYPE, 'result': result });
            return;
        }
        try {
            var makingObj = aRes[0][0];

            if (makingObj) {
                if (makingObj.STATUS == 2 || (makingObj.STATUS == 1 && makingObj.END_TIME == null)) {
                    getRewardItem(socket, client, function (obj) {
                        DB.query("CALL UPDATE_MAKING(?,?,?,?,?)", [2, acc.USER_UID, obj.MAKING.MAKING_ID, obj.MAKING.TIME, obj.MAKING.REWARD_ITEM_ID], function (bErr, bRes) {
                            if (bErr) {
                                PrintError(bErr);
                                result = 1;
                                socket.emit('ANS_MAKING', { 'ATYPE': client.ATYPE, 'result': result });
                                return;
                            }
                            Item.addRewardItem(socket, obj.REWARD, 0, function (cErr, cRes) {
                                console.timeEnd("ANS_MAKING_201");
                                if (cErr) {
                                    PrintError(cErr);
                                    result = 1;
                                    socket.emit('ANS_MAKING', { 'ATYPE': client.ATYPE, 'result': result });
                                    return;
                                }
                                socket.emit('ANS_MAKING', { 'ATYPE': client.ATYPE, 'result': result, "MAKING": bRes[0], "REWARD": cRes });
                            });
                        });

                    });
                } else {
                    //제조 가능 상태가 아님.
                    result = 3;
                    socket.emit('ANS_MAKING', { 'ATYPE': client.ATYPE, 'result': result });
                    return;
                }
            } else {
                //존재하지 않는
                result = 5;
                socket.emit('ANS_MAKING', { 'ATYPE': client.ATYPE, 'result': result });
                return;
            }
        } catch (e) { PrintError(e) };
    });
}

// 제조 데이터 조회
function getMaking(socket, client) {
    console.time("ANS_MAKING_100");
    var result = 0;
    var acc = socket.Session.GetAccount();

    DB.query("CALL CHECK_MAKING(?)", [acc.USER_UID], function (aErr, aRes) {
        if (aErr) {
            PrintError(aErr);
            result = 1;
            socket.emit('ANS_MAKING', { 'ATYPE': client.ATYPE, 'result': result });
            return;
        }
        console.timeEnd("ANS_MAKING_100");
        socket.emit('ANS_MAKING', { 'ATYPE': client.ATYPE, 'result': result, "MAKING": aRes[0] });
    });
}

// 제조 슬롯 확장
function openMaker(socket, client) {
    console.time("ANS_MAKING_200");
    try {
        var acc = socket.Session.GetAccount();
        var result = 0;

        if (client.MAKING_ID == undefined || client.TYPE == undefined) {
            result = 1;
            socket.emit('ANS_MAKING', { 'ATYPE': client.ATYPE, 'result': result });
            return;
        }
        var makingCSVData = CSVManager.BMakingSlotCost.GetData(client.MAKING_ID);
        var userItemList = socket.Session.GetItems();
        var money = null;

        // 재화 체크
        if (client.TYPE == 0) {
            money = common.findObjectByKey(userItemList, "ITEM_ID", makingCSVData.cost1_id);
            if (money.ITEM_COUNT < makingCSVData.cost1_value) {
                result = 2;
                socket.emit('ANS_MAKING', { 'ATYPE': client.ATYPE, 'result': result });
                return;
            }
        } else {
            money = common.findObjectByKey(userItemList, "ITEM_ID", makingCSVData.cost2_id);
            if (money.ITEM_COUNT < makingCSVData.cost2_value) {
                result = 2;
                socket.emit('ANS_MAKING', { 'ATYPE': client.ATYPE, 'result': result });
                return;
            }
        }

        //DB 체크해서 제조중이 아니고, 대여 기간 지난 슬롯 0으로 업데이트, STATUS 0 슬롯이 여러개일 경우 가장 낮은 슬롯 번호 만 놔두고 삭제
        DB.query("CALL CHECK_MAKING(?)", [acc.USER_UID], function (aErr, aRes) {
            if (aErr) {
                PrintError(aErr);
                result = 1;
                socket.emit('ANS_MAKING', { 'ATYPE': client.ATYPE, 'result': result });
                return;
            } else {
                var flag = false;
                for (var i = 0; i < aRes[0].length; i++) {
                    if (aRes[0][i].STATUS == 0) {
                        if (aRes[0][i].MAKING_ID == client.MAKING_ID)
                            flag = true;
                    }
                }
                if (!flag) {
                    //요청한 슬롯이 가장 낮은 슬롯 번호가 아닐 경우 에러메세지  오픈 가능한 슬롯이 아닙니다.
                    result = 3;
                    socket.emit('ANS_MAKING', { 'ATYPE': client.ATYPE, 'result': result, "MAKING": aRes[0] });
                    return;
                } else {

                    var openMakerParam = [];
                    var reward = [];
                    if (client.TYPE == 0) {
                        openMakerParam = [client.TYPE, acc.USER_UID, client.MAKING_ID, makingCSVData.time, null];
                        reward.push({ REWARD_ITEM_ID: makingCSVData.cost1_id, REWARD_ITEM_COUNT: -makingCSVData.cost1_value, TYPE: 23 });
                    } else {
                        openMakerParam = [client.TYPE, acc.USER_UID, client.MAKING_ID, null, null];
                        reward.push({ REWARD_ITEM_ID: makingCSVData.cost2_id, REWARD_ITEM_COUNT: -makingCSVData.cost2_value, TYPE: 23 });
                    }

                    async.series({
                        openMaker: function (callback) { DB.query("CALL UPDATE_MAKING(?,?,?,?,?)", openMakerParam, callback); },
                        addItem: function (callback) { Item.addRewardItem(socket, reward, 0, callback); }
                    }, function (bErr, bRes) {
                        if (bErr) {
                            PrintError(bErr);
                            result = 1;
                            socket.emit('ANS_MAKING', { 'ATYPE': client.ATYPE, 'result': result });
                            return;
                        }
                        var updateMaking = [];
                        updateMaking.push(bRes.openMaker[0][0][0]);

                        var insertMaking = null;
                        var typeList = CSVManager.BMakingSlotCost.GetTypeList(makingCSVData.type);
                        for (var i = 0; i < typeList.length; i++) {
                            if (typeList[i].slot_number < 11) {
                                var existFlag = false;
                                for (var j = 0; j < aRes[0].length; j++) {
                                    if (typeList[i].id == aRes[0][j].MAKING_ID)
                                        existFlag = true;
                                }
                                if (!existFlag) {
                                    insertMaking = typeList[i];
                                    break;
                                }
                            }
                        }
                        if (insertMaking != null) {
                            DB.query("CALL INSERT_MAKING(?,?,?,?)", [acc.USER_UID, insertMaking.id, insertMaking.type, 0], function (cErr, cRes) {
                                if (cErr) {
                                    PrintError(cErr);
                                    result = 1;
                                    socket.emit('ANS_MAKING', { 'ATYPE': client.ATYPE, 'result': result });
                                    return;
                                }
                                updateMaking.push(cRes[0][0]);
                                console.timeEnd("ANS_MAKING_200");
                                socket.emit('ANS_MAKING', { 'ATYPE': client.ATYPE, 'result': result, "MAKING": updateMaking, "REWARD": bRes.addItem });
                            });
                        } else {
                            console.timeEnd("ANS_MAKING_200");
                            socket.emit('ANS_MAKING', { 'ATYPE': client.ATYPE, 'result': result, "MAKING": updateMaking, "REWARD": bRes.addItem });
                        }
                    });
                }
            }
        });
    } catch (e) { PrintError(e); }
}