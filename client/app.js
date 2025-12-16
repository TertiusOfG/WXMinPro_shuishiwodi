// app.js
App({
  globalData: {
    userInfo: {
      id: null,
      nickname: '',
      avatarUrl: '' // NEW: Store WeChat avatar URL
    },
    socket: null,
    roomId: null,
    room: null
  },

  onLaunch() {
    // NEW: Get WeChat user profile on app launch
    this.getUserProfile();
  },

  getUserProfile() {
    // Try to get user info from storage first
    const storedUserInfo = wx.getStorageSync('userInfo');
    if (storedUserInfo && storedUserInfo.nickname && storedUserInfo.avatarUrl) {
      this.globalData.userInfo.nickname = storedUserInfo.nickname;
      this.globalData.userInfo.avatarUrl = storedUserInfo.avatarUrl;
      console.log('Loaded user info from storage:', storedUserInfo);
      return;
    }

    // If not in storage, we'll prompt user to authorize when needed
    // WeChat requires user interaction to get profile, so we'll do this in pages
    console.log('No stored user info, will prompt when needed');
  }
})

// Add a simple message handler registry to avoid multiple pages overwriting socket.onMessage
if (!App.__wsRegistryPatched) {
  const app = getApp && getApp();
  if (app && app.globalData) {
    app.globalData.messageHandlers = {};
    app.globalData.registerMessageHandler = function (key, fn) { this.messageHandlers[key] = fn; };
    app.globalData.unregisterMessageHandler = function (key) { delete this.messageHandlers[key]; };
  }
  App.__wsRegistryPatched = true;
}
