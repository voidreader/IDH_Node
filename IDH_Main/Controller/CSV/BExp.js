/**
 * 유저 레벨 경험치 및 보상
 */

var csvData = [];

module.exports.data = csvData;
module.exports.Load = function (fs) {

    //!< 동기 사용.
    var data = fs.readFileSync(process.cwd() + '/Resources/CSV/BExp.txt', 'utf8');
    if (data != null) {
        var row = data.split('\r\n');
        var col;

        var temp;
        //!< Row Parse.
        for (var idx = 0; idx < row.length; idx++) {
            //!< Column Parse.
            col = row[idx].split(',');
            temp = {
                level: Number(col[0]),              // 레벨
                exp: Number(col[1]),                // 해당 레벨 경험치
                reward_gold: Number(col[2]),        // 골드 보상
                reward_cash: Number(col[3]),        // 캐쉬 보상
                reward_item_id: Number(col[4]),     // 보상 아이템 ID
                reward_item_value: Number(col[5]),  // 보상 아이템 수량
                act: Number(col[6])                 // 행동력 MAX 수치
            };
            csvData.push(temp);
        }
    }
}

exports.GetData = function (id) {
    for (var i = 0; i < csvData.length; i++)
        if (csvData[i].id == id)
            return csvData[i];
    return null;
}

exports.CheckLevel = function (preExp, curExp) {
    var pre = null;
    var cur = null;
    var levelRewardList = [];
    let upObj = { UP: false, UPLEVEL: 0, ACT: false, SUMEXP: 0, MAXLEVEL: false };

    upObj.SUMEXP = curExp;

    if(preExp != csvData[csvData.length - 1].exp){
        for (let i = 0; i < csvData.length; i++) {
            if (preExp < csvData[i].exp) {
                pre = i - 1;
                break;
            }
        }
    
        for (let i = 0; i < csvData.length; i++) {
            if (curExp < csvData[i].exp) {
                cur = i - 1;
                break;
            }
        }
        if(cur == null) {
            cur = csvData.length - 1;
            upObj.SUMEXP = csvData[csvData.length - 1].exp;
            upObj.MAXLEVEL = true;
        } 
        
        for (let i = 0; i < csvData.length; i++) {
            if (pre < i && i <= cur) {
                levelRewardList.push(csvData[i]);
            }
        }
        let rewardList = [];
        if (pre !== cur) {
            let tempObj = levelRewardList[levelRewardList.length - 1];
            upObj.UP = true;
            upObj.UPLEVEL = levelRewardList[levelRewardList.length - 1].level;
    
            let gold = 0;
            let cash = 0;
            for (var i = 0; i < levelRewardList.length; i++) {
                gold += levelRewardList[i].reward_gold;
                cash += levelRewardList[i].reward_cash;
                if (levelRewardList[i].act == 1) upObj.ACT = true;
            }
            if (gold > 0) rewardList.push({ REWARD_ITEM_ID: DefineItem.GOLD, REWARD_ITEM_COUNT: gold });
    
            if (cash > 0) rewardList.push({ REWARD_ITEM_ID: DefineItem.PEARL, REWARD_ITEM_COUNT: cash });
    
            upObj.REWARD = rewardList;
        }
    } else {
        upObj.SUMEXP = preExp;
    }
    return upObj;
}