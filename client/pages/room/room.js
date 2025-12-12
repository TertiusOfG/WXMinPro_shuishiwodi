// pages/room/room.js
const app = getApp();

Page({
  data: {
    roomId: '',
    players: [],
    spectators: [],
    isReady: false,
    isSpectator: false
    ,myNickname: ''
    ,creatorId: null
    ,isCreator: false
  },

  onLoad(options) {
    this.setData({ roomId: options.roomId });
    app.globalData.roomId = options.roomId;

    // Prefill myNickname from global user info if available
    if (app.globalData && app.globalData.userInfo && app.globalData.userInfo.nickname) {
      this.setData({ myNickname: app.globalData.userInfo.nickname });
    }

    if (app.globalData.room) {
        this.updateRoomData(app.globalData.room);
    } else {
        // Request room state from server in case of re-join or race
        try {
          app.globalData.socket.send({ data: JSON.stringify({ type: 'get_room_state', payload: { roomId: options.roomId } }) });
        } catch (e) {
          console.warn('get_room_state send failed', e);
        }
    }
    // register a message handler so we don't overwrite global socket.onMessage
    this._handlerKey = `room_${Math.random().toString(36).substring(2,8)}`;
    app.globalData.registerMessageHandler(this._handlerKey, (res) => {
      const data = JSON.parse(res.data);
      console.log('Room received:', data);

      if (data.type === 'room_update') {
        this.updateRoomData(data.payload);
        app.globalData.room = data.payload;

        // If the room has moved to playing and this client is a spectator, navigate to game spectate view
        try {
          const allUsers = data.payload.players || [];
          const me = allUsers.find(p => p.id === (app.globalData.userInfo && app.globalData.userInfo.id));
          if (data.payload.gameState === 'playing' && me && me.isSpectator) {
            // navigate to game page as spectator
            wx.navigateTo({ url: `/pages/game/game?word=&isSpectator=true` });
          }
        } catch (e) {
          console.warn('spectator navigate on room_update failed', e);
        }
      } else if (data.type === 'room_closed') {
        // Room was closed by the creator; notify user and navigate back to index
        wx.showToast({ title: data.payload && data.payload.message ? data.payload.message : '房间已关闭', icon: 'none' });
        // clear local/global room info
        if (app.globalData) {
          app.globalData.room = null;
          app.globalData.roomId = null;
        }
        // unregister this handler then navigate back
        if (this._handlerKey && app.globalData && app.globalData.unregisterMessageHandler) {
          app.globalData.unregisterMessageHandler(this._handlerKey);
        }
        // navigate back to index (use reLaunch to reset stack)
        wx.reLaunch({ url: '/pages/index/index' });
      } else if (data.type === 'game_started') {
        const word = this.data.isSpectator ? '' : data.payload.word;
        wx.navigateTo({ url: `/pages/game/game?word=${word}&isSpectator=${this.data.isSpectator}` });
      } else if (data.type === 'error') {
        wx.showToast({ title: data.payload.message, icon: 'none' });
      }
    });
  },

  // Provide share data when user shares the room page
  onShareAppMessage() {
    const rid = this.data.roomId || app.globalData.roomId || '';
    const title = rid ? `来加入我的房间 ${rid} 一起来玩` : '来和我一起玩游戏！';
    const path = `/pages/index/index?roomId=${rid}`;
    return {
      title,
      path
    };
  },

  updateRoomData(roomData) {
    const allUsers = roomData.players || [];
    const currentUser = allUsers.find(p => p.id === app.globalData.userInfo.id);

    this.setData({ 
      players: allUsers.filter(p => !p.isSpectator),
      spectators: allUsers.filter(p => p.isSpectator),
      isSpectator: currentUser ? currentUser.isSpectator : false,
      isReady: currentUser ? !!currentUser.isReady : false,
      myNickname: (currentUser && currentUser.nickname) ? currentUser.nickname : (app.globalData.userInfo && app.globalData.userInfo.nickname ? app.globalData.userInfo.nickname : '')
      ,creatorId: roomData.creatorId || null
      ,isCreator: (roomData.creatorId === (app.globalData.userInfo && app.globalData.userInfo.id))
    });
  },

  toggleReady() {
    const newReadyState = !this.data.isReady;
    this.setData({ isReady: newReadyState });

    const msg = {
      type: 'player_ready',
      payload: { isReady: newReadyState }
    };
    app.globalData.socket.send({ data: JSON.stringify(msg) });
  },

  leaveRoom() {
    // Send leave message to server and navigate back
    try {
      app.globalData.socket.send({ data: JSON.stringify({ type: 'leave_room' }) });
    } catch (e) {
      console.warn('leaveRoom: socket send failed', e);
    }
    // mark leaving to avoid duplicate sends in onUnload
    this._leaving = true;
    // Clean up local global room state if present
    if (app.globalData) app.globalData.room = null;
    // If there is a previous page in the stack, navigate back; otherwise reLaunch to index
    const pages = getCurrentPages();
    if (pages && pages.length > 1) {
      wx.navigateBack();
    } else {
      wx.reLaunch({ url: '/pages/index/index' });
    }
  },

  startGame() {
    const msg = { type: 'start_game' };
    app.globalData.socket.send({ data: JSON.stringify(msg) });
  },

  onUnload() {
    // send leave_room so server updates player list when user navigates back
    try {
      // only send if we didn't already send via explicit leave button
      if (!this._leaving && app.globalData && app.globalData.socket) {
        app.globalData.socket.send({ data: JSON.stringify({ type: 'leave_room' }) });
      }
    } catch (e) {
      console.warn('onUnload leave_room send failed', e);
    }
    // unregister message handler
    if (this._handlerKey) app.globalData.unregisterMessageHandler(this._handlerKey);
  }
});