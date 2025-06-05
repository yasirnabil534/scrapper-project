import dotenv from "dotenv";
import { browserSetup } from "../browser-setup/browser.js";
import { delay } from "../common/delay.js";
import login from "../login/login.js";
import handleOtpVerification from "../otp-verification/otp-verification.js";
import scrapeWithReservationId from "../retry-scrape-data/scrape-with-reservationid.js";

dotenv.config();

async function reservation(
  reservations: any[]
): Promise<void> {
  try {
    // Step 1: Setup browser and navigate to login page
    console.log("Setting up browser...");
    const { browser, page } = await browserSetup();
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
      // Step 3: Perform property search with the provided property ID
      if (reservations.length > 0) {
        try {
          for (const reservation of reservations) {
            await scrapeWithReservationId(page, reservation);
          }
        } catch (error: any) {
          console.error("Reservation search failed:", error);
          throw error;
        }
      } else {
        console.log("No property ID provided, skipping property search.");
      }
      
    } else {
      console.log("No login credentials provided.");
    }
  } catch (error) {
    console.error("Main function error:", error);
    throw error;
  }
}

export default reservation;
