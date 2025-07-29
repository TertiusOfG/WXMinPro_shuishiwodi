
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

// Helper to broadcast whose turn it is
const broadcastTurnUpdate = (roomId) => {
    const room = rooms[roomId];
    if (!room || room.gameState !== 'playing') return;

    const turnPayload = {
        type: 'turn_update',
        payload: {
            currentPlayerId: room.players[room.turn].id
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
    const undercover = room.players.find(p => p.isUndercover);

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

    // Optionally reset the room after a delay
    setTimeout(() => {
        // Here you might want to reset the room to a 'waiting' state
        // or simply clean it up if you don't want to allow re-playing.
    }, 10000); // 10 seconds delay
};

wss.on('connection', (ws) => {
    let playerId = Math.random().toString(36).substring(2, 12);
    let playerRoomId = null;

    console.log(`Client ${playerId} connected`);

    // Send the new player their ID
    ws.send(JSON.stringify({ type: 'connected', payload: { id: playerId } }));

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
                    gameRoom.turn = 0; // Start with the first player
                    gameRoom.votes = {}; // Reset votes
                    gameRoom.speeches = []; // Reset speeches

                    // Assign words
                    const wordPair = words[Math.floor(Math.random() * words.length)];
                    const undercoverIndex = Math.floor(Math.random() * gameRoom.players.length);

                    gameRoom.players.forEach((player, index) => {
                        const word = (index === undercoverIndex) ? wordPair.undercover : wordPair.civilian;
                        player.word = word;
                        player.isUndercover = (index === undercoverIndex);
                        player.isEliminated = false;

                        // Send word to each player individually
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
                if (actionRoom && actionRoom.gameState === 'playing') {
                    const { action, targetId, message } = payload;

                    if (action === 'speak' && actionRoom.players[actionRoom.turn].id === playerId) {
                        const speech = { playerId, nickname: actionRoom.players.find(p => p.id === playerId).nickname, message };
                        actionRoom.speeches.push(speech);

                        // Broadcast the speech to everyone
                        actionRoom.players.forEach(p => p.ws.send(JSON.stringify({ type: 'new_speech', payload: speech })));

                        // Move to next player
                        let nextTurn = (actionRoom.turn + 1) % actionRoom.players.length;
                        while(actionRoom.players[nextTurn].isEliminated) {
                            nextTurn = (nextTurn + 1) % actionRoom.players.length;
                        }
                        actionRoom.turn = nextTurn;

                        // If all active players have spoken, change to voting state
                        const activePlayers = actionRoom.players.filter(p => !p.isEliminated);
                        if (actionRoom.speeches.length === activePlayers.length) {
                            actionRoom.gameState = 'voting';
                            broadcastRoomState(playerRoomId); // This will update the gameState to 'voting' on the client
                        } else {
                            broadcastTurnUpdate(playerRoomId);
                        }

                    } else if (action === 'vote') {
                        actionRoom.votes[playerId] = targetId;

                        // Check if all active players have voted
                        const activePlayers = actionRoom.players.filter(p => !p.isEliminated);
                        if (Object.keys(actionRoom.votes).length === activePlayers.length) {
                            const voteCounts = {};
                            for (const voterId in actionRoom.votes) {
                                const votedId = actionRoom.votes[voterId];
                                voteCounts[votedId] = (voteCounts[votedId] || 0) + 1;
                            }

                            let maxVotes = 0;
                            let eliminatedPlayerId = null;
                            for (const playerId in voteCounts) {
                                if (voteCounts[playerId] > maxVotes) {
                                    maxVotes = voteCounts[playerId];
                                    eliminatedPlayerId = playerId;
                                }
                            }

                            if (eliminatedPlayerId) {
                                const eliminatedPlayer = actionRoom.players.find(p => p.id === eliminatedPlayerId);
                                if (eliminatedPlayer) {
                                    eliminatedPlayer.isEliminated = true;
                                }
                            }

                            // Reset votes for next round
                            actionRoom.votes = {};

                            // Check for game over
                            const remainingPlayers = actionRoom.players.filter(p => !p.isEliminated);
                            const remainingUndercovers = remainingPlayers.filter(p => p.isUndercover);
                            const remainingCivilians = remainingPlayers.filter(p => !p.isUndercover);

                            if (remainingUndercovers.length === 0) {
                                broadcastGameOver(playerRoomId, 'civilian');
                            } else if (remainingCivilians.length <= remainingUndercovers.length) {
                                broadcastGameOver(playerRoomId, 'undercover');
                            } else {
                                // Continue to next turn
                                actionRoom.turn = (actionRoom.turn + 1) % actionRoom.players.length;
                                while(actionRoom.players[actionRoom.turn].isEliminated) {
                                    actionRoom.turn = (actionRoom.turn + 1) % actionRoom.players.length;
                                }
                                broadcastRoomState(playerRoomId);
                                broadcastTurnUpdate(playerRoomId);
                            }
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

