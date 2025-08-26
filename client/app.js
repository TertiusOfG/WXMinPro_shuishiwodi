
// app.js
App({
  onLaunch() {
    // Do something when launch.
  },
  globalData: {
    userInfo: {}, // Will store { id, nickname }
    socket: null,
    roomId: null,
    room: null
  }
})
