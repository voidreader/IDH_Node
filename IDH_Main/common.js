var conf = require("./package.json");
var crypto = require("crypto");
var md5 = require('md5');

var preSharedKey = "49a91b84c502f8bab574cdb3fcb32af7";
var ivStr = "49a91b84c502f8ba";

//로그인 관련, 재화, 캐쉬
//기본값 d, h와 Server용 key를 이용하여 D/H연산을 이용해 Client에게 줄 Server용 공개키 생성
exports.calculate = function () {
    var a = Math.pow(conf.ruleBox.d, conf.ruleBox.sk);
    var result = a % conf.ruleBox.h;
    var resObj = {};
    resObj.d = conf.ruleBox.d;
    resObj.h = conf.ruleBox.h;
    resObj.sr = result;
    //resObj.text = "텍스트";

    var cipher = crypto.createCipheriv('aes256', preSharedKey, ivStr);
    var res = cipher.update(JSON.stringify(resObj), 'utf8', 'base64');
    res += cipher.final('base64');
    console.log("Client측으로 전송할 원본 데이터 : " + JSON.stringify(resObj));
    console.log("Client측으로 전송할 암호화 된 데이터 crypto.encrypt(JSON.stringify(resObj), preSharedKey, 192) : " + res);
    return res;
}

exports.initKey = function (passwd) {
    var a = Math.pow(passwd, conf.ruleBox.sk);
    var result = a % conf.ruleBox.h;
    console.log("Client 공개키를 이용해 비밀키 생성 finalKey : " + result);
    return result;
}

exports.verifyData = function (data) {
    var a = Math.pow(data.p, conf.ruleBox.sk);
    var finalKey = a % conf.ruleBox.h;
    console.log("Client 공개키를 이용해 비밀키 생성 finalKey : " + finalKey);
    finalKey = finalKey.toString();
    if (finalKey.length < 32) {
        var limit = 32 - finalKey.length;
        for (var i = 0; i < limit; i++) {
            finalKey += "0";
        }
    }

    var decipher = crypto.createDecipheriv("aes256", finalKey, ivStr);
    var result = decipher.update(data.data, "base64");
    result += decipher.final();
    var originData = JSON.parse(result);
    var originSha1Data = md5(originData.money.toString());
    if (originSha1Data == originData.enc) {
        console.log("true");
    }
}

exports.CryptoEncrypt = (dataObj) => {
    var cipher = crypto.createCipheriv('aes256', preSharedKey, ivStr);
    var res = cipher.update(JSON.stringify(dataObj), 'utf8', 'base64');
    res += cipher.final('base64');
    return res;
}

exports.CryptoDecrypt = (data) => {
    var decipher = crypto.createDecipheriv("aes256", preSharedKey, ivStr);
    var result = decipher.update(data, "base64", "utf8");
    result += decipher.final("utf8");
    return result;
}

exports.verifyJSONData = function (type, data) {
    console.log("============================" + type + "============================");
    console.log(JSON.stringify(data));
}

// 
exports.aTypeParser = function (string) {
    var crudType = string.substr(0, 1) || "";
    var actionType = string.substr(1, 2) || "";

    return { cType: crudType, aType: actionType };
}

// 배열에서 JSON key를 이용하여 해당 Object return
exports.findObjectByKey = function (list, key, value) {
    var obj = null;

    for (var i = 0; i < list.length; i++) {
        if (list[i][key] == value)
            obj = list[i];
    }
    return obj;
}

// 배열에서 JSON key를 이용하여 해당 Object List return
exports.findObjectByKeyList = function (list, key, value) {
    var temp = [];
    for (var i = 0; i < list.length; i++) {
        if (list[i][key] == value)
            temp.push(list[i]);
    }
    return temp;
}


// 유저 캐릭터 슬롯 제한 체크
exports.checkCharacterSlot = function (socket, space) {
    var acc = socket.Session.GetAccount();
    var userCharacterList = socket.Session.GetCharacters();

    if (acc.CHARACTER_SLOT < userCharacterList.length + space) {
        return false;
    }
    return true;
}

// 유저 아이템 슬롯 제한 체크
exports.checkItemSlot = function (socket, space) {
    var acc = socket.Session.GetAccount();
    var userItemList = socket.Session.GetItems();
    var invenCount = 0;
    for (var i = 0; i < userItemList.length; i++) {
        if (CSVManager.BItem.GetInventoryType(userItemList[i].ITEM_ID) == 0)
            invenCount++;
    }
    if (acc.INVEN_SLOT < invenCount + space) {
        return false;
    }
    return true;
}

exports.convertArrayToInQuery = function (array) {
    var str = "";
    for (var i = 0; i < array.length; i++) {
        if (i != 0) {
            str += ",";
        }
        str += array[i];
    }
    return str;
}

Array.prototype.groupBy = function (prop) {
    return this.reduce(function (groups, item) {
        const val = item[prop]
        groups[val] = groups[val] || []
        groups[val].push(item)
        return groups
    }, {})
}

Array.prototype.shuffle = function () {
    var i = this.length, j, temp;
    if (i == 0) return this;
    while (--i) {
        j = Math.floor(Math.random() * (i + 1));
        temp = this[i];
        this[i] = this[j];
        this[j] = temp;
    }
    return this;
}

exports.dateDiff = function (_date1, _date2) {
    var diffDate_1 = _date1 instanceof Date ? _date1 : new Date(_date1);
    var diffDate_2 = _date2 instanceof Date ? _date2 : new Date(_date2);

    diffDate_1 = new Date(diffDate_1.getFullYear(), diffDate_1.getMonth() + 1, diffDate_1.getDate());
    diffDate_2 = new Date(diffDate_2.getFullYear(), diffDate_2.getMonth() + 1, diffDate_2.getDate());

    var diff = Math.abs(diffDate_1.getTime() - diffDate_2.getTime());
    diff = Math.ceil(diff / (1000 * 3600 * 24));

    return diff;
}

// PVP 순위 조정 시간 체크
exports.timeCheck = (type) => {
    let flag = false;
    let tempData = new Date();

    let hour = tempData.getHours().toString();
    let minute = tempData.getMinutes().toString();
    let second = tempData.getSeconds().toString();

    if (minute.length == 1) minute = "0" + minute;
    if (second.length == 1) second = "0" + second;

    let time = hour + minute + second;

    time = parseInt(time);

    if (type == "PVP") {
        let day_list = CSVManager.BPvPCommon.GetData("rearrange_day").replace(/\//gi, ",");
        console.log(day_list);
        console.log("PVP TIMECHECK NOW : " + time);
        console.log(CSVManager.BPvPCommon.GetData("pvp_end_time") + "0000 / " + CSVManager.BPvPCommon.GetData("pvp_start_time") + "0000");

        if (day_list.indexOf(new Date().getDay().toString()) > -1) {
            time = parseInt(time);
            if (parseInt(CSVManager.BPvPCommon.GetData("pvp_end_time") + "0000") < time && time < parseInt(CSVManager.BPvPCommon.GetData("pvp_start_time") + "0000"))
                flag = true;
        }
        //if ("141700" < time && time < "160000") flag =true;
        console.log("PVP timeCheck result : " + flag);
    }

    return flag;
}

// JSON Object 복사
exports.cloneObject = (obj) => {
    return JSON.parse(JSON.stringify(obj));
}