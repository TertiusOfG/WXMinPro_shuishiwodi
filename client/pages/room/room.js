// pages/room/room.js
const app = getApp();

Page({
  data: {
    roomId: '',
    players: [],
    spectators: [],
    isReady: false,
    isSpectator: false
  },

  onLoad(options) {
    this.setData({ roomId: options.roomId });
    app.globalData.roomId = options.roomId;

    if (app.globalData.room) {
        this.updateRoomData(app.globalData.room);
    }

    app.globalData.socket.onMessage((res) => {
      const data = JSON.parse(res.data);
      console.log('Room received:', data);

      if (data.type === 'room_update') {
        this.updateRoomData(data.payload);
        app.globalData.room = data.payload;
      } else if (data.type === 'game_started') {
        const word = this.data.isSpectator ? '' : data.payload.word;
        wx.navigateTo({ url: `/pages/game/game?word=${word}&isSpectator=${this.data.isSpectator}` });
      } else if (data.type === 'error') {
        wx.showToast({ title: data.payload.message, icon: 'none' });
      }
    });
  },

  updateRoomData(roomData) {
    const allUsers = roomData.players || [];
    const currentUser = allUsers.find(p => p.id === app.globalData.userInfo.id);

    this.setData({ 
      players: allUsers.filter(p => !p.isSpectator),
      spectators: allUsers.filter(p => p.isSpectator),
      isSpectator: currentUser ? currentUser.isSpectator : false
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

  startGame() {
    const msg = { type: 'start_game' };
    app.globalData.socket.send({ data: JSON.stringify(msg) });
  },

  onUnload() {
  }
});