import dotenv from "dotenv";
import puppeteer, { Browser, Page } from "puppeteer";
import { delay } from "../common/delay.js";
// const chromeExecutable =
//   "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";

dotenv.config();

// const openDevtools = async (page: Page, client: any) => {
//   // get current frameId
//   const frameId = (page?.mainFrame() as any)?._id;
//   console.log("frameId", frameId);
//   // get URL for devtools from Browser API
//   const { url: inspectUrl } = await client.send("Page.inspect", {
//     frameId,
//   });
//   // open devtools URL in local chrome
//   exec(`"${chromeExecutable}" "${inspectUrl}"`, (error: any) => {
//     if (error) throw new Error("Unable to open devtools: " + error);
//   });
//   // wait for devtools ui to load
//   await delay(5000);
// };

// const SBR_WS_ENDPOINT = `wss://${process.env.BRIGHT_DATA_USERNAME}:${process.env.BRIGHT_DATA_PASSWORD}@brd.superproxy.io:9222`;

const SBR_WS_ENDPOINT = `wss://${process.env.BRIGHT_DATA_USERNAME}:${process.env.BRIGHT_DATA_PASSWORD}@brd.superproxy.io:9222`;

export async function browserSetup(): Promise<{
  browser: Browser;
  page: Page;
}> {
  let browser: Browser | null = null;

  try {
    browser = await puppeteer.launch({
      headless: false,
      defaultViewport: null,
      args: [
        "--start-maximized",
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-web-security",
        "--disable-features=IsolateOrigins,site-per-process",
        "--disable-blink-features=AutomationControlled",
        "--disable-extensions",
        // "--proxy-server=brd.superproxy.io:33335",
      ],
    });

    // browser = await puppeteer.connect({
    //   browserWSEndpoint:
    //     "wss://brd-customer-hl_af263bba-zone-expedia_test_browser:vj2iow2h8v8v@brd.superproxy.io:9222",
    // });

    // browser = await puppeteer.connect({
    //   browserWSEndpoint:
    //     "wss://production-sfo.browserless.io/?token=2SXlnLjeZpwR2tV6ab1698bfe680a3959c2c681f06939ee3b",
    // });

    // browser = await puppeteer.connect({
    //   browserWSEndpoint:"wss://production-sfo.browserless.io/?token=&record=true",
    // });

    const page: Page = await browser.newPage();
    // const cdp = await page.createCDPSession();
    // await (cdp as any).send("Browserless.startRecording");
    // console.log("Recording started successfully");

    // // // Wait a bit before generating live URL
    // await delay(2000);

    // // // Generate live URL for user interaction
    // const { liveURL } = (await (cdp as any).send("Browserless.liveURL", {
    //   timeout: 600_000,
    // })) as { liveURL: string };
    // console.log("Click for live experience:", liveURL);

    // const client = await page.createCDPSession();
    // console.log("client", client);
    // await openDevtools(page, client);

    //ip check

    // try {
    //   await page.goto("https://api.ipify.org/?format=json");
    //   const ipData = await page.evaluate(() => document.body.textContent);
    //   if (!ipData) {
    //     throw new Error("Failed to get IP data");
    //   }
    //   const ip = JSON.parse(ipData).ip;
    //   console.log("Current IP:", ip);
    //   // const location = (await ipLocation(ip)) as any;
    //   // console.log("Location:", location);
    //   // if (location?.country?.code !== process.env.LOCATION_COUNTRY_CODE) {
    //   //   console.log("Not in United States - Stopping server");
    //   //   process.exit(1);
    //   // }
    // } catch (error) {
    //   console.error("Error checking IP:", error);
    //   process.exit(1);
    // }

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
        await page.waitForSelector("body", { timeout: 500000 });

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
        // await session.release();
      } catch (closeError) {
        console.error("Error closing browser:", closeError);
      }
    }

    throw error;
  }
}
