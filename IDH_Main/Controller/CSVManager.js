/**
 * 기본 데이터 txt 파일 리스트 관리
 */

var fs = require('fs');

//!< CSV 리스트.
var csvList = [
    'BStrengthen',
    'BItemStrenghten',
    'BISNeed',
    'BSNeed',
    'BMissionCommon',
    'BMissionDefine',
    'BAccumReward',
    'BAchieve',
    'BQuest',
    'BWeeklyMission',
    'BDailyMission',
    'BRRReward',
    'BRaid',
    'BRReward',
    'BPvECommon',
    'BDDungeonCommon',
    'BDDungeon',
    'BDDReward',
    'BFriendsCommon',
    'BPvPCommon',
    'BRateReward',
    'BAdvancement',
    'BExp',
    'BMakingCommon',
    'BMakingSlotCost',
    'BMakingSummary',
    'BMakingTime',
    'BGacha',
    'BGachaReward',
    'BGachaPercentage',
    'BWealthCommon',
    'BStaminaCommon',
    'BStoryCommon',
    'BStory',
    'BStoryReward',
    'BChapter',
    'BFarming',
    'BFarmingReward',
    'BFarmingCommon',
    'BMyRoomRandomBox',
    'BMyRoom',
    'BMyRoomCommon',
    'BItem',
    'BRuleItemEffect',
    'BInventoryCommon',
    'BCharacter',
    'BCharacterCommon',
    'NameBlackList',
    'BShopPackage',
    'BShopItemSkin',
    'BShopPackageInfo',
    'BBattleCommon',
    'BStage',
    'BPowercal',
    'BAttendance',
    'BMailString',
    'BACheck'
];

var csvData = [];
module.exports = csvData;

// txt 파일 로드
module.exports.Initialize = function () {


    
    var path = __dirname + '/CSV/';
    var csv;

    console.log("csv Initialize dir : " + path);

    for (var idx = 0; idx < csvList.length; idx++) {
        csv = require(path + csvList[idx]);
        csv.Load(fs);

        csvData[csvList[idx]] = csv;
    }
}

// 기본 데이터 조회
module.exports.GetData = function (a) {
    return csvData;
}