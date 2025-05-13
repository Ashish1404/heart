const { ObjectId } = require("bson");

// Models
const BetCounts = require("../../../models/betCount");
const BetsOdds = require("../../../models/betsOdds");

// Utils & Constants
const { resultResponse } = require("../../../utils/globalFunction");
const {
  SUCCESS,
  NOT_FOUND,
  SERVER_ERROR,
} = require("../../../utils/constants");

const FormatTypes = {
  MARKET_WISE: "MARKET_WISE",
  MATCH_WISE: "MATCH_WISE",
};

function getActiveUserCountQuery(params) {
  const { match_id, format_type, selfUser, type } = params;

  let filter = {
    ["parent_ids.user_name"]: selfUser.user_name,
    is_active: true,
  };

  if (match_id) {
    filter["match_id"] = match_id;
  }

  if (format_type === FormatTypes.MATCH_WISE) {
    return [
      {
        $match: filter,
      },
      {
        $sort: {
          createdAt: -1,
        },
      },
      {
        $group: {
          _id: "$match_id",
          match_id: {
            $first: "$match_id",
          },
          match_name: {
            $first: "$match_name",
          },
          bet_count: {
            $sum: "$bet_count",
          },
          users: {
            $addToSet: "$user_name",
          },
        },
      },
      {
        $addFields: {
          users_count: { $size: "$users" },
        },
      },
    ];
  }

  return [
    {
      $match: filter,
    },
    {
      $sort: {
        createdAt: -1,
      },
    },
    {
      $group: {
        _id: "$event_id",
        event_id: {
          $first: "$event_id",
        },
        event_name: {
          $first: "$event_name",
        },
        match_id: {
          $first: "$match_id",
        },
        match_name: {
          $first: "$match_name",
        },
        bet_count: {
          $sum: "$bet_count",
        },
        users: {
          $addToSet: "$user_name",
        },
      },
    },
    {
      $group: {
        _id: "$match_id",
        markets: {
          $push: {
            event_id: "$event_id",
            event_name: "$event_name",
            bet_count: "$bet_count",
            users: "$users",
            users_count: { $size: "$users" },
          },
        },
        match_id: {
          $first: "$match_id",
        },
        match_name: {
          $first: "$match_name",
        },
        bet_count: {
          $sum: "$bet_count",
        },
        raw_users: {
          $push: "$users",
        },
      },
    },
    {
      $addFields: {
        users: {
          $setUnion: [
            {
              $reduce: {
                input: "$raw_users",
                initialValue: [],
                in: {
                  $concatArrays: ["$$value", "$$this"],
                },
              },
            },
            [],
          ],
        },
      },
    },
    {
      $addFields: {
        users_count: { $size: "$users" },
      },
    },
    {
      $project: {
        raw_users: 0,
      },
    },
  ];
}

function getTotalUserCountQuery(params) {
  const { match_id, format_type, selfUser, type } = params;

  let filter = {
    ["parents.user_id"]: ObjectId(selfUser._id),
    is_demo: false,
    delete_status: 0,
  };

  if (match_id) {
    filter["match_id"] = match_id;
  }

  if (format_type === FormatTypes.MATCH_WISE) {
    return [
      {
        $match: filter,
      },
      {
        $group:
        {
          _id: "$match_id",
          match_id: {
            $first: "$match_id"
          },
          match_name: {
            $first: "$match_name"
          },
          bet_count: {
            $count: {}
          },
          users: {
            $addToSet: "$user_name"
          },
          createdAt: {
            $last: "$createdAt"
          },
        }
      },
      {
        $unionWith:
        {
          coll: "bets_fancies",
          pipeline: [
            {
              $match: {
                ...filter,
              }
            },
            {
              $group: {
                _id: "$match_id",
                match_id: {
                  $first: "$match_id"
                },
                match_name: {
                  $first: "$match_name"
                },
                bet_count: {
                  $count: {}
                },
                users: {
                  $addToSet: "$user_name"
                },
                createdAt: {
                  $last: "$createdAt"
                },
              }
            }
          ]
        }
      },
      {
        $sort: {
          createdAt: -1
        }
      },
      {
        $group: {
          _id: "$match_id",
          match_id: {
            $first: "$match_id"
          },
          match_name: {
            $first: "$match_name"
          },
          bet_count: {
            $sum: "$bet_count"
          },
          raw_users: {
            $push: "$users"
          }
        }
      },
      {
        $addFields: {
          users: {
            $setUnion: [
              {
                $reduce: {
                  input: "$raw_users",
                  initialValue: [],
                  in: {
                    $concatArrays: [
                      "$$value",
                      "$$this"
                    ]
                  }
                }
              },
              []
            ]
          }
        }
      },
      {
        $addFields: {
          users_count: { $size: "$users" }
        }
      },
      {
        $project: {
          raw_users: 0
        }
      }

    ];
  }

  return [
    {
      $match: filter,
    },
    {
      $group:
      {
        _id: "$market_id",
        match_id: {
          $first: "$match_id"
        },
        match_name: {
          $first: "$match_name"
        },
        event_id: {
          $first: "$market_id"
        },
        event_name: {
          $first: "$market_name"
        },
        bet_count: {
          $count: {}
        },
        users: {
          $addToSet: "$user_name"
        },
        createdAt: {
          $last: "$createdAt"
        },
      }
    },
    {
      $unionWith:
      {
        coll: "bets_fancies",
        pipeline: [
          {
            $match: {
              ...filter,
            }
          },
          {
            $group: {
              _id: "$fancy_id",
              match_id: {
                $first: "$match_id"
              },
              match_name: {
                $first: "$match_name"
              },
              event_id: {
                $first: "$fancy_id"
              },
              event_name: {
                $first: "$fancy_name"
              },
              bet_count: {
                $count: {}
              },
              users: {
                $addToSet: "$user_name"
              },
              createdAt: {
                $last: "$createdAt"
              },
            }
          }
        ]
      }
    },
    {
      $sort: {
        createdAt: -1
      }
    },
    {
      $group: {
        _id: "$match_id",
        markets: {
          $push: {
            event_id: "$event_id",
            event_name: "$event_name",
            bet_count: "$bet_count",
            users: "$users",
            users_count: { $size: "$users" }
          }
        },
        match_id: {
          $first: "$match_id"
        },
        match_name: {
          $first: "$match_name"
        },
        bet_count: {
          $sum: "$bet_count"
        },
        raw_users: {
          $push: "$users"
        }
      }
    },
    {
      $addFields: {
        users: {
          $setUnion: [
            {
              $reduce: {
                input: "$raw_users",
                initialValue: [],
                in: {
                  $concatArrays: [
                    "$$value",
                    "$$this"
                  ]
                }
              }
            },
            []
          ]
        }
      }
    },
    {
      $addFields: {
        users_count: { $size: "$users" }
      }
    },
    {
      $project: {
        raw_users: 0
      }
    }

  ];
}

async function userCount(req) {
  try {
    const { match_id, format_type } = req.joiData;
    const selfUser = req.User;

    const query = getActiveUserCountQuery({
      match_id,
      format_type,
      selfUser,
    });

    const result = await BetCounts.aggregate(query);

    return resultResponse(SUCCESS, {
      msg: "Data Fetched Successfully",
      data: { result },
    });
  } catch (error) {
    return resultResponse(SERVER_ERROR, error.message);
  }
}

async function totaluserCount(req) {
  try {
    const { match_id, format_type } = req.joiData;
    const selfUser = req.User;

    const query = getTotalUserCountQuery({
      match_id,
      format_type,
      selfUser,
    });

    const result = await BetsOdds.aggregate(query);

    return resultResponse(SUCCESS, {
      msg: "Data Fetched Successfully",
      data: { result },
    });
  } catch (error) {
    return resultResponse(SERVER_ERROR, error.message);
  }
}

module.exports = {
  userCount,
  totaluserCount,
};
