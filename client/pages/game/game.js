
// pages/game/game.js
const app = getApp();

Page({
  data: {
    word: '',
    players: [],
    gameState: 'playing', // playing, voting, finished
    currentPlayerId: null,
    selectedPlayerId: null,
    isMyTurn: false,
    speeches: [],
    speechInput: ''
  },

  onLoad(options) {
    this.setData({ 
      word: options.word,
      players: app.globalData.room.players
    });

    app.globalData.socket.onMessage((res) => {
      const data = JSON.parse(res.data);
      console.log('Game page received:', data);

      switch (data.type) {
        case 'room_update':
          this.setData({
            players: data.payload.players,
            gameState: data.payload.gameState
          });
          break;
        case 'turn_update':
          const myPlayerId = app.globalData.userInfo.id;
          this.setData({
            currentPlayerId: data.payload.currentPlayerId,
            isMyTurn: data.payload.currentPlayerId === myPlayerId,
            gameState: 'playing'
          });
          break;
        case 'new_speech':
          this.setData({
            speeches: [...this.data.speeches, data.payload]
          });
          break;
        case 'game_over':
          wx.redirectTo({
            url: `../result/result?winner=${data.payload.winner}&undercover=${data.payload.undercoverNickname}&word=${data.payload.undercoverWord}`
          });
          break;
      }
    });
  },

  onSpeechInput(e) {
    this.setData({ speechInput: e.detail.value });
  },

  submitSpeech() {
    if (!this.data.speechInput.trim()) {
      wx.showToast({ title: '发言不能为空', icon: 'none' });
      return;
    }
    app.globalData.socket.send({
      data: JSON.stringify({
        type: 'player_action',
        payload: {
          action: 'speak',
          message: this.data.speechInput
        }
      })
    });
    this.setData({ speechInput: '' });
  },

  handleVote(e) {
    if (this.data.gameState !== 'voting') return; // Only allow voting in voting phase

    const targetId = e.currentTarget.dataset.targetId;
    const player = this.data.players.find(p => p.id === targetId);

    if (targetId === app.globalData.userInfo.id || player.isEliminated) {
      return;
    }

    this.setData({
      selectedPlayerId: targetId
    });
  },

  submitVote() {
    if (this.data.selectedPlayerId) {
      app.globalData.socket.send({
        data: JSON.stringify({
          type: 'player_action',
          payload: {
            action: 'vote',
            targetId: this.data.selectedPlayerId
          }
        })
      });
      this.setData({
        selectedPlayerId: null,
        gameState: 'waiting_for_results' // To prevent multiple votes
      });
    }
  },

  onUnload() {
  }
});
