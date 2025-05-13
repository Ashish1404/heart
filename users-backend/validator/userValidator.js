const Joi = require('joi');
const JoiObjectId = require('joi-oid');
const { ResError } = require('../../lib/expressResponder');
const { validator } = require("./");

module.exports = {
  updateMatchStack: (req, res, next) => {
    return Joi.object({ match_stack: Joi.array().min(2).max(15).required() })
      .validateAsync(req.body, { abortEarly: false })
      .then(() => next())
      .catch(error => {
        if (error.hasOwnProperty("details"))
          return ResError(res, { msg: error.details.map(data => data.message).toString() });
        return ResError(res, error);
      });
  },
  getUserBalance: (req, res, next) => {
    req.validationFields = {
      userid: JoiObjectId.objectId().optional(),
      calculated_liablity: Joi.boolean().optional(),
    };
    req.isUser = true;
    return validator(req, res, next);
  },
  getPasswordChangedHistory: (req, res, next) => {
    req.validationFields = {
      search: Joi.string().optional(),
      limit: Joi.number().min(10).max(200).default(50).optional(),
      page: Joi.number().min(1).max(30).default(1).optional(),
      from_date: Joi.string().optional(),
      to_date: Joi.string().optional(),
    }
    return validator(req, res, next);
  },
}