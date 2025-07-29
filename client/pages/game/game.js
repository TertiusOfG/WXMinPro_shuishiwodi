
// pages/game/game.js
const app = getApp();

Page({
  data: {
    word: '',
    players: [],
    gameState: 'playing' // playing, voting, finished
  },

  onLoad(options) {
    this.setData({ word: options.word });

    // Get the initial list of players from the global data or room page
    // For simplicity, we'll just listen for the next room_update

    app.globalData.socket.onMessage((res) => {
      const data = JSON.parse(res.data);
      console.log('Game page received:', data);

      if (data.type === 'room_update') {
        this.setData({
          players: data.payload.players,
          gameState: data.payload.gameState
        });
      }
      // We will add more handlers here for voting results, etc.
    });
  },

  // We will add functions for player actions like voting here

  onUnload() {
    // Handle disconnection
  }
});
