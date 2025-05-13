const mongoose = require('mongoose');
const Schema = mongoose.Schema;

/**
 * Markets model schema
 */
const MarketsFanciesNameSchema = new Schema({
  sport_id: { type: String, required: true },
  market_name: { type: String, required: true },
  event_type: { type: String, required: true },
  order: { type: Number },
}, {
  versionKey: false,
  timestamps: true,
  id: false,
  collection: 'markets_fancies_name'
});

// Indexing
MarketsFanciesNameSchema.index(
  { series_id: 1, market_name: 1, event_type: 1 }
);

module.exports = mongoose.model('markets_fancies_name', MarketsFanciesNameSchema);