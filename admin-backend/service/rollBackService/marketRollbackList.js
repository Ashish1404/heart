const Market = require("../../../models/market");
const { resultResponse } = require("../../../utils/globalFunction");
const { SUCCESS, NOT_FOUND, SERVER_ERROR } = require("../../../utils/constants");
const { buildRollbackFilter, rollbackQuery } = require("./rollbackUtils");

module.exports.marketRollbackList = async function marketRollbackList(request) {
  try {
    const { page = 1, limit = 10, search = {} } = request.joiData;
    const skip = (page - 1) * limit;

    const allowedFields = ["_id", "sport_id", "series_id", "match_id", "market_id", "is_rollback"];
    const filter = buildRollbackFilter(search, allowedFields);

    const fieldsToProject = {
      match_name: 1,
      series_name: 1,
      market_id: 1,
      market_name: 1,
      fancy_name: 1,
      sport_name: 1,
      match_date: 1,
      is_result_declared: 1,
      is_rollback: 1,
      result_value_selections: 1,
      result_settled_at: 1,
      is_abandoned: 1,

    };

    const query = rollbackQuery(filter, skip, limit, fieldsToProject);
    const [result, total] = await Promise.all([
      Market.aggregate(query).allowDiskUse(true),
      Market.countDocuments(filter),
    ]);

    if (!result.length) {
      return resultResponse(NOT_FOUND, "No market rollback entries found.");
    }

    return resultResponse(SUCCESS, {
      metadata: { total, limit, page, pages: Math.ceil(total / limit) },
      data: result,
    });

  } catch (error) {
    return resultResponse(SERVER_ERROR, error.message);
  }
};
