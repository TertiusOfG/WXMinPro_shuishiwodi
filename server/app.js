
const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const fs = require('fs');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

// Load words from JSON file
const words = JSON.parse(fs.readFileSync('words.json', 'utf8'));

// In-memory store for rooms and players
const rooms = {};

// Helper to generate a unique room ID
const generateRoomId = () => {
    let id;
    do {
        id = Math.random().toString(36).substring(2, 8).toUpperCase();
    } while (rooms[id]);
    return id;
};

// Helper to broadcast data to all clients in a room
const broadcastRoomState = (roomId) => {
    const room = rooms[roomId];
    if (!room) return;

    const state = {
        type: 'room_update',
        payload: {
            roomId: room.id,
            players: room.players.map(p => ({ id: p.id, nickname: p.nickname, isReady: p.isReady })),
            gameState: room.gameState,
        }
    };

    room.players.forEach(player => {
        player.ws.send(JSON.stringify(state));
    });
};

wss.on('connection', (ws) => {
    let playerId = Math.random().toString(36).substring(2, 12);
    let playerRoomId = null;

    console.log(`Client ${playerId} connected`);

    ws.on('message', (message) => {
        const data = JSON.parse(message);
        const { type, payload } = data;

        switch (type) {
            case 'create_room':
                const roomId = generateRoomId();
                rooms[roomId] = {
                    id: roomId,
                    players: [{ id: playerId, nickname: payload.nickname, isReady: false, ws }],
                    gameState: 'waiting', // waiting, playing, finished
                };
                playerRoomId = roomId;
                ws.send(JSON.stringify({ type: 'room_created', payload: { roomId } }));
                broadcastRoomState(roomId);
                break;

            case 'join_room':
                const roomToJoin = rooms[payload.roomId];
                if (roomToJoin && roomToJoin.gameState === 'waiting') {
                    roomToJoin.players.push({ id: playerId, nickname: payload.nickname, isReady: false, ws });
                    playerRoomId = payload.roomId;
                    broadcastRoomState(payload.roomId);
                } else {
                    ws.send(JSON.stringify({ type: 'error', payload: { message: 'Room not found or game already started.' } }));
                }
                break;

            case 'player_ready':
                const readyRoom = rooms[playerRoomId];
                if (readyRoom) {
                    const player = readyRoom.players.find(p => p.id === playerId);
                    if (player) {
                        player.isReady = payload.isReady;
                        broadcastRoomState(playerRoomId);
                    }
                }
                break;

            case 'start_game':
                const gameRoom = rooms[playerRoomId];
                if (gameRoom && gameRoom.players.every(p => p.isReady)) {
                    gameRoom.gameState = 'playing';
                    
                    // Assign words
                    const wordPair = words[Math.floor(Math.random() * words.length)];
                    const undercoverIndex = Math.floor(Math.random() * gameRoom.players.length);
                    
                    gameRoom.players.forEach((player, index) => {
                        const word = (index === undercoverIndex) ? wordPair.undercover : wordPair.civilian;
                        player.word = word;
                        player.isUndercover = (index === undercoverIndex);
                        
                        // Send word to each player individually
                        player.ws.send(JSON.stringify({
                            type: 'game_started',
                            payload: { word }
                        }));
                    });
                    
                    broadcastRoomState(playerRoomId);
                }
                break;
        }
    });

    ws.on('close', () => {
        console.log(`Client ${playerId} disconnected`);
        if (playerRoomId && rooms[playerRoomId]) {
            const room = rooms[playerRoomId];
            room.players = room.players.filter(p => p.id !== playerId);
            
            // If room is empty, delete it
            if (room.players.length === 0) {
                delete rooms[playerRoomId];
            } else {
                broadcastRoomState(playerRoomId);
            }
        }
    });
});

server.listen(8080, () => {
    console.log('Server started on port 8080');
});

