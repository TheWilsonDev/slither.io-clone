Game = function (game) {
  this.networkManager = null;
};

Game.prototype = {
  preload: function () {
    // Load assets
    this.game.load.image("circle", "asset/circle.png");
    this.game.load.image("shadow", "asset/white-shadow.png");
    this.game.load.image("background", "asset/tile.png");

    this.game.load.image("eye-white", "asset/eye-white.png");
    this.game.load.image("eye-black", "asset/eye-black.png");

    this.game.load.image("food", "asset/food.png");
    this.game.load.image("coin", "asset/coin.png");
  },

  create: function () {
    var width = this.game.width;
    var height = this.game.height;

    // Default world size for single player mode
    // In multiplayer, this will be updated based on server settings
    this.game.world.setBounds(-width * 3, -height * 3, width * 6, height * 6);
    this.game.stage.backgroundColor = "#444";

    // Add tilesprite background
    var background = this.game.add.tileSprite(-width * 3, -height * 3, this.game.world.width, this.game.world.height, "background");

    // Add circular world border (placeholder - will be updated in multiplayer)
    var worldRadius = Math.min(this.game.world.width, this.game.world.height) / 2;
    this.game.worldRadius = worldRadius;
    var borderGraphics = this.game.add.graphics(0, 0);
    borderGraphics.lineStyle(10, 0x0000ff, 1);
    borderGraphics.drawCircle(this.game.world.centerX, this.game.world.centerY, worldRadius * 2);
    this.game.world.add(borderGraphics);
    this.borderGraphics = borderGraphics;

    // Initialize physics and groups
    this.game.physics.startSystem(Phaser.Physics.P2JS);
    this.foodGroup = this.game.add.group();
    this.coinGroup = this.game.add.group();
    this.snakeHeadCollisionGroup = this.game.physics.p2.createCollisionGroup();
    this.foodCollisionGroup = this.game.physics.p2.createCollisionGroup();
    this.coinCollisionGroup = this.game.physics.p2.createCollisionGroup();
    this.game.renderer.renderSession.roundPixels = true;

    // Initialize empty snake array
    this.game.snakes = [];

    // Create NetworkManager for multiplayer
    this.networkManager = new NetworkManager(this);

    // Event handler for when network connection is established and initial state received
    this.onNetworkReady = this.handleNetworkReady.bind(this);

    // Event handler for when disconnected from server
    this.onDisconnected = this.handleDisconnect.bind(this);

    // Connect to server for multiplayer
    this.networkManager.connect();

    // Show loading message
    this.loadingText = this.game.add.text(this.game.world.centerX, this.game.world.centerY, "Connecting to server...", { font: "32px Arial", fill: "#ffffff" });
    this.loadingText.anchor.setTo(0.5);
    this.loadingText.fixedToCamera = true;

    // In multiplayer mode we'll create the player snake after connection
    // In single player mode, initialize food and player immediately
    if (!this.networkManager.connected) {
      console.log("Single player mode detected");
      // Wait a moment just in case connection happens quickly
      setTimeout(() => {
        if (!this.networkManager.connected) {
          this.initSinglePlayerMode();
        }
      }, 1000);
    }
  },

  /**
   * Initialize single player mode with local food and player
   */
  initSinglePlayerMode: function () {
    if (this.loadingText) {
      this.loadingText.destroy();
      this.loadingText = null;
    }

    var width = this.game.width;
    var height = this.game.height;

    console.log("Initializing single player mode");

    // Add food randomly
    for (var i = 0; i < 100; i++) {
      this.initFood(Util.randomInt(-width * 3, width * 3), Util.randomInt(-height * 3, height * 3));
    }

    // Create player snake
    this.createPlayerSnake(0, 0);
  },

  /**
   * Handle when network connection is ready and initial state received
   */
  handleNetworkReady: function (playerId) {
    try {
      console.log("Network ready, creating player snake with ID:", playerId);

      // Remove loading text if it exists
      if (this.loadingText) {
        this.loadingText.destroy();
        this.loadingText = null;
      }

      // Make sure we don't create a duplicate player
      if (this.playerSnake) {
        console.log("Player snake already exists, not creating a new one");
        return;
      }

      // Create player snake based on server-assigned position
      this.createPlayerSnake(0, 0);

      // Give the player a chance to get acclimated before game starts
      setTimeout(() => {
        console.log("Multiplayer game started!");
      }, 1000);
    } catch (e) {
      console.error("Error handling network ready:", e);
    }
  },

  /**
   * Handle disconnection from server
   */
  handleDisconnect: function () {
    console.log("Disconnected from server");

    // Show disconnection message or handle gracefully
    alert("Disconnected from server. Refresh to reconnect.");
  },

  /**
   * Create player snake and set up camera
   */
  createPlayerSnake: function (x, y) {
    try {
      // Create player snake
      var snake = new PlayerSnake(this.game, "circle", x, y);

      // Make sure the snake was created successfully
      if (!snake || !snake.head) {
        console.error("Failed to create player snake");
        return;
      }

      this.playerSnake = snake;

      // Set up camera to follow snake
      if (this.game.camera) {
        this.game.camera.follow(this.playerSnake.head);
      }

      // Initialize snake collision groups
      if (snake.head && snake.head.body) {
        snake.head.body.setCollisionGroup(this.snakeHeadCollisionGroup);
        snake.head.body.collides([this.foodCollisionGroup, this.coinCollisionGroup]);

        // Callback for when snake is destroyed
        snake.addDestroyedCallback(this.snakeDestroyed, this);

        console.log("Player snake created successfully");
      } else {
        console.error("Player snake created but head is missing or invalid");
      }
    } catch (e) {
      console.error("Error creating player snake:", e);
    }
  },

  /**
   * Main update loop
   */
  update: function () {
    // Update network manager (handle incoming data, interpolation, etc.)
    if (this.networkManager) {
      this.networkManager.update();
    }

    // Update player's snake direction based on cursor position
    if (this.playerSnake && !this.playerSnake.isBeingDestroyed && this.networkManager && this.networkManager.connected) {
      try {
        // Calculate angle from head to mouse position
        var mousePosX = this.game.input.activePointer.worldX;
        var mousePosY = this.game.input.activePointer.worldY;
        var headX = this.playerSnake.head.body.x;
        var headY = this.playerSnake.head.body.y;
        var angle = Math.atan2(mousePosX - headX, mousePosY - headY);

        // Send direction update to server
        this.networkManager.sendDirection(angle);
      } catch (e) {
        console.error("Error updating player direction:", e);
      }
    }

    // Update game components
    if (this.game.snakes) {
      for (var i = this.game.snakes.length - 1; i >= 0; i--) {
        if (this.game.snakes[i]) {
          this.game.snakes[i].update();
        }
      }
    }

    if (this.foodGroup && this.foodGroup.children) {
      for (var i = this.foodGroup.children.length - 1; i >= 0; i--) {
        var f = this.foodGroup.children[i];
        if (f && f.food) {
          f.food.update();
        }
      }
    }

    if (this.coinGroup && this.coinGroup.children) {
      for (var i = this.coinGroup.children.length - 1; i >= 0; i--) {
        var c = this.coinGroup.children[i];
        if (c && c.coin) {
          c.coin.update();
        }
      }
    }
  },

  /**
   * Create a piece of food at a point
   * @param  {number} x x-coordinate
   * @param  {number} y y-coordinate
   * @param  {number} id     optional network ID
   * @return {Food}   food object created
   */
  initFood: function (x, y, id) {
    try {
      var f = new Food(this.game, x, y, id);
      f.sprite.body.setCollisionGroup(this.foodCollisionGroup);
      this.foodGroup.add(f.sprite);

      // Only set up collisions if we have snakes
      if (this.game.snakes && this.game.snakes.length > 0) {
        f.sprite.body.collides([this.snakeHeadCollisionGroup]);
      }

      return f;
    } catch (e) {
      console.error("Error creating food:", e);
      return null;
    }
  },

  /**
   * Create a piece of coin at a point
   * @param  {number} x x-coordinate
   * @param  {number} y y-coordinate
   * @param  {number} id     optional network ID
   * @return {Coin}   coin object created
   */
  initCoin: function (x, y, id) {
    try {
      var c = new Coin(this.game, x, y, id);
      c.sprite.body.setCollisionGroup(this.coinCollisionGroup);
      this.coinGroup.add(c.sprite);

      // Only set up collisions if we have snakes
      if (this.game.snakes && this.game.snakes.length > 0) {
        c.sprite.body.collides([this.snakeHeadCollisionGroup]);
      }

      return c;
    } catch (e) {
      console.error("Error creating coin:", e);
      return null;
    }
  },

  /**
   * Handle snake destruction
   * @param  {Snake} snake destroyed snake
   */
  snakeDestroyed: function (snake) {
    // In networked mode, coins are spawned by the server
    if (!this.networkManager || !this.networkManager.connected) {
      // Place coins where snake was destroyed (single-player mode only)
      for (var i = 0; i < snake.headPath.length; i += Math.round(snake.headPath.length / snake.snakeLength) * 2) {
        this.initCoin(snake.headPath[i].x + Util.randomInt(-10, 10), snake.headPath[i].y + Util.randomInt(-10, 10));
      }
    }

    if (snake instanceof PlayerSnake) {
      // If the player's snake is destroyed, show the death popup with stats
      this.showDeathPopup(snake);
    }
  },

  /**
   * Show death popup with stats
   * @param  {PlayerSnake} snake destroyed player snake
   */
  showDeathPopup: function (snake) {
    var popup = document.getElementById("death-popup");
    var respawnButton = document.getElementById("respawn-button");
    var statsMessage = document.getElementById("death-stats");

    if (popup && respawnButton && statsMessage) {
      // Update stats message with snake information
      if (snake) {
        var snakeLength = Math.round(snake.snakeLength);
        var survivalTime = Math.round((this.game.time.now - snake.creationTime) / 1000);
        statsMessage.innerHTML = "Length: " + snakeLength + "<br>Survived: " + survivalTime + " seconds";
      } else {
        statsMessage.innerHTML = "Better luck next time!";
      }

      // Set opacity to 0 first to ensure animation works correctly
      popup.style.opacity = "0";
      popup.style.display = "block";

      // Trigger reflow to ensure CSS animation plays properly
      void popup.offsetWidth;

      // Reset opacity to allow animation to play
      popup.style.opacity = "1";

      // Remove any existing event listener to prevent duplicates
      var newRespawnButton = respawnButton.cloneNode(true);
      respawnButton.parentNode.replaceChild(newRespawnButton, respawnButton);
      newRespawnButton.addEventListener("click", this.respawnPlayer.bind(this));
    } else {
      console.error("Death popup, respawn button, or stats element not found in HTML.");
    }
  },

  /**
   * Respawn player after death
   */
  respawnPlayer: function () {
    var popup = document.getElementById("death-popup");
    if (popup) {
      // Add fade out animation
      popup.style.opacity = "0";
      popup.style.transform = "translate(-50%, -50%) scale(0.9)";

      // Hide the popup after animation completes
      setTimeout(function () {
        popup.style.display = "none";
        // Reset transform for next time
        popup.style.transform = "translate(-50%, -50%) scale(1)";
      }, 300);
    }

    // In networked mode, we just create a new connection to the server
    if (this.networkManager && this.networkManager.connected) {
      window.location.reload(); // Simple way to reconnect to the server
      return;
    }

    // Single player mode respawn
    this.playerSnake = new PlayerSnake(this.game, "circle", 0, 0);
    this.game.camera.follow(this.playerSnake.head);

    // Re-apply collision settings and destroyed callback
    if (this.playerSnake && this.playerSnake.head && this.playerSnake.head.body) {
      this.playerSnake.head.body.setCollisionGroup(this.snakeHeadCollisionGroup);
      this.playerSnake.head.body.collides([this.foodCollisionGroup, this.coinCollisionGroup]);
      this.playerSnake.addDestroyedCallback(this.snakeDestroyed, this);

      console.log("Player has respawned at (0,0).");
    } else {
      console.error("Failed to create or access new playerSnake for respawn.");
    }
  },
};
