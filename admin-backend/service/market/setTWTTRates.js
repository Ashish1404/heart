const { ENABLE_TWTT_RATE_SET, DEFAULT_TWTT_BACK_RATE, DEFAULT_TWTT_LAY_RATE } = require("../../../config/constant/rateConfig");
const redisClient = require("../../../connections/redisConnections");
const TO_WIN_THE_TOSS = "TO WIN THE TOSS";
const ODDS_PREFIX = "ODDS_";
const EXPIRE = 60 * 60 * 24 * 5; // 5 Days
const defaultBackRate = DEFAULT_TWTT_BACK_RATE;
const defaultBackSize = DEFAULT_TWTT_BACK_RATE != 0 ? 50000 : 0;
const defaultLayRate = DEFAULT_TWTT_LAY_RATE;
const defaultLaySize = DEFAULT_TWTT_LAY_RATE != 0 ? 50000 : 0;

exports.setTWTTRates = async (params) => {
  try {
    if (ENABLE_TWTT_RATE_SET) {
      const { marketId, marketName } = params;
      if (marketName === TO_WIN_THE_TOSS) {
        const cacheMarketId = `${ODDS_PREFIX}${marketId}`;
        redisClient.set(
          cacheMarketId,
          JSON.stringify(defaultFormat(params)),
          "EX",
          EXPIRE,
        );
      }
    }
  } catch (error) {
    console.error(`Error while setting the TWTT rates ${error.stack}`);
  }
};

function defaultFormat(params) {
  const { marketId } = params;
  const data = {
    marketId: marketId,
    status: "OPEN",
    inplay: true,
    runners: [
      {
        selectionId: 501,
        status: "ACTIVE",
        ex: {
          availableToBack: [
            {
              price: defaultBackRate,
              size: defaultBackSize,
            },
            {
              price: 0,
              size: 0,
            },
            {
              price: 0,
              size: 0,
            },
          ],
          availableToLay: [
            {
              price: defaultLayRate,
              size: defaultLaySize,
            },
            {
              price: 0,
              size: 0,
            },
            {
              price: 0,
              size: 0,
            },
          ],
        },
      },
      {
        selectionId: 502,
        status: "ACTIVE",
        ex: {
          availableToBack: [
            {
              price: defaultBackRate,
              size: defaultBackSize,
            },
            {
              price: 0,
              size: 0,
            },
            {
              price: 0,
              size: 0,
            },
          ],
          availableToLay: [
            {
              price: defaultLayRate,
              size: defaultLaySize,
            },
            {
              price: 0,
              size: 0,
            },
            {
              price: 0,
              size: 0,
            },
          ],
        },
      },
    ],
  };

  return data;
}
