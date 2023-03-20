/**
 * 뽑기 Contorller
 */

module.exports.OnPacket = function (socket) {
    socket.on("REQ_GACHA", function (client) {
        try {
            if (client.ATYPE !== undefined) {
                var packetType = aTypeParser(client.ATYPE);

                if (packetType.cType == "0") {
                    switch (packetType.aType) {
                        case "00": pickGacha(socket, client); break;
                        default: break;
                    }
                } else if (packetType.cType == "1") {
                    switch (packetType.aType) {
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

// 뽑기
//gachaCSVData.type 1 캐릭터 뽑기, 2 아이템 뽑기, 3 가구 뽑기
function pickGacha(socket, client) {
    console.time("ANS_GACHA_000");
    var gachaCSVData = CSVManager.BGacha.data;
    var itemCSVData = CSVManager.BItem.data;
    var acquisitionRareList = [];

    try {
        var acc = socket.Session.GetAccount();
        var userItemList = socket.Session.GetItems();
        var userChaList = socket.Session.GetCharacters();
        var gacha = socket.Session.GetGacha();

        var gacha_id = client.GACHA_ID;

        var result = 0;
        var gachaObj = null;

        if (client.GACHA_ID == undefined) {
            result = 1;
            socket.emit('ANS_GACHA', { 'ATYPE': client.ATYPE, 'result': result });
            return;
        }
        var gachaCSVData = CSVManager.BGacha.GetData(gacha_id);


        var number = 0;
        switch (gachaCSVData.count_type) {
            case 0:
            case 1:
                number = 1; break;
            case 2: number = 10; break;
        }

        //슬롯 점검
        var checkSlotFlag = false;

        if (gachaCSVData.type == 1) checkSlotFlag = common.checkCharacterSlot(socket, number);
        else if (gachaCSVData.type == 2) checkSlotFlag = common.checkItemSlot(socket, number);

        if (!checkSlotFlag && gachaCSVData.type != 3) {	//슬롯 부족
            result = 2;
            socket.emit('ANS_GACHA', { 'ATYPE': client.ATYPE, 'result': result });
            return;
        }

        if (gachaCSVData.count_type != 0) {
            // 재화 부족 체크
            var money = common.findObjectByKey(userItemList, "ITEM_ID", gachaCSVData.cost_id);

            if (money == null || money.ITEM_COUNT < gachaCSVData.cost_value) {
                result = 3;
                socket.emit('ANS_GACHA', { 'ATYPE': client.ATYPE, 'result': result });
                return;
            }
        }

        // 뽑기 로그 저장
        logDB.query("CALL GACHA(?,?)", [acc.USER_UID, gachaCSVData.id], function (bErr, bRes) {
            if (bErr) {
                result = 1;
                socket.emit('ANS_GACHA', { 'ATYPE': client.ATYPE, 'result': result });
                return;
            }
            async.waterfall([function (wcb) {
                switch (gachaCSVData.type) {
                    case 1: Mission.addMission(acc.USER_UID, 8000036, number); break;
                    case 2: Mission.addMission(acc.USER_UID, 8000040, number); break;
                    case 3: Mission.addMission(acc.USER_UID, 8000037, number); break;
                }
                // 무료 뽑기의 경우 시간 체크를 위해 DB 관리
                if (gachaCSVData.count_type == 0) {
                    let que = DB.query("CALL INSERT_GACHA(?,?,?)", [acc.USER_UID, gachaCSVData.id, gachaCSVData.time], function (aErr, aRes) {
                        if (aErr) {
                            PrintError(aErr);
                            result = 1;
                        } else {
                            if (aRes[0][0].OVER !== undefined && aRes[0][0].OVER < 0) { // 무료 뽑기 가능 시간이 아님
                                result = 4;
                                gachaObj = aRes[0][0];
                                delete gachaObj["USER_UID"];
                                delete gachaObj["OVER"];
                                wcb("Time has not passed.");
                            } else {
                                Mission.addMission(acc.USER_UID, 8000035, number);
                                var updateFlag = false;

                                if (gacha.length > 0) {
                                    for (var i = 0; i < gacha.length; i++) {
                                        if (gacha[i].GACHA_ID == client.GACHA_ID) {
                                            gacha[i].PICK_TIME = aRes[0][0].PICK_TIME;
                                            gachaObj = gacha[i];
                                            updateFlag = true;
                                            break;
                                        }
                                    }
                                }
                                if (!updateFlag) {
                                    gacha.push(aRes[0][0]);
                                    gachaObj = aRes[0][0];
                                }
                                wcb(null);
                            }
                        }
                    });
                } else {
                    wcb(null);
                }
            }, function (wcb) {
                // 랜덤 뽑기
                var temp_reward_list = [];
                if (gachaCSVData.reward1 > 0) {
                    for (var i = 0; i < gachaCSVData.reward1_repeat; i++) {
                        temp_reward_list.push(CSVManager.BGachaReward.GetData(gachaCSVData.reward1));
                    }
                }
                if (gachaCSVData.reward2 > 0) {
                    for (var j = 0; j < gachaCSVData.reward2_repeat; j++) {
                        temp_reward_list.push(CSVManager.BGachaReward.GetData(gachaCSVData.reward2));
                    }
                }

                var tempList = [];
                var costList = [];
                async.each(temp_reward_list, function (obj, cb) {
                    if([1,2].indexOf(gachaCSVData.type) > -1){
                        let type = 0;
                        let args = [0,10];
                        if(gachaCSVData.type == 1) args = [99,0];

                        selectDB.query("SELECT `COUNT` CNT FROM CARD_LOG WHERE `DATE` = DATE_FORMAT(NOW(),'%Y-%m-%d') AND `TYPE` = ? AND GRADE = ?",
                            args, (error, result) => {
                                let limit = 0;
                                if(gachaCSVData.type == 1) limit = CSVManager.BMakingCommon.GetData('charac_creation_limit');
                                else limit = CSVManager.BMakingCommon.GetData('item_creation_limit');
                                let count = 0; 
                                if(result.length > 0) count = result[0].CNT;

                                if(count >= limit) {
                                    obj.reward2_probability += obj.reward1_probability;
                                    obj.reward1_probability = 0;
                                }
                                tempList.push(Gacha.StartRandomDraw(gachaCSVData.type, itemCSVData, obj));
                                cb(error);
                            });
                    } else {
                        tempList.push(Gacha.StartRandomDraw(gachaCSVData.type, itemCSVData, obj));    
                        cb(null);
                    }
                }, function (error) {

                    if (gachaCSVData.cost_id != 0) costList.push({ REWARD_ITEM_ID: gachaCSVData.cost_id, REWARD_ITEM_COUNT: -gachaCSVData.cost_value, TYPE: 22 });

                    logging.info("[" + acc.USER_NAME + "] - pickGacha");
                    
                    for (let i = 0; i < tempList.length; i++) {
                        logging.info(JSON.stringify(tempList[i]));
                        if (gachaCSVData.type == 1 && tempList[i].GRADE == 0)
                        acquisitionRareList.push({ UN: acc.USER_NAME, GRADE: tempList[i].GRADE, NAME: tempList[i].NAME });
                    }
                    // 레어 케릭터 뽑은 경우 
                    if (acquisitionRareList.length > 0) {
                        let chaObj = common.findObjectByKey(userChaList, "CHA_UID", acc.DELEGATE_ICON);
                        for (let i = 0; i < acquisitionRareList.length; i++) acquisitionRareList[i].UDI = chaObj.CHA_ID;
                        Chatting.SendRareItemAcquisitionMessage(socket, acquisitionRareList);
                    }
                    wcb(null, tempList, costList);
                });
            }, function (tempList, costList, wcb) {
                //소모 비용
                Item.addRewardItem(socket, costList, 1, function (cErr, cRes) {
                    if (cErr) wcb(cErr, null);
                    else wcb(null, tempList, cRes);
                });
            }, function (tempList, costList, wcb) {
                //획득 아이템 추가
                let type = 99;
                switch(gachaCSVData.type) {
                    case 2: type = 0; break;
                    case 3: type = 5; break;
                }
                //Item.addRewardItem(socket, tempList, 1, function (cErr, cRes) {
                Item.savedRewardListByType(socket, type, tempList, function (cErr, cRes) {
                    cRes.REWARD = cRes.REWARD.concat(costList.REWARD);
                    cRes.ITEM_LIST = cRes.ITEM_LIST.concat(costList.ITEM_LIST);
                    if (cErr) wcb(cErr, null);
                    else wcb(null, cRes);
                });
            }], function (wErr, wRes) {
                if (wErr) PrintError(wErr);
                else logging.info("[" + acc.USER_NAME + "] - pickGacha result " + result + 'GACHA : ' + gachaObj + ', REWARD: ' + wRes);
                
                console.timeEnd("ANS_GACHA_000");
                socket.emit('ANS_GACHA', { 'ATYPE': client.ATYPE, 'result': result, 'GACHA': gachaObj, 'REWARD': wRes });
            });
        });
    } catch (e) { PrintError(e); }
}


exports.StartRandomDraw = (gachaType, itemCSVData, gachaObj) => {

    let probList = [];
    let probabilitySum = 0;
    let period = [0];
    let pickItemIndex = null;

    for (key in gachaObj) {
        if (key.indexOf("probability") > -1) {
            probList.push(gachaObj[key.replace("_probability", "")]);
            probabilitySum += gachaObj[key] * 100000;
            period.push(probabilitySum);
        }
    }
    
    let random = Math.floor(Math.random() * probabilitySum) + 1;

    for (let j = 0; j < period.length; j++) {
        if (period[j] <= random && random < period[j + 1]) {
            pickItemIndex = j;
            break;
        }
    }
    let pickName = probList[pickItemIndex];
    let gachaPercentageObj = CSVManager.BGachaPercentage.GetData(pickName);
    let tempRewardList = [];

    //캐릭터 뽑기의 경우 SSS등급은 5성, SS등급은 4성 진화 단계에 맞게 지급
    let perList = gachaPercentageObj.PerList;
    if (gachaType == 1) { // 캐릭터 뽑기
        let tempCharacList = CSVManager.BCharacter.GetGradeList(gachaPercentageObj.type);
        if(perList.length > 0){
            for (let i = 0; i < perList.length; i++) {
                for(let j = tempCharacList.length - 1; j > -1 ; j--){
                    if(perList[i].ID == tempCharacList[j].id){
                        tempCharacList.splice(j, 1);
                        break;
                    }
                }
            }
        }
        
        for (let i = 0; i < tempCharacList.length; i++) {
            switch (gachaPercentageObj.type) {
                case 0: if (tempCharacList[i].evolution == 5) tempRewardList.push(tempCharacList[i]); break;
                case 1: if (tempCharacList[i].evolution == 4) tempRewardList.push(tempCharacList[i]); break;
                case 2: if (tempCharacList[i].evolution == 3) tempRewardList.push(tempCharacList[i]); break;
                case 3: if (tempCharacList[i].evolution == 2) tempRewardList.push(tempCharacList[i]); break;
                case 4: if (tempCharacList[i].evolution == 1) tempRewardList.push(tempCharacList[i]); break;
                default: break;
            }
        }
    } else { // 아이템 뽑기
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
        //console.log(JSON.stringify(itemCSVData));
        tempRewardList = common.findObjectByKeyList(itemCSVData, "grade", gachaPercentageObj.type);
    } 

    let tempObj = null;

    if (tempRewardList.length > 0) {
        let randomObj = Utils.GetRandomArray(tempRewardList);
        tempObj = {
            TYPE: randomObj.type, GRADE: randomObj.grade, NAME: randomObj.name,
            EVOLUTION: randomObj.evolution, REWARD_ITEM_ID: randomObj.id, REWARD_ITEM_COUNT: 1
        };
    }

    return tempObj;
}