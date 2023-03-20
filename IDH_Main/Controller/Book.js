/**
 * 도감 Controller
 * 현재 컨텐츠 개발이 되지 않아 로그만 저장 중
 */

module.exports.OnPacket = function (socket) {
    socket.on("REQ_BOOK", function (client) {
        try {
            if (client.ATYPE !== undefined) {

                var packetType = aTypeParser(client.ATYPE);

                if (packetType.cType == "0") {
                    switch (packetType.aType) {
                        default: break;
                    }
                } else if (packetType.cType == "1") {
                    switch (packetType.aType) {
                        case "00": getBook(socket, client); break;
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
};

exports.saveBook = (type, userUid, list) => {
    async.eachSeries(list, (obj, callback) => {
        let sort = 0;
        if (type == 99) {
            sort = CSVManager.BCharacter.GetData(obj.REWARD_ITEM_ID).sort;
        } else {
            sort = obj.REWARD_ITEM_ID;
        }

        if(sort == -1) {
            callback(null);
        } else {
            DB.query("INSERT INTO BOOK (USER_UID, `ID`, LATEST_DATE) VALUES (?, ?, NOW()) "
                + "ON DUPLICATE KEY UPDATE LATEST_DATE = VALUES(LATEST_DATE) ", [userUid, sort], (error, result) => {
                if(error) console.log(error);
                callback(null);
            });
        }
    });
}

function getBook (socket, client) {
    let acc = socket.Session.GetAccount();
    let jsonData = {result: 0, ATYPE: client.ATYPE, BOOK: []};

    selectDB.query("SELECT ID, DATE_FORMAT(ENROLLMENT_DATE, '%Y-%m-%d %T') CREATE_DATE, DATE_FORMAT(LATEST_DATE, '%Y-%m-%d %T') LATEST_DATE "
        + "FROM BOOK WHERE USER_UID = ?", [acc.USER_UID], (error, result) => {
        if(error) {
            console.log(error);
            jsonData.result = 1;
            socket.emit("ANS_BOOK", jsonData);
        } else {
            for (let i = 0; i < result.length; i++) {
                if(result[i].ID.toString().substr(0,2) == "11") {
                    result[i].TYPE = 99;
                } else if (result[i].ID.toString().substr(0,2) == "36") {
                    result[i].TYPE = 5;
                } else {
                    result[i].TYPE = 0;
                }
            }
            jsonData.BOOK = result;
            socket.emit("ANS_BOOK", jsonData);
        }
    });
}