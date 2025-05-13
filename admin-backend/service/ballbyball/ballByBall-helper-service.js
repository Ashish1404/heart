// Libraries
const { ObjectId } = require("bson");
const { v4: uuidv4 } = require("uuid");
const getCurrentLine = require("get-current-line");
const moment = require("moment");

// Utils
const { resultResponse } = require("../../../utils/globalFunction");
const logger = require("../../../utils/loggers");
const {
  generateReferCode,
  fixFloatingPoint,
  generateUUID,
} = require("../../../utils");
const {
  SUCCESS,
  SERVER_ERROR,
  NOT_FOUND,
  VALIDATION_ERROR,
  USER_TYPE_USER,
  USER_TYPE_SUPER_ADMIN,
} = require("../../../utils/constants");
const { getBallByBallBetUID } = require("../../../utils/getter-setter");
const {
  BALL_BY_BALL_EVENT_DATA,
  BALL_BY_BALL_WHITELISTING_IP,
} = require("../../../utils/ballByBallConfig");

// Models
const User = require("../../../models/user");
const ArcherBets = require("../../../models/archerBets");
const Markets = require("../../../models/market");
const Match = require("../../../models/match");
const Partnerships = require("../../../models/partnerships");
const BetResults = require("../../../models/betResults");
const UserProfitLoss = require("../../../models/userProfitLoss");
const MarketAnalysis = require("../../../models/marketAnalysis");
const BetCount = require("../../../models/betCount");

// Services
const {
  sendMessageAlertToTelegram,
} = require("../messages/telegramAlertService");
const {
  getUserAndAgentCalculatedUpdateObject,
  getDataInBatchesForQueues,
} = require("../betService/resultHelpers");
const { SessionResultQueue } = require("../../../bull/queue");
const {
  concurrencyCheck,
  deleteConcurrencyById,
} = require("../concurrencyControl");
const { addUpdateBetCount } = require("../betCount/betCountService");

async function transactionsInit(req) {
  let ccId;
  try {
    const { data } = req.body;
    const { userId } = data;

    // IP Validate
    const ipRes = await validateIp(req.ip_data);
    if (ipRes.statusCode != SUCCESS) {
      return ipRes;
    }

    // Concurrency Check
    const ccRes = await validateConcurrency(data);
    if (ipRes.statusCode != SUCCESS) {
      return ipRes;
    }
    ccId = ccRes.data.id;

    // Check User and If He is allowed to play
    const userRes = await getUser({ user_id: userId, data });

    if (userRes.statusCode != SUCCESS) {
      // Delete Concurrency Control Entry
      deleteConcurrencyById(ccId);

      return userRes;
    }

    // CHeck if this transaction is for result.
    const isResult = data.betStatus.toLowerCase() != "unsettled";
    const user = userRes.data.user;

    // If Not Result then we will check User Balance and deduct the amount from user's balance
    // and add liability and create an entry in the archer bets collection

    const betResponse = await handleBetTransaction({
      user,
      data,
      isResult,
    });

    if (betResponse.statusCode != SUCCESS) {
      // Delete Concurrency Control Entry
      deleteConcurrencyById(ccId);

      return betResponse;
    }

    // Delete Concurrency Control Entry
    deleteConcurrencyById(ccId);

    return resultResponse(SUCCESS, {
      user_id: user._id.toString(),
    });
  } catch (error) {
    console.error("Error in transactionsInit: ", error);
    // Delete Concurrency Control Entry
    deleteConcurrencyById(ccId);
    return resultResponse(SERVER_ERROR, { msg: error.message });
  }
}

async function validateIp(ip) {
  if (BALL_BY_BALL_WHITELISTING_IP.includes(ip)) {
    return resultResponse(SUCCESS, { msg: "IP Valid" });
  } else {
    return resultResponse(VALIDATION_ERROR, { msg: "IP Not Valid" });
  }
}

async function validateConcurrency(data) {
  const betPlaceKey = getBallByBallBetUID(
    data.userId,
    data.roundId,
    data.betDate
  );
  const ccResponse = await concurrencyCheck(betPlaceKey, 1);
  if (ccResponse.statusCode == SERVER_ERROR) {
    return resultResponse(SERVER_ERROR, {
      msg: "Only one bet at a time is allowed!",
    });
  }
  return resultResponse(SUCCESS, {
    id: ccResponse?.data?.cc?._id,
  });
}

async function getUser(params) {
  try {
    const { user_id: user_name, data } = params;
    const user = await User.findOne({ user_name, user_type_id: USER_TYPE_USER }, [
      "_id",
      "balance",
      "user_name",
      "parent_level_ids",
      "self_lock_user",
      "parent_lock_user",
      "self_close_account",
      "parent_close_account",
      "self_lock_betting",
      "parent_lock_betting",
      "domain_name",
      "is_demo",
    ])
      .lean()
      .exec();

    if (!user) {
      return resultResponse(VALIDATION_ERROR, { message: "User Not Found" });
    }

    if (Math.max(user.self_lock_betting, user.parent_lock_betting) == 1)
      return resultResponse(VALIDATION_ERROR, {
        message: "Your betting is locked!",
      });

    if (Math.max(user.self_lock_user, user.parent_lock_user) == 1)
      return resultResponse(VALIDATION_ERROR, {
        message: "Your account is locked!",
      });

    if (Math.max(user.self_close_account, user.parent_close_account) == 1)
      return resultResponse(VALIDATION_ERROR, {
        message: "Your account is closed, Contact your Upline!",
      });

    let blockedUsers = user.parent_level_ids.map((data) =>
      data.user_id.toString()
    );
    blockedUsers.push(user._id.toString());
    let market = await Markets.findOne({
      market_id: BALL_BY_BALL_EVENT_DATA.market_id,
    })
      .select(
        `_id self_blocked parent_blocked is_active is_visible
        market_min_stack market_max_stack 
        market_min_odds_rate market_max_odds_rate`
      )
      .lean()
      .exec();

    if (!market || market?.is_active == 0 || market?.is_visible == false) {
      return resultResponse(VALIDATION_ERROR, {
        message: `Market is locked. Please Contact Upper Level. SA`,
      });
    }

    const self_blocked = blockedUsers.some((element) =>
      market.self_blocked.includes(element)
    );
    const parent_blocked = blockedUsers.some((element) =>
      market.parent_blocked.includes(element)
    );

    if (
      (market.self_blocked.length && self_blocked) ||
      (market.parent_blocked.length && parent_blocked)
    ) {
      return resultResponse(VALIDATION_ERROR, {
        message: `Market is locked. Please Contact Upper Level.`,
      });
    }

    if (market.market_min_stack > data.betAmount) {
      return resultResponse(VALIDATION_ERROR, {
        message: `Market Min Stack is ` + market.market_min_stack,
      });
    }

    if (market.market_max_stack < data.betAmount) {
      return resultResponse(VALIDATION_ERROR, {
        message: `Market Max Stack is ` + market.market_max_stack,
      });
    }

    if (market.market_min_odds_rate > data.betOdds) {
      return resultResponse(VALIDATION_ERROR, {
        message: `Market Min Odds Rate is ` + market.market_min_odds_rate,
      });
    }

    if (market.market_max_odds_rate < data.betOdds) {
      return resultResponse(VALIDATION_ERROR, {
        message: `Market Max Odds Rate is ` + market.market_max_odds_rate,
      });
    }

    return resultResponse(SUCCESS, {
      user,
    });
  } catch (error) {
    return resultResponse(SERVER_ERROR, {
      msg: error.message,
      function: "getUser",
    });
  }
}

let checkMarketAnalysis = async (data) => {
  try {
    const market_analysis = await MarketAnalysis.findOne({
      user_id: data.user_id,
      match_id: data.match_id,
    });

    if (market_analysis == null)
      await MarketAnalysis.create({
        user_id: data.user_id,
        match_id: data.match_id,
        parent_ids: data.parents.map((data) => data.user_id.toString()),
      });
  } catch (error) {
    console.error(error);
  }
};

async function updateMatchBetCount(count) {
  try {
    await Markets.updateOne(
      { match_id: BALL_BY_BALL_EVENT_DATA.match_id },
      { $inc: { bet_count: count } }
    );

    await Match.updateOne(
      {
        match_id: BALL_BY_BALL_EVENT_DATA.match_id,
        market_id: BALL_BY_BALL_EVENT_DATA.market_id,
      },
      { $inc: { bet_count: count } }
    );
  } catch (error) {
    console.error("Error in updateMatchBetCount: ", error);
  }
}

async function finalBetTasks(data) {
  try {
    const { user } = data;
    await checkMarketAnalysis({
      user_id: user._id,
      match_id: BALL_BY_BALL_EVENT_DATA.match_id,
      parents: user.parent_level_ids,
    });

    await addUpdateBetCount({
      user_id: user._id,
      user_name: user.user_name,
      match_id: BALL_BY_BALL_EVENT_DATA.match_id,
      event_id: BALL_BY_BALL_EVENT_DATA.market_id,
      type: 1,
      parents: user.parent_level_ids,
    });

    await updateMatchBetCount(1);
  } catch (error) {
    console.error("Error in finalBetTasks: ", error);
  }
}

async function handleBetTransaction(params) {
  try {
    const { data, user, isResult } = params;

    if (!isResult) {
      if (user.balance < data.betAmount) {
        return resultResponse(VALIDATION_ERROR, {
          msg: "User doesn't have enough Balance !!",
        });
      }

      const archerBets = new ArcherBets({
        userName: user.user_name,
        user_name: user.user_name,
        domainName: user.domain_name,
        domain_name: user.domain_name,
        parentLevels: user.parent_level_ids,
        userId: user._id,
        user_id: user._id,
        gameName: data.gameName,
        marketId: data.marketId,
        selectionId: data.selectionId,
        roundId: data.roundId,
        selectionName: data?.selection?.runner,
        stake: data.betAmount,
        odds: data.betOdds,
        isBack: data.betType.toLowerCase() == "back" ? true : false,
        isProcessed: 0,
        isResult,
        betDate: data.betDate,
        betStatus: data.betStatus,
        betResult: data?.betResult,
        pnl: data?.pnl,
        isDemo: user.is_demo,
      });

      await CrDr(user._id, {
        balance: -data.betAmount,
        liability: -data.betAmount,
      });

      await archerBets.save();

      finalBetTasks({ user });
    } else {
      const checkBetTransaction = await ArcherBets.findOne(
        {
          roundId: data.roundId,
          userId: user._id,
          betDate: data.betDate,
          isProcessed: 0,
          isResult: false,
        },
        { _id: 1 }
      ).lean();

      if (!checkBetTransaction) {
        return resultResponse(VALIDATION_ERROR, {
          msg: "No Entry found for Bet Transaction for this Result !!",
        });
      }

      await ArcherBets.updateOne(
        { _id: checkBetTransaction._id },
        {
          isResult: true,
          betStatus: data.betStatus,
          betResult: data?.betResult,
          pnl: data?.pnl,
          trxnId: data?._id,
        }
      );
    }

    let msg = isResult
      ? "Result Saved Successfully"
      : "Bet Placed Successfully";
    return resultResponse(SUCCESS, { msg });
  } catch (error) {
    console.log("Error in HandleBetTransaction: ", error);
    return resultResponse(SERVER_ERROR, { msg: error.message });
  }
}

async function CrDr(user_id, { balance, liability, roundIds }) {
  balance = balance || 0;
  liability = liability || 0;

  var user = await User.findOne(
    { _id: ObjectId(user_id) },
    { user_name: 1, balance: 1, liability: 1 }
  ).lean();

  const LOG_REF_CODE = generateReferCode();

  logger.BalExp(`
    --PRE LOG--
    FILE: ${getCurrentLine.default().file.split(/[\\/]/).pop()}
    FUNCTION: CrDr BallByBall
    LOG_REF_CODE: ${LOG_REF_CODE}
    DETAILS: [${user.user_name}(${user._id})] old_balance: ${user.balance
    } - old_liability: ${user.liability} - cal_amount: ${balance}
  `);

  const updatedUser = await User.updateOne({ _id: ObjectId(user_id) }, [
    {
      $set: {
        balance: {
          $round: [
            {
              $add: [{ $ifNull: ["$balance", 0] }, balance],
            },
            2,
          ],
        },
        liability: {
          $round: [
            {
              $add: [{ $ifNull: ["$liability", 0] }, liability],
            },
            2,
          ],
        },
      },
    },
  ]);

  var user = await User.findOne(
    { _id: ObjectId(user_id) },
    {
      user_name: 1,
      balance: 1,
      liability: 1,
      domain_name: 1,
    }
  ).lean();

  logger.BalExp(`
    --POST LOG--
    FILE: ${getCurrentLine.default().file.split(/[\\/]/).pop()}
    FUNCTION: CrDr BallByBall
    LOG_REF_CODE: ${LOG_REF_CODE}
    DETAILS: [${user.user_name}(${user._id})] new_balance: ${user.balance
    } - new_liability: ${user.liability} 
  `);

  if (
    fixFloatingPoint(user.liability) > 0 ||
    fixFloatingPoint(user.balance) < 0
  ) {
    sendMessageAlertToTelegram({
      message: `\nLOG_REF_CODE: ${LOG_REF_CODE}\nUSER: ${user.user_name}(${user._id}) : balance ${user.balance}, liability ${user.liability}`,
    });
  }

  if (updatedUser && updatedUser.modifiedCount) {
    if (roundIds?.length) {
      const archesUpdateRes = await ArcherBets.updateMany(
        { userId: user_id, roundId: { $in: roundIds }, isProcessed: 0 },
        { $set: { isProcessed: 3 } }
      );
      const modifiedCount = archesUpdateRes.modifiedCount;

      if (modifiedCount) {
        // Decrement Bet count in BetCount Model
        await BetCount.updateOne(
          {
            user_id: ObjectId(user_id),
            match_id: BALL_BY_BALL_EVENT_DATA.match_id,
            event_id: BALL_BY_BALL_EVENT_DATA.market_id,
          },
          {
            $inc: { bet_count: -modifiedCount },
            $set: { last_update_type: -modifiedCount },
          }
        );

        // Decrement Bet count in Match & Market Model
        await updateMatchBetCount(-modifiedCount);
      }

      // Delete Market Analysis if not Bet Exists for the User
      const remainingBetCount = await ArcherBets.count({
        isProcessed: 0,
        user_id: user_id.toString(),
      });

      if (remainingBetCount == 0) {
        await MarketAnalysis.deleteOne({
          user_id: ObjectId(user_id),
          match_id: BALL_BY_BALL_EVENT_DATA.match_id,
        });
      }

    }
    return resultResponse(SUCCESS, {
      msg: "User balance updated successfully!",
    });
  } else {
    return resultResponse(SERVER_ERROR, {
      msg: "Some Error in User Balance Updated!",
    });
  }
}

async function resultSettlementInit() {
  const UUID = generateUUID();
  try {
    const oneMinBefore = moment().subtract(1, "minutes").toDate();
    const sixtyMinBefore = moment().subtract(60, "minutes").toDate();

    const roundAndUserWiseBetsQuery = [
      {
        $match: {
          isResult: true,
          isProcessed: 0,
          createdAt: { $lte: oneMinBefore, $gte: sixtyMinBefore },
        },
      },
      {
        $group: {
          _id: {
            userId: "$userId",
            roundId: "$roundId",
          },
          userId: { $first: "$userId" },
          roundId: { $first: "$roundId" },
          stake: { $sum: "$stake" },
          pnl: { $sum: "$pnl" },
          betResult: { $first: "$betResult" },
          domainName: { $first: "$domainName" },
          userName: { $first: "$userName" },
          isDemo: { $first: "$isDemo" },
          gameName: { $first: "$gameName" },
        },
      },
    ];
    let roundAndUserWiseBets = await ArcherBets.aggregate(
      roundAndUserWiseBetsQuery
    );
    if (!roundAndUserWiseBets.length) {
      return;
    }

    const roundIds = roundAndUserWiseBets.map((i) => i.roundId);
    const usersToRemoveQuery = [
      {
        $match: {
          $or: [
            {
              isResult: false,
            },
            {
              createdAt: { $gt: oneMinBefore },
            },
          ],
          isProcessed: 0,
          roundId: { $in: roundIds },
        },
      },
      {
        $group: {
          _id: {
            userId: "$userId",
            roundId: "$roundId",
          },
          userId: { $first: "$userId" },
          roundId: { $first: "$roundId" },
        },
      },
    ];
    const usersToRemove = await ArcherBets.aggregate(usersToRemoveQuery);

    const userIdAndRoundIdToSkipSet = new Set(
      usersToRemove.map((i) => `${i.userId}|${i.roundId}`)
    );

    roundAndUserWiseBets = roundAndUserWiseBets.filter((item) => {
      return !userIdAndRoundIdToSkipSet.has(`${item.userId}|${item.roundId}`);
    });

    roundAndUserWiseBets = roundAndUserWiseBets.reduce((acc, item) => {
      acc[item.roundId] = {
        ...(acc[item.roundId] || {}),
        [item.userId]: {
          user_id: ObjectId(item.userId),
          user_name: item.userName,
          domain_name: item.domainName,
          is_demo: Boolean(item.isDemo),
          ...BALL_BY_BALL_EVENT_DATA,
          series_name: item.gameName,
          match_name: item.gameName,
          event_id: item.roundId,
          event_name: item.gameName,
          stack: item.stake,
          user_pl: item.pnl,
          user_commission_pl: 0,
          max_liability: item.stake,
          liability: item.stake,
          description: `Cricket - ${item.gameName} / R.No : ${item.roundId}`,
          reffered_name: `Cricket - (${item.gameName} - roundId[${item.roundId
            }]) - ${item.pnl > 0 ? "Profit" : "Loss"} [ User : ${item.pnl > 0 ? "Win" : "Loss"
            } ]`,
          winner_name: item.betResult,
        },
      };
      return acc;
    }, {});

    // Fetch Market Runners
    const market = await Markets.findOne(
      { market_id: BALL_BY_BALL_EVENT_DATA.market_id },
      { "runners.selection_id": 1, "runners.selection_name": 1 }
    ).lean();

    if (!market) {
      logger.ArcherResult(
        `${UUID} ResultSettlementInit || Error: 'Ball By Ball Market Not Found'`
      );
      return;
    }

    for (const roundId in roundAndUserWiseBets) {
      logger.ArcherResult(
        `${UUID} ResultSettlementInit || Starting Result Settlement for Round: ${roundId}`
      );

      const usersData = Object.values(roundAndUserWiseBets[roundId]);
      const settlementResponse = await settleRoundResult({
        usersData,
        roundId,
        market,
        UUID,
      });

      if (settlementResponse.statusCode != SUCCESS) {
        logger.ArcherResult(
          `${UUID} ResultSettlementInit || END Result Settlement for Round: ${roundId} || ERROR_MESSAGE: ${JSON.stringify(
            settlementResponse.data
          )}`
        );
      } else {
        logger.ArcherResult(
          `${UUID} ResultSettlementInit || END Result Settlement for Round: ${roundId} || SUCCESS_MESSAGE: ${JSON.stringify(
            settlementResponse.data
          )}`
        );
      }
    }

    logger.ArcherResult(`${UUID} END ResultSettlementInit`);
  } catch (error) {
    console.log("Error in ResultSettlementInit: ", error);
    logger.ArcherResult(`${UUID} END ResultSettlementInit || ERROR: ${error.message}
      ERROR_STACK: ${error.stack}`);
  }
}

async function settleRoundResult(
  { usersData, roundId, market, UUID },
  retryCount = 0
) {
  const userIdsStringArr = [];

  try {
    logger.ArcherResult(`${UUID} Start SettleRoundResult`);

    if (!usersData?.length) {
      return resultResponse(VALIDATION_ERROR, {
        msg: "usersData is Empty: " + usersData,
      });
    }

    await ArcherBets.updateMany(
      {
        roundId,
        userId: { $in: userIdsStringArr },
      },
      {
        $set: {
          processingStage: 1,
          processingMessage: "Started Result Settlement",
        },
      }
    );

    const userIds = [];
    usersData.map((i) => {
      userIds.push(i.user_id);
      userIdsStringArr.push(i.user_id.toString());
    });

    const selection_id = Number(usersData[0].winner_name);
    const runnerItem = market.runners.find(
      (i) => i.selection_id == selection_id
    );

    let betResult = new BetResults({
      ...BALL_BY_BALL_EVENT_DATA,
      market_id: roundId,
      selection_id: selection_id,
      result: selection_id,
      winner_name: runnerItem?.selection_name || selection_id,
      type: 1,
    });

    const partnerships = await Partnerships.find({
      user_id: { $in: userIds },
      "sports_share.sport_id": "4",
    })
      .select(
        `
      -_id user_id sports_share.percentage.share.$ sports_share.percentage.user_id 
      sports_share.percentage.user_name sports_share.percentage.user_type_id
    `
      )
      .lean();

    if (!partnerships.length)
      return resultResponse(NOT_FOUND, { msg: "Partnership(s) not found!" });

    let distribution = partnerships.map((partnership) => {
      partnership.agents_pl_distribution =
        partnership.sports_share[0].percentage;
      delete partnership.sports_share;
      return {
        ...partnership,
        ...usersData.find((i) => i._id == partnership.user_id),
      };
    });

    for (const userItem of usersData) {
      let userData = distribution.find(
        (o) => o.user_id.toString() == userItem.user_id.toString()
      );
      if (!userData) {
        logger.ArcherResult(
          `${UUID} SettleRoundResult || Error: UserData not found in distribution userId: ${userItem.user_id.toString()}`
        );
        continue;
      }

      let agents_pl_distribution = userData.agents_pl_distribution;
      const chips = userItem.user_pl;
      let totalPl = 0;

      for (const [index, distribution] of agents_pl_distribution.entries()) {
        distribution.commission = 0;
        distribution.index = index;
        let p_l = 0;
        if (chips < 0) {
          p_l = fixFloatingPoint(Math.abs(chips * distribution.share) / 100);
        } else {
          p_l = fixFloatingPoint(-(Math.abs(chips * distribution.share) / 100));
        }
        distribution.p_l = p_l;

        // Set Added PL
        // -> Super Admin (Self PL)
        // -> Others (Sum of Parents PL excluding self PL)
        distribution.added_pl = index == 0 ? p_l : totalPl;
        distribution.added_comm = 0;

        totalPl = fixFloatingPoint(totalPl + p_l);
      }
      userItem.agents_pl_distribution = agents_pl_distribution;
      userItem.bet_result_id = betResult._id;
    }

    logger.ArcherResult(
      `${UUID} SettleRoundResult || Stage: Created UserProfitLoss Array Successfully || ProfitLossLength: ${usersData.length}`
    );

    const userObjectRes = await getUserAndAgentCalculatedUpdateObject({
      user_profit_loss: usersData,
      isRollback: false,
      LOG_UUID: UUID,
      isFancy: false,
    });

    logger.ArcherResult(
      `${UUID} SettleRoundResult || End: getUserAndAgentCalculatedUpdateObject
      ResStatus: ${userObjectRes.statusCode}`
    );

    if (userObjectRes.statusCode != SUCCESS) {
      throw new Error(userObjectRes.data.msg);
    }

    const combinedUserAgentArr = userObjectRes.data;
    const batchSize = 5;

    const queueResponse = getDataInBatchesForQueues(
      combinedUserAgentArr,
      "ArcherResult",
      batchSize,
      roundId
    );

    if (queueResponse.statusCode != SUCCESS) {
      throw new Error(queueResponse.data.msg);
    }

    const queueData = queueResponse.data;

    logger.ArcherResult(
      `${UUID} SettleRoundResult || Stage: Start_AddBatchesToQueue`
    );

    await ArcherBets.updateMany(
      {
        roundId,
        userId: { $in: userIdsStringArr },
      },
      {
        $set: {
          processingStage: 4,
          processingMessage: "Start_AddBatchesToQueue",
        },
      }
    );

    await SessionResultQueue.addBulk(queueData);

    logger.ArcherResult(
      `${UUID} SettleRoundResult || Stage: End_AddBatchesToQueue`
    );

    await ArcherBets.updateMany(
      {
        roundId,
        userId: { $in: userIdsStringArr },
      },
      {
        $set: {
          processingStage: 4,
          processingMessage: "End_AddBatchesToQueue",
        },
      }
    );

    await Promise.all([
      UserProfitLoss.insertMany(usersData),
      ArcherBets.updateMany(
        {
          roundId,
          userId: { $in: userIdsStringArr },
          isProcessed: 0,
          isResult: true,
        },
        {
          $set: {
            isProcessed: 1,
            processingStage: 2,
            processingMessage: "Result Settled Successfully",
          },
        }
      ),
      betResult.save(),
    ]);

    await reduceBetCountAfterResult({
      roundId,
    });

    return resultResponse(SUCCESS, {
      msg: "Result Settled Successfully",
    });
  } catch (error) {
    logger.ArcherResult(`${UUID} END SettleRoundResult || ERROR: ${error.message}
      ERROR_STACK: ${error.stack}`);

    await ArcherBets.updateMany(
      {
        roundId,
        userId: { $in: userIdsStringArr },
      },
      {
        $set: {
          isProcessed: 3,
          processingStage: 3,
          processingMessage: error.message,
        },
      }
    );

    return resultResponse(SERVER_ERROR, {
      msg: error.message,
      error: error,
    });
  }
}

async function reduceBetCountAfterResult(data) {
  try {
    const { roundId } = data;

    const group = {
      $group: {
        _id: "$userId",
        count: { $count: {} },
      },
    };

    const query = [
      {
        $match: {
          roundId,
          isProcessed: 1,
        },
      },
      group,
    ];
    const result = await ArcherBets.aggregate(query);
    let count = 0;

    // Decrement Bet_count for Users whose bets are processed
    const bulkWrite = result.map((i) => {
      count += i.count;
      return {
        updateOne: {
          filter: {
            user_id: ObjectId(i._id),
            match_id: BALL_BY_BALL_EVENT_DATA.match_id,
            event_id: BALL_BY_BALL_EVENT_DATA.market_id,
          },
          update: {
            $inc: { bet_count: -i.count },
            $set: { last_update_type: -i.count },
          },
        },
      };
    });

    // Decrement Bet count in BetCount Model
    if (bulkWrite.length) {
      await BetCount.bulkWrite(bulkWrite);
    }

    // Decrement Bet count in Match & Market Model
    if (count) {
      await updateMatchBetCount(-count);
    }

    // Delete Market Analysis FOr Users whose bets not exists
    const query2 = [
      {
        $match: {
          isProcessed: 0,
        },
      },
      group,
    ];

    const result2 = await ArcherBets.aggregate(query2);
    const result2UserIdSet = new Set(result2.map((i) => i._id));

    const marketAnalysisToDeleteForUser = result
      .filter((i) => !result2UserIdSet.has(i._id))
      .map((i) => ObjectId(i._id));

    if (marketAnalysisToDeleteForUser.length) {
      await MarketAnalysis.deleteMany({
        user_id: { $in: marketAnalysisToDeleteForUser },
        match_id: BALL_BY_BALL_EVENT_DATA.match_id,
      });
    }
  } catch (error) {
    console.error("Error in reduceBetCountAfterResult: ", error);
  }
}

async function autoClearLiabilityInit() {
  const UUID = generateUUID();
  try {
    const oneMinThirtySecBefore = moment().subtract(65, "minutes").toDate();

    const oneDateAgo = moment().subtract(1, "days").toDate();

    const query = [
      {
        $match: {
          isResult: false,
          isProcessed: 0,
          createdAt: { $lt: oneMinThirtySecBefore, $gt: oneDateAgo },
        },
      },
      {
        $group: {
          _id: {
            userId: "$userId",
            roundId: "$roundId",
          },
          userId: { $first: "$userId" },
          roundId: { $first: "$roundId" },
        },
      },
    ];

    let resultBets = await ArcherBets.aggregate(query);

    if (!resultBets.length) return;

    logger.ArcherResult(
      `${UUID} Started AutoClearLiabilityInit || betsLength: ${resultBets.length}`
    );

    const batchSize = 10;
    for (let i = 0; i < resultBets.length; i += batchSize) {
      const batch = resultBets.slice(i, i + batchSize);
      await clearArcherLiabilityByRoundIds({ bets: batch });
    }

    logger.ArcherResult(`${UUID} END AutoClearLiabilityInit`);
  } catch (error) {
    console.log("Error in AutoClearLiabilityInit: ", error);
    logger.ArcherResult(`${UUID} END AutoClearLiabilityInit || ERROR: ${error.message}
      ERROR_STACK: ${error.stack}`);
  }
}

async function clearArcherLiabilityByRoundIds(params) {
  try {
    const dataRes = await getLiabilityDataByRoundIdsAndUserIds(params);

    if (dataRes.statusCode != SUCCESS) {
      console.error("Error in clearArcherLiabilityByRoundIds: ", dataRes.data);
      return;
    }

    const output = dataRes.data.data;

    for (const userId in output) {
      const { roundIds, stake } = output[userId];
      const debitAmount = fixFloatingPoint(Math.abs(stake || 0));
      const roundIdsArr = Array.from(roundIds);

      await CrDr(userId, {
        balance: debitAmount,
        liability: debitAmount,
        roundIds: roundIdsArr,
      });
    }
  } catch (error) {
    console.error("Error in clearArcherLiabilityByRoundIds: ", error.message);
    console.error(error);
  }
}

async function getLiabilityDataByRoundIdsAndUserIds(params) {
  try {
    const { bets } = params;
    const query = [
      {
        $match: {
          $or: bets.map((i) => ({ roundId: i.roundId, userId: i.userId })),
          isProcessed: 0,
          isResult: false,
        },
      },
      {
        $group: {
          _id: {
            roundId: "$roundId",
            userId: "$userId",
          },
          userId: { $first: "$userId" },
          roundId: { $first: "$roundId" },
          stake: { $sum: "$stake" },
        },
      },
    ];

    const betsData = await ArcherBets.aggregate(query);
    if (!betsData.length) return resultResponse(SERVER_ERROR, { msg: "No Data Found" });

    const output = betsData.reduce((acc, item) => {
      const userId = item.userId.toString();
      if (!acc[userId]) {
        acc[userId] = {
          stake: 0,
          roundIds: new Set(),
        };
      }
      acc[userId].stake += item.stake;
      acc[userId]["roundIds"].add(item.roundId);
      return acc;
    }, {});

    return resultResponse(SUCCESS, { data: output, msg: "Success" });
  } catch (error) {
    console.error(
      "Error in getLiabilityDataByRoundIdsAndUserIds: ",
      error.message
    );
    console.error(error);
    return resultResponse(SERVER_ERROR, { msg: error.message });
  }
}

function exposureQuery(request) {
  let { user_id } = request.joiData;
  const selfUserId = request.User._id.toString();
  user_id = user_id ? user_id : selfUserId;

  let filter = { isProcessed: 0 };

  // If user wants to see the active exposure.
  if (request.User.user_type_id == USER_TYPE_USER) {
    filter["userId"] = selfUserId;

    // If super admin want to see the specific user active exposure.
  } else if (request.User.user_type_id == USER_TYPE_SUPER_ADMIN) {
    // If super admin user id is not equal to self id.
    if (user_id != selfUserId) {
      filter["userId"] = user_id;
    }
  } else {
    // If agent want to see their users exposure.
    filter["parent_level_ids.user_id"] = ObjectId(selfUserId);
    if (user_id != selfUserId) {
      if (user_id) {
        filter["userId"] = user_id;
      }
    }
  }

  let matchConditions = { $match: filter };

  return [
    {
      ...matchConditions,
    },
    {
      $group: {
        _id: "$roundId",
        roundId: { $first: "$roundId" },
        userId: { $first: "$userId" },
        userName: { $first: "$userName" },
        gameName: { $first: "$gameName" },
        createdAt: { $first: "$createdAt" },
        exposure: { $sum: { $abs: "$stake" } },
      },
    },
    {
      $sort: { createdAt: -1 },
    },
    {
      $facet: {
        data: [
          {
            $project: {
              _id: 0,
              roundId: 1,
              userId: 1,
              userName: 1,
              gameName: 1,
              exposure: 1,
              createdAt: 1,
            },
          },
        ],
        metadata: [
          {
            $group: {
              _id: null,
              exposureSum: {
                $sum: "$exposure",
              },
            },
          },
          {
            $project: {
              _id: 0,
              exposureSum: 1,
            },
          },
        ],
      },
    },
    {
      $project: {
        liabilitySum: { $arrayElemAt: ["$metadata.exposureSum", 0] },
        data: 1,
      },
    },
  ];
}

function archerBetsQuery(request) {
  let { user_id, bets_type, from_date, to_date, limit, page, isBack } =
    request.joiData;

  let skip = (page - 1) * limit;

  let filter = {};

  // Apply filters based on the provided parameters
  if (from_date && to_date) {
    filter["createdAt"] = {
      $gte: new Date(from_date),
      $lte: new Date(to_date),
    };
  }

  if (request.joiData?.roundId) {
    filter["roundId"] = request.joiData.roundId;
  }

  if (isBack != undefined) {
    filter["isBack"] = isBack;
  }

  filter["isProcessed"] =
    bets_type === "settled" ? 1 : bets_type === "cancelled" ? 3 : 0;

  user_id = user_id ? user_id : request.User.user_id.toString();

  // Apply user-based filters based on user type
  if (request.User.user_type_id === USER_TYPE_USER) {
    filter["userId"] = user_id;
  } else if (request.User.user_type_id === USER_TYPE_SUPER_ADMIN) {
    if (user_id !== request.User.user_id) {
      filter["userId"] = user_id;
    }
  } else {
    filter["parentLevels.user_id"] = ObjectId(request.User.user_id);
    if (user_id && user_id !== request.User.user_id) {
      filter["userId"] = user_id;
    }
  }

  return [
    { $match: filter },
    {
      $facet: {
        metadata: [
          {
            $group: {
              _id: null,
              total: { $sum: 1 },
              total_profit: {
                $sum: {
                  $cond: {
                    if: { $eq: ["$isProcessed", 1] },
                    then: "$pnl",
                    else: "$stake",
                  },
                },
              },
            },
          },
          {
            $addFields: {
              currentPage: page,
              totalPages: {
                $ceil: {
                  $divide: ["$total", limit],
                },
              },
            },
          },
          {
            $project: {
              _id: 0,
            },
          },
        ],
        data: [
          { $sort: { createdAt: -1 } },
          { $skip: skip },
          { $limit: limit },
          {
            $project: {
              _id: 1,
              userName: 1,
              domainName: 1,
              matchName: "$gameName",
              marketType: "$gameName",
              userId: 1,
              marketId: "$roundId",
              runnerName: "$selectionName",
              stake: 1,
              odds: 1,
              pnl: 1,
              isProcessed: 1,
              liability: "$stake",
              isBack: 1,
              roundId: 1,
              marketName: "$gameName",
              createdAt: 1,
            },
          },
        ],
      },
    },
    {
      $project: {
        metadata: { $arrayElemAt: ["$metadata", 0] }, // Converts the array to an object
        data: 1,
      },
    },
  ];
}

module.exports = {
  transactionsInit,
  resultSettlementInit,
  autoClearLiabilityInit,
  exposureQuery,
  archerBetsQuery,
};
