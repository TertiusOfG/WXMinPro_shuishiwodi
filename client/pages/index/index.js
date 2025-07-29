
// pages/index/index.js
const app = getApp();

Page({
  data: {
    nickname: '',
    roomId: ''
  },

  onLoad() {
    // Connect to WebSocket server
    const socket = wx.connectSocket({
      url: 'ws://localhost:8080' // Make sure this matches your server address
    });

    socket.onOpen(() => {
      console.log('WebSocket connected!');
      app.globalData.socket = socket;
    });

    socket.onMessage((res) => {
      const data = JSON.parse(res.data);
      console.log('Received from server:', data);

      if (data.type === 'room_created') {
        app.globalData.roomId = data.payload.roomId;
        wx.navigateTo({ url: `/pages/room/room?roomId=${data.payload.roomId}` });
      } else if (data.type === 'room_update') {
        // This is for when joining a room, the server confirms by sending a room_update
        if (this.data.roomId) { // Ensure we intended to join
          wx.navigateTo({ url: `/pages/room/room?roomId=${this.data.roomId}` });
        }
      } else if (data.type === 'error') {
        wx.showToast({
          title: data.payload.message,
          icon: 'none'
        });
      }
    });

    socket.onError((err) => {
      console.error('WebSocket error:', err);
      wx.showToast({ title: '无法连接到服务器', icon: 'none' });
    });
  },

  onNicknameInput(e) {
    this.setData({ nickname: e.detail.value });
  },

  onRoomIdInput(e) {
    this.setData({ roomId: e.detail.value });
  },

  createRoom() {
    if (!this.data.nickname) {
      wx.showToast({ title: '请输入昵称', icon: 'none' });
      return;
    }
    app.globalData.nickname = this.data.nickname;
    const msg = {
      type: 'create_room',
      payload: { nickname: this.data.nickname }
    };
    app.globalData.socket.send({ data: JSON.stringify(msg) });
  },

  joinRoom() {
    if (!this.data.nickname || !this.data.roomId) {
      wx.showToast({ title: '请输入昵称和房间号', icon: 'none' });
      return;
    }
    app.globalData.nickname = this.data.nickname;
    app.globalDara.roomId = this.data.roomId;
    const msg = {
      type: 'join_room',
      payload: { nickname: this.data.nickname, roomId: this.data.roomId }
    };
    app.globalData.socket.send({ data: JSON.stringify(msg) });
  }
});
