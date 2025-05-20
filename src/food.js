/**
 * Food object with physics/collisions
 * @param  {Phaser.Game} game  game object
 * @param  {Number} x     x-coordinate
 * @param  {Number} y     y-coordinate
 * @param  {Number} id    optional network ID for multiplayer
 */
Food = function (game, x, y, id) {
  this.game = game;
  this.debug = false;
  this.sprite = game.add.sprite(x, y, "food");
  this.sprite.food = this;
  this.id = id;

  // Enable physics
  game.physics.p2.enable(this.sprite, this.debug);
  this.sprite.body.setCircle(this.sprite.width / 2);
  this.sprite.scale.setTo(0.5);

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
};

Food.prototype = {
  /**
   * Called when snake eats food
   * @param  {Phaser.Sprite} foodBody  food sprite
   * @param  {Phaser.Sprite} snakeBody snake sprite
   */
  snakeEat: function (foodBody, snakeBody) {
    // In multiplayer, only process collision on server
    // Client should only display food
    if (this.game.networkManager && this.game.networkManager.connected) {
      return; // Food collisions are handled by server
    }

    if (snakeBody && snakeBody.sprite && snakeBody.sprite.snake) {
      var snake = snakeBody.sprite.snake;
      // Add length to snake
      snake.incrementSize();

      // Destroy food
      this.destroy();

      // Respawn food (only in single player mode)
      if (!this.game.networkManager) {
        var width = this.game.width;
        var height = this.game.height;
        this.game.initFood(Util.randomInt(-width, width), Util.randomInt(-height, height));
      }
    }
  },
  /**
   * Update physics
   */
  update: function () {
    // No movement in this example
  },
  /**
   * Destroy this food
   */
  destroy: function () {
    this.sprite.destroy();
  },
};
