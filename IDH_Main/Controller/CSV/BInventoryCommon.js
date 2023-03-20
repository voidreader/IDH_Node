/**
 * 인벤토리 Common
 * /Project/Document/Table/Common/IDH_Common_180501.xlsm BInventoryCommon Tab 참고
 */

var csvData = [];

module.exports.data = csvData;
module.exports.Load = function (fs) {

    //!< 동기 사용.
    var data = fs.readFileSync(process.cwd() + '/Resources/CSV/BInventoryCommon.txt', 'utf8');
    if (data != null) {
        var row = data.split('\r\n');
        var col;

        var temp;

        //!< Row Parse.
        for (var i = 0; i < row.length; i++) {
            //!< Column Parse.
            col = row[i].split(',');
            temp = {
                default_invent_slot_count: Number(col[0]),
                expand_invent_cash1: Number(col[1]),
                expand_invent_slot1: Number(col[2]),
                expand_invent_cash2: Number(col[3]),
                expand_invent_slot2: Number(col[4]),
                expand_invent_cash3: Number(col[5]),
                expand_invent_slot3: Number(col[6]),
                expand_invent_cash4: Number(col[7]),
                expand_invent_slot4: Number(col[8]),
                expand_invent_cash5: Number(col[9]),
                expand_invent_slot5: Number(col[10]),
                expand_invent_cash6: Number(col[11]),
                expand_invent_slot6: Number(col[12]),
                expand_invent_cash7: Number(col[13]),
                expand_invent_slot7: Number(col[14]),
                expand_invent_cash8: Number(col[15]),
                expand_invent_slot8: Number(col[16]),
                expand_invent_cash9: Number(col[17]),
                expand_invent_slot9: Number(col[18]),
                expand_invent_cash10: Number(col[19]),
                expand_invent_slot10: Number(col[20])
            };
            csvData.push(temp);
        }
    }
}

module.exports.GetData = function (key) {
    return csvData[0][key];
}
