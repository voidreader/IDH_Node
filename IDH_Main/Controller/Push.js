/*
 * 푸쉬 Controller
 */

module.exports.OnPacket = function (socket) {
    //!< 클라이언트 ACCOUNT 관련 요청.
    socket.on("REQ_PUSH", function (client) {
        try {
            if (client.ATYPE !== undefined) {
                var packetType = aTypeParser(client.ATYPE);

                if (packetType.cType == "0") {
                    switch (packetType.aType) {
                        default: break;
                    }
                } else if (packetType.cType == "1") {
                    switch (packetType.aType) {
                        default: break;
                    }
                } else if (packetType.cType == "2") {
                    switch (packetType.aType) {
                        case "00": updatePushConfig(socket, client); break;
                        default: break;
                    }
                }
            }
        } catch (e) { PrintError(e); }
    });

};

// 푸쉬 알림 설정 저장
function updatePushConfig(socket, client) {
    console.time("ANS_PUSH_200");
    let result = 0;
    let configStr = client.CONFIG || null;
    let acc = socket.Session.GetAccount();

    if (typeof configStr != "object") {
        result = 2;
        socket.emit('ANS_PUSH', { 'ATYPE': client.ATYPE, 'result': result });
        return;
    }
    let keyList = ['behavior', 'raid', 'pvp', 'event', 'myroom', 'night'];
    let checkFlag = true;
    for (let i = 0; i < keyList.length; i++) {
        if (configStr.hasOwnProperty(keyList[i]) == false) {
            checkFlag = false;
            break;
        }
    }

    if (!checkFlag) {
        result = 2;
        socket.emit('ANS_PUSH', { 'ATYPE': client.ATYPE, 'result': result });
        return;
    }

    try { configStr = JSON.stringify(configStr); } catch (error) { PrintError(error); }
    if (configStr == 'null') {
        result = 2;
        socket.emit('ANS_PUSH', { 'ATYPE': client.ATYPE, 'result': result });
        return;
    }

    DB.query('UPDATE PUSH SET `CONFIG` = ? WHERE USER_UID = ?', [configStr, acc.USER_UID], function (error, res) {
        if (error) {
            PrintError(error);
            result = 1;
        }
        console.timeEnd("ANS_PUSH_200");
        socket.emit('ANS_PUSH', { 'ATYPE': client.ATYPE, 'result': result });
    });
}