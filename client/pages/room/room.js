
// pages/room/room.js
const app = getApp();

Page({
  data: {
    roomId: '',
    players: [],
    isReady: false
  },

  onLoad(options) {
    this.setData({ roomId: options.roomId });
    app.globalData.roomId = options.roomId;

    // Listen for messages
    app.globalData.socket.onMessage((res) => {
      const data = JSON.parse(res.data);
      console.log('Room received:', data);

      if (data.type === 'room_update') {
        this.setData({ players: data.payload.players });
      } else if (data.type === 'game_started') {
        wx.navigateTo({ url: `/pages/game/game?word=${data.payload.word}` });
      } else if (data.type === 'error') {
        wx.showToast({ title: data.payload.message, icon: 'none' });
      }
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
    // Optional: Handle user leaving the room page
    // The server's ws.on('close') will handle disconnection
  }
});
