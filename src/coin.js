/**
 * Coin that snakes eat - dropped when a snake dies.
 * @param  {Phaser.Game} game game object
 * @param  {Number} x    coordinate
 * @param  {Number} y    coordinate
 */
Coin = function (game, x, y) {
  this.game = game;
  this.debug = false;
  this.sprite = this.game.add.sprite(x, y, "coin");
  this.sprite.scale.setTo(0.05); // Initial scale for the coin

  this.game.physics.p2.enable(this.sprite, this.debug);
  this.sprite.body.clearShapes();
  // Assuming coin.png is circular, adjust if it's not
  // If it's square, you might use addRectangle instead or adjust width/height for circle
  this.sprite.body.addCircle(this.sprite.width * 0.5);

  //set callback for when something hits the coin
  this.sprite.body.onBeginContact.add(this.onBeginContact, this);

  this.sprite.coin = this; // Reference to this Coin object from the sprite
};

Coin.prototype = {
  onBeginContact: function (phaserBody, p2Body) {
    // Check if the colliding body is a snake head
    if (phaserBody && phaserBody.sprite.name == "head") {
      phaserBody.sprite.snake.incrementSize(); // Or some other effect like score
      this.destroy();
    }
  },

  /**
   * Call from main update loop (not strictly necessary for static coins)
   */
  update: function () {
    // Coins are static, so no update logic needed unless they have animations or other behaviors.
  },

  /**
   * Destroy this coin
   */
  destroy: function () {
    if (this.sprite) {
      // Remove from coinGroup in game.js if necessary, though Phaser might handle this
      // Example: if (this.game.coinGroup.contains(this.sprite)) { this.game.coinGroup.remove(this.sprite); }
      this.sprite.destroy();
      this.sprite = null; // Clear reference
    }
  },
};
