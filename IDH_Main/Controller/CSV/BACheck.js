/**
 * 출석체크
 */

var csvData = [];

module.exports.data = csvData;
module.exports.Load = function (fs) {

    //!< 동기 사용.
    var data = fs.readFileSync(process.cwd() + '/Resources/CSV/BACheck.txt', 'utf8');
    if (data != null) {
        var row = data.split('\r\n');
        var col;

        var temp;
        //!< Row Parse.
        for (var idx = 0; idx < row.length; idx++) {
            //!< Column Parse.
            col = row[idx].split(',');
            temp = {
                id: Number(col[0]),     // UniqueID
                start_date: col[6],     // 출석 체크 시작일
                end_date: col[7]        // 출석 체크 종료일
            };
            csvData.push(temp);
        }
    }
}

//해당 일에 맞는 출석 데이터 조회
module.exports.GetData = function () {
    let aCheckList = [];
    let now = new Date();
    for (var i = 0; i < csvData.length; i++) {

        let sDate = new Date(csvData[i].start_date);
        let eDate = new Date(csvData[i].end_date);
        eDate.setDate(eDate.getDate() + 1);
        if(sDate <= now && now <= eDate) {
            aCheckList.push(csvData[i]);
        }
    }
    return aCheckList;
}

// 해당 일이 포함되는 출석체크 데이터 조회
module.exports.GetID = function () {
    let aCheckList = [];
    let now = new Date();
    now.setHours(now.getHours() + 9);

    for (var i = 0; i < csvData.length; i++) {

        let sDate = new Date(csvData[i].start_date);
        let eDate = new Date(csvData[i].end_date);
        eDate.setDate(eDate.getDate() + 1);
        if(sDate <= now && now <= eDate) {
            aCheckList.push(csvData[i].id);
        }
    }
    return aCheckList;
}