const { validator, fmImportOrigin } = require("./");
const Joi = require("joi");
const JoiObjectId = require("joi-oid");
const { ResError } = require("../../lib/expressResponder");

module.exports = {
  validator,
  fmImportOrigin,
  getFancies: (req, res, next) => {
    req.validationFields = {
      user_id: JoiObjectId.objectId().optional(),
      match_id: Joi.string().required(),
      combine: Joi.boolean().optional(),
      category_wise_fancy: Joi.boolean().optional(),
      category: Joi.string().optional(),
    };
    return module.exports.validator(req, res, next);
  },
  getFancyLiveData: (req, res, next) => {
    req.validationFields = {
      match_id: Joi.string().required(),
      category: Joi.string().optional(),
    };
    return module.exports.validator(req, res, next);
  },
  getFanciesOpen: (req, res, next) => {
    req.validationFields = {
      match_id: Joi.string().required(),
      category_wise_fancy: Joi.boolean().optional(),
      category: Joi.string().optional(),
    };
    if (req.method == "GET") {
      req.validationWith = req.query;
    }
    return module.exports.validator(req, res, next);
  },
  updateFancyOrder: (req, res, next) => {
    // Define the schema for a single object
    const objectSchema = Joi.object({
      fancy_id: Joi.string().required(),
      category: Joi.number().integer().min(0).optional(), // Ensures it's a positive integer
      chronology: Joi.number().integer().min(0).optional(), // Ensures it's a positive integer
    }).or(
      "category",
      "chronology",
    );

    // Validate the data
    return Joi.array()
      .items(objectSchema)
      .min(1) // Ensures the array contains at least one object
      .required()
      .validateAsync(req.body, { abortEarly: false })
      .then((joiData) => {
        req.joiData = joiData;
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
  getFanciesCategory: (req, res, next) => {
    req.validationFields = {
      match_id: Joi.string().required(),
      user_id: JoiObjectId.objectId().optional(),
    };
    return module.exports.validator(req, res, next);
  },
  fancyRollbackList: (req, res, next) => {
    req.validationFields = {
      search: Joi.object({
        _id: JoiObjectId.objectId().optional(),
        series_id: Joi.string().optional(),
        match_id: Joi.string().optional(),
        fancy_id: Joi.string().optional(),
        is_rollback: Joi.number().optional(),
      }).optional(),
      limit: Joi.number().min(50).default(50).optional(),
      page: Joi.number().min(1).max(100).default(1).optional(),
    };
    return module.exports.validator(req, res, next);
  },
};
