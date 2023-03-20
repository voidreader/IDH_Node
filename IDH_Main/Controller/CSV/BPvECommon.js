var csvData = [];

module.exports.data = csvData;
module.exports.Load = function (fs) {

    //!< 동기 사용.
    var data = fs.readFileSync(process.cwd() + '/Resources/CSV/BPvECommon.txt', 'utf8');
    if (data != null) {
        var row = data.split('\r\n');
        var col;

        var temp;

        //!< Row Parse.
        for (var i = 0; i < row.length; i++) {
            //!< Column Parse.
            col = row[i].split(',');
            temp = {
                default_raid: Number(col[0]),
                raid_end_time: Number(col[1]),
                raid_start_time: Number(col[2]),
                raid_reset_time: Number(col[3]),
                raid_init_date: col[4],
                rank_up: Number(col[5]),
                rank_down: Number(col[6]),
                reward_limit: Number(col[7])
            };
            csvData.push(temp);
        }
    }
}

module.exports.GetData = function (key) {
    return csvData[0][key];
}
