import { _decorator, Component, director, EditBox, Node, sys } from 'cc';
import { CommonUIManager } from '../CommonUIManager';
import { post, get } from '../Api/FetchMgr';
import { AudioMgr } from '../AudioMgr';
const { ccclass, property } = _decorator;

@ccclass('LoginSceneMgr')
export class LoginSceneMgr extends Component {

    @property({
        type: Node,
        displayName: "游客登录弹框"
    })
    public visitorLoginPop: Node = null;
    @property({
        type: Node,
        displayName: "账号"
    })
    public account: Node = null;
    @property({
        type: Node,
        displayName: "账号"
    })
    public password: Node = null;

    async start() {
        const token = sys.localStorage.getItem("token");
        // 本地存储有token，直接跳转大厅
        if (token) {
            director.loadScene("HallScene");
        }

        if (!window.wx) {
            this.node.getChildByName("WxLoginBtn").active = false;
        }

        // 停止背景音乐
        AudioMgr.inst.stop();
    }

    update(deltaTime: number) {

    }

    toast(str: string) {
        CommonUIManager.inst.showToast(str);
    }

    // 游客登录弹框展示
    public visitorLoginPopShow() {
        this.visitorLoginPop.active = true;
    }

    // 游客登录弹框隐藏
    public visitorLoginPopHide() {
        this.visitorLoginPop.active = false;
    }

    // 游客登录
    public visitorLogin() {
        // 获取账号
        let acc = this.account.getComponent(EditBox).string;
        let pwd = this.password.getComponent(EditBox).string;
        console.log(acc, pwd);
        if (!acc) {
            this.toast("请输入账号");
        } else if (!pwd) {
            this.toast("请输入密码");
        } else {
            post('/login', {
                userAccount: acc,
                userPassword: pwd
            }).then((response) => {
                console.log(response);
                if (response.code == 200) {
                    console.log("登录成功");
                    this.toast("登录成功");
                    sys.localStorage.setItem('token', response.token);
                    // 跳转到大厅
                    director.loadScene('HallScene');
                } else {
                    this.toast(response.message);
                }
            })
        }

    }

    // 游客注册
    public visitorRegister() {
        // 获取账号
        let acc = this.account.getComponent(EditBox).string;
        let pwd = this.password.getComponent(EditBox).string;
        console.log(acc, pwd);
        if (!acc) {
            this.toast("请输入账号");
        } else if (!pwd) {
            this.toast("请输入密码");
        } else {
            post('/registerUser', {
                userAccount: acc,
                userPassword: pwd
            }).then((response) => {
                console.log(response);
                if (response.code == 200) {
                    this.toast("注册成功");
                } else {
                    this.toast(response.message);
                }
            })
        }
    }

    // 微信登录
    public WxLogin() {
        console.log("login");
        if (window.wx) {
            wx.login({
                timeout: "6000",
                success: async (res) => {
                    console.log("wx.login success:", res); // 添加日志
                    // 调用接口获取openid
                    let response = await post("/codeGetOpenId", {
                        code: res.code,
                        getRegister: true,
                    });
                    console.log("codeGetOpenId response:", JSON.stringify(response)); // 添加日志

                    if (response.code === 200 && response.data) { // 确保response.data存在
                        const { openid, isRegister } = response.data;
                        console.log("openid:", openid, "isRegister:", isRegister); // 添加日志

                        if (isRegister) { // 如果已注册
                            let resWxLogin = await post("/wxLogin", { // 变量名改为resWxLogin避免冲突
                                openid: openid,
                            });
                            console.log("已注册用户 wxLogin 接口响应:", JSON.stringify(resWxLogin)); // 添加日志
                            if (resWxLogin.code == 200) {
                                sys.localStorage.setItem('token', resWxLogin.token);
                                // 跳转到大厅
                                director.loadScene('HallScene');
                            } else {
                                CommonUIManager.inst.showToast(resWxLogin.message || "微信登录失败，请重试");
                                console.error("已注册用户 wxLogin 接口返回非200:", JSON.stringify(resWxLogin));
                            }
                        } else { // 如果未注册
                            // 该微信在数据库中没有查询到，需要获取用户信息并注册
                            wx.getUserProfile({
                                lang: 'zh_CN',
                                desc: '展示用户信息',
                                success: async (userInfoRes) => { // 变量名改为userInfoRes避免冲突
                                    console.log("wx.getUserProfile 成功获取用户信息:", JSON.stringify(userInfoRes.userInfo)); // 添加日志
                                    let resWxLogin = await post("/wxLogin", { // 变量名改为resWxLogin避免冲突
                                        openid: openid,
                                        wxUserInfo: userInfoRes.userInfo
                                    });
                                    console.log("未注册用户 wxLogin 接口响应:", JSON.stringify(resWxLogin)); // 添加日志
                                    if (resWxLogin.code == 200) {
                                        sys.localStorage.setItem('token', resWxLogin.token);
                                        // 跳转到大厅
                                        director.loadScene('HallScene');
                                    } else { // 添加else分支处理非200响应
                                        CommonUIManager.inst.showToast(resWxLogin.message || "微信登录失败，请重试");
                                        console.error("未注册用户 wxLogin 接口返回非200:", JSON.stringify(resWxLogin));
                                    }
                                },
                                fail: (err) => { // 添加wx.getUserProfile的失败回调
                                    console.error("wx.getUserProfile 失败:", JSON.stringify(err));
                                    CommonUIManager.inst.showToast("获取用户信息失败，无法登录");
                                }
                            })
                        }
                    } else { // codeGetOpenId 接口返回非200或无数据
                        CommonUIManager.inst.showToast(response.message || "获取OpenId失败，请重试");
                        console.error("codeGetOpenId 接口返回非200或无数据:", JSON.stringify(response));
                    }
                },
                fail: (err) => {
                    console.error("wx.login fail:", err); // 添加日志
                    CommonUIManager.inst.showToast("微信登录失败，请检查网络或授权");
                },
            });
        }
    }
}
