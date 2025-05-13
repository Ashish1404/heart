const { FANCY_CATEGORY_DIAMOND } = require('../../utils/constants');
const { validator } = require('./');
const Joi = require('joi')
  , JoiObjectId = require('joi-oid')
  , { ResError } = require('../../lib/expressResponder');

module.exports = {
  validator,
  block: (req, res, next) => {
    req.validationFields = {
      event: Joi.string().valid("Sport", "Series", "Match", "Market", "Fancy").required(),
      filter: Joi.object({
        sport_id: Joi.string().when('country_code', {
          is: Joi.exist(),
          then: Joi.string().required(),
          otherwise: Joi.string().optional(),
        }),
        series_id: Joi.string().optional(),
        country_code: Joi.string().optional(),
        match_id: Joi.string().when('category', {
          is: Joi.exist(),
          then: Joi.string().required(),
          otherwise: Joi.string().optional(),
        }),
        market_id: Joi.string().optional(),
        fancy_id: Joi.string().optional(),
        category: Joi.string().valid(...(Object.keys(FANCY_CATEGORY_DIAMOND))).optional(),
      }).or("sport_id", "series_id", "country_code", "match_id", "market_id", "fancy_id", "category").required(),
      user_id: JoiObjectId.objectId().optional(),
    };
    return module.exports.validator(req, res, next);
  },
  updateMarketWiseLimites: (req, res, next) => {
    req.validationFields = {
      series_id: Joi.string().required(),
      sport_id: Joi.string().required(),
      series_name: Joi.string().required(),
      category: Joi.string().optional(),
      market_name: Joi.string().optional(),
      event_type: Joi.string().valid("fancy", "market").required(),
      setting_get_from: Joi.string().valid("series", "match").default("series").required(),
      country_code: Joi.string().optional(),
      values: Joi.object({
        // Market settings for sports
        market_min_stack: Joi.number()
          .min(VALIDATION.market_max_stack_min_limit)
          .max(VALIDATION.market_max_stack_max_limit)
          .optional(),

        market_max_stack: Joi.number()
          .min(VALIDATION.market_max_stack_min_limit)
          .max(VALIDATION.market_max_stack_max_limit)
          .optional(),

        market_min_odds_rate: Joi.number()
          .greater(VALIDATION.market_min_odds_rate)
          .max(VALIDATION.market_max_odds_rate)
          .precision(2)
          .optional(),

        market_max_odds_rate: Joi.number()
          .min(VALIDATION.market_min_odds_rate)
          .max(VALIDATION.market_max_odds_rate)
          .optional(),

        market_max_profit: Joi.number()
          .min(0)
          .max(VALIDATION.market_max_profit_max_limit)
          .optional(),

        market_advance_bet_stake: Joi.number()
          .min(VALIDATION.market_advance_bet_stake_min_limit)
          .max(VALIDATION.market_advance_bet_stake_max_limit)
          .optional(),

        market_before_inplay_profit: Joi.number()
          .min(0)
          .max(VALIDATION.market_before_inplay_profit)
          .optional(),

        // Session settings for sports
        session_min_stack: Joi.number()
          .min(VALIDATION.session_min_stack)
          .max(VALIDATION.session_max_stack)
          .optional(),

        session_max_stack: Joi.number()
          .min(VALIDATION.session_min_stack)
          .max(VALIDATION.session_max_stack_max_limit)
          .optional(),

        session_max_profit: Joi.number()
          .min(0)
          .max(VALIDATION.session_max_profit_max_limit)
          .optional(),

        market_bet_delay: Joi.number().optional()
      })
        .or(
          "market_min_stack",
          "market_max_stack",
          "market_min_odds_rate",
          "market_max_odds_rate",
          "market_max_profit",
          "market_advance_bet_stake",
          "market_before_inplay_profit",
          "market_bet_delay",
          "session_min_stack",
          "session_max_stack",
          "session_max_profit"
        )
        .required()
    };
    return module.exports.validator(req, res, next);
  },
  getMarketWiseLimites: (req, res, next) => {
    req.validationFields = {
      series_id: Joi.string().required(),
      sport_id: Joi.string().required()
    };
    return module.exports.validator(req, res, next);
  },
  addOrUpdateMarketFancyCatName: (req, res, next) => {
    req.validationFields = {
      sport_id: Joi.string().required(),
      market_name: Joi.string().required().trim(),
      event_type: Joi.string().valid("fancy", "market").required(),
      order: Joi.number().min(1).max(10).optional(),
    };
    return module.exports.validator(req, res, next);
  },
}