/*
 * 레이드 Controller (사용 안함)
 */
module.exports.OnPacket = function (socket) {

    socket.on("REQ_RAID", function (client) {
        try {
            if (client.ATYPE !== undefined) {

                var packetType = aTypeParser(client.ATYPE);

                if (packetType.cType == "0") {
                    switch (packetType.aType) {
                        default: break;
                    }
                } else if (packetType.cType == "1") {
                    switch (packetType.aType) {
                        case "00": readyRaid(socket, client); break;
                        case "01": startRaid(socket, client); break;
                        case "02": getMyRank(socket, client); break;
                        case "03": getTopRank(socket, client); break;
                        case "04": getFriendRankData(socket, client); break;
                        default: break;
                    }
                } else if (packetType.cType == "2") {
                    switch (packetType.aType) {
                        case "00": endRaid(socket, client); break;
                        default: break;
                    }
                } else if (packetType.cType == "3") {
                    switch (packetType.aType) {
                        case "00": sendRaidReward(socket, client); break;
                        default: break;
                    }
                } else {

                }
            }
        } catch (e) { PrintError(e); }
    });
}

function readyRaid(socket, client) {
    // 레이드 정보 리턴
    var acc = socket.Session.GetAccount();
    var jsonData = { result: 0 };
    jsonData.ATYPE = client.ATYPE;

    selectDB.query("CALL SELECT_RAID(?,?,?)", [0, acc.USER_UID, 0], function (error, result) {
        if (error) {
            PrintError(error);
            jsonData.result = 1;
        }
        jsonData.BOSS_NO = common.dateDiff(CSVManager.BPvECommon.GetData("raid_init_date"), new Date()) % 3;
        var time = new Date().format("HH");
        if ("00" <= time && time < CSVManager.BPvECommon.GetData("raid_start_time"))
            --jsonData.BOSS_NO;

        jsonData.RAID = result[0];
        socket.emit("ANS_RAID", jsonData);
    });
}

function startRaid(socket, client) {
    // 티켓, 전투력 체크, 시간 체크
    var acc = socket.Session.GetAccount();
    var userItemList = socket.Session.GetItems();
    var jsonData = { result: 0 };
    jsonData.ATYPE = client.ATYPE;

    if (timeCheck()) {
        // 닫힌 시간
        jsonData.result = 5;
        socket.emit("ANS_RAID", jsonData);
        return;
    }

    var itemObj = common.findObjectByKey(userItemList, "ITEM_ID", DefineItem.TICKET_RAID);

    if (itemObj.ITEM_COUNT < 1) {
        //티켓 수량 부족
        jsonData.result = 2;
        socket.emit('ANS_RAID', jsonData);
        return;
    }

    var raidCSVData = CSVManager.BRaid.GetData(client.RAID_ID);

    if (!raidCSVData) {
        jsonData.result = 4;
        socket.emit('ANS_RAID', jsonData);
        return;
    }

    var demandPower = raidCSVData.power_recommand;
    var resFriendObj = { ICON: -1, LIST: [], SKILL: -1 };

    Character.CalculateTeamCombat(null, client.TEAM, socket, (error, teamPowerSum) => {
        if (error) {
            jsonData.result = 1;
            socket.emit('ANS_RAID', jsonData);
            return;
        } else {
            if (teamPowerSum < demandPower) {
                jsonData.result = 3;
                socket.emit('ANS_RAID', jsonData);
                return;
            }
            Mission.addMission(acc.USER_UID, 8000022, 1);
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

                            for (let i = 0; i < res[1].length; i++) {
                                delete res[1][i]["DELEGATE_ICON"];
                                delete res[1][i]["SKILL"];

                                resFriendObj.LIST.push(res[1][i]);
                            }
                        }
                        jsonData.FRIEND = resFriendObj;
                        socket.emit('ANS_RAID', jsonData);
                    }
                });
            } else {
                jsonData.FRIEND = resFriendObj;
                socket.emit('ANS_RAID', jsonData);
            }

        }
    });
}

function endRaid(socket, client) {
    // 
    var acc = socket.Session.GetAccount();
    var userItemList = socket.Session.GetItems();
    var jsonData = { result: 0 };
    jsonData.ATYPE = client.ATYPE;
    // 레이드ID, 데미지
    var itemObj = common.findObjectByKey(userItemList, "ITEM_ID", DefineItem.TICKET_RAID);

    var raidCSVData = CSVManager.BRaid.GetData(client.RAID_ID);

    if (!raidCSVData || itemObj.ITEM_COUNT < 1) {
        jsonData.result = 2;
        socket.emit('ANS_RAID', jsonData);
        return;
    }

    if (endCheck()) {
        jsonData.result = 3;
        socket.emit('ANS_RAID', jsonData);
        return;
    }

    //기존 레이드 데이터 조회
    selectDB.query("CALL SELECT_RAID(?,?,?)", [1, acc.USER_UID, client.RAID_ID], function (error, result) {
        if (error) {
            PrintError(error);
            jsonData.result = 1;
        }
        var raidList = result[0];

        if (raidList.length > 0) {
            client.DAMAGE += raidList[0].DAMAGE;
            client.TAKE_TIME += raidList[0].TAKE_TIME;
        }

        async.waterfall([
            function (callback) {
                var userTeamList = socket.Session.GetTeam();
                var userCharacter = socket.Session.GetCharacters();

                var rankData = {};
                rankData.CHA_LIST = [];
                // 내 전투력 계산
                for (var i = 0; i < userTeamList.length; i++) {
                    if (userTeamList[i].TEAM == client.TEAM) {
                        var obj = common.findObjectByKey(userCharacter, "CHA_UID", userTeamList[i].CHA_UID);
                        rankData.CHA_LIST.push({ CHA_ID: obj.CHA_ID, SKILL: userTeamList[i].SKILL });
                    }
                }
                DB.query("CALL INSERT_RAID(?,?,?,?,?,?)", [acc.USER_UID, client.RAID_ID, client.DAMAGE, client.TAKE_TIME, client.POWER, JSON.stringify(rankData)], function (aErr, aRes) {
                    if (aErr) {
                        callback(aErr);
                    } else {
                        jsonData.RAID = aRes[0];
                        callback(null);
                    }
                });
            }, function (callback) {
                var rewardList = [];
                var tempList = [];

                var bfDamage = 0;
                if (raidList.length > 0) bfDamage = raidList[0].DAMAGE;

                if (jsonData.RAID[0].DAMAGE >= raidCSVData.accum_dmg4) {
                    Mission.addMission(acc.USER_UID, 8000023, 1);
                    Mission.addMissionLog(acc.USER_UID, 8000024, raidCSVData.difficulty, 1);
                }

                tempList = getRaidReward(client.RAID_ID, bfDamage, jsonData.RAID[0].DAMAGE);

                let goldBuff = 1 + Item.GetItemBuff(socket, client.TEAM);

                for (var i = 0; i < tempList.length; i++) {
                    if (tempList[i].REWARD_ITEM_ID == DefineItem.GOLD) {
                        tempList[i].REWARD_ITEM_COUNT *= goldBuff;
                        tempList[i].TYPE = 17;
                    } 
                    rewardList.push(tempList[i]);
                }

                rewardList.push({ REWARD_ITEM_ID: DefineItem.TICKET_RAID, REWARD_ITEM_COUNT: -1 });

                Item.addRewardItem(socket, rewardList, 0, function (aErr, aRes) {
                    if (aErr) {
                        callback(aErr);
                    } else {
                        if (aRes != undefined) {
                            aRes.REWARD = tempList;
                        }
                        //REWARD는 보상 표현 해주기 위한 값, 획득 아이템과 획득 재화를 표현해주기 위한 배열.
                        jsonData.REWARD = aRes;
                        callback(null);
                    }
                });
            }], function (error) {
                if (error) {
                    PrintError(error);
                    jsonData.result = 1;
                }
                socket.emit("ANS_RAID", jsonData);
            });
    });
}

function getMyRank(socket, client) {
    var acc = socket.Session.GetAccount();
    var jsonData = { result: 0 };
    jsonData.ATYPE = client.ATYPE;

    if (!client.RAID_ID || client.RAID_ID == 0) {
        jsonData.result = 1;
        socket.emit("ANS_RAID", jsonData);
        return;
    }

    selectDB.query("CALL SELECT_RAID_RANK(?,?,?,?,?)",
        [0, acc.USER_UID, client.RAID_ID, CSVManager.BPvECommon.GetData("rank_up"), CSVManager.BPvECommon.GetData("rank_down")],
        function (error, result) {
            if (error) {
                PrintError(error);
                jsonData.result = 1;
            }
            jsonData.MY_RANK_NO = result[0][0].v_rank;
            jsonData.MY_RANK = result[1];
            socket.emit("ANS_RAID", jsonData);
        });
}

function getTopRank(socket, client) {
    var jsonData = { result: 0 };
    jsonData.ATYPE = client.ATYPE;

    if (!client.RAID_ID || client.RAID_ID == 0) {
        jsonData.result = 1;
        socket.emit("ANS_RAID", jsonData);
        return;
    }

    selectDB.query("CALL SELECT_RAID_RANK(?,?,?,?,?)", [1, null, client.RAID_ID, 0, 0], function (error, result) {
        if (error) {
            PrintError(error);
            jsonData.result = 1;
        }
        jsonData.TOP = result[0];
        socket.emit("ANS_RAID", jsonData);
    });
}

function getFriendRankData(socket, client) {
    var jsonData = { result: 0 };
    jsonData.ATYPE = client.ATYPE;

    selectDB.query("CALL SELECT_RAID(?,?,?)", [2, client.FRIEND_UID, null], function (error, result) {
        if (error) {
            PrintError(error);
            jsonData.result = 1;
        }
        jsonData.RANK_DATA = [];
        if (result[0].length > 0) {
            try {
                jsonData.RANK_DATA = JSON.parse(result[0][0].RANK_DATA);
            } catch (e) { console.log("Not Json"); }
        }

        socket.emit("ANS_RAID", jsonData);
    });
}

function timeCheck() {
    var flag = false;
    var time = new Date().format("HH");

    if (CSVManager.BPvECommon.GetData("raid_end_time") <= time && time < CSVManager.BPvECommon.GetData("raid_start_time"))
        flag = true;

    return flag;
}

function endCheck() {
    var flag = false;
    var time = new Date().format("HHmm");

    if (CSVManager.BPvECommon.GetData("raid_end_time") + "30" <= time && time < CSVManager.BPvECommon.GetData("raid_start_time") + "00")
        flag = true;

    return flag;
}

function getRaidReward(raidId, bfDamage, afDamage) {
    var raidCSVData = CSVManager.BRaid.GetData(raidId);
    var raidRewardList = [];
    var accumPickList = [];

    for (key in raidCSVData) {
        if (key.indexOf("accum_dmg") > -1) {
            if (bfDamage < raidCSVData[key] && raidCSVData[key] <= afDamage) {
                accumPickList.push(key.replace("accum_dmg", ""));
            }
        }
    }

    for (var j = 0; j < accumPickList.length; j++)
        raidRewardList.push({ "REWARD_ITEM_ID": raidCSVData["accum_rwd" + accumPickList[j]], "REWARD_ITEM_COUNT": raidCSVData["accum_rwd" + accumPickList[j] + "_val"] });

    if (afDamage >= raidCSVData["accum_dmg4"]) {
        var rewardCSVData = CSVManager.BRReward.GetData(raidCSVData.reward);
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

        for (var k = 0; k < tempList.length; k++) {
            if (tempList[k].indexOf("_out") < 0) {
                var str = tempList[k].replace("_probability", "");
                var obj = {};
                for (key in rewardCSVData) {
                    if (key == str)
                        obj.REWARD_ITEM_ID = rewardCSVData[key];
                    if (key == str + "_value") {
                        obj.REWARD_ITEM_COUNT = rewardCSVData[key];
                    }
                }
                raidRewardList.push(obj);
            }
        }
    }
    return raidRewardList;
}

exports.SendRaidReward = function (callback) {
    //보상 계산, 우편함 지급
    var raidObj = {};
    var rewardList = [];
    async.waterfall([function (wcb) {
        selectDB.query("SELECT * FROM RAID GROUP BY RAID_ID", function (error, result) {
            if (error) {
                PrintError(error);
            }
            if (result.length > 0) {
                async.eachSeries(result, function (obj, cb) {
                    raidObj[obj.RAID_ID] = CSVManager.BRRReward.GetDataByDifficulty(CSVManager.BRaid.GetData(obj.RAID_ID).difficulty);

                    selectDB.query("CALL SELECT_RAID_RANK(?,?,?,?,?)", [2, 0, obj.RAID_ID, 0, 0], function (aErr, aRes) {
                        if (aErr) {
                            cb(aErr);
                        } else {
                            var exception_value = 0;
                            var rewardStandard = raidObj[obj.RAID_ID];
                            var rankList = aRes[0];
                            var maxRank = rankList[rankList.length - 1].RANK;

                            for (var i = 0; i < rewardStandard.length; i++) {
                                if (rewardStandard[i].standard_type == 1) {
                                    rewardStandard[i].value = Math.round(maxRank * (rewardStandard[i].standard_value / 100));
                                } else {
                                    rewardStandard[i].value = rewardStandard[i].standard_value;
                                    exception_value = rewardStandard[i].standard_value;
                                }
                            }
                            var limit = CSVManager.BMailString.GetData(5).limit;

                            //리스트 해서  REWARD LIST 생성
                            for (var j = 0; j < rankList.length; j++) {
                                for (var k = 0; k < rewardStandard.length; k++) {
                                    var bfValue = 0;
                                    if (k != 0)
                                        bfValue = rewardStandard[k - 1].value;

                                    if (bfValue < rankList[j].RANK && rankList[j].RANK <= rewardStandard[k].value) {
                                        if (rewardStandard.standard_type == 1 && rankList[j].RANK <= exception_value) {
                                            break;
                                        } else {
                                            rewardList.push({
                                                USER_UID: rankList[j].USER_UID, REWARD_ITEM_ID: rewardStandard[k].reward_id,
                                                REWARD_ITEM_COUNT: rewardStandard[k].reward_id_value, REWARD_DESC: rewardStandard[k].reward_desc, LIMIT: limit
                                            });
                                            rankList[j].REWARD_ITEM_ID = rewardStandard[k].reward_id;
                                            rankList[j].REWARD_ITEM_COUNT = rewardStandard[k].reward_id_value;
                                            rankList[j].REWARD_DESC = rewardStandard[k].reward_desc;
                                            rankList[j].LIMIT = limit;
                                            break;
                                        }
                                    }
                                }
                            }
                            cb(null);
                        }
                    });
                }, function (err) {
                    if (err) {
                        wcb(err);
                    } else {
                        wcb(null);
                    }
                });
            } else {
                wcb(null);
            }
        });
    }, function (wcb) {
        Item.SetItemType(rewardList);
        async.eachSeries(rewardList, function (obj, cb) {
            Mail.PushMail(obj.USER_UID, 5, obj.ITEM_TYPE, obj.REWARD_ITEM_ID, obj.REWARD_ITEM_COUNT, 0, obj.REWARD_DESC, obj.LIMIT, function (mErr, mRes) {
                cb(null);
            });
        });
        wcb(null);
    }], function (error) {
        callback(null);
    });
}