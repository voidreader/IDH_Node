/**
 * 캐릭터 Common
 * /Project/Document/Table/Common/IDH_Common_180501.xlsm BCharacterCommon Tab 참고
 */

var csvData = [];

module.exports.data = csvData;
module.exports.Load = function (fs) {

    //!< 동기 사용.
    var data = fs.readFileSync(process.cwd() + '/Resources/CSV/BCharacterCommon.txt', 'utf8');
    if (data != null) {
        var row = data.split('\r\n');
        var col;

        var temp;

        //!< Row Parse.
        for (var i = 0; i < row.length; i++) {
            //!< Column Parse.
            col = row[i].split(',');
            temp = {
                default_character_slot_count: Number(col[0]),
                character_slot_cash_expansion1: Number(col[1]),
                character_slot_count_expansion1: Number(col[2]),
                character_slot_cash_expansion2: Number(col[3]),
                character_slot_count_expansion2: Number(col[4]),
                character_slot_cash_expansion3: Number(col[5]),
                character_slot_count_expansion3: Number(col[6]),
                character_slot_cash_expansion4: Number(col[7]),
                character_slot_count_expansion4: Number(col[8]),
                character_slot_cash_expansion5: Number(col[9]),
                character_slot_count_expansion5: Number(col[10]),
                character_slot_cash_expansion6: Number(col[11]),
                character_slot_count_expansion6: Number(col[12]),
                character_slot_cash_expansion7: Number(col[13]),
                character_slot_count_expansion7: Number(col[14]),
                character_slot_cash_expansion8: Number(col[15]),
                character_slot_count_expansion8: Number(col[16]),
                character_slot_cash_expansion9: Number(col[17]),
                character_slot_count_expansion9: Number(col[18]),
                character_slot_cash_expansion10: Number(col[19]),
                character_slot_count_expansion10: Number(col[20]),

                enchant_max1: Number(col[21]),
                enchant_max2: Number(col[22]),
                enchant_max3: Number(col[23]),
                enchant_max4: Number(col[24]),
                enchant_max5: Number(col[25]),

                convert_exp1: Number(col[26]),
                convert_exp2: Number(col[27]),
                convert_exp3: Number(col[28]),
                convert_exp4: Number(col[29]),
                convert_exp5: Number(col[30]),

                accumulation_enchant0_exp: Number(col[31]),
                accumulation_enchant1_exp: Number(col[32]),
                accumulation_enchant2_exp: Number(col[33]),
                accumulation_enchant3_exp: Number(col[34]),
                accumulation_enchant4_exp: Number(col[35]),
                accumulation_enchant5_exp: Number(col[36]),
                accumulation_enchant6_exp: Number(col[37]),
                accumulation_enchant7_exp: Number(col[38]),
                accumulation_enchant8_exp: Number(col[39]),
                accumulation_enchant9_exp: Number(col[40]),
                accumulation_enchant10_exp: Number(col[41]),
                accumulation_enchant11_exp: Number(col[42]),
                accumulation_enchant12_exp: Number(col[43]),
                accumulation_enchant13_exp: Number(col[44]),
                accumulation_enchant14_exp: Number(col[45]),
                accumulation_enchant15_exp: Number(col[46]),
                accumulation_enchant16_exp: Number(col[47]),
                accumulation_enchant17_exp: Number(col[48]),
                accumulation_enchant18_exp: Number(col[49]),
                accumulation_enchant19_exp: Number(col[50]),
                accumulation_enchant20_exp: Number(col[51]),
                accumulation_enchant21_exp: Number(col[52]),
                accumulation_enchant22_exp: Number(col[53]),
                accumulation_enchant23_exp: Number(col[54]),
                accumulation_enchant24_exp: Number(col[55]),
                accumulation_enchant25_exp: Number(col[56]),

                enchant_need_exp1_1: Number(col[57]),
                enchant_need_gold1_1: Number(col[58]),
                enchant_need_exp1_2: Number(col[59]),
                enchant_need_gold1_2: Number(col[60]),
                enchant_need_exp1_3: Number(col[61]),
                enchant_need_gold1_3: Number(col[62]),

                enchant_need_exp2_1: Number(col[63]),
                enchant_need_gold2_1: Number(col[64]),
                enchant_need_exp2_2: Number(col[65]),
                enchant_need_gold2_2: Number(col[66]),
                enchant_need_exp2_3: Number(col[67]),
                enchant_need_gold2_3: Number(col[68]),
                enchant_need_exp2_4: Number(col[69]),
                enchant_need_gold2_4: Number(col[70]),

                enchant_need_exp3_1: Number(col[71]),
                enchant_need_gold3_1: Number(col[72]),
                enchant_need_exp3_2: Number(col[73]),
                enchant_need_gold3_2: Number(col[74]),
                enchant_need_exp3_3: Number(col[75]),
                enchant_need_gold3_3: Number(col[76]),
                enchant_need_exp3_4: Number(col[77]),
                enchant_need_gold3_4: Number(col[78]),
                enchant_need_exp3_5: Number(col[79]),
                enchant_need_gold3_5: Number(col[80]),

                enchant_need_exp4_1: Number(col[81]),
                enchant_need_gold4_1: Number(col[82]),
                enchant_need_exp4_2: Number(col[83]),
                enchant_need_gold4_2: Number(col[84]),
                enchant_need_exp4_3: Number(col[85]),
                enchant_need_gold4_3: Number(col[86]),
                enchant_need_exp4_4: Number(col[87]),
                enchant_need_gold4_4: Number(col[88]),
                enchant_need_exp4_5: Number(col[89]),
                enchant_need_gold4_5: Number(col[90]),
                enchant_need_exp4_6: Number(col[91]),
                enchant_need_gold4_6: Number(col[92]),

                enchant_need_exp5_1: Number(col[93]),
                enchant_need_gold5_1: Number(col[94]),
                enchant_need_exp5_2: Number(col[95]),
                enchant_need_gold5_2: Number(col[96]),
                enchant_need_exp5_3: Number(col[97]),
                enchant_need_gold5_3: Number(col[98]),
                enchant_need_exp5_4: Number(col[99]),
                enchant_need_gold5_4: Number(col[100]),
                enchant_need_exp5_5: Number(col[101]),
                enchant_need_gold5_5: Number(col[102]),
                enchant_need_exp5_6: Number(col[103]),
                enchant_need_gold5_6: Number(col[104]),
                enchant_need_exp5_7: Number(col[105]),
                enchant_need_gold5_7: Number(col[106]),

                evolution_need_coin1: Number(col[107]),
                evolution_need_gold1: Number(col[108]),
                evolution_probability1: Number(col[109]),
                evolution_need_cash1: Number(col[110]),
                evolution_cash_probability1: Number(col[111]),

                evolution_need_coin2: Number(col[112]),
                evolution_need_gold2: Number(col[113]),
                evolution_probability2: Number(col[114]),
                evolution_need_cash2: Number(col[115]),
                evolution_cash_probability2: Number(col[116]),

                evolution_need_coin3: Number(col[117]),
                evolution_need_gold3: Number(col[118]),
                evolution_probability3: Number(col[119]),
                evolution_need_cash3: Number(col[120]),
                evolution_cash_probability3: Number(col[121]),

                evolution_need_coin4: Number(col[122]),
                evolution_need_gold4: Number(col[123]),
                evolution_probability4: Number(col[124]),
                evolution_need_cash4: Number(col[125]),
                evolution_cash_probability4: Number(col[126]),

                accumulation_enchant0_ablility: Number(col[127]),
                accumulation_enchant1_ablility: Number(col[128]),
                accumulation_enchant2_ablility: Number(col[129]),
                accumulation_enchant3_ablility: Number(col[130]),
                accumulation_enchant4_ablility: Number(col[131]),
                accumulation_enchant5_ablility: Number(col[132]),
                accumulation_enchant6_ablility: Number(col[133]),
                accumulation_enchant7_ablility: Number(col[134]),
                accumulation_enchant8_ablility: Number(col[135]),
                accumulation_enchant9_ablility: Number(col[136]),
                accumulation_enchant10_ability: Number(col[137]),
                accumulation_enchant11_ability: Number(col[138]),
                accumulation_enchant12_ability: Number(col[139]),
                accumulation_enchant13_ability: Number(col[140]),
                accumulation_enchant14_ability: Number(col[141]),
                accumulation_enchant15_ability: Number(col[142]),
                accumulation_enchant16_ability: Number(col[143]),
                accumulation_enchant17_ability: Number(col[144]),
                accumulation_enchant18_ability: Number(col[145]),
                accumulation_enchant19_ability: Number(col[146]),
                accumulation_enchant20_ability: Number(col[147]),
                accumulation_enchant21_ability: Number(col[148]),
                accumulation_enchant22_ability: Number(col[149]),
                accumulation_enchant23_ability: Number(col[150]),
                accumulation_enchant24_ability: Number(col[151]),
                accumulation_enchant25_ability: Number(col[152]),

                strength_revision: Number(col[153]),
                damage_revision: Number(col[154]),
                defensive_revision: Number(col[155]),
                action_revision: Number(col[156]),
                agility_revision: Number(col[157]),
                concentration_revision: Number(col[158]),
                recovery_revision: Number(col[159]),
                mentality_revision: Number(col[160]),
                aggro_revision: Number(col[161])
            };
            csvData.push(temp);
        }
    }
}

module.exports.GetData = function (key) {
    return csvData[0][key];
}