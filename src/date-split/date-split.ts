import dotenv from "dotenv";
import { Page } from "puppeteer";
import { splitDateRangeIntoChunks } from "./helper.js";
import { applyFilter } from "../apply-filter/apply-filter.js";
dotenv.config();

const CHUNK_SIZE = parseInt(process.env.CHUNK_SIZE || "2", 10);

export async function splitDateRange(
  page: Page,
  start_date: string,
  end_date: string,
  propertyId: string
) {
  try {
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

    for (const chunk of dateChunks) {
      console.log(`Processing chunk: ${chunk.start} to ${chunk.end}`);
      await applyFilter(page, chunk.start, chunk.end, propertyId);
    }
  } catch (error) {
    console.error("Error in setDateRange:", error);
    throw error;
  }
}
