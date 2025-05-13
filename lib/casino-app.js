const express = require('./casino-express')
  , mongoose = require('../connections/mongoose')
  , { CASINO_PORT_1 } = require('../config');
require('../utils/logger');
require('../admin-backend/service/disconnect/init');

const start = () => {
  const appStartMessage = () => {
    if (process.env.NODE_ENV == "production") {
      global.log.info(`Server Name : casino`);
      global.log.info(`Environment : ${process.env.NODE_ENV}`);
      global.log.info(`App Port : ${CASINO_PORT_1}`);
      global.log.info(`Process Id : ${process.pid}`);
      global.log.info(`REDIS : ${process.env.REDIS_CONNECTION}`);
    } else {
      global.log.debug(`Server Name : casino`);
      global.log.debug(`Environment : ${process.env.NODE_ENV}`);
      global.log.debug(`App Port : ${CASINO_PORT_1}`);
      global.log.debug(`Process Id : ${process.pid}`);
      global.log.debug(`REDIS : ${process.env.REDIS_CONNECTION}`);
    }
  };
  const options = mongoose.getOptions();
  //Connect to Db
  mongoose.connect(options)().then(() => {
    global.log.info("casino server is ready...");
    const httpServer = express.init();
    httpServer.listen(CASINO_PORT_1, appStartMessage);
  });
};

exports.start = start;