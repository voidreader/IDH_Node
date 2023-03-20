// 채팅 Controller

module.exports.OnPacket = function (socket) {
    socket.on("REQ_CHATTING", function (client) {
        try {
            if (client.ATYPE !== undefined) {

                var packetType = aTypeParser(client.ATYPE);

                if (packetType.cType == "0") {
                    switch (packetType.aType) {
                        case "00": sendChatMessage(socket, client); break;
                        default: break;
                    }
                } else if (packetType.cType == "1") {
                    switch (packetType.aType) {
                        case "00": getFilterText(socket, client); break;
                        case "01": break;
                        case "02": break;
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
}

// 채팅 메세지 Broadcasting
function sendChatMessage(socket, client) {
    console.time("ANS_CHATTING_000");
    try {
        var acc = socket.Session.GetAccount();
        var character = socket.Session.GetCharacters();
        var characterObj = common.findObjectByKey(character, "CHA_UID", acc.DELEGATE_ICON) || {};

        if (client.MESSAGE == undefined || client.MESSAGE == "") {
            socket.emit('ANS_CHATTING', { 'ATYPE': client.ATYPE, 'result': 1 });
            return;
        }
        var obj = { 'ATYPE': client.ATYPE, 'USER_NAME': acc.USER_NAME, 'CHA_ID': characterObj.CHA_ID, 'MESSAGE': client.MESSAGE };
        io.sockets.emit('ANS_CHATTING', obj);
        console.timeEnd("ANS_CHATTING_000");
    } catch (e) { PrintError(e); }
}

// 채팅 필터 데이터 조회
function getFilterText(socket, client) {
    selectDB.query("SELECT * FROM CONFIG WHERE TYPE = 1", (error, result) => {
        if (error) {
            result = 1;
            socket.emit('ANS_GACHA', { 'ATYPE': client.ATYPE, 'result': result });
            return;
        }
        socket.emit("ANS_CHATTING", { ATYPE: client.ATYPE, FILTER: result[0].FILTER });
    });
}

// 캐릭터, 아이템 SSS등급 획득 시 Broadcasting
exports.SendRareItemAcquisitionMessage = (socket, acquisitionRareList) => {
    io.sockets.emit('ANS_CHATTING', { ATYPE: '001', MSG: acquisitionRareList });
}