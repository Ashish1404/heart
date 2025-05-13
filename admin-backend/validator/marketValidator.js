const { fmImportOrigin, getMarketsByCountryCode, validator } = require("./");
const Joi = require("joi");
const JoiObjectId = require("joi-oid");

module.exports = {
  validator,
  fmImportOrigin,
  getMarketsByCountryCode,

  updateMarketStatus: (req, res, next) => {
    req.validationFields = {
      user_id: JoiObjectId.objectId().optional(),
      market_id: Joi.string().required(),
      is_active: Joi.number().valid(0, 1).optional(),
    };
    return module.exports.validator(req, res, next);
  },
  diamondUserBook: (req, res, next) => {
    req.validationFields = {
      market_id: Joi.string().required(),
    };
    return module.exports.validator(req, res, next);
  },
  marketRollbackList: (req, res, next) => {
    req.validationFields = {
      search: Joi.object({
        sport_id: Joi.string().optional(),
        series_id: Joi.string().optional(),
        match_id: Joi.string().optional(),
        market_id: Joi.string().optional(),
        is_rollback: Joi.number().optional(),
      }).optional(),
      limit: Joi.number().min(10).max(100).default(50).optional(),
      page: Joi.number().min(1).max(100).default(1).optional(),
    };
    return module.exports.validator(req, res, next);
  },
  createManualRates: (req, res, next) => {
    req.validationFields = {
      market_id: Joi.string().required(),
    };
    return module.exports.validator(req, res, next);
  },
};
