/**
 * 친구 Controller
 * 
 */

module.exports.OnPacket = function (socket) {

    socket.on("REQ_FRIEND", function (client) {
        try {
            if (client.ATYPE !== undefined) {

                var packetType = aTypeParser(client.ATYPE);

                if (packetType.cType == "0") {
                    switch (packetType.aType) {
                        case "00": requestFriend(socket, client); break;
                        default: break;
                    }
                } else if (packetType.cType == "1") {
                    switch (packetType.aType) {
                        case "00": getFriends(socket, client); break;
                        case "01": findFriend(socket, client); break;
                        case "02": getFriendsRecommand(socket, client); break;
                        case "03": getFriendsRequest(socket, client); break;
                        case "04": getRequestReceive(socket, client); break;
                        case "05": getFriendDelegateTeam(socket, client); break;
                        case "06": getStriker(socket, client); break;
                        default: break;
                    }
                } else if (packetType.cType == "2") {
                    switch (packetType.aType) {
                        case "00": acceptFriend(socket, client); break;
                        case "01": rejectRequest(socket, client); break;
                        case "02": break;
                        default: break;
                    }
                } else if (packetType.cType == "3") {
                    switch (packetType.aType) {
                        case "00": deleteRequestFriend(socket, client); break;
                        case "01": deleteFriend(socket, client); break;
                        case "02": sendFriendshipPoint(socket, client); break;
                        case "03": receiveFriendshipPoint(socket, client); break;
                        default: break;
                    }
                } else {

                }
            }
        } catch (e) { PrintError(e); }
    });
}

// 친구 목록 조회
function getFriends(socket, client) {
    console.time("ANS_FRIEND_100");
    var acc = socket.Session.GetAccount();
    Friend.InitFriends(acc, (jsonData) => {
        jsonData.ATYPE = client.ATYPE;
        console.timeEnd("ANS_FRIEND_100");
        socket.emit('ANS_FRIEND', jsonData);
    });
}

// 친구 목록 조회
exports.InitFriends = (acc, callback) => {
    var jsonData = { result: 0 };

    async.waterfall([
        function (cb) {
            // 친구 삭제 제한 데이터 조회
            selectDB.query("SELECT DEL_FRIEND_LIMIT FROM ACCOUNT WHERE USER_UID = ?", [acc.USER_UID], function (err, result) {
                if (!err) {
                    acc.DEL_FRIEND_LIMIT = result[0].DEL_FRIEND_LIMIT;
                    cb(null);
                }
                else cb(err);
            });
        }, function (cb) {
            // 친구 요청 목록에서 요청 기한이 지난 데이터 삭제
            DB.query("DELETE FROM FRIEND"
                + " WHERE (USER_UID = ? OR FRIEND_UID = ?) AND ACCEPT = 0 AND ACTIVE = 1 AND TIMESTAMPDIFF(DAY, REQUEST_DATE, NOW()) > ?",
                [acc.USER_UID, acc.USER_UID, CSVManager.BFriendsCommon.GetData('request_waiting_days') - 1], function (err, result) {
                    if (!err) {
                        cb(null);
                    }
                    else cb(err);
                });
        }, function (cb) {
            DB.query("CALL SELECT_FRIEND(?,?,?)", [1, acc.USER_UID, 0], function (err, result) {
                if (!err) {
                    jsonData.FRIEND_LIST = result[0];
                    async.eachSeries(jsonData.FRIEND_LIST, function (obj, ecb) {
                        // 친구 대표팀 전투력 계산
                        Character.CalculateTeamCombat(obj.USER_UID, 1, null, (error, teamPowerSum) => {
                            obj.DELEGATE_TEAM_POWER = 0;
                            if (error) {
                                ecb(error);
                            } else {
                                obj.DELEGATE_TEAM_POWER = teamPowerSum;
                                ecb(null);
                            }
                        });
                    }, function (error) {
                        if (error)
                            cb(err);
                        else
                            cb(null);
                    });
                }
                else cb(err);
            });
        }
    ], function (err, result) {
        if (err) {
            PrintError(err);
            jsonData.result = 1;
        }
        else {
            //친구 목록 조회 시 호출 됨으로 자정 시간에 업데이트된 DEL_FRIEND_LIMIT 정보를 갱신하기 위해 서버에서 주는 데이터로 동기화 해야 함.
            jsonData.DEL_FRIEND_LIMIT = acc.DEL_FRIEND_LIMIT;
            jsonData.COUNT = jsonData.FRIEND_LIST.length;
        }
        callback(jsonData);
    });
}
// 친구 찾기
function findFriend(socket, client) {
    console.time("ANS_FRIEND_101");
    var acc = socket.Session.GetAccount();
    var jsonData = { result: 0 };

    if (client.USER_NAME == undefined) {
        jsonData.ATYPE = client.ATYPE;
        socket.emit('ANS_FRIEND', jsonData);
        return;
    }
    async.waterfall([
        function (callback) { //!< 친구 목록과 친구 요청 목록 and 요청 수신 목록을 동시에 조회.
            selectDB.query("CALL SELECT_FRIEND(?,?,?)", [0, acc.USER_UID, 0], function (err, result) {
                if (!err) {
                    jsonData.FRIEND_LIST = [];

                    var eFlag = 0;

                    for (var i = 0; i < result[0].length; i++) {
                        if (result[0][i].ACTIVE == 1) {
                            if (client.USER_NAME == "") {
                                eFlag = 2;
                                if (result[0][i].ACCEPT == 0) jsonData.FRIEND_LIST.push(result[0][i]);
                            } else if (result[0][i].USER_NAME == client.USER_NAME) {
                                jsonData.FRIEND_LIST.push(result[0][i]);
                                if (result[0][i].ACCEPT == 0) eFlag = 2;
                                else eFlag = 3;
                            }
                        }
                    }
                    for (var j = 0; j < result[1].length; j++) {
                        if (result[1][j].ACTIVE == 1) {
                            if (result[1][j].USER_NAME == client.USER_NAME) {
                                jsonData.FRIEND_LIST.push(result[1][j]);
                                eFlag = result[1][j].ACCEPT == 0 ? 4 : 0; //!< 4: 이미 요청 받은 친구
                                break;
                            }
                        }
                    }
                    if (eFlag == 0)
                        callback(null);
                    else callback(eFlag); //!< 이미 요청한 유저.
                }
                else callback(err);
            });
        },
        function (callback) {
            selectDB.query("CALL SELECT_ACCOUNT(?,?,?)", [null, client.USER_NAME, 1], function (err, result) {
                if (!err) {
                    jsonData.FRIEND_LIST = result[0];
                    callback(null);
                }
                else callback(err);
            });
        }
    ], function (err, result) {
        if (err) {
            PrintError(err);
            jsonData.result = Number(err);
        }
        jsonData.ATYPE = client.ATYPE;
        if (jsonData.FRIEND_LIST.length > 0) {
            async.eachSeries(jsonData.FRIEND_LIST, function (obj, cb) {
                Character.CalculateTeamCombat(obj.USER_UID, 1, null, (error, teamPowerSum) => {
                    obj.DELEGATE_TEAM_POWER = 0;
                    if (error) {
                        cb(error);
                    } else {
                        obj.DELEGATE_TEAM_POWER = teamPowerSum;
                        cb(null);
                    }
                });
            }, function (error) {
                console.timeEnd("ANS_FRIEND_101");
                if (error) {
                    PrintError(error);
                    jsonData.result = Number(error);
                }
                socket.emit('ANS_FRIEND', jsonData);
            });
        } else {
            socket.emit('ANS_FRIEND', jsonData);
        }
    });
}
// 친구 요청 목록 조회
function getFriendsRequest(socket, client) {
    console.time("ANS_FRIEND_103");
    var acc = socket.Session.GetAccount();
    var jsonData = { result: 0 };
    async.waterfall([
        function (callback) {
            selectDB.query("CALL SELECT_FRIEND(?,?,?)", [2, acc.USER_UID, 0], function (err, result) {
                if (!err) {
                    jsonData.COUNT = result[0].length;
                    jsonData.FRIEND_LIST = result[0];
                    async.eachSeries(jsonData.FRIEND_LIST, function (obj, cb) {
                        Character.CalculateTeamCombat(obj.USER_UID, 1, null, (error, teamPowerSum) => {
                            obj.DELEGATE_TEAM_POWER = 0;
                            if (error) {
                                cb(error);
                            } else {
                                obj.DELEGATE_TEAM_POWER = teamPowerSum;
                                cb(null);
                            }
                        });
                    }, function (error) {
                        if (error)
                            callback(err);
                        else
                            callback(null);
                    });
                }
                else callback(err);
            });
        }
    ], function (err, result) {
        if (err) {
            PrintError(err);
            jsonData.result = 1;
        }
        jsonData.ATYPE = client.ATYPE;
        console.timeEnd("ANS_FRIEND_103");
        socket.emit('ANS_FRIEND', jsonData);
    });
}
// 친구 요청
function requestFriend(socket, client) {
    console.time("ANS_FRIEND_000");
    var jsonData = { result: 0 };
    var acc = socket.Session.GetAccount();

    if (client.FRIEND_UID == undefined || acc.USER_UID == client.FRIEND_UID) {
        jsonData.ATYPE = client.ATYPE;
        jsonData.result = 5;
        socket.emit('ANS_FRIEND', jsonData);
        return;
    }

    async.waterfall([
        function (callback) { //!< 친구 목록과 친구 요청 목록을 동시에 조회.
            selectDB.query("CALL SELECT_FRIEND(?,?,?)", [0, acc.USER_UID, 0], function (err, result) {
                if (!err) {
                    var eFlag = 0;
                    var fCount = 0, rCount = 0;
                    for (var i = 0; i < result[0].length; i++) {
                        if (result[0][i].ACTIVE == 1) {
                            if (result[0][i].FRIEND_UID == client.FRIEND_UID) {
                                eFlag = result[0][i].ACCEPT == 0 ? 2 : 3; //!< 3: 이미 요청 함 / 4: 이미 친구임.
                                break;
                            }

                            if (result[0][i].ACCEPT == 0) rCount++; //!< 요청 카운트 ++.
                            else fCount++; //!< 친구 카운트 ++.
                        }
                    }
                    if (eFlag == 0) {
                        //친구 목록 꽉참
                        if (fCount >= calculateMaxFriendsCount(acc.USER_LEVEL))
                            callback(4);
                        else callback(null);
                    }
                    else callback(eFlag); //!< 이미 요청한 유저.
                }
                else callback(err);
            });
        },
        function (callback) {
            DB.query("CALL INSERT_FRIEND(?,?,?)", [acc.USER_UID, client.FRIEND_UID, 0], function (err, result) {
                if (!err) {
                    Notification.Notify("FRIEND", client.FRIEND_UID);
                    callback(null);
                } else {
                    logging.info("[" + acc.USER_NAME + "] - requestFriend result " + jsonData.result + " - FRIEND_UID : " + client.FRIEND_UID);
                    callback(err);
                }
            });
        }
    ], function (err, result) {
        if (err) {
            PrintError(err);
            jsonData.result = Number(err);
        }
        else {
            jsonData.FRIEND_UID = client.FRIEND_UID;
            Notification.Notify("FRIEND", client.FRIEND_UID);
        }
        jsonData.ATYPE = client.ATYPE;
        console.timeEnd("ANS_FRIEND_000");
        socket.emit('ANS_FRIEND', jsonData);
    });
}
// 친구 요청 삭제
function deleteRequestFriend(socket, client) {
    console.time("ANS_FRIEND_300");
    var acc = socket.Session.GetAccount();
    var jsonData = { result: 0 };

    if (client.FRIEND_UID == undefined) {
        jsonData.ATYPE = client.ATYPE;
        socket.emit('ANS_FRIEND', jsonData);
        return;
    }

    async.waterfall([
        function (callback) {
            DB.query("CALL DELETE_FRIEND(?,?,?)", [1, acc.USER_UID, client.FRIEND_UID], function (err, result) {
                if (!err) {
                    callback(null);
                } else {
                    callback(err);
                    logging.info("[" + acc.USER_NAME + "] - deleteRequestFriend result " + jsonData.result + " - FRIEND_UID : " + client.FRIEND_UID);
                }
            });
        }
    ], function (err, result) {
        if (err) {
            PrintError(err);
            jsonData.result = 1;
        }
        else {
            jsonData.FRIEND_UID = client.FRIEND_UID;
        }
        jsonData.ATYPE = client.ATYPE;
        console.timeEnd("ANS_FRIEND_300");
        socket.emit('ANS_FRIEND', jsonData);
    });
}

// 친구 요청 수신 목록
function getRequestReceive(socket, client) {
    console.time("ANS_FRIEND_104");
    var acc = socket.Session.GetAccount();
    var jsonData = { result: 0 };
    async.waterfall([
        function (callback) {
            selectDB.query("CALL SELECT_FRIEND(?,?,?)", [3, acc.USER_UID, 0], function (err, result) {
                if (!err) {
                    jsonData.COUNT = result[0].length;
                    jsonData.FRIEND_LIST = result[0];
                    async.eachSeries(jsonData.FRIEND_LIST, function (obj, cb) {
                        Character.CalculateTeamCombat(obj.USER_UID, 1, null, (error, teamPowerSum) => {
                            obj.DELEGATE_TEAM_POWER = 0;
                            if (error) {
                                cb(error);
                            } else {
                                obj.DELEGATE_TEAM_POWER = teamPowerSum;
                                cb(null);
                            }
                        });
                    }, function (error) {
                        if (error)
                            callback(err);
                        else
                            callback(null);
                    });
                }
                else callback(err);
            });
        }
    ], function (err, result) {
        if (err) {
            PrintError(err);
            jsonData.result = 1;
        }
        jsonData.ATYPE = client.ATYPE;
        console.timeEnd("ANS_FRIEND_104");
        socket.emit('ANS_FRIEND', jsonData);
    });
}

// 친구 요청 수락
function acceptFriend(socket, client) {
    console.time("ANS_FRIEND_200");
    var jsonData = { result: 0 };
    var acc = socket.Session.GetAccount();
    var friend_uid = client.FRIEND_UID;
    var myFriends = [];
    var targetFriends = [];

    if (client.FRIEND_UID == undefined) {
        jsonData.ATYPE = client.ATYPE;
        socket.emit('ANS_FRIEND', jsonData);
        return;
    }

    async.waterfall([
        function (callback) {
            selectDB.query("CALL SELECT_FRIEND(?,?,?)", [1, acc.USER_UID, 0], function (aErr, aRes) {
                if (!aErr) {
                    myFriends = aRes[0];
                    var flag = false;

                    if (myFriends.length < calculateMaxFriendsCount(acc.USER_LEVEL)) { //!< 친구 최대 치를 넘지 않음.
                        for (var i = 0; i < myFriends.length; i++) {
                            if (myFriends[i].FRIEND_UID == friend_uid) {
                                flag = true;
                                break;
                            }
                        }

                        if (flag == false) { //!< 중복되지 않음.
                            selectDB.query("CALL SELECT_FRIEND(?,?,?)", [1, friend_uid, 0], function (bErr, bRes) {
                                targetFriends = bRes[0];
                                if (!bErr) {
                                    selectDB.query("SELECT USER_LEVEL FROM ACCOUNT WHERE USER_UID = ?", [friend_uid], function (aErr, aRes) {
                                        if (targetFriends.length < calculateMaxFriendsCount(aRes[0].USER_LEVEL))
                                            callback(null, 0);
                                        else callback(null, 4); //!< 상대방 친구 목록이 가득 참.
                                    });
                                }
                                else callback(bErr);
                            });
                        }
                        else callback(null, 2); //!< 이미 친구 추가 됌. 상대방 요청 데이터 삭제.
                    }
                    else callback(null, 3); //!< 내 친구 꽉참.
                }
                else callback(aErr);
            });
        }, function (error, callback) {
            if (error == 1) { //!< 이미 친구 추가 된 경우, 상대방 요청 데이터 삭제
                DB.query("CALL DELETE_FRIEND(?,?)", [friend_uid, acc.USER_UID], function (cErr, cRes) {
                    if (!cErr)
                        callback(null);
                    else callback(cErr);
                });
            }
            else callback(error);
        }, function (callback) { //!< 나의 데이터에 추가 함.
            DB.query("CALL INSERT_FRIEND(?,?,?)", [acc.USER_UID, friend_uid, 1], function (dErr, dRes) { //!< 친구가 존재하느냐?.
                if (!dErr) {
                    callback(null);
                } else {
                    callback(dErr);
                    logging.info("[" + acc.USER_NAME + "] - acceptFriend result " + jsonData.result + " - FRIEND_UID : " + friend_uid);
                }
            });
        }, function (callback) { //!< 나에게 요청한 사람의 데이터를 수정함.
            DB.query("CALL UPDATE_FRIEND(?,?)", [friend_uid, acc.USER_UID], function (eErr, eRes) {
                if (!eErr)
                    callback(null);
                else callback(eErr);
            });
        }
    ], function (err, result) {
        if (err) {
            PrintError(err);
            jsonData.result = 1;
            if(typeof err == "number") jsonData.result = err;
        }
        jsonData.ATYPE = client.ATYPE;
        console.timeEnd("ANS_FRIEND_200");
        socket.emit('ANS_FRIEND', jsonData);
    });
}

// 친구 요청 거절
function rejectRequest(socket, client) {
    console.time("ANS_FRIEND_201");
    var jsonData = { result: 0 };
    var acc = socket.Session.GetAccount();
    var friendUID = client.FRIEND_UID;

    if (client.FRIEND_UID == undefined) {
        jsonData.ATYPE = client.ATYPE;
        socket.emit('ANS_FRIEND', jsonData);
        return;
    }

    var receiveRequestList = [];

    async.waterfall([
        function (callback) { //!< .
            selectDB.query("CALL SELECT_FRIEND(?,?,?)", [3, acc.USER_UID, 0], function (aErr, aRes) {
                if (!aErr) {
                    receiveRequestList = aRes[0];
                    var flag = false;
                    for (var i = 0; i < receiveRequestList.length; i++) {
                        if (receiveRequestList[i].USER_UID == client.FRIEND_UID) { //!< 데이터 존재?.
                            flag = true;
                            break;
                        }
                    }

                    if (flag) callback(null);
                    else callback(1); //!< 요청한 친구가 아님.
                }
                else callback(aErr);
            });
        },
        function (callback) { //!< 나에게 요청한 사람의 데이터를 삭제함.
            DB.query("CALL DELETE_FRIEND(?,?,?)", [1, client.FRIEND_UID, acc.USER_UID], function (bErr, bRes) {
                if (!bErr) {
                    callback(null);
                } else {
                    callback(bErr);
                    logging.info("[" + acc.USER_NAME + "] - rejectRequest result " + jsonData.result + " - FRIEND_UID : " + client.FRIEND_UID);
                }
            });
        }
    ], function (err, result) {
        if (err) {
            PrintError(err);
            jsonData.result = 1;
        }
        jsonData.ATYPE = client.ATYPE;
        console.timeEnd("ANS_FRIEND_201");
        socket.emit('ANS_FRIEND', jsonData);
    });
}

// 친구 삭제
function deleteFriend(socket, client) {
    console.time("ANS_FRIEND_301");
    var jsonData = { result: 0 };
    var acc = socket.Session.GetAccount();
    var friendUID = client.FRIEND_UID;
    jsonData.ATYPE = client.ATYPE;

    if (friendUID == undefined) {
        socket.emit('ANS_FRIEND', jsonData);
        return;
    }

    if (acc.DEL_FRIEND_LIMIT == 0) {
        jsonData.result = 2;
        socket.emit('ANS_FRIEND', jsonData);
        return;
    }

    Account.updateDelLimit(socket);

    async.waterfall([
        function (callback) {
            DB.query("CALL DELETE_FRIEND(?,?,?)", [0, acc.USER_UID, friendUID], function (aErr, aRes) {
                if (!aErr) {
                    callback(null);
                } else {
                    callback(aErr);
                    logging.info("[" + acc.USER_NAME + "] - deleteFriend result " + jsonData.result + " - FRIEND_UID : " + friendUID);
                }
            });
        },
        function (callback) {
            DB.query("CALL DELETE_FRIEND(?,?,?)", [0, friendUID, acc.USER_UID], function (bErr, bRes) {
                if (!bErr)
                    callback(null);
                else callback(bErr);
            });
        }
    ], function (err, result) {
        if (err) {
            PrintError(err);
            jsonData.result = Number(err);
        }
        else {
            jsonData.FRIEND_UID = friendUID;
        }
        console.timeEnd("ANS_FRIEND_301");
        socket.emit('ANS_FRIEND', jsonData);
    });
}

// 추천 친구 목록 조회
function getFriendsRecommand(socket, client) {
    var acc = socket.Session.GetAccount();
    var jsonData = { result: 0 };
    jsonData.ATYPE = client.ATYPE;
    var page = client.PAGE || 1;

    let baseEXP = acc.USER_EXP;
    if (baseEXP == 0) baseEXP = 1;

    var min = baseEXP * CSVManager.BFriendsCommon.GetData("search_coefficient_min");
    var max = baseEXP * CSVManager.BFriendsCommon.GetData("search_coefficient_max");

    var cnt = CSVManager.BFriendsCommon.GetData("display_recommand_count");

    selectDB.query("CALL SELECT_RECOMMAND(?,?,?,?,?,?)", [0, acc.USER_UID, parseInt(min), parseInt(max), (page - 1) * cnt, cnt], function (err, result) {

        if (err) {
            jsonData.result = 1;
            socket.emit('ANS_FRIEND', jsonData);
        } else {
            jsonData.FRIEND_LIST = result[0];
            async.eachSeries(jsonData.FRIEND_LIST, function (obj, cb) {
                Character.CalculateTeamCombat(obj.USER_UID, 1, null, (error, teamPowerSum) => {
                    obj.DELEGATE_TEAM_POWER = 0;
                    if (error) {
                        cb(error);
                    } else {
                        obj.DELEGATE_TEAM_POWER = teamPowerSum;
                        cb(null);
                    }
                });
            }, function (error) {
                if (error) {
                    jsonData.result = 1;
                    socket.emit('ANS_FRIEND', jsonData);
                } else {
                    jsonData.PAGE = ++page;
                    if (jsonData.FRIEND_LIST.length == 0 || jsonData.FRIEND_LIST.length < cnt)
                        jsonData.PAGE = 1;

                    socket.emit('ANS_FRIEND', jsonData);
                }
            });
        }
    });
}

// 우정 보내기
function sendFriendshipPoint(socket, client) {
    console.time("ANS_FRIEND_302");
    var friendUID = client.FRIEND_UID;
    var acc = socket.Session.GetAccount();
    var jsonData = { result: 0 };
     
    
    DB.query("CALL SEND_FRIENDSHIP_POINT(?,?,?)", [acc.USER_UID, friendUID, CSVManager.BFriendsCommon.GetData("friendShipPoint_reuse_time")], function (err, result) {
        if (err) {
            jsonData.result = 1;
            socket.emit('ANS_FRIEND', jsonData);
        } else {
            Mission.addMission(acc.USER_UID, 8000015, result[0].length);
            var FRIEND_UID_LIST = [];
            if (result[0].length > 0) {
                for (var i = 0; i < result[0].length; i++) {
                    FRIEND_UID_LIST.push(result[0][i].FRIEND_UID);
                    Notification.Notify("FRIEND", result[0][i].FRIEND_UID);
                }
            }

            var friendshipPoint = result[0].length;
            var rewardList = [];

            rewardList.push({ REWARD_ITEM_ID: DefineItem.FRIENDSHIP_TOKEN, REWARD_ITEM_COUNT: friendshipPoint, TYPE: 10 });

            Item.addRewardItem(socket, rewardList, 0, function (aErr, aRes) {
                if (aErr) {
                    PrintError(aErr);
                }
                if (aRes != undefined)
                    aRes.REWARD = [];

                jsonData.ATYPE = client.ATYPE;
                jsonData.FRIEND_UID_LIST = FRIEND_UID_LIST;
                jsonData.REWARD = aRes;
                console.timeEnd("ANS_FRIEND_302");
                socket.emit('ANS_FRIEND', jsonData);
            });
        }
    });
}

// 우정 받기
function receiveFriendshipPoint(socket, client) {
    console.time("ANS_FRIEND_303");
    var friendUID = client.FRIEND_UID;
    var acc = socket.Session.GetAccount();
    var jsonData = { result: 0 };
    jsonData.ATYPE = client.ATYPE;

    DB.query("CALL RECEIVE_FRIENDSHIP_POINT(?,?)", [acc.USER_UID, friendUID], function (err, result) {
        if (err) {
            jsonData.result = 1;
            socket.emit('ANS_FRIEND', jsonData);
        } else {
            var FRIEND_UID_LIST = [];
            if (result[0].length > 0) {
                for (var i = 0; i < result[0].length; i++)
                    FRIEND_UID_LIST.push(result[0][i].FRIEND_UID);
            }

            var friendshipPoint = result[0].length;
            var rewardList = [];

            rewardList.push({ REWARD_ITEM_ID: DefineItem.FRIENDSHIP_TOKEN, REWARD_ITEM_COUNT: friendshipPoint, TYPE: 11 });

            Item.addRewardItem(socket, rewardList, 0, function (aErr, aRes) {
                if (aErr) {
                    PrintError(aErr);
                }
                if (aRes != undefined)
                    aRes.REWARD = [];

                jsonData.ATYPE = client.ATYPE;
                jsonData.FRIEND_UID_LIST = FRIEND_UID_LIST;
                jsonData.REWARD = aRes;
                console.timeEnd("ANS_FRIEND_303");
                socket.emit('ANS_FRIEND', jsonData);
            });
        }
    });
}

//최대 친구 수 계산
function calculateMaxFriendsCount(level) {
    var max_friends_count = CSVManager.BFriendsCommon.GetData("default_friends_count");

    max_friends_count += parseInt(level / CSVManager.BFriendsCommon.GetData("add_count"));
    
    if (max_friends_count > CSVManager.BFriendsCommon.GetData("max_friends_count"))
    max_friends_count = CSVManager.BFriendsCommon.GetData("max_friends_count");
    return max_friends_count;
}


// 친구 대표팀 조회
function getFriendDelegateTeam(socket, client) {
    console.time("ANS_FRIEND_105");
    var friend_uid = client.FRIEND_UID;
    var teamNo = client.TEAM_NO;

    var jsonData = { result: 0 };
    jsonData.ATYPE = client.ATYPE;

    selectDB.query("CALL SELECT_TEAM(?,?,?)", [2, friend_uid, teamNo], function (err, result) {
        console.timeEnd("ANS_FRIEND_105");
        if (err) {
            jsonData.result = 1;
            socket.emit('ANS_FRIEND', jsonData);
        } else {
            jsonData.FRIEND_LIST = result[0];
            socket.emit('ANS_FRIEND', jsonData);
        }
    });
}

// 스트라이커 조회
//친구 목록 - 전투력 상위 5명
//추천 친구 목록 - 1.5배 중 랜덤 5명
function getStriker(socket, client) {
    console.time("ANS_FRIEND_106");
    var acc = socket.Session.GetAccount();
    var jsonData = { result: 0 };

    let baseEXP = acc.USER_EXP;
    if (baseEXP == 0) baseEXP = 1;

    var min = baseEXP * CSVManager.BFriendsCommon.GetData("search_coefficient_min");
    var max = baseEXP * CSVManager.BFriendsCommon.GetData("search_coefficient_max");
    var friend_count = CSVManager.BFriendsCommon.GetData("mission_display_friends_count");
    var recommand_count = CSVManager.BFriendsCommon.GetData("mission_display_recommand_friends_count");

    async.waterfall([
        function (callback) {
            DB.query("DELETE FROM STRIKER WHERE USER_UID = ? AND TIMESTAMPDIFF(SECOND, CREATE_DATE, NOW()) > ?", [acc.USER_UID, CSVManager.BFriendsCommon.GetData("striker_reuse_time")]
                , (error, result) => {
                    callback(error);
                });
        }, function (callback) {
            //delete 스트라이커 데이터(시간 초과)
            //친구 검색(스트라이커 데이터 exist 제외)
            DB.query("CALL SELECT_FRIEND(?,?,?)", [5, acc.USER_UID, 0], function (err, result) {
                if (err) {
                    callback(err);
                } else {
                    jsonData.FRIEND_LIST = result[0];
                    async.eachSeries(jsonData.FRIEND_LIST, function (obj, cb) {
                        Character.CalculateTeamCombat(obj.USER_UID, 1, null, (error, teamPowerSum) => {
                            obj.DELEGATE_TEAM_POWER = 0;
                            if (error) {
                                cb(error);
                            } else {
                                obj.DELEGATE_TEAM_POWER = teamPowerSum;
                                cb(null);
                            }
                        });
                    }, function (error) {
                        jsonData.FRIEND_LIST.sort(function (a, b) { // 내림차순
                            return a.DELEGATE_TEAM_POWER > b.DELEGATE_TEAM_POWER ? -1 : a.DELEGATE_TEAM_POWER < b.DELEGATE_TEAM_POWER ? 1 : 0;
                        });
                        var temp_list = [];
                        if (jsonData.FRIEND_LIST.length > 0) {
                            var cnt = jsonData.FRIEND_LIST.length;
                            if (cnt > friend_count)
                                cnt = friend_count;

                            for (var i = 0; i < cnt; i++)
                                temp_list.push(jsonData.FRIEND_LIST[i]);
                        }

                        jsonData.FRIEND_LIST = temp_list;

                        if (error)
                            callback(error);
                        else
                            callback(null);
                    });
                }
            });
        }, function (callback) {
            console.timeEnd("ANS_FRIEND_106");
            //추천 친구 검색(스트라이커 데이터 제외)
            var que = selectDB.query("CALL SELECT_RECOMMAND(?,?,?,?,?,?)",
                [1, acc.USER_UID, parseInt(min), parseInt(max), recommand_count, null], function (err, result) {
                    console.log(que.sql);
                   
                    if (err) {
                        callback(err);
                    } else {
                        jsonData.RECOMMAND_LIST = result[0];
                        async.eachSeries(jsonData.RECOMMAND_LIST, function (obj, cb) {
                            Character.CalculateTeamCombat(obj.USER_UID, 1, null, (error, teamPowerSum) => {
                                obj.DELEGATE_TEAM_POWER = 0;
                                if (error) {
                                    cb(error);
                                } else {
                                    obj.DELEGATE_TEAM_POWER = teamPowerSum;
                                    cb(null);
                                }
                            });
                        }, function (error) {
                            jsonData.RECOMMAND_LIST.sort(function (a, b) { // 내림차순
                                return a.DELEGATE_TEAM_POWER > b.DELEGATE_TEAM_POWER ? -1 : a.DELEGATE_TEAM_POWER < b.DELEGATE_TEAM_POWER ? 1 : 0;
                            });
                            var temp_list = [];
                            if (jsonData.RECOMMAND_LIST.length > 0) {
                                var cnt = jsonData.RECOMMAND_LIST.length;
                                if (cnt > recommand_count)
                                    cnt = recommand_count;

                                for (var i = 0; i < cnt; i++)
                                    temp_list.push(jsonData.RECOMMAND_LIST[i]);
                            }

                            jsonData.RECOMMAND_LIST = temp_list;
                            if (error)
                                callback(error);
                            else
                                callback(null);
                        });
                    }
                });
        }
    ], function (error, result) {
        jsonData.ATYPE = client.ATYPE;
        if (error) {
            PrintError(error);
            jsonData.result = 1;
            socket.emit('ANS_FRIEND', jsonData);
        } else {
            //LIST - LEVEL, USER_NAME, 전투력
            socket.emit('ANS_FRIEND', jsonData);
        }
    });
}

// 스트라이커 사용 시 데이터 저장
exports.SetStriker = function (userUID, friendUID) {
    DB.query("CALL INSERT_STRIKER(?,?)", [userUID, friendUID], function (err, result) {
        if (err) {
            PrintError(err);
        }
    });
}