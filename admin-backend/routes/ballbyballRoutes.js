const express = require("express");
const BallByBallController = require("../controllers/ballByBallController");
const BallByBallValidator = require("../validator/ballByBallValidator");

//Routes for sports
module.exports = () => {
  const BallByBallRoute = express.Router();

  BallByBallRoute.post("/launch-url", BallByBallValidator.launchUrl, BallByBallController.launchUrl);
  BallByBallRoute.post("/bets", BallByBallValidator.bets, BallByBallController.bets);

  return BallByBallRoute;
};
