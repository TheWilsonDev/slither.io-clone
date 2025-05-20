/**
 * Manages network communication between client and server
 */
NetworkManager = function (game) {
  this.game = game;
  this.socket = null;
  this.playerId = null;
  this.connected = false;
  this.serverUpdateBuffer = []; // Buffer for interpolation
  this.bufferSize = 3; // Number of updates to buffer
  this.lastProcessedUpdate = 0;
  this.latency = 0;
  this.remoteSnakes = new Map(); // Map to track other players' snakes
};

NetworkManager.prototype = {
  /**
   * Connect to WebSocket server
   */
  connect: function () {
    try {
      // Determine WebSocket URL based on current location
      const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
      const host = window.location.hostname;
      const port = window.location.port || (protocol === "wss:" ? "443" : "80");
      const wsUrl = `${protocol}//${host}:${port}`;

      console.log("Connecting to server at", wsUrl);

      this.socket = new WebSocket(wsUrl);

      // Set up event handlers
      this.socket.onopen = this.onConnect.bind(this);
      this.socket.onclose = this.onDisconnect.bind(this);
      this.socket.onerror = this.onError.bind(this);
      this.socket.onmessage = this.onMessage.bind(this);
    } catch (e) {
      console.error("Error connecting to WebSocket server:", e);
    }
  },

  /**
   * Called when connection is established
   */
  onConnect: function () {
    console.log("Connected to server");
    this.connected = true;

    // Send a dummy message to let the server know we're here
    this.sendPing();
  },

  /**
   * Called when connection is closed
   */
  onDisconnect: function () {
    console.log("Disconnected from server");
    this.connected = false;
    this.playerId = null;

    // Handle disconnection (could show reconnect dialog, etc.)
    if (this.game.onDisconnected) {
      this.game.onDisconnected();
    }
  },

  /**
   * Called when connection error occurs
   */
  onError: function (error) {
    console.error("WebSocket error:", error);
  },

  /**
   * Process messages from server
   */
  onMessage: function (event) {
    try {
      const message = JSON.parse(event.data);

      switch (message.type) {
        case "init":
          this.handleInitMessage(message);
          break;
        case "update":
          this.bufferUpdate(message);
          break;
        case "newPlayer":
          this.handleNewPlayerMessage(message);
          break;
        case "playerDisconnect":
          this.handlePlayerDisconnectMessage(message);
          break;
        case "playerDeath":
          this.handlePlayerDeathMessage(message);
          break;
        case "death":
          this.handleDeathMessage(message);
          break;
        default:
          console.warn("Unknown message type:", message.type);
      }
    } catch (e) {
      console.error("Error processing message:", e);
    }
  },

  /**
   * Handle initial game state from server
   */
  handleInitMessage: function (message) {
    try {
      console.log("Received init message, player ID:", message.id);

      this.playerId = message.id;

      // Handle all existing players
      if (message.players && Array.isArray(message.players)) {
        message.players.forEach((playerData) => {
          this.createRemoteSnake(playerData);
        });
      }

      // Handle all existing food
      if (message.food && Array.isArray(message.food)) {
        message.food.forEach((foodData) => {
          if (foodData && foodData.x !== undefined && foodData.y !== undefined) {
            this.game.initFood(foodData.x, foodData.y, foodData.id);
          }
        });
      }

      // Handle all existing coins
      if (message.coins && Array.isArray(message.coins)) {
        message.coins.forEach((coinData) => {
          if (coinData && coinData.x !== undefined && coinData.y !== undefined) {
            this.game.initCoin(coinData.x, coinData.y, coinData.id);
          }
        });
      }

      // Set world size
      if (message.worldSize) {
        this.game.world.setBounds(-message.worldSize.width / 2, -message.worldSize.height / 2, message.worldSize.width, message.worldSize.height);
      }

      // Set world radius
      if (message.worldRadius) {
        this.game.worldRadius = message.worldRadius;
      }

      // Tell the game we're ready
      if (this.game.onNetworkReady) {
        this.game.onNetworkReady(this.playerId);
      }
    } catch (e) {
      console.error("Error handling init message:", e);
    }
  },

  /**
   * Process state update from server
   */
  bufferUpdate: function (update) {
    // Add timestamp to update
    update.receivedTime = Date.now();

    // Add to buffer
    this.serverUpdateBuffer.push(update);

    // Keep buffer size limited
    if (this.serverUpdateBuffer.length > this.bufferSize) {
      this.serverUpdateBuffer.shift();
    }
  },

  /**
   * Process buffered updates
   */
  processUpdates: function () {
    if (this.serverUpdateBuffer.length === 0) return;

    try {
      // Take the oldest update from the buffer (for interpolation we use the oldest one)
      const update = this.serverUpdateBuffer[0];

      // Update all remote snakes
      if (update.players && Array.isArray(update.players)) {
        update.players.forEach((playerData) => {
          if (!playerData || typeof playerData !== "object") return;

          if (playerData.id === this.playerId) {
            // This is me - do server reconciliation if needed
            if (this.game.playerSnake && this.game.playerSnake.head && this.game.playerSnake.head.body) {
              // Make sure playerData has all required properties
              if (typeof playerData.x !== "number" || typeof playerData.y !== "number") {
                return; // Skip this update if position data is invalid
              }

              // Only apply corrections if position is significantly different
              const dx = this.game.playerSnake.head.body.x - playerData.x;
              const dy = this.game.playerSnake.head.body.y - playerData.y;
              const distSq = dx * dx + dy * dy;

              if (distSq > 100) {
                // If more than 10 units away, correct position
                this.game.playerSnake.head.body.x = playerData.x;
                this.game.playerSnake.head.body.y = playerData.y;
              }

              // Update length if needed
              if (playerData.length > this.game.playerSnake.snakeLength) {
                const lengthDiff = playerData.length - this.game.playerSnake.snakeLength;
                for (let i = 0; i < lengthDiff; i++) {
                  this.game.playerSnake.addSectionsAfterLast(1);
                }
              }

              // Update scale
              if (typeof playerData.scale === "number") {
                this.game.playerSnake.setScale(playerData.scale);
              }
            }
          } else {
            // This is another player
            // Make sure playerData has all required properties
            if (typeof playerData.id !== "number" && typeof playerData.id !== "string") {
              return; // Skip this player if ID is invalid
            }

            if (typeof playerData.x !== "number" || typeof playerData.y !== "number") {
              return; // Skip this update if position data is invalid
            }

            if (this.remoteSnakes.has(playerData.id)) {
              // Update existing snake
              this.updateRemoteSnake(playerData);
            } else {
              // Create new snake
              this.createRemoteSnake(playerData);
            }
          }
        });
      }

      // Update food
      if (update.food && Array.isArray(update.food)) {
        // Get current food IDs
        const currentFoodIds = new Set();
        if (this.game.foodGroup && this.game.foodGroup.children) {
          this.game.foodGroup.children.forEach((child) => {
            if (child && child.food && child.food.id) {
              currentFoodIds.add(child.food.id);
            }
          });
        }

        // Add new food and update existing
        update.food.forEach((foodData) => {
          if (!foodData || foodData.id === undefined) return;

          if (!currentFoodIds.has(foodData.id)) {
            this.game.initFood(foodData.x, foodData.y, foodData.id);
          }
          currentFoodIds.delete(foodData.id);
        });

        // Remove food not in update
        currentFoodIds.forEach((foodId) => {
          let foundIndex = -1;
          if (this.game.foodGroup && this.game.foodGroup.children) {
            this.game.foodGroup.children.forEach((child, index) => {
              if (child && child.food && child.food.id === foodId) {
                foundIndex = index;
              }
            });

            if (foundIndex !== -1) {
              const foodSprite = this.game.foodGroup.children[foundIndex];
              if (foodSprite && foodSprite.food) {
                foodSprite.food.destroy();
              }
            }
          }
        });
      }

      // Update coins
      if (update.coins && Array.isArray(update.coins)) {
        // Get current coin IDs
        const currentCoinIds = new Set();
        if (this.game.coinGroup && this.game.coinGroup.children) {
          this.game.coinGroup.children.forEach((child) => {
            if (child && child.coin && child.coin.id) {
              currentCoinIds.add(child.coin.id);
            }
          });
        }

        // Add new coins and update existing
        update.coins.forEach((coinData) => {
          if (!coinData || coinData.id === undefined) return;

          if (!currentCoinIds.has(coinData.id)) {
            this.game.initCoin(coinData.x, coinData.y, coinData.id);
          }
          currentCoinIds.delete(coinData.id);
        });

        // Remove coins not in update
        currentCoinIds.forEach((coinId) => {
          let foundIndex = -1;
          if (this.game.coinGroup && this.game.coinGroup.children) {
            this.game.coinGroup.children.forEach((child, index) => {
              if (child && child.coin && child.coin.id === coinId) {
                foundIndex = index;
              }
            });

            if (foundIndex !== -1) {
              const coinSprite = this.game.coinGroup.children[foundIndex];
              if (coinSprite && coinSprite.coin) {
                coinSprite.coin.destroy();
              }
            }
          }
        });
      }

      // Record that we processed the update
      this.lastProcessedUpdate = Date.now();
    } catch (e) {
      console.error("Error processing updates:", e);
    }
  },

  /**
   * Handle a new player joining the game
   */
  handleNewPlayerMessage: function (message) {
    try {
      if (message.player) {
        this.createRemoteSnake(message.player);
      }
    } catch (e) {
      console.error("Error handling new player message:", e);
    }
  },

  /**
   * Handle a player disconnecting
   */
  handlePlayerDisconnectMessage: function (message) {
    try {
      if (message.id !== undefined) {
        this.removeRemoteSnake(message.id);
      }
    } catch (e) {
      console.error("Error handling player disconnect message:", e);
    }
  },

  /**
   * Handle a player's death
   */
  handlePlayerDeathMessage: function (message) {
    try {
      if (message.id !== undefined) {
        this.removeRemoteSnake(message.id);
      }
    } catch (e) {
      console.error("Error handling player death message:", e);
    }
  },

  /**
   * Handle our own death from the server
   */
  handleDeathMessage: function (message) {
    try {
      if (message.id === this.playerId && this.game.playerSnake) {
        // Trigger death on our snake
        this.game.playerSnake.destroy();
      }
    } catch (e) {
      console.error("Error handling death message:", e);
    }
  },

  /**
   * Create a new remote snake for another player
   */
  createRemoteSnake: function (playerData) {
    try {
      // Make sure we don't already have this snake
      if (!playerData || !playerData.id || this.remoteSnakes.has(playerData.id)) {
        return;
      }

      // Create a new snake instance
      const snake = new Snake(this.game, "circle", playerData.x, playerData.y);
      snake.isRemote = true;
      snake.id = playerData.id;

      // Apply properties
      snake.setScale(playerData.scale);
      snake.head.body.angle = playerData.direction * (180 / Math.PI);

      // Store remote snake in our map
      this.remoteSnakes.set(playerData.id, snake);

      console.log(`Added remote snake for player ${playerData.id}`);
    } catch (e) {
      console.error("Error creating remote snake:", e);
    }
  },

  /**
   * Update a remote snake's position and properties
   */
  updateRemoteSnake: function (playerData) {
    try {
      if (!playerData || !playerData.id) return;

      const snake = this.remoteSnakes.get(playerData.id);
      if (!snake || !snake.head || !snake.head.body) return;

      // Interpolate movement (smoother transitions)
      // For simplicity, we'll use a basic approach here
      if (typeof playerData.x === "number") {
        snake.targetX = playerData.x;
      }

      if (typeof playerData.y === "number") {
        snake.targetY = playerData.y;
      }

      if (typeof playerData.direction === "number") {
        snake.targetDirection = playerData.direction;
      }

      // Update scale
      if (typeof playerData.scale === "number") {
        snake.setScale(playerData.scale);
      }

      // Update length if needed
      if (typeof playerData.length === "number" && playerData.length > snake.snakeLength) {
        const lengthDiff = playerData.length - snake.snakeLength;
        for (let i = 0; i < lengthDiff; i++) {
          snake.addSectionsAfterLast(1);
        }
      }
    } catch (e) {
      console.error("Error updating remote snake:", e);
    }
  },

  /**
   * Remove a remote snake (player disconnected or died)
   */
  removeRemoteSnake: function (playerId) {
    try {
      if (playerId === undefined) return;

      const snake = this.remoteSnakes.get(playerId);
      if (snake) {
        snake.destroy();
        this.remoteSnakes.delete(playerId);
        console.log(`Removed remote snake for player ${playerId}`);
      }
    } catch (e) {
      console.error("Error removing remote snake:", e);
    }
  },

  /**
   * Send direction update to server
   */
  sendDirection: function (angle) {
    try {
      if (!this.connected || !this.socket || this.socket.readyState !== WebSocket.OPEN) return;

      this.socket.send(
        JSON.stringify({
          type: "direction",
          angle: angle,
        })
      );
    } catch (e) {
      console.error("Error sending direction:", e);
    }
  },

  /**
   * Send boost state to server
   */
  sendBoost: function (boosting) {
    try {
      if (!this.connected || !this.socket || this.socket.readyState !== WebSocket.OPEN) return;

      this.socket.send(
        JSON.stringify({
          type: "boost",
          boosting: boosting,
        })
      );
    } catch (e) {
      console.error("Error sending boost state:", e);
    }
  },

  /**
   * Send a ping to the server to prevent timeout
   */
  sendPing: function () {
    try {
      if (this.connected && this.socket && this.socket.readyState === WebSocket.OPEN) {
        this.socket.send(
          JSON.stringify({
            type: "ping",
            timestamp: Date.now(),
          })
        );
      }
    } catch (e) {
      console.error("Error sending ping:", e);
    }
  },

  /**
   * Update function called from game loop
   */
  update: function () {
    try {
      // Only process updates if we're connected
      if (!this.connected || !this.socket || this.socket.readyState !== WebSocket.OPEN) {
        return;
      }

      // Process any buffered updates
      this.processUpdates();

      // Interpolate remote snakes
      this.remoteSnakes.forEach((snake) => {
        if (!snake || !snake.head || !snake.head.body) return;

        // Only interpolate if we have valid target coordinates
        if (typeof snake.targetX === "number" && typeof snake.targetY === "number") {
          // Simple linear interpolation
          const speed = 0.2; // Adjust for smoothness

          // Move toward target position
          snake.head.body.x += (snake.targetX - snake.head.body.x) * speed;
          snake.head.body.y += (snake.targetY - snake.head.body.y) * speed;

          // Rotate toward target direction
          if (typeof snake.targetDirection === "number") {
            // Convert to degrees for Phaser
            const targetAngle = snake.targetDirection * (180 / Math.PI);

            // Find the shortest rotation path
            let angleDiff = targetAngle - snake.head.body.angle;

            // Normalize to -180 to 180
            while (angleDiff > 180) angleDiff -= 360;
            while (angleDiff < -180) angleDiff += 360;

            // Apply rotation
            snake.head.body.angle += angleDiff * speed;
          }
        }
      });
    } catch (e) {
      console.error("Error in network update:", e);
    }
  },
};
