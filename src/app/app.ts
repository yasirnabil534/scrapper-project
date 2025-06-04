import bodyParser from "body-parser";
import cors from "cors";
import express from "express";
import createError from "../common/error.js";
import { getAccess, getOauth2Callback } from "../get-access/access.js";
import main from "../main.js";

const app = express();

app.use("/webhook", bodyParser.raw({ type: "*/*" }));
// app.use(bodyParser.raw({ type: '*/*' }))
app.use(bodyParser.json());
app.use(cors());

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

// ? API to check connection to servers (health api)
app.get("/", (req, res, next) => {
  try {
    res.status(200).json({ messge: "Connection established" });
  } catch (err: any) {
    next(createError(err.status, err.message));
  }
});

// ~ Router starts here
app.get("/auth", getAccess as any);
app.get("/oauth2callback", getOauth2Callback as any);
app.get("/api/expedia", (async (
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

    // Call main function with property ID
    await main(propertyId, startDate, endDate);

    res.status(200).json({
      status: 200,
      message: "Property search completed successfully",
      propertyId: propertyId,
    });
  } catch (err: any) {
    console.error("Error in /api/expedia:", err);
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
