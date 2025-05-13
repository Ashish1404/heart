const { ResError, ResSuccess } = require('../../lib/expressResponder')
  , analyticsService = require('../service/analyticsService')
  , { SUCCESS } = require('../../utils/constants');

module.exports = {
  getUsersByBank: async function (req, res) {
    const data = req.body
    data.user_id = req.User.user_id;
    try {
      return analyticsService.getUserbyBankAccount(data).then(result => {
        if (result.statusCode != SUCCESS)
          return ResError(res, { msg: result.data });
        return ResSuccess(res, { data: result.data });
      }).catch(error => ResError(res, error));
    } catch (error) {
      return ResError(res, error);
    }
  },
  getUserByIP: async function (req, res) {
    const data = req.body
    data.user_id = req.User.user_id;
    try {
      return analyticsService.getUserbyIPaddress(data).then(result => {
        if (result.statusCode != SUCCESS)
          return ResError(res, { msg: result.data });
        return ResSuccess(res, { data: result.data });
      }).catch(error => ResError(res, error));
    } catch (error) {
      return ResError(res, error);
    }
  },
}