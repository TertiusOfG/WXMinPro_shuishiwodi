
// pages/result/result.js
Page({
  data: {
    winnerText: '', // e.g., "平民胜利！"
    undercoverInfo: '' // e.g., "卧底是: 张三，词语是: 豆浆"
  },

  onLoad(options) {
    const { winner, undercover, word } = options;
    const winnerText = winner === 'civilian' ? '平民胜利！' : '卧底胜利！';
    const undercoverInfo = `卧底是: ${undercover}，词语是: ${word}`;

    this.setData({
      winnerText,
      undercoverInfo
    });
  },

  goHome() {
    wx.reLaunch({ url: '/pages/index/index' });
  }
});
