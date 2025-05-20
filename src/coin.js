/**
 * Coin that snake eats
 * @param  {Phaser.Game} game  game object
 * @param  {Number} x     x-coordinate
 * @param  {Number} y     y-coordinate
 * @param  {Number} id    optional network ID for multiplayer
 */
Coin = function (game, x, y, id) {
  this.game = game;
  this.debug = false;
  this.sprite = game.add.sprite(x, y, "coin");
  this.sprite.coin = this;
  this.id = id;

  // Enable physics
  game.physics.p2.enable(this.sprite, this.debug);
  this.sprite.body.setCircle(this.sprite.width / 2);

  // Set random scale (between 0.5 and 0.75)
  this.scale = 0.5 + Math.random() * 0.25;
  this.sprite.scale.setTo(this.scale);

  // Set collision groups
  this.sprite.body.setCollisionGroup(game.physics.p2.createCollisionGroup());

  // Only set up collisions with snakes if there are any
  if (this.game.snakes && this.game.snakes.length > 0) {
    for (var i = 0; i < this.game.snakes.length; i++) {
      if (this.game.snakes[i] && this.game.snakes[i].snakeHeadCollisionGroup) {
        this.sprite.body.collides([this.game.snakes[i].collisionGroup, this.game.snakes[i].snakeHeadCollisionGroup], this.snakeEat, this);
      }
    }
  }

  // Flicker effect for the coin
  this.flickerRate = 200 + Math.random() * 200;
  this.flickerTimer = 0;
};

Coin.prototype = {
  /**
   * Called when snake eats coin
   * @param  {Phaser.Sprite} coinBody   coin sprite
   * @param  {Phaser.Sprite} snakeBody  snake sprite
   */
  snakeEat: function (coinBody, snakeBody) {
    // In multiplayer, only process collision on server
    // Client should only display coins
    if (this.game.networkManager && this.game.networkManager.connected) {
      return; // Coin collisions are handled by server
    }

    if (snakeBody && snakeBody.sprite && snakeBody.sprite.snake) {
      var snake = snakeBody.sprite.snake;
      // Add more length for coins compared to food
      for (var i = 0; i < 3; i++) {
        snake.incrementSize();
      }

      // Destroy coin
      this.destroy();
    }
  },
  /**
   * Update coin animation
   */
  update: function () {
    // Flicker effect
    this.flickerTimer += this.game.time.elapsed;
    if (this.flickerTimer > this.flickerRate) {
      this.flickerTimer = 0;
      this.sprite.alpha = this.sprite.alpha === 1 ? 0.7 : 1;
    }
  },
  /**
   * Destroy this coin
   */
  destroy: function () {
    this.sprite.destroy();
  },
};
