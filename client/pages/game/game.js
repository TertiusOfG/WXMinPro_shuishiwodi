// pages/game/game.js
const app = getApp();

Page({
  data: {
    word: '',
    players: [],
    gameState: 'playing', // playing, voting, finished
    currentPlayerId: null,
    currentPlayerNickname: '',
    selectedPlayerId: null,
    isMyTurn: false,
    hasVoted: false,
    speeches: [],
    speechInput: '',
    myId: '',
    scrollTop: 0,
    toView: '',
    isSpectator: false,
    // new fields
    isCreator: false,
    creatorId: null,
    voteProgress: '',
    showCategory: false,
    selectedCategory: ''
  },

  onLoad(options) {
    this.setData({
      word: options.word,
      myId: app.globalData.userInfo.id,
      isSpectator: options.isSpectator === 'true',
      myNickname: app.globalData.userInfo && app.globalData.userInfo.nickname ? app.globalData.userInfo.nickname : ''
    });

    // initialize from global room if available
    if (app.globalData.room) {
      const room = app.globalData.room;
      this.updatePlayers(room.players || []);
      const payloadCurrent = room.currentPlayerId || null;
      const myId = app.globalData.userInfo.id;
      this.setData({
        currentPlayerId: payloadCurrent,
        isMyTurn: payloadCurrent === myId,
        gameState: room.gameState || this.data.gameState,
        creatorId: room.creatorId || null,
        isCreator: (room.creatorId === myId)
      }, () => {
        this.updateCurrentPlayerNickname();
      });
    } else {
      this.updatePlayers([]);
      this.updateCurrentPlayerNickname();
    }

    // register message handler
    this._handlerKey = `game_${Math.random().toString(36).substring(2, 8)}`;
    if (app.globalData && app.globalData.registerMessageHandler) {
      app.globalData.registerMessageHandler(this._handlerKey, (res) => {
        const data = JSON.parse(res.data);
        console.log('Game page received:', data);

        switch (data.type) {
          case 'room_closed':
            wx.showToast({ title: data.payload && data.payload.message ? data.payload.message : '房间已关闭', icon: 'none' });
            if (app.globalData) { app.globalData.room = null; app.globalData.roomId = null; }
            if (this._handlerKey && app.globalData && app.globalData.unregisterMessageHandler) {
              app.globalData.unregisterMessageHandler(this._handlerKey);
            }
            wx.reLaunch({ url: '/pages/index/index' });
            break;

          case 'room_update':
            this.updatePlayers(data.payload.players || []);
            const payloadCurrent = data.payload.currentPlayerId || null;
            const myId = app.globalData.userInfo.id;
            this.setData({
              gameState: data.payload.gameState,
              currentPlayerId: payloadCurrent,
              isMyTurn: payloadCurrent === myId,
              creatorId: data.payload.creatorId || null,
              isCreator: (data.payload.creatorId === myId),
              showCategory: data.payload.showCategory || false,
              selectedCategory: data.payload.selectedCategory || ''
            }, () => {
              this.updateCurrentPlayerNickname();
            });
            break;

          case 'turn_update':
            const myPlayerId = app.globalData.userInfo.id;
            this.setData({
              currentPlayerId: data.payload.currentPlayerId,
              isMyTurn: data.payload.currentPlayerId === myPlayerId,
              gameState: 'playing'
            }, () => this.updateCurrentPlayerNickname());
            break;

          case 'new_speech':
            const newSpeeches = [...this.data.speeches, data.payload];
            const newIndex = newSpeeches.length - 1;
            this.setData({ speeches: newSpeeches, toView: `speech-${newIndex}` });
            break;

          case 'vote_update':
            this.setData({ voteProgress: `${data.payload.votesReceived}/${data.payload.total}` });
            break;

          case 'vote_error':
            wx.showToast({ title: data.payload.message || '投票错误', icon: 'none' });
            break;

          case 'game_over':
            wx.redirectTo({ url: `../result/result?winner=${data.payload.winner}&undercover=${data.payload.undercoverNickname}&word=${data.payload.undercoverWord}` });
            break;

          case 'game_terminated':
            wx.showToast({ title: data.payload && data.payload.message ? data.payload.message : '游戏已被终止', icon: 'none' });
            // return to room view
            if (app.globalData && app.globalData.roomId) {
              wx.redirectTo({ url: `../room/room?roomId=${app.globalData.roomId}` });
            } else {
              wx.reLaunch({ url: '/pages/index/index' });
            }
            break;
        }
      });
    }
  },

  updatePlayers(players) {
    const styledPlayers = this.calculatePlayerPositions(players);
    this.setData({ players: styledPlayers });
  },

  calculatePlayerPositions(players) {
    const numPlayers = players.length;
    if (numPlayers === 0) return [];

    const radius = 140; // rpx
    const containerSize = 360; // rpx
    const cardSize = 150; // rpx

    return players.map((player, index) => {
      const angle = (index / numPlayers) * 2 * Math.PI - (Math.PI / 2);
      const x = (containerSize / 2) + radius * Math.cos(angle) - (cardSize / 2);
      const y = (containerSize / 2) + radius * Math.sin(angle) - (cardSize / 2);
      player.style = `top: ${y}rpx; left: ${x}rpx;`;
      return player;
    });
  },

  updateCurrentPlayerNickname() {
    if (this.data.currentPlayerId && this.data.players.length > 0) {
      const currentPlayer = this.data.players.find(p => p.id === this.data.currentPlayerId);
      this.setData({ currentPlayerNickname: currentPlayer ? currentPlayer.nickname : '' });
    } else {
      this.setData({ currentPlayerNickname: '' });
    }
  },

  onSpeechInput(e) {
    this.setData({ speechInput: e.detail.value });
  },

  submitSpeech() {
    const msg = this.data.speechInput.trim();
    if (!msg) {
      wx.showToast({ title: '请输入发言内容', icon: 'none' });
      return;
    }

    // Get avatar URL from storage
    const storedUserInfo = wx.getStorageSync('userInfo');
    const avatarUrl = storedUserInfo && storedUserInfo.avatarUrl ? storedUserInfo.avatarUrl : '';

    const payload = {
      type: 'player_action',
      payload: {
        action: 'speak',
        message: msg,
        avatarUrl: avatarUrl  // NEW: Include avatar URL
      }
    };
    app.globalData.socket.send({ data: JSON.stringify(payload) });
    this.setData({ speechInput: '' });
  },

  handleVote(e) {
    if (this.data.isSpectator || this.data.gameState !== 'voting') return;
    const targetId = e.currentTarget.dataset.targetId;
    const player = this.data.players.find(p => p.id === targetId);
    if (!player) return;
    if (targetId === app.globalData.userInfo.id || player.isEliminated) return;
    if (player.isSpectator) {
      wx.showToast({ title: '无法给观战者投票', icon: 'none' });
      return;
    }
    this.setData({ selectedPlayerId: targetId });
  },

  submitVote() {
    if (this.data.selectedPlayerId) {
      const target = this.data.players.find(p => p.id === this.data.selectedPlayerId);
      if (target && target.isSpectator) {
        wx.showToast({ title: '无法给观战者投票', icon: 'none' });
        this.setData({ selectedPlayerId: null });
        return;
      }
      app.globalData.socket.send({ data: JSON.stringify({ type: 'player_action', payload: { action: 'vote', targetId: this.data.selectedPlayerId } }) });
      this.setData({ selectedPlayerId: null, hasVoted: true });
    }
  },

  endGame() {
    if (!this.data.isCreator) return;
    wx.showModal({
      title: '确认', content: '确定要结束当前游戏吗？', success: (res) => {
        if (res.confirm) {
          try {
            app.globalData.socket.send({ data: JSON.stringify({ type: 'end_game' }) });
          } catch (e) {
            wx.showToast({ title: '无法发送结束命令', icon: 'none' });
          }
        }
      }
    });
  },

  onUnload() {
    // If this user is a spectator and is leaving the game page (e.g. pressed back), notify server that they leave the room
    try {
      if (this.data.isSpectator && app.globalData && app.globalData.socket && app.globalData.roomId) {
        app.globalData.socket.send({ data: JSON.stringify({ type: 'leave_room' }) });
      }
    } catch (e) {
      // ignore send errors
    }

    if (this._handlerKey && app.globalData && app.globalData.unregisterMessageHandler) {
      app.globalData.unregisterMessageHandler(this._handlerKey);
    }
  }
});
