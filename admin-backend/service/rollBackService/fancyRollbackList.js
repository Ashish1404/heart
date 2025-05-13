const Fancy = require("../../../models/fancy");
const { resultResponse } = require("../../../utils/globalFunction");
const { SUCCESS, NOT_FOUND, SERVER_ERROR } = require("../../../utils/constants");
const { buildRollbackFilter, rollbackQuery } = require("./rollbackUtils");

module.exports.fancyRollbackList = async function fancyRollbackList(request) {
  try {
    const { page = 1, limit = 10, search = {} } = request.joiData;
    const skip = (page - 1) * limit;

    const allowedFields = ["_id", "series_id", "match_id", "fancy_id", "is_rollback"];
    const filter = buildRollbackFilter(search, allowedFields);

    const fieldsToProject = {
      match_name: 1,
      series_name: 1,
      fancy_id: 1,
      fancy_name: 1,
      sport_name: 1,
      match_date: 1,
      is_result_declared: 1,
      is_rollback: 1,
      result_value: 1,
      result_settled_at: 1,
      is_abandoned: 1,
      is_active: 1,
    };

    const query = rollbackQuery(filter, skip, limit, fieldsToProject);
    const [result, total] = await Promise.all([
      Fancy.aggregate(query).allowDiskUse(true),
      Fancy.countDocuments(filter),
    ]);

    if (!result.length) {
      return resultResponse(NOT_FOUND, "No fancy rollback entries found.");
    }

    return resultResponse(SUCCESS, {
      metadata: { total, limit, page, pages: Math.ceil(total / limit) },
      data: result,
    });

  } catch (error) {
    return resultResponse(SERVER_ERROR, error.message);
  }
};
