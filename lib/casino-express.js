const express = require('express')
const bodyParser = require('body-parser');
const compression = require('compression');
const { createServer } = require("http");
const cors = require('cors');
const initRoutes = require('../casino-backend/routes');
const { ResError } = require('./expressResponder');
const { getStaticContent } = require('../utils');
const { API_INITIAL_ROUTE_V1 } = require('../config');
const cronService = require('../utils/cronService');

// Initialize express app
const app = express();

const httpServer = createServer(app);

app.use(cors());

app.use(compression());

app.use(API_INITIAL_ROUTE_V1 + '/', express.static(getStaticContent("/")));

function initMiddleware() {
	// Request body parsing middleware should be above methodOverride
	app.use(bodyParser.urlencoded({ extended: true, }));
	app.use(bodyParser.json({ limit: '50mb' }));
	app.use((req, res, next) => { req.headers.origin = req.headers.origin || req.headers.host; next(); });
}

function initErrorRoutes() {
	app.use((error, req, res, next) => {
		// If the error object doesn't exists
		if (!error)
			next();
		// Return error
		if (process.env.NODE_ENV == "production")
			return ResError(res, { msg: "422 Unprocessable Entity!" });
		return ResError(res, error);
	});
}

function initCrons() {
	cronService.archerResultSettlement();
	cronService.archerAutoClearLiability();
}

exports.init = () => {
	// Initialize Express middleware
	initMiddleware();
	// Initialize modules server routes
	initRoutes(app);
	// Initialize error routes
	initErrorRoutes();
	// Initiale Crons
	initCrons();
	return httpServer;
}