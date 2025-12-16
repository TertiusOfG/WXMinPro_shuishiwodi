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
    if (storedUserInfo && storedUserInfo.nickname) {
      this.globalData.userInfo.nickname = storedUserInfo.nickname;
      this.globalData.userInfo.avatarUrl = storedUserInfo.avatarUrl || '';
      console.log('Loaded user info from storage:', storedUserInfo);
      return;
    }

    // If not in storage, try to get from WeChat (requires user authorization)
    // Note: wx.getUserProfile requires user interaction, so we'll call it from pages when needed
    // For now, we'll try the deprecated wx.getUserInfo as fallback for default
    wx.getUserInfo({
      success: (res) => {
        const userInfo = res.userInfo;
        const profile = {
          nickname: userInfo.nickName || '',
          avatarUrl: userInfo.avatarUrl || ''
        };

        // Save to storage
        wx.setStorageSync('userInfo', profile);
        this.globalData.userInfo.nickname = profile.nickname;
        this.globalData.userInfo.avatarUrl = profile.avatarUrl;
        console.log('Got WeChat user info:', profile);
      },
      fail: (err) => {
        console.log('Failed to get user info, will prompt when needed:', err);
      }
    });
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
