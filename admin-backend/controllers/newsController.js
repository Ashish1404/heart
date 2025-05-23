const Joi = require('joi')
  , { ObjectId } = require("bson")
  , News = require("../../models/news")
  , { ResError, ResSuccess } = require('../../lib/expressResponder')
  , {
    USER_TYPE_SUPER_ADMIN, USER_TYPE_WHITE_LABLE
  } = require('../../utils/constants')

module.exports = {
  create: function (req, res) {
    return Joi.object({
      heading: Joi.string().required(),
      description: Joi.string().allow("").optional()
    }).validateAsync(req.body, { abortEarly: false })
      .then(data => {
        if (req.User.user_type_id != USER_TYPE_SUPER_ADMIN && req.User.user_type_id != USER_TYPE_WHITE_LABLE)
          return ResError(res, { msg: "You are not permitted to do this action!" })
        data.user_id = (req.User.user_id || req.User._id);
        data.user_name = req.User.user_name;
        data.user_type_id = req.User.user_type_id;
        return News.findOneAndUpdate(
          { user_id: data.user_id },
          data,
          { upsert: true, new: true, runValidators: true },
        ).lean()
          .select("_id")
          .then(() => ResSuccess(res, { msg: "News updated successfully..." }))
          .catch(error => ResError(res, error));
      }).catch(error => {
        if (error.hasOwnProperty("details"))
          return ResError(res, { msg: error.details.map(data => data.message).toString() })
        return ResError(res, error);
      });
  },
  delete: function (req, res) {
    if (req.User.user_type_id != USER_TYPE_SUPER_ADMIN && req.User.user_type_id != USER_TYPE_WHITE_LABLE)
      return ResError(res, { msg: "You are not permitted to do this action!" })
    return News.deleteOne({ user_id: req.User._id })
      .then(() => ResSuccess(res, { msg: "News deleted successfully..." }))
      .catch(error => ResError(res, error));
  },
  getNews: function (req, res) {
    let fields = "-_id user_id heading user_type_id";
    if (req.body.hasOwnProperty("full"))
      fields += " description";
    let Model;
    const isUser = req.User.user_type_id == 1;

    if (!isUser && req.body.hasOwnProperty("user_id"))
      Model = News.findOne({ user_id: ObjectId(req.body.user_id) });
    else {
      let userIds = req.User.parent_level_ids.map(data => data.user_id); userIds.push(req.User._id);
      Model = News.find({ user_id: { $in: userIds } });
    }
    return Model.select(fields).sort("user_type_id").lean()
      .then(data => ResSuccess(res, { data })).catch(error => ResError(res, error));
  }
}