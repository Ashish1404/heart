const mongoose = require('mongoose')
  , Schema = mongoose.Schema;
const VALIDATION = require('../utils/validationConstant');
/**
 * telegram subscribers model schema
 */
const eventsWiseLimites = new Schema({
  series_id: { type: String },
  series_name: { type: String },
  category_name: { type: String },
  market_name: { type: String },
  event_type: { type: String },
  setting_get_from: { type: String },
  // Market settings for sports (Only set if event_type is "market")
  market_min_stack: {
    type: Number,
    default: function () { return this.event_type === 'market' ? VALIDATION.market_min_stack : undefined; }
  },
  market_max_stack: {
    type: Number,
    default: function () { return this.event_type === 'market' ? VALIDATION.market_max_stack : undefined; }
  },
  market_min_odds_rate: {
    type: Number,
    default: function () { return this.event_type === 'market' ? VALIDATION.market_min_odds_rate : undefined; }
  },
  market_max_odds_rate: {
    type: Number,
    default: function () { return this.event_type === 'market' ? VALIDATION.market_max_odds_rate : undefined; }
  },
  market_advance_bet_stake: {
    type: Number,
    default: function () { return this.event_type === 'market' ? VALIDATION.market_advance_bet_stake : undefined; }
  },
  market_max_profit: {
    type: Number,
    default: function () { return this.event_type === 'market' ? VALIDATION.market_max_profit : undefined; }
  },
  market_before_inplay_profit: {
    type: Number,
    default: function () { return this.event_type === 'market' ? VALIDATION.market_before_inplay_profit : undefined; }
  },
  market_bet_delay: {
    type: Number,
    default: function () { return this.event_type === 'market' ? VALIDATION.market_bet_delay : undefined; }
  },

  // Session settings for sports (Only set if event_type is "fancy")
  session_min_stack: {
    type: Number,
    default: function () { return this.event_type === 'fancy' ? VALIDATION.session_min_stack : undefined; }
  },
  session_max_stack: {
    type: Number,
    default: function () { return this.event_type === 'fancy' ? VALIDATION.session_max_stack : undefined; }
  },
  session_max_profit: {
    type: Number,
    default: function () { return this.event_type === 'fancy' ? VALIDATION.session_max_profit : undefined; }
  },
}, {
  versionKey: false,
  timestamps: true,
  collection: 'events_wise_limites'
});

// Indexing
eventsWiseLimites.index(
  { series_id: 1, event_type: 1, market_name: 1, category: 1 }
);

module.exports = mongoose.model('events_wise_limites', eventsWiseLimites);