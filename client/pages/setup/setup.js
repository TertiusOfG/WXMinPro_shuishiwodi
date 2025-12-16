// pages/setup/setup.js
const app = getApp();

Page({
    data: {
        maxPlayers: 4,
        undercoverCount: 1,
        nickname: '',
        minUndercover: 1,
        maxUndercover: 1
    },

    onLoad(options) {
        // Pre-fill nickname if available from global data
        if (app.globalData && app.globalData.userInfo && app.globalData.userInfo.nickname) {
            this.setData({ nickname: app.globalData.userInfo.nickname });
        }

        // Calculate initial valid range
        this.updateValidRange(this.data.maxPlayers);
    },

    updateValidRange(maxPlayers) {
        const minUndercover = Math.ceil(maxPlayers / 4);
        const maxUndercover = Math.floor(maxPlayers / 3);
        this.setData({ minUndercover, maxUndercover });
    },

    onMaxPlayersInput(e) {
        const maxPlayers = parseInt(e.detail.value) || 4;
        this.setData({ maxPlayers });
        this.updateValidRange(maxPlayers);

        // Auto-adjust undercover count if it's out of valid range
        const minUndercover = Math.ceil(maxPlayers / 4);
        const maxUndercover = Math.floor(maxPlayers / 3);

        if (this.data.undercoverCount < minUndercover) {
            this.setData({ undercoverCount: minUndercover });
        } else if (this.data.undercoverCount > maxUndercover) {
            this.setData({ undercoverCount: maxUndercover });
        }
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

        // Calculate valid undercover range
        const minUndercover = Math.ceil(maxPlayers / 4);
        const maxUndercover = Math.floor(maxPlayers / 3);

        if (undercoverCount < minUndercover || undercoverCount > maxUndercover) {
            wx.showToast({
                title: `卧底人数必须在${minUndercover}到${maxUndercover}之间`,
                icon: 'none',
                duration: 2500
            });
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
