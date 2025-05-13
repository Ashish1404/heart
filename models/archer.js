const mongoose = require('mongoose');
const Schema = mongoose.Schema;

/**
 * Matches model schema
 */
const archerSchema = new Schema({
  round_id: String,
  user_id: String,
  game_id: String,
  market_id: String,
  game_name: String,
  bet_date: String,
  req_body: Object,
  res_body: Object,
  expireAt: Date,
  req_ip: String,
}, {
  versionKey: false,
  timestamps: true,
  collection: 'archer'
});

archerSchema.index({ "user_id": 1, "round_id": 1, "createdAt": -1 });
archerSchema.index({ "round_id": 1, "user_id": 1, "createdAt": 1 });
archerSchema.index({ expireAt: 1 }, { expireAfterSeconds: 1 });

module.exports = mongoose.model('archer', archerSchema);