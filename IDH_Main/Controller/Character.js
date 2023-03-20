/**
 * 캐릭터 Controller
 */

// 유저 캐릭터 조회
module.exports.GetCharacters = function (socket) {
    try {
        var returnArray = [];

        var characters = socket.Session.GetCharacters();
        for (var i = 0; i < characters.length; i++) {
            returnArray.push({
                'cha_uid': characters[i].CHA_UID,
                'cha_id': characters[i].CHA_ID,
                'dispatch': characters[i].DISPATCH,
                'farming_id': characters[i].FARMING_ID,
                'team': characters[i].TEAM
            });
        }
        return returnArray;
    } catch (e) { PrintError(e); }
}

// 팀 정보 조회
function getTeamStat(socket, client) {
    console.time("ANS_CHARAC_102");
    let team = client.TEAM;
    let acc = socket.Session.GetAccount();
    let result = 0;

    Character.CalculateTeamCombat(acc.USER_UID, team, socket, (error, combat, statList) => {
        if (error) result = 1;

        console.timeEnd("ANS_CHARAC_102");
        socket.emit('ANS_CHARACTER', { 'ATYPE': client.ATYPE, 'result': result, "STAT": statList });
    });
}

/**
 * 캐릭터 전투력 계산 (팀 정보 조회)
 * userUID가 null인 경우 유저 자신 정보 조회
 */
module.exports.CalculateTeamCombat = function (userUID, teamID, socket, callback) {
    var teamList = [];
    var myRoomBuffList = null;

    async.series([
        (scb) => {
            if (userUID == null) {  // 내 전투력 계산
                // 마이룸 버프 계산
                MyRoom.GetDelegateMyRoomBuff(socket, (buffList) => {
                    myRoomBuffList = buffList;
                    let userTeamList = socket.Session.GetTeam();
                    let userCharacter = socket.Session.GetCharacters();
                    for (let i = 0; i < userTeamList.length; i++) {
                        if (userTeamList[i].TEAM == teamID) {
                            let obj = common.findObjectByKey(userCharacter, "CHA_UID", userTeamList[i].CHA_UID);
                            teamList.push(obj);
                        }
                    }
                    scb(null);
                });
            } else scb(null);
        }, (scb) => {
            if (userUID != null) {
                selectDB.query("CALL SELECT_TEAM(?,?,?)", [2, userUID, teamID], (error, result) => {
                    if (!error) teamList = result[0];
                    scb(error);
                });
            } else scb(null);
        }], (error) => {
            if (error) {
                console.log(error);
                callback(error, 0);
            } else {
                let userItemList = [];
                if (userUID == null) userItemList = socket.Session.GetItems();

                //console.log("CalculateTeamCombat ===================== userUID : " + userUID + ", teamID : " + teamID + ", teamLength : " + teamList.length);

                Character.CalculateCharacterListCombat(userUID, userItemList, teamList, myRoomBuffList, (combat, statList) => {
                    callback(error, combat, statList);
                });
            }
        });
}

// 캐릭터 전투력 계산 (캐릭터 별 아이템 정보 조회)
module.exports.CalculateCharacterListCombat = (userUID, userItemList, teamList, myRoomBuffList, callback) => {
    var combat = 0;
    var chaStat = null;
    var statList = [];

    async.each(teamList, (character, ecb) => {
        var itemList = [];
        //아이템 정보
        async.series([
            (scb) => {
                if (userUID == null) {
                    for (let i = 0; i < userItemList.length; i++) {
                        if (userItemList[i].CHA_UID == character.CHA_UID) itemList.push(userItemList[i]);
                    }
                    scb(null);
                } else scb(null);
            }, (scb) => {
                if (userUID != null) {

                    selectDB.query("CALL SELECT_ITEM(?,?,?,?)", [3, userUID, null, character.CHA_UID], (error, result) => {
                        if (!error) {
                            try {
                                for (let i = 0; i < result[0].length; i++) {
                                    result[0][i].PREFIX = JSON.parse(result[0][i].PREFIX);
                                    result[0][i].OPTIONS = JSON.parse(result[0][i].OPTIONS);
                                }
                                itemList = result[0];
                            } catch (e) {
                                console.log("CalculateCharacterListCombat : Not Json");
                            }
                        }
                        scb(error);
                    });
                } else scb(null);
            }], (error) => {
                if (error) {
                    console.log(error);
                    ecb(error);
                } else {
                    if (character.CHA_ID < 1020001) {
                        chaStat = Character.calculateCharacterCombat(character, itemList, myRoomBuffList);

                        // 
                        /*
                        if(userUID == null) {
                            for(key in chaStat) chaStat[key] *= 5;
                            console.log(JSON.stringify(chaStat));
                            console.log("My Power Check...!");
                        } else {
                            console.log("Other Power Check...!");
                        }*/

                        statList.push({
                            CHA_UID: character.CHA_UID,
                            STAT: [0, parseFloat(chaStat.strength), parseFloat(chaStat.damage), parseFloat(chaStat.defensive)
                                , parseFloat(chaStat.action), parseFloat(chaStat.agility), parseFloat(chaStat.concentration)
                                , parseFloat(chaStat.recovery), parseFloat(chaStat.mentality), parseFloat(chaStat.aggro)],
                            AUTORECOVERY: parseFloat(chaStat.autoRecovery), CRITICAL: parseFloat(chaStat.critical), REDUCECOOL: parseFloat(chaStat.reduceCool)
                        });
                        combat += parseFloat(chaStat.power);
                    }
                    ecb(null);
                }
            });
    }, (error) => {
        // console.log("Character.calculateTeamCombat : " + combat);
        // console.log("statList : " + JSON.stringify(statList));
        callback(combat, statList);
    });
}

// 캐릭터 전투력 계산 (각 캐릭터 별 아이템 버프 적용 하여 최종 계산)
exports.calculateCharacterCombat = (characterObj, itemList, myRoomBuffList) => {
    let characterCSVData = CSVManager.BCharacter.GetData(characterObj.CHA_ID);
    let strengthCSVData = [
        CSVManager.BStrengthen.GetData(1, characterCSVData.character_type),
        CSVManager.BStrengthen.GetData(2, characterCSVData.character_type),
        CSVManager.BStrengthen.GetData(3, characterCSVData.character_type),
        CSVManager.BStrengthen.GetData(4, characterCSVData.character_type),
    ]

    var bifurcation = [0, 10, 25, 40, 50]

    //console.log(characterCSVData.name);
    let tempObj = {
        strength: 0, damage: 0, defensive: 0, action: 0, agility: 0, concentration: 0, recovery: 0, mentality: 0, aggro: 0
        , autoRecovery: 0, critical: 0, power: 0, reduceCool: 0
    };

    // 데이터 삽입
    for (var key in characterCSVData) {
        if (["strength", "damage", "defensive", "action", "agility", "concentration", "recovery", "mentality", "aggro"].indexOf(key) > -1) {
            tempObj[key] = characterCSVData[key];
        }
    }

    // 데이터 곱연산
    for (var index = 0; index < bifurcation.length - 1; index++) {
        if (bifurcation[index] < characterObj.ENCHANT) {
            for (var key in characterCSVData) {
                if (["strength", "damage", "defensive", "action", "agility", "concentration", "recovery", "mentality", "aggro"].indexOf(key) > -1) {
                    tempObj[key] *= Math.pow((strengthCSVData[index])[key],
                        (characterObj.ENCHANT >= bifurcation[index + 1]) ? bifurcation[index + 1] - bifurcation[index] : characterObj.ENCHANT - bifurcation[index]);
                }
            }
        }
    }

    //아이템 접두사 보정 및 옵션 합산
    // console.log("BEFORE ITEM SET");
    // console.log(JSON.stringify((tempObj)));
    if (itemList.length > 0) {
        for (let i = 0; i < itemList.length; i++) calculateItemPrefix(tempObj, itemList[i]);
        for (let i = 0; i < itemList.length; i++) calculateItemOptions(tempObj, itemList[i]);
    }

    let powerCal = CSVManager.BPowercal.GetData(characterCSVData.character_type);

    let tempStat = common.cloneObject(tempObj);
    for (var key in tempStat) {
        if (powerCal.hasOwnProperty(key)) {
            tempStat[key] *= powerCal[key];
        }
    }

    if (myRoomBuffList != null && myRoomBuffList.length > 0) {
        for (let i = 0; i < myRoomBuffList.length; i++) {
            switch (myRoomBuffList[i].EFFECT) {
                case 3: tempObj.damage *= myRoomBuffList[i].VALUE; break;
                case 5: tempObj.strength *= myRoomBuffList[i].VALUE; break;
                case 6: tempObj.concentration *= myRoomBuffList[i].VALUE; break;
                case 7: tempObj.defensive *= myRoomBuffList[i].VALUE; break;
            }
        }
    }

    //최종 전투력 계산(스텟 합산)
    for (var key in tempStat) {
        if (["power", "autoRecovery", "critical", "reduceCool"].indexOf(key) < 0) tempObj.power += tempStat[key];
    }

    tempObj.power = parseInt(tempObj.power);
    return tempObj;
}

// 아이템 접두사 계산 PREFIX
function calculateItemPrefix(baseStat, itemObj) {
    // console.log(JSON.stringify(itemObj));
    // console.log("PREFIX : " + JSON.stringify(itemObj.PREFIX) + ", OPTIONS : " + JSON.stringify(itemObj.OPTIONS));
    if (itemObj.PREFIX.hasOwnProperty("ID")) {
        itemObj.PREFIX.VALUE = parseFloat(itemObj.PREFIX.VALUE);
        //let prefixEnchant = CSVManager.BItemStrenghten.GetData("prefix_enchant");
        //let buff = (itemObj.PREFIX.VALUE * parseFloat(Math.pow(prefixEnchant, itemObj.ENCHANT))) / 100;
        let buff = itemObj.PREFIX.VALUE / 100;
        buff += 1;
        switch (itemObj.PREFIX.ID) {
            case 2: baseStat.autoRecovery = buff; break;
            case 4: baseStat.critical = buff; break;
            case 3: baseStat.damage *= buff; break;
            case 5: baseStat.strength *= buff; break;
            case 6: baseStat.aggro *= buff; break;
            case 7: baseStat.defensive *= buff; break;
            case 8: baseStat.reduceCool = buff; break;
        }
    }
}

// 아이템 옵션 계산 OPTIONS
function calculateItemOptions(baseStat, itemObj) {
    // console.log("OPTIONS : " + JSON.stringify(itemObj.OPTIONS));
    if (itemObj.OPTIONS.length > 0) {
        //let optionEnchant = CSVManager.BItemStrenghten.GetData("option_enchant");
        for (let i = 0; i < itemObj.OPTIONS.length; i++) {
            itemObj.OPTIONS[i].VALUE = parseFloat(itemObj.OPTIONS[i].VALUE);
            let buff = itemObj.OPTIONS[i].VALUE;
            //console.log(buff);

            switch (itemObj.OPTIONS[i].ID) {
                case 29:
                case 38:
                case 47:
                case 56:
                case 65:
                    baseStat.strength += buff; break;
                case 9:
                case 13:
                case 17:
                case 21:
                case 25:
                case 30:
                case 39:
                case 48:
                case 57:
                case 66:
                    baseStat.damage += buff; break;
                case 10:
                case 14:
                case 18:
                case 22:
                case 26:
                case 31:
                case 40:
                case 49:
                case 58:
                case 67:
                    baseStat.defensive += buff; break;
                case 32:
                case 41:
                case 50:
                case 59:
                case 68:
                    baseStat.action += buff; break;
                case 11:
                case 15:
                case 19:
                case 23:
                case 27:
                case 33:
                case 42:
                case 51:
                case 60:
                case 69:
                    baseStat.agility += buff; break;
                case 12:
                case 16:
                case 20:
                case 24:
                case 28:
                case 34:
                case 43:
                case 52:
                case 61:
                case 70:
                    baseStat.concentration += buff; break;
                case 35:
                case 44:
                case 53:
                case 62:
                case 71:
                    baseStat.recovery += buff; break;
                case 36:
                case 45:
                case 54:
                case 63:
                case 72:
                    baseStat.mentality += buff; break;
                case 37:
                case 46:
                case 55:
                case 64:
                case 73:
                    baseStat.aggro += buff; break;
            }
        }
    }
}

module.exports.OnPacket = function (socket) {
    socket.on("REQ_CHARACTER", function (client) {
        try {
            if (client.ATYPE !== undefined) {

                var packetType = aTypeParser(client.ATYPE);

                if (packetType.cType == "0") {
                    switch (packetType.aType) {
                        case "00": createEvaluation(socket, client); break;
                        case "01": testCalculateCombat(socket); break;
                        default: break;
                    }
                } else if (packetType.cType == "1") {
                    switch (packetType.aType) {
                        case "00": getEvaluation(socket, client); break;
                        case "01": getMyEvaluation(socket, client); break;
                        case "02": getTeamStat(socket, client); break;
                        case "03": getBook(socket, client); break;
                        default: break;
                    }
                } else if (packetType.cType == "2") {
                    switch (packetType.aType) {
                        case "00": updateTeam(socket, client); break;
                        case "01":
                            socket.TYPE = 0;
                            updateMyRoomID(socket, client); break;
                        case "02": updateEvaluation(socket, client); break;
                        case "03": recommandEvalution(socket, client); break;
                        case "04":
                            socket.TYPE = 1;
                            updateMyRoomID(socket, client); break;
                        case "05": updatePowerMission(socket, client); break;
                        case "06": addExp(socket, client); break;
                        case "07": setEnchant(socket, client); break;
                        case "08": setEvolution(socket, client); break;
                        default: break;
                    }
                } else if (packetType.cType == "3") {
                    switch (packetType.aType) {
                        case "00": deleteCharacter(socket, client); break;
                        case "01": saleCharacter(socket, client); break;
                        default: break;
                    }
                } else {

                }
            }
        } catch (e) { PrintError(e); }
    });
};

// 유저 팀 데이터 저장(삭제 후 Insert 방식)
function updateTeam(socket, client) {
    try {
        console.time("ANS_CHARAC_200");
        var acc = socket.Session.GetAccount();
        var characList = socket.Session.GetCharacters() || [];
        var result = 0;

        if (client.IDLIST == undefined || client.IDLIST.length == 0) {
            result = 1;
            socket.emit('ANS_CHARACTER', { 'ATYPE': client.ATYPE, 'result': result });
            return;
        } else {
            for (var i = 0; i < client.IDLIST.length; i++) {
                if (client.IDLIST[i].CHA_UID == undefined || client.IDLIST[i].POSITION == undefined || client.IDLIST[i].SKILL == undefined) {
                    result = 1;
                    socket.emit('ANS_CHARACTER', { 'ATYPE': client.ATYPE, 'result': result });
                    return;
                }
            }
        }

        var groupList = client.IDLIST.groupBy("TEAM");
        var teamList = [];
        for (key in groupList)
            teamList.push(key);


        async.waterfall([
            function (callback) {
                async.each(teamList, function (team, cb) {
                    DB.query('CALL DELETE_TEAM(?,?)', [acc.USER_UID, team], function (aErr, aRes) {
                        if (!aErr) {
                            cb(null);
                        } else {
                            cb(aErr);
                        }
                    });
                }, function (dErr) {
                    if (!dErr)
                        callback(null);
                    else
                        callback(dErr);
                });
            },
            function (callback) { //!< 지급 검사.
                async.each(client.IDLIST, function (obj, cb) {
                    if (obj.CHA_UID == -1) {
                        cb(null);
                    } else {
                        //console.log(JSON.stringify(obj));
                        DB.query('CALL UPDATE_TEAM(?,?,?,?,?)', [acc.USER_UID, obj.CHA_UID, obj.TEAM, obj.POSITION, obj.SKILL], function (bErr, bRes) {
                            if (!bErr) {
                                cb(null);
                            } else {
                                cb(bErr);
                            }
                        });
                    }
                }, function (dErr) {
                    if (!dErr)
                        callback(null);
                    else
                        callback(dErr);
                });
            }
        ], function (wErr, wRes) {
            if (wErr) {
                PrintError(wErr);
                result = 1;
                socket.emit('ANS_CHARACTER', { 'ATYPE': client.ATYPE, 'result': result, "TEAM": [] });
            } else {
                DB.query("CALL SELECT_TEAM(?,?,?)", [0, acc.USER_UID, 0], function (cErr, cRes) {
                    console.timeEnd("ANS_CHARAC_200");
                    if (!cErr) {
                        socket.Session.SetTeam(cRes[0]);
                        socket.emit('ANS_CHARACTER', { 'ATYPE': client.ATYPE, 'result': result, "TEAM": cRes[0] });
                    } else {
                        PrintError(cErr);
                        result = 1;

                        socket.emit('ANS_CHARACTER', { 'ATYPE': client.ATYPE, 'result': result, "TEAM": [] });
                    }
                });
            }
        });

    } catch (e) { PrintError(e); }
}

// 숙소 편집하기
function updateMyRoomID(socket, client) {
    console.time("ANS_CHARAC_201");
    try {
        // 숙소 편집하기 창에서 배치 버튼 클릭 시 호출, 배치 해제는 MYROOM_ID를 0으로.
        var acc = socket.Session.GetAccount();
        var userChaList = socket.Session.GetCharacters() || [];
        var chaList = client.IDLIST || [];
        var updateList = [];
        var result = 0;
        if (client.MYROOM_ID == undefined || client.IDLIST == undefined || client.IDLIST.length == 0) {
            result = 1;
            socket.emit('ANS_CHARACTER', { 'ATYPE': client.ATYPE, 'result': result });
            return;
        }
        var arrangeCount = 0;
        for (var i = 0; i < userChaList.length; i++) {
            if (chaList.indexOf(userChaList[i].CHA_UID) > -1) {
                if (socket.TYPE == 0 && userChaList[i].MYROOM_ID > 0) {
                    result = 4;
                    break;
                }
                updateList.push(userChaList[i].CHA_UID);
            }
            if (userChaList[i].MYROOM_ID == client.MYROOM_ID)
                arrangeCount++;
        }

        if (socket.TYPE == 0 && result == 4) {
            socket.emit('ANS_CHARACTER', { 'ATYPE': client.ATYPE, 'result': result, "CHA_LIST": [] });
            return;
        }

        arrangeCount += client.IDLIST.length;
        if (socket.TYPE == 0) {
            if (arrangeCount > CSVManager.BMyRoomCommon.GetData("character_limit")) {
                result = 3;
                socket.emit('ANS_CHARACTER', { 'ATYPE': client.ATYPE, 'result': result, "CHA_LIST": [] });
                return;
            }
        }

        if (updateList.length > 0) {

            var myRoomID = client.MYROOM_ID;
            if (socket.TYPE == 1) myRoomID = 0;

            DB.query('UPDATE CHARAC SET MYROOM_ID = ? WHERE USER_UID = ? AND CHA_UID IN (?)', [myRoomID, acc.USER_UID, updateList], function (err, res) {
                console.timeEnd("ANS_CHARAC_201");
                var resCharacterList = [];
                if (!err) {
                    for (var i = 0; i < userChaList.length; i++) {
                        if (chaList.indexOf(userChaList[i].CHA_UID) > -1) {
                            userChaList[i].MYROOM_ID = myRoomID;
                            resCharacterList.push(userChaList[i]);
                        }
                    }
                } else {
                    //쿼리 에러
                    PrintError(err);
                    result = 1;
                }
                socket.emit('ANS_CHARACTER', { 'ATYPE': client.ATYPE, 'result': result, "CHA_LIST": resCharacterList });
            });

        } else {
            //존재하지 않는 아이디
            result = 2;
            socket.emit('ANS_CHARACTER', { 'ATYPE': client.ATYPE, 'result': result, "CHA_LIST": [] });
        }
    } catch (e) { PrintError(e); }
}

// 캐릭터 삭제 시 관련된 데이터 삭제
function arrangeDataByDeletingCharacter(socket, acc, uidList, callback) {
    async.waterfall([
        (wcb) => {
            DB.query('DELETE FROM CHARAC WHERE USER_UID = ? AND CHA_UID IN (?)', [acc.USER_UID, uidList], function (error, result) {
                Mission.addMission(acc.USER_UID, 8000019, uidList.length);
                wcb(error);
            });
        }, (wcb) => {
            var dd = DB.query('UPDATE ITEM SET CHA_UID = null WHERE USER_UID = ? AND CHA_UID IN (?)', [acc.USER_UID, uidList], function (error, result) {
                if (error) wcb(error);
                else {
                    let userItemList = socket.Session.GetItems();
                    for (let i = 0; i < userItemList.length; i++)
                        if (uidList.indexOf(userItemList[i].CHA_UID) > -1) userItemList[i].CHA_UID = 0;
                    wcb(null);
                }
            });
        }, (wcb) => {
            DB.query('CALL SELECT_CHARACTER(?,?,?)', [0, acc.USER_UID, null], function (error, result) {
                if (error) wcb(error);
                else {
                    socket.Session.SetCharacters(result[0]);
                    wcb(null);
                }
            });
        }
    ], (error, result) => {
        callback(error);
    });
}

// 캐릭터 삭제
function deleteCharacter(socket, client) {
    console.time("ANS_CHARAC_300");
    var acc = socket.Session.GetAccount();
    var characList = socket.Session.GetCharacters() || [];
    var result = 0;
    if (client.IDLIST == undefined || client.IDLIST.length == 0) {
        result = 1;
        socket.emit('ANS_CHARACTER', { 'ATYPE': client.ATYPE, 'result': result });
        return;
    }
    arrangeDataByDeletingCharacter(socket, acc, client.IDLIST, (error) => {
        if (error) result = 1;

        console.timeEnd("ANS_CHARAC_300");
        socket.emit('ANS_CHARACTER', { 'ATYPE': client.ATYPE, 'result': result });
    });
}

// 캐릭터 판매
function saleCharacter(socket, client) {
    console.time("ANS_CHARAC_301");
    // 데이터 확인, 금액 정산, 해당 UID charac 테이블에서 삭제 및 금액 업데이트 
    var acc = socket.Session.GetAccount();
    var characList = socket.Session.GetCharacters() || [];
    var result = 0;
    var saleList = client.IDLIST;
    var salePrice = 0;

    if (client.IDLIST == undefined || client.IDLIST.length == 0) {
        result = 1;
        socket.emit('ANS_CHARACTER', { 'ATYPE': client.ATYPE, 'result': result });
        return;
    }

    for (var i = 0; i < characList.length; i++) {
        if (saleList.indexOf(characList[i].CHA_UID) > -1) {
            //기본 데이터에서 금액 합산
            var obj = CSVManager.BCharacter.GetData(characList[i].CHA_ID);
            if (obj) {
                salePrice += (obj.resell_price * (characList[i].ENCHANT + 1)) * 0.7;
            }

        }
    }

    Item.UpdateMoney(socket, 3, "gold", salePrice, function (error, uRes) {
        if (!error) {
            arrangeDataByDeletingCharacter(socket, acc, saleList, (error) => {
                console.timeEnd("ANS_CHARAC_301");
                if (error) {
                    PrintError(error);
                    socket.emit('ANS_CHARACTER', { 'ATYPE': client.ATYPE, 'result': 1 });
                } else socket.emit('ANS_CHARACTER', { 'ATYPE': client.ATYPE, 'result': result, 'GOLD': uRes[0] });
            });
        } else {
            PrintError(error);
            socket.emit('ANS_CHARACTER', { 'ATYPE': client.ATYPE, 'result': 1 });
        }
    });
}

/**
 * 캐릭터 평가 정보
 * client.CHA_ID
 * 해당 캐릭터 평가 정보와 평가 좋아요, 싫어요 스코어 응답
 * 추천순, 최신순, 상위 10개
 */
function getEvaluation(socket, client) {
    console.time("ANS_CHARAC_100");
    var acc = socket.Session.GetAccount();
    var result = 0;

    if (client.CHA_ID == undefined || client.ORDERTYPE == undefined || client.START == undefined || !checkIndexData(client.CHA_ID)) {
        result = 1;
        socket.emit('ANS_CHARACTER', { 'ATYPE': client.ATYPE, 'result': result });
        return;
    }

    selectDB.query("CALL SELECT_EVALUATION(?,?,?,?)",
        [acc.USER_UID, CSVManager.BCharacter.GetData(client.CHA_ID).index, client.ORDERTYPE, client.START], function (error, results) {
            if (error) {
                result = 1;
                socket.emit('ANS_CHARACTER', { 'ATYPE': client.ATYPE, 'result': result });
                return;
            }
            if (results[1].length > 0) setEvalListChaIndex(results[1]);

            console.timeEnd("ANS_CHARAC_100");
            socket.emit('ANS_CHARACTER', { 'ATYPE': client.ATYPE, 'result': result, "EVAL_SUMMARY": results[0], "EVAL_LIST": results[1] });
        });
}

/**
 * 캐릭터 평가 정보
 * client.CHA_ID
 * 해당 캐릭터 평가 정보와 평가 좋아요, 싫어요 스코어 응답
 * 추천순, 최신순, 상위 10개
 */
function getMyEvaluation(socket, client) {
    console.time("ANS_CHARAC_101");
    var acc = socket.Session.GetAccount();
    var result = 0;

    if (client.CHA_ID == undefined || !checkIndexData(client.CHA_ID)) {
        result = 1;
        socket.emit('ANS_CHARACTER', { 'ATYPE': client.ATYPE, 'result': result });
        return;
    }

    selectDB.query("CALL SELECT_EVALUATION(?,?,?,?)", [acc.USER_UID, CSVManager.BCharacter.GetData(client.CHA_ID).index, 2, 0], function (error, results) {
        if (error) {
            result = 1;
            socket.emit('ANS_CHARACTER', { 'ATYPE': client.ATYPE, 'result': result });
            return;
        }
        if (results[1].length > 0) setEvalListChaIndex(results[1]);

        console.timeEnd("ANS_CHARAC_101");
        socket.emit('ANS_CHARACTER', { 'ATYPE': client.ATYPE, 'result': result, "EVAL_LIST": results[1] });
    });
}

/**
 * 캐릭터 평가하기
 * client.CHA_ID, client.SCORE, client.COMMENT
 * 데이터 누락, 점수 범위, 코멘트 글자 수 체크
 * 해당 캐릭터 index로 정보 저장
 */
function createEvaluation(socket, client) {
    console.time("ANS_CHARAC_000");
    var acc = socket.Session.GetAccount();
    var result = 0;

    if (client.CHA_ID == undefined || client.SCORE == undefined || client.COMMENT == undefined || !checkIndexData(client.CHA_ID)) {
        result = 1;
        socket.emit('ANS_CHARACTER', { 'ATYPE': client.ATYPE, 'result': result });
        return;
    }

    if (client.SCORE > 5 || client.SCORE < 0) {
        result = 2;
        socket.emit('ANS_CHARACTER', { 'ATYPE': client.ATYPE, 'result': result });
        return;
    }

    if (client.COMMENT.length > 140) {
        result = 3;
        socket.emit('ANS_CHARACTER', { 'ATYPE': client.ATYPE, 'result': result });
        return;
    }

    DB.query("CALL INSERT_EVALUATION(?,?,?,?)",
        [acc.USER_UID, CSVManager.BCharacter.GetData(client.CHA_ID).index, client.SCORE, client.COMMENT], function (error, results) {
            if (error) {
                result = 1;
                PrintError(error);
            }
            if (results[1].length > 0) setEvalListChaIndex(results[1]);
            console.timeEnd("ANS_CHARAC_000");
            socket.emit('ANS_CHARACTER', { 'ATYPE': client.ATYPE, 'result': result, "EVAL_SUMMARY": results[0], "EVAL_LIST": results[1] });
            return;
        });
}

// 평가하기 수정
function updateEvaluation(socket, client) {
    console.time("ANS_CHARAC_202");
    var acc = socket.Session.GetAccount();
    var result = 0;

    if (client.SCORE == undefined || client.COMMENT == undefined || !checkIndexData(client.CHA_ID)) {
        result = 1;
        socket.emit('ANS_CHARACTER', { 'ATYPE': client.ATYPE, 'result': result });
        return;
    }

    if (client.SCORE > 5 || client.SCORE < 0) {
        result = 2;
        socket.emit('ANS_CHARACTER', { 'ATYPE': client.ATYPE, 'result': result });
        return;
    }

    if (client.COMMENT.length > 140) {
        result = 3;
        socket.emit('ANS_CHARACTER', { 'ATYPE': client.ATYPE, 'result': result });
        return;
    }

    DB.query("CALL UPDATE_EVALUATION(?,?,?,?)",
        [acc.USER_UID, CSVManager.BCharacter.GetData(client.CHA_ID).index, client.SCORE, client.COMMENT], function (error, results) {
            if (error) {
                result = 1;
                PrintError(error);
            }
            if (results[1].length > 0) setEvalListChaIndex(results[1]);
            console.timeEnd("ANS_CHARAC_202");
            socket.emit('ANS_CHARACTER', { 'ATYPE': client.ATYPE, 'result': result, "EVAL_SUMMARY": results[0], "EVAL_LIST": results[1] });
        });
}

// 캐릭터 평가글 추천
function recommandEvalution(socket, client) {
    console.time("ANS_CHARAC_203");
    var acc = socket.Session.GetAccount();
    var result = 0;
    let orderType = client.ORDERTYPE || 0;
    let start = client.START || 0;
    //EVAL_RECOMMAND
    // 없으면 INSERT, 다른 게 있으면 UPDATE, 같은 게 있으면 DELETE
    // 해당 평가글 추천 카운트 응답
    if (client.USER_UID == undefined || client.CHA_ID == undefined || client.RECOMMAND == undefined || !checkIndexData(client.CHA_ID)) {
        result = 1;
        socket.emit('ANS_CHARACTER', { 'ATYPE': client.ATYPE, 'result': result });
        return;
    }

    var chaIndex = CSVManager.BCharacter.GetData(client.CHA_ID).index;
    if (chaIndex == null) {
        result = 1;
        socket.emit('ANS_CHARACTER', { 'ATYPE': client.ATYPE, 'result': result });
        return;
    }
    //페이지 추가
    DB.query("CALL ADD_EVAL_RECOMMAND(?,?,?,?,?,?)",
        [client.USER_UID, chaIndex, acc.USER_UID, client.RECOMMAND, orderType, start], function (error, results) {
            if (error) {
                result = 1;
                PrintError(error);
            }
            if (results[1].length > 0) setEvalListChaIndex(results[1]);
            console.timeEnd("ANS_CHARAC_203");
            socket.emit('ANS_CHARACTER', { 'ATYPE': client.ATYPE, 'result': result, "EVAL_LIST": results[1] });
        });
}

// 평가 리스트 캐릭터 INDEX 변경
function setEvalListChaIndex(evalList) {
    for (let i = 0; i < evalList.length; i++) {
        evalList[i].CHA_INDEX = CSVManager.BCharacter.GetData(evalList[i].CHA_INDEX).index;
    }
}

// 클라이언트에서 전달된 캐릭터 ID에 index 값 존재 여부 확인
function checkIndexData(chaId) {
    var chaIndex = CSVManager.BCharacter.GetData(chaId).index;
    if (chaIndex == null)
        return false;
    else
        return true;
}

// 전투력 관련 미션 값 수정
function updatePowerMission(socket, client) {
    console.time("ANS_CHARAC_205");
    var power = client.P;
    var acc = socket.Session.GetAccount();
    var jsonData = { result: 0 };
    jsonData.ATYPE = client.ATYPE;

    if (power == undefined || power == 0) {
        jsonData.result = 1;
        socket.emit('ANS_CHARACTER', jsonData);
        return;
    }

    DB.query("CALL ADD_MISSION_CNT(?,?,?)", [acc.USER_UID, 8000041, power], function (error, results) {
        if (error) {
            jsonData.result = 1;
        }
        console.timeEnd("ANS_CHARAC_205");
        socket.emit('ANS_CHARACTER', jsonData);
    });
}

// 캐릭터 경험치 증가
function addExp(socket, client) {
    console.time("ANS_CHARAC_206");
    var jsonData = { result: 0 };
    jsonData.ATYPE = client.ATYPE;
    var acc = socket.Session.GetAccount();

    var target = client.T;
    var uidList = client.UL;
    // 데이터 누락
    if (target == null || target.length == 0 || uidList == null || uidList.length == 0) {
        jsonData.result = 1;
        socket.emit("ANS_CHARACTER", jsonData);
        return;
    }
    var chaList = uidList.concat(target);
    var sumExp = 0;

    // 존재하지 않는 UID
    if (!Character.checkCharacter(socket, chaList)) {
        jsonData.result = 3;
        socket.emit("ANS_CHARACTER", jsonData);
        return;
    }
    chaList.splice(chaList.length - 1, 1);

    let userCharacters = socket.Session.GetCharacters();

    var targetObj = common.findObjectByKey(userCharacters, "CHA_UID", target[0]);
    var targetCSVObj = CSVManager.BCharacter.GetData(targetObj.CHA_ID);

    for (let i = 0; i < userCharacters.length; i++) {
        if (chaList.indexOf(userCharacters[i].CHA_UID) > -1) {

            let tempObj = common.findObjectByKey(userCharacters, "CHA_UID", userCharacters[i].CHA_UID);
            let tempCSV = CSVManager.BCharacter.GetData(tempObj.CHA_ID);
            let addExp = tempCSV.enchant_exp;

            // 2020-03-10 기획팀에서 요구한 강화수치 * 0.7
            addExp *= (tempObj.ENCHANT + 1);
            addExp *= 0.7;


            if (targetCSVObj.index == tempCSV.index) addExp *= 2;

            sumExp += addExp;
        }
    }

    var nextSNeed = CSVManager.BSNeed.GetData(targetCSVObj.evolution, targetObj.ENCHANT + 1);

    if (nextSNeed == null) {
        //최대 강화 단계 
        jsonData.result = 4;
        socket.emit("ANS_CHARACTER", jsonData);
        return;
    }
    sumExp += targetObj.EXP;
    if (sumExp >= nextSNeed.exp) {
        sumExp = nextSNeed.exp;
    }
    sumExp -= targetObj.EXP;

    arrangeDataByDeletingCharacter(socket, acc, uidList, (error) => {
        if (!error) {
            DB.query("CALL UPDATE_CHARACTER(?,?,?,?)", [2, acc.USER_UID, targetObj.CHA_UID, sumExp], function (err, res) {
                console.timeEnd("ANS_CHARAC_206");
                if (err) {
                    PrintError(error);
                    jsonData.result = 2;
                    socket.emit("ANS_CHARACTER", jsonData);
                } else {
                    jsonData.CHA_LIST = res[0];
                    let userCharac = socket.Session.GetCharacters();
                    for (let i = 0; i < userCharac.length; i++) {
                        if (userCharac[i].CHA_UID == targetObj.CHA_UID) userCharac[i].EXP = res[0][0].EXP;
                    }
                    socket.emit("ANS_CHARACTER", jsonData);
                }
            });
        } else {
            PrintError(error);
            jsonData.result = 2;
            socket.emit("ANS_CHARACTER", jsonData);
        }
    });
}

// 캐릭터 강화
function setEnchant(socket, client) {
    /**
     * 캐릭터 강화
     * T: 타겟 uid, L: 재료 uidList
     * - 필요 재화 : 캐릭터, 골드
     * - 전송 데이터 검사
     * - 전송된 캐릭터 UID 검사
     * - 필요 재화(골드) 검사
     * - 타겟 uid 강화 제한 검사
     * - 타겟 캐릭터 강화 경험치와 재료 캐릭터 경험치 합산 비교
     * 
     * - 타겟 캐릭터 강화, 재료 캐릭터 삭제, 재화 차감 및 서버 데이터 동기화
     * - 강화된 데이터 리턴
     * */
    //재료 사용시 팀 배치된 케릭터 제외 추가
    console.time("ANS_CHARAC_207");
    var jsonData = { result: 0 };
    jsonData.ATYPE = client.ATYPE;
    var acc = socket.Session.GetAccount();

    var target = client.T;
    //데이터 누락
    if (target == null || target.length == 0) {
        jsonData.result = 1;
        socket.emit("ANS_CHARACTER", jsonData);
        return;
    }
    //존재하지 않는 UID
    if (!Character.checkCharacter(socket, target)) {
        jsonData.result = 3;
        socket.emit("ANS_CHARACTER", jsonData);
        return;
    }
    var userCharacters = socket.Session.GetCharacters();
    var targetObj = common.findObjectByKey(userCharacters, "CHA_UID", target[0]);
    var targetCSV = CSVManager.BCharacter.GetData(targetObj.CHA_ID);
    var nextSNeed = CSVManager.BSNeed.GetData(targetCSV.evolution, targetObj.ENCHANT + 1);

    if (nextSNeed == null) {
        //최대 강화 단계
        jsonData.result = 4;
        socket.emit("ANS_CHARACTER", jsonData);
        return;
    }

    if (targetObj.EXP != nextSNeed.exp) {
        //경험치 부족
        jsonData.result = 5;
        socket.emit("ANS_CHARACTER", jsonData);
        return;
    }

    var rewardList = [];
    if (nextSNeed.itemID > 0) {
        if (Item.getSingleItemCount(socket, nextSNeed.itemID) < nextSNeed.ncount) {
            // 아이템 부족
            jsonData.result = 7;
            socket.emit("ANS_CHARACTER", jsonData);
            return;
        }
        rewardList.push({ "REWARD_ITEM_ID": nextSNeed.itemID, "REWARD_ITEM_COUNT": -nextSNeed.ncount, TYPE: 5 });
    }

    
    if (nextSNeed.uchaID <= 0) {
        var uidList = client.UL;
        var chaList = uidList.concat(target);


        // 해당 캐릭터가 존재하지 않음. ( 클라로부터 데이터를 받지 못함.)
        if (uidList == null || uidList.length == 0) {
            result = 8;

            console.timeEnd("ANS_CHARAC_207");
            socket.emit("ANS_CHARACTER", jsonData);
            return;
        }

        // 레벨 검증
        let userCharacters = socket.Session.GetCharacters();
        for (let i = 0; i < userCharacters.length; i++) {
            if (chaList.indexOf(userCharacters[i].CHA_UID) > -1) {
                let tempObj = common.findObjectByKey(userCharacters, "CHA_UID", userCharacters[i].CHA_UID);
                let level = tempObj.ENCHANT;

                if (level < nextSNeed.character_lvl) {
                        result = 9;
                        socket.emit("ANS_CHARACTER", jsonData);
                        return;
                }
            }
        }

        arrangeDataByDeletingCharacter(socket, acc, uidList, (error) => {
            if (error) {
                result = 8;
                socket.emit("ANS_CHARACTER", jsonData);
                return;
            }
            
        });

        // 클라에게 캐릭터가 삭제됬음을 알리기.

    }



    //재화 차감, 캐릭터 강화, 캐릭터 삭제, 동기화
    async.waterfall([function (callback) {
        Item.addRewardItem(socket, rewardList, 0, function (err, res) {
            if (err) { callback(err); } else { jsonData.REWARD = res; callback(null); }
        });
    }, function (callback) {
        //인첸트
        DB.query("CALL UPDATE_CHARACTER(?,?,?,?)", [0, acc.USER_UID, targetObj.CHA_UID, 0], function (err, res) {
            if (err) { callback(err); } else {
                jsonData.CHA_LIST = res[0];
                for (let i = 0; i < userCharacters.length; i++) {
                    if (userCharacters[i].CHA_UID == targetObj.CHA_UID) {
                        userCharacters[i].ENCHANT = res[0][0].ENCHANT;
                    }
                }
                logging.info('[' + acc.USER_NAME + '] setEnchant CHA_UID : ' + targetObj.CHA_UID + ', ENCHANT : ' + res[0][0].ENCHANT);

                //LOGDB
                logDB.query("CALL INSERT_CHARAC_LOG(?,?,?)", [acc.USER_UID, targetCSV.index, res[0][0].ENCHANT], (error, result) => {
                    callback(error);
                });
            }
        });
    }], function (error, result) {
        //동기화, 응답
        let checkBSNeed = CSVManager.BSNeed.GetData(targetCSV.evolution, targetObj.ENCHANT + 2);
        if (checkBSNeed == null) { // 최대 강화 단계
            Mission.ChenckAndUpdateMission("ACHIEVE", acc.USER_UID, 8000020, targetCSV.evolution);
            Mission.ChenckAndUpdateMission("QUEST", acc.USER_UID, 8000020, targetCSV.evolution);
        }
        if (error) {
            PrintError(error);
            jsonData.result = 2;
        }
        console.timeEnd("ANS_CHARAC_207");
        socket.emit("ANS_CHARACTER", jsonData);
    });
}

// 캐릭터 진화
function setEvolution(socket, client) {
    /**
     * 캐릭터 진화
     * T: 타겟 uid
     * - 필요 재화 : 골드 or 캐쉬
     * - 전송 데이터 검사
     * - 전송된 카드 UID 검사
     * - 필요 재화(골드, 캐쉬) 검사
     * - 타겟 캐릭터 진화 마지막 단계 검사
     * 
     * - 타겟 캐릭터 진화, 재화 차감 및 서버 데이터 동기화
     * - 진화된 데이터 리턴
     * */
    console.time("ANS_CHARAC_208");
    var jsonData = { result: 0 };
    jsonData.ATYPE = client.ATYPE;
    var acc = socket.Session.GetAccount();
    var target = client.T;

    //데이터 누락
    if (target == null || target.length == 0) {
        jsonData.result = 1;
        socket.emit("ANS_CHARACTER", jsonData);
        return;
    }

    let chaExistFlag = Character.checkCharacter(socket, target);

    //존재하지 않는 UID
    if (!chaExistFlag) {
        jsonData.result = 3;
        socket.emit("ANS_CHARACTER", jsonData);
        return;
    }

    var userCharacters = socket.Session.GetCharacters();

    var targetObj = common.findObjectByKey(userCharacters, "CHA_UID", target[0]);
    var targetCSV = CSVManager.BCharacter.GetData(targetObj.CHA_ID);
    var nextSNeed = CSVManager.BSNeed.GetData(targetCSV.evolution, targetObj.ENCHANT + 1);

    if (nextSNeed != null) {
        //최대 강화 캐릭터 아님
        jsonData.result = 4;
        socket.emit("ANS_CHARACTER", jsonData);
        return;
    }

    if (targetCSV.evolution > 4) {
        //최대 진화 단계
        jsonData.result = 5;
        socket.emit("ANS_CHARACTER", jsonData);
        return;
    }

    var nextEvolution = CSVManager.BSNeed.GetData(targetCSV.evolution + 1, 0);
    //console.log("nextEvolution : " + JSON.stringify(nextEvolution));
    //필요 재화 검사
    var rewardList = [];
    if (nextSNeed.itemID > 0) {
        rewardList.push({ "REWARD_ITEM_ID": nextSNeed.itemID, "REWARD_ITEM_COUNT": -nextSNeed.ncount, TYPE: 6 });
        if (Item.getSingleItemCount(socket, nextSNeed.itemID) < nextSNeed.ncount) {
            // 아이템 부족
            jsonData.result = 7;
            socket.emit("ANS_CHARACTER", jsonData);
            return;
        }
    }

    // 필요 캐릭터 검사
    if (nextSNeed.uchaID <= 0) {
        var uidList = client.UL;
        var chaList = uidList.concat(target);


        // 해당 캐릭터가 존재하지 않음. ( 클라로부터 데이터를 받지 못함.)
        if (uidList == null || uidList.length == 0) {
            result = 8;

            socket.emit("ANS_CHARACTER", jsonData);
            return;
        }

        // 레벨 검증
        let userCharacters = socket.Session.GetCharacters();
        for (let i = 0; i < userCharacters.length; i++) {
            if (chaList.indexOf(userCharacters[i].CHA_UID) > -1) {
                let tempObj = common.findObjectByKey(userCharacters, "CHA_UID", userCharacters[i].CHA_UID);
                let level = tempObj.ENCHANT;

                if (level < nextSNeed.character_lvl) {
                    result = 9;
                    socket.emit("ANS_CHARACTER", jsonData);

                    return;
                }
            }
        }

        arrangeDataByDeletingCharacter(socket, acc, uidList, (error) => {
            if (error) {
                result = 8;
                socket.emit("ANS_CHARACTER", jsonData);

                return;
            }
        });

        // 클라에게 캐릭터가 삭제됬음을 알리기.

    }


    //console.log("rewardList : " + JSON.stringify(rewardList));
    //재화 차감, 캐릭터 진화, 동기화
    async.waterfall([
        function (callback) {
            Item.addRewardItem(socket, rewardList, 0, function (err, res) {
                if (err) {
                    callback(err);
                } else {
                    jsonData.REWARD = res;
                    callback(null);
                }
            });
        }, function (callback) {
            //진화
            DB.query("CALL UPDATE_CHARACTER(?,?,?,?)", [1, acc.USER_UID, targetObj.CHA_UID, 0], function (err, res) {
                if (err) {
                    callback(err);
                } else {
                    jsonData.CHA_LIST = res[0];

                    var characters = socket.Session.GetCharacters();
                    for (var i = 0; i < characters.length; i++) {
                        if (characters[i].CHA_UID == jsonData.CHA_LIST[0].CHA_UID) {
                            characters[i].CHA_ID = jsonData.CHA_LIST[0].CHA_ID;
                            ///ENCHANT 초기화
                            characters[i].ENCHANT = 0;
                            break;
                        }
                    }
                    callback(null);
                }
            });
        }
    ], function (error, result) {
        Mission.ChenckAndUpdateMission("QUEST", acc.USER_UID, 8000018, targetCSV.evolution);
        if (error) {
            PrintError(error);
            jsonData.result = 2;
        }
        console.timeEnd("ANS_CHARAC_208");
        socket.emit("ANS_CHARACTER", jsonData);
    });
}

// 클라이언트에서 전달된 캐릭터 UID 값 존재 여부 확인
exports.checkCharacter = function (socket, chaList) {
    let userChaList = socket.Session.GetCharacters();

    let chaExistCount = 0;
    for (var i = 0; i < userChaList.length; i++) {
        if (chaList.indexOf(userChaList[i].CHA_UID) > -1) {
            chaExistCount++;
        }
    }

    if (chaExistCount == chaList.length)
        return true;
    else
        return false;
}

// 각 캐릭터 진화 단계에 맞는 경험치 값 조회
exports.getCharacterExp = function (chaId) {
    var targetCSV = CSVManager.BCharacter.GetData(chaId);
    return CSVManager.BSNeed.GetData(targetCSV.evolution, 0).exp || 0;
}