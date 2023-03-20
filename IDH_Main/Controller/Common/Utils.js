//
//
//
//
//
//
//
//
//
//

global.PrintError = function (err) {
    if (err != null) {
        if (typeof(err) != 'number'){
          logging.error(err);
        } else {
          logger.debug(err);
        }
    }
}

//!< 배열 중 랜덤한 원소를 뽑는다.
module.exports.GetRandomArray = function(array) {
	var max = array.length;
	if (max > 0) {
		var idx = Math.floor(Math.random() * max);
		return array[idx];
	}
	return null;
}

module.exports.Random = function (min, max) {
	max++;
	return Math.floor(Math.random() * (max - min) + min);
}

module.exports.StringToArray = function (str) {
    if (str == null || str.length <= 0)    return [];
    else                    return JSON.parse('[' + str + ']');
}
module.exports.ArrayToString = function (arr) {
    if (arr == null) return '';
    else             return arr.toString();
}

Date.prototype.format = function(f) {
    if (!this.valueOf()) return " ";
 
    var weekName = ["일요일", "월요일", "화요일", "수요일", "목요일", "금요일", "토요일"];
    var d = this;
     
    return f.replace(/(yyyy|yy|MM|dd|E|hh|mm|ss|a\/p)/gi, function($1) {
        switch ($1) {
            case "yyyy": return d.getFullYear();
            case "yy": return (d.getFullYear() % 1000).zf(2);
            case "MM": return (d.getMonth() + 1).zf(2);
            case "dd": return d.getDate().zf(2);
            case "E": return weekName[d.getDay()];
            case "HH": return d.getHours().zf(2);
            case "hh": return ((h = d.getHours() % 12) ? h : 12).zf(2);
            case "mm": return d.getMinutes().zf(2);
            case "ss": return d.getSeconds().zf(2);
            case "a/p": return d.getHours() < 12 ? "오전" : "오후";
            default: return $1;
        }
    });
};

String.prototype.string = function(len){var s = '', i = 0; while (i++ < len) { s += this; } return s;};
String.prototype.zf = function(len){return "0".string(len - this.length) + this;};
Number.prototype.zf = function(len){return this.toString().zf(len);};