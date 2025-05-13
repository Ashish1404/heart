const mongoose = require("mongoose");
const UserSettingWiseSport = require("../../../models/userSettingWiseSport");
const {
  SUCCESS,
  NOT_FOUND,
  SERVER_ERROR,
} = require("../../../utils/constants");
const { resultResponse } = require("../../../utils/globalFunction");

module.exports.getBetDelay = async (req) => {
  const { User: Self, joiData } = req;
  try {
    let { _id: user_id } = Self;
    user_id = new mongoose.Types.ObjectId(user_id);

    const data = await UserSettingWiseSport.findOne(
      { user_id, "sports_settings.sport_id": joiData.sport_id },
      { "sports_settings.$": 1 },
    ).lean();

    if (!data) {
      return resultResponse(NOT_FOUND, "Details not found");
    }

    const {
      market_bet_delay,
      name: sport_name,
      session_bet_delay,
    } = data.sports_settings[0];

    return resultResponse(SUCCESS, {
      market_bet_delay,
      sport_name,
      session_bet_delay,
    });
  } catch (error) {
    return resultResponse(SERVER_ERROR, error.message);
  }
};
