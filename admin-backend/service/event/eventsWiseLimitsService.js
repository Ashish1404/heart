const Fancy = require("../../../models/fancy");
const Market = require("../../../models/market");
const EventsWiseLimites = require("../../../models/eventWiseLimit");
const MarketsFanciesName = require("../../../models/marketsFanciesName");
const { SUCCESS, SERVER_ERROR, HR, GHR, CRICKET } = require("../../../utils/constants");
const { resultResponse } = require("../../../utils/globalFunction");
const _ = require("lodash");
const VALIDATION = require("../../../utils/validationConstant");

const updateMarketLimits = async (series_id, market_name, sport_id, marketValues) => {
  const today = new Date();
  today.setDate(today.getDate() - 5);

  let marketFilter = {
    series_id,
    name: market_name,
    match_date: { $gte: today },
    is_result_declared: 0,
    is_series_limit_applicable: true,
  };
  // Add country_code filter only if it has values
  if (sport_id == HR || sport_id == GHR) {
    marketFilter.country_code = market_name;
    delete marketFilter.name;
  }
  await Market.updateMany(marketFilter, { $set: marketValues }).exec();
};

const updateFancyLimits = async (series_id, category, fancyValues) => {
  const currentDate = new Date(new Date().setUTCHours(0, 0, 0, 0));

  let fancyFilter = {
    series_id,
    category_name: category,
    is_active: 1,
    is_visible: true,
    is_result_declared: 0,
    match_date: { $gte: currentDate },
    is_series_limit_applicable: true,
  };
  delete fancyValues.category;
  delete fancyValues.event_type;
  delete fancyValues.market_name;
  delete fancyValues.setting_get_from;
  await Fancy.updateMany(fancyFilter, { $set: fancyValues }).exec();
};

const updateMarketWiseLimites = async (req) => {
  try {
    const {
      series_id,
      sport_id,
      series_name,
      market_name,
      event_type,
      setting_get_from,
      values,
      category
    } = req.joiData;

    let filter = { series_id };

    // Apply market or fancy filters
    if (event_type == "market") {
      filter.market_name = market_name;
    } else if (event_type == "fancy" && category != undefined) {
      filter.category_name = category;
    }

    // Apply country_code filter correctly
    if (sport_id == HR || sport_id == GHR) {
      filter.market_name = market_name;
    }

    let updateData = {
      series_name,
      event_type,
      market_name,
      setting_get_from,
    };

    if (event_type == "market") {
      const allowedMarketFields = [
        "market_min_stack",
        "market_max_stack",
        "market_min_odds_rate",
        "market_max_odds_rate",
        "market_max_profit",
        "market_advance_bet_stake",
        "market_before_inplay_profit",
        "market_bet_delay",
      ];

      const marketValues = Object.keys(values)
        .filter((key) => allowedMarketFields.includes(key))
        .reduce((obj, key) => {
          obj[key] = values[key];
          return obj;
        }, {});

      updateData = { ...updateData, ...marketValues };
    } else if (event_type == "fancy") {
      const allowedFancyFields = [
        "session_min_stack",
        "session_max_stack",
        "session_max_profit",
      ];

      const fancyValues = Object.keys(values)
        .filter((key) => allowedFancyFields.includes(key))
        .reduce((obj, key) => {
          obj[key] = values[key];
          return obj;
        }, {});

      updateData = { ...updateData, ...fancyValues };
    }

    if (category != undefined) {
      updateData.category_name = category;
    }
    const updateResult = await EventsWiseLimites.updateOne(
      filter,
      { $set: updateData },
      { upsert: true, runValidators: true }
    );
    // Check if it's an insert or update
    const isInsert = updateResult.upsertedCount && updateResult.upsertedCount > 0;

    if (event_type == "market") {
      await updateMarketLimits(series_id, market_name, sport_id, updateData);
    }
    if (event_type == "fancy") {
      await updateFancyLimits(series_id, category, updateData);
    }

    // Return appropriate response message
    const message = isInsert ? "New limits added successfully!" : "Limits updated successfully!";
    return resultResponse(SUCCESS, message);
  } catch (error) {
    console.error("Error updating market limits:", error);
    return resultResponse(SERVER_ERROR, error.message);
  }
};

const getMarketWiseLimites = async (req) => {
  try {
    const { series_id, sport_id, country_code } = req.joiData;

    // Fetch event-wise limits for the given series
    let filter = { series_id };
    if (country_code) filter.country_code = country_code;

    const eventLimits = await EventsWiseLimites.find(filter)
      .select([
        "market_name",
        "category_name",
        "market_min_stack",
        "market_max_stack",
        "market_min_odds_rate",
        "market_max_odds_rate",
        "market_advance_bet_stake",
        "market_max_profit",
        "market_before_inplay_profit",
        "market_bet_delay",
        "session_min_stack",
        "session_max_stack",
        "session_max_profit",
        "country_code",
      ])
      .lean().exec();

    // Fetch all markets & fancies for the given sport_id
    const marketFancyData = await MarketsFanciesName.find({ sport_id }).sort({ order: 1 }).lean();

    // Separate fancy and market based on event_type
    const fancyCategories = sport_id == CRICKET
      ? marketFancyData.filter((item) => item.event_type == "fancy")
      : [];

    const marketCategories = marketFancyData.filter(
      (item) => item.event_type == "market"
    );

    // Default market limits
    const defaultMarketLimits = {
      market_min_stack: VALIDATION.market_min_stack,
      market_max_stack: VALIDATION.market_max_stack,
      market_min_odds_rate: VALIDATION.market_min_odds_rate,
      market_max_odds_rate: VALIDATION.market_max_odds_rate,
      market_advance_bet_stake: VALIDATION.market_advance_bet_stake,
      market_max_profit: VALIDATION.market_max_profit,
      market_before_inplay_profit: VALIDATION.market_before_inplay_profit,
      market_bet_delay: VALIDATION.market_bet_delay_default,
    };

    // Default fancy limits (Only for sport_id 4)
    const defaultFancyLimits =
      sport_id == CRICKET
        ? {
          session_min_stack: VALIDATION.session_min_stack,
          session_max_stack: VALIDATION.session_max_stack,
          session_max_profit: VALIDATION.session_max_profit,
        }
        : {};

    // Create a lookup map for event limits (markets)
    const eventLimitsMap = eventLimits.reduce((map, limit) => {
      map[limit.market_name] = limit; // Market ke liye market_name se mapping
      return map;
    }, {});

    // Create a lookup map for fancy limits (category_name for fancy)
    const eventFancyLimitsMap = eventLimits.reduce((map, limit) => {
      if (limit.category_name) {
        map[limit.category_name] = limit; // Fancy ke liye category_name se mapping
      }
      return map;
    }, {});

    // Format market response
    const response = {
      markets: marketCategories.map(({ market_name }) => {
        const limits = eventLimitsMap[market_name];
        const isDefault = !limits;

        return {
          market_name,
          ...defaultMarketLimits,
          ...(limits || {}),
          message_type: isDefault ? "warn" : "info",
          setting_status: isDefault
            ? "The system default values are currently set. please save them for the first time to see the reflection."
            : "The values you previously saved have been fetched, please set new values",
        };
      }),
    };

    // Add fancy only if sport_id == CRICKET
    if (sport_id == CRICKET) {
      response.fancy = fancyCategories.map(({ market_name }) => {
        const limits = eventFancyLimitsMap[market_name]; // Fancy ke liye category_name match karega
        const isDefault = !limits;

        return {
          category: market_name,
          category_name: market_name,
          ...defaultFancyLimits,
          ...(limits || {}),
          message_type: isDefault ? "warn" : "info",
          setting_status: isDefault
            ? "The system default values are currently set.Please save them for the first time to see the reflection."
            : "The values you previously saved have been fetched, please set new values",
        };
      });
    }

    return resultResponse(SUCCESS, response);
  } catch (error) {
    return resultResponse(SERVER_ERROR, error.message);
  }
};

const addOrUpdateMarketFancyCatName = async (req) => {
  try {
    const { market_name, event_type } = req.joiData;
    let filter = req.joiData;
    delete filter.order
    const updateResult = await MarketsFanciesName.updateOne(
      filter,
      { $set: req.joiData },
      { upsert: true, runValidators: true }
    );
    // Check if it's an insert or update
    const isInsert = updateResult.upsertedCount && updateResult.upsertedCount > 0;

    // Return appropriate response message
    const message = isInsert
      ? `New ${event_type == 'market' ? 'market' : 'fancy category'} name added!`
      : `${event_type == 'market' ? 'market' : 'fancy category'} name updated successfully!`;

    return resultResponse(SUCCESS, message);
  } catch (error) {
    console.error("Error updating market limits:", error);
    return resultResponse(SERVER_ERROR, error.message);
  }
};


module.exports = {
  updateMarketWiseLimites,
  getMarketWiseLimites,
  addOrUpdateMarketFancyCatName
};
