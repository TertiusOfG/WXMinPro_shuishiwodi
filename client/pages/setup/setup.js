// pages/setup/setup.js
const app = getApp();

Page({
    data: {
        maxPlayers: 4,
        undercoverCount: 1,
        nickname: '',
        avatarUrl: '',  // NEW: User avatar URL
        minUndercover: 1,
        maxUndercover: 1,
        playerCountOptions: [],      // Array of player count options (3-20)
        playerCountIndex: 1,          // Selected index in playerCountOptions
        undercoverOptions: [],        // Array of valid undercover counts
        undercoverIndex: 0,           // Selected index in undercoverOptions
        categories: [],               // Array of category objects from server
        categoryNames: ['全部'],      // Array of category names for picker
        categoryIndex: 0,             // Selected index in categoryNames
        selectedCategory: '全部'      // Selected category name
    },

    onLoad(options) {
        // NEW: Load user profile from storage or app global data
        const storedUserInfo = wx.getStorageSync('userInfo');
        let defaultNickname = '';
        let defaultAvatar = '';

        if (storedUserInfo && storedUserInfo.nickname) {
            defaultNickname = storedUserInfo.nickname;
            defaultAvatar = storedUserInfo.avatarUrl || '';
        } else if (app.globalData && app.globalData.userInfo && app.globalData.userInfo.nickname) {
            defaultNickname = app.globalData.userInfo.nickname;
            defaultAvatar = app.globalData.userInfo.avatarUrl || '';
        }

        this.setData({
            nickname: defaultNickname,
            avatarUrl: defaultAvatar
        });

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

        // Load categories from server
        this.loadCategories();

        // FIX: Register message handler to receive room_created response
        this._handlerKey = `setup_${Math.random().toString(36).substring(2, 8)}`;
        app.globalData.registerMessageHandler(this._handlerKey, (res) => {
            const data = JSON.parse(res.data);
            console.log('Setup received:', data);

            if (data.type === 'room_created') {
                app.globalData.roomId = data.payload.roomId;

                // Store room config immediately so room page can display it
                app.globalData.room = {
                    roomId: data.payload.roomId,
                    maxPlayers: data.payload.maxPlayers,
                    undercoverCount: data.payload.undercoverCount
                };

                // Unregister handler before navigating
                if (this._handlerKey && app.globalData && app.globalData.unregisterMessageHandler) {
                    app.globalData.unregisterMessageHandler(this._handlerKey);
                }

                wx.navigateTo({ url: `/pages/room/room?roomId=${data.payload.roomId}` });
            } else if (data.type === 'error') {
                wx.showToast({ title: data.payload.message, icon: 'none' });
            }
        });
    },

    onUnload() {
        // FIX: Send leave_room to clean up server state if user backs out
        // This handles the case where user navigates back before room is fully created
        try {
            if (app.globalData && app.globalData.socket && app.globalData.roomId) {
                app.globalData.socket.send({ data: JSON.stringify({ type: 'leave_room' }) });
                app.globalData.roomId = null;
                app.globalData.room = null;
            }
        } catch (e) {
            console.warn('setup onUnload: leave_room send failed', e);
        }

        // Unregister message handler when leaving page
        if (this._handlerKey && app.globalData && app.globalData.unregisterMessageHandler) {
            app.globalData.unregisterMessageHandler(this._handlerKey);
        }
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

    loadCategories() {
        // Fetch categories from server
        wx.request({
            url: 'http://localhost:8080/api/words',
            method: 'GET',
            success: (res) => {
                if (res.statusCode === 200 && res.data.categories) {
                    const categories = res.data.categories;
                    const categoryNames = ['全部', ...categories.map(cat => cat.name)];
                    this.setData({
                        categories,
                        categoryNames
                    });
                }
            },
            fail: (err) => {
                console.error('Failed to load categories:', err);
                // Keep default '全部' option on failure
            }
        });
    },

    onCategoryChange(e) {
        const index = parseInt(e.detail.value);
        const selectedCategory = this.data.categoryNames[index];

        this.setData({
            categoryIndex: index,
            selectedCategory: selectedCategory
        });
    },

    onNicknameInput(e) {
        const nickname = e.detail.value;
        this.setData({ nickname });

        // Save to storage
        const userInfo = wx.getStorageSync('userInfo') || {};
        userInfo.nickname = nickname;
        wx.setStorageSync('userInfo', userInfo);

        // Update global data
        if (app.globalData && app.globalData.userInfo) {
            app.globalData.userInfo.nickname = nickname;
        }
    },

    // NEW: Handle avatar selection
    onChooseAvatar(e) {
        const { avatarUrl } = e.detail;
        this.setData({ avatarUrl });

        // Save to storage
        const userInfo = wx.getStorageSync('userInfo') || {};
        userInfo.avatarUrl = avatarUrl;
        wx.setStorageSync('userInfo', userInfo);

        // Update global data
        if (app.globalData && app.globalData.userInfo) {
            app.globalData.userInfo.avatarUrl = avatarUrl;
        }
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
                undercoverCount: undercoverCount,
                selectedCategory: this.data.selectedCategory
            }
        };

        if (app.globalData.socket) {
            app.globalData.socket.send({ data: JSON.stringify(msg) });
        } else {
            wx.showToast({ title: '未连接到服务器', icon: 'none' });
        }
    }
});
