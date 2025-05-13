const { ENABLE_BBB_RATE_SET } = require("../../../config/constant/rateConfig");
const redisClient = require("../../../connections/redisConnections");
const { BALL_BY_BALL_EVENT_DATA } = require("../../../utils/ballByBallConfig");
const ODDS_PREFIX = "ODDS_";

exports.setBBBRates = async (params) => {
  try {
    if (ENABLE_BBB_RATE_SET) {
      const { marketId } = params;
      if (marketId === BALL_BY_BALL_EVENT_DATA.market_id) {
        const cacheMarketId = `${ODDS_PREFIX}${marketId}`;
        const getCacheData = await redisClient.get(cacheMarketId);
        if (!getCacheData) {
          redisClient.set(
            cacheMarketId,
            JSON.stringify(defaultFormat(params)),
          );
        }
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
        "selectionId": 1,
        "status": "ACTIVE",
        "ex": {
          "availableToBack": [
            {
              "price": 2.17,
              "size": 25000
            },
            {
              "size": "0",
              "price": "0"
            },
            {
              "size": "0",
              "price": "0"
            }
          ],
          "availableToLay": [
            {
              "size": "0",
              "price": "0"
            },
            {
              "size": "0",
              "price": "0"
            },
            {
              "size": "0",
              "price": "0"
            }
          ],
        }
      },
      {
        "selectionId": 2,
        "status": "ACTIVE",
        "ex": {
          "availableToBack": [
            {
              "price": 2.63,
              "size": 25000
            },
            {
              "size": "0",
              "price": "0"
            },
            {
              "size": "0",
              "price": "0"
            }
          ],
          "availableToLay": [
            {
              "size": "0",
              "price": "0"
            },
            {
              "size": "0",
              "price": "0"
            },
            {
              "size": "0",
              "price": "0"
            }
          ],
        },
      },
      {
        "selectionId": 3,
        "status": "ACTIVE",
        "ex": {
          "availableToBack": [
            {
              "price": 8.15,
              "size": 25000
            },
            {
              "size": "0",
              "price": "0"
            },
            {
              "size": "0",
              "price": "0"
            }
          ],
          "availableToLay": [
            {
              "size": "0",
              "price": "0"
            },
            {
              "size": "0",
              "price": "0"
            },
            {
              "size": "0",
              "price": "0"
            }
          ]
        }
      },
      {
        "selectionId": 4,
        "status": "ACTIVE",
        "ex": {
          "availableToBack": [
            {
              "price": 11,
              "size": 25000
            },
            {
              "size": "0",
              "price": "0"
            },
            {
              "size": "0",
              "price": "0"
            }
          ],
          "availableToLay": [
            {
              "size": "0",
              "price": "0"
            },
            {
              "size": "0",
              "price": "0"
            },
            {
              "size": "0",
              "price": "0"
            }
          ],
        },
      },
      {
        "selectionId": 5,
        "status": "ACTIVE",
        "ex": {
          "availableToBack": [
            {
              "price": 6.51,
              "size": 25000
            },
            {
              "size": "0",
              "price": "0"
            },
            {
              "size": "0",
              "price": "0"
            }
          ],
          "availableToLay": [
            {
              "size": "0",
              "price": "0"
            },
            {
              "size": "0",
              "price": "0"
            },
            {
              "size": "0",
              "price": "0"
            }
          ]
        }
      },
      {
        "selectionId": 6,
        "status": "ACTIVE",
        "ex": {
          "availableToBack": [
            {
              "price": 11.98,
              "size": 25000
            },
            {
              "size": "0",
              "price": "0"
            },
            {
              "size": "0",
              "price": "0"
            }
          ],
          "availableToLay": [
            {
              "size": "0",
              "price": "0"
            },
            {
              "size": "0",
              "price": "0"
            },
            {
              "size": "0",
              "price": "0"
            }
          ],
        },
      },
      {
        "selectionId": 17,
        "status": "ACTIVE",
        "ex": {
          "availableToBack": [
            {
              "price": 4.22,
              "size": 25000
            },
            {
              "size": "0",
              "price": "0"
            },
            {
              "size": "0",
              "price": "0"
            }
          ],
          "availableToLay": [
            {
              "size": "0",
              "price": "0"
            },
            {
              "size": "0",
              "price": "0"
            },
            {
              "size": "0",
              "price": "0"
            }
          ],
        },
      },
      {
        "selectionId": 18,
        "status": "ACTIVE",
        "ex": {
          "availableToBack": [
            {
              "price": 6.85,
              "size": 25000
            },
            {
              "size": "0",
              "price": "0"
            },
            {
              "size": "0",
              "price": "0"
            }
          ],
          "availableToLay": [
            {
              "size": "0",
              "price": "0"
            },
            {
              "size": "0",
              "price": "0"
            },
            {
              "size": "0",
              "price": "0"
            }
          ],
        },
      },
      {
        "selectionId": 19,
        "status": "ACTIVE",
        "ex": {
          "availableToBack": [
            {
              "price": 8.58,
              "size": 25000
            },
            {
              "size": "0",
              "price": "0"
            },
            {
              "size": "0",
              "price": "0"
            }
          ],
          "availableToLay": [
            {
              "size": "0",
              "price": "0"
            },
            {
              "size": "0",
              "price": "0"
            },
            {
              "size": "0",
              "price": "0"
            }
          ]
        },
      }
    ]
  };

  return data;
}
