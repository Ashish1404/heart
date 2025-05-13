const axios = require("axios");

const { resultResponse } = require("../../../utils/globalFunction");
const {
  BALL_BY_BALL_LAUNCH_URL,
  BALL_BY_BALL_X_ARCHER_KEY,
} = require("../../../utils/ballByBallConfig");
const { getRequesterIp } = require("../../../utils/");
const {
  SUCCESS,
  SERVER_ERROR,
  NOT_FOUND,
} = require("../../../utils/constants");

// Models
const User = require("../../../models/user");
const Archer = require("../../../models/archer");
const ArcherBets = require("../../../models/archerBets");

// Services
const ballByBallHelper = require("./ballByBall-helper-service");

async function launchUrl(req) {
  try {
    const { gameId, isOpen } = req.joiData;

    let data;
    if (isOpen) {
      data = JSON.stringify({
        userName: 'DEMO',
        balance: 0,
        game_id: gameId,
      });
    } else {
      const userId = req.User._id;
      const user = await User.findOne({ _id: userId })
        .select(["_id", "user_name", "balance"])
        .exec();

      if (!user) {
        return resultResponse(NOT_FOUND, { msg: "Invalid UserName !!" });
      }

      data = JSON.stringify({
        userName: user.user_name,
        balance: user.balance,
        game_id: gameId,
      });
    }


    if (!BALL_BY_BALL_LAUNCH_URL || !BALL_BY_BALL_X_ARCHER_KEY) {
      return resultResponse(NOT_FOUND, { msg: "Ball By Ball Config Not Set." });
    }

    const config = {
      method: "POST",
      maxBodyLength: Infinity,
      url: BALL_BY_BALL_LAUNCH_URL,
      headers: {
        "Content-Type": "application/json",
        xArcherKey: BALL_BY_BALL_X_ARCHER_KEY,
      },
      data: data,
    };

    let responseAPI;
    try {
      responseAPI = await axios.request(config);
    } catch (error) {
      console.error(error);
      return resultResponse(SERVER_ERROR, {
        msg: error.message,
        from: "Error from Provider API.",
      });
    }

    const apiData = responseAPI.data;
    const { message, game_id, gameUrl } = apiData;

    if (message != "User authenticated") {
      return resultResponse(SERVER_ERROR, {
        msg: "Something Went wrong with the Provider API",
      });
    }

    return resultResponse(SUCCESS, {
      gameUrl,
      msg: "Launch Url generated",
    });
  } catch (error) {
    console.error(error);
    return resultResponse(SERVER_ERROR, { msg: error.message });
  }
}

async function exposure(req) {
  let casinoExposuresQuery = ballByBallHelper.exposureQuery(req);
  return ArcherBets.aggregate(casinoExposuresQuery)
    .then((data) => resultResponse(SUCCESS, data[0]))
    .catch((error) => resultResponse(SERVER_ERROR, error.message));
}

async function bets(req) {
  let archerBetsQuery = ballByBallHelper.archerBetsQuery(req);
  return ArcherBets.aggregate(archerBetsQuery)
    .then((archerBets) => {
      if (archerBets[0].data.length)
        return resultResponse(SUCCESS, archerBets[0]);
      else return resultResponse(NOT_FOUND, "No Data found!");
    })
    .catch((error) => resultResponse(SERVER_ERROR, error.message));
}

async function transactions(req) {
  let newArcher;
  try {
    const { data } = req.body;
    const { userId, gameName, marketId, roundId, gameId, betDate } = data;
    let expireAt = new Date();
    expireAt.setDate(expireAt.getDate() + 45);

    let ip_data = getRequesterIp(req) || "127.0.0.1";
    req.ip_data = ip_data;

    newArcher = new Archer({
      req_body: req.body,
      user_id: userId,
      round_id: roundId,
      game_name: gameName,
      game_id: gameId,
      market_id: marketId,
      bet_date: betDate,
      expireAt,
      req_ip: ip_data,
    });
    await newArcher.save();

    const result = await ballByBallHelper.transactionsInit(req);

    if (result.statusCode != SUCCESS) {
      const responseResult = resultResponse(SERVER_ERROR, result.data);
      newArcher.res_body = responseResult;
      await newArcher.save();
      return responseResult;
    }
    const responseResult = resultResponse(SUCCESS, result.data);
    newArcher.res_body = responseResult;
    newArcher.user_id = result?.data?.user_id;

    await newArcher.save();
    return responseResult;
  } catch (error) {
    console.error("Error in Transaction : ", error);
    const responseResult = resultResponse(SERVER_ERROR, { msg: error.message });
    if (newArcher) {
      newArcher.res_body = responseResult;
      await newArcher.save();
    }
    return responseResult;
  }
}

async function resultSettlement() {
  try {
    await ballByBallHelper.resultSettlementInit();
  } catch (error) {
    console.error("Error in ResultSettlement: ", error);
  }
}

async function autoClearLiability() {
  try {
    await ballByBallHelper.autoClearLiabilityInit();
  } catch (error) {
    console.error("Error in AutoClearLiability: ", error);
  }
}

module.exports = {
  launchUrl,
  transactions,
  resultSettlement,
  autoClearLiability,
  exposure,
  bets,
};
