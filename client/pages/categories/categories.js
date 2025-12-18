// pages/categories/categories.js
Page({
    data: {
        categories: []
    },

    onLoad(options) {
        // Load word pairs from local data
        // In a real implementation, this could fetch from server
        this.loadWordPairs();
    },

    loadWordPairs() {
        // Fetch from server via HTTP
        wx.request({
            url: 'http://localhost:8080/api/words',
            method: 'GET',
            success: (res) => {
                if (res.statusCode === 200 && res.data.categories) {
                    this.setData({ categories: res.data.categories });
                } else {
                    wx.showToast({
                        title: '加载词汇失败',
                        icon: 'error'
                    });
                }
            },
            fail: (err) => {
                console.error('Failed to load words:', err);
                wx.showToast({
                    title: '网络错误',
                    icon: 'error'
                });
                // Fallback to hardcoded data if server is unavailable
                const categories = [
                    {
                        name: '食物饮料',
                        words: [
                            { civilian: '牛奶', undercover: '豆浆' },
                            { civilian: '可乐', undercover: '雪碧' },
                            { civilian: '饺子', undercover: '馄饨' }
                        ]
                    },
                    {
                        name: '日常用品',
                        words: [
                            { civilian: '牙刷', undercover: '梳子' },
                            { civilian: '手机', undercover: '充电宝' },
                            { civilian: '键盘', undercover: '鼠标' }
                        ]
                    },
                    {
                        name: '运动',
                        words: [
                            { civilian: '篮球', undercover: '足球' }
                        ]
                    },
                    {
                        name: '自然',
                        words: [
                            { civilian: '夏天', undercover: '秋天' },
                            { civilian: '太阳', undercover: '月亮' }
                        ]
                    },
                    {
                        name: '人物',
                        words: [
                            { civilian: '老师', undercover: '学生' }
                        ]
                    }
                ];
                this.setData({ categories });
            }
        });
    }
});
