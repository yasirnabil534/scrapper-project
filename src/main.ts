import dotenv from "dotenv";
import { browserSetup } from "./browser-setup/browser.js";
import { delay } from "./common/delay.js";
import login from "./login/login.js";
import handleOtpVerification from "./otp-verification/otp-verification.js";
import { propertySearchAndClickReservation } from "./property-search/property-search.js";
import { splitDateRange } from "./date-split/date-split.js";

dotenv.config();

async function main(
  propertyId?: string,
  startDate?: string,
  endDate?: string
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
      if (propertyId) {
        try {
          console.log(`Starting property search for ID: ${propertyId}`);
          await propertySearchAndClickReservation(page, propertyId);
          console.log(
            "Property search and reservation completed successfully!"
          );
        } catch (error: any) {
          console.error("Property search failed:", error);
          throw error;
        }
      } else {
        console.log("No property ID provided, skipping property search.");
      }
      try {
        if (startDate && endDate) {
          await splitDateRange(page, startDate, endDate);
        } else {
          console.log(
            "No start date or end date provided, skipping date selection."
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
  } catch (error) {
    console.error("Main function error:", error);
    throw error;
  }
}

export default main;
