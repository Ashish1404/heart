const Joi = require("joi");
const { ResError } = require("../../lib/expressResponder");
const { validator } = require("../../admin-backend/validator");

module.exports = {
  validator,

  validateHorseRacingBet: (req, res, next) => {
    return Joi.array()
      .items({
        market_id: Joi.string().required(),
        selection_id: Joi.number().required(),
        selection_name: Joi.string().optional(),
        odds: Joi.number().min(1).required(),
        stack: Joi.number().integer().min(1).required(),
        is_back: Joi.string().valid(0, 1).required(),
        is_hr_bet: Joi.boolean().default(true).optional(),
      })
      .min(2)
      .unique((a, b) => a.selection_id == b.selection_id)
      .validateAsync(req.body, { abortEarly: false })
      .then((body) => {
        req.body = body;
        next();
      })
      .catch((error) => {
        if (error.hasOwnProperty("details"))
          return ResError(res, {
            msg: error.details.map((data) => data.message).toString(),
          });
        return ResError(res, error);
      });
  },

  getBetDelay: (req, res, next) => {
    req.validationFields = {
      sport_id: Joi.string().required(),
    };
    return module.exports.validator(req, res, next);
  },
};
