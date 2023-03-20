/**
 * 출석 체크 Controller
 */

module.exports.OnPacket = function (socket) {
    socket.on("REQ_ATTENDANCE", function (client) {
        try {
            if (client.ATYPE !== undefined) {
                var packetType = aTypeParser(client.ATYPE);

                if (packetType.cType == "0") {
                    switch (packetType.aType) {
                        case "00": receiveAttendance(socket, client); break;
                        default: break;
                    }
                } else if (packetType.cType == "1") {
                    switch (packetType.aType) {
                        case "00": getAttendance(socket, client); break;
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

// 현재까지 지급된 출석 보상 리스트 조회
function getAttendance (socket, client) {

    var acc = socket.Session.GetAccount();
    var resResult = 0;
    
    //해당하는 출석체크 데이터 조회
    let aCheck = CSVManager.BACheck.GetID();
    if(aCheck.length == 0) {
        resResult = 2;
        socket.emit('ANS_ATTENDANCE', { 'ATYPE': client.ATYPE, 'result': resResult, "ATTENDANCE": [] });
        return;
    }
    
    let query = "SELECT ATTENDANCE_TYPE AT, MAX(ATTENDANCE_ID) AI, DATE_FORMAT(MAX(RECEIVE_DATE), '%Y-%m-%d') RD FROM ATTENDANCE WHERE USER_UID = ? ";
    query += "AND ATTENDANCE_TYPE IN (";
    for (let i = 0; i < aCheck.length; i++) {
        if (i != 0) query += ", ";
        query += aCheck[i];
    }
    query += ") GROUP BY ATTENDANCE_TYPE";

    selectDB.query(query, [acc.USER_UID], (error, result) => {
        let attenList = [];
        if(error) resResult = 1;
        else attenList = result;

        socket.emit('ANS_ATTENDANCE', { 'ATYPE': client.ATYPE, 'result': resResult, "ATTENDANCE": attenList });
    });
}

/**
 * 이벤트 아이디 확인
 * 해당 아이디 최근 보상지급 내역 조회
 * 이전 데이터 조회하여 보상지급 순서 확인
 * 확인 후 보상 지급
 */
function receiveAttendance (socket, client) {

    var acc = socket.Session.GetAccount();
    var resResult = 0;
    var attendanceType = client.AT || 0;

    if(attendanceType == 0) {
        //Client 요청 값 누락
        resResult = 2;
        socket.emit('ANS_ATTENDANCE', { 'ATYPE': client.ATYPE, 'result': resResult });
        return;
    }

    //해당 월만 체크해서 에러 리턴
    let aCheck = CSVManager.BACheck.GetID();
    let flag = false;
    for (let i = 0; i < aCheck.length; i++) {
        if(aCheck[i] == attendanceType) flag = true;
    }

    if(!flag) {
        resResult = 5;
        socket.emit('ANS_ATTENDANCE', { 'ATYPE': client.ATYPE, 'result': resResult, "ATTENDANCE": [] });
        return;
    }

    selectDB.query("SELECT ATTENDANCE_TYPE, MAX(ATTENDANCE_ID) ATTENDANCE_ID,  DATE_FORMAT(MAX(RECEIVE_DATE), '%Y-%m-%d') RECEIVE_DATE "
        + "FROM ATTENDANCE "
        + "WHERE USER_UID = ? AND ATTENDANCE_TYPE = ? GROUP BY ATTENDANCE_TYPE", [acc.USER_UID, attendanceType], (error, result) => {
        let attenList = [];
        let attendanceCSVObj = null;

        if(error) resResult = 1;
        else {
            if(result.length > 0) {
                let attendanceObj = result[0];
                let day = common.dateDiff(attendanceObj.RECEIVE_DATE, new Date());
                if(day == 0) resResult = 3; // 이미 보상 지급 함.
                else {
                    attendanceCSVObj = CSVManager.BAttendance.GetData(attendanceObj.ATTENDANCE_TYPE, attendanceObj.ATTENDANCE_ID + 1);
                    if(attendanceCSVObj == null) resResult = 4; // 마지막 보상
                } 

            } else {
                // 최초 지급
                let attendanceList = CSVManager.BAttendance.GetDataListByType(attendanceType);
                if(attendanceList.length > 0)
                    attendanceCSVObj = attendanceList[0];
            }
            if(attendanceCSVObj != null) {
                DB.query("INSERT INTO `idh`.`attendance` (`USER_UID`, `ATTENDANCE_TYPE`, `ATTENDANCE_ID`) VALUES (?, ?, ?)"
                    , [acc.USER_UID, attendanceType, attendanceCSVObj.reward_id], (error, result) => {
                        if(error) {
                            resResult = 1;
                            socket.emit('ANS_ATTENDANCE', { 'ATYPE': client.ATYPE, 'result': resResult, "ATTENDANCE": null, "REWARD": attenList });
                        } else {
                            let mailList = [{ 
                                REWARD_ITEM_ID: attendanceCSVObj.reward_item_id, 
                                REWARD_ITEM_COUNT: attendanceCSVObj.reward_item_value, 
                                REWARD_DESC: attendanceCSVObj.reward_mail_string
                            }];
                            attenList.push({ REWARD_ITEM_ID: mailList[0].REWARD_ITEM_ID, REWARD_ITEM_COUNT: mailList[0].REWARD_ITEM_COUNT });
                            Item.SetItemType(mailList);
                            Mail.PushMail(acc.USER_UID, 15, mailList[0].ITEM_TYPE, mailList[0].REWARD_ITEM_ID, mailList[0].REWARD_ITEM_COUNT, 0,
                                mailList[0].REWARD_DESC, CSVManager.BMailString.GetData(15).limit, (mErr, mRes) => { });

                            socket.emit('ANS_ATTENDANCE', 
                                { 'ATYPE': client.ATYPE, 'result': resResult, "ATTENDANCE": { AT: attendanceType, AI: attendanceCSVObj.reward_id } });
                        }
                    });
            } else {
                socket.emit('ANS_ATTENDANCE', { 'ATYPE': client.ATYPE, 'result': resResult, "ATTENDANCE": null });
            }
        }
    });
}