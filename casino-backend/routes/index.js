const initBallByBallRoutes = require('./ballbyballRoutes');

module.exports = (app) => {
    app.use(`/api/ballbyball`, initBallByBallRoutes());
};