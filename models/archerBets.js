const mongoose = require('mongoose');
const Schema = mongoose.Schema;

/**
 * Matches model schema
 */
const ArcherBetsSchema = new Schema({

  // Internal usage fields.
  userName: String,
  user_name: String,
  domainName: String,
  domain_name: String,
  parentLevels: [{
    user_id: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    user_name: { type: String, required: true, minLength: 3, maxLength: 30, trim: true },
    user_type_id: { type: Number, required: true, min: 0, max: 100 },
    _id: false
  }],

  // Archer casino fields.
  userId: String,
  user_id: String,
  gameName: String,
  marketId: String,
  selectionId: String,
  roundId: String,
  trxnId: String,
  selectionName: String,
  stake: Number,
  odds: Number,
  isBack: Boolean,
  isDemo: Boolean,
  // 0 = bet place completed, 1 = Bet settled, 2 = Round Cancel, 3 = AutoClearedLiability, 4 = ERROR.
  isProcessed: { type: Number, default: 0 }, 
  // 0 = Default, 1 = Started, 2 = Completed, 3 = Error, 4 = AddToBatch.
  processingStage: { type: Number, default: 0 }, 
  processingMessage: { type: String },
  betDate: String,
  betStatus: String,
  isResult: Boolean,
  betResult: String,
  pnl: { type: Number, default: 0 },
}, {
  versionKey: false,
  timestamps: true,
  collection: 'archer_bets'
});

ArcherBetsSchema.index({ roundId: 1, userId: 1, betDate: 1, isProcessed: 1, isResult: 1 })
ArcherBetsSchema.index({ isResult: 1, isProcessed: 1, createdAt: 1 })
ArcherBetsSchema.index({ isResult: 1, isProcessed: 1, roundId: 1 })
ArcherBetsSchema.index({ userId: 1, roundId: 1, isProcessed: 1 })
ArcherBetsSchema.index({ roundId: 1, userId: 1 })

module.exports = mongoose.model('archer_bets', ArcherBetsSchema);