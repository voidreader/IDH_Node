/*
 * 마이룸 Controller
 */

// 먼지 생성(마이룸 복수하기에서 사용)
exports.addStain = function (userName, userUID, attackUID, victory) {

    DB.query('CALL INSERT_STAIN_SINGLE(?,?,?,?)'
        , [0, userUID, attackUID, victory], function (err, res) {
            if (err) {
                PrintError(err);
            }
        });
}

module.exports.OnPacket = function (socket) {
    socket.on("REQ_MYROOM", function (client) {
        try {
            if (client.ATYPE !== undefined) {
                var packetType = aTypeParser(client.ATYPE);

                if (packetType.cType == "0") {
                    switch (packetType.aType) {
                        case "00": createMyRoom(socket, client); break;
                        //case "01": break;
                        default: break;
                    }
                } else if (packetType.cType == "1") {
                    switch (packetType.aType) {
                        case "00": getMyRoom(socket, client, false); break;
                        case "01": getFriendsList(socket, client); break;
                        case "02": getMyRoom(socket, client, true); break;
                        case "03": getMyRoomHistory(socket, client, true); break;
                        case "04": revenge(socket, client, true); break;
                        case "05": getMyRoomBuff(socket, client); break;
                        default: break;
                    }
                } else if (packetType.cType == "2") {
                    switch (packetType.aType) {
                        case "00": arrangeItem(socket, client); break;
                        case "01": startCleanup(socket, client); break;
                        case "02": endRevenge(socket, client); break;
                        default: break;
                    }
                } else if (packetType.cType == "3") {
                    switch (packetType.aType) {
                        case "00": cancelArrangeItem(socket, client); break;
                        case "01": completeCleanup(socket, client); break;
                        case "02": completeAllCleanup(socket, client); break;
                        default: break;
                    }
                } else {

                }
            }
        } catch (e) { PrintError(e); }
    });
}

// 신규 마이룸 오픈
function createMyRoom(socket, client) {
    console.time("ANS_MYROOM_000");

    let acc = socket.Session.GetAccount();
    let userItemList = socket.Session.GetItems();
    let result = 0;

    let myRoomCSVData = CSVManager.BMyRoom.GetData(client.MYROOM_ID);

    let rewardId = 0;
    switch (myRoomCSVData.open_type) {
        case "1": rewardId = DefineItem.PEARL; break;
        case "2": rewardId = DefineItem.GOLD; break;
    }

    let itemObj = common.findObjectByKey(userItemList, "ITEM_ID", rewardId);

    if (itemObj == null || itemObj.ITEM_COUNT < myRoomCSVData.open_value) {
        result = 3;
        socket.emit('ANS_MYROOM', { 'ATYPE': client.ATYPE, 'result': result });
        return;
    }

    MyRoom.InitMyRoomInfo(acc.USER_UID, (error, res) => {
        if (error == 1) {
            result = 1;
            socket.emit('ANS_MYROOM', { 'ATYPE': client.ATYPE, 'result': result });
        } else {
            if (error) {
                PrintError(error);
                result = 1;
                socket.emit('ANS_MYROOM', { 'ATYPE': client.ATYPE, 'result': result });
            } else {
                let checkFlag = false;
                for (let i = 0; i < res.length; i++) {
                    if (res[i].MYROOM_ID == client.MYROOM_ID) {
                        checkFlag = true;
                        break;
                    }
                }
                if (checkFlag) {
                    //이미 존재하는 마이룸
                    result = 2;
                    socket.emit('ANS_MYROOM', { 'ATYPE': client.ATYPE, 'result': result });
                } else {
                    DB.query('INSERT INTO MYROOM (USER_UID, MYROOM_ID) VALUES (?, ?)'
                        , [acc.USER_UID, client.MYROOM_ID], function (err, res) {
                            let myRoom = [];
                            if (err) {
                                PrintError(err);
                                result = 1;
                                socket.emit('ANS_MYROOM', { 'ATYPE': client.ATYPE, 'result': result, "REWARD": [], "MYROOM": [] });
                            } else {
                                MyRoom.InitMyRoomInfo(acc.USER_UID, (error, res) => {
                                    if (error) {
                                        PrintError(error);
                                        result = 1;
                                        socket.emit('ANS_MYROOM', { 'ATYPE': client.ATYPE, 'result': result, "REWARD": [], "MYROOM": [] });
                                    } else {
                                        let rewardList = [];
                                        rewardList.push({ REWARD_ITEM_ID: rewardId, REWARD_ITEM_COUNT: -myRoomCSVData.open_value, TYPE: 14 });
                                        Item.addRewardItem(socket, rewardList, 0, function (aErr, aRes) {
                                            if (aErr) {
                                                PrintError(aErr);
                                                jsonData.result = 1;
                                            }

                                            socket.Session.SetMyRoom(res);
                                            console.timeEnd("ANS_MYROOM_000");
                                            socket.emit('ANS_MYROOM', { 'ATYPE': client.ATYPE, 'result': result, "REWARD": aRes, "MYROOM": res });
                                        });
                                    }
                                });
                            }
                        });
                }
            }
        }
    });
}

// 마이룸 아이템, 캐릭터 배치
function arrangeItem(socket, client) {
    console.time("ANS_MYROOM_200");
    try {
        // 해당 룸 배치 가능한지 몇 개 남았는지 리턴
        var acc = socket.Session.GetAccount();
        var myRoom = socket.Session.GetMyRoom();
        var userItemList = socket.Session.GetItems();
        var myRoomID = client.MYROOM_ID;
        var myRoomItemUID = client.MYROOM_ITEM_UID;
        var itemUID = client.ITEM_UID;
        var anchor = JSON.stringify(client.ANCHOR) || null;
        var angle = client.ANGLE;
        var position = JSON.stringify(client.POSITION) || null;
        var result = 0;

        if (client.MYROOM_ID == undefined || client.MYROOM_ITEM_UID == undefined || client.ITEM_UID == undefined
            || client.ANCHOR == undefined || client.ANGLE == undefined || client.POSITION == undefined) {
            result = 1;
            socket.emit('ANS_MYROOM', { 'ATYPE': client.ATYPE, 'result': result });
            return;
        }

        var flag = false;

        for (var i = 0; i < userItemList.length; i++) {
            if (itemUID == userItemList[i].ITEM_UID) {
                if (userItemList[i].ITEM_COUNT - userItemList[i].MYROOM_ITEM_COUNT > 0)
                    flag = true;
            }
        }

        if (myRoomItemUID == 0 && !flag) {
            result = 3;
            socket.emit('ANS_MYROOM', { 'ATYPE': client.ATYPE, 'result': result, 'MYROOM_ITEM_UID': null });
            return;
        }

        selectDB.query('SELECT COUNT(MYROOM_ITEM_UID) COUNT FROM MYROOM_ITEM WHERE USER_UID = ? AND MYROOM_ID = ?'
            , [acc.USER_UID, myRoomID], function (err, res) {
                if (err) {
                    PrintError(err);
                    result = 1;
                } else {
                    if (myRoomItemUID == 0 && res[0].COUNT >= CSVManager.BMyRoomCommon.GetData("item_limit")) {
                        result = 2;
                        socket.emit('ANS_MYROOM', { 'ATYPE': client.ATYPE, 'result': result });
                        return;
                    } else {
                        DB.query('CALL INSERT_MYROOM_ITEM(?,?,?,?,?,?,?)'
                            , [acc.USER_UID, myRoomID, itemUID, myRoomItemUID, anchor, angle, position], function (cErr, cRes) {
                                if (cErr) {
                                    PrintError(cErr);
                                    result = 1;
                                }

                                try {
                                    if (cRes[0][0].ANCHOR != null) cRes[0][0].ANCHOR = JSON.parse(cRes[0][0].ANCHOR);
                                    if (cRes[0][0].POSITION != null) cRes[0][0].POSITION = JSON.parse(cRes[0][0].POSITION);
                                } catch (e) { }

                                var itemObj = null;
                                for (var i = 0; i < userItemList.length; i++) {
                                    if (userItemList[i].ITEM_UID == cRes[0][0].ITEM_UID) {
                                        if (myRoomItemUID == 0)
                                            userItemList[i].MYROOM_ITEM_COUNT++;
                                        itemObj = userItemList[i];
                                    }
                                }

                                for (var i = 0; i < myRoom.length; i++) {
                                    if (myRoom[i].MYROOM_ID == myRoomID) {
                                        if (myRoomItemUID == 0) {
                                            myRoom[i].ITEM_LIST.push(cRes[0][0]);
                                            break;
                                        } else {
                                            for (var j = 0; j < myRoom[i].ITEM_LIST.length; j++) {
                                                if (myRoom[i].ITEM_LIST[j].MYROOM_ITEM_UID == myRoomItemUID) {
                                                    myRoom[i].ITEM_LIST[j].ANCHOR = anchor;
                                                    myRoom[i].ITEM_LIST[j].ANGLE = angle;
                                                    myRoom[i].ITEM_LIST[j].POSITION = position;
                                                    break;
                                                }
                                            }
                                        }
                                    }
                                }
                                console.timeEnd("ANS_MYROOM_200");
                                socket.emit('ANS_MYROOM', {
                                    'ATYPE': client.ATYPE, 'result': result,
                                    'MYROOM_ITEM_UID': cRes[0][0].MYROOM_ITEM_UID, "ITEM_LIST": cRes[0][0], "ITEM": itemObj
                                });
                            });
                    }
                }
            });
    } catch (e) { PrintError(e); }
}

// 배치 해제
function cancelArrangeItem(socket, client) {
    console.time("ANS_MYROOM_300");
    try {
        // 해당 룸 배치 가능한지 몇 개 남았는지 리턴
        var acc = socket.Session.GetAccount();
        var myRoom = socket.Session.GetMyRoom();

        var myRoomID = client.MYROOM_ID;
        var myRoomItemUID = client.MYROOM_ITEM_UID;

        if (client.MYROOM_ID == undefined || client.MYROOM_ITEM_UID == undefined) {
            result = 1;
            socket.emit('ANS_MYROOM', { 'ATYPE': client.ATYPE, 'result': result });
            return;
        }

        DB.query('DELETE FROM MYROOM_ITEM WHERE USER_UID = ? AND MYROOM_ID = ? AND MYROOM_ITEM_UID = ?'
            , [acc.USER_UID, myRoomID, myRoomItemUID], function (err, res) {
                var result = 0;
                if (err) {
                    PrintError(err);
                    result = 1;
                } else {
                    var itemUID = 0;
                    for (var i = 0; i < myRoom.length; i++) {
                        if (myRoom[i].MYROOM_ID == myRoomID) {
                            for (var j = 0; j < myRoom[i].ITEM_LIST.length; j++) {
                                if (myRoom[i].ITEM_LIST[j].MYROOM_ITEM_UID == myRoomItemUID) {
                                    itemUID = myRoom[i].ITEM_LIST[j].ITEM_UID;
                                    myRoom[i].ITEM_LIST.splice(j, 1);
                                    break;
                                }
                            }
                        }
                    }
                    var userItemList = socket.Session.GetItems();
                    var itemObj = null;
                    for (var i = 0; i < userItemList.length; i++) {
                        if (userItemList[i].ITEM_UID == itemUID) {
                            userItemList[i].MYROOM_ITEM_COUNT--;
                            itemObj = userItemList[i];
                        }
                    }
                    console.timeEnd("ANS_MYROOM_300");
                    socket.emit('ANS_MYROOM', { 'ATYPE': client.ATYPE, 'result': result, "MYROOM_ITEM_UID": client.MYROOM_ITEM_UID, "ITEM": itemObj });
                }
            });
    } catch (e) { PrintError(e); }
}

// 먼지 청소 시작
function startCleanup(socket, client) {
    console.time("ANS_MYROOM_201");
	/*
		행동력 체크 / 랜덤 박스로 아이템, 개수, 시간 확정해서 먼지에 업데이트 / 
	*/
    var acc = socket.Session.GetAccount();
    var bMyRoomRandomBox = CSVManager.BMyRoomRandomBox.data;
    var helpUserUid = client.HELP_USER_UID;
    var result = 0;
    var userItemList = socket.Session.GetItems();

    if (client.MYROOM_ID == undefined || client.HELP_USER_UID == undefined || client.STAIN_UID == undefined) {
        result = 1;
        socket.emit('ANS_MYROOM', { 'ATYPE': client.ATYPE, 'result': result });
        return;
    }

    let time = 0;
    let rewardObj = pickRandomReward(bMyRoomRandomBox[0]);

    if (helpUserUid == 0) {
        let actItem = common.findObjectByKey(userItemList, "ITEM_ID", DefineItem.MILEAGE);
        if (actItem == null || actItem.ITEM_COUNT < 1) {
            result = 2;
            socket.emit('ANS_MYROOM', { 'ATYPE': client.ATYPE, 'result': result });
            return;
        }
        time = CSVManager.BMyRoomCommon.GetData("cleanup_time_" + rewardObj.pickName);
    }

    DB.query('CALL UPDATE_STAIN(?,?,?,?,?,?,?)',
        [acc.USER_UID, client.MYROOM_ID, client.STAIN_UID, helpUserUid, rewardObj.ITEM_ID, rewardObj.ITEM_COUNT, time], function (error, res) {
            if (error) {
                PrintError(error);
                result = 1;
            }
            var reward = null;

            if (res[0].length > 0 && res[0][0].DUPLICATION && res[0][0].DUPLICATION == 1) {
                result = 3;
                socket.emit('ANS_MYROOM', { 'ATYPE': client.ATYPE, 'result': result, 'REWARD': reward });
            } else {
                reward = res[0][0];
                if (helpUserUid != 0) {
                    let rewardItem = pickRandomReward(bMyRoomRandomBox[1]);
                    let helpRewardObj = { REWARD_ITEM_ID: rewardItem.ITEM_ID, REWARD_ITEM_COUNT: rewardItem.ITEM_COUNT, TYPE: 15 };
                    Item.addRewardItem(socket, [helpRewardObj], 0, function (cErr, cRes) {
                        if (cErr) {
                            result = 1;
                        } else {
                            result = 4;
                            let itemObj = null;

                            if (cRes !== null) itemObj = cRes.ITEM_LIST;

                            Mission.addMission(acc.USER_UID, 8000014, 1);
                            console.timeEnd("ANS_MYROOM_201");
                            socket.emit('ANS_MYROOM', { 'ATYPE': client.ATYPE, 'result': result, 'REWARD': reward, "ITEM_LIST": itemObj, "REWARD_ITEM_LIST": [helpRewardObj] });
                        }
                    });
                } else {
                    //나의 방 청소하는 경우 행동력 마일리지 감소
                    var cleanup_consume_act = CSVManager.BMyRoomCommon.GetData("cleanup_consume_act");
                    var rewardList = [];
                    rewardList.push({ REWARD_ITEM_ID: DefineItem.MILEAGE, REWARD_ITEM_COUNT: -cleanup_consume_act });

                    Item.addRewardItem(socket, rewardList, 0, function (cErr, cRes) {
                        if (cErr) {
                            result = 1;
                        } else {
                            var itemObj = null;

                            if (cRes !== null) itemObj = cRes.ITEM_LIST;
                            console.timeEnd("ANS_MYROOM_201");
                            socket.emit('ANS_MYROOM', { 'ATYPE': client.ATYPE, 'result': result, 'REWARD': reward, "ITEM_LIST": itemObj });
                        }
                    });
                }
            }
        });
}

// 먼지 청소 보상 결정
function pickRandomReward(randomBox) {
    var probList = [];
    var probabilitySum = 0;
    var period = [0];
    var pickItemIndex = null;


    for (key in randomBox)
        if (key.indexOf("probability") > -1) {
            probList.push(key.replace("_probability", ""));
            probabilitySum += randomBox[key];
            period.push(probabilitySum);
        }

    var random = Math.floor(Math.random() * probabilitySum);

    for (var i = 0; i < period.length; i++) {
        if (period[i] <= random && random < period[i + 1]) {
            pickItemIndex = i;
            break;
        }
    }
    var rewardObj = {};
    var pickName = probList[pickItemIndex];

    var min = 0;
    var max = 0;

    for (key in randomBox) {
        if (key.indexOf(pickName) > -1) {
            if (key == pickName)
                rewardObj["ITEM_ID"] = randomBox[key];

            if (key == pickName + "_min")
                min = randomBox[key];
            else if (key == pickName + "_max")
                max = randomBox[key];
        }
    }

    rewardObj["ITEM_COUNT"] = Utils.Random(min, max);
    rewardObj["pickName"] = pickName;

    return rewardObj;
}

// 청소 완료된 먼지 보상 수령
function completeCleanup(socket, client) {
    console.time("ANS_MYROOM_301");
    // 아이템 획득 및 더러움 삭제
    var acc = socket.Session.GetAccount();
    var myRoom = socket.Session.GetMyRoom();
    var result = 0;
    var stainObj = null;

    if (client.MYROOM_ID == undefined || client.STAIN_UID == undefined) {
        result = 1;
        socket.emit('ANS_MYROOM', { 'ATYPE': client.ATYPE, 'result': result });
        return;
    }
    DB.query('CALL CLEAN_UP_STAIN(?,?,?,?)',
        [0, acc.USER_UID, client.MYROOM_ID, client.STAIN_UID], function (aErr, aRes) {

            if (aErr) {
                PrintError(aErr);
                result = 1;
            } 
            if (aRes[0].length > 0) {
                // call delete stain
                stainObj = aRes[0][0];
                //myRoomList에서 삭제
                for (var i = 0; i < myRoom.length; i++) {
                    if (myRoom[i].MYROOM_ID == client.MYROOM_ID) {
                        for (var j = 0; j < myRoom[i].STAIN_LIST.length; j++) {
                            if (myRoom[i].STAIN_LIST[j].STAIN_UID == client.STAIN_UID) {
                                myRoom[i].STAIN_LIST.splice(j, 1);
                                break;
                            }
                        }
                    }
                }
                Item.addRewardItem(socket, [stainObj], 0, function (cErr, cRes) {
                    console.timeEnd("ANS_MYROOM_301");
                    if (cErr) {
                        PrintError(cErr);
                        result = 1;
                        socket.emit('ANS_MYROOM', { 'ATYPE': client.ATYPE, 'result': result, 'MYROOM_ID': null, 'STAIN_UID': null, 'REWARD': null });
                    } else {
                        socket.emit('ANS_MYROOM', { 'ATYPE': client.ATYPE, 'result': result, 'MYROOM_ID': client.MYROOM_ID, 'STAIN_UID': client.STAIN_UID, 'REWARD': cRes });
                    }
                });
            } else {
                //존재하지 않는 아이템 오류 2
                result = 2;
                socket.emit('ANS_MYROOM', { 'ATYPE': client.ATYPE, 'result': result });
            }
        });
}

// 청소 완료된 먼지 모두 받기(보상 수령)
function completeAllCleanup(socket, client) {

    console.time("ANS_MYROOM_302");
    // 아이템 획득 및 더러움 삭제
    var acc = socket.Session.GetAccount();
    var myRoom = socket.Session.GetMyRoom();
    var result = 0;

    if (client.MYROOM_ID == undefined) {
        result = 1;
        socket.emit('ANS_MYROOM', { 'ATYPE': client.ATYPE, 'result': result });
        return;
    }

    DB.query('CALL CLEAN_UP_STAIN(?,?,?,?)',
        [1, acc.USER_UID, client.MYROOM_ID, 0], function (aErr, aRes) {
            if (aErr) {
                PrintError(aErr);
                result = 1;
            }
            var stainList = [];
            stainList = aRes[0];
            if (stainList.length > 0) {
                let rewardList = [];
                let flag = false;
                let stainUIDList = [];
                for(let i = 0; i < stainList.length; i++) {
                    stainUIDList.push(stainList[i].STAIN_UID);
                    for(let j = 0; j < rewardList.length; j++){
                        if(stainList[i].REWARD_ITEM_ID == rewardList[j].REWARD_ITEM_ID) {
                            flag = true;
                            break;
                        } 
                    }
                    if(flag) {
                        for(let j = 0; j < rewardList.length; j++){
                            if(stainList[i].REWARD_ITEM_ID == rewardList[j].REWARD_ITEM_ID)
                                rewardList[j].REWARD_ITEM_COUNT += stainList[i].REWARD_ITEM_COUNT;
                        }
                    } else {
                        rewardList.push({ REWARD_ITEM_ID: stainList[i].REWARD_ITEM_ID, REWARD_ITEM_COUNT: stainList[i].REWARD_ITEM_COUNT });
                    }
                }
                for (var i = 0; i < myRoom.length; i++) {
                    if (myRoom[i].MYROOM_ID == client.MYROOM_ID) {
                        for (var j = myRoom[i].STAIN_LIST.length - 1; j > -1; j--) {
                            if (stainUIDList.indexOf(myRoom[i].STAIN_LIST[j].STAIN_UID) > -1) {
                                myRoom[i].STAIN_LIST.splice(j, 1);
                                continue;
                            }
                        }
                    }
                }
                
                Item.addRewardItem(socket, stainList, 0, function (cErr, cRes) {
                    console.timeEnd("ANS_MYROOM_302");
                    if (cErr) {
                        PrintError(cErr);
                        result = 1;
                        socket.emit('ANS_MYROOM', { 'ATYPE': client.ATYPE, 'result': result, 'SUL': [], 'REWARD': [] });
                    } else {
                        socket.emit('ANS_MYROOM', { 'ATYPE': client.ATYPE, 'result': result, 'SUL': stainUIDList, 'REWARD': cRes });
                    }
                });
            } else {
                // 완료된 먼지가 없습니다.
                result = 2;
                socket.emit('ANS_MYROOM', { 'ATYPE': client.ATYPE, 'result': result, 'SUL': [], 'REWARD': [] });
            }
        });
}

// 마이룸 데이터 조회(마이룸, 먼지, 가구)
exports.InitMyRoomInfo = (userUID, callback) => {
    var uMyRoom = null;
    async.series([
        function (scb) {
            selectDB.query('CALL SELECT_MYROOM(?)', [userUID], function (error, res) {
                if (!error) {
                    uMyRoom = res[0];
                    if (res[0].length == 0)
                        scb(1);
                    else
                        scb(null);
                } else {
                    scb(error);
                }
            });
        },
        function (scb) {
            selectDB.query('CALL SELECT_MYROOM_ITEM(?)', [userUID], function (error, res) {
                if (!error) {
                    for (var i = 0; i < uMyRoom.length; i++) {
                        uMyRoom[i].ITEM_LIST = [];
                        for (var j = 0; j < res[0].length; j++) {
                            if (uMyRoom[i].MYROOM_ID == res[0][j].MYROOM_ID) {
                                try {
                                    res[0][j].ANCHOR = JSON.parse(res[0][j].ANCHOR);
                                    res[0][j].POSITION = JSON.parse(res[0][j].POSITION);
                                } catch (e) { console.log("Not Json"); }
                                //아이템 만족도 계산
                                uMyRoom[i].ITEM_LIST.push(res[0][j]);
                            }
                        }
                    }
                    scb(null);
                } else {
                    scb(error);
                }
            });
        },
        function (scb) {
            selectDB.query('CALL SELECT_STAIN(?)', [userUID], function (error, res) {
                if (!error) {
                    for (var i = 0; i < uMyRoom.length; i++) {
                        uMyRoom[i].STAIN_LIST = [];
                        for (var j = 0; j < res[0].length; j++) {
                            if (uMyRoom[i].MYROOM_ID == res[0][j].MYROOM_ID) {
                                uMyRoom[i].STAIN_LIST.push(res[0][j]);
                            }
                        }
                    }
                    scb(null);
                } else {
                    scb(error);
                }
            });
        }
    ], function (error, results) {
        callback(error, uMyRoom);
    });
}

// 마이룸 데이터 조회
function getMyRoom(socket, client, visitFlag) {
    console.time("ANS_MYROOM_100");
    var acc = socket.Session.GetAccount();
    var result = 0;
    var uMyRoom = [];
    var targetUID = 0;

    // 다른 유저 마이룸 정보 조회 또는 나의 마이룸 조회로 구분(visitFlag)
    if (visitFlag) {
        if (client.FRIEND_UID == undefined) {
            result = 1;
            socket.emit('ANS_MYROOM', { 'ATYPE': client.ATYPE, 'result': result });
            return;
        }
        targetUID = client.FRIEND_UID;
    } else {
        targetUID = acc.USER_UID;
    }

    MyRoom.InitMyRoomInfo(targetUID, (error, res) => {
        uMyRoom = res;
        if (error == 1) {
            socket.emit('ANS_MYROOM', { 'ATYPE': client.ATYPE, 'result': 1 });
        } else {
            if (error) {
                PrintError(error);
                result = 1;
                socket.emit('ANS_MYROOM', { 'ATYPE': client.ATYPE, 'result': result });
                return;
            }

            if (!visitFlag) {
                socket.Session.SetMyRoom(uMyRoom);
                console.timeEnd("ANS_MYROOM_100");
                socket.emit('ANS_MYROOM', { 'ATYPE': client.ATYPE, 'result': result, 'MYROOM': uMyRoom });
            } else {
                let delegateMyRoom = [];
                for (let i = 0; i < uMyRoom.length; i++) {
                    if (uMyRoom[i].DELEGATE == 1) delegateMyRoom.push(uMyRoom[i]);
                }
                if (delegateMyRoom.length > 0) {
                    delegateMyRoom[0].CHA_LIST = [];
                    selectDB.query("SELECT * FROM CHARAC WHERE USER_UID = ? AND MYROOM_ID = ?", [targetUID, delegateMyRoom[0].MYROOM_ID]
                        , (error, result) => {
                            if (error) {
                                socket.emit('ANS_MYROOM', { 'ATYPE': client.ATYPE, 'result': result, 'MYROOM': uMyRoom });
                            } else {
                                if (result.length > 0)
                                    for (let i = 0; i < result.length; i++) delegateMyRoom[0].CHA_LIST.push({ CHA_ID: result[i].CHA_ID });
                                uMyRoom = delegateMyRoom;
                                console.timeEnd("ANS_MYROOM_100");
                                socket.emit('ANS_MYROOM', { 'ATYPE': client.ATYPE, 'result': result, 'MYROOM': uMyRoom });
                            }
                        });
                } else {
                    console.timeEnd("ANS_MYROOM_100");
                    socket.emit('ANS_MYROOM', { 'ATYPE': client.ATYPE, 'result': result, 'MYROOM': uMyRoom });
                }
            }
        }
    });
}

// 마이룸 내부 친구 조회
function getFriendsList(socket, client) {
    console.time("ANS_MYROOM_101");
    var acc = socket.Session.GetAccount();
    var result = 0;

    selectDB.query("CALL SELECT_FRIEND(?,?,?)", [4, acc.USER_UID, 0], function (error, results) {
        if (error) {
            PrintError(error);
            result = 1;
            socket.emit('ANS_MYROOM', { 'ATYPE': client.ATYPE, 'result': result, 'VISIT_LIST': [] });
            return;
        }
        if (results[0].length > 0) {
            async.each(results[0], (obj, callback) => {
                selectDB.query("CALL SELECT_MYROOM_ITEM(?)", [obj.FRIEND_UID], (error, result) => {
                    if (!error) {
                        var satisfaction = 0;
                        if (result[0].length > 0) {
                            for (let i = 0; i < result[0].length; i++) {
                                let item = CSVManager.BItem.GetData(result[0][i].ITEM_ID);
                                if (item != null) satisfaction += item.options[0].ID;
                            }
                        }
                        obj.SATISFACTION_CNT = satisfaction;
                    }
                    callback(error);
                });
            }, (error) => {
                console.timeEnd("ANS_MYROOM_101");
                if (error) {
                    result = 1;
                    socket.emit('ANS_MYROOM', { 'ATYPE': client.ATYPE, 'result': result, 'VISIT_LIST': [] });
                } else socket.emit('ANS_MYROOM', { 'ATYPE': client.ATYPE, 'result': result, 'VISIT_LIST': results[0] });
            });
        } else socket.emit('ANS_MYROOM', { 'ATYPE': client.ATYPE, 'result': result, 'VISIT_LIST': results[0] });
    });
}

// 마이룸 히스토리 내역 조회
function getMyRoomHistory(socket, client) {
    console.time("ANS_MYROOM_103");
    var acc = socket.Session.GetAccount();
    selectDB.query('CALL SELECT_MYROOM_HISTORY(?,?,?)', [0, acc.USER_UID, null], function (err, results) {
        console.timeEnd("ANS_MYROOM_103");
        var result = 0;
        if (err) {
            PrintError(err);
            result = 1;
            socket.emit('ANS_MYROOM', { 'ATYPE': client.ATYPE, 'result': result, 'MYROOM_HISTORY': [] });
        } else socket.emit('ANS_MYROOM', { 'ATYPE': client.ATYPE, 'result': result, 'MYROOM_HISTORY': results[0] });
    });
}

// 마이룸 복수하기
function revenge(socket, client) {
    console.time("ANS_MYROOM_104");
    var acc = socket.Session.GetAccount();
    var userPvP = socket.Session.GetPvP();
    var result = 0;

    if (client.HISTORY_UID == undefined) {
        result = 1;
        socket.emit('ANS_MYROOM', { 'ATYPE': client.ATYPE, 'result': result });
        return;
    }

    // 내 전투력 계산
    Character.CalculateTeamCombat(null, 5, socket, (error, teamPowerSum) => {
        selectDB.query('CALL SELECT_MYROOM_HISTORY(?,?,?)'
            , [1, acc.USER_UID, client.HISTORY_UID], function (bErr, bRes) {
                if (bErr) {
                    PrintError(bErr);
                    result = 1;
                    socket.emit('ANS_MYROOM', { 'ATYPE': client.ATYPE, 'result': result });
                    return;
                } else {
                    var enemy_pvp = bRes[0];
                    var enemy_list = bRes[1];
                    var myRoomItem = bRes[2];
                    selectDB.query("CALL SELECT_PVP_RANK(?,?)", [1, enemy_pvp[0].USER_UID], function (eErr, eRes) {
                        if (eErr) {
                            PrintError(eErr);
                            result = 1;
                        }
                        Character.CalculateCharacterListCombat(enemy_list[0].USER_UID, null, enemy_list, null, (enemyCombat) => {
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
                            enemy["LIST"] = enemy_list;
                            try {
                                for (var k = 0; k < myRoomItem.length; k++) {
                                    myRoomItem[k].ANCHOR = JSON.parse(myRoomItem[k].ANCHOR);
                                    myRoomItem[k].POSITION = JSON.parse(myRoomItem[k].POSITION);
                                }
                            } catch (e) { console.log("Not Json"); }
                            enemy["MYROOM_ITEM"] = myRoomItem;

                            enemy["RANK"] = eRes[0][0].RANK;
                            enemy["GROUP_RANK"] = eRes[1][0].RANK;
                            console.timeEnd("ANS_MYROOM_104");
                            socket.emit('ANS_MYROOM', {
                                'ATYPE': client.ATYPE, 'result': result, "PVP": userPvP, "RANK": eRes[0][0].RANK,
                                "GROUP_RANK": eRes[1][0].RANK, "MY_COMBAT": teamPowerSum, "REWARD": [], "ENEMY": enemy
                            });
                        });
                    });
                }
            });
    });
}

// 복수하기 결과
function endRevenge(socket, client) {
    console.time("ANS_MYROOM_202");
    var acc = socket.Session.GetAccount();

    if (client.HISTORY_UID == undefined || client.VICTORY == undefined) {
        result = 1;
        socket.emit('ANS_MYROOM', { 'ATYPE': client.ATYPE, 'result': result });
        return;
    }

    DB.query('CALL UPDATE_MYROOM_HISTORY(?,?,?,?)'
        , [0, acc.USER_UID, client.HISTORY_UID, client.VICTORY + 1], function (err, results) {
            var result = 0;
            if (err) {
                PrintError(err);
                result = 1;
                socket.emit('ANS_MYROOM', { 'ATYPE': client.ATYPE, 'result': result });
                return;
            } else {
                DB.query('CALL INSERT_STAIN_SINGLE(?,?,?,?)'
                    , [null, results[0].ATTACK_UID, null, null], function (err, res) {
                        var result = 0;
                        if (err) {
                            PrintError(err);
                            result = 1;
                        }
                        console.timeEnd("ANS_MYROOM_202");
                        socket.emit('ANS_MYROOM', { 'ATYPE': client.ATYPE, 'result': result, "MYROOM_HISTORY": results[0] });
                    });
            }
        });
}

// 마이룸 버프 계산
exports.GetDelegateMyRoomBuff = (socket, callback) => {
    console.time("GetDelegateMyRoomSatisfaction");
    let acc = socket.Session.GetAccount();

    var satisfaction = 0;
    let queryStr = "SELECT B.ITEM_ID FROM MYROOM_ITEM A LEFT JOIN ITEM B "
        + "ON A.USER_UID = B.USER_UID AND A.ITEM_UID = B.ITEM_UID "
        + "WHERE A.USER_UID = ? AND MYROOM_ID = ?";
    selectDB.query(queryStr, [acc.USER_UID, acc.DELEGATE_MYROOM], (error, result) => {
        if(error){
            PrintError(error);
        }
        if(result.length > 0){
            for(let i = 0; i < result.length; i++){
                let itemCSVObj = CSVManager.BItem.GetData(result[i].ITEM_ID);
                if(itemCSVObj !== null)
                    satisfaction += itemCSVObj.options[0].ID; // 만족도
            }
        }
        // 먼지 수만큼 satisfaction 차감
        selectDB.query("SELECT * FROM STAIN WHERE USER_UID = ? AND MYROOM_ID = ? AND START_TIME IS NULL", 
            [acc.USER_UID, acc.DELEGATE_MYROOM], (error, result) => {
                if(error) PrintError(error);

                let cutback = result.length * CSVManager.BMyRoomCommon.GetData('stain_consume_satisfaction');
                satisfaction -= cutback;   
                if(satisfaction < 0) satisfaction = 0;

                let myRoomCSVObj = CSVManager.BMyRoom.GetData(acc.DELEGATE_MYROOM);
                let buffList = [];
                if(satisfaction > 0) {
                    for(let i = myRoomCSVObj.satisfaction.length - 1; i > -1; i--){
                        if(myRoomCSVObj.satisfaction[i].SATIS <= satisfaction) {
                            buffList.push(myRoomCSVObj.satisfaction[i]);
                        }
                    }
                }
                console.timeEnd("GetDelegateMyRoomSatisfaction");
                callback(buffList);
        });

    });
}

// 마이룸 버프 조회
function getMyRoomBuff(socket, client) {
    MyRoom.GetDelegateMyRoomBuff(socket, (buffList) => {
        socket.emit('ANS_MYROOM', { 'ATYPE': client.ATYPE, 'result': 0, BUFFLIST: buffList });
    });
}