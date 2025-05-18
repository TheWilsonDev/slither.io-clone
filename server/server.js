const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const path = require("path");

const app = express();
const server = http.createServer(app);

// Serve static files from the project root (one level up from 'server' directory)
const projectRoot = path.join(__dirname, "..");
app.use(express.static(projectRoot));

// Specifically serve index.html for the root path
app.get("/", (req, res) => {
  res.sendFile(path.join(projectRoot, "index.html"));
});

const io = new Server(server, {
  cors: {
    origin: "*", // Allow all origins for development
    methods: ["GET", "POST"],
  },
});

const players = {}; // Object to store player data

const C_WIDTH = 1920; // Assumed canvas width for generating positions
const C_HEIGHT = 1080; // Assumed canvas height
const COLORS = ["#FF0000", "#00FF00", "#0000FF", "#FFFF00", "#FF00FF", "#00FFFF"];

const LOG_PLAYER_MOVEMENT = true; // Set to false to disable movement logs
const SERVER_LOG_THROTTLE_INTERVAL = 10; // Log 1 out of every N received movements per player

io.on("connection", (socket) => {
  console.log("A user connected:", socket.id);

  // Store the new player with initial properties
  players[socket.id] = {
    id: socket.id,
    x: Math.floor(Math.random() * C_WIDTH),
    y: Math.floor(Math.random() * C_HEIGHT),
    color: COLORS[Math.floor(Math.random() * COLORS.length)],
    movementLogCounter: 0, // Initialize counter for logging
  };

  // Send the list of current players to the new player
  socket.emit("currentPlayers", players);

  // Announce the new player to all other existing players
  socket.broadcast.emit("newPlayer", players[socket.id]);

  // Listen for player movement
  socket.on("playerMovement", (movementData) => {
    if (players[socket.id]) {
      players[socket.id].x = movementData.x;
      players[socket.id].y = movementData.y;
      players[socket.id].movementLogCounter++;

      if (LOG_PLAYER_MOVEMENT && players[socket.id].movementLogCounter % SERVER_LOG_THROTTLE_INTERVAL === 0) {
        console.log(`Mov (${players[socket.id].movementLogCounter}) from ${socket.id}: X=${movementData.x.toFixed(2)}, Y=${movementData.y.toFixed(2)}`);
      }

      // Broadcast the movement to all other clients
      socket.broadcast.emit("playerMoved", players[socket.id]);
    }
  });

  socket.on("disconnect", () => {
    console.log("User disconnected:", socket.id);
    // Remove player from our players object
    delete players[socket.id];
    // Emit a message to all other players that this player has disconnected
    io.emit("playerDisconnected", socket.id);
  });
});

const PORT = process.env.PORT || 3000;

server.listen(PORT, () => {
  console.log(`Server listening on http://localhost:${PORT}`);
  console.log(`Serving static files from: ${projectRoot}`);
});
