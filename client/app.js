
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

// Add a simple message handler registry to avoid multiple pages overwriting socket.onMessage
if (!App.__wsRegistryPatched) {
  const app = getApp && getApp();
  if (app && app.globalData) {
    app.globalData.messageHandlers = {};
    app.globalData.registerMessageHandler = function(key, fn) { this.messageHandlers[key] = fn; };
    app.globalData.unregisterMessageHandler = function(key) { delete this.messageHandlers[key]; };
  }
  App.__wsRegistryPatched = true;
}
