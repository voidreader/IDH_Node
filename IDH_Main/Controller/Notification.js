/*
 * 알림 Controller
 */

module.exports.OnPacket = function (socket) {

    socket.on("REQ_NOTIFY", function (client) {
        try {
            if (client.ATYPE !== undefined) {
                var packetType = aTypeParser(client.ATYPE);

                if (packetType.cType == "0") {
                    switch (packetType.aType) {
                        case "00": break;
                        default: break;
                    }
                } else if (packetType.cType == "1") {
                    switch (packetType.aType) {
                        case "00": checkGlobalNotice(socket, client); break;
                        case "01": checkLobbyNotice(socket, client); break;
                        default: break;
                    }
                } else if (packetType.cType == "2") {
                    switch (packetType.aType) {
                        case "00": break;
                        default: break;
                    }
                } else if (packetType.cType == "3") {
                    switch (packetType.aType) {
                        case "00": break;
                        default: break;
                    }
                } else {

                }
            }
        } catch (e) { PrintError(e); }
    });
    // 친구(우정 받기 / 친구 수락 리스트 여부), 메일(신규 메일 카운트)
    function checkGlobalNotice(socket, client) {
        let acc = socket.Session.GetAccount();
        DB.query("CALL DELETE_MAIL(?,?,?)", [3, acc.USER_UID, 0], (error, result) => {
            if (error) {
                result = 1;
                socket.emit('ANS_NOTIFY', { 'ATYPE': client.ATYPE, 'result': result });
                return;
            }
            DB.query('CALL SELECT_GLOBAL_NOTICE(?)', [acc.USER_UID], (error, results) => {
                let result = 0;
                if (error) {
                    result = 1;
                    socket.emit('ANS_NOTIFY', { 'ATYPE': client.ATYPE, 'result': result });
                    return;
                }
                socket.emit('ANS_NOTIFY', { 'ATYPE': client.ATYPE, 'result': result, NOTIFY: { FCT: results[0][0].FSC + results[1][0].FRC, MCT: results[2][0].MCT } });
            });
        });
    }

    // 숙소(PVP 공격 당한 리스트 / 친구 도움 먼지), 미션(획득 가능 미션)
    function checkLobbyNotice(socket, client) {
        console.time("ANS_NOTIFY_101");
        let acc = socket.Session.GetAccount();
        selectDB.query('CALL SELECT_LOBBY_NOTICE(?)', [acc.USER_UID], (error, results) => {
            let result = 0;
            if (error) {
                result = 1;
                socket.emit('ANS_NOTIFY', { 'ATYPE': client.ATYPE, 'result': result });
                return;
            }
            console.timeEnd("ANS_NOTIFY_101");
            socket.emit('ANS_NOTIFY', { 'ATYPE': client.ATYPE, 'result': result, NOTIFY: { MRC: results[0][0].MSC } });
        });
    }
}

// 메일 생성, 유저 간 친구 요청 알림
exports.Notify = (type, userUid) => {
    selectDB.query("SELECT LOGIN_ID, USER_NAME FROM ACCOUNT WHERE USER_UID = ?", [userUid], (error, result) => {
        if (error) {
            PrintError(error);
            return;
        }

        if (result[0].LOGIN_ID == '') return;

        //console.log("SendNotification : " + ", TYPE : " + type + ", LOGIN_ID : " + result[0].LOGIN_ID + ", USER_NAME : " + result[0].USER_NAME);

        let ansPacketStr = "";
        let aType = "102";
        switch (type) {
            case "FRIEND": break;
            case "MAIL": aType = "103"; break;
        }
        io.to(result[0].LOGIN_ID).emit("ANS_NOTIFY", { 'ATYPE': aType, 'NOTIFY': true });
    });
}

// 점검 시간 조회
exports.GetInspection = (callback) => {
    //LOGDB
    logSelectDB.query("CALL SELECT_INSPECTION()", (error, result) => {
        if (error) {
            console.log(error);
            callback(null);
        } else {
            callback(result[0][0]);
        }
    });
}