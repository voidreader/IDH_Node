/**
 * PVP Common
 * /Project/Document/Table/Common/IDH_Common_180501.xlsm BPvPCommon Tab 참고
 */

var csvData = [];

module.exports.data = csvData;
module.exports.Load = function(fs) {

	//!< 동기 사용.
	var data = fs.readFileSync(process.cwd() + '/Resources/CSV/BPvPCommon.txt', 'utf8');
	if (data != null)
	{
		var row = data.split('\r\n');
		var col;

		var temp;
		
		//!< Row Parse.
		for(var i = 0; i < row.length; i++)
		{
			//!< Column Parse.
			col = row[i].split(',');
			temp = {
				rechallenge_count:		Number(col[0]),
				group_count:			Number(col[1]),
				research_initial_value:	Number(col[2]),
				research_increase_value:Number(col[3]),
				grade_initial_value:	Number(col[4]),
				grade_increase_value:	Number(col[5]),
				win_point:				Number(col[6]),
				defeat_point:			Number(col[7]),
				enemy_fight_power1:		Number(col[8]),
				enemy_fight_power2:		Number(col[9]),
				win_point1:				Number(col[10]),
				win_point2:				Number(col[11]),
				defeat_rate1:			Number(col[12]),
				defeat_rate2:			Number(col[13]),
				match_range:			Number(col[14]),
				pvp_limit:			Number(col[15]),
				default_pvp:		Number(col[16]),
				pvp_add_time:		Number(col[17]),
				rearrange_day:		col[18],
				pvp_end_time:		Number(col[19]),
				pvp_start_time:		Number(col[20]),
				reward_limit:		Number(col[21])
			};
			csvData.push(temp);
		}
	}
}

module.exports.GetData = function (key) {
	return csvData[0][key];
}
