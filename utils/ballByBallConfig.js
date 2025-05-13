const BALL_BY_BALL_EVENT_DATA = {
  sport_id: '4',
  sport_name: "Cricket",
  series_id: "123123",
  series_name: "Ball By Ball",
  match_id: "123123",
  match_name: "Ball By Ball",
  market_id: "1.123123",
  market_name: "Ball By Ball",
}
// const BALL_BY_BALL_ENV = process.env.BALL_BY_BALL_ENV || "development";

const BALL_BY_BALL_WHITELISTING_IP = [
  "127.0.0.1",
  "94.249.151.24",
];

const BALL_BY_BALL_LAUNCH_URL = process.env.BALL_BY_BALL_LAUNCH_URL || "";
const BALL_BY_BALL_X_ARCHER_KEY = process.env.BALL_BY_BALL_X_ARCHER_KEY || "";

module.exports = {
  BALL_BY_BALL_EVENT_DATA,
  BALL_BY_BALL_WHITELISTING_IP,
  BALL_BY_BALL_LAUNCH_URL,
  BALL_BY_BALL_X_ARCHER_KEY,
};
