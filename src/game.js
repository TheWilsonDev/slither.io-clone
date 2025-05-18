Game = function (game) {};

Game.prototype = {
  preload: function () {
    //load assets
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

    this.game.world.setBounds(-width * 3, -height * 3, width * 6, height * 6);
    this.game.stage.backgroundColor = "#444";

    //add tilesprite background
    var background = this.game.add.tileSprite(-width * 3, -height * 3, this.game.world.width, this.game.world.height, "background");

    // Add circular world border
    var worldRadius = Math.min(this.game.world.width, this.game.world.height) / 2;
    this.game.worldRadius = worldRadius; // Store worldRadius on the game object
    var borderGraphics = this.game.add.graphics(0, 0);
    borderGraphics.lineStyle(10, 0x0000ff, 1); // 10px thick, blue, 100% alpha
    borderGraphics.drawCircle(this.game.world.centerX, this.game.world.centerY, worldRadius * 2); // Phaser's drawCircle takes diameter
    this.game.world.add(borderGraphics);

    //initialize physics and groups
    this.game.physics.startSystem(Phaser.Physics.P2JS);
    this.foodGroup = this.game.add.group();
    this.coinGroup = this.game.add.group();
    this.snakeHeadCollisionGroup = this.game.physics.p2.createCollisionGroup();
    this.foodCollisionGroup = this.game.physics.p2.createCollisionGroup();
    this.coinCollisionGroup = this.game.physics.p2.createCollisionGroup();
    this.game.renderer.renderSession.roundPixels = true;

    //add food randomly
    for (var i = 0; i < 100; i++) {
      this.initFood(Util.randomInt(-width * 3, width * 3), Util.randomInt(-height * 3, height * 3));
    }

    this.game.snakes = [];

    //create player
    var snake = new PlayerSnake(this.game, "circle", 0, 0);
    this.playerSnake = snake; // Store a reference to the player's snake
    this.game.camera.follow(this.playerSnake.head);

    //create bots
    new BotSnake(this.game, "circle", -200, 0);
    new BotSnake(this.game, "circle", 200, 0);

    //initialize snake groups and collision
    for (var i = 0; i < this.game.snakes.length; i++) {
      var snake = this.game.snakes[i];
      snake.head.body.setCollisionGroup(this.snakeHeadCollisionGroup);
      snake.head.body.collides([this.foodCollisionGroup, this.coinCollisionGroup]);
      //callback for when a snake is destroyed
      snake.addDestroyedCallback(this.snakeDestroyed, this);
    }
  },
  /**
   * Main update loop
   */
  update: function () {
    //update game components
    for (var i = this.game.snakes.length - 1; i >= 0; i--) {
      this.game.snakes[i].update();
    }
    for (var i = this.foodGroup.children.length - 1; i >= 0; i--) {
      var f = this.foodGroup.children[i];
      f.food.update();
    }
    for (var i = this.coinGroup.children.length - 1; i >= 0; i--) {
      var c = this.coinGroup.children[i];
      if (c && c.coin) {
        c.coin.update();
      }
    }
  },
  /**
   * Create a piece of food at a point
   * @param  {number} x x-coordinate
   * @param  {number} y y-coordinate
   * @return {Food}   food object created
   */
  initFood: function (x, y) {
    var f = new Food(this.game, x, y);
    f.sprite.body.setCollisionGroup(this.foodCollisionGroup);
    this.foodGroup.add(f.sprite);
    f.sprite.body.collides([this.snakeHeadCollisionGroup]);
    return f;
  },
  /**
   * Create a piece of coin at a point
   * @param  {number} x x-coordinate
   * @param  {number} y y-coordinate
   * @return {Coin}   coin object created
   */
  initCoin: function (x, y) {
    var c = new Coin(this.game, x, y);
    c.sprite.body.setCollisionGroup(this.coinCollisionGroup);
    this.coinGroup.add(c.sprite);
    c.sprite.body.collides([this.snakeHeadCollisionGroup]);
    return c;
  },
  snakeDestroyed: function (snake) {
    //place coins where snake was destroyed
    for (var i = 0; i < snake.headPath.length; i += Math.round(snake.headPath.length / snake.snakeLength) * 2) {
      this.initCoin(snake.headPath[i].x + Util.randomInt(-10, 10), snake.headPath[i].y + Util.randomInt(-10, 10));
    }

    if (snake instanceof PlayerSnake) {
      // If the player's snake is destroyed, show the death popup with stats
      this.showDeathPopup(snake);
    }
  },

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

    // The old playerSnake instance is destroyed by its own 'destroy' method,
    // which is called via the collision or boundary checks.
    // The 'destroy' method also handles removing itself from 'this.game.snakes'.

    // Create a new player snake at the center
    // The PlayerSnake constructor (which calls Snake constructor) will add it to this.game.snakes
    this.playerSnake = new PlayerSnake(this.game, "circle", 0, 0);

    // Ensure camera follows the new player snake's head
    this.game.camera.follow(this.playerSnake.head);

    // Re-apply collision settings and destroyed callback for the new player snake
    // This is similar to the setup in Game.create
    if (this.playerSnake && this.playerSnake.head && this.playerSnake.head.body) {
      this.playerSnake.head.body.setCollisionGroup(this.snakeHeadCollisionGroup);
      // From Game.create: snake.head.body.collides([this.foodCollisionGroup, this.coinCollisionGroup]);
      // Also need to consider collisions with other snakes' sections.
      // The original Snake constructor in snake.js sets up:
      // sec.body.setCollisionGroup(this.collisionGroup);
      // sec.body.collides([]);
      // this.edge.body.setCollisionGroup(this.game.physics.p2.createCollisionGroup()); // This is specific to edge
      // this.edge.body.collides([this.foodCollisionGroup, this.coinCollisionGroup]); // This is edge, not head.

      // Let's check what Game.create does for the snake's *head* specifically regarding collisions.
      // In Game.create:
      // snake.head.body.setCollisionGroup(this.snakeHeadCollisionGroup);
      // snake.head.body.collides([this.foodCollisionGroup, this.coinCollisionGroup]);
      // It also adds: snake.addDestroyedCallback(this.snakeDestroyed, this);

      // For head-on-head or head-on-body collisions, these are handled by `edgeContact` in Snake.js
      // The `edge` sprite has its own collision group and setup in Snake.js
      // The `sections` of the snake also have their own collision group (this.collisionGroup in Snake.js)
      // and `collides([])` by default, meaning they don't initiate collision callbacks but can be hit.

      // So, for the player's head, we primarily care about collisions with food and coins.
      this.playerSnake.head.body.collides([this.foodCollisionGroup, this.coinCollisionGroup]);

      // Add the game's snakeDestroyed callback to the new player snake instance
      this.playerSnake.addDestroyedCallback(this.snakeDestroyed, this);

      // Ensure the new snake is part of the main snake array if not already handled by constructor
      // (Snake constructor already adds 'this' to this.game.snakes)
      // However, we should ensure it's correctly managed if an old one was removed.
      // Since Snake.destroy removes it from this.game.snakes, and Snake constructor adds it, this should be fine.

      console.log("Player has respawned at (0,0).");
    } else {
      console.error("Failed to create or access new playerSnake for respawn.");
    }
  },
};
