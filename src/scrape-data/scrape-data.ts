import { Page } from "puppeteer";
import { delay } from "../common/delay.js";
const pageReservations: any[] = [];
const processedReservationIds = new Set();

export async function scrapeData(
  page: Page,
  propertyId: string = "",
  start_date: string = "",
  end_date: string = ""
) {
  try {
    // Function to get total results count
    const getTotalResults = async () => {
      const resultsText = await page.$eval(
        ".fds-pagination-showing-result",
        (el) => el.textContent || ""
      );
      const match = resultsText.match(/of (\d+) Results/);
      return match ? parseInt(match[1]) : 0;
    };

    // Function to check if there's a next page
    const hasNextPage = async () => {
      return await page.evaluate(() => {
        const nextButton = document.querySelector(
          ".fds-pagination-button.next button"
        ) as HTMLButtonElement;
        return nextButton && !nextButton.disabled;
      });
    };

    const totalResults = await getTotalResults();
    console.log(`Total reservations to fetch: ${totalResults}`);

    let currentPage = 1;
    let hasMore = true;
    while (hasMore) {
      try {
        console.log(`Processing page ${currentPage}...`);

        // Wait for table data to load
        await page.waitForSelector("table.fds-data-table tbody tr", {
          visible: true,
          timeout: 30000,
        });
        await delay(5000);

        // Get reservations from current page
        const rows = await page.$$("table.fds-data-table tbody tr");

        for (const row of rows) {
          let basicData: any = null;
          let cardData = null;
          let paymentData = null;
          let remainingAmountToCharge = null;
          let amountToRefund = null;
          let status = "None"; // Default status
          let remainingBalance = "N/A";

          try {
            // Get basic data first
            basicData = await page.evaluate((row) => {
              return {
                guestName:
                  row
                    .querySelector(
                      "td.guestName button.guestNameLink span.fds-button2-label"
                    )
                    ?.textContent?.trim() || "",
                reservationId:
                  row
                    .querySelector("td.reservationId div.fds-cell")
                    ?.textContent?.trim() || "",
                confirmationCode:
                  row
                    .querySelector(
                      "td.confirmationCode label.confirmationCodeLabel"
                    )
                    ?.textContent?.trim() || "",
                checkInDate:
                  row.querySelector("td.checkInDate")?.textContent?.trim() ||
                  "",
                checkOutDate:
                  row.querySelector("td.checkOutDate")?.textContent?.trim() ||
                  "",
                roomType:
                  row.querySelector("td.roomType")?.textContent?.trim() || "",
                bookingAmount:
                  row
                    .querySelector("td.bookingAmount .fds-currency-value")
                    ?.textContent?.trim() || "",
                bookedDate:
                  row.querySelector("td.bookedOnDate")?.textContent?.trim() ||
                  "",
              };
            }, row);

            // Check if we've already processed this reservation
            if (processedReservationIds.has(basicData.reservationId)) {
              console.log(
                `Skipping duplicate reservation: ${basicData.reservationId}`
              );
              continue;
            }

            // Add to processed set
            processedReservationIds.add(basicData.reservationId);

            // Get card details
            const guestNameButton = await row.$(
              "td.guestName button.guestNameLink"
            );
            if (!guestNameButton) {
              console.log("Guest name button not found, skipping reservation");
              continue;
            }
            for (let i = 0; i < 3; i++) {
              try {
                //dialog open kortesi
                try {
                  await guestNameButton.click();
                  await delay(1000);
                  await Promise.race([
                    page.waitForSelector(".fds-dialog", {
                      visible: true,
                      timeout: 8000,
                    }),
                    new Promise((_, reject) =>
                      setTimeout(
                        () => reject(new Error("Dialog timeout")),
                        8000
                      )
                    ),
                  ]);
                  // Wait a bit for content to load
                  await delay(2000);
                } catch (error) {
                  console.log(
                    "Dialog did not appear within timeout, skipping to next reservation"
                  );
                  continue;
                }

                // Scroll to the bottom of dialog content and wait
                await page.evaluate(() => {
                  const dialogContent = document.querySelector(
                    ".fds-dialog-content"
                  ) as HTMLElement;
                  if (dialogContent) {
                    dialogContent.scrollTo(0, dialogContent.scrollHeight);
                  }
                });

                // Wait for content to load after scroll
                await delay(2000);

                // Look for the "See card activity" button and click it in a new tab
                try {
                  const seeCardActivityButton = await page.$(
                    ".fds-cell.all-y-gutter-16 button.fds-button2.utility.small"
                  );

                  if (seeCardActivityButton) {
                    console.log(
                      "Found 'See card activity' button, clicking it in a new tab..."
                    );

                    // Get href or onclick URL from the button
                    const buttonUrl = await page.evaluate(() => {
                      const button = document.querySelector(
                        ".fds-cell.all-y-gutter-16 button.fds-button2.utility.small"
                      ) as HTMLElement;
                      if (!button) return null;

                      // Click the button but prevent navigation by returning the URL
                      const originalOpen = window.open;
                      let capturedUrl: string | null = null;

                      // Override window.open temporarily to capture the URL
                      window.open = (url?: string | URL) => {
                        capturedUrl = url?.toString() || null;
                        return { focus: () => {} } as any; // Mock window object
                      };

                      // Simulate click to trigger any onclick handlers
                      button.click();

                      // Restore original window.open
                      window.open = originalOpen;

                      return capturedUrl;
                    });

                    if (buttonUrl) {
                      console.log(
                        `Opening card activity URL in new tab: ${buttonUrl}`
                      );

                      // Get browser from page
                      const browser = page.browser();
                      let newPage: Page | null = null;
                      try {
                        // Create a new page/tab
                        newPage = await browser.newPage();
                        await newPage.goto(buttonUrl, {
                          waitUntil: "networkidle0",
                          timeout: 30000,
                        });

                        console.log("New tab opened for card activity");
                        await delay(5000); // Give more time for the page to fully load

                        // Scrape the remaining balance
                        remainingBalance = await newPage.evaluate(() => {
                          // Try multiple selectors to find the remaining balance
                          const selectors = [
                            ".evc-mock-card-remaining-balance .fds-currency-value",
                            ".remaining-balance .fds-currency-value",
                            '[class*="remaining-balance"] .fds-currency-value',
                            '[class*="balance"] .fds-currency-value',
                            ".fds-currency-value",
                          ];

                          for (const selector of selectors) {
                            const elements =
                              document.querySelectorAll(selector);
                            for (const element of elements) {
                              // Check if parent contains text about balance
                              const parent = element.closest("div");
                              if (
                                parent &&
                                parent.textContent
                                  ?.toLowerCase()
                                  .includes("balance")
                              ) {
                                return element.textContent?.trim() || "";
                              }
                            }
                          }

                          // If we couldn't find a specific balance element, try to get any currency value
                          const anyBalance = document.querySelector(
                            ".fds-currency-value"
                          );
                          return anyBalance
                            ? anyBalance.textContent?.trim() || "N/A"
                            : "N/A";
                        });

                        console.log(
                          `Scraped remaining balance: ${remainingBalance}`
                        );

                        // Take screenshot for debugging if needed
                        // await newPage.screenshot({ path: "card-activity.png" });

                        // Close the new tab
                        if (newPage) {
                          await newPage.close();
                        }
                      } catch (error: any) {
                        if (newPage) {
                          await newPage.close();
                        }
                        console.log(
                          "got error on see card activity tab",
                          error.message
                        );
                      }
                      console.log("Closed card activity tab");
                    } else {
                      console.log(
                        "Could not capture URL from 'See card activity' button, skipping"
                      );
                    }
                  } else {
                    console.log(
                      "'See card activity' button not found, skipping"
                    );
                  }
                } catch (error: any) {
                  console.log(
                    `Error processing card activity: ${error.message}`
                  );
                }

                let additionalText = ""; // New variable to store additional text
                let retries = 0;
                while (retries < 3) {
                  try {
                    // First check for evcCardBase element
                    const hasEvcCard = await page.evaluate(() => {
                      const evcCardBase =
                        document.querySelector(".evcCardBase");
                      if (evcCardBase) {
                        // Get status badge if it exists
                        const statusBadge = evcCardBase.querySelector(
                          ".fds-grid.statusBadge .fds-badge"
                        );
                        return {
                          exists: true,
                          status: statusBadge
                            ? statusBadge.textContent?.trim() || "None"
                            : "None",
                        };
                      }
                      return { exists: false, status: "None" };
                    });

                    if (hasEvcCard.exists) {
                      status = hasEvcCard.status || "None";
                      // Get card details from evcCardBase
                      cardData = await page.evaluate((currentStatus) => {
                        const cardNumber =
                          document
                            .querySelector(
                              ".evcCardBase .cardNumber.replay-conceal bdi"
                            )
                            ?.textContent?.trim() || "";
                        const expiryDate =
                          document
                            .querySelector(
                              ".evcCardBase .cardDetails .fds-cell.all-cell-1-4.fds-type-color-primary.replay-conceal"
                            )
                            ?.textContent?.trim() || "";
                        const cvv =
                          document
                            .querySelectorAll(
                              ".evcCardBase .cardDetails .fds-cell.all-cell-1-4.fds-type-color-primary.replay-conceal"
                            )[1]
                            ?.textContent?.trim() || "";

                        // Get additional text information
                        const additionalTextElements = Array.from(
                          document.querySelectorAll(
                            ".fds-cell.all-y-gutter-12 div, .fds-cell.sidePanelSection, .fds-cell.fds-type-color-attention.fds-grid .fds-cell.all-cell-fill"
                          )
                        );
                        const additionalText = additionalTextElements
                          .map((el) => el.textContent?.trim() || "")
                          .filter(
                            (text) =>
                              text &&
                              !text.includes("See card activity") &&
                              !text.includes("contact us") &&
                              !text.includes("Show contact details")
                          )
                          .join(" | ");

                        if (cardNumber) {
                          return {
                            cardNumber,
                            expiryDate,
                            cvv,
                            status: currentStatus,
                            additionalText,
                          };
                        }
                        return null;
                      }, status);
                    }

                    // Always try to get payment information regardless of card data
                    paymentData = await page.evaluate(() => {
                      // Find all payment summary sections
                      const paymentSummary =
                        document.querySelector(".fds-card-content");
                      if (!paymentSummary) return null;

                      // Helper function to find value by section title
                      const findValueByTitle = (titleText: string) => {
                        const sections = Array.from(
                          paymentSummary.querySelectorAll(".fds-grid")
                        );
                        for (const section of sections) {
                          const title = section.querySelector(
                            ".sidePanelSectionTitle"
                          );
                          if (
                            title &&
                            title.textContent?.trim() === titleText
                          ) {
                            const value = section.querySelector(
                              ".fds-currency-value"
                            );
                            return value ? value.textContent?.trim() || "" : "";
                          }
                        }
                        return "";
                      };

                      // Get all payment values
                      const cancellationFee =
                        findValueByTitle("Cancellation fee");
                      const expediaCompensation = findValueByTitle(
                        "Expedia compensation"
                      );
                      const totalPayout = findValueByTitle("Your total payout");
                      const totalGuestPayment = findValueByTitle(
                        "Total guest payment"
                      );

                      if (
                        cancellationFee ||
                        expediaCompensation ||
                        totalPayout
                      ) {
                        return {
                          totalGuestPayment,
                          cancellationFee,
                          expediaCompensation,
                          totalPayout,
                        };
                      }
                      return null;
                    });

                    // Extract "Remaining amount to charge" and "Amount to refund"
                    const additionalPaymentInfo = await page.evaluate(() => {
                      // Find "Remaining amount to charge"
                      const remainingAmountSection = Array.from(
                        document.querySelectorAll(".fds-cell.sidePanelSection")
                      ).find((section) =>
                        section.textContent?.includes(
                          "Remaining amount to charge"
                        )
                      );

                      const remainingAmount =
                        remainingAmountSection
                          ?.querySelector(".fds-currency-value")
                          ?.textContent?.trim() || "";

                      // Find "Amount to refund"
                      const refundSection = Array.from(
                        document.querySelectorAll(".fds-grid.sidePanelSection")
                      ).find((section) =>
                        section.textContent?.includes("Amount to refund")
                      );

                      const refundAmount =
                        refundSection
                          ?.querySelector(".fds-currency-value")
                          ?.textContent?.trim() || "";

                      return {
                        remainingAmountToCharge: remainingAmount,
                        amountToRefund: refundAmount,
                      };
                    });

                    if (additionalPaymentInfo) {
                      remainingAmountToCharge =
                        additionalPaymentInfo.remainingAmountToCharge;
                      amountToRefund = additionalPaymentInfo.amountToRefund;

                      if (remainingAmountToCharge) {
                        console.log(
                          `Found Remaining amount to charge: ${remainingAmountToCharge}`
                        );
                      }

                      if (amountToRefund) {
                        console.log(
                          `Found Amount to refund: ${amountToRefund}`
                        );
                      }
                    }

                    // Break the loop if we got either card data or payment data
                    if (cardData || paymentData) {
                      break;
                    }

                    retries++;
                    await delay(1000);
                  } catch (e) {
                    retries++;
                    await delay(1000);
                  }
                }

                //////////////////////////////////////////////////////////////
                //close the side panel
                //////////////////////////////////////////////////////////////
                try {
                  const closeButton = await page.$(
                    ".fds-dialog-header button.dialog-close"
                  );
                  if (closeButton) {
                    await closeButton.click();
                    await delay(1500);
                  }
                } catch (e) {
                  console.log("Warning: Could not close dialog normally");
                }
                break;
              } catch (error: any) {
                const closeButton = await page.$(
                  ".fds-dialog-header button.dialog-close"
                );
                if (closeButton) {
                  await closeButton.click();
                  await delay(1500);
                }
                console.log("did't get the data, retrying...", error.message);
              }
            }

            // Add to reservations array with either card data or payment data
            pageReservations.push({
              ...basicData,
              ...(cardData || {}),
              ...(paymentData || {}),
              propertyId: propertyId,
              hasCardInfo: !!cardData,
              hasPaymentInfo: !!paymentData,
              remainingAmountToCharge: remainingAmountToCharge || "N/A",
              amountToRefund: amountToRefund || "N/A",
              amountToChargeOrRefund:
                cardData?.additionalText ||
                remainingAmountToCharge ||
                amountToRefund ||
                "N/A",
              status: status,
              amount: remainingBalance,
            });
          } catch (error: any) {
            console.log(`Error processing reservation: ${error.message}`);
            if (basicData) {
              pageReservations.push({
                ...basicData,
                cardNumber: "N/A",
                expiryDate: "N/A",
                cvv: "N/A",
                remainingAmountToCharge: "N/A",
                amountToRefund: "N/A",
                amountToChargeOrRefund: "N/A",
              });
            }
          }
        }

        console.log(
          `Processed ${pageReservations.length} of ${totalResults} reservations`
        );

        // Check if there's a next page
        hasMore = await hasNextPage();
        if (hasMore) {
          // Scroll down smoothly before clicking next page
          await page.evaluate(() => {
            window.scrollBy({
              top: 300,
              behavior: "smooth",
            });
          });
          await delay(1500); // Wait for scroll animation

          const nextButton = await page.$(".fds-pagination-button.next button");
          if (nextButton) {
            await nextButton.click();
            await delay(2000);
            currentPage++;
          }
        }
      } catch (pageError: any) {
        console.log(
          `Error processing page ${currentPage}: ${pageError.message}`
        );
        // Try to recover by reloading the page
        await page.reload({ waitUntil: "networkidle0" });
        await delay(5000);
      }
    }

    console.log(
      `Date scraping completed for ${start_date} to ${end_date}. Found total ${pageReservations.length} reservations on this tab`
    );

    // Log if no reservations were found for this date range
    if (pageReservations.length === 0) {
      console.log(
        `No reservations found for date range: ${start_date} to ${end_date}. This date range may be missing data.`
      );
    }
    console.log("pageReservations", pageReservations);
    console.log("processedReservationIds", processedReservationIds);
    // return pageReservations;
  } catch (error: any) {
    console.error("Error in scrapeData:", error);
    throw error;
  }
}
