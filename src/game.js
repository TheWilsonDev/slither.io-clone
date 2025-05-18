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
    this.game.camera.follow(snake.head);

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
  },
};
