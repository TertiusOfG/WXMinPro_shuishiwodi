谁是卧底 微信小程序 开发进度笔记 记录

目录结构中已经包含了 client 和 server 文件夹，我将沿用这个结构，将小程序作为 client，Node.js 应用作为 server。

  这是一个分步开发计划：

  项目架构


   * 前端 (Client): 使用原生微信小程序框架 (WXML, WXSS, JavaScript) 来构建用户界面和交互。
   * 后端 (Server): 使用您项目中已有的 Node.js (server/app.js) 环境，并集成 WebSocket (例如使用 ws 库)
     来实现多玩家间的实时数据同步。
   * 数据存储: 游戏的核心数据（如词库）可以先用一个简单的 JSON 文件存放在服务端。

  ---

  开发计划

  第一步：后端基础搭建 (Node.js + WebSocket)


   1. 初始化项目: 在 server 目录下，设置一个基础的 Express 应用并集成 WebSocket 服务器。
   2. 设计数据结构: 定义游戏房间（Room）和玩家（Player）的数据结构。例如：
       * Room: { roomId, players, gameState, words, undercoverIndexes, ... }
       * Player: { playerId, nickname, isReady, word, isUndercover, ... }
   3. 实现核心API:
       * create_room: 创建一个新的游戏房间。
       * join_room: 玩家加入指定的房间。
       * player_ready: 玩家准备开始游戏。
       * start_game: 分配角色和词语，开始游戏。
       * player_action: 处理玩家的游戏内动作（如发言、投票）。

  第二步：小程序前端框架搭建


   4. 创建小程序项目: 我会为您生成标准的小程序文件结构。
   5. 配置 `app.json`: 注册所有需要的页面，例如：
       * pages/index/index (首页：创建/加入房间)
       * pages/room/room (游戏房间页：等待其他玩家)
       * pages/game/game (游戏进行页：显示词语、发言、投票)
       * pages/result/result (结果页：公布卧底和胜负)
   6. UI 设计: 使用 WXML 和 WXSS 创建简洁明了的界面。

  第三步：实现核心游戏流程


   7. 连接后端: 在小程序端，使用 wx.connectSocket 连接到后端的 WebSocket 服务。
   8. 首页逻辑: 实现创建房间和加入房间的功能。创建房间时调用后端API，成功后跳转到房间页。
   9. 房间页逻辑:
       * 显示当前房间内的所有玩家和他们的准备状态。
       * 当所有玩家都准备好后，房主可以点击“开始游戏”。
   10. 游戏页逻辑:
       * 从服务器接收并只显示自己的词语。
       * 根据服务器的指令，按顺序开放玩家发言。
       * 实现投票功能，并将投票结果发送到服务器。
       * 实时更新游戏状态（如谁被淘汰了）。
   11. 结果页逻辑: 游戏结束后，从服务器获取最终结果并展示给所有玩家。

  第四步：词库和游戏规则


   12. 创建词库: 在 server 目录下创建一个 words.json 文件，包含多组平民和卧底的词语。
       * 例如: [ { "civilian": "牛奶", "undercover": "豆浆" }, ... ]
   13. 完善游戏逻辑: 在后端实现胜负判断逻辑。
       * 卧底全部出局 -> 平民胜利。
       * 平民人数少于或等于卧底人数 -> 卧底胜利。

--
我将首先创建 server 和 client 目录，然后从后端开始设置。


  第一步是初始化 Node.js 项目并安装所需的依赖项：express 用于创建 HTTP 服务器，ws 用于处理 WebSocket 连接。
  mkdir server client && cd server && npm init -y && npm install express ws

接下来，我将创建两个核心文件：


   1. server/app.js: 这是我们后端应用的入口文件，它将包含 Express 和 WebSocket 服务器的初始设置。
   2. server/words.json: 这个文件将作为我们游戏的词库。

后端的基础文件已经创建好了。现在，我将为 server/app.js 添加核心的游戏逻辑。


  这包括处理以下客户端请求：
   * 创建房间 (`create_room`): 生成一个唯一的房间号，并让创建者加入。
   * 加入房间 (`join_room`): 让玩家凭房间号加入一个已存在的房间。
   * 玩家准备 (`player_ready`): 切换玩家的准备状态。
   * 开始游戏 (`start_game`): 分配词语和角色，正式开始游戏。
   * 处理断线: 当玩家离开时，将其从房间内移除。

端现在已经具备了处理游戏房间和基本游戏流程的能力。


  接下来，我们开始构建小程序前端。


  我将会在 client 目录下创建标准的小程序文件结构，包括：
   * app.js (小程序逻辑)
   * app.json (小程序公共配置)
   * app.wxss (小程序公共样式表)
   * 以及各个页面的文件夹 (pages/index, pages/room, pages/game, pages/result)。

 首先，创建 client/app.js。
 现在，创建 client/app.json，在里面注册好我们需要的所有页面。
 接着是 client/app.wxss 全局样式文件。
 
太棒了！现在小程序的基础框架已经搭好，接下来我们来创建第一个页面：首页 (`pages/index`)。


  这个页面将允许用户：
   1. 输入一个昵称。
   2. 创建一个新房间。
   3. 或者输入一个房间号加入一个已存在的房间。


  我将创建 index.wxml (页面结构), index.wxss (页面样式), index.js (页面逻辑) 和 index.json (页面配置) 这四个文件。
  首先是 index.wxml。
  现在是 index.wxss 页面样式。
  接下来是 index.js，这是首页的逻辑核心。它将处理用户输入、连接 WebSocket 服务器，并发送创建/加入房间的请求。
  最后，创建 index.json 为这个页面提供一个空的配置。
  首页已经创建完毕。当用户创建或加入房间后，他们需要被导航到房间页面 (`pages/room`)。
这个页面的功能是：
   1. 显示当前的房间号。
   2. 展示所有已加入的玩家和他们的准备状态。
   3. 提供一个“准备/取消准备”的按钮。
   4. 房主（第一个加入的玩家）可以看到一个“开始游戏”的按钮（此功能将在后续完善，暂时简化为所有玩家都能看到）。

现在，我来创建 room.wxml, room.wxss, room.js, 和 room.json。
房间页面已完成。游戏开始后，玩家将进入游戏页面 (`pages/game`)。


  这个页面的核心功能是：
   1. 显示玩家自己拿到的词语。
   2. 展示当前所有玩家的状态（轮到谁发言、谁已出局等）。
   3. 提供一个界面供玩家轮流描述自己的词语。
   4. 在描述环节后，提供一个投票界面，让玩家投票选出卧底。


  由于这是一个比较复杂的页面，我将先搭建一个基础版本，显示词语和玩家列表。后续再迭代引导发言和投票的功能。

现在，我来创建 game.wxml, game.wxss, game.js, 和 game.json。

游戏页面基础已完成。最后，我们需要一个结果页面 (`pages/result`) 来宣布游戏胜负。


  这个页面会很简单，主要用于：
   1. 显示卧底是谁。
   2. 宣布是平民胜利还是卧底胜利。
   3. 提供一个“返回首页”的按钮，让玩家可以开始新的一局。


  现在，我来创建 result.wxml, result.wxss, result.js, 和 result.json。
好的，我们已经成功搭建了“谁是卧底”小游戏的前端和后端的所有基础文件！

  总结一下我们已完成的工作:


   * 后端 (`server`):
       * 一个可以运行的 Node.js + WebSocket 服务器 (app.js)。
       * 实现了创建房间、加入房间、玩家准备、开始游戏和分配词语的核心逻辑。
       * 一个简单的词库 (words.json)。


   * 前端 (`client`):
       * 一个完整结构的微信小程序。
       * 首页: 用户可以输入昵称，创建或加入房间。
       * 房间页: 可以看到所有玩家和他们的准备状态，并可以开始游戏。
       * 游戏页: 可以接收并显示自己的词语。
       * 结果页: 用于展示最终游戏结果。

  下一步是什么？

  现在项目的基础框架已经完成，您可以进行以下操作：


   1. 启动后端服务器:
      在您的终端里，进入 server 目录并运行 node app.js。

   1     cd server
   2     node app.js

      如果一切顺利，您会看到 "Server started on port 8080" 的提示。


   2. 在微信开发者工具中运行小程序:
       * 打开微信开发者工具。
       * 选择“导入项目”。
       * 项目目录选择我们创建的 client 文件夹。
       * 填入您自己的 AppID (如果没有，可以使用测试号)。
       * 点击“导入”。

  导入后，您应该就能在模拟器上看到小程序的首页，并且可以测试创建房间、加入房间的流程了。

  待办事项:


  目前的游戏还缺少最核心的发言和投票环节。我们可以继续完善它，例如：

   * 在游戏页面添加轮流发言的提示和投票按钮。
   * 在后端添加处理投票、判断玩家出局、以及判断最终胜负的逻辑。
  
根据笔记，下一步是：
   1. 在游戏页面(pages/game)添加轮流发言的提示和投票按钮。
   2. 在后端(server/app.js)添加处理投票、判断玩家出局、以及判断最终胜负的逻辑。

我已经看过了 server/app.js
  的代码。现在我将为其添加处理发言、投票和游戏结束的逻辑。


  这包括以下几个步骤：
   1. 在 rooms 对象中为每个房间增加一个 turn 字段来追踪轮到谁发言，以及一个 votes
      字段来记录投票。
   2. 创建一个新的 player_action case in the switch statement to handle player
      actions like voting.
   3. 在 start_game 之后，广播一个 turn_update 消息，告诉客户端轮到谁发言。
   4. 在收到所有玩家的投票后，计算票数，淘汰得票最多的玩家，并检查游戏是否结束。
   5. 如果游戏结束，广播 game_over 消息，并公布结果。

我还需要添加 broadcastTurnUpdate 和 broadcastGameOver 这两个辅助函数。

后端逻辑已经更新完毕。现在，我将更新前端 game 页面，添加发言和投票的界面。
我已经了解了 game.js 和 game.wxml
  的内容。现在我将修改它们，以实现发言提示、投票和显示玩家状态的功能。

  对于 `game.wxml`，我将做以下修改：


   1. 在 game-status 部分，添加一个 text 来显示当前轮到谁发言。
   2. 在 players-grid
      部分，为每个玩家卡片添加一个状态指示器，以显示他们是否被淘汰。
   3. 在 action-area 部分，将投票按钮改为一个
      button，并根据游戏状态来启用或禁用它。当投票阶段开始时，将显示一个投票列表。

  对于 `game.js`，我将做以下修改：


   1. 在 data 中添加 currentPlayerId 和 isMyTurn 字段，用于控制发言提示。
   2. 在 onLoad 中，添加对 turn_update 和 game_over 消息的处理。
   3. 添加一个 vote 函数，用于在玩家点击投票按钮时向服务器发送投票信息。
   4. 添加一个 handleVote 函数，用于处理投票按钮的点击事件。

在，核心的发言和投票功能的前后端代码都已经完成。不过，在 game.js
  的代码中，我做了一个假设，即玩家的 ID 存储在 app.globalData.userInfo.id
  中。我需要检查一下 app.js 和 index.js，确保玩家信息在适当时机被正确存储。

  我已经阅读了 app.js 和 index.js。


  问题很明确：
   1. app.js 的 globalData 中有 playerId，但它从未被赋值。
   2. index.js 在加入或创建房间时，只存储了 nickname 和 roomId，没有存储后端返回的
      playerId。
   3. game.js 中引用的 app.globalData.userInfo.id 根本不存在。


  为了修复这个问题，我需要：
   1. 修改 server/app.js，在玩家连接时，将生成的 playerId 发送给客户端。
   2. 修改 client/app.js，在 globalData 中添加 userInfo 对象。
   3. 修改 client/pages/index/index.js，在 onLoad 的 socket.onMessage
      回调中，增加一个 connected 或类似的 case，用来接收并存储后端发来的
      playerId。
   4. 修改 client/pages/game/game.js，确保它从 app.globalData.userInfo.id
      正确获取玩家 ID。

我们来完成最后的结果页面。


  这个页面需要做两件事：
   1. 从 game 页面传递过来的 URL
      参数中获取游戏结果（胜利方、卧底身份、卧底词语）。
   2. 将这些信息清晰地展示给玩家。

我们来实现发言功能。


  这将分两步进行：
   1. 后端 (`server/app.js`): 添加逻辑来处理玩家发言。服务器需要验证是否轮到该玩家
      ，然后将发言内容广播给房间内的所有其他玩家，并管理发言和投票阶段的转换。
   2. 前端 (`client/pages/game/`): 更新游戏页面，增加一个文本输入框和“发言”按钮，
      并添加一个区域来显示所有人的发言记录。

现在我将为其添加处理发言的逻辑。


  这包括以下几个步骤：
   1. 在 rooms 对象中为每个房间增加一个 speeches 数组来存储发言记录。
   2. 在 player_action case 中，增加一个 speak action。
   3. 当玩家发言时，服务器会验证是否轮到该玩家，然后将发言内容广播给房间内的所有玩
      家。
   4. 在所有玩家都发言完毕后，服务器将游戏状态切换为 voting。

现在，我将更新前端 game
  页面，添加发言输入框、发言记录显示区域，并处理 new_speech 消息。

现在我将修改它们，以实现发言功能。


  对于 `game.wxml`，我将做以下修改：


   1. 添加一个 scroll-view 来显示发言记录。
   2. 在 action-area 部分，根据 isMyTurn 和 gameState
      来显示发言输入框和按钮，或者投票按钮。


  对于 `game.js`，我将做以下修改：


   1. 在 data 中添加 speeches 数组和 speechInput 字符串。
   2. 在 onLoad 的 onMessage 回调中，增加对 new_speech 消息的处理。
   3. 添加 onSpeechInput 函数来更新 speechInput。
   4. 添加 submitSpeech 函数来向服务器发送发言。123