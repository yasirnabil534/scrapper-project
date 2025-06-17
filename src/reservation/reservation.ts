import dotenv from "dotenv";
import Steel from "steel-sdk";
import { browserSetup } from "../browser-setup/browser.js";
import { delay } from "../common/delay.js";
import { scrapingStateManager } from "../common/scraping-state.js";
import login from "../login/login.js";
import handleOtpVerification from "../otp-verification/otp-verification.js";
import scrapeWithReservationId from "../retry-scrape-data/scrape-with-reservationid.js";

dotenv.config();

// Initialize Steel client
const client = new Steel({
  steelAPIKey: process.env.STEEL_API_KEY, // Optional
});

async function reservation(reservations: any[]): Promise<void> {
  try {
    // Create a new session
    const session = await client.sessions.create();

    // Step 1: Setup browser and navigate to login page
    console.log("Setting up browser...");
    const { browser, page } = await browserSetup(session);
    console.log("Browser setup complete. Page is ready at login screen.");

    // Step 2: Check if login credentials are provided
    const email = process.env.EXPEDIA_EMAIL;
    const password = process.env.EXPEDIA_PASSWORD;

    if (email && password) {
      console.log("Login credentials found, performing automatic login...");

      try {
        await login(browser, page, email, password);
        console.log("Login completed successfully! User is now logged in.");

        // Add your post-login automation here
        console.log("Ready for scraping operations...");
        await delay(10000);
      } catch (loginError) {
        console.error("Login failed:", loginError);
      }

      try {
        await handleOtpVerification(page);
        console.log("OTP verification completed successfully!");
      } catch (error: any) {
        console.error("OTP verification failed:", error);
      }

      // Step 3: Perform reservation scraping
      if (reservations.length > 0) {
        try {
          // Update progress with total count
          scrapingStateManager.updateProgress(
            undefined,
            undefined,
            0,
            reservations.length
          );

          let processedCount = 0;
          for (const reservation of reservations) {
            // Check if scraping is paused and wait if needed
            await scrapingStateManager.waitWhilePaused();

            // Check if scraping was stopped while paused
            if (!scrapingStateManager.isRunning()) {
              console.log("Scraping was stopped, exiting...");
              return;
            }

            console.log(
              `Processing reservation ${processedCount + 1}/${
                reservations.length
              }`
            );

            await scrapeWithReservationId(page, reservation);
            processedCount++;

            // Update progress
            scrapingStateManager.updateProgress(
              undefined,
              undefined,
              processedCount,
              reservations.length
            );
          }
        } catch (error: any) {
          console.error("Reservation search failed:", error);
          throw error;
        }
      } else {
        console.log("No reservations provided, skipping reservation search.");
      }
    } else {
      console.log("No login credentials provided.");
    }
  } catch (error) {
    console.error("Reservation function error:", error);
    throw error;
  }
}

export default reservation;
