const express = require("express");
const http = require("http");
const WebSocket = require("ws");
const path = require("path");

// Express server setup
const app = express();
const server = http.createServer(app);

// Serve static files from parent directory
app.use(express.static(path.join(__dirname, "..")));

// WebSocket server
const wss = new WebSocket.Server({ server });

// Game constants
const TICK_RATE = 30; // Server updates per second
const WORLD_SIZE = { width: 6000, height: 6000 };
const WORLD_RADIUS = Math.min(WORLD_SIZE.width, WORLD_SIZE.height) / 2;

// Game state
const players = new Map(); // Map of player id -> player data
const food = new Map(); // Map of food id -> food data
const coins = new Map(); // Map of coin id -> coin data

// Generate unique IDs
let nextPlayerId = 1;
let nextFoodId = 1;
let nextCoinId = 1;

// Initialize food
function initializeFood(count = 100) {
  for (let i = 0; i < count; i++) {
    const foodId = nextFoodId++;
    food.set(foodId, {
      id: foodId,
      x: randomCoordinate(WORLD_SIZE.width / 2),
      y: randomCoordinate(WORLD_SIZE.height / 2),
      value: 1,
    });
  }
}

// Random coordinate within circular world
function randomCoordinate(maxRadius) {
  // Generate random angle and distance from center
  const angle = Math.random() * Math.PI * 2;
  // Use sqrt to ensure uniform distribution across the circle area
  const distance = Math.sqrt(Math.random()) * (WORLD_RADIUS - 50);

  // Convert polar to cartesian coordinates
  if (Math.random() > 0.5) {
    return Math.round(Math.cos(angle) * distance);
  } else {
    return Math.round(Math.sin(angle) * distance);
  }
}

// Initialize game world
initializeFood();

// Handle new WebSocket connections
wss.on("connection", (socket) => {
  // Assign unique ID to player
  const playerId = nextPlayerId++;
  console.log(`Player ${playerId} connected`);

  // Initialize player data structure
  const playerData = {
    id: playerId,
    x: randomCoordinate(WORLD_SIZE.width / 2),
    y: randomCoordinate(WORLD_SIZE.height / 2),
    direction: Math.random() * Math.PI * 2,
    sections: [],
    length: 30,
    speed: 130,
    scale: 0.6,
    headPath: [], // For storing the path the head travels (needed for sections to follow)
    isDead: false,
    lastInput: Date.now(),
    socket,
  };

  // Initialize positions for the snake sections
  const preferredDistance = 17 * playerData.scale;
  for (let i = 0; i < playerData.length; i++) {
    // Calculate position slightly behind the head
    const sectionX = playerData.x;
    const sectionY = playerData.y + i * preferredDistance;

    playerData.sections.push({
      x: sectionX,
      y: sectionY,
    });

    // Add to headPath for section movement
    playerData.headPath.push({
      x: sectionX,
      y: sectionY,
    });
  }

  // Add player to game state
  players.set(playerId, playerData);

  // Send initial game state to the player
  sendInitialState(socket, playerId);

  // Handle player messages
  socket.on("message", (message) => {
    try {
      const data = JSON.parse(message);
      handlePlayerInput(playerId, data);
    } catch (e) {
      console.error("Failed to parse message:", e);
    }
  });

  // Handle disconnection
  socket.on("close", () => {
    console.log(`Player ${playerId} disconnected`);
    players.delete(playerId);
    broadcastPlayerDisconnect(playerId);
  });
});

// Send initial game state to a new player
function sendInitialState(socket, playerId) {
  // Extract data to send to the client
  const playersList = [];
  players.forEach((player) => {
    if (player.id !== playerId && !player.isDead) {
      playersList.push({
        id: player.id,
        x: player.x,
        y: player.y,
        direction: player.direction,
        sections: player.sections,
        length: player.length,
        scale: player.scale,
      });
    }
  });

  const foodList = [];
  food.forEach((f) => {
    foodList.push({
      id: f.id,
      x: f.x,
      y: f.y,
    });
  });

  const coinList = [];
  coins.forEach((c) => {
    coinList.push({
      id: c.id,
      x: c.x,
      y: c.y,
    });
  });

  // Send the initial state object
  socket.send(
    JSON.stringify({
      type: "init",
      id: playerId,
      players: playersList,
      food: foodList,
      coins: coinList,
      worldSize: WORLD_SIZE,
      worldRadius: WORLD_RADIUS,
    })
  );

  // Broadcast to other players that a new player has joined
  broadcastNewPlayer(playerId);
}

// Handle player input messages
function handlePlayerInput(playerId, data) {
  const player = players.get(playerId);
  if (!player || player.isDead) return;

  player.lastInput = Date.now();

  switch (data.type) {
    case "direction":
      // Update player direction based on input
      player.direction = data.angle;
      break;
    case "boost":
      // Update player speed for boost
      player.speed = data.boosting ? 200 : 130;
      break;
    case "ping":
      // Just update lastInput timestamp - no other action needed
      console.log(`Received ping from player ${playerId}`);
      break;
    default:
      console.log(`Unknown message type from player ${playerId}: ${data.type}`);
  }
}

// Broadcast new player to all other players
function broadcastNewPlayer(newPlayerId) {
  const newPlayer = players.get(newPlayerId);
  if (!newPlayer) return;

  const playerData = {
    id: newPlayer.id,
    x: newPlayer.x,
    y: newPlayer.y,
    direction: newPlayer.direction,
    sections: newPlayer.sections,
    length: newPlayer.length,
    scale: newPlayer.scale,
  };

  const message = JSON.stringify({
    type: "newPlayer",
    player: playerData,
  });

  players.forEach((player) => {
    if (player.id !== newPlayerId && player.socket.readyState === WebSocket.OPEN) {
      player.socket.send(message);
    }
  });
}

// Broadcast player disconnect to all other players
function broadcastPlayerDisconnect(disconnectedId) {
  const message = JSON.stringify({
    type: "playerDisconnect",
    id: disconnectedId,
  });

  players.forEach((player) => {
    if (player.id !== disconnectedId && player.socket.readyState === WebSocket.OPEN) {
      player.socket.send(message);
    }
  });
}

// Game update loop
function updateGame() {
  // Process player movements
  players.forEach((player) => {
    if (player.isDead) return;

    // Move player based on their current direction and speed
    const speed = player.speed / TICK_RATE; // Speed per tick
    const dx = Math.sin(player.direction) * speed;
    const dy = Math.cos(player.direction) * speed;

    player.x += dx;
    player.y += dy;

    // Handle world boundary
    const distanceFromCenter = Math.sqrt(player.x * player.x + player.y * player.y);
    if (distanceFromCenter > WORLD_RADIUS - 10) {
      // Player hit the boundary, they die
      killPlayer(player.id);
      return;
    }

    // Update headPath for snake sections
    // Remove last point and add new head position at the beginning
    if (player.headPath.length > 0) {
      const point = player.headPath.pop();
      point.x = player.x;
      point.y = player.y;
      player.headPath.unshift(point);
    }

    // Update sections positions based on headPath
    const preferredDistance = 17 * player.scale;
    let index = 0;

    for (let i = 0; i < player.sections.length; i++) {
      if (index < player.headPath.length) {
        player.sections[i].x = player.headPath[index].x;
        player.sections[i].y = player.headPath[index].y;

        // Find next point index based on preferred distance
        index = findNextPointIndex(player.headPath, index, preferredDistance);
      }
    }

    // Check for collisions with food
    food.forEach((foodItem, foodId) => {
      const dx = player.x - foodItem.x;
      const dy = player.y - foodItem.y;
      const distance = Math.sqrt(dx * dx + dy * dy);

      // If close enough to eat
      if (distance < 15 * player.scale) {
        // Remove food and add length to snake
        food.delete(foodId);
        player.length += 1;

        // Add new section (will be properly positioned in next tick)
        if (player.sections.length > 0) {
          const lastSection = player.sections[player.sections.length - 1];
          player.sections.push({
            x: lastSection.x,
            y: lastSection.y,
          });
        }

        // Slightly increase scale
        player.scale *= 1.01;

        // Spawn new food
        const newFoodId = nextFoodId++;
        food.set(newFoodId, {
          id: newFoodId,
          x: randomCoordinate(WORLD_SIZE.width / 2),
          y: randomCoordinate(WORLD_SIZE.height / 2),
          value: 1,
        });
      }
    });

    // Check for collisions with other snakes
    players.forEach((otherPlayer) => {
      if (otherPlayer.id === player.id || otherPlayer.isDead) return;

      // Check if head collides with any section of other snake
      for (let i = 0; i < otherPlayer.sections.length; i++) {
        const section = otherPlayer.sections[i];
        const dx = player.x - section.x;
        const dy = player.y - section.y;
        const distance = Math.sqrt(dx * dx + dy * dy);

        if (distance < 15 * player.scale) {
          // Head collision with other snake's body
          killPlayer(player.id);
          return;
        }
      }
    });
  });

  // Send updates to all players
  broadcastGameState();
}

// Find the appropriate index in headPath for the next snake section
function findNextPointIndex(headPath, currentIndex, preferredDistance) {
  if (currentIndex >= headPath.length - 1) return headPath.length - 1;

  let totalDistance = 0;
  let i = currentIndex;

  while (i < headPath.length - 1) {
    const p1 = headPath[i];
    const p2 = headPath[i + 1];
    const dx = p2.x - p1.x;
    const dy = p2.y - p1.y;
    const segmentDistance = Math.sqrt(dx * dx + dy * dy);

    totalDistance += segmentDistance;

    if (totalDistance >= preferredDistance) {
      return i + 1;
    }

    i++;
  }

  return headPath.length - 1;
}

// Kill a player and handle their death (create coins, etc.)
function killPlayer(playerId) {
  const player = players.get(playerId);
  if (!player || player.isDead) return;

  player.isDead = true;

  // Create coins from dead snake
  for (let i = 0; i < player.sections.length; i += Math.max(1, Math.floor(player.sections.length / player.length) * 2)) {
    const section = player.sections[i];
    const coinId = nextCoinId++;

    coins.set(coinId, {
      id: coinId,
      x: section.x + (Math.random() * 20 - 10),
      y: section.y + (Math.random() * 20 - 10),
      value: 1,
    });
  }

  // Send death message to player
  if (player.socket.readyState === WebSocket.OPEN) {
    player.socket.send(
      JSON.stringify({
        type: "death",
        id: playerId,
        length: player.length,
      })
    );
  }

  // Broadcast death to all players
  broadcastPlayerDeath(playerId);
}

// Broadcast player death to other players
function broadcastPlayerDeath(deadPlayerId) {
  const message = JSON.stringify({
    type: "playerDeath",
    id: deadPlayerId,
  });

  players.forEach((player) => {
    if (!player.isDead && player.id !== deadPlayerId && player.socket.readyState === WebSocket.OPEN) {
      player.socket.send(message);
    }
  });
}

// Broadcast current game state to all players
function broadcastGameState() {
  // Prepare data for each player
  players.forEach((player) => {
    if (player.isDead || !player.socket || player.socket.readyState !== WebSocket.OPEN) return;

    try {
      // Get visible players
      const visiblePlayers = [];
      players.forEach((otherPlayer) => {
        if (!otherPlayer.isDead) {
          // Make sure we have valid data for this player
          if (typeof otherPlayer.x !== "number" || typeof otherPlayer.y !== "number") {
            return; // Skip players with invalid position data
          }

          visiblePlayers.push({
            id: otherPlayer.id,
            x: otherPlayer.x,
            y: otherPlayer.y,
            direction: otherPlayer.direction,
            sections: otherPlayer.sections,
            length: otherPlayer.length,
            scale: otherPlayer.scale,
          });
        }
      });

      // Get visible food
      const visibleFood = [];
      food.forEach((f) => {
        if (typeof f.x !== "number" || typeof f.y !== "number") {
          return; // Skip food with invalid position data
        }

        visibleFood.push({
          id: f.id,
          x: f.x,
          y: f.y,
        });
      });

      // Get visible coins
      const visibleCoins = [];
      coins.forEach((c) => {
        if (typeof c.x !== "number" || typeof c.y !== "number") {
          return; // Skip coins with invalid position data
        }

        visibleCoins.push({
          id: c.id,
          x: c.x,
          y: c.y,
        });
      });

      // Send update
      const updateMessage = {
        type: "update",
        players: visiblePlayers,
        food: visibleFood,
        coins: visibleCoins,
      };

      player.socket.send(JSON.stringify(updateMessage));
    } catch (error) {
      console.error(`Error broadcasting to player ${player.id}:`, error);
    }
  });
}

// Remove inactive players (no input for a while)
function cleanupInactivePlayers() {
  const now = Date.now();
  const timeout = 60000; // 60 seconds (increased from 30 seconds)

  players.forEach((player, playerId) => {
    if (!player.isDead && now - player.lastInput > timeout) {
      console.log(`Player ${playerId} timed out (inactive)`);
      players.delete(playerId);
      broadcastPlayerDisconnect(playerId);
    }
  });
}

// Start game loop
const tickInterval = 1000 / TICK_RATE;
setInterval(updateGame, tickInterval);

// Start inactive player cleanup (every 5 seconds)
setInterval(cleanupInactivePlayers, 5000);

// Start the server
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
