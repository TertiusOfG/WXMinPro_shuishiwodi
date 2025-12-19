const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const fs = require('fs');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

// Load words from JSON file
const wordsData = JSON.parse(fs.readFileSync('words.json', 'utf8'));
// Flatten all word pairs from all categories into a single array
const words = wordsData.categories.flatMap(category => category.words);

// Middleware to parse JSON and enable CORS
app.use(express.json());
app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Headers', 'Content-Type');
    next();
});

// HTTP endpoint to get words data
app.get('/api/words', (req, res) => {
    res.json(wordsData);
});

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
            creatorId: room.creatorId,
            maxPlayers: room.maxPlayers || 4,           // NEW
            undercoverCount: room.undercoverCount || 1, // NEW
            selectedCategory: room.selectedCategory || '全部', // NEW
            showCategory: room.showCategory || false,   // NEW
            players: room.players.map(p => ({ id: p.id, nickname: p.nickname, isReady: p.isReady, isSpectator: p.isSpectator, avatarUrl: p.avatarUrl || '' })),
            gameState: room.gameState,
            currentPlayerId: (room.gamePlayerIds && typeof room.turnIndex === 'number') ? room.gamePlayerIds[room.turnIndex] : null,
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
    // Send final game_over payload to all players
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

    // Reset game-specific state so the room is ready for a new game
    // Clear per-game tracking fields
    room.gamePlayerIds = null;
    room.turnIndex = null;
    room.votes = {};
    room.speeches = [];

    // Reset player-specific flags used during a game
    room.players.forEach(p => {
        delete p.word;
        p.isUndercover = false;
        p.isEliminated = false;
        // keep isSpectator as-is; reset readiness so players must ready for next game
        p.isReady = false;
    });

    // Move room back to waiting state so lobby UI can transition
    room.gameState = 'waiting';

    // Broadcast the cleared room state to all connected clients
    broadcastRoomState(roomId);
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
            case 'end_game':
                if (!playerRoomId || !rooms[playerRoomId]) {
                    ws.send(JSON.stringify({ type: 'error', payload: { message: '房间不存在' } }));
                    break;
                }
                const roomToEnd = rooms[playerRoomId];
                // only creator can terminate the game
                if (roomToEnd.creatorId !== playerId) {
                    ws.send(JSON.stringify({ type: 'error', payload: { message: '只有房主可以终止游戏' } }));
                    break;
                }
                // If no active game, nothing to do
                if (!roomToEnd || roomToEnd.gameState === 'waiting') {
                    ws.send(JSON.stringify({ type: 'error', payload: { message: '当前没有进行中的游戏' } }));
                    break;
                }

                // Notify all players that the game was terminated by creator
                roomToEnd.players.forEach(p => {
                    try { p.ws.send(JSON.stringify({ type: 'game_terminated', payload: { message: '房主已终止当前游戏' } })); }
                    catch (e) { }
                });

                // Reset per-game state similar to broadcastGameOver cleanup
                roomToEnd.gamePlayerIds = null;
                roomToEnd.turnIndex = null;
                roomToEnd.votes = {};
                roomToEnd.speeches = [];
                roomToEnd.players.forEach(p => {
                    delete p.word;
                    p.isUndercover = false;
                    p.isEliminated = false;
                    p.isReady = false;
                });
                roomToEnd.gameState = 'waiting';

                // Broadcast updated room state
                broadcastRoomState(playerRoomId);
                break;
            case 'create_room':
                // Prevent a player from being in more than one room
                if (Object.values(rooms).some(r => r.players.some(p => p.id === playerId))) {
                    ws.send(JSON.stringify({ type: 'error', payload: { message: '您已在一个房间中,无法创建新的房间' } }));
                    break;
                }

                // Validate nickname
                const creatorNick = (payload.nickname || '').trim();
                if (!creatorNick) {
                    ws.send(JSON.stringify({ type: 'error', payload: { message: '请输入有效的昵称' } }));
                    break;
                }

                // NEW: Get and validate game configuration
                const maxPlayers = parseInt(payload.maxPlayers) || 4;
                const undercoverCount = parseInt(payload.undercoverCount) || 1;

                // Validation: minimum 3 players
                if (maxPlayers < 3) {
                    ws.send(JSON.stringify({ type: 'error', payload: { message: '玩家总人数至少需要3人' } }));
                    break;
                }

                // NEW: Validation: maximum 20 players
                if (maxPlayers > 20) {
                    ws.send(JSON.stringify({ type: 'error', payload: { message: '玩家总人数最多20人' } }));
                    break;
                }

                // NEW: Calculate valid undercover range (1/4 to 1/3 of players)
                const minUndercover = Math.ceil(maxPlayers / 4);
                const maxUndercover = Math.floor(maxPlayers / 3);

                // Validation: undercover count must be within valid range
                if (undercoverCount < minUndercover || undercoverCount > maxUndercover) {
                    ws.send(JSON.stringify({ type: 'error', payload: { message: `卧底人数必须在${minUndercover}到${maxUndercover}之间` } }));
                    break;
                }

                // Get selected category (default to '全部')
                const selectedCategory = payload.selectedCategory || '全部';
                const showCategory = payload.showCategory || false;

                const roomId = generateRoomId();
                rooms[roomId] = {
                    id: roomId,
                    // record creatorId so we can destroy the room if the creator leaves
                    creatorId: playerId,
                    maxPlayers: maxPlayers,           // NEW
                    undercoverCount: undercoverCount, // NEW
                    selectedCategory: selectedCategory, // NEW: Store selected category
                    showCategory: showCategory,       // NEW: Store show category flag
                    players: [{ id: playerId, nickname: creatorNick, isReady: false, ws, isSpectator: false, avatarUrl: payload.avatarUrl || '' }],
                    gameState: 'waiting',
                };
                playerRoomId = roomId;

                // FIX: Include room config in response so room page can display it immediately
                ws.send(JSON.stringify({
                    type: 'room_created',
                    payload: {
                        roomId,
                        maxPlayers: maxPlayers,
                        undercoverCount: undercoverCount
                    }
                }));
                broadcastRoomState(roomId);
                break;

            case 'join_room':
                const roomToJoin = rooms[payload.roomId];
                const isSpectator = payload.isSpectator || false;

                if (roomToJoin) {
                    // Prevent a player from being in more than one room
                    if (Object.values(rooms).some(r => r.players.some(p => p.id === playerId))) {
                        ws.send(JSON.stringify({ type: 'error', payload: { message: '您已在一个房间中，无法加入另一个房间' } }));
                        return;
                    }

                    if (!isSpectator && roomToJoin.gameState !== 'waiting') {
                        ws.send(JSON.stringify({ type: 'error', payload: { message: 'Game has already started.' } }));
                        return;
                    }

                    // Validate nickname presence
                    const joinNick = (payload.nickname || '').trim();
                    if (!joinNick) {
                        ws.send(JSON.stringify({ type: 'error', payload: { message: '请输入有效的昵称' } }));
                        return;
                    }

                    // Enforce unique nickname within the room (case-insensitive)
                    const nameTaken = roomToJoin.players.some(p => (p.nickname || '').trim().toLowerCase() === joinNick.toLowerCase());
                    if (nameTaken) {
                        ws.send(JSON.stringify({ type: 'nick_taken', payload: { message: '该昵称已被房间内其他玩家使用，请换一个昵称' } }));
                        return;
                    }

                    roomToJoin.players.push({ id: playerId, nickname: joinNick, isReady: false, ws, isSpectator, avatarUrl: payload.avatarUrl || '' });
                    playerRoomId = payload.roomId;
                    broadcastRoomState(payload.roomId);

                    if (isSpectator && roomToJoin.gameState === 'playing') {
                        // Send existing speeches to the new spectator so they see history
                        if (roomToJoin.speeches && roomToJoin.speeches.length > 0) {
                            roomToJoin.speeches.forEach(speech => {
                                ws.send(JSON.stringify({ type: 'new_speech', payload: speech }));
                            });
                        }
                        // Also send the current turn info so spectator sees who is next
                        if (roomToJoin.gamePlayerIds && typeof roomToJoin.turnIndex === 'number') {
                            const currentPlayerId = roomToJoin.gamePlayerIds[roomToJoin.turnIndex];
                            ws.send(JSON.stringify({ type: 'turn_update', payload: { currentPlayerId } }));
                        }
                    }
                } else {
                    ws.send(JSON.stringify({ type: 'error', payload: { message: 'Room not found.' } }));
                }
                break;

            case 'get_room_state':
                {
                    const rid = payload.roomId;
                    const room = rooms[rid];
                    if (room) {
                        const state = {
                            type: 'room_update',
                            payload: {
                                roomId: room.id,
                                players: room.players.map(p => ({ id: p.id, nickname: p.nickname, isReady: p.isReady, isSpectator: p.isSpectator })),
                                gameState: room.gameState,
                                currentPlayerId: (room.gamePlayerIds && typeof room.turnIndex === 'number') ? room.gamePlayerIds[room.turnIndex] : null,
                            }
                        };
                        ws.send(JSON.stringify(state));
                    } else {
                        ws.send(JSON.stringify({ type: 'error', payload: { message: 'Room not found.' } }));
                    }
                }
                break;

            case 'leave_room':
                if (playerRoomId && rooms[playerRoomId]) {
                    const room = rooms[playerRoomId];

                    // If the room creator leaves, close the room and notify everyone
                    if (room.creatorId === playerId) {
                        room.players.forEach(p => {
                            if (p.id !== playerId) {
                                try {
                                    p.ws.send(JSON.stringify({ type: 'room_closed', payload: { message: '房主已退出，房间已关闭' } }));
                                } catch (e) {
                                    // ignore send errors
                                }
                            }
                        });

                        // Remove the room entirely
                        delete rooms[playerRoomId];
                        playerRoomId = null;
                        break;
                    }

                    // Normal leave: remove the leaving player
                    const leavingPlayerObj = room.players.find(p => p.id === playerId);
                    room.players = room.players.filter(p => p.id !== playerId);

                    // If no players left, remove the room
                    if (room.players.length === 0) {
                        delete rooms[playerRoomId];
                    } else {
                        // If leaving player was an active game player, mark eliminated for remaining record if needed
                        if (room.gameState === 'playing' && room.gamePlayerIds && room.gamePlayerIds.includes(playerId)) {
                            // Mark as eliminated in a historical sense; create a placeholder if needed
                            // (we removed the leaving player from the players list already)
                        }
                        broadcastRoomState(playerRoomId);
                    }
                    playerRoomId = null;
                }
                break;

            case 'kick_player':
                // NEW: Allow room creator to kick a player
                if (!playerRoomId || !rooms[playerRoomId]) {
                    ws.send(JSON.stringify({ type: 'error', payload: { message: '房间不存在' } }));
                    break;
                }

                const kickRoom = rooms[playerRoomId];

                // Only creator can kick players
                if (kickRoom.creatorId !== playerId) {
                    ws.send(JSON.stringify({ type: 'error', payload: { message: '只有房主可以踢出玩家' } }));
                    break;
                }

                const playerIdToKick = payload.playerId;
                if (!playerIdToKick) {
                    ws.send(JSON.stringify({ type: 'error', payload: { message: '未指定要踢出的玩家' } }));
                    break;
                }

                // Cannot kick yourself
                if (playerIdToKick === playerId) {
                    ws.send(JSON.stringify({ type: 'error', payload: { message: '不能踢出自己' } }));
                    break;
                }

                const kickedPlayer = kickRoom.players.find(p => p.id === playerIdToKick);
                if (!kickedPlayer) {
                    ws.send(JSON.stringify({ type: 'error', payload: { message: '玩家不在房间中' } }));
                    break;
                }

                // Notify the kicked player
                try {
                    kickedPlayer.ws.send(JSON.stringify({
                        type: 'kicked',
                        payload: { message: '你已被房主移出房间' }
                    }));
                } catch (e) {
                    console.error('Failed to notify kicked player:', e);
                }

                // Remove the player from the room
                kickRoom.players = kickRoom.players.filter(p => p.id !== playerIdToKick);

                // Broadcast updated room state
                broadcastRoomState(playerRoomId);
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
                    // NEW: Validate player count meets configured maximum
                    const configuredMax = gameRoom.maxPlayers || 4;
                    const configuredUndercover = gameRoom.undercoverCount || 1;

                    // Check minimum player count
                    if (actualPlayers.length < 3) {
                        ws.send(JSON.stringify({ type: 'error', payload: { message: '至少需要3名玩家才能开始游戏' } }));
                        break;
                    }

                    // Ensure we have enough players for the configured undercover count
                    if (actualPlayers.length <= configuredUndercover) {
                        ws.send(JSON.stringify({ type: 'error', payload: { message: `玩家人数必须大于卧底人数(${configuredUndercover})` } }));
                        break;
                    }

                    gameRoom.gameState = 'playing';
                    gameRoom.gamePlayerIds = actualPlayers.map(p => p.id);
                    gameRoom.turnIndex = 0;
                    gameRoom.votes = {};
                    gameRoom.speeches = [];

                    // Filter words by selected category
                    const selectedCategory = gameRoom.selectedCategory || '全部';
                    let availableWords = words; // default: all words

                    if (selectedCategory !== '全部') {
                        const category = wordsData.categories.find(cat => cat.name === selectedCategory);
                        if (!category || !category.words || category.words.length === 0) {
                            ws.send(JSON.stringify({
                                type: 'error',
                                payload: { message: `类别"${selectedCategory}"没有可用的词汇` }
                            }));
                            break;
                        }
                        availableWords = category.words;
                    }

                    const wordPair = availableWords[Math.floor(Math.random() * availableWords.length)];

                    // NEW: Randomly select multiple undercovers
                    const undercoverIndices = [];
                    const playerIndices = actualPlayers.map((_, i) => i);

                    // Shuffle and pick first N indices for undercovers
                    for (let i = 0; i < configuredUndercover; i++) {
                        const randomIdx = Math.floor(Math.random() * playerIndices.length);
                        undercoverIndices.push(playerIndices[randomIdx]);
                        playerIndices.splice(randomIdx, 1); // Remove to avoid duplicates
                    }

                    actualPlayers.forEach((player, index) => {
                        const isUndercover = undercoverIndices.includes(index);
                        const word = isUndercover ? wordPair.undercover : wordPair.civilian;
                        player.word = word;
                        player.isUndercover = isUndercover;
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

                if (!actionRoom || !actingPlayer || actingPlayer.isSpectator) {
                    return;
                }

                const { action, targetId, message } = payload;

                // Validate per-action allowed gameState
                if (action === 'speak' && actionRoom.gameState !== 'playing') {
                    return;
                }
                if (action === 'vote' && actionRoom.gameState !== 'voting') {
                    return;
                }

                if (action === 'speak' && actionRoom.gamePlayerIds[actionRoom.turnIndex] === playerId) {
                    // NEW: Include avatarUrl from payload
                    const speech = {
                        playerId,
                        nickname: actingPlayer.nickname,
                        message,
                        avatarUrl: payload.avatarUrl || ''  // NEW: Include avatar URL
                    };
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
                    console.log(`Received vote from ${playerId} -> ${targetId}`);

                    // Prevent voting targeting invalid players (non-existent, spectators, or already eliminated)
                    const targetPlayer = actionRoom.players.find(p => p.id === targetId);
                    if (!targetPlayer) {
                        actingPlayer.ws.send(JSON.stringify({ type: 'vote_error', payload: { message: '投票目标不存在' } }));
                        break;
                    }
                    if (targetPlayer.isSpectator) {
                        actingPlayer.ws.send(JSON.stringify({ type: 'vote_error', payload: { message: '不能给观战者投票' } }));
                        break;
                    }
                    if (targetPlayer.isEliminated) {
                        actingPlayer.ws.send(JSON.stringify({ type: 'vote_error', payload: { message: '该玩家已出局，无法投票' } }));
                        break;
                    }

                    // Prevent double-voting by same player
                    if (actionRoom.votes[playerId]) {
                        console.log(`Player ${playerId} attempted to vote again; ignoring.`);
                        // Optionally notify the player
                        actingPlayer.ws.send(JSON.stringify({ type: 'vote_error', payload: { message: '您已投票' } }));
                        break;
                    }

                    actionRoom.votes[playerId] = targetId;
                    const activePlayers = getActualPlayers(playerRoomId).filter(p => !p.isEliminated);

                    // Broadcast a lightweight vote progress update to the room
                    const votesCount = Object.keys(actionRoom.votes).length;
                    actionRoom.players.forEach(p => p.ws.send(JSON.stringify({ type: 'vote_update', payload: { votesReceived: votesCount, total: activePlayers.length } })));

                    console.log(`Votes: ${votesCount}/${activePlayers.length}`);

                    if (votesCount === activePlayers.length) {
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

            // If the room creator disconnected, close the room and notify everyone
            if (room.creatorId === playerId) {
                room.players.forEach(p => {
                    if (p.id !== playerId) {
                        try {
                            p.ws.send(JSON.stringify({ type: 'room_closed', payload: { message: '房主已退出，房间已关闭' } }));
                        } catch (e) {
                            // ignore send errors
                        }
                    }
                });

                delete rooms[playerRoomId];
                return;
            }

            // Normal disconnect: remove the disconnected player
            const leavingPlayerObj = room.players.find(p => p.id === playerId);
            room.players = room.players.filter(p => p.id !== playerId);

            if (room.players.length === 0) {
                delete rooms[playerRoomId];
            } else {
                // If the disconnected user was a player in an active game, you may want to handle elimination
                if (room.gameState === 'playing' && room.gamePlayerIds && room.gamePlayerIds.includes(playerId)) {
                    // We already removed the player object; additional handling could be implemented here
                }
                broadcastRoomState(playerRoomId);
            }
        }
    });
});

server.listen(8080, () => {
    console.log('Server started on port 8080');
});