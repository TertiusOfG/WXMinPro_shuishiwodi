// pages/index/index.js
const app = getApp();

Page({
  data: {
    nickname: '',
    roomId: '',
    isSpectator: false,
    showModal: false,  // Control join modal visibility
    avatarUrl: ''      // NEW: User avatar URL
  },

  onLoad(options) {
    // NEW: Load user profile from storage
    const storedUserInfo = wx.getStorageSync('userInfo');
    if (storedUserInfo) {
      this.setData({
        nickname: storedUserInfo.nickname || '',
        avatarUrl: storedUserInfo.avatarUrl || ''
      });
    }

    // If opened via share link, prefill roomId and show modal
    if (options && options.roomId) {
      this.setData({ roomId: options.roomId, showModal: true });
      if (app.globalData) app.globalData.roomId = options.roomId;
    }
    // Connect to WebSocket server
    const socket = wx.connectSocket({
      url: 'ws://localhost:8080' // Make sure this matches your server address
    });

    socket.onOpen(() => {
      console.log('WebSocket connected!');
      app.globalData.socket = socket;
      // ensure message handler registry exists
      if (!app.globalData.messageHandlers) {
        app.globalData.messageHandlers = {};
        app.globalData.registerMessageHandler = function (key, fn) { this.messageHandlers[key] = fn; };
        app.globalData.unregisterMessageHandler = function (key) { delete this.messageHandlers[key]; };
      }

      // set a single dispatcher for incoming messages that forwards to registered handlers
      socket.onMessage((res) => {
        const handlers = app.globalData.messageHandlers || {};
        for (const k in handlers) {
          try { handlers[k](res); } catch (e) { console.error('handler', k, 'error', e); }
        }
      });

      // register index's own handler into the registry
      app.globalData.registerMessageHandler('index', (res) => {
        const data = JSON.parse(res.data);
        console.log('Received from server:', data);

        if (data.type === 'connected') {
          app.globalData.userInfo.id = data.payload.id;
        } else if (data.type === 'room_created') {
          app.globalData.roomId = data.payload.roomId;

          // FIX: Store room config immediately so room page can display it
          app.globalData.room = {
            roomId: data.payload.roomId,
            maxPlayers: data.payload.maxPlayers,
            undercoverCount: data.payload.undercoverCount
          };

          // unregister index handler before navigating so it doesn't handle future messages
          if (app.globalData && app.globalData.unregisterMessageHandler) {
            app.globalData.unregisterMessageHandler('index');
          }
          wx.navigateTo({ url: `/pages/room/room?roomId=${data.payload.roomId}` });
        } else if (data.type === 'room_update') {
          // Store room state globally so the room page can use it immediately after navigation
          app.globalData.room = data.payload;
          // ensure global roomId is set when we just joined
          if (data.payload && data.payload.roomId) app.globalData.roomId = data.payload.roomId;
          // This is for when joining a room, the server confirms by sending a room_update
          if (this.data.roomId) { // Ensure we intended to join
            // If server marks us as a spectator and the game is already playing, go straight to spectate view
            const me = (data.payload.players || []).find(p => p.id === app.globalData.userInfo.id);
            const isSpectatorServer = me ? !!me.isSpectator : false;
            if (data.payload.gameState === 'playing' && isSpectatorServer) {
              if (app.globalData && app.globalData.unregisterMessageHandler) app.globalData.unregisterMessageHandler('index');
              wx.navigateTo({ url: `/pages/game/game?word=&isSpectator=true` });
            } else {
              if (app.globalData && app.globalData.unregisterMessageHandler) app.globalData.unregisterMessageHandler('index');
              wx.navigateTo({ url: `/pages/room/room?roomId=${this.data.roomId}` });
            }
          }
        } else if (data.type === 'room_closed') {
          // Room was closed by the creator while on index: clear any stale room info
          wx.showToast({ title: data.payload && data.payload.message ? data.payload.message : '房间已关闭', icon: 'none' });
          if (app.globalData) {
            app.globalData.room = null;
            app.globalData.roomId = null;
          }
        } else if (data.type === 'nick_taken') {
          // Specific handling for nickname collision: show modal and keep user on index
          wx.showModal({
            title: '昵称已占用',
            content: data.payload && data.payload.message ? data.payload.message : '该昵称已被房间内其他玩家使用，请换一个昵称',
            showCancel: false
          });
        } else if (data.type === 'error') {
          wx.showToast({
            title: data.payload.message,
            icon: 'none'
          });
        }
      });

      // unregister index handler when leaving the page
      const pageOnUnload = this.onUnload;
      this.onUnload = function () {
        if (app.globalData && app.globalData.unregisterMessageHandler) {
          app.globalData.unregisterMessageHandler('index');
        }
        if (typeof pageOnUnload === 'function') pageOnUnload.apply(this, arguments);
      };
    });

    socket.onError((err) => {
      console.error('WebSocket error:', err);
      wx.showToast({ title: '无法连接到服务器', icon: 'none' });
    });
  },

  onShow() {
    // Re-register index handler if socket already connected and handler missing
    if (app.globalData && app.globalData.socket && app.globalData.registerMessageHandler) {
      if (!app.globalData.messageHandlers || !app.globalData.messageHandlers['index']) {
        // reuse the same logic as in onLoad to handle incoming messages
        app.globalData.registerMessageHandler('index', (res) => {
          const data = JSON.parse(res.data);
          console.log('Received from server:', data);

          if (data.type === 'connected') {
            app.globalData.userInfo.id = data.payload.id;
          } else if (data.type === 'room_created') {
            app.globalData.roomId = data.payload.roomId;
            if (app.globalData && app.globalData.unregisterMessageHandler) {
              app.globalData.unregisterMessageHandler('index');
            }
            wx.navigateTo({ url: `/pages/room/room?roomId=${data.payload.roomId}` });
          } else if (data.type === 'room_update') {
            app.globalData.room = data.payload;
            if (data.payload && data.payload.roomId) app.globalData.roomId = data.payload.roomId;
            if (this.data.roomId) {
              const me = (data.payload.players || []).find(p => p.id === app.globalData.userInfo.id);
              const isSpectatorServer = me ? !!me.isSpectator : false;
              if (data.payload.gameState === 'playing' && isSpectatorServer) {
                if (app.globalData && app.globalData.unregisterMessageHandler) {
                  app.globalData.unregisterMessageHandler('index');
                }
                wx.navigateTo({ url: `/pages/game/game?word=&isSpectator=true` });
              } else {
                if (app.globalData && app.globalData.unregisterMessageHandler) {
                  app.globalData.unregisterMessageHandler('index');
                }
                wx.navigateTo({ url: `/pages/room/room?roomId=${this.data.roomId}` });
              }
            }
          } else if (data.type === 'room_closed') {
            wx.showToast({ title: data.payload && data.payload.message ? data.payload.message : '房间已关闭', icon: 'none' });
            if (app.globalData) {
              app.globalData.room = null;
              app.globalData.roomId = null;
            }
          } else if (data.type === 'nick_taken') {
            wx.showModal({ title: '昵称已占用', content: data.payload && data.payload.message ? data.payload.message : '该昵称已被房间内其他玩家使用，请换一个昵称', showCancel: false });
          } else if (data.type === 'error') {
            wx.showToast({ title: data.payload.message, icon: 'none' });
          }
        });
      }
    }
  },

  // NEW: Navigate to setup page
  goToSetup() {
    wx.navigateTo({ url: '/pages/setup/setup' });
  },

  // NEW: Show join room modal
  showJoinModal() {
    this.setData({ showModal: true });
  },

  // NEW: Hide join room modal
  hideJoinModal() {
    this.setData({ showModal: false });
  },

  // NEW: Stop propagation to prevent closing modal when clicking inside
  stopPropagation() {
    // Do nothing, just prevent event bubbling
  },

  // NEW: Navigate to categories page
  goToCategories() {
    wx.navigateTo({ url: '/pages/categories/categories' });
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

  onRoomIdInput(e) {
    this.setData({ roomId: e.detail.value });
  },

  onSpectatorChange(e) {
    this.setData({
      isSpectator: e.detail.value.includes('true')
    });
  },

  joinRoom() {
    if (!this.data.nickname || !this.data.roomId) {
      wx.showToast({ title: '请输入昵称和房间号', icon: 'none' });
      return;
    }
    app.globalData.userInfo.nickname = this.data.nickname;
    app.globalData.roomId = this.data.roomId;
    const msg = {
      type: 'join_room',
      payload: {
        nickname: this.data.nickname,
        roomId: this.data.roomId,
        isSpectator: this.data.isSpectator
      }
    };
    app.globalData.socket.send({ data: JSON.stringify(msg) });

    // Hide modal after sending join request
    this.setData({ showModal: false });
  }
});