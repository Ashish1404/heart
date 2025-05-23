const bonusService = require('../service/bonusService');
const CONSTANTS = require('../../utils/constants');
const { ResError, ResSuccess } = require('../../lib/expressResponder');

module.exports = {
  logs: function (req, res) {
    return bonusService.getLogs(req, res)
      .then(result => (result.statusCode == CONSTANTS.SUCCESS) ? ResSuccess(res, result.data) : ResError(res, { msg: result.data }))
      .catch(error => ResError(res, error));
  }
}