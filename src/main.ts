import dotenv from "dotenv";
import { browserSetup } from "./browser-setup/browser.js";
import { delay } from "./common/delay.js";
import { scrapingStateManager } from "./common/scraping-state.js";
import { splitDateRange } from "./date-split/date-split.js";
import login from "./login/login.js";
import handleOtpVerification from "./otp-verification/otp-verification.js";
import { propertySearchAndClickReservation } from "./property-search/property-search.js";

dotenv.config();

async function main(
  expediaId?: string,
  startDate?: string,
  endDate?: string,
  jobId?: string
): Promise<void> {
  try {
    // const client = new Steel({
    //   steelAPIKey: process.env.STEEL_API_KEY, // Optional
    // });
    // Create a session with additional features
    // const session = await client.sessions.create({
    //   region: "lax",
    //   useProxy: true,
    //   solveCaptcha: true,
    // });
    // const debugUrl = session.debugUrl;
    // console.log(`Debug URL: ${debugUrl}`);
    // console.log(session);
    try {
      // Step 1: Setup browser and navigate to login page
      console.log("Setting up browser...");
      const { browser, page } = await browserSetup();
      console.log("Browser setup complete. Page is ready at login screen.");

      // Check if scraping is paused and wait if needed
      await scrapingStateManager.waitWhilePaused();

      // Check if scraping was stopped while paused
      if (!scrapingStateManager.isRunning()) {
        console.log("Scraping was stopped, exiting...");
        await browser.close();
        // await client.sessions.release(session.id);
        return;
      }

      // Step 2: Check if login credentials are provided
      const email = process.env.EXPEDIA_EMAIL;
      const password = process.env.EXPEDIA_PASSWORD;

      if (email && password) {
        console.log("Login credentials found, performing automatic login...");

        try {
          // Check pause state before login
          await scrapingStateManager.waitWhilePaused();
          if (!scrapingStateManager.isRunning()) {
            console.log("Scraping was stopped, exiting...");
            await browser.close();
            // await client.sessions.release(session.id);
            return;
          }

          await login(browser, page, email, password);
          console.log("Login completed successfully! User is now logged in.");

          // Add your post-login automation here
          console.log("Ready for scraping operations...");
          await delay(10000);
        } catch (loginError) {
          console.error("Login failed:", loginError);
          throw loginError;
        }

        try {
          // Check pause state before OTP verification
          await scrapingStateManager.waitWhilePaused();
          if (!scrapingStateManager.isRunning()) {
            console.log("Scraping was stopped, exiting...");
            await browser.close();
            // await client.sessions.release(session.id);
            return;
          }

          await handleOtpVerification(page);
          console.log("OTP verification completed successfully!");
        } catch (error: any) {
          console.error("OTP verification failed:", error);
          // Continue even if OTP fails as it might not be required
        }

        // Step 3: Perform property search with the provided expedia ID
        if (expediaId) {
          try {
            // Check pause state before property search
            await scrapingStateManager.waitWhilePaused();
            if (!scrapingStateManager.isRunning()) {
              console.log("Scraping was stopped, exiting...");
              await browser.close();
              // await client.sessions.release(session.id);
              return;
            }

            console.log(
              `Starting property search for Expedia ID: ${expediaId}`
            );
            await propertySearchAndClickReservation(page, expediaId);
            console.log(
              "Property search and reservation completed successfully!"
            );
          } catch (error: any) {
            console.error("Property search failed:", error);
            throw error;
          }
        } else {
          console.log("No expedia ID provided, skipping property search.");
        }

        try {
          if (startDate && endDate && expediaId) {
            // Check pause state before date splitting
            await scrapingStateManager.waitWhilePaused();
            if (!scrapingStateManager.isRunning()) {
              console.log("Scraping was stopped, exiting...");
              await browser.close();
              // await client.sessions.release(session.id);
              return;
            }

            await splitDateRange(page, startDate, endDate, expediaId, jobId);
          } else {
            console.log(
              "No start date or end date, or expedia ID provided, skipping date selection."
            );
          }
          console.log("Date selection completed successfully!");
        } catch (error: any) {
          console.error("Date selection failed:", error);
          throw error;
        }
      } else {
        console.log("No login credentials provided.");
      }

      // Close browser when done
      await browser.close();
      // await client.sessions.release(session.id);
      console.log("Browser closed successfully.");
    } catch (error) {
      console.error("Main function error:", error);
      // await client.sessions.release(session.id);
    }
  } catch (error) {
    console.error("Main function error:", error);
    throw error;
  }
}

export default main;
