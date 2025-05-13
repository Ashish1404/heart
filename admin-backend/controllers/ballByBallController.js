const { ResSuccess, ResError } = require("../../lib/expressResponder");
const CONSTANTS = require("../../utils/constants");
const ballByBallService = require("../service/ballbyball/ballByBallService");

module.exports = {
  launchUrl: async function (req, res) {
    try {
      const response = await ballByBallService.launchUrl(req);
      if (response.statusCode != CONSTANTS.SUCCESS) {
        return ResError(res, response.data);
      }
      return ResSuccess(res, response.data);
    } catch (error) {
      return ResError(res, { msg: error.message });
    }
  },
  transaction: async function (req, res) {
    try {
      const response = await ballByBallService.transactions(req);
      if (response.statusCode != CONSTANTS.SUCCESS) {
        return ResError(res, response.data);
      }
      return ResSuccess(res, response.data);
    } catch (error) {
      return ResError(res, { msg: error.message });
    }
  },
  exposureList: async function (req, res) {
    try {
      const response = await ballByBallService.exposure(req);
      if (response.statusCode != CONSTANTS.SUCCESS) {
        return ResError(res, response.data);
      }
      return ResSuccess(res, response.data);
    } catch (error) {
      return ResError(res, { msg: error.message });
    }
  },
  bets: async function (req, res) {
    try {
      const response = await ballByBallService.bets(req);
      if (response.statusCode != CONSTANTS.SUCCESS) {
        return ResError(res, { msg: response.data });
      }
      return ResSuccess(res, response.data);
    } catch (error) {
      return ResError(res, { msg: error.message });
    }
  },
};
