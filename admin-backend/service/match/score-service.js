//Libraries
const axios = require('axios');

// Models
const Match = require('../../../models/match')

// Connections
const redisClient = require("../../../connections/redisConnections")

// Utils & Constants
const { resultResponse } = require('../../../utils/globalFunction');
const { getDmScoreUID } = require('../../../utils/getter-setter');
const { SUCCESS, NOT_FOUND, SERVER_ERROR } = require('../../../utils/constants');
const { DM_PROVIDER_SCORE_API } = require('../../../config/constant/rateConfig');

async function fetchAndSaveScoreData() {
  try {

    const matches = await Match.find({
      is_active: 1, is_visible: true,
      is_abandoned: 0, is_result_declared: 0,
      centralId: { "$ne": null },
      cron_inplay: true,
    }, { _id: 1, match_id: 1 }).lean();

    if (!matches || matches.length === 0) {
      return resultResponse(NOT_FOUND, 'No matches found');
    }

    const matchIds = matches.map(match => match.match_id).join(',');
    const url = `${DM_PROVIDER_SCORE_API}${matchIds}`;

    const result = (await axios.get(url, { timeout: 5000 }))?.data;

    if (!result || !result?.scoreData) {
      return resultResponse(NOT_FOUND, 'No data found');
    }

    const scoreData = result.scoreData;
    const multi = redisClient.multi();

    for (const matchId in scoreData) {
      const scoreItem = scoreData[matchId];
      if (!scoreItem?.length || !scoreItem[0]?.data) {
        continue;
      }

      const { data, event_id } = scoreItem[0];

      // Remove newlines and excess spaces
      const cleanedData = data
        .replace(/\\"/g, '"')     // fix escaped quotes
        .replace(/\\+/g, '')      // remove any remaining backslashes (just in case)
        .replace(/\s+/g, ' ')     // collapse multiple spaces
        .trim();                  // remove trailing and leading whitespace

      const key = getDmScoreUID(event_id);
      const finalObj = JSON.stringify({
        event_id: event_id,
        data: cleanedData,
      });

      multi.set(key, finalObj);
      multi.expire(key, 30);
    }

    // Execute the commands
    await multi.exec();

    return resultResponse(SUCCESS, { msg: 'Successfully saved score data' });

  } catch (error) {
    console.error("DM_PROVIDER_SCORE_API failed", error.message);
    return resultResponse(SERVER_ERROR, error.message);
  }

}

async function getDMScoreData(match_id) {
  try {
    let scoreData = await redisClient.get(getDmScoreUID(match_id));
    if (scoreData) {
      scoreData = JSON.parse(scoreData);
      return resultResponse(SUCCESS, { ...scoreData, isScore: true });
    }
    return resultResponse(NOT_FOUND, 'Score data not found');
  } catch (error) {
    return resultResponse(SERVER_ERROR, error.message);
  }
}

module.exports = {
  fetchAndSaveScoreData,
  getDMScoreData,
}