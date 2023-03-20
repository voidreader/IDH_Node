/**
 * 캐릭터 전투력 수치
 * /Project/Document/Table/Common/IDH_Common_180501.xlsm BBattleCommon Tab 참고
 */

var csvData = [];

module.exports.data = csvData;
module.exports.Load = function (fs) {

    //!< 동기 사용.
    var data = fs.readFileSync(process.cwd() + '/Resources/CSV/BBattleCommon.txt', 'utf8');
    if (data != null) {
        var row = data.split('\r\n');
        var col;

        var temp;

        //!< Row Parse.
        for (var i = 0; i < row.length; i++) {
            //!< Column Parse.
            col = row[i].split(',');
            temp = {
                DmgAtkCrt_C: Number(col[0]),
                DmgCctCrt_C: Number(col[1]),
                DmgLvlCrt_C: Number(col[2]),
                DmgAtkCrt_I: Number(col[3]),
                DmgCctCrt_I: Number(col[4]),
                DmgLvlCrt_I: Number(col[5]),
                DmgCrt_C: Number(col[6]),
                DmgCrt_I: Number(col[7]),
                DmgCriCctcrt: Number(col[8]),
                DmgCriAglcrt: Number(col[9]),
                DmgCriConstMin: Number(col[10]),
                DmgCriConstMax: Number(col[11]),
                DmgCriCriScale: Number(col[12]),
                DmgCriNorScale: Number(col[13]),
                DmgCriFilScale: Number(col[14]),
                GrdAmrCrt_C: Number(col[15]),
                GrdAglCrt_C: Number(col[16]),
                GrdLvlCrt_C: Number(col[17]),
                GrdAtkCrt_I: Number(col[18]),
                GrdAglCrt_I: Number(col[19]),
                GrdLvlCrt_I: Number(col[20]),
                GrdCrt_C: Number(col[21]),
                GrdCrt_I: Number(col[22]),
                GrdCriCctcrt: Number(col[23]),
                GrdCriAglcrt: Number(col[24]),
                GrdCriConstMin: Number(col[25]),
                GrdCriConstMax: Number(col[26]),
                GrdCriCriScale: Number(col[27]),
                GrdCriNorScale: Number(col[28]),
                GrdCriFilScale: Number(col[29]),
                TeamDmgGaugeConst: Number(col[30]),
                TeamGrdGaugeConst: Number(col[31]),
                TeamDmgChemiConst: Number(col[32]),
                TeamGrdChemiConst: Number(col[33]),
                TeamDmgIncConst_1: Number(col[34]),
                TeamDmgIncConst_2: Number(col[35]),
                StlikeDmgConst: Number(col[36]),
                StlikeGrdConst: Number(col[37]),
                MetalDecrease: Number(col[38]),
                MaxCoolTime: Number(col[39]),
                CoolTimeIncrease: Number(col[40]),
                MentalHeal: Number(col[41]),
                VigorForVigorConst: Number(col[42]),
                AgilityForVigorConst: Number(col[43]),
                VigorDefaultDecreaseConst: Number(col[44]),
                VigorLimitDecreaseConst: Number(col[45]),
                PriorityAggro_1: Number(col[46]),
                PriorityAggro_2: Number(col[47]),
                PriorityAggro_3: Number(col[48]),
                Hard: Number(col[49]),
                VeryHard: Number(col[50]),
                BossHPScale: Number(col[51])
            };
            csvData.push(temp);
        }
    }
}

module.exports.GetData = function (key) {
    return csvData[0][key];
}
