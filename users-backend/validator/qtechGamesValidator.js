const Joi = require('joi')
  , { ResError } = require('../../lib/expressResponder')

module.exports = {
  setQtechGameFavoriteUnFavorite: (req, res, next) => {
    return Joi.object({ id: Joi.string().required(), is_favorite: Joi.boolean().optional() })
      .validateAsync(req.body, { abortEarly: false })
      .then(() => next())
      .catch(error => {
        if (error.hasOwnProperty("details"))
          return ResError(res, { msg: error.details.map(data => data.message).toString() });
        return ResError(res, error);
      });
  }
}