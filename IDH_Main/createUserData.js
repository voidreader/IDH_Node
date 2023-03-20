/**
 * 게임 초기 유저 기본 정보 데이터 생성
 * 사용 안함.
 */

let mysql = require('mysql'),
    async = require('async');
let DB = mysql.createPool({
    "host": "localhost",
    "port": 3306,
    "user": "imageframeAll",
    "password": "imageframe.1120",
    "database": "idh",
    "connectionLimit": 1,
    "waitForConnections": true
});

let idList = [];
let startUserUid = 100011;
let endUserUid = 100021;
async.series([
    (callback) => {
        for (let i = startUserUid; i < endUserUid; i++)
            idList.push(i);
        callback(null);
    },
    (callback) => {
        console.log("Start Creating User : " + idList.length);
        async.eachSeries(idList, (idStr, cb) => {
            let queryStr = "CALL CBTDefaultUserData(?)";
            let args = [idStr];
            DB.query(queryStr, args, (sErr, sResult) => {
                cb(sErr);
            });
        }, (error) => { callback(error); });
    }
], (error) => {
    console.log("Error : " + error);
    console.log("End Creating User : " + idList.length);
});