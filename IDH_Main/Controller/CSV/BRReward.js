var csvData = [];

module.exports.data = csvData;
module.exports.Load = function (fs) {

    //!< 동기 사용.
    var data = fs.readFileSync(process.cwd() + '/Resources/CSV/BRReward.txt', 'utf8');
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
                reward_id1: Number(col[1]),
                reward_id1_value: Number(col[2]),
                reward_id1_probability: Number(col[3]),
                reward_id1_probability_out: Number(col[4]),
                reward_id2: Number(col[5]),
                reward_id2_value: Number(col[6]),
                reward_id2_probability: Number(col[7]),
                reward_id2_probability_out: Number(col[8]),
				/*reward_id3: 				Number(col[9]),
				reward_id3_value:			Number(col[10]),
				reward_id3_probability:		Number(col[11]),
				reward_id3_probability_out: Number(col[12]),
				reward_id4: 				Number(col[13]),
				reward_id4_value:			Number(col[14]),
				reward_id4_probability:		Number(col[15]),
				reward_id4_probability_out: Number(col[16])*/
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