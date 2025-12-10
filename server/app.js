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

const getActualPlayers = (roomId) => {
    const room = rooms[roomId];
    if (!room) return [];
    return room.players.filter(p => !p.isSpectator);
};

// Helper to broadcast data to all clients in a room
const broadcastRoomState = (roomId) => {
    const room = rooms[roomId];
    if (!room) return;

    const state = {
        type: 'room_update',
        payload: {
            roomId: room.id,
            players: room.players.map(p => ({ id: p.id, nickname: p.nickname, isReady: p.isReady, isSpectator: p.isSpectator })),
            gameState: room.gameState,
        }
    };

    room.players.forEach(player => {
        player.ws.send(JSON.stringify(state));
    });
};

// Helper to broadcast whose turn it is
const broadcastTurnUpdate = (roomId) => {
    const room = rooms[roomId];
    if (!room || room.gameState !== 'playing' || !room.gamePlayerIds) return;

    const currentPlayerId = room.gamePlayerIds[room.turnIndex];

    const turnPayload = {
        type: 'turn_update',
        payload: {
            currentPlayerId: currentPlayerId
        }
    };

    room.players.forEach(player => {
        player.ws.send(JSON.stringify(turnPayload));
    });
};

// Helper to broadcast game over state
const broadcastGameOver = (roomId, winner) => {
    const room = rooms[roomId];
    if (!room) return;

    room.gameState = 'finished';
    const undercover = getActualPlayers(roomId).find(p => p.isUndercover);

    const gameOverPayload = {
        type: 'game_over',
        payload: {
            winner: winner, // 'civilian' or 'undercover'
            undercoverNickname: undercover ? undercover.nickname : 'N/A',
            undercoverWord: undercover ? undercover.word : 'N/A'
        }
    };

    room.players.forEach(player => {
        player.ws.send(JSON.stringify(gameOverPayload));
    });
};

wss.on('connection', (ws) => {
    let playerId = Math.random().toString(36).substring(2, 12);
    let playerRoomId = null;

    console.log(`Client ${playerId} connected`);

    ws.send(JSON.stringify({ type: 'connected', payload: { id: playerId } }));

    ws.on('message', (message) => {
        const data = JSON.parse(message);
        const { type, payload } = data;

        switch (type) {
            case 'create_room':
                const roomId = generateRoomId();
                rooms[roomId] = {
                    id: roomId,
                    players: [{ id: playerId, nickname: payload.nickname, isReady: false, ws, isSpectator: false }],
                    gameState: 'waiting',
                };
                playerRoomId = roomId;
                ws.send(JSON.stringify({ type: 'room_created', payload: { roomId } }));
                broadcastRoomState(roomId);
                break;

            case 'join_room':
                const roomToJoin = rooms[payload.roomId];
                const isSpectator = payload.isSpectator || false;

                if (roomToJoin) {
                    if (!isSpectator && roomToJoin.gameState !== 'waiting') {
                        ws.send(JSON.stringify({ type: 'error', payload: { message: 'Game has already started.' } }));
                        return;
                    }

                    roomToJoin.players.push({ id: playerId, nickname: payload.nickname, isReady: false, ws, isSpectator });
                    playerRoomId = payload.roomId;
                    broadcastRoomState(payload.roomId);

                    if (isSpectator && roomToJoin.gameState === 'playing') {
                        // TODO: Send full game state to spectator
                    }
                } else {
                    ws.send(JSON.stringify({ type: 'error', payload: { message: 'Room not found.' } }));
                }
                break;

            case 'player_ready':
                const readyRoom = rooms[playerRoomId];
                if (readyRoom) {
                    const player = readyRoom.players.find(p => p.id === playerId);
                    if (player && !player.isSpectator) {
                        player.isReady = payload.isReady;
                        broadcastRoomState(playerRoomId);
                    }
                }
                break;

            case 'start_game':
                const gameRoom = rooms[playerRoomId];
                const actualPlayers = getActualPlayers(playerRoomId);

                if (gameRoom && actualPlayers.length > 1 && actualPlayers.every(p => p.isReady)) {
                    gameRoom.gameState = 'playing';
                    gameRoom.gamePlayerIds = actualPlayers.map(p => p.id);
                    gameRoom.turnIndex = 0;
                    gameRoom.votes = {};
                    gameRoom.speeches = [];

                    const wordPair = words[Math.floor(Math.random() * words.length)];
                    const undercoverIndex = Math.floor(Math.random() * actualPlayers.length);

                    actualPlayers.forEach((player, index) => {
                        const word = (index === undercoverIndex) ? wordPair.undercover : wordPair.civilian;
                        player.word = word;
                        player.isUndercover = (index === undercoverIndex);
                        player.isEliminated = false;

                        player.ws.send(JSON.stringify({
                            type: 'game_started',
                            payload: { word }
                        }));
                    });

                    broadcastRoomState(playerRoomId);
                    broadcastTurnUpdate(playerRoomId);
                }
                break;

            case 'player_action':
                const actionRoom = rooms[playerRoomId];
                const actingPlayer = actionRoom ? actionRoom.players.find(p => p.id === playerId) : null;

                if (!actionRoom || !actingPlayer || actingPlayer.isSpectator || actionRoom.gameState !== 'playing') {
                    return;
                }

                const { action, targetId, message } = payload;

                if (action === 'speak' && actionRoom.gamePlayerIds[actionRoom.turnIndex] === playerId) {
                    const speech = { playerId, nickname: actingPlayer.nickname, message };
                    actionRoom.speeches.push(speech);

                    actionRoom.players.forEach(p => p.ws.send(JSON.stringify({ type: 'new_speech', payload: speech })));

                    let nextTurnIndex = actionRoom.turnIndex;
                    let nextPlayer;
                    do {
                        nextTurnIndex = (nextTurnIndex + 1) % actionRoom.gamePlayerIds.length;
                        const nextPlayerId = actionRoom.gamePlayerIds[nextTurnIndex];
                        nextPlayer = actionRoom.players.find(p => p.id === nextPlayerId);
                    } while (nextPlayer.isEliminated)
                    actionRoom.turnIndex = nextTurnIndex;

                    const activePlayers = getActualPlayers(playerRoomId).filter(p => !p.isEliminated);
                    if (actionRoom.speeches.length >= activePlayers.length) {
                        actionRoom.gameState = 'voting';
                        actionRoom.speeches = [];
                        broadcastRoomState(playerRoomId);
                    } else {
                        broadcastTurnUpdate(playerRoomId);
                    }

                } else if (action === 'vote') {
                    actionRoom.votes[playerId] = targetId;
                    const activePlayers = getActualPlayers(playerRoomId).filter(p => !p.isEliminated);

                    if (Object.keys(actionRoom.votes).length === activePlayers.length) {
                        const voteCounts = {};
                        for (const voterId in actionRoom.votes) {
                            const votedId = actionRoom.votes[voterId];
                            voteCounts[votedId] = (voteCounts[votedId] || 0) + 1;
                        }

                        let maxVotes = 0;
                        let eliminatedPlayerId = null;
                        for (const id in voteCounts) {
                            if (voteCounts[id] > maxVotes) {
                                maxVotes = voteCounts[id];
                                eliminatedPlayerId = id;
                            }
                        }

                        if (eliminatedPlayerId) {
                            const eliminatedPlayer = actionRoom.players.find(p => p.id === eliminatedPlayerId);
                            if (eliminatedPlayer) {
                                eliminatedPlayer.isEliminated = true;
                            }
                        }

                        actionRoom.votes = {};
                        actionRoom.speeches = [];

                        const remainingPlayers = getActualPlayers(playerRoomId).filter(p => !p.isEliminated);
                        const remainingUndercovers = remainingPlayers.filter(p => p.isUndercover);
                        const remainingCivilians = remainingPlayers.filter(p => !p.isUndercover);

                        if (remainingUndercovers.length === 0) {
                            broadcastGameOver(playerRoomId, 'civilian');
                        } else if (remainingCivilians.length <= remainingUndercovers.length) {
                            broadcastGameOver(playerRoomId, 'undercover');
                        } else {
                            actionRoom.gameState = 'playing';
                            broadcastRoomState(playerRoomId);
                            broadcastTurnUpdate(playerRoomId);
                        }
                    }
                }
                break;
        }
    });

    ws.on('close', () => {
        console.log(`Client ${playerId} disconnected`);
        if (playerRoomId && rooms[playerRoomId]) {
            const room = rooms[playerRoomId];
            room.players = room.players.filter(p => p.id !== playerId);
            
            if (room.players.length === 0) {
                delete rooms[playerRoomId];
            } else {
                // If the disconnected user was a player in an active game, handle it
                if (room.gameState === 'playing' && room.gamePlayerIds && room.gamePlayerIds.includes(playerId)) {
                    const player = room.players.find(p => p.id === playerId);
                    if(player) player.isEliminated = true; // Mark as eliminated
                    // Potentially check for game over condition here as well
                }
                broadcastRoomState(playerRoomId);
            }
        }
    });
});

server.listen(8080, () => {
    console.log('Server started on port 8080');
});