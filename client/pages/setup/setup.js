// pages/setup/setup.js
const app = getApp();

Page({
    data: {
        maxPlayers: 4,
        undercoverCount: 1,
        nickname: ''
    },

    onLoad(options) {
        // Pre-fill nickname if available from global data
        if (app.globalData && app.globalData.userInfo && app.globalData.userInfo.nickname) {
            this.setData({ nickname: app.globalData.userInfo.nickname });
        }
    },

    onMaxPlayersInput(e) {
        this.setData({ maxPlayers: parseInt(e.detail.value) || 4 });
    },

    onUndercoverCountInput(e) {
        this.setData({ undercoverCount: parseInt(e.detail.value) || 1 });
    },

    onNicknameInput(e) {
        this.setData({ nickname: e.detail.value });
    },

    createGame() {
        const { maxPlayers, undercoverCount, nickname } = this.data;

        // Validation
        if (!nickname || !nickname.trim()) {
            wx.showToast({ title: '请输入昵称', icon: 'none' });
            return;
        }

        if (maxPlayers < 3) {
            wx.showToast({ title: '玩家总人数至少需要3人', icon: 'none' });
            return;
        }

        if (undercoverCount < 1) {
            wx.showToast({ title: '卧底人数至少需要1人', icon: 'none' });
            return;
        }

        if (undercoverCount >= maxPlayers) {
            wx.showToast({ title: '卧底人数必须少于玩家总人数', icon: 'none' });
            return;
        }

        // Store nickname globally
        app.globalData.userInfo.nickname = nickname.trim();

        // Send create_room message with config
        const msg = {
            type: 'create_room',
            payload: {
                nickname: nickname.trim(),
                maxPlayers: maxPlayers,
                undercoverCount: undercoverCount
            }
        };

        if (app.globalData.socket) {
            app.globalData.socket.send({ data: JSON.stringify(msg) });
        } else {
            wx.showToast({ title: '未连接到服务器', icon: 'none' });
        }
    }
});
