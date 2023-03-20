/**
 * 레이드 Common (사용 안함)
 */

var csvData = [];

module.exports.data = csvData;
module.exports.Load = function (fs) {

    //!< 동기 사용.
    var data = fs.readFileSync(process.cwd() + '/Resources/CSV/BRaid.txt', 'utf8');
    if (data != null) {
        var row = data.split('\r\n');
        var col;

        var temp;
        //!< Row Parse.
        for (var idx = 0; idx < row.length; idx++) {
            //!< Column Parse.
            col = row[idx].split(',');
            temp = {
                id: Number(col[0]),
                group: Number(col[1]),
                difficulty: Number(col[2]),
                boss_id: Number(col[3]),
                stage_name: col[4],
                power_recommand: Number(col[5]),
                accum_dmg1: Number(col[6]),
                accum_rwd1: Number(col[7]),
                accum_rwd1_val: Number(col[8]),
                accum_dmg2: Number(col[9]),
                accum_rwd2: Number(col[10]),
                accum_rwd2_val: Number(col[11]),
                accum_dmg3: Number(col[12]),
                accum_rwd3: Number(col[13]),
                accum_rwd3_val: Number(col[14]),
                accum_dmg4: Number(col[15]),
                accum_rwd4: Number(col[16]),
                accum_rwd4_val: Number(col[17]),
                reward: Number(col[18])
            };
            csvData.push(temp);
        }
    }
}

module.exports.GetData = function (id) {
    for (var i = 0; i < csvData.length; i++)
        if (csvData[i].id == id)
            return csvData[i];
    return null;
}