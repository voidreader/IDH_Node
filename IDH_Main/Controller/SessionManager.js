/*
 * Session Controller
 */

module.exports = function () {
    return new SessionManager();
}

function SessionManager() {
    var self = this;

    //!< 유저 데이터 변수들.
    var m_Account = null;
    var m_Character = null;
    var m_Farming = null;
    var m_Making = null;
    var m_MyRoom = null;
    var m_Team = null;
    var m_Story = null;
    var m_Chapter_reward = null;
    var m_PvP = null;

    var m_Item = null;

    var m_Socket = null;


    //!< 유저 로그인.
    self.UserLogin = function (socket, client, cb) {
        m_Socket = socket;
        var jsonData = {};
        //async parallel 로 변경
        async.waterfall([
            function (callback) { //
                if ([3,4].indexOf(client.TYPE) > -1) {
                    let queryStr = "UPDATE ACCOUNT SET USER_ID = ? WHERE USER_ID = ?";
                    let queryParams = [client.LTID, client.UDID];

                    if (client.TYPE == 4 && client.LTID != "") {
                        queryStr = "UPDATE ACCOUNT SET USER_ID = ?, USER_TYPE = 4 WHERE USER_ID = ?";
                        queryParams = [client.LTID, client.UDID];
                    }

                    DB.query(queryStr, queryParams, function (err, result) {
                        callback(null);
                    });
                } else {
                    callback(null);
                }
            },
            function (callback) { //!< 유저 정보 조회.
                if ([1,2,3,4].indexOf(client.TYPE) > -1) client.UDID = client.LTID;
                selectDB.query("SELECT A.USER_ID, A.USER_UID, A.USER_NAME, A.USER_TYPE, A.USER_LEVEL, A.USER_EXP, DATE_FORMAT(A.LOGIN_DATE, '%Y-%m-%d %H:%i:%s') LOGIN_DATE, "
                    + "A.CHARACTER_SLOT, A.INVEN_SLOT, A.DEL_FRIEND_LIMIT, A.ADD_DUNGEON_LIMIT, A.DELEGATE_ICON, A.COMM, A.DELEGATE_MYROOM, A.MILEAGE, "
                    + "A.LOGIN_ID, A.BLOCK_FLAG, A.PICK_TIME, A.PAYMENT_DATE, A.DROP_FLAG, A.DROP_DATE, A.TUTORIAL, B.`CONFIG` `PUSH` "
                    + "FROM ACCOUNT A LEFT JOIN PUSH B ON A.USER_UID = B.USER_UID "
                    + "WHERE USER_ID = ? AND USER_TYPE = ?", [client.UDID, client.TYPE], function (err, result) {
                        if (!err) {
                            if (result.length > 0) {
                                m_Account = result[0];
                                if (common.dateDiff(m_Account.LOGIN_DATE, new Date().format("yyyy-MM-dd HH:mm:ss")) > 0)
                                    Mission.addMission(m_Account.USER_UID, 8000043, 1);

                                if (m_Account.DROP_FLAG == 0) {
                                    if (m_Account.BLOCK_FLAG == 0) {
                                        if (m_Account.LOGIN_ID != null && m_Account.LOGIN_ID != "") {
                                            //!< 이전에 접속한 사람을 쫓아낸다.
                                            var targetSocket = io.sockets.connected[m_Account.LOGIN_ID];
                                            if (targetSocket) {
                                                io.to(m_Account.LOGIN_ID).emit('EVENT_ACCOUNT_KICK', { 'result': 0 });
                                                targetSocket.disconnect();
                                            }
                                        }
                                        callback(null);
                                    } else callback(2); //!< 블럭된 계정.
                                } else {
                                    jsonData.DROP_DATE = m_Account.DROP_DATE;
                                    callback(3); //!< 탈퇴 예정 계정.
                                }
                            } else callback(1); //!< 계정정보 없음.
                        } else callback(err);
                    });
            }
        ], function (e, r) {
            cb(e, jsonData);
        });
    }
    //!< 유저의 모든 세션 정보를 Load.
    self.LoadUserSessionInfo = function () {
        async.waterfall([
            function (callback) { //!< 아이템 정보 Load.
                if (m_Account.USER_UID == undefined)
                    callback(1);

                selectDB.query('SELECT CHA_UID, CHA_ID, `EXP`, ENCHANT, DISPATCH, FARMING_ID, TEAM, MYROOM_ID '
                    + 'FROM CHARAC WHERE USER_UID = ?', [m_Account.USER_UID], function (err, result) {
                        if (!err) {
                            m_Character = result;
                        }
                        callback(err);
                    });
            },
            function (callback) { //!< 팀 정보 Load.
                selectDB.query('SELECT TEAM, CHA_UID, POSITION, SKILL FROM TEAM WHERE USER_UID = ?', [m_Account.USER_UID], function (err, result) {
                    if (!err) {
                        m_Team = result;
                    }
                    callback(err);
                });
            },
            function (callback) { //!< 스토리 Load.
                selectDB.query('SELECT STORY_ID, CLEAR, MISSION1, MISSION2, MISSION3, CNT FROM STORY WHERE USER_UID = ?', [m_Account.USER_UID], function (err, result) {
                    if (!err) {

                        m_Story = result;

                    }
                    callback(err);
                });
            },
            function (callback) { //!< 스토리 Load.
                selectDB.query('SELECT CHAPTER_ID, LEVEL, REWARD FROM CHAPTER_REWARD WHERE USER_UID = ?', [m_Account.USER_UID], function (err, result) {
                    if (!err) {
                        m_Chapter_reward = result;
                    }
                    callback(err);
                });
            },
            function (callback) { //!< item 정보 Load.
                selectDB.query("SELECT A.ITEM_UID, IFNULL(A.CHA_UID, 0) CHA_UID, A.ITEM_ID, `EXP`, ENCHANT, ITEM_COUNT, PREFIX, OPTIONS, DATE_FORMAT(CREATE_DATE, '%Y-%m-%d %H:%i:%s') CREATE_DATE, COUNT(B.MYROOM_ITEM_UID) MYROOM_ITEM_COUNT "
                    + "FROM ITEM A LEFT JOIN MYROOM_ITEM B ON A.USER_UID = B.USER_UID AND A.ITEM_UID = B.ITEM_UID "
                    + "WHERE A.USER_UID = ? "
                    + "GROUP BY A.ITEM_UID", [m_Account.USER_UID], function (err, result) {
                        if (!err) {
                            m_Item = result;
                            if (m_Item.length > 0) {
                                for (var i = 0; i < m_Item.length; i++) {
                                    Item.itemParseJson(m_Item[i]);
                                }
                            }
                        }
                        callback(err);
                    });
            },
            function (callback) { //!< item 정보 Load.
                selectDB.query("SELECT GACHA_ID, DATE_FORMAT(PICK_TIME, '%Y-%m-%d %H:%i:%s') PICK_TIME FROM GACHA "
                    + "WHERE USER_UID = ?", [m_Account.USER_UID], function (err, result) {
                        if (!err) {
                            m_Gacha = result || [];
                        }
                        callback(err);
                    });
            },
            function (callback) { //!< PVP Load.
                selectDB.query('SELECT A.*, B.USER_NAME, B.USER_LEVEL, C.CHA_ID '
                    + ' FROM PVP A LEFT JOIN ACCOUNT B ON A.USER_UID = B.USER_UID '
                    + 'LEFT JOIN CHARAC C ON B.USER_UID = C.USER_UID AND B.DELEGATE_ICON = C.CHA_UID '
                    + 'WHERE A.USER_UID = ?', [m_Account.USER_UID], function (err, result) {
                        if (!err) {
                            m_PvP = result || [];
                        }
                        callback(err);
                    });
            },
            function (callback) { //!< 파밍 정보 Load.
                selectDB.query("SELECT FARMING_ID, DATE_FORMAT(START_DATE, '%Y-%m-%d %H:%i:%s') START_DATE, DATE_FORMAT(END_DATE, '%Y-%m-%d %H:%i:%s') END_DATE, REWARD_ID "
                    + "FROM FARMING WHERE USER_UID = ?", [m_Account.USER_UID], function (err, result) {
                        if (!err) {
                            m_Farming = result || [];
                        }
                        callback(err);
                    });
            },
            function (callback) { //!< 제조 정보 Load.
                selectDB.query("SELECT MAKING_ID, TYPE, STATUS, DATE_FORMAT(PERIOD, '%Y-%m-%d %H:%i:%s') PERIOD, "
                    + "DATE_FORMAT(START_TIME, '%Y-%m-%d %H:%i:%s') START_TIME, DATE_FORMAT(END_TIME, '%Y-%m-%d %H:%i:%s') END_TIME, REWARD_ITEM_ID "
                    + "FROM MAKING WHERE USER_UID = ?", [m_Account.USER_UID], function (err, result) {
                        if (!err) {
                            m_Making = result || [];
                        }
                        callback(err);
                    });
            }
        ], function (e, r) {
            var resResult = 0;
            if(e) {
                if(e) resResult = 1;
                m_Socket.emit('ANS_ACCOUNT', { 'ATYPE': '103', 'result': resResult });
            } else {

                // 스토리 데이터(BStory.txt) 추가한 경우 유저가 Clear 한 마지막 스토리를 조회하여 다음 스테이지 데이터 생성
                let lastStoryIndexList = 
                    [CSVManager.BStoryCommon.GetData("check_last_nomal_story"), CSVManager.BStoryCommon.GetData("check_last_hard_story"), CSVManager.BStoryCommon.GetData("check_last_very_hard_story")];

                let lastStoryList = [];

                for (let i = 0; i < m_Story.length; i++) {
                    if(lastStoryIndexList.indexOf(m_Story[i].STORY_ID) > -1 && m_Story[i].CLEAR == 1)
                        lastStoryList.push(m_Story[i]);
                }

                if(lastStoryList.length > 0) {
                    let storyCSVData = CSVManager.BStory.data;
                    let openStage = [];
                    for(let i = 0; i < lastStoryList.length; i++) {
                        for (let j = 0; j < storyCSVData.length; j++) {
                            if (storyCSVData[j].open_condition == lastStoryList[i].STORY_ID) {
                                let obj = common.findObjectByKey(m_Story, "STORY_ID", storyCSVData[j].id);
                                if (obj == null) {
                                    openStage.push({
                                        STORY_ID: storyCSVData[j].id, CHAPTER: storyCSVData[j].chapter,
                                        DIFFICULTY: storyCSVData[j].difficulty
                                    });
                                }
                            }
                        }
                    }

                    if(openStage.length > 0) {
                        console.log("Stage Open : " + JSON.stringify(openStage));
                        async.each(openStage, function (obj, cb) {
                            let que = DB.query("CALL INSERT_STORY(?,?)", [m_Account.USER_UID, obj.STORY_ID], function (eErr, eRes) {
                                console.log(que.sql);
                                if (eErr) console.log(eErr);
                                m_Story.push(eRes[0][0]);
                                //addStage.push(eRes[0][0]);
                                cb(null);
                            });
                        }, function (error) {
                            if (error) {
                                if(error) resResult = 1;
                                m_Socket.emit('ANS_ACCOUNT', { 'ATYPE': '103', 'result': resResult });
                            } else {
                                console.log("self.LoadUserSessionInfo Finished...! USER_UID : " + m_Account.USER_UID + ", USER_NAME : " + m_Account.USER_NAME);
                                m_Socket.emit('ANS_ACCOUNT', { 'ATYPE': '103', 'result': resResult });
                            }
                        });
                    } else {
                        console.log("There is no Add Stage");
                        console.log("self.LoadUserSessionInfo Finished...! USER_UID : " + m_Account.USER_UID + ", USER_NAME : " + m_Account.USER_NAME);
                        m_Socket.emit('ANS_ACCOUNT', { 'ATYPE': '103', 'result': resResult });    
                    }
                } else {
                    console.log("LastStoryList Empty");
                    console.log("self.LoadUserSessionInfo Finished...! USER_UID : " + m_Account.USER_UID + ", USER_NAME : " + m_Account.USER_NAME);
                    m_Socket.emit('ANS_ACCOUNT', { 'ATYPE': '103', 'result': resResult });
                }
            }
        });
    }

    //!< Get.
    self.GetAccount = function () { return m_Account; }

    self.GetCharacters = function () { return m_Character; }
    self.GetFarming = function () { return m_Farming; }
    self.GetMaking = function () { return m_Making; }
    self.GetMyRoom = function () { return m_MyRoom; }
    self.GetItems = function () { return m_Item; }
    self.GetGacha = function () { return m_Gacha; }
    self.GetTeam = function () { return m_Team; }
    self.GetStory = function () { return m_Story; }
    self.GetChapterReward = function () { return m_Chapter_reward; }
    self.GetPvP = function () { return m_PvP; }

    self.SetMission = function (list) { m_Mission = list; }

    self.SetCharacters = function (list) { m_Character = list; }

    self.SetFarming = function (list) { m_Farming = list; }

    self.SetMaking = function (list) { m_Making = list; }

    self.SetMyRoom = function (list) { m_MyRoom = list; }

    self.SetItems = function (list) { m_Item = list; }

    self.SetTeam = function (list) { m_Team = list; }

    self.SetStory = function (list) { m_Story = list; }

    self.SetChapterReward = function (list) { m_Chapter_reward = list; }

    self.SetPvP = function (list) { m_PvP = list; }

}