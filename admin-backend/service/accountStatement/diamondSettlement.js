const { ObjectId } = require("bson");
const AccountStatement = require("../../../models/accountStatement");
const User = require("../../../models/user");
const { VALIDATION_ERROR, fixFloatingPoint } = require("../../../utils");
const { resultResponse } = require("../../../utils/globalFunction");
const {
  SUCCESS,
  SERVER_ERROR,
  USER_TYPE_SUPER_ADMIN,
} = require("../../../utils/constants");

async function diamondChipSummary(req) {
  try {
    let { user_id } = req.joiData;
    if (!user_id) {
      user_id = req.User._id.toString();
    }

    // Fetch User's Data
    const userData = await User.findOne({ _id: ObjectId(user_id) }, [
      "_id",
      "user_name",
      "name",
      "user_type_id",
      "profit_loss",
      "share",
      "credit_reference",
      "balance_reference",
      "upline_settlement",
      "settlement_comm",
    ])
      .lean()
      .exec();

    // Check If Child User Exists
    if (!userData) {
      return resultResponse(VALIDATION_ERROR, {
        msg: "No User Found With this User Id",
      });
    }

    const userAggQuery = getDiamondChipSummaryQuery({ user_id });
    let userDataAgg = await User.aggregate(userAggQuery);
    userDataAgg = userDataAgg[0] || {};

    const plus_data = [];
    const minus_data = [];

    const myPlData = {
      type: "my_pl",
      amount: Math.abs(fixFloatingPoint(userData.profit_loss)),
    };

    const myCashAmount =
      (userData.upline_settlement * (100 - userData.share)) / 100 -
      userDataAgg.total_settled_share;
    const myCashData = {
      type: "my_cash",
      user_name: userData.user_name,
      user_id: userData._id,
      amount: Math.abs(fixFloatingPoint(myCashAmount)),
    };

    const uplineAmount = userData.balance_reference - userData.credit_reference;
    const uplineData = {
      type: "upline",
      amount: Math.abs((uplineAmount * (100 - userData.share)) / 100),
      amount_full: Math.abs(fixFloatingPoint(uplineAmount)),
    };

    const myRunningPlAmount = userData.profit_loss + myCashAmount;
    const myRunningPlData = {
      type: "my_running_pl",
      amount: Math.abs(fixFloatingPoint(myRunningPlAmount)),
    };

    const commAmount =
      userData.user_type_id == USER_TYPE_SUPER_ADMIN
        ? userData.settlement_comm
        : userDataAgg.settlement_comm - userData.settlement_comm;

    const commAmountlData = {
      type: "my_commission",
      amount: Math.abs(fixFloatingPoint(commAmount)),
    };

    userDataAgg.children_data.map((i) => {
      const data = {
        type: "user",
        user_name: i.user_name,
        user_id: i.user_id,
        user_type_id: i.user_type_id,
        amount_full: Math.abs(fixFloatingPoint(i.pending_settlement)),
        amount: Math.abs(fixFloatingPoint(i.pending_settlement_share)),
      };

      if (i.pending_settlement >= 0) {
        plus_data.push(data);
      } else {
        minus_data.push(data);
      }
    });

    plus_data.sort((a, b) => {
      return b.amount - a.amount;
    });
    minus_data.sort((a, b) => {
      return b.amount - a.amount;
    });

    if (uplineAmount < 0) {
      plus_data.push(uplineData);
    } else {
      minus_data.push(uplineData);
    }

    plus_data.push(commAmountlData);

    if (userData.profit_loss >= 0) {
      plus_data.push(myPlData);
    } else {
      minus_data.push(myPlData);
    }

    if (myCashAmount > 0) {
      plus_data.push(myCashData);
    } else {
      minus_data.push(myCashData);
    }

    const total_plus_amount = fixFloatingPoint(
      plus_data.reduce((acc, val) => acc + val.amount, 0) -
      commAmountlData.amount
    );
    const total_minus_amount = fixFloatingPoint(
      minus_data.reduce((acc, val) => acc + val.amount, 0)
    );

    if (myRunningPlAmount > 0) {
      plus_data.push(myRunningPlData);
    } else {
      minus_data.push(myRunningPlData);
    }

    return resultResponse(SUCCESS, {
      back: user_id,
      total_plus_amount,
      total_minus_amount,
      plus_data,
      minus_data,
    });
  } catch (error) {
    return resultResponse(SERVER_ERROR, { msg: error.message });
  }
}

function getDiamondChipSummaryQuery(data) {
  const { user_id } = data;

  return [
    {
      $match: {
        parent_id: ObjectId(user_id),
      },
    },
    {
      $group: {
        _id: "$user_name",
        user_id: {
          $first: "$_id",
        },
        user_name: {
          $first: "$user_name",
        },
        share: {
          $first: "$share",
        },
        pending_settlement: {
          $sum: {
            $subtract: ["$balance_reference", "$credit_reference"],
          },
        },
        pending_settlement_share: {
          $sum: {
            $divide: [
              {
                $multiply: [
                  {
                    $subtract: ["$balance_reference", "$credit_reference"],
                  },
                  {
                    $subtract: [100, "$share"],
                  },
                ],
              },
              100,
            ],
          },
        },
        total_settled: {
          $sum: "$upline_settlement",
        },
        total_settled_share: {
          $sum: {
            $divide: [
              {
                $multiply: [
                  "$upline_settlement",
                  {
                    $subtract: [100, "$share"],
                  },
                ],
              },
              100,
            ],
          },
        },
        settlement_comm: {
          $sum: "$settlement_comm",
        },
      },
    },
    {
      $group: {
        _id: null,
        children_data: {
          $push: {
            user_id: "$user_id",
            user_name: "$user_name",
            pending_settlement: {
              $round: ["$pending_settlement", 2],
            },
            pending_settlement_share: {
              $round: ["$pending_settlement_share", 2],
            },
            share: "$share",
            settlement_comm: {
              $round: ["$settlement_comm", 2],
            },
          },
        },
        total_settled: {
          $sum: "$total_settled",
        },
        total_settled_share: {
          $sum: "$total_settled_share",
        },
        total_pending_settlement: {
          $sum: "$pending_settlement",
        },
        total_pending_settlement_share: {
          $sum: "$pending_settlement_share",
        },
        settlement_comm: {
          $sum: "$settlement_comm",
        },
      },
    },
    {
      $project: {
        children_data: 1,
        total_settled: {
          $round: ["$total_settled", 2],
        },
        total_settled_share: {
          $round: ["$total_settled_share", 2],
        },
        total_pending_settlement: {
          $round: ["$total_pending_settlement", 2],
        },
        total_pending_settlement_share: {
          $round: ["$total_pending_settlement_share", 2],
        },
        settlement_comm: {
          $round: ["$settlement_comm", 2],
        },
      },
    },
  ];
}

async function diamondSettlementHistory(req) {
  try {
    let { user_id } = req.joiData;
    let is_self = false;
    if (!user_id) {
      user_id = req.User._id.toString();
      is_self = true;
    }

    // Fetch User's Data
    const userData = await User.findOne({ _id: ObjectId(user_id) }, {
      "_id": 0,
      "share": 1,
      "user_name": 1,
      "name": 1,
      "parent_user_name": 1,
    })
      .lean()
      .exec();

    // Check If Child User Exists
    if (!userData) {
      return resultResponse(VALIDATION_ERROR, {
        msg: "No User Found With this User Id",
      });
    }

    let query = {};

    if (is_self) {
      query = {
        statement_type: 6,
        sub_statement_type: { $in: ["SW-from", "SD-from"] },
        user_id: ObjectId(user_id),
      };
    } else {
      query = {
        statement_type: 6,
        sub_statement_type: { $in: ["SW-to", "SD-to"] },
        user_id: ObjectId(user_id),
      };
    }

    let accountStatementData = await AccountStatement.find(query, [
      "user_name",
      "description",
      "remark",
      "amount",
      "generated_at",
    ])
      .sort({ generated_at: -1 })
      .lean();

    let [totalAmount, totalAmountShare] = accountStatementData.reduce(
      (acc, i) => {
        acc[0] += i.amount;
        const amountShare = (i.amount * (100 - userData.share)) / 100;
        acc[1] += amountShare;

        return acc;
      },
      [0, 0]
    );

    accountStatementData = accountStatementData.map((i) => {
      const amountShare = (i.amount * (100 - userData.share)) / 100;
      const data = {
        ...i,
        amount: fixFloatingPoint(i.amount),
        amountShare: fixFloatingPoint(amountShare),
        accAmount: fixFloatingPoint(totalAmount),
        accAmountShare: fixFloatingPoint(totalAmountShare),
      };
      totalAmount -= i.amount;
      totalAmountShare -= amountShare;

      return data;
    });

    delete userData.share;
    return resultResponse(SUCCESS, {
      accountStatementData,
      userData,
    });
  } catch (error) {
    return resultResponse(SERVER_ERROR, { msg: error.message });
  }
}

module.exports = {
  diamondChipSummary,
  diamondSettlementHistory,
};
