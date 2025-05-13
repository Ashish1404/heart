const Joi = require("joi");
const JoiObjectId = require("joi-oid");
const { validator } = require(".");

module.exports = {
  validator,
  launchUrl: (req, res, next) => {
    req.validationFields = {
      gameId: Joi.string().required(),
      isOpen: Joi.boolean().default(false).optional(),
    };

    if (req.path.includes('open-launch-url')) {
      req.body.isOpen = true;
    }
    return module.exports.validator(req, res, next);
  },
  bets: (req, res, next) => {
    req.validationFields = {
      user_id: Joi.string().optional(),
      roundId: Joi.string().optional(),
      bets_type: Joi.string().valid("open", "settled", "cancelled").default("open").optional(),
      from_date: Joi.string().optional(),
      to_date: Joi.string().optional(),
      limit: Joi.number().max(100).default(10).optional(),
      page: Joi.number().default(1).optional(),
      isBack: Joi.boolean().optional(),
    };
    return module.exports.validator(req, res, next);
  },
};
