import express from 'express';
import bodyParser from 'body-parser';
import cors from 'cors';
import createError from '../common/error';

const app = express();

app.use('/webhook', bodyParser.raw({ type: '*/*' }));
// app.use(bodyParser.raw({ type: '*/*' }))
app.use(bodyParser.json());
app.use(cors());

// * Logger middleware
app.use((req, res, next) => {
  res.on("finish", () => {
    console.log(req.method, req.hostname, req.path, res.statusCode, res.statusMessage, new Date(Date.now()))
  });
  next();
});

// ? API to check connection to servers (health api)
app.get("/", (req, res, next) => {
  try {
    res.status(200).json({ messge: "Connection established" });
  } catch (err) {
    next(createError());
  }
});

// ~ Router starts here

// * GLobal error handle middleware
app.use((err, req, res, next) => {
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