"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const mysql = require("mysql2/promise");
// 单例模式
class mysqlPool {
    static get inst() {
        if (!this._inst) {
            this._inst = this.createPool();
        }
        return this._inst;
    }
    static createPool() {
        return mysql.createPool({
            host: 'localhost',
            user: 'root',
            password: "123456", // mysql 密码
            database: 'playing_card',
            port: 3306,
            waitForConnections: true,
            connectionLimit: 10, // 连接池最大连接数量
            maxIdle: 10, // 最大空闲连接数，默认值与‘ connectionLimit ’相同
            idleTimeout: 60000, // 空闲连接超时，单位为毫秒，默认值60000
            queueLimit: 0,
            enableKeepAlive: true, // 启用keeplive
            keepAliveInitialDelay: 0, // keepAlive初始延迟
        });
    }
}
// 私有静态实例
mysqlPool._inst = null;
exports.default = mysqlPool;
