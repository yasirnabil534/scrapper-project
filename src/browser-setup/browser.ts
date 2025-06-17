import dotenv from "dotenv";
import ipLocation from "iplocation";
import puppeteer, { Browser, Page } from "puppeteer";
import { delay } from "../common/delay.js";
dotenv.config();

if (!process.env.STEEL_API_KEY) {
  throw new Error("STEEL_API_KEY environment variable is not defined");
}

export async function browserSetup(session: any): Promise<{
  browser: Browser;
  page: Page;
}> {
  let browser: Browser | null = null;

  try {
    // browser = await puppeteer.launch({
    //   headless: false,
    //   defaultViewport: null,
    //   args: [
    //     "--start-maximized",
    //     "--no-sandbox",
    //     "--disable-setuid-sandbox",
    //     "--disable-web-security",
    //     "--disable-features=IsolateOrigins,site-per-process",
    //     "--disable-blink-features=AutomationControlled",
    //     "--disable-extensions",
    //     // "--proxy-server=brd.superproxy.io:33335",
    //   ],
    //   browserWSEndpoint: `wss://connect.steel.dev?apiKey=${process.env.STEEL_API_KEY}&sessionId=${session.id}`,
    //   timeout: 60000,
    // });

    browser = await puppeteer.connect({
      browserWSEndpoint: `wss://connect.steel.dev?apiKey=${process.env.STEEL_API_KEY}&sessionId=${session.id}`,
      protocolTimeout: 1200000,
    });

    const page: Page = await browser.newPage();

    //ip check

    try {
      await page.goto("https://api.ipify.org/?format=json");
      const ipData = await page.evaluate(() => document.body.textContent);
      if (!ipData) {
        throw new Error("Failed to get IP data");
      }
      const ip = JSON.parse(ipData).ip;
      console.log("Current IP:", ip);
      // const location = (await ipLocation(ip)) as any;
      // console.log("Location:", location);
      // if (location?.country?.code !== process.env.LOCATION_COUNTRY_CODE) {
      //   console.log("Not in United States - Stopping server");
      //   process.exit(1);
      // }
    } catch (error) {
      console.error("Error checking IP:", error);
      process.exit(1);
    }

    // await page.authenticate({
    //   username: `${process.env.BRIGHT_DATA_USERNAME}`,
    //   password: `${process.env.BRIGHT_DATA_PASSWORD}`,
    // });
    // Set user agent to avoid detection
    // await page.setUserAgent(
    //   "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36"
    // );

    await page.setDefaultNavigationTimeout(60000);
    await page.setDefaultTimeout(60000);

    // Navigate to partner central with retry logic
    console.log("Navigating to Expedia Partner Central...");

    const maxRetries = 3;
    let navigationSuccess = false;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        console.log(`Navigation attempt ${attempt}/${maxRetries}`);

        await page.goto(
          "https://www.expediapartnercentral.com/Account/Logon?signedOff=true",
          {
            waitUntil: "domcontentloaded",
            timeout: 30000,
          }
        );

        // Wait for page to stabilize
        await delay(3000);

        // Check if page loaded successfully by looking for a common element
        await page.waitForSelector("body", { timeout: 5000 });

        navigationSuccess = true;
        console.log("Navigation successful!");
        break;
      } catch (navError: any) {
        console.log(`Navigation attempt ${attempt} failed:`, navError.message);

        if (attempt < maxRetries) {
          console.log("Retrying navigation...");
          await delay(2000); // Wait before retry
        } else {
          console.log("All navigation attempts failed");
          throw navError;
        }
      }
    }

    if (!navigationSuccess) {
      throw new Error(
        "Failed to navigate to the target page after all attempts"
      );
    }

    console.log("Browser setup completed successfully");
    return { browser, page };
  } catch (error) {
    console.error("Browser setup failed:", error);

    // Clean up browser if it was created
    if (browser) {
      try {
        await browser.close();
        await session.release();
      } catch (closeError) {
        console.error("Error closing browser:", closeError);
      }
    }

    throw error;
  }
}
