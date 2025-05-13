const express = require("express");
const BallByBallController = require("../../admin-backend/controllers/ballByBallController");
const BallByBallValidator = require("../../admin-backend/validator/ballByBallValidator");

//Routes for sports
module.exports = () => {
  const BallByBallRoute = express.Router();

  BallByBallRoute.post("/open-launch-url", BallByBallValidator.launchUrl, BallByBallController.launchUrl);
  BallByBallRoute.post("/launch-url", BallByBallValidator.launchUrl, BallByBallController.launchUrl);
  BallByBallRoute.post("/bets", BallByBallValidator.bets, BallByBallController.bets);

  return BallByBallRoute;
};
