
// pages/result/result.js
Page({
  data: {
    resultText: '', // e.g., "平民胜利！"
    undercoverNickname: ''
  },

  onLoad(options) {
    this.setData({
      resultText: options.resultText,
      undercoverNickname: options.undercoverNickname
    });
  },

  goHome() {
    wx.reLaunch({ url: '/pages/index/index' });
  }
});
