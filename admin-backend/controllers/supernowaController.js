const Joi = require('joi')
  , fs = require('fs')
  , { SUCCESS } = require('../../utils/constants')
  , { ResError, ResSuccess } = require('../../lib/expressResponder')
  , supernowaService = require('../service/supernowaService');

module.exports = {
  async resultDeclare(req, res) {
    return Joi.object({
      providerCode: Joi.string().optional(),
      gameCode: Joi.string().optional(),
      providerRoundId: Joi.string().optional(),
      retry: Joi.number().default(0).optional(),
    }).validateAsync(req.body, { abortEarly: false })
      .then(params => {
        return supernowaService.supernowaResult(params)
          .then(async oddsResultData => {
            if (oddsResultData.statusCode == SUCCESS)
              return ResSuccess(res, { msg: oddsResultData.data });
            return ResError(res, { msg: oddsResultData.data });
          }).catch(error => ResError(res, error));
      }).catch(error => {
        if (error.hasOwnProperty("details"))
          return ResError(res, { msg: error.details.map(data => data.message).toString() });
        return ResError(res, error);
      });
  },
  downloadLogs(req, res) {
    return Joi.object({
      from_date: Joi.string().required(),
      to_date: Joi.string().required(),
      password: Joi.string().required(),
      fromUrl: Joi.number().default(0).optional(),
    }).validateAsync(req.body, { abortEarly: false })
      .then(data => {
        return supernowaService.downloadLogs(data).then(logs => {
          if (logs.statusCode != SUCCESS)
            return ResError(res, { msg: logs.data });
          if (data.fromUrl == 1)
            return ResSuccess(res, { data: logs.data.filename });
          return res.download(logs.data.filepath, logs.data.filename, function (error) {
            if (error)
              console.error(error); // Check error
            fs.unlinkSync(logs.data.filepath) // If you don't need callback
          });
        }).catch(error => ResError(res, error));
      }).catch(error => {
        if (error.hasOwnProperty("details"))
          return ResError(res, { msg: error.details.map(data => data.message).toString() });
        return ResError(res, error);
      });
  },
  download(req, res) {
    return Joi.object({
      filename: Joi.string().required()
    }).validateAsync(req.query, { abortEarly: false })
      .then(({ filename }) => {
        let filepath = supernowaService.wcoPath() + "/" + filename;
        if (!fs.existsSync(filepath))
          return ResError(res, { msg: "Log file not found!" });
        return res.download(filepath, filename, function (error) {
          if (error)
            console.error(error); // Check error
          fs.unlinkSync(filepath) // If you don't need callback
        });
      }).catch(error => {
        if (error.hasOwnProperty("details"))
          return ResError(res, { msg: error.details.map(data => data.message).toString() });
        return ResError(res, error);
      });
  }
}