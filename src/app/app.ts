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
app.get("/api/expedia", main);

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
