// pages/setup/setup.js
const app = getApp();

Page({
    data: {
        maxPlayers: 4,
        undercoverCount: 1,
        nickname: '',
        minUndercover: 1,
        maxUndercover: 1,
        playerCountOptions: [],      // Array of player count options (3-20)
        playerCountIndex: 1,          // Selected index in playerCountOptions
        undercoverOptions: [],        // Array of valid undercover counts
        undercoverIndex: 0            // Selected index in undercoverOptions
    },

    onLoad(options) {
        // Pre-fill nickname if available from global data
        if (app.globalData && app.globalData.userInfo && app.globalData.userInfo.nickname) {
            this.setData({ nickname: app.globalData.userInfo.nickname });
        }

        // Initialize player count options (3-20)
        const playerOptions = [];
        for (let i = 3; i <= 20; i++) {
            playerOptions.push(i);
        }
        this.setData({ playerCountOptions: playerOptions });

        // Set default to 4 players (index 1 in array [3,4,5...])
        this.setData({ playerCountIndex: 1 }); // 4 is at index 1

        // Calculate initial valid range and undercover options
        this.updateValidRange(this.data.maxPlayers);
        this.updateUndercoverOptions(this.data.maxPlayers);
    },

    updateValidRange(maxPlayers) {
        const minUndercover = Math.ceil(maxPlayers / 4);
        const maxUndercover = Math.floor(maxPlayers / 3);
        this.setData({ minUndercover, maxUndercover });
    },

    updateUndercoverOptions(maxPlayers) {
        const minUndercover = Math.ceil(maxPlayers / 4);
        const maxUndercover = Math.floor(maxPlayers / 3);

        const options = [];
        for (let i = minUndercover; i <= maxUndercover; i++) {
            options.push(i);
        }

        this.setData({ undercoverOptions: options });

        // Auto-adjust current undercover count if out of range
        if (this.data.undercoverCount < minUndercover) {
            this.setData({
                undercoverCount: minUndercover,
                undercoverIndex: 0
            });
        } else if (this.data.undercoverCount > maxUndercover) {
            this.setData({
                undercoverCount: maxUndercover,
                undercoverIndex: options.length - 1
            });
        } else {
            // Find current undercover count in new options
            const index = options.indexOf(this.data.undercoverCount);
            this.setData({ undercoverIndex: index >= 0 ? index : 0 });
        }
    },

    onPlayerCountChange(e) {
        const index = parseInt(e.detail.value);
        const maxPlayers = this.data.playerCountOptions[index];

        this.setData({
            playerCountIndex: index,
            maxPlayers: maxPlayers
        });

        this.updateValidRange(maxPlayers);
        this.updateUndercoverOptions(maxPlayers);
    },

    onUndercoverChange(e) {
        const index = parseInt(e.detail.value);
        const undercoverCount = this.data.undercoverOptions[index];

        this.setData({
            undercoverIndex: index,
            undercoverCount: undercoverCount
        });
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

        if (maxPlayers < 3 || maxPlayers > 20) {
            wx.showToast({ title: '玩家总人数必须在3-20之间', icon: 'none' });
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
