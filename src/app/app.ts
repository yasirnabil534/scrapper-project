import bodyParser from "body-parser";
import cors from "cors";
import express from "express";
import createError from "../common/error.js";
import { scrapingStateManager } from "../common/scraping-state.js";
import { specs, swaggerUi } from "../config/swagger.js";
import { getAccess, getOauth2Callback } from "../get-access/access.js";
import main from "../main.js";
import reservation from "../reservation/reservation.js";

const app = express();

app.use("/webhook", bodyParser.raw({ type: "*/*" }));
// app.use(bodyParser.raw({ type: '*/*' }))
app.use(bodyParser.json());
app.use(cors());

// Swagger UI
app.use(
  "/api-docs",
  swaggerUi.serve,
  swaggerUi.setup(specs, {
    explorer: true,
    customCss: ".swagger-ui .topbar { display: none }",
    customSiteTitle: "Module Scrapper API Documentation",
  })
);

// * Logger middleware
app.use((req, res, next) => {
  res.on("finish", () => {
    console.log(
      req.method,
      req.hostname,
      req.path,
      res.statusCode,
      res.statusMessage,
      new Date(Date.now())
    );
  });
  next();
});

/**
 * @swagger
 * /:
 *   get:
 *     tags:
 *       - Health
 *     summary: Health check endpoint
 *     description: Check if the server is running and accessible
 *     responses:
 *       200:
 *         description: Server is running
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 messge:
 *                   type: string
 *                   example: "Connection established"
 *       500:
 *         description: Server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
// ? API to check connection to servers (health api)
app.get("/", (req, res, next) => {
  try {
    res.status(200).json({ messge: "Connection established" });
  } catch (err: any) {
    next(createError(err.status, err.message));
  }
});

/**
 * @swagger
 * /auth:
 *   get:
 *     tags:
 *       - Authentication
 *     summary: Initiate OAuth authentication
 *     description: Start the OAuth authentication flow for accessing Expedia services
 *     responses:
 *       200:
 *         description: Authentication flow initiated
 *       500:
 *         description: Authentication error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
// ~ Router starts here
app.get("/auth", getAccess as any);

/**
 * @swagger
 * /oauth2callback:
 *   get:
 *     tags:
 *       - Authentication
 *     summary: OAuth callback endpoint
 *     description: Handle OAuth callback after user authentication
 *     parameters:
 *       - in: query
 *         name: code
 *         required: true
 *         schema:
 *           type: string
 *         description: Authorization code from OAuth provider
 *       - in: query
 *         name: state
 *         schema:
 *           type: string
 *         description: State parameter for security
 *     responses:
 *       200:
 *         description: OAuth callback processed successfully
 *       400:
 *         description: Invalid OAuth callback parameters
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
app.get("/oauth2callback", getOauth2Callback as any);

/**
 * @swagger
 * /api/scraping/status:
 *   get:
 *     tags:
 *       - Scraping Control
 *     summary: Get current scraping status
 *     description: Retrieve the current state and progress of scraping operations
 *     responses:
 *       200:
 *         description: Scraping status retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: integer
 *                   example: 200
 *                 message:
 *                   type: string
 *                   example: "Scraping status retrieved successfully"
 *                 data:
 *                   $ref: '#/components/schemas/ScrapingState'
 *       500:
 *         description: Error retrieving scraping status
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
// API to get scraping status
app.get(
  "/api/scraping/status",
  (req: express.Request, res: express.Response) => {
    try {
      const state = scrapingStateManager.getState();
      res.status(200).json({
        status: 200,
        message: "Scraping status retrieved successfully",
        data: state,
      });
    } catch (err: any) {
      console.error("Error getting scraping status:", err);
      res.status(500).json({
        status: 500,
        message: "Error retrieving scraping status",
        error: err.message,
      });
    }
  }
);

/**
 * @swagger
 * /api/scraping/pause:
 *   post:
 *     tags:
 *       - Scraping Control
 *     summary: Pause current scraping job
 *     description: Gracefully pause the currently running scraping job. The current operation will complete before pausing.
 *     responses:
 *       200:
 *         description: Scraping paused successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: integer
 *                   example: 200
 *                 message:
 *                   type: string
 *                   example: "Scraping paused successfully"
 *                 data:
 *                   $ref: '#/components/schemas/ScrapingState'
 *       400:
 *         description: Cannot pause scraping - no active job running
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: integer
 *                   example: 400
 *                 message:
 *                   type: string
 *                   example: "Cannot pause scraping - no active scraping job running"
 *       500:
 *         description: Error pausing scraping
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
// API to pause scraping
app.post(
  "/api/scraping/pause",
  (req: express.Request, res: express.Response) => {
    try {
      const success = scrapingStateManager.pauseScraping();

      if (success) {
        res.status(200).json({
          status: 200,
          message: "Scraping paused successfully",
          data: scrapingStateManager.getState(),
        });
      } else {
        res.status(400).json({
          status: 400,
          message: "Cannot pause scraping - no active scraping job running",
        });
      }
    } catch (err: any) {
      console.error("Error pausing scraping:", err);
      res.status(500).json({
        status: 500,
        message: "Error pausing scraping",
        error: err.message,
      });
    }
  }
);

/**
 * @swagger
 * /api/scraping/resume:
 *   post:
 *     tags:
 *       - Scraping Control
 *     summary: Resume paused scraping job
 *     description: Resume a previously paused scraping job from where it left off
 *     responses:
 *       200:
 *         description: Scraping resumed successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: integer
 *                   example: 200
 *                 message:
 *                   type: string
 *                   example: "Scraping resumed successfully"
 *                 data:
 *                   $ref: '#/components/schemas/ScrapingState'
 *       400:
 *         description: Cannot resume scraping - no paused job found
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: integer
 *                   example: 400
 *                 message:
 *                   type: string
 *                   example: "Cannot resume scraping - no paused scraping job found"
 *       500:
 *         description: Error resuming scraping
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
// API to resume scraping
app.post(
  "/api/scraping/resume",
  (req: express.Request, res: express.Response) => {
    try {
      const success = scrapingStateManager.resumeScraping();

      if (success) {
        res.status(200).json({
          status: 200,
          message: "Scraping resumed successfully",
          data: scrapingStateManager.getState(),
        });
      } else {
        res.status(400).json({
          status: 400,
          message: "Cannot resume scraping - no paused scraping job found",
        });
      }
    } catch (err: any) {
      console.error("Error resuming scraping:", err);
      res.status(500).json({
        status: 500,
        message: "Error resuming scraping",
        error: err.message,
      });
    }
  }
);

/**
 * @swagger
 * /api/scraping/stop:
 *   post:
 *     tags:
 *       - Scraping Control
 *     summary: Stop current scraping job
 *     description: Completely stop the current scraping job. This cannot be resumed and will require starting a new job.
 *     responses:
 *       200:
 *         description: Scraping stopped successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: integer
 *                   example: 200
 *                 message:
 *                   type: string
 *                   example: "Scraping stopped successfully"
 *                 data:
 *                   $ref: '#/components/schemas/ScrapingState'
 *       500:
 *         description: Error stopping scraping
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
// API to stop scraping
app.post(
  "/api/scraping/stop",
  (req: express.Request, res: express.Response) => {
    try {
      const wasRunning = scrapingStateManager.isRunning();
      scrapingStateManager.stopScraping();

      if (wasRunning) {
        res.status(200).json({
          status: 200,
          message: "Scraping stopped successfully",
          data: scrapingStateManager.getState(),
        });
      } else {
        res.status(200).json({
          status: 200,
          message: "No scraping job was running",
          data: scrapingStateManager.getState(),
        });
      }
    } catch (err: any) {
      console.error("Error stopping scraping:", err);
      res.status(500).json({
        status: 500,
        message: "Error stopping scraping",
        error: err.message,
      });
    }
  }
);

/**
 * @swagger
 * /api/expedia/property-run-job:
 *   get:
 *     tags:
 *       - Scraping Jobs
 *     summary: Start property scraping job
 *     description: Start a new property scraping job for the specified property ID and date range
 *     parameters:
 *       - in: query
 *         name: propertyId
 *         required: true
 *         schema:
 *           type: string
 *         description: The property ID to scrape
 *         example: "12345"
 *       - in: query
 *         name: startDate
 *         required: true
 *         schema:
 *           type: string
 *           format: date
 *         description: Start date for scraping (YYYY-MM-DD)
 *         example: "2024-01-01"
 *       - in: query
 *         name: endDate
 *         required: true
 *         schema:
 *           type: string
 *           format: date
 *         description: End date for scraping (YYYY-MM-DD)
 *         example: "2024-01-31"
 *     responses:
 *       200:
 *         description: Property scraping job started successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: integer
 *                   example: 200
 *                 message:
 *                   type: string
 *                   example: "Property search completed successfully"
 *                 propertyId:
 *                   type: string
 *                   example: "12345"
 *                 jobId:
 *                   type: string
 *                   example: "job_12345_1703123456789"
 *       400:
 *         description: Missing required parameters
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: integer
 *                   example: 400
 *                 message:
 *                   type: string
 *                   example: "propertyId query parameter is required"
 *       409:
 *         description: Scraping job already running
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: integer
 *                   example: 409
 *                 message:
 *                   type: string
 *                   example: "Scraping job is already running"
 *                 currentState:
 *                   $ref: '#/components/schemas/ScrapingState'
 *       500:
 *         description: Error processing property search
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
app.get("/api/expedia/property-run-job", (async (
  req: express.Request,
  res: express.Response
) => {
  try {
    const propertyId = req.query.propertyId as string | undefined;
    const startDate = req.query.startDate as string | undefined;
    const endDate = req.query.endDate as string | undefined;

    if (!propertyId) {
      return res.status(400).json({
        status: 400,
        message: "propertyId query parameter is required",
      });
    }
    if (!startDate || !endDate) {
      return res.status(400).json({
        status: 400,
        message: "startDate and endDate query parameters are required",
      });
    }

    // Check if scraping is already running
    if (scrapingStateManager.isRunning()) {
      return res.status(409).json({
        status: 409,
        message: "Scraping job is already running",
        currentState: scrapingStateManager.getState(),
      });
    }

    // Generate job ID and start scraping state
    const jobId = `job_${propertyId}_${Date.now()}`;
    scrapingStateManager.startScraping(propertyId, jobId, startDate, endDate);

    // Call main function with property ID
    await main(propertyId, startDate, endDate);

    // Mark scraping as completed
    scrapingStateManager.stopScraping();

    res.status(200).json({
      status: 200,
      message: "Property search completed successfully",
      propertyId: propertyId,
      jobId: jobId,
    });
  } catch (err: any) {
    console.error("Error in /api/expedia:", err);
    // Mark scraping as stopped on error
    scrapingStateManager.stopScraping();
    res.status(500).json({
      status: 500,
      message: "Error processing property search",
      error: err.message,
    });
  }
}) as any);

/**
 * @swagger
 * /api/expedia/reservation-run-job:
 *   post:
 *     tags:
 *       - Scraping Jobs
 *     summary: Start reservation scraping job
 *     description: Start a new reservation scraping job for the specified reservations
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - reservations
 *             properties:
 *               reservations:
 *                 type: array
 *                 items:
 *                   $ref: '#/components/schemas/Reservation'
 *                 description: Array of reservations to scrape
 *                 example:
 *                   - reservationId: "RES123"
 *                     propertyId: "PROP456"
 *                   - reservationId: "RES124"
 *                     propertyId: "PROP457"
 *     responses:
 *       200:
 *         description: Reservation scraping job completed successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: integer
 *                   example: 200
 *                 message:
 *                   type: string
 *                   example: "Reservation search completed successfully"
 *                 reservations:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Reservation'
 *                 jobId:
 *                   type: string
 *                   example: "reservation_job_1703123456789"
 *       400:
 *         description: Missing or invalid reservations array
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: integer
 *                   example: 400
 *                 message:
 *                   type: string
 *                   example: "reservations array is required"
 *       409:
 *         description: Scraping job already running
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: integer
 *                   example: 409
 *                 message:
 *                   type: string
 *                   example: "Scraping job is already running"
 *                 currentState:
 *                   $ref: '#/components/schemas/ScrapingState'
 *       500:
 *         description: Error processing reservation search
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
app.post("/api/expedia/reservation-run-job", (async (
  req: express.Request,
  res: express.Response
) => {
  try {
    const reservations = req.body.reservations as any[];
    if (!reservations || reservations.length === 0) {
      return res.status(400).json({
        status: 400,
        message: "reservations array is required",
      });
    }

    // Check if scraping is already running
    if (scrapingStateManager.isRunning()) {
      return res.status(409).json({
        status: 409,
        message: "Scraping job is already running",
        currentState: scrapingStateManager.getState(),
      });
    }

    // Generate job ID and start scraping state for reservations
    const jobId = `reservation_job_${Date.now()}`;
    scrapingStateManager.startScraping("reservations", jobId);

    await reservation(reservations);

    // Mark scraping as completed
    scrapingStateManager.stopScraping();

    res.status(200).json({
      status: 200,
      message: "Reservation search completed successfully",
      reservations: reservations,
      jobId: jobId,
    });
  } catch (err: any) {
    console.error("Error in /api/expedia/retry:", err);
    // Mark scraping as stopped on error
    scrapingStateManager.stopScraping();
    res.status(500).json({
      status: 500,
      message: "Error processing property search",
      error: err.message,
    });
  }
}) as any);

// * GLobal error handle middleware
app.use((err: any, req: any, res: any, next: any) => {
  if (res.headersSent) {
    return next(err);
  }

  const errMessage = err.message || "Something went wrong";
  const errStatus = err.status || 500;
  return res.status(errStatus).json({
    status: errStatus,
    message: errMessage,
  });
});

export default app;
