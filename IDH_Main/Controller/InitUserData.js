/**
 * 유저 데이터 조회 Controller
 */

module.exports.OnPacket = function (socket) {
    socket.on("REQ_INITDATA", function (client) {
        try {
            if (client.ATYPE !== undefined) {
                var packetType = aTypeParser(client.ATYPE);

                if (packetType.cType == "0") {
                    switch (packetType.aType) {
                        default: break;
                    }
                } else if (packetType.cType == "1") {
                    switch (packetType.aType) {
                        case "00": getUserData(socket, client); break;
                        default: break;
                    }
                } else if (packetType.cType == "2") {
                    switch (packetType.aType) {
                        default: break;
                    }
                } else if (packetType.cType == "3") {
                    switch (packetType.aType) {
                        default: break;
                    }
                } else {

                }
            }
        } catch (e) { PrintError(e); }
    });
}

function getUserData(socket, client) {
    console.time("ANS_INITDATA_100");
    let tempList = [];

    switch(client.TYPE) {
        case 0: tempList = socket.Session.GetCharacters(); break;
        case 1: tempList = socket.Session.GetFarming(); break;
        case 2: tempList = socket.Session.GetMyRoom(); break;
        case 3: tempList = socket.Session.GetItems(); break;
        case 4: tempList = socket.Session.GetGacha(); break;
        case 5: tempList = socket.Session.GetTeam(); break;
        case 6: tempList = socket.Session.GetStory(); break;
        case 7: tempList = socket.Session.GetChapterReward(); break;
        case 8: tempList = socket.Session.GetPvP(); break;
    }
    console.timeEnd("ANS_INITDATA_100");
    socket.emit('ANS_INITDATA', { 'ATYPE': client.ATYPE, 'result': 0, TYPE: client.TYPE, LIST: tempList });
}
