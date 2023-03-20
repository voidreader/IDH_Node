/**
 * 핫 타임 Controller
 */

 // 핫 타임 데이터 조회
exports.GetHotTime = (callback) => {
    selectDB.query("SELECT `TYPE`, `VALUE`, DATE_FORMAT(START_TIME,'%Y-%m-%d %T') START_TIME, DATE_FORMAT(END_TIME,'%Y-%m-%d %T') END_TIME FROM HOTTIME "
        + "WHERE START_TIME <= NOW() AND END_TIME >= NOW() AND `ENABLE` = 1", (error, result) => {
        let hotTimeList = [];
        if(error) {
            logging.error(error);
        } else {
            hotTimeList = result;
        }
        callback(hotTimeList);
    });
}