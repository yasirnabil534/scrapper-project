import express from "express";
import main from "./main.js";
import loadToken from "./common/load-token.js";
import dotenv from "dotenv";
import app from "./app/app.js";
dotenv.config();
import open from "open";


const port: number = parseInt(process.env.PORT || "3000");

// * MongoDB connection function
const connectDB = async (): Promise<void> => {
  try {
    console.log("Connected to DB server");
  } catch (err) {
    console.log(err);
    throw err;
  }
};

// * Server listening port functionality
app.listen(port, async () => {
  try {
    // await connectDB();


    if (!loadToken(process.env.TOKEN_PATH || 'token.json')) {
      console.log("Opening browser for authentication...");
      open(`http://localhost:${port}/auth`);
    }
    console.log(`Server is listening on port ${port}`);
  } catch (err) {
    console.log("Server cannot be connected because of the error:");
    console.log(err);
  }
});
