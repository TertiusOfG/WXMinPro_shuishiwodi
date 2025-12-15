// pages/categories/categories.js
Page({
    data: {
        wordPairs: []
    },

    onLoad(options) {
        // Load word pairs from local data
        // In a real implementation, this could fetch from server
        this.loadWordPairs();
    },

    loadWordPairs() {
        // Hardcoded word pairs for now
        // TODO: Fetch from server via WebSocket or HTTP
        const words = [
            { civilian: '牛奶', undercover: '豆浆' },
            { civilian: '苹果', undercover: '梨' },
            { civilian: '猫', undercover: '狗' },
            { civilian: '医生', undercover: '护士' },
            { civilian: '眼镜', undercover: '墨镜' }
        ];

        this.setData({ wordPairs: words });
    }
});
