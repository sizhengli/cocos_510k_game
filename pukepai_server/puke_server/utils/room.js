"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PlayerReadyStatus = exports.GameStatus = exports.CreateRoom = exports.RoomObj = exports.RoomType = void 0;
exports.userJoinRoom = userJoinRoom;
const tools_1 = require("./tools");
const mysql_1 = require("../mysql");
// 游戏状态枚举
var GameStatus;
(function (GameStatus) {
    GameStatus[GameStatus["NOSTART"] = 0] = "NOSTART";
    GameStatus[GameStatus["SNATCHLABDLORD"] = 1] = "SNATCHLABDLORD";
    GameStatus[GameStatus["START"] = 2] = "START";
})(GameStatus || (exports.GameStatus = GameStatus = {}));
// 玩家准备状态
var PlayerReadyStatus;
(function (PlayerReadyStatus) {
    PlayerReadyStatus[PlayerReadyStatus["READY"] = 0] = "READY";
    PlayerReadyStatus[PlayerReadyStatus["UNREADY"] = 1] = "UNREADY";
})(PlayerReadyStatus || (exports.PlayerReadyStatus = PlayerReadyStatus = {}));
// 房间类型
var RoomType;
(function (RoomType) {
    RoomType[RoomType["USERCREATE"] = 0] = "USERCREATE";
    RoomType[RoomType["MATCHING"] = 1] = "MATCHING";
})(RoomType || (exports.RoomType = RoomType = {}));
// 游戏房间状态抽象类（不入库的房间状态数据）
class GameRoomStatus {
}
// 房间类
class Room extends GameRoomStatus {
    // 修改用户信息
    setRoomUserStatus(RoomUserStatus) {
        // 修改用户信息，先判断是否有该用户
        if (this.roomUsers[RoomUserStatus.user_id]) {
            // 修改用户信息
            Object.assign(this.roomUsers[RoomUserStatus.user_id], RoomUserStatus);
        }
        else {
            console.log('用户不存在,该房间');
        }
    }
    constructor(obj) {
        super();
        this.start_time = null;
        this.end_time = null;
        this.room_owner_id = null; // 房主id
        this.landlord_id = null; // 地主id
        this.room_rate = 1; // 初始倍率为1
        this.level = null; // 房间等级
        this.room_base = null; // 房间基数
        this.room_id = null; // 房间id
        this.roomUsers = null; // 定义未map 方便用户取值，但是循环麻烦
        this.roomUserIdList = ["", "", ""]; // 为什么有定义一个用户id List，因为出牌的时候要逆时针出牌，但是用户加入房间再次退出的时候，直接重roomUsers中删除了，所以相对应的位置也改变了（比如 1 2 3玩家，2退出了3就变成2了），想要对应的位置不改变，所以定义了一个userId数组
        this.gameStatus = GameStatus.NOSTART;
        this.bottom_card = []; // 底牌默认空
        this.snatch_landlord_record = []; // 抢地主总记录
        this.current_snatch_landlord_user = ""; // 当前抢地主玩家
        this.snatch_landlord_time = 20; // 用户抢地主默认时间
        this.snatch_landlord_countDown = this.snatch_landlord_time; // 用户抢地主剩余时间
        this.play_card_time = 20; // 用户出牌等待时间
        this.play_card_countDown = this.play_card_time; // 用户出牌剩余时间
        this.double_time = 5; // 用户选择加倍默认时间
        this.double_countDown = -1; // 用户选择加倍剩余时间(-1 未选择过加倍)
        this.count_down_timer = null; // 计时器
        this.play_card_record = []; // 玩家出牌记录
        this.current_play_card_user = ""; // 当前出牌用户id
        this.room_type = null; // 房间类型 玩家创建 和 系统匹配
        // 初始化数据
        Object.keys(obj).forEach(key => {
            if (this[key] !== undefined) {
                this[key] = obj[key];
            }
        });
    }
}
// 房间对象
const RoomObj = {};
exports.RoomObj = RoomObj;
/**
 * 创建房间
 * @param {Object} userInfo 用户信息
 * @param {number} level 房间等级
 * @param {RoomType} roomType 房间类型 玩家创建 和 系统匹配
 */
const CreateRoom = async ({ userInfo, level, roomType = RoomType.USERCREATE }) => {
    // 获取房间等级信息
    const [rows] = await mysql_1.default.inst.query(`select id, level, base from room_level`);
    const [userInfoDb] = await mysql_1.default.inst.query(`select id, user_id, user_name, user_account, user_head_img, wx_openid, gold from user where user_id = ?`, [userInfo.user_id]);
    console.log(userInfoDb);
    const room_id = (0, tools_1.generateRoomId)(RoomObj);
    console.log("生成房间id为", room_id);
    RoomObj[room_id] = new Room({
        room_id,
        room_owner_id: userInfoDb[0].user_id, // 房主id
        level, // 房间等级
        room_rate: 1, //  初始倍率为1
        room_base: rows.find(item => item.level === level).base, // 房间基数
        room_type: roomType, // 房间类型
        roomUsers: {
            [userInfoDb[0].user_id]: {
                id: userInfoDb[0].id, // user主键ID
                user_card: [], // 用户卡牌
                ws: null, // websocket
                user_id: userInfoDb[0].user_id, // 用户id
                user_name: userInfoDb[0].user_name, // 用户名
                user_head_img: userInfoDb[0].user_head_img, // 用户头像
                user_account: userInfoDb[0].user_account, // 用户账号
                gold: userInfoDb[0].gold, // 金币
                wx_openid: userInfoDb[0].wx_openid, // 微信openid
                ready: PlayerReadyStatus.UNREADY, // 是否准备
                redouble_status: null, // 加倍状态 1不加倍 2加倍 3超级加倍
                mingpai: false, // 是否是明牌
                get_ingots: 0, // 游戏结束获得元宝（输了可能是负数）
            }
        },
        roomUserIdList: [userInfoDb[0].user_id, "", ""]
    });
    return room_id;
};
exports.CreateRoom = CreateRoom;
// 房间加入用户
function userJoinRoom(userInfo, roomId) {
    const roomInfo = RoomObj[roomId];
    // 获取用户已经加入的房间ID
    const userJoinRooms = Object.keys(RoomObj).filter(roomId => {
        return RoomObj[roomId].roomUsers[userInfo.user_id];
    });
    // 房间不存在
    if (!roomInfo) {
        return {
            status: false,
            message: '房间不存在'
        };
    }
    else if (userJoinRooms.length > 0) { // 存在已经加入的房间
        // 如果已经加入的房间和要加入的房间ID一致，证明是断线重连，则直接返回true
        if (userJoinRooms[0] == roomId) {
            return {
                status: true,
                message: '允许加入'
            };
        }
        else {
            return {
                status: false,
                message: '你已经加入过别的房间，不能加入两个房间'
            };
        }
    }
    else if (Object.keys(roomInfo.roomUsers).length >= 3) { // 判断用户列表中有多少用户
        return {
            status: false,
            message: "房间已满"
        };
    }
    else {
        // 添加用户
        roomInfo.roomUsers[userInfo.user_id] = Object.assign({ ws: null, user_card: [], ready: PlayerReadyStatus.UNREADY, redouble_status: null, mingpai: false, get_ingots: 0, snatch_landlord_num: 0, is_hosted: false }, userInfo);
        // 存入用户id列表
        const index = roomInfo.roomUserIdList.indexOf("");
        roomInfo.roomUserIdList[index] = userInfo.user_id;
        return {
            status: true,
            message: "加入成功"
        };
    }
}
