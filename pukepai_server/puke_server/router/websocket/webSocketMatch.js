"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.webSocketMatchRouter = exports.setMatchUserList = exports.matchUserList = void 0;
const tools_1 = require("../../utils/tools");
const decors_1 = require("../../utils/decors");
const room_1 = require("../../utils/room");
const webSocket_1 = require("./webSocket");
const user_1 = require("../user");
// 匹配玩家列表
exports.matchUserList = {
    // "level": [{...userInfo, ws: WebSocket}]
    "1": [], // 和数据库对应
    "2": [],
    "3": [],
    "4": []
};
const setMatchUserList = (level, arr) => {
    exports.matchUserList[level] = arr;
};
exports.setMatchUserList = setMatchUserList;
// 匹配
class webSocketMatchRouter {
    // 开启游戏匹配
    async match({ ws, token, userInfo, params }) {
        // console.log("matchUserList", params, matchUserList[params.level]);
        // 判断用户元宝是否充足
        let { status, message } = await user_1.default.GoldIsAdequate({
            userId: userInfo.user_id,
            level: params.level
        });
        if (status) {
            // 查询房间类型为匹配的房间，是否有空缺，有的话直接加入空缺房间
            const matchingRoom = Object.keys(room_1.RoomObj).filter(roomId => {
                const roomInfo = room_1.RoomObj[roomId];
                console.log("roomInfo.room_type", roomInfo.room_type);
                console.log("roomInfo.gameStatus", roomInfo.gameStatus);
                console.log("roomInfo.roomUserIdList", roomInfo.roomUserIdList);
                if (roomInfo.room_type === room_1.RoomType.MATCHING && roomInfo.gameStatus === room_1.GameStatus.NOSTART && roomInfo.roomUserIdList.some(id => !id)) {
                    return true;
                }
            });
            console.log("matchingRoom", matchingRoom);
            // 有已经存在的匹配房间的话，优先加入
            if (matchingRoom.length > 0) {
                const roomId = matchingRoom[0];
                const roomInfo = room_1.RoomObj[roomId];
                // 加入房间内
                const { status, message } = (0, room_1.userJoinRoom)(userInfo, roomId);
                if (status) {
                    // 通知该玩家匹配成功
                    (0, webSocket_1.wsSend)(ws, {
                        type: 'match',
                        code: 200,
                        data: {
                            roomId,
                        },
                        message: '匹配成功',
                    });
                    // 通知房间内其他玩家，有玩家加入房间
                    Object.keys(roomInfo.roomUsers).filter(id => id != userInfo.user_id).forEach((userId) => {
                        const roomUserInfo = roomInfo.roomUsers[userId];
                        (0, webSocket_1.wsSend)(roomUserInfo.ws, {
                            type: "userJoinRoomUpdate",
                            code: 200,
                            data: Object.assign(Object.assign({}, roomInfo), { roomUsers: (0, tools_1.clientReturnRoomUsers)(roomInfo.roomUsers, userId) }), // 返回用户信息
                            message: '加入房间成功'
                        });
                    });
                }
                else {
                    (0, webSocket_1.wsSend)(ws, {
                        type: 'match',
                        code: 400,
                        message: message,
                    });
                }
            }
            else {
                // 加入到匹配数组中
                exports.matchUserList[params.level].push(Object.assign(Object.assign({}, userInfo), { ws }));
                // 匹配玩家
                if (exports.matchUserList[params.level].length >= 3) {
                    const roomId = await (0, room_1.CreateRoom)({ userInfo, level: params.level, roomType: room_1.RoomType.MATCHING });
                    // 删除匹配列表中已匹配的玩家
                    let matchUser = exports.matchUserList[params.level].splice(0, 3);
                    console.log("匹配成功", matchUser);
                    matchUser.forEach(async (userInfo) => {
                        // 加入房间内
                        (0, room_1.userJoinRoom)(userInfo, roomId);
                        // 通知客户端，匹配成功，需要客户端调用加入房间websocket接口
                        (0, webSocket_1.wsSend)(userInfo.ws, {
                            type: 'match',
                            code: 200,
                            data: {
                                roomId,
                            },
                            message: '匹配成功',
                        });
                    });
                }
                else {
                    (0, webSocket_1.wsSend)(ws, { type: 'match', code: 200, message: '匹配中' });
                }
            }
        }
        else {
            (0, webSocket_1.wsSend)(ws, {
                type: "match",
                code: 400,
                message: message
            });
        }
    }
    // 退出匹配
    cancelMatch({ ws, token, userInfo, params }) {
        if (exports.matchUserList[params.level]) {
            exports.matchUserList[params.level] = exports.matchUserList[params.level].filter((item) => userInfo.user_id !== item.user_id);
        }
        (0, webSocket_1.wsSend)(ws, {
            type: 'cancelMatch',
            code: 200,
            message: '退出匹配成功',
        });
    }
}
exports.webSocketMatchRouter = webSocketMatchRouter;
__decorate([
    (0, decors_1.authSocketToken)()
], webSocketMatchRouter.prototype, "match", null);
__decorate([
    (0, decors_1.authSocketToken)()
], webSocketMatchRouter.prototype, "cancelMatch", null);
