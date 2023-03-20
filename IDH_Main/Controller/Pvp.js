/*
 * PVP Controller
 */

module.exports.OnPacket = function (socket) {

    socket.on("REQ_PVP", function (client) {
        try {
            if (client.ATYPE !== undefined) {

                var packetType = aTypeParser(client.ATYPE);

                if (packetType.cType == "0") {
                    switch (packetType.aType) {
                        case "00": finalCompletePlacementTest(socket, client); break;
                        default: break;
                    }
                } else if (packetType.cType == "1") {
                    switch (packetType.aType) {
                        case "00": getPvPMain(socket, client); break;
                        case "01": getPvPReward(socket, client); break;
                        case "03": getPvPTeam(socket, client); break;
                        default: break;
                    }
                } else if (packetType.cType == "2") {
                    switch (packetType.aType) {
                        case "00": socket.TYPE = 0; readyPlacementTest(socket, client); break;
                        //재탐색
                        case "01": socket.TYPE = 1; readyPlacementTest(socket, client); break;
                        case "02": completePlacementTest(socket, client); break;
                        case "03": startPvP(socket, client); break;
                        case "04": endPvP(socket, client); break;
                        default: break;
                    }
                } else if (packetType.cType == "3") {
                    switch (packetType.aType) {
                        case "00": rearrangeGrade(); break;
                        default: break;
                    }
                } else {

                }
            }
        } catch (e) { PrintError(e); }
    });
}

//PVP 상대 매칭, 재탐색
function readyPlacementTest(socket, client) {
    console.time("ANS_PVP_200");
    try {
        var acc = socket.Session.GetAccount();
        var result = 0;
        var userPvP = socket.Session.GetPvP();

        if (common.timeCheck('PVP')) {  // PVP 가능 시간 체크
            result = 6;
            socket.emit('ANS_PVP', { 'ATYPE': client.ATYPE, 'result': result });
            return;
        }

        if (userPvP[0].PLACEMENT == 0 && userPvP[0].RECHALLENGE_COUNT == 0) {   // 배치고사 상태, 재도전 카운트 체크
            result = 2;
            socket.emit('ANS_PVP', { 'ATYPE': client.ATYPE, 'result': result });
            return;
        }

        if (userPvP[0].PLACEMENT == 0 && userPvP[0].GRADE == 7000008) {     // 배치고사 상태에서 마지막 등급인 경우
            result = 7;
            socket.emit('ANS_PVP', { 'ATYPE': client.ATYPE, 'result': result });
            return;
        }

        if (socket.TYPE == 1) { // type - 0: 일반 진행, 1: 재탐색
            if (userPvP[0].ENEMY_UID == null) { // 배치고사 진행 시 매칭이 완료 되면 ENEMY_UID 값을 저장 됨, 재탐색 요청인데 매칭이 안된 경우 체크
                result = 5;
                socket.emit('ANS_PVP', { 'ATYPE': client.ATYPE, 'result': result });
                return;
            }

            var userItemList = socket.Session.GetItems();

            var money = common.findObjectByKey(userItemList, "ITEM_ID", DefineItem.GOLD);
            var needMoney = 0;
            //재탐색 카운트는 클라이언트에서 체크
            // client.COUNT = 첫 탐색 0, 1씩 증가
            var initValue = CSVManager.BPvPCommon.GetData("research_initial_value");
            var increaseValue = CSVManager.BPvPCommon.GetData("research_increase_value");
            needMoney = initValue + (increaseValue * (userPvP[0].REDISCOVER));
            if (money.ITEM_COUNT < needMoney) { // 재화 부족
                result = 3;
                socket.emit('ANS_PVP', { 'ATYPE': client.ATYPE, 'result': result });
                return;
            }
        }

        // PVP 팀(5) 전투력 계산
        Character.CalculateTeamCombat(null, 5, socket, (error, myCombat, statList) => {

            userPvP[0].POWER = myCombat;

            var grade = 0;
            if (userPvP[0].PLACEMENT == 0) {
                if (userPvP[0].GRADE == 0) grade = CSVManager.BRateReward.data[0].id;   // 배치고사 처음 진행한 경우 초기 등급으로 grade 설정
                else grade = CSVManager.BRateReward.GetNextID(userPvP[0].GRADE);    // 배치고사 처음 진행이 아닌 경우 다음 등급으로 grade 설정
            } else grade = userPvP[0].GRADE;    // PVP 진행
            
            // 상대 매칭
            getEnemy(socket, acc, userPvP, grade, function (data) {
                var afUserPvP = socket.Session.GetPvP();
                if (socket.TYPE == 1) {
                    var rewardList = [{ REWARD_ITEM_ID: DefineItem.GOLD, REWARD_ITEM_COUNT: -needMoney, TYPE: 16 }];

                    Item.addRewardItem(socket, rewardList, 0, function (cErr, cRes) {
                        if (cErr) {
                            PrintError(cErr);
                            result = 4;
                            socket.emit('ANS_PVP', { 'ATYPE': client.ATYPE, 'result': result });
                            return;
                        }
                        console.timeEnd("ANS_PVP_200");
                        socket.emit('ANS_PVP', {
                            'ATYPE': client.ATYPE, 'result': result, "PVP": afUserPvP, "STAT": statList
                            , "MY_COMBAT": myCombat, "REWARD": cRes, "ENEMY": data
                        });
                    });
                } else {
                    console.timeEnd("ANS_PVP_200");
                    socket.emit('ANS_PVP', {
                        'ATYPE': client.ATYPE, 'result': result, "PVP": afUserPvP, "STAT": statList
                        , "MY_COMBAT": myCombat, "REWARD": [], "ENEMY": data
                    });
                }
            });
        });
    } catch (e) { console.log(e); }
}

//배치고사 완료
function completePlacementTest(socket, client) {
    console.time("ANS_PVP_202");
    try {
        var acc = socket.Session.GetAccount();
        var userPvP = socket.Session.GetPvP();
        var result = 0;

        if (userPvP[0].GRADE == 7000008) {  // 마지막 등급
            result = 4;
            socket.emit('ANS_PVP', { 'ATYPE': client.ATYPE, 'result': result });
            return;
        }

        if (client.VICTORY == undefined) {
            result = 2;
            socket.emit('ANS_PVP', { 'ATYPE': client.ATYPE, 'result': result });
            return;
        }

        if (userPvP[0].RECHALLENGE_COUNT == 0) {    // 도전 횟수 없음
            result = 3;
            socket.emit('ANS_PVP', { 'ATYPE': client.ATYPE, 'result': result });
            return;
        }

        var grade = 0;
        if (userPvP[0].GRADE == 0) grade = CSVManager.BRateReward.data[0].id;
        else grade = CSVManager.BRateReward.GetNextID(userPvP[0].GRADE);

        if (grade == 7000009) grade = 7000008;

        // PVP 데이터 갱신
        DB.query("CALL UPDATE_PVP(?,?,?,?,?,?)", [client.VICTORY, acc.USER_UID, grade, null, null, null], function (error, results) {
            if (error) {
                PrintError(error);
                result = 1;
            }
            userPvP[0].ENEMY_UID = null;
            userPvP[0].REDISCOVER = 0;

            if (client.VICTORY == 0) userPvP[0].RECHALLENGE_COUNT--;    // 실패한 경우만 재도전 횟수 차감
            if (client.VICTORY == 1) userPvP[0].GRADE = grade;          // 승리한 경우 다음 등급 응답

            console.timeEnd("ANS_PVP_202");
            socket.emit('ANS_PVP', { 'ATYPE': client.ATYPE, 'result': result, "PVP": userPvP });
        });
    } catch (e) { console.log(e); }
}

//배치고사 등급 확정
function finalCompletePlacementTest(socket, client) {
    console.time("ANS_PVP_000");
    try {
        var acc = socket.Session.GetAccount();
        var userPvP = socket.Session.GetPvP();
        var result = 0;

        Character.CalculateTeamCombat(null, 5, socket, (error, myCombat) => {
            var myPoint = 0;
            var rateRewardCSVData = CSVManager.BRateReward.data;
            var initPoint = CSVManager.BPvPCommon.GetData("grade_initial_value");       // 초기 PVP 점수
            var increasePoint = CSVManager.BPvPCommon.GetData("grade_increase_value");  // 등급 단계에 따라 증가하는 수치

            for (var i = 0; i < rateRewardCSVData.length; i++) {
                if (rateRewardCSVData[i].id == 7000001) {
                    rateRewardCSVData[i].initPoint = initPoint;
                } else {
                    rateRewardCSVData[i].initPoint = initPoint + (increasePoint * i);
                }
            }

            myPoint = common.findObjectByKey(rateRewardCSVData, "id", userPvP[0].GRADE).initPoint;

            // PVP 데이터 갱신
            DB.query("CALL UPDATE_PVP(?,?,?,?,?,?)",
                [2, acc.USER_UID, userPvP[0].GRADE, CSVManager.BPvPCommon.GetData("group_count"), myCombat, myPoint], function (error, results) {
                    if (error) {
                        PrintError(error);
                        result = 1;
                    }
                    Mission.addMission(acc.USER_UID, 8000030, userPvP[0].GRADE);
                    socket.Session.SetPvP(results[0]);

                    // 해당 등급에 맞는 순위 데이터 조회
                    getPvPStatus(socket, function (data) {
                        console.timeEnd("ANS_PVP_000");
                        socket.emit('ANS_PVP', { 'ATYPE': client.ATYPE, 'result': result, "PVP": results[0], "RANK": data });
                    });
                });
        });
    } catch (e) { console.log(e); }
}

//PVP 진입 화면
function getPvPMain(socket, client) {
    console.time("ANS_PVP_100");
    var acc = socket.Session.GetAccount();
    var result = 0;

    if (common.timeCheck('PVP')) {
        result = 2;
        socket.emit('ANS_PVP', { 'ATYPE': client.ATYPE, 'result': result });
        return;
    }
    // PVP 진입 응답 전 내 전투력 계산하여 PVP 데이터 갱신
    Character.CalculateTeamCombat(null, 5, socket, (error, teamPowerSum, statList) => {
        DB.query("UPDATE PVP SET POWER = ? WHERE USER_UID = ?", [teamPowerSum, acc.USER_UID], (err, res) => {
            if(err) {
                PrintError(err);
                result = 1;
                socket.emit('ANS_PVP', { 'ATYPE': client.ATYPE, 'result': result });
                return;
            } else {
                // PVP 순위 정보 조회
                getPvPStatus(socket, function (data) {
                    if (data == null) {
                        result = 1;
                        socket.emit('ANS_PVP', { 'ATYPE': client.ATYPE, 'result': result });
                        return;
                    }
                    // 시즌 종료 팝업 여부 - lastSeason
                    // 순위 재조정 후 PVP_LOG DB Table에 저장된 데이터 조회
                    DB.query("CALL CHECK_PVP_LOG(?,?)", [0, acc.USER_UID], function (error, results) {
                        var lastSeason = null;
                        if (error) {
                            PrintError(error);
                            result = 1;
                            socket.emit('ANS_PVP', { 'ATYPE': client.ATYPE, 'result': result });
                        } else {
                            if (results[0].length > 0) {
                                for (let i = 0; i < results[0].length; i++) {
                                    if (results[0][i].BFGRADE == 7000008 && results[0][i].RANK == 0) {
                                        results[0][i].GRADE = 7000009;
                                        results[0][i].RANK = 1;
                                    }
                                }
                                lastSeason = { "RESULT": results[0], "REWARD": results[1] };
                            }
                        }
                        console.timeEnd("ANS_PVP_100");
                        socket.emit('ANS_PVP', { 'ATYPE': client.ATYPE, 'result': result, "RANK": data, "LAST_SEASON": lastSeason });
                    });
                });
            }
        });
    });

}

//내 순위, 현재 조 순위리스트, TOP RANK 50, 나의 위치 조회
function getPvPStatus(socket, callback) {
    var userPvP = socket.Session.GetPvP();
    var result = 0;

    if (userPvP.length == 0) {
        callback(null);
        return;
    }

    selectDB.query("CALL SELECT_PVP_RANK(?,?)", [0, userPvP[0].USER_UID], function (error, results) {
        if (error) {
            PrintError(error);
            result = 1;
        }
        var myRank = results[0];
        var groupRank = results[1];
        var topRank = results[2];
        var champion = results[4];
        var myPosition = [];
        var rateRewardCSVData = CSVManager.BRateReward.data;

        for (var i = 0; i < rateRewardCSVData.length; i++) {
            var flag = false;
            for (var j = 0; j < results[3].length; j++) {
                if (rateRewardCSVData[i].id == results[3][j].GRADE) {
                    flag = true;
                    myPosition.push({ GRADE: results[3][j].GRADE, AVERAGE: results[3][j].AVERAGE });
                    break;
                }
            }
            if (!flag)
                myPosition.push({ GRADE: rateRewardCSVData[i].id, AVERAGE: 0 });
        }
        for (var k = 0; k < myPosition.length; k++) {
            if (myPosition[k].GRADE == rateRewardCSVData[rateRewardCSVData.length - 1].id) {
                if (champion.length > 0)
                    myPosition[k].AVERAGE = champion[0].POINT;
                else
                    myPosition[k].AVERAGE = 0;
            }
        }

        groupRank = setRank(groupRank, "POINT");
        topRank = setRank(topRank, "POINT");

        for (var j = 0; j < groupRank.length; j++) {
            if (groupRank[j].USER_UID == userPvP[0].USER_UID) {
                myRank[0].GROUP_RANK = groupRank[j].RANK;
                break;
            }
        }
        callback({ MYRANK: myRank, GROUP_RANK: groupRank, TOP_RANK: topRank, MYPOSITION: myPosition });
    });
}

function setRank(list, condition) {
    var realRank = 0;
    var preValue = 0;
    var preRank = 0;

    for (var i = 0; i < list.length; i++) {
        if (preValue == list[i][condition])
            list[i].RANK = realRank;
        else
            list[i].RANK = ++realRank;

        if (list[i].RANK != preRank) {
            list[i].RANK = i + 1;
            realRank = list[i].RANK;
        }
        preValue = list[i][condition];
        preRank = list[i].RANK;
    }
    return list;
}


// PVP 상대 매칭
function getEnemy(socket, acc, userPvP, grade, callback) {
    /**
     * condition 1 - 배치고사
     * condition 2 - 일반 매칭
     * condition 4 - 마이룸 복수하기 PVP
     */
    var condition = 1;
    var range = null;
    if (userPvP[0].PLACEMENT != 0) {
        condition = 2;
        range = CSVManager.BPvPCommon.GetData("match_range");
    }

    // userPvP ENEMY_UID 가 있으면 해당 유저
    var userUID = acc.USER_UID;
    if (socket.TYPE == 0 && userPvP[0].ENEMY_UID != null && userPvP[0].ENEMY_UID != '' && userPvP[0].PLACEMENT != 0 && userPvP[0].ENEMY_UID.toString().substr(0, 2) != 99 && userPvP[0].ENEMY_UID.toString() != '0') {
        condition = 4;
        userUID = userPvP[0].ENEMY_UID;
    }

    DB.query("CALL SELECT_PVP(?,?,?,?,?,?,?)", [condition, userUID, grade, userPvP[0].GROUP, range, userPvP[0].POWER, socket.TYPE], function (error, results) {
        if (error) {
            PrintError(error);
            result = 1;
        }
        try {
            var enemy_pvp = results[0];     // 상대 PVP 정보
            var enemy_list = results[1];    // 상대 PVP 팀 정보
            var myRoomItem = results[2];    // 상대 마이룸 정보(PVP 진행 시 매칭된 유저의 마이룸 정보로 배경 및 가구 배치)

            if (condition != 4) socket.Session.SetPvP(results[3]);      // 마이룸 복수하기가 아닌 경우 내 PVP 데이터 갱신

            // 배치고사 or 배치고사 이후 진입 시 적이 없는 경우 or 적이 더미 데이터 인 경우
            if (userPvP[0].PLACEMENT == 0 || (condition == 2 && results[4][0].GROUP_CNT == 1) || enemy_pvp[0].USER_UID.toString().substr(0, 2) == 99) {
                Character.CalculateCharacterListCombat(enemy_list[0].USER_UID, null, enemy_list, null, (enemyCombat, statList) => {
                    var enemy = {};
                    enemy["PVP"] = enemy_pvp;
                    enemy["COMBAT"] = enemyCombat;
                    for (let i = 0; i < enemy_list.length; i++) {
                        for (let j = 0; j < statList.length; j++) {
                            if (enemy_list[i].CHA_UID == statList[j].CHA_UID) {
                                enemy_list[i].STAT = statList[j].STAT;
                                enemy_list[i].AUTORECOVERY = statList[j].AUTORECOVERY;
                                enemy_list[i].CRITICAL = statList[j].CRITICAL;
                                break;
                            }
                        }
                    }
                    enemy["LIST"] = enemy_list;
                    for (let k = 0; k < myRoomItem.length; k++) {
                        try {
                            myRoomItem[k].ANCHOR = JSON.parse(myRoomItem[k].ANCHOR);
                            myRoomItem[k].POSITION = JSON.parse(myRoomItem[k].POSITION);
                        } catch (e) { console.log("Not Json"); }
                    }
                    enemy["MYROOM_ITEM"] = myRoomItem;
                    enemy["RANK"] = 0;
                    enemy["GROUP_RANK"] = 0;

                    callback(enemy);
                });
            } else {
                let que = selectDB.query("CALL SELECT_PVP_RANK(?,?)", [1, enemy_pvp[0].USER_UID], function (eErr, eRes) {
                    console.log(que.sql);
                    if (eErr) {
                        PrintError(eErr);
                        result = 1;
                    }
                    Character.CalculateCharacterListCombat(enemy_list[0].USER_UID, null, enemy_list, null, (enemyCombat, statList) => {
                        //console.log("MyRoom ItemList : " + JSON.stringify(myRoomItem));
                        for (let j = 0; j < myRoomItem.length; j++) {
                            let obj = CSVManager.BItem.GetData(myRoomItem[j].ITEM_ID);
                            if (obj == null) {
                                console.log("Can't Find Item : " + myRoomItem[j].ITEM_ID);
                                myRoomItem[j].TYPE = 21;
                            } 
                            else myRoomItem[j].TYPE = obj.effect;
                        }
                        
                        var enemy = {};
                        enemy["PVP"] = enemy_pvp;
                        enemy["COMBAT"] = enemyCombat;
                        for (let i = 0; i < enemy_list.length; i++) {
                            for (let j = 0; j < statList.length; j++) {
                                if (enemy_list[i].CHA_UID == statList[j].CHA_UID) {
                                    enemy_list[i].STAT = statList[j].STAT;
                                    enemy_list[i].AUTORECOVERY = statList[j].AUTORECOVERY;
                                    enemy_list[i].CRITICAL = statList[j].CRITICAL;
                                    break;
                                }
                            }
                        }

                        enemy["LIST"] = enemy_list;
                        for (let k = 0; k < myRoomItem.length; k++) {
                            try {
                                myRoomItem[k].ANCHOR = JSON.parse(myRoomItem[k].ANCHOR);
                                myRoomItem[k].POSITION = JSON.parse(myRoomItem[k].POSITION);
                            } catch (e) { console.log("Not Json"); }
                        }
                        enemy["MYROOM_ITEM"] = myRoomItem;

                        enemy["RANK"] = eRes[0][0].RANK;
                        enemy["GROUP_RANK"] = eRes[1][0].RANK;

                        callback(enemy);
                    });
                });

            }
        } catch (e) { console.log(e); }
    });
}

//PVP 시작
function startPvP(socket, client) {
    console.time("ANS_PVP_203");
    try {
        var acc = socket.Session.GetAccount();
        var userItemList = socket.Session.GetItems();
        var userPvP = socket.Session.GetPvP();
        var result = 0;

        if (common.timeCheck('PVP')) {
            result = 2;
            socket.emit('ANS_PVP', { 'ATYPE': client.ATYPE, 'result': result });
            return;
        }

        if (userPvP[0].PLACEMENT == 0) {    // 배치고사인 경우
            result = 1;
            socket.emit('ANS_PVP', { 'ATYPE': client.ATYPE, 'result': result });
            return;
        }

        var ticket = common.findObjectByKey(userItemList, "ITEM_ID", DefineItem.TICKET_PVP);

        if (ticket.ITEM_COUNT < 1) {    // PVP 티켓 부족
            result = 1;
            socket.emit('ANS_PVP', { 'ATYPE': client.ATYPE, 'result': result });
            return;
        }
        
        // PVP 티켓 1개 차감
        var rewardList = [{ REWARD_ITEM_ID: DefineItem.TICKET_PVP, REWARD_ITEM_COUNT: -1 }];

        Item.addRewardItem(socket, rewardList, 0, function (cErr, cRes) {
            if (cErr) {
                PrintError(cErr);
                result = 1;
                socket.emit('ANS_PVP', { 'ATYPE': client.ATYPE, 'result': result, "REWARD": [], "STAT": [] });
                return;
            }

            Character.CalculateTeamCombat(null, 5, socket, (error, combat, statList) => {
                // PVP 도전 횟수 미션
                Mission.addMission(acc.USER_UID, 8000028, 1);
                console.timeEnd("ANS_PVP_203");
                socket.emit('ANS_PVP', { 'ATYPE': client.ATYPE, 'result': result, "REWARD": cRes, "STAT": statList });
            });
        });
    } catch (e) { console.log(e); }
}

//PVP 결과
function endPvP(socket, client) {
    console.time("ANS_PVP_204");
    try {
        var result = 0;

        if (client.MY_COMBAT == undefined || client.ENEMY_COMBAT == undefined || client.VICTORY == undefined) {
            result = 2;
            socket.emit('ANS_PVP', { 'ATYPE': client.ATYPE, 'result': result });
            return;
        }
        var acc = socket.Session.GetAccount();
        var userPvP = socket.Session.GetPvP();
        var myCombat = client.MY_COMBAT;
        var enemyCombat = client.ENEMY_COMBAT;

        if (userPvP[0].PLACEMENT == 0) {    // 배치고사인 경우
            result = 1;
            socket.emit('ANS_PVP', { 'ATYPE': client.ATYPE, 'result': result });
            return;
        }

        var period = [0];
        var pickIndex = 0;

        // 상대 전투력을 enemy_fight_power1(어려움), enemy_fight_power2(매우 어려움) 배율 계산하여 어려움, 매우 어려움 판정
        period.push(parseInt(myCombat * CSVManager.BPvPCommon.GetData("enemy_fight_power1")));
        period.push(parseInt(myCombat * CSVManager.BPvPCommon.GetData("enemy_fight_power2")));

        for (var k = 0; k < period.length; k++) {
            if (period[period.length - 1] <= enemyCombat) {
                pickIndex = 2;
                break;
            }
            if (period[k] <= enemyCombat && enemyCombat < period[k + 1]) {
                pickIndex = k;
                break;
            }
        }
        var score = 0;

        if (client.VICTORY == 0) {
            score = CSVManager.BPvPCommon.GetData("defeat_point");
        } else {
            score = CSVManager.BPvPCommon.GetData("win_point");
            // PVP 승리 횟수 미션
            Mission.addMission(acc.USER_UID, 8000029, 1);
        }

        // 대전 난이도에 따라 획득 점수 보정
        switch (pickIndex) {
            case 1: // 어려움
            case 2: // 매우 어려움
                if (client.VICTORY == 0)
                    score *= CSVManager.BPvPCommon.GetData("defeat_rate" + pickIndex);
                else
                    score += CSVManager.BPvPCommon.GetData("win_point" + pickIndex);
                break;
        }

        var win = 0;
        var defeat = 0;
        var consecutive = 0;
        var point = 0;

        if (client.VICTORY == 0) {
            win = userPvP[0].WIN;
            defeat = userPvP[0].DEFEAT + 1;
            consecutive = 0;
        } else {
            win = userPvP[0].WIN + 1;
            defeat = userPvP[0].DEFEAT;
            consecutive = userPvP[0].CONSECUTIVE + 1;   // 연승
        }

        point = userPvP[0].POINT + score;

        if (point < 0)
            point = 0;

        // PVP 데이터 갱신
        DB.query("CALL INSERT_PVP(?,?,?,?,?,?,?,?,?,?,?,?,?)",
            [0, acc.USER_UID, userPvP[0].GRADE, userPvP[0].GROUP, point, userPvP[0].POWER, win,
                defeat, consecutive, null, 0, null, null], function (error, results) {

                    // PVP 진행 시 상대 마이룸에 먼지 생성
                    if (userPvP[0].ENEMY_UID != null && userPvP[0].ENEMY_UID != 0 && userPvP[0].ENEMY_UID.toString().substr(0, 2) != 99)
                        MyRoom.addStain(acc.USER_NAME, userPvP[0].ENEMY_UID, acc.USER_UID, client.VICTORY);

                    if (error) {
                        PrintError(error);
                        result = 1;
                    } else {
                        userPvP[0].POINT = point;
                        userPvP[0].WIN = win;
                        userPvP[0].DEFEAT = defeat;
                        userPvP[0].CONSECUTIVE = consecutive;
                        userPvP[0].ENEMY_UID = null;
                        userPvP[0].REDISCOVER = 0;
                    }

                    // 현재 순위 조회
                    DB.query("CALL SELECT_PVP_RANK(?,?)", [2, acc.USER_UID], function (aErr, aRes) {
                        if (aErr) {
                            PrintError(aErr);
                            result = 1;
                        }
                        let group_rank = 0;
                        if (aRes[0].length > 0)
                            group_rank = aRes[0][0].RANK;

                        // PVP 도전 횟수 저장
                        DB.query("UPDATE PVP SET CHALLENGE_COUNT = CHALLENGE_COUNT + 1 WHERE USER_UID = ?", [acc.USER_UID], (error, result) => {
                            if (error) {
                                PrintError(error);
                                result = 1;
                            }
                            console.timeEnd("ANS_PVP_204");
                            socket.emit('ANS_PVP', { 'ATYPE': client.ATYPE, 'result': result, "PVP": userPvP, "GROUP_RANK": group_rank, "SCORE": score });
                        });
                    });
                });
    } catch (e) { console.log(e); }
}

// 순위 조정
exports.rearrangeGrade = function () {
    console.time("ANS_PVP_300");
    //배치고사가 아닌((PLACEMENT = 1)) 유저들의 등급, 그룹별 데이터 조회
    selectDB.query("SELECT GRADE, `GROUP` FROM PVP WHERE PLACEMENT = 1 GROUP BY GRADE, `GROUP`", function (error, results) {
        if (error) {
            PrintError(error);
            logging.error("rearrangeGrade");
        } else {
            var pvpList = [];           // DB Table pvp_log에 저장 되는 데이터 등급 조정 내역
            var pvpRewardList = [];     // 등급 조정에 따른 보상 내역
            var rateRewardCSVData = CSVManager.BRateReward.data;
            var initPoint = CSVManager.BPvPCommon.GetData("grade_initial_value");
            var increasePoint = CSVManager.BPvPCommon.GetData("grade_increase_value");

            // PVP 등급 기본 데이터에 등급별 포인트 셋팅
            for (var i = 0; i < rateRewardCSVData.length; i++) {
                if (rateRewardCSVData[i].id == 7000001) rateRewardCSVData[i].initPoint = initPoint;
                else rateRewardCSVData[i].initPoint = initPoint + (increasePoint * i);
            }
            //console.log("rearrangeGrade Start===================!");

            async.eachSeries(results, function (obj, ecb) {
                //해당 등급 해당 그룹 조회
                console.log("******************************************************************");
                console.log("GRADE / GROUP : " + obj.GRADE + " / " + obj.GROUP);
                console.log("******************************************************************");
                selectDB.query("CALL SELECT_PVP(?,?,?,?,?,?,?)", [3, null, obj.GRADE, obj.GROUP, null, null, null], function (aErr, aRes) {
                    if (aErr) {
                        ecb(aErr);
                    } else {
                        //포인트로 정렬
                        var targetRank = setRank(aRes[0], "POINT");
                        // 등급 조정 데이터 (등급별 범위 책정하여 승급, 잔류, 강등 판단)
                        var advanceCSVData = CSVManager.BAdvancement.GetDataByRateType(obj.GRADE);

                        for (let i = 0; i < targetRank.length; i++) {
                            let advanceObj = null;

                            for (let j = 0; j < advanceCSVData.length; j++) {
                                if (j > 0) {
                                    if (advanceCSVData[j - 1].limit < targetRank[i].RANK && targetRank[i].RANK <= advanceCSVData[j].limit) {
                                        advanceObj = advanceCSVData[j];
                                        flag = true;
                                        break;
                                    }
                                } else {
                                    if (targetRank[i].RANK <= advanceCSVData[j].limit) {
                                        advanceObj = advanceCSVData[j];
                                        flag = true;
                                        break;
                                    }
                                }
                            }

                            let target = {};
                            if (advanceObj != null) {
                                target.USER_UID = targetRank[i].USER_UID;                   // 유저 UID
                                target.BFGRADE = targetRank[i].GRADE;                       // 이전 등급
                                target.BFGROUP = targetRank[i].GROUP;                       // 이전 그룹
                                target.BFPOINT = targetRank[i].POINT;                       // 이전 PVP 점수
                                target.WIN = targetRank[i].WIN;                             // 이전 승
                                target.DEFEAT = targetRank[i].DEFEAT;                       // 이전 패
                                target.CONSECUTIVE = targetRank[i].CONSECUTIVE;             // 이전 연승
                                target.CHALLENGE_COUNT = targetRank[i].CHALLENGE_COUNT;     // 이전 재도전 횟수(사용 안함)
                                target.POWER = targetRank[i].POWER;                         // 이전 전투력
                                target.RANK = targetRank[i].RANK;                           // 이전 순위
                                target.GRADE = advanceObj.advance;                          // 등급 조정 후 등급
                                target.POINT = common.findObjectByKey(rateRewardCSVData, "id", target.GRADE).initPoint; // 등급 조정 후 초기 PVP 점수
                                target.EXP = targetRank[i].USER_EXP;    // 유저 경험치(7000008 챔피언 등급 계산을 위해 필요)

                                console.log(JSON.stringify(target));

                                let rewardList = null;

                                rewardList = [{ "USER_UID": target.USER_UID, "REWARD_ITEM_ID": DefineItem.GOLD, "REWARD_ITEM_COUNT": 0 },
                                { "USER_UID": target.USER_UID, "REWARD_ITEM_ID": DefineItem.PEARL, "REWARD_ITEM_COUNT": 0 }];
                                let rewardCSVData = common.findObjectByKey(rateRewardCSVData, "id", target.GRADE);
                                rewardList[0].REWARD_ITEM_COUNT += rewardCSVData.reward_gold;
                                rewardList[1].REWARD_ITEM_COUNT += rewardCSVData.reward_cash;

                                if (rewardList != null)
                                    for (let k = 0; k < rewardList.length; k++) pvpRewardList.push(rewardList[k]);

                                pvpList.push(target);
                            }
                        }

                        ecb(null);
                    }
                });
            }, function (err) {
                if (err) {
                    PrintError(err);
                    logging.error("rearrangeGrade");
                }

                // 마스터 등급에서 챔피언 등급 선정
                let masterID = rateRewardCSVData[rateRewardCSVData.length - 2].id;
                let championID = rateRewardCSVData[rateRewardCSVData.length - 1].id;

                let tempList = [];
                for (let i = 0; i < pvpList.length; i++) {
                    if (pvpList[i].BFGRADE == masterID) tempList.push(pvpList[i]);
                }

                try {
                    masterList = JSON.parse(JSON.stringify(tempList));
                } catch (e) {
                    console.log(e);
                }
                if (masterList.length > 0) {
                    let Champion = null;
                    //마스터 등급 이전 포인트로 내림차순 정렬
                    masterList.sort(function (a, b) { return a.BFPOINT > b.BFPOINT ? -1 : a.BFPOINT < b.BFPOINT ? 1 : 0; });
                    masterList = setRank(masterList, "BFPOINT");

                    let tempChampion = [];
                    for (let i = 0; i < masterList.length; i++) {
                        if (masterList[i].RANK == 1) tempChampion.push(masterList[i]);
                    }
                    // 마스터 등급에서 1위가 중복인 경우 경험치로 Rank 계산
                    tempChampion.sort(function (a, b) { return a.EXP > b.EXP ? -1 : a.EXP < b.EXP ? 1 : 0; });
                    if (tempChampion.length > 0) tempChampion = setRank(tempChampion, "EXP");
                    Champion = tempChampion[0];

                    let reward = common.findObjectByKey(rateRewardCSVData, "id", championID);
                    for (let j = 0; j < pvpList.length; j++) {
                        // 챔피언은 master등급은 유지하고 보상과 기본 포인트만 다르게 지급, PVP 매칭 시 master 등급에서 검색 하기 위해 따로 등급 부여 안함.
                        if (pvpList[j].USER_UID == Champion.USER_UID) {
                            pvpList[j].RANK = 0;
                            pvpList[j].POINT = reward.initPoint;
                            pvpList[j].CHAMPION = true;
                        }
                    }
                    console.log("CHAMPION : " + JSON.stringify(Champion));
                    for (let i = 0; i < pvpRewardList.length; i++) {
                        if (pvpRewardList[i].USER_UID == Champion.USER_UID) {
                            switch (pvpRewardList[i].REWARD_ITEM_ID) {
                                case DefineItem.GOLD: pvpRewardList[i].REWARD_ITEM_COUNT = reward.reward_gold; break;
                                case DefineItem.PEARL: pvpRewardList[i].REWARD_ITEM_COUNT = reward.reward_cash; break;
                            }
                            console.log("CHAMPION REWARD : " + JSON.stringify(pvpRewardList[i]));
                        }
                    }
                }

                savePvPGrade(pvpList);
                savePvPReward(pvpRewardList);
                console.timeEnd("ANS_PVP_300");
            });
        }
    });
}

// 등급 조정 후 데이터 저장
function savePvPGrade(pvpList) {
    pvpList.shuffle();

    DB.query("DELETE FROM PVP WHERE PLACEMENT = 1", (aErr, aRes) => {
        if (aErr) {
            logging.error("savePvPGrade1");
            PrintError(aErr);
        }
        //LOGDB IN GAMEDB
        DB.query("UPDATE PVP_LOG SET CONFIRM = 1 WHERE CONFIRM = 0", (error, result) => {
            if (error) {
                logging.error("savePvPGrade1 : UPDATE IDHLOG.PVP");
                PrintError(error);
            }
            async.eachSeries(pvpList, (obj, ecb) => {
                var rechallenge_count = 0;
                if (obj.CHAMPION != undefined && obj.CHAMPION == true) rechallenge_count = 10;

                async.series({
                    insertPvP: (callback) => {
                        DB.query("CALL INSERT_PVP(?,?,?,?,?,?,?,?,?,?,?,?,?)",
                            [1, obj.USER_UID, obj.GRADE, CSVManager.BPvPCommon.GetData("group_count"), obj.POINT, obj.POWER, 0, 0, 0, null, 0, null, rechallenge_count], callback);
                    },
                    insertPvPLog: (callback) => {
                        DB.query("CALL INSERT_PVP_LOG(?,?,?,?,?,?,?,?,?,?,?)",
                            [obj.USER_UID, obj.GRADE, obj.BFGRADE, obj.RANK, obj.BFGROUP, obj.BFPOINT, obj.POWER, obj.WIN, obj.DEFEAT, obj.CONSECUTIVE, obj.CHALLENGE_COUNT], callback);
                    }
                }, function (bErr, bRes) {
                    if (bErr) ecb(bErr);
                    else ecb(null);
                });
            }, function (err) {
                if (err) {
                    logging.error("savePvPGrade2");
                    PrintError(err);
                }
            });
        });
    });
}

// 등급 조정 후 보상 데이터 저장
function savePvPReward(pvpRewardList) {
    async.series([
        (scb) => {
            // 이전 PVP 보상 내역이 존재 하는 경우 메일로 지급
            selectDB.query("SELECT * FROM PVP_REWARD", (error, results) => {
                if (error) scb(error);
                else {
                    if (results.length > 0) {
                        async.eachSeries(results, (obj, cb) => {
                            DB.query("CALL SELECT_PVP_REWARD(?)", [obj.USER_UID], (error, results) => {
                                if (error) cb(error);
                                else {
                                    let rewardList = results[0];
                                    if (rewardList.length > 0) {
                                        Item.SetItemType(rewardList);
                                        async.eachSeries(rewardList, (rObj, cb) => {
                                            Mail.PushMail(rObj.USER_UID, 6, rObj.ITEM_TYPE, rObj.REWARD_ITEM_ID, rObj.REWARD_ITEM_COUNT, 0,
                                                "PVP 승급 보상", CSVManager.BMailString.GetData(6).limit, (mErr, mRes) => { cb(mErr); });
                                        }, (err) => { cb(err); });
                                    } else cb(null);
                                }
                            });
                        }, (error) => {
                            scb(error);
                        });
                    } else scb(null);
                }
            });
        }, (scb) => {
            async.eachSeries(pvpRewardList, (obj, ecb) => {
                DB.query("CALL INSERT_PVP_REWARD(?,?,?)", [obj.USER_UID, obj.REWARD_ITEM_ID, obj.REWARD_ITEM_COUNT], (aErr, aRes) => {
                    if (aErr) ecb(aErr);
                    else ecb(null);
                });
            }, (err) => { scb(err); });
        }
    ], (error) => {
        if (error) {
            PrintError(error);
        } else {

        }
    });
}

// 시즌 종료 팝업 > 확인 버튼
function getPvPReward(socket, client) {
    console.time("ANS_PVP_101");
    // 보상 우편함 이동
    var acc = socket.Session.GetAccount();
    var result = 0;
    // 시즌 종료 데이터 있는지 확인.
    DB.query("CALL SELECT_PVP_REWARD(?)", [acc.USER_UID], function (error, results) {
        if (error) {
            PrintError(error);
            result = 1;
        } else {
            // 보상 수령 갱신
            DB.query("UPDATE PVP_LOG SET CONFIRM = 1 WHERE USER_UID = ? AND CONFIRM = 0", [acc.USER_UID], (error, uRes) => {
                if(error) console.log(error);
                var rewardList = results[0];
                if (rewardList.length > 0) {
                    Item.SetItemType(rewardList);
                    // 메일 알림
                    Notification.Notify("MAIL", acc.USER_UID);
                    // 메일 지급
                    async.eachSeries(rewardList, function (obj, cb) {
                        Mail.PushMail(acc.USER_UID, 6, obj.ITEM_TYPE, obj.REWARD_ITEM_ID, obj.REWARD_ITEM_COUNT, 0,
                            "PVP 승급 보상", CSVManager.BMailString.GetData(6).limit, function (mErr, mRes) {
                                cb(mErr);
                            });
                    }, function (err) {
                        if (err) {
                            PrintError(err);
                            result = 1;
                        }
                        console.timeEnd("ANS_PVP_101");
                        socket.emit('ANS_PVP', { 'ATYPE': client.ATYPE, 'result': result });

                    });
                } else {
                    console.timeEnd("ANS_PVP_101");
                    socket.emit('ANS_PVP', { 'ATYPE': client.ATYPE, 'result': result });
                }
            });
        }
    });
}

// PVP 팀 정보 조회
function getPvPTeam(socket, client) {
    console.time("ANS_PVP_103");
    var result = 0;
    if (client.USER_UID == undefined) {
        result = 1;
        socket.emit('ANS_PVP', { 'ATYPE': client.ATYPE, 'result': result });
        return;
    }

    selectDB.query("CALL SELECT_TEAM(?,?,?)",
        [2, client.USER_UID, 5], function (error, results) {
            if (error) {
                PrintError(error);
                result = 1;
            }
            console.timeEnd("ANS_PVP_103");
            socket.emit('ANS_PVP', { 'ATYPE': client.ATYPE, 'result': result, "LIST": results[0] });
        });
}