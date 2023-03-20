var conf = require("./package.json");
var cluster = require("cluster");

var numCPUs = require("os").cpus().length;

var PORTNO = conf.server.port;

process.on('uncaughtException', function (err) {
    console.log("unhandled exception : " + err + "\n" + err.stack);
});

var mysql = require("mysql");
var ioRedis = require('socket.io-redis');

// global 선언으로 전역에서 사용 할 수 있도록 해당 파일 캐싱

global.Redis = require('redis');
global.async = require("async");

global.sf = require("sf");

global.common = require("./common");

global.Utils = require("./Controller/Common/Utils");
global.DefineItem = require("./Controller/Common/DefineItem");
global.SessionManager = require("./Controller/SessionManager");
global.Account = require("./Controller/account");
global.Character = require("./Controller/Character");
global.Farming = require("./Controller/Farming");
global.Chatting = require("./Controller/Chatting");
global.Item = require("./Controller/Item");
global.MyRoom = require("./Controller/MyRoom");
global.Gacha = require("./Controller/Gacha");
global.Friend = require("./Controller/Friend");
global.Pvp = require("./Controller/Pvp");
global.Story = require("./Controller/Story");
global.Making = require("./Controller/Making");
global.Mail = require("./Controller/Mail");
global.DailyDungeon = require("./Controller/DailyDungeon");
global.Raid = require("./Controller/Raid");
global.Mission = require("./Controller/Mission");
global.Notification = require("./Controller/Notification");
global.Shop = require("./Controller/Shop");
global.Attendance = require("./Controller/Attendance");
global.Purchase = require("./Controller/Purchase");
global.Push = require("./Controller/Push");
global.InitUserData = require("./Controller/InitUserData");
global.HotTime = require("./Controller/HotTime");
global.Book = require("./Controller/Book");

global.CSVManager = require("./Controller/CSVManager");
global.config = conf;
global.verifyData = common.verifyData;
global.verifyJSONData = common.verifyJSONData;
global.aTypeParser = common.aTypeParser;

global.logging = require('./logging');


const Event = require('./Controller/Event');

async.waterfall([
    function (callback) { //!< 서버 설정.
        // 기본 데이터 파일 캐싱
        logging.info('Init CSV Manager Start....');
        CSVManager.Initialize();
        callback(null);
    }
], function (err, result) { //!< 서버 시작.

    logging.info('Clusters now begin to start!');

    if (err) {
        logging.info('Error during Server Begin :: ' + err);
        return;
    }


    // Node Cluster 방식으로 해당 서버 프로세스 갯수 별로 인스턴스 생성
    if (cluster.isMaster) {
        logging.info("Master cluster setting up " + numCPUs + " workers...");
        for (var idx = 0; idx < numCPUs; idx++) {
            cluster.fork();
        }
        cluster.on("online", function (worker) {
            logging.info("Worker " + worker.process.pid + " is online");
        });
        cluster.on("exit", function (worker, code, signal) {
            logging.error("Worker " + worker.process.pid + " died with code: " + code + ", and signal: " + signal);
            cluster.fork();
        });
    } else {

        // fork 
        // Express 설정 
        var app = require("express")();
        app.set('port', process.env.PORT || PORTNO);

        // http 및 socket 서버 생성
        var http = require("http").Server(app);
        global.io = require("socket.io")(http);


        // Database 연결
        global.DB = mysql.createPool(config.db);
        global.selectDB = mysql.createPool(config.selectDB);
        global.logDB = mysql.createPool(config.logDB);
        global.logSelectDB = mysql.createPool(config.logSelectDB);

        // 상점 데이터 로드
        Shop.SetShopList();

        // 서버로 접근하는 http 요청에 대한 필터 기능
        function checkRequest(req, res, next) {
            const ip = req.headers['x-forwarded-for'] || req.connection.remoteAddress;

            console.log("CheckRequest [" + ip + "] " + req.method + " " + req.url);
            let tempUrlList = req.url.split("?");

            let urlList = ["/stainScheduler", "/midnightScheduler", "/seasonOffScheduler", "/dailyMissionResetScheduler", "/statusScheduler",
                "/weeklyMissionResetScheduler", "/dungeonScheduler", "/raidScheduler", "/raidDeleteScheduler", "/realtimeScheduler", "/NotifyInspection",
                //"/eventEnchant", "/eventPerl", "/eventStory", "/eventMaking", // 이벤트 라인
                "/HeartBeat", "/checkServerStatus", "/saveShopData", "/NotifyHotTime", "/NotifyNotice"];

            if (urlList.indexOf(req.url) > -1 || tempUrlList[0] == "/Coupon" || tempUrlList[0] == "/Purchase" || tempUrlList[0] == "/kickUser" || tempUrlList[0] == "/createCharacter") {
                next();
            } else {
                console.log("Unauthorised URL : " + req.url);
                return;
            }
        } // end of checkRequest

        // listen 시작!
        http.listen(app.get('port'), function () {

            logging.info("Server started - port : " + app.get('port'));

            app.get("/*", checkRequest);
            app.post("/*", checkRequest);

            // 게임 이벤트 종류 별 함수 (점검 시 이벤트 보상 지급)
            app.get("/eventEnchant", Event.EventItemEnchant);
            app.get("/eventPerl", Event.EventPerl);
            app.get("/eventStory", Event.EventStory);
            app.get("/eventMaking", Event.EventMaking);



            /**
             * 게임 내 정기적으로 업데이트 되는 API
             * IDHScheduler 로 부터 http 요청을 받아 실행
             */

            // 자동 먼지 생성
            app.get("/stainScheduler", function (req, res) {
                console.time("ANS_stainScheduler");
                try {
                    logging.info('[SCHEDULE] StainScheduler');
                    DB.query('CALL INSERT_STAIN(?)', [CSVManager.BMyRoomCommon.data[0].stain_probability / 100], function (aErr, aRes) {
                        console.timeEnd("ANS_stainScheduler");
                        if (aErr) {
                            logging.error("[SCHEDULE] StainScheduler Fail");
                            res.send("Fail");
                        } else {
                            logging.info("[SCHEDULE] StainScheduler Success");
                            res.send("Success");
                        }
                    });
                } catch (e) { PrintError(e); }
            });

            // 자정 시간 실행 - 친구 삭제 제한, 요일 던전 추가 가능 제한
            app.get("/midnightScheduler", function (req, res) {
                // console.time("ANS_midnightScheduler");
                logging.info('[SCHEDULE] midnightScheduler');

                async.parallel([
                    (callback) => {
                        DB.query("CALL MIDNIGHT(?,?)",
                            [CSVManager.BFriendsCommon.GetData("max_delete_count"), CSVManager.BDDungeonCommon.GetData("dungeon_add_count")], callback);
                    }, (callback) => {
                        Shop.ProvideDailyReward();
                        callback(null, null);
                    }
                ], (error, result) => {
                    // console.timeEnd("ANS_midnightScheduler");
                    if (error) {
                        logging.error("[SCHEDULE] MidnightScheduler Fail");
                        
                        res.send("Fail");
                    } else {
                        logging.info("[SCHEDULE] MidnightScheduler Success");
                        res.send("Success");
                    }
                });
            });

            // PVP 순위 재조정
            app.get("/seasonOffScheduler", function (req, res) {
                logging.info('SeasonOffScheduler');
                Pvp.rearrangeGrade();
            });

            // 일일 미션 리셋
            app.get("/dailyMissionResetScheduler", function (req, res) {
                console.time("ANS_dailyMissionResetScheduler");
                logging.info('DailyMissionResetScheduler');
                try {
                    DB.query("UPDATE MISSION SET VALUE = 0, REWARD = 0 WHERE LEFT(MISSION_UID, 2) = 81 OR MISSION_UID = 8500001", function (aErr, aRes) {
                        console.timeEnd("ANS_dailyMissionResetScheduler");
                        if (aErr) {
                            logging.error("DailyMissionResetScheduler Fail");
                            
                            res.send("Fail");
                        } else {
                            logging.info("DailyMissionResetScheduler Success");
                            res.send("Success");
                        }
                    });
                } catch (e) { PrintError(e); }
            });

            // 주간 미션 리셋
            app.get("/weeklyMissionResetScheduler", function (req, res) {
                console.time("ANS_weeklyMissionResetScheduler");
                logging.info('WeeklyMissionResetScheduler');

                try {
                    DB.query("UPDATE MISSION SET VALUE = 0, REWARD = 0 WHERE LEFT(MISSION_UID, 2) = 82 OR MISSION_UID = 8500002", function (aErr, aRes) {
                        console.timeEnd("ANS_weeklyMissionResetScheduler");
                        if (aErr) {
                            logging.error("WeeklyMissionResetScheduler Fail");
                            
                            res.send("Fail");
                        } else {
                            logging.info("WeeklyMissionResetScheduler Success");
                            res.send("Success");
                        }
                    });
                } catch (e) { PrintError(e); }
            });

            // 요일던전 티켓 리셋
            app.get("/dungeonScheduler", function (req, res) {
                console.time("ANS_dungeonScheduler");
                logging.info('DungeonScheduler');
                try {
                    DB.query("UPDATE ITEM SET ITEM_COUNT = ? WHERE ITEM_ID = ?",
                        [CSVManager.BDDungeonCommon.GetData('default_dungeon'), DefineItem.TICKET_DUNGEON], function (aErr, aRes) {
                            console.timeEnd("ANS_dungeonScheduler");
                            if (aErr) {
                                logging.error("DungeonScheduler Fail");
                                
                                res.send("Fail");
                            } else {
                                logging.info("DungeonScheduler Success");
                                res.send("Success");
                            }
                        });
                } catch (e) { PrintError(e); }
            });

            // 레이드 티켓 리셋 (현재 레이드 컨텐츠 없음)
            app.get("/raidScheduler", function (req, res) {
                console.time("ANS_raidScheduler");
                logging.info('RaidScheduler');
                try {
                    DB.query("UPDATE ITEM SET ITEM_COUNT = ? WHERE ITEM_ID = ?",
                        [CSVManager.BPvECommon.GetData('default_raid'), DefineItem.TICKET_RAID], function (aErr, aRes) {
                            console.timeEnd("ANS_raidScheduler");
                            if (aErr) {
                                logging.error("RaidScheduler Fail");
                                PrintError(aErr);
                                res.send("Fail");
                            } else {
                                logging.info("RaidScheduler Success");
                                res.send("Success");
                            }
                        });
                } catch (e) { PrintError(e); }
            });

            // 레이드 데이터 초기화 (현재 레이드 컨텐츠 없음)
            app.get("/raidDeleteScheduler", function (req, res) {
                console.time("ANS_raidDeleteScheduler");
                logging.info('RaidDeleteScheduler');
                try {
                    Raid.SendRaidReward(function (err) {
                        if (err)
                            PrintError(err);
                        // 레이드 데이터 삭제
                        DB.query("DELETE FROM RAID", function (aErr, aRes) {
                            console.timeEnd("ANS_raidDeleteScheduler");
                            if (aErr) {
                                logging.error("RaidDeleteScheduler Fail");
                                PrintError(aErr);
                                res.send("Fail");
                            } else {
                                logging.info("RaidDeleteScheduler Success");
                                res.send("Success");
                            }
                        });
                    });
                } catch (e) { PrintError(e); }
            });

            /**
             * 게임 내 정기적으로 업데이트 되는 API 종료
             */


            /**
             * 운영툴 관련 API
             */

            // 가입자, 동접 및 유저 관련 수치 저장(일별)
            app.get("/statusScheduler", (req, res) => {
                selectDB.query("SELECT SUM(IF(LOGIN_ID = '', 0, 1)) MAX_CLIENT, "
                    + "SUM(IF(DATE_FORMAT(CREATE_DATE, '%Y-%m-%d %H:%i') = DATE_FORMAT(NOW(), '%Y-%m-%d %H:%i'), 1, 0)) NEW_SUBSCRIBER "
                    + "FROM ACCOUNT", (error, result) => {
                        if (error) {
                            res.json({ result: "error" });
                        } else {
                            async.parallel([
                                (callback) => {
                                    logDB.query("UPDATE DAILY_MAX_USER SET `MAX` = IF(`MAX` < ?, ?, `MAX`) WHERE `DATE` =  DATE_FORMAT(NOW(), '%Y-%m-%d')",
                                        [result[0].MAX_CLIENT, result[0].MAX_CLIENT], (error, result) => {
                                            callback(error, result);
                                        });
                                }, (callback) => {
                                    logDB.query("UPDATE ACTIVE_USER SET `COUNT` = IF(`COUNT` < ?, ?, `COUNT`), `NEW` = IF(`NEW` < ?, ?, `NEW`)  WHERE DATE_FORMAT(`DATETIME`, '%Y-%m-%d %H:%i') =  DATE_FORMAT(NOW(), '%Y-%m-%d %H:%i')",
                                        [result[0].MAX_CLIENT, result[0].MAX_CLIENT, result[0].NEW_SUBSCRIBER, result[0].NEW_SUBSCRIBER], (error, result) => {
                                            callback(error, result);
                                        });
                                }
                            ], (error, result) => {
                                if (error) {
                                    PrintError(error);
                                    res.json({ result: "error" });
                                } else {
                                    res.json({ result: "sucess" });
                                }
                            });
                        }
                    });
            });

            // 가입자, 동접 및 유저 관련 수치 저장(분 단위)
            app.get("/realtimeScheduler", function (req, res) {
                let status = { socketClientCount: 0, DBFreeConnections: 0, AllConnections: 0, AcquiringConnections: 0 };
                status.socketClientCount = io.sockets.server.eio.clientsCount;
                status.DBFreeConnections = DB._freeConnections.length;
                status.AllConnections = DB._allConnections.length;
                status.AcquiringConnections = DB._acquiringConnections.length;

                logging.info("[realtimeScheduler] - " + JSON.stringify(status));

                selectDB.query("SELECT COUNT( IF( DATE_FORMAT(`LOGIN_DATE`, '%Y-%m-%d') = DATE_FORMAT(NOW(), '%Y-%m-%d'), USER_UID, NULL)) DAU, "
                    + "COUNT( IF( DATE_FORMAT(`CREATE_DATE`, '%Y-%m-%d') = DATE_FORMAT(NOW(), '%Y-%m-%d'), USER_UID, NULL)) NEW "
                    + "FROM ACCOUNT", (error, result) => {
                        if (error) {
                            PrintError(error);
                            res.json(status);
                        } else {
                            if (result.length > 0) {
                                logDB.query("CALL ACTIVE_USER_LOGGING(?,?)", [result[0].DAU, result[0].NEW], (error, result) => {
                                    if (error) {
                                        PrintError(error);
                                    }
                                    res.json(status);
                                });
                            }
                        }
                    });

            });

            // 게임 내 점검 기능
            app.get("/NotifyInspection", (req, res) => {

                logSelectDB.query("SELECT TITLE, MSG, DATE_FORMAT(START_DATE,'%Y-%m-%d %T') START_DATE, DATE_FORMAT(END_DATE,'%Y-%m-%d %T') END_DATE, ACTIVE FROM INSPECTION", (error, result) => {
                    let resResult = 0;
                    if (error) {
                        PrintError(error);
                        resResult = 1;
                    } else {
                        if (result.length > 0) {
                            io.emit('ANS_NOTIFY', { ATYPE: '104', INSPECTION: result[0] });
                        }
                    }
                    res.json({ result: resResult });
                });
            });

            // 핫 타임 기능
            app.get("/NotifyHotTime", (req, res) => {
                console.log("NotifyHotTime");
                HotTime.GetHotTime((result) => {
                    for (let i = 0; i < result.length; i++) {
                        switch (result[i].TYPE) {
                            case 1: result[i].DESC = "스토리 경험치 획득 증가"; break;
                            case 2: result[i].DESC = "스토리 골드 획득 증가"; break;
                            case 3: result[i].DESC = "스토리 행동력 소모량 감소"; break;
                            case 4: result[i].DESC = "파밍 코인 획득량 증가"; break;
                        }
                    }
                    io.emit('ANS_NOTIFY', { ATYPE: '105', HOTTIME: result });
                    res.json({ result: 0 });
                });
            });

            // 공지사항 기능
            app.get("/NotifyNotice", (req, res) => {
                console.log("NotifyNotice");
                logSelectDB.query("SELECT `TYPE`, `CONTENT`, DATE_FORMAT(START_TIME, '%Y-%m-%d %T') START_TIME, "
                    + "DATE_FORMAT(END_TIME, '%Y-%m-%d %T') END_TIME, `INTERVAL`, `ACTIVE` FROM NOTICE", (error, result) => {
                        if (error) {
                            console.log("NotifyNotice Error : " + error);
                            res.json({ result: 1 });
                        } else {
                            io.emit('ANS_NOTIFY', { ATYPE: '106', NOTICE: result });
                            res.json({ result: 0 });
                        }
                    });
            });

            // 서버 상태 확인 기능
            app.get("/HeartBeat", (req, res) => {
                selectDB.query("SELECT TYPE FROM CONFIG LIMIT 0, 1", (error, result) => {
                    let resObj = { result: 0, data: [] };
                    if (error) {
                        PrintError(error);
                        resObj.result = 1;
                    } else {
                        console.log("HeartBeat");
                        resObj.data = result;
                    }
                    res.json(resObj);
                });
            });

            // 해당 유저 강제 로그아웃 기능
            app.get("/kickUser", (req, res) => {
                console.log("kickUser : " + JSON.stringify(req.query));
                let userName = req.query.UN || '';

                let resResult = { result: 0 };
                if (userName == '') {
                    resResult.result = 1;
                    res.json(resResult);
                    return;
                }
                selectDB.query("SELECT LOGIN_ID FROM ACCOUNT WHERE USER_NAME = ?", [userName], (error, result) => {
                    if (error) resResult.result = 1;
                    if (result.length > 0) {
                        if (result[0].LOGIN_ID != '') {
                            io.to(result[0].LOGIN_ID).emit('EVENT_ACCOUNT_KICK', { 'result': 0 });
                        } else {
                            resResult.result = 3;
                        }

                    } else resResult.result = 2;

                    res.json(resResult);
                });
            });

            /**
             * 운영툴 관련 API 종료
             */


            /**
             * 게임팟 관련 API
             */

            // 결제 정보(클라이언트 결제 시 게임팟 서버에서 결제 종료 후 호출)
            app.get("/Purchase", function (req, res) {
                console.log("PURCHASE : " + req.query);
                Shop.CompletePurchase(req, res);
            });

            // 쿠폰 정보(클라이언트 쿠폰 사용 시 게임팟 서버에서 호출)
            app.get("/Coupon", function (req, res) {
                console.log("COUPON : " + JSON.stringify(req.query));
                Purchase.CompleteCoupon(req, res);
            });

            /**
             * 게임팟 관련 API 종료
             */

            // 상점 데이터는 DB에서 관리 상점 데이터 변경 시 Resource/CSV 경로에 파일 적용 후 http 요청으로 호출
            // * 서버 실행 시 로드하므로 http 요청 후 서버 재시작 해야 적용 됨.
            app.get("/saveShopData", (req, res) => {
                CSVManager.BShopPackage.SaveShopPackage();
                CSVManager.BShopPackageInfo.SaveShopPackageInfo();
                CSVManager.BShopItemSkin.SaveShopItemSkin();
                res.json(null);
            });


            // 테스트용 API (http 요청으로 해당 USER_UID와 캐릭터 INDEX번호를 보내면 캐릭터 생성)
            // * 진화단계에 맞는 INDEX번호를 입력해야 함 Project/Document/Table/Character/IDH_Character_191211.xlsm 파일 내 하늘색 표기 참고
            /*
            app.get("/createCharacter", function (req, res) {
                logging.info('createCharacter');
                //http://127.0.0.1:4000/createCharacter?USER_UID=128I&CHALIST=[1000432,1000145]
                let userUid = req.query.USER_UID;
                let chaList = req.query.CHALIST || [];
                console.log(req.query);
                try{
                    chaList = JSON.parse(chaList);
                } catch(e) {
                    chaList = [];
                    console.log(e);
                }
                if(chaList.length == 0){
                    res.send("Fail");
                } else {
                    console.log("Start");
                    async.eachSeries(chaList, function (id, ecb) {
                        DB.query("CALL INSERT_CHARACTER(?,?,?,?)", [userUid, id, Character.getCharacterExp(id), 0], function (error, result) {
                        if (error) {
                            
                            ecb(error);
                        } else {
                            //if (id == 1000002) delegate_icon = result[0][0].CHA_UID;
                            ecb(null);
                        }
                        });
                    }, function (err) {
                        if (err) res.send("Fail");
                        else res.send("Success");
                    });
                }
            });*/

            // 서버 상태 확인용 API
            app.get("/checkServerStatus", function (req, res) {
                console.log("PID : " + process.pid);
                let status = {};
                status.socketClientCount = io.sockets.server.eio.clientsCount;
                status.DBFreeConnections = DB._freeConnections.length;
                status.AllConnections = DB._allConnections.length;
                status.AcquiringConnections = DB._acquiringConnections.length;
                logging.info("[checkServerStatus : status] - " + JSON.stringify(status));
                let selectDBStatus = {};
                selectDBStatus.socketClientCount = io.sockets.server.eio.clientsCount;
                selectDBStatus.DBFreeConnections = selectDB._freeConnections.length;
                selectDBStatus.AllConnections = selectDB._allConnections.length;
                selectDBStatus.AcquiringConnections = selectDB._acquiringConnections.length;
                logging.info("[checkServerStatus : selectDBStatus] - " + JSON.stringify(status));
                res.json({ db: status, selectDB: selectDBStatus });
            });
        }); // HTTP Listen 종료 

        //!< socket.io redis 설정
        var redisOptions = {
            pubClient: Redis.createClient(config.redis.port, config.redis.host, { detect_buffers: true, return_buffers: false }),
            subClient: Redis.createClient(config.redis.port, config.redis.host, { return_buffers: true }),
            host: config.redis.host,
            port: config.redis.port
        };
        io.adapter(ioRedis(redisOptions));

        //!< 클라이언트 접속.
        io.on("connection", function (socket) {
            logging.info("client Connected...! - Socket ID - " + socket.id);
            var Emitter = require("events").EventEmitter;
            var emit = Emitter.prototype.emit;
            var onevent = socket.onevent;
            // 소켓 ping, pong 테스트
            /*
            socket.conn.on('packet', function (packet) {
              if (packet.type === 'ping') console.log(new Date().format("yyyy-MM-dd HH:mm:ss") + ' - received ping');
            });
            
            socket.conn.on('packetCreate', function (packet) {
              if (packet.type === 'pong') console.log(new Date().format("yyyy-MM-dd HH:mm:ss") + ' - sending pong');
            });*/


            // 소켓 연결 시 점검 데이터 조회, 현재 시간 및 패킷 암호화 키 전송
            // 암호화 된 데이터 Server_Client socket 연동 테이블 참고
            Notification.GetInspection((inspectionData) => {
                socket.emit('ANS_NOTIFY',
                    { ATYPE: '104', INSPECTION: inspectionData, DEH: "49a91b84c502f8ba", DKH: "49a91b84c502f8bab574cdb3fcb32af7", TIME: new Date().format("yyyy-MM-dd HH:mm:ss") });
            });

            // 소켓 연결 시 핫타임 데이터 조회
            HotTime.GetHotTime((result) => {
                if (result.length > 0) {
                    for (let i = 0; i < result.length; i++) {
                        switch (result[i].TYPE) {
                            case 1: result[i].DESC = "스토리 경험치 획득 증가"; break;
                            case 2: result[i].DESC = "스토리 골드 획득 증가"; break;
                            case 3: result[i].DESC = "스토리 행동력 소모량 감소"; break;
                            case 4: result[i].DESC = "파밍 코인 획득량 증가"; break;
                        }
                    }
                    socket.emit('ANS_NOTIFY', { ATYPE: '105', HOTTIME: result });
                }
            });

            socket.onevent = function (packet) {
                console.log("Socket PID : " + process.pid);
                //socket.emit : 해당 소켓 전송, 
                //io.sockets.emit : 전체 Broadcast
                //socket.broadcast.emit : 나를 제외한 Broadcast

                var flag = true;
                var packetName = packet.data[0];

                if (packet.data[1] == null) {
                    socket.disconnect();
                    return;
                }

                if (socket.Session == null) { //!< 세션이 없음.
                    if (packetName == "REQ_ACCOUNT") {
                        logging.info(packetName);
                    } else {
                        flag = false;
                        logging.info("EVENT_LOST_SESSION : " + packetName);
                        socket.emit("EVENT_LOST_SESSION");
                        socket.prevPacket = packet;
                    }
                } else {
                    if (socket.Session.GetAccount() != null)
                        logging.info("[" + socket.Session.GetAccount().USER_NAME + "] " + packetName + " : " + JSON.stringify(packet.data[1]));

                    else
                        logging.info("[ Not Found user account ] " + packetName);
                }

                if (flag) {
                    //flag true인 경우만 packet pass 시킴
                    var args = packet.data || [];
                    onevent.call(this, packet);
                    emit.apply(this, ["*"].concat(args));
                }
            } // end of socket onevent

            socket.onerror = function (error) {
                logging.error('WebSocket Error: ' + error);
            }; // end of socket onerror

            //!< 각 컨트롤러 연결.
            // 연결된 소켓 요청 시 각 Controller OnPacket 함수로 연결
            Account.OnPacket(socket);
            Character.OnPacket(socket);
            Farming.OnPacket(socket);
            Chatting.OnPacket(socket);
            Item.OnPacket(socket);
            MyRoom.OnPacket(socket);
            Gacha.OnPacket(socket);
            Friend.OnPacket(socket);
            Pvp.OnPacket(socket);
            Story.OnPacket(socket);
            Making.OnPacket(socket);
            Mail.OnPacket(socket);
            DailyDungeon.OnPacket(socket);
            Raid.OnPacket(socket);
            Mission.OnPacket(socket);
            Notification.OnPacket(socket);
            Shop.OnPacket(socket);
            Attendance.OnPacket(socket);
            Push.OnPacket(socket);
            InitUserData.OnPacket(socket);
            Book.OnPacket(socket);
            SetProcessName(io.engine.clientsCount);

            // 클라이언트 에러 로그 API
            socket.on('LOGGING', function (client) {
                let logStr = client.LOG || "";
                let userName = "Empty Session";
                if (socket.Session != null && socket.Session.GetAccount() != null)
                    userName = socket.Session.GetAccount().USER_NAME;
                logging.info("[Client Log] UserName : " + userName + ", LOG : " + logStr);
            });

            // 소켓 Reconnect 시 유저 접속 시간 및 자동 증가 아이템(PVP 티켓, 행동력) 계산하여 증가
            socket.on('REQ_CURRENT_TIME', function (client) {
                console.time("ANS_CURRENT_TIME");
                DB.getConnection((error, connection) => {
                    let acc = socket.Session.GetAccount();
                    connection.query('CALL UPDATE_ACCOUNT_LOGIN_DATE(?, ?, ?)', [acc.USER_UID, socket.id, common.dateDiff(acc.LOGIN_DATE, new Date().format("yyyy-MM-dd HH:mm:ss"))], function (err, result) {
                        if (err) PrintError(err);

                        var itemIdList = [DefineItem.TICKET_PVP, DefineItem.BEHAVIOR];
                        var resItemList = [];

                        var userItems = socket.Session.GetItems();
                        async.eachSeries(itemIdList, function (itemId, cb) {
                            var limit = 0;
                            var add_time = 0;

                            let item = null;
                            switch (itemId) {
                                case DefineItem.TICKET_PVP:
                                    limit = CSVManager.BPvPCommon.GetData("pvp_limit");
                                    add_time = CSVManager.BPvPCommon.GetData("pvp_add_time");
                                    item = common.findObjectByKey(userItems, "ITEM_ID", DefineItem.TICKET_PVP);
                                    break;
                                case DefineItem.BEHAVIOR:
                                    limit = acc.MILEAGE;
                                    add_time = CSVManager.BStaminaCommon.GetData("acting_add_time");
                                    item = common.findObjectByKey(userItems, "ITEM_ID", DefineItem.BEHAVIOR);
                                    break;
                            }
                            if (item != null) {
                                if (item.ITEM_COUNT >= limit) {
                                    cb(null);
                                } else {
                                    connection.query("CALL ADD_AUTO_ITEM(?,?,?,?)", [acc.USER_UID, itemId, limit, add_time], function (error, result) {
                                        if (error) {
                                            cb(error);
                                        } else {
                                            for (var i = 0; i < userItems.length; i++) {
                                                if (userItems[i].ITEM_ID == itemId) {
                                                    userItems[i].ITEM_COUNT = result[0][0].ITEM_COUNT;
                                                    resItemList.push(userItems[i]);
                                                }
                                            }
                                            cb(null);
                                        }
                                    });
                                }
                            } else {
                                cb(null);
                            }
                        }, (error) => {
                            if (error) PrintError(error);
                            connection.release();
                            console.timeEnd("ANS_CURRENT_TIME");
                            socket.emit("ANS_CURRENT_TIME", { "TIME": new Date().format("yyyy-MM-dd HH:mm:ss"), "ITEM_LIST": resItemList });
                        });
                    });
                });
            });

            // 디바이스 정보 저장
            socket.on('REQ_UPDATE_DEVICE', function (client) {
                console.time("ANS_UPDATE_DEVICE");
                DB.getConnection((error, connection) => {
                    let acc = socket.Session.GetAccount();
                    let resResult = 0;
                    connection.query('CALL UPDATE_DEVICE_INFO(?, ?, ?, ?, ?)', [acc.USER_UID, client.PLATFORM, client.REGID, client.MODEL, client.VERSION], function (err, result) {
                        if (err) {
                            PrintError(err);
                            resResult = 1;
                        }
                        console.timeEnd("ANS_UPDATE_DEVICE");
                        socket.emit("ANS_UPDATE_DEVICE", { result: resResult });
                    });
                });
            });

        }); // end of on connection (클라이언트 접속)
    }

});

global.SetProcessName = function (count) {
    process.title = config.server.name + " [P: " + config.server.port + "] [U: " + count + "]";
    console.log("SetProcessName : " + config.server.name + " [P: " + config.server.port + "] [U: " + count + "]");
}