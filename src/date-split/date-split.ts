import dotenv from "dotenv";
import { Page } from "puppeteer";
import { applyFilter } from "../apply-filter/apply-filter.js";
import { scrapingStateManager } from "../common/scraping-state.js";
import { splitDateRangeIntoChunks } from "./helper.js";
dotenv.config();

const CHUNK_SIZE = parseInt(process.env.CHUNK_SIZE || "2", 10);

export async function splitDateRange(
  page: Page,
  start_date: string,
  end_date: string,
  propertyId: string
) {
  try {
    // Check if scraping is paused before starting
    await scrapingStateManager.waitWhilePaused();
    if (!scrapingStateManager.isRunning()) {
      throw new Error("Scraping was stopped during date splitting");
    }

    // Wait for date filters to be visible
    console.log("Waiting for date filters...");
    await page.waitForSelector('input[type="radio"][name="dateTypeFilter"]', {
      visible: true,
      timeout: 80000,
    });

    // Get the current URL
    const currentUrl = page.url();
    console.log(`Current tab URL: ${currentUrl}`);

    // Generate date chunks
    const dateChunks = splitDateRangeIntoChunks(
      start_date,
      end_date,
      CHUNK_SIZE
    );

    console.log(`Processing ${dateChunks.length} date chunks...`);

    for (let i = 0; i < dateChunks.length; i++) {
      const chunk = dateChunks[i];

      // Check if scraping is paused before each chunk
      await scrapingStateManager.waitWhilePaused();
      if (!scrapingStateManager.isRunning()) {
        console.log("Scraping was stopped during date chunk processing");
        return;
      }

      console.log(
        `Processing chunk ${i + 1}/${dateChunks.length}: ${chunk.start} to ${
          chunk.end
        }`
      );
      await applyFilter(page, chunk.start, chunk.end, propertyId);
    }
  } catch (error) {
    console.error("Error in setDateRange:", error);
    throw error;
  }
}
