const { ObjectId } = require("bson");
const moment = require("moment");
const UserProfitLoss = require("../../../models/userProfitLoss");
const logger = require("../../../utils/loggers");
const { resultResponse } = require("../../../utils/globalFunction");
const utils = require("../../../utils");
const {
  SUCCESS,
  NOT_FOUND,
  SERVER_ERROR,
} = require("../../../utils/constants");

module.exports.eventWisePlReport = async (req) => {
  // Capture start time for performance measurement
  const startTime = moment();

  // Generate a unique reference code for logging (optional)
  const LOG_REF_CODE = utils.generateUUID();

  try {
    req.log = { calling: "reportService:eventWisePlReport", LOG_REF_CODE };

    // Execute both API calls concurrently
    let evenWiseReport = await geteventWisePlReport(req)

    if (evenWiseReport.statusCode != SUCCESS) {
      return resultResponse(NOT_FOUND, "Report data not found!");
    }

    let { data } = evenWiseReport?.data[0];

    data = data.sort(
      (a, b) =>
        a.total_net_pl - b.total_net_pl
    );

    // Return successful response with structured data
    return resultResponse(SUCCESS, evenWiseReport?.data[0]);
  } catch (error) {
    logger.error(`${LOG_REF_CODE} Error eventWisePlReport`, {
      error: error.message,
    });
    return resultResponse(SERVER_ERROR, error.message);
  } finally {
    logger.info(
      `${LOG_REF_CODE} Report Execution Time: ${utils.getTimeTaken({ startTime })}`,
    );
  }
}

async function geteventWisePlReport(req) {
  const startTime = moment();
  const { calling, LOG_REF_CODE } = req.log;

  logger.info(`${LOG_REF_CODE} ${calling} Starting geteventWisePlReport`);

  try {

    const query = eventsProfitLossQuery(req);

    logger.info(`${LOG_REF_CODE} geteventWisePlReport query`, { query });

    const result = await UserProfitLoss.aggregate(query).allowDiskUse(true);

    logger.info(`${LOG_REF_CODE} geteventWisePlReport Query result`, {
      recordsFound: result.length,
    });
    if (!result.length) {
      return resultResponse(NOT_FOUND, "Report data not found!");
    }

    return resultResponse(SUCCESS, result);
  } catch (error) {
    logger.error(`${LOG_REF_CODE} Error geteventWisePlReport ${error.stack}`);
    return resultResponse(SERVER_ERROR, error.message);
  } finally {
    logger.info(
      `${LOG_REF_CODE} geteventWisePlReport Execution Time: ${utils.getTimeTaken({ startTime })}`,
    );
  }
}

function eventsProfitLossQuery(req) {
  const filter = buildPlReportFilters(req);
  const { search } = req.joiData;

  let groupBy = "sport";


  if (search?.match_id) {
    groupBy = "market";
  } else if (search?.series_id) {
    groupBy = "match";
  } else if (search?.sport_id) {
    groupBy = "series";
  }

  const groupFields = {
    sport: ["sport_id", "sport_name"],
    series: ["sport_id", "sport_name", "series_id", "series_name"],
    match: ["sport_id", "sport_name", "series_id", "series_name", "match_id", "match_name"],
    market: ["sport_id", "sport_name", "series_id", "series_name", "match_id", "match_name", "event_id", "event_name", "type", "match_date"]
  };

  if (!groupFields[groupBy]) {
    throw new Error("Invalid groupBy value");
  }

  let groupStage = {
    _id: Object.fromEntries(groupFields[groupBy].map(field => [field, `$${field}`]))
  };

  groupFields[groupBy].forEach(field => {
    groupStage[field] = { "$first": `$${field}` };
  });

  groupStage["total_p_l"] = { "$sum": "$user_pl" };
  groupStage["total_commission"] = { "$sum": "$user_commission_pl" };
  groupStage["total_net_pl"] = {
    "$sum": {
      "$add": ["$user_pl", "$user_commission_pl"]
    }
  };

  return [
    { $match: filter },
    { "$group": groupStage },
    {
      "$project": Object.assign(
        {
          _id: 0,
          total_p_l: { "$round": ["$total_p_l", 2] },
          total_commission: { "$round": ["$total_commission", 2] },
          // Change sign here
          total_net_pl: {
            "$multiply": [
              { "$round": ["$total_net_pl", 2] },
              -1
            ]
          }
        },
        Object.fromEntries(groupFields[groupBy].map(field => [field, 1]))
      )
    },
    {
      "$group": {
        _id: null,
        data: { "$push": "$$ROOT" },
        total: {
          "$sum": {
            "$multiply": ["$total_net_pl", 1] // Already negative now
          }
        }
      }
    },
    {
      "$project": {
        _id: 0,
        data: 1,
        total: {
          "$round": ["$total", 2]
        }
      }
    }
  ];
}

function buildPlReportFilters(req) {
  const { search, from_date, to_date } = req.joiData;
  const user_id = ObjectId(req.joiData.user_id || req.User.user_id || req.User._id);

  const filter = { 'agents_pl_distribution.user_id': user_id, is_demo: false };

  if (from_date && to_date) {
    filter.createdAt = {
      '$gte': new Date(from_date),
      '$lte': new Date(to_date)
    };
  }

  if (search && typeof search === "object") {
    Object.assign(filter, search);
  }

  return filter;
}