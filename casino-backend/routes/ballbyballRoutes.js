const express = require("express");
const BallByBallController = require("../../admin-backend/controllers/ballByBallController");
const BallByBallValidator = require("../../admin-backend/validator/ballByBallValidator");

//Routes for sports
module.exports = () => {
  const BallByBallRoute = express.Router();

  BallByBallRoute.post("/transactions", BallByBallController.transaction);

  return BallByBallRoute;
};
