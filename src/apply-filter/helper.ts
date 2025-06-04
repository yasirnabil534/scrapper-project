import { Page } from "puppeteer";

const calculateMonthsToNavigate = (
  currentMonth: string,
  currentYear: string,
  targetMonth: string,
  targetYear: string,
  months: Record<string, number>
): number => {
  // Convert years to months since epoch
  const currentMonthsSinceEpoch =
    parseInt(currentYear) * 12 + months[currentMonth];
  const targetMonthsSinceEpoch =
    parseInt(targetYear) * 12 + months[targetMonth];

  // The difference is how many months we need to navigate
  return currentMonthsSinceEpoch - targetMonthsSinceEpoch;
};

export async function setDateRange(
  page: Page,
  start_date: string,
  end_date: string
) {
  try {
    // The input dates from URL are in MM/DD/YYYY format
    // We need to convert them to DD/MM/YYYY format for Expedia interface

    // Convert from MM/DD/YYYY (URL format) to DD/MM/YYYY (Expedia format)
    const convertUrlToExpediaFormat = (dateStr: string) => {
      // Input is in MM/DD/YYYY format from URL
      const [month, day, year] = dateStr.split("/");
      // Return in DD/MM/YYYY format for Expedia interface
      return `${day.padStart(2, "0")}/${month.padStart(2, "0")}/${year}`;
    };

    // Convert from MM/DD/YYYY (URL format) to internal processing format
    const convertUrlToInternalFormat = (dateStr: string) => {
      // Input is in MM/DD/YYYY format from URL - keep it as is for internal processing
      return dateStr;
    };

    // Convert URL dates to internal format (MM/DD/YYYY) for processing
    const internalStartDate = convertUrlToInternalFormat(start_date);
    const internalEndDate = convertUrlToInternalFormat(end_date);

    // Format date with leading zeros - keeping MM/DD/YYYY format for internal use
    const formatDateWithZeros = (dateStr: string) => {
      // Input is in MM/DD/YYYY format (internal format)
      const [month, day, year] = dateStr.split("/");
      const paddedDay = day.padStart(2, "0");
      const paddedMonth = month.padStart(2, "0");
      // console.log("Month:", month);
      // console.log("Day:", day);
      // console.log("Year:", year);
      // console.log("padded month", paddedMonth);
      // console.log("padded day", paddedDay);

      // Return in MM/DD/YYYY format to maintain consistency
      return `${paddedMonth}/${paddedDay}/${year}`;
    };

    // Format date without leading zeros - keeping MM/DD/YYYY format
    const formatDateWithoutZeros = (dateStr: string) => {
      // Input is in MM/DD/YYYY format (internal format)
      const [month, day, year] = dateStr.split("/");
      return `${parseInt(month)}/${parseInt(day)}/${year}`;
    };
    // Convert input dates to both formats
    const expectedFromDateWithZeros = formatDateWithZeros(internalStartDate);
    const expectedToDateWithZeros = formatDateWithZeros(internalEndDate);
    const expectedFromDateWithoutZeros =
      formatDateWithoutZeros(internalStartDate);
    const expectedToDateWithoutZeros = formatDateWithoutZeros(internalEndDate);

    // console.log(
    //   "Converting from date:",
    //   start_date,
    //   "to:",
    //   expectedFromDateWithZeros
    // );
    // console.log(
    //   "Converting to date:",
    //   end_date,
    //   "to:",
    //   expectedToDateWithZeros
    // );

    // Click the From date input to open calendar
    const fromDateInput = await page.$(
      ".from-input-label input.fds-field-input"
    );
    if (!fromDateInput) {
      throw new Error("From date input not found");
    }
    await fromDateInput.click();
    await new Promise((r) => setTimeout(r, 1000));

    // Step 1: Get current year and month from first calendar
    const firstMonthHeader = await page.$eval(
      ".first-month h2",
      (el) => el.textContent?.trim() || ""
    );
    const [currentMonth, currentYear] = firstMonthHeader.split(" ");
    // Convert MM/DD/YYYY to a format JavaScript can parse correctly
    const [month, day, year] = internalStartDate.split("/");
    const targetDate = new Date(`${year}-${month}-${day}`);
    const targetYear = targetDate.getFullYear();
    const targetMonth = targetDate.toLocaleString("en-US", { month: "long" });
    // Validate year
    if (targetYear > parseInt(currentYear)) {
      throw new Error("Target year is greater than current year");
    }

    // Calculate months to navigate for start date
    const totalMonthsToNavigate = calculateMonthsToNavigate(
      currentMonth,
      currentYear,
      targetMonth,
      targetYear.toString(),
      {
        January: 1,
        February: 2,
        March: 3,
        April: 4,
        May: 5,
        June: 6,
        July: 7,
        August: 8,
        September: 9,
        October: 10,
        November: 11,
        December: 12,
      }
    );

    console.log("Total months to navigate (start):", totalMonthsToNavigate);

    // Navigate months for start date
    const navigationButtons = await page.$$(
      ".fds-datepicker-navigation button"
    );
    const navigationButton =
      totalMonthsToNavigate > 0
        ? navigationButtons[0] // prev button for going back in time
        : navigationButtons[1]; // next button for going forward

    if (!navigationButton) {
      throw new Error("Navigation button not found");
    }

    for (let i = 0; i < Math.abs(totalMonthsToNavigate); i++) {
      await navigationButton.click();
      await new Promise((r) => setTimeout(r, 200));
    }

    // Select day (day - 1 for index)
    const targetDay = targetDate.getDate();
    await page.evaluate((day) => {
      const dayButtons = document.querySelectorAll(
        ".first-month .fds-datepicker-day"
      );
      const dayIndex = day - 1;
      const dayButton = dayButtons[dayIndex] as HTMLElement;
      if (dayButton && !(dayButton as any).disabled) {
        dayButton.click();
      }
    }, targetDay);

    // Handle end date selection
    await new Promise((r) => setTimeout(r, 1000));

    // Wait for and click the To date input
    await page.waitForSelector(".to-input-label input.fds-field-input", {
      visible: true,
    });
    const toDateInput = await page.$(".to-input-label input.fds-field-input");
    if (!toDateInput) {
      throw new Error("To date input not found");
    }
    await page.evaluate((el) => (el as HTMLElement).click(), toDateInput);
    await new Promise((r) => setTimeout(r, 1000));

    // Make sure calendar is visible before proceeding
    await page.waitForSelector(".second-month h2", { visible: true });

    const secondMonthHeader = await page.$eval(
      ".second-month h2",
      (el) => el.textContent?.trim() || ""
    );
    console.log("Second month header:", secondMonthHeader);

    const [endCurrentMonth, endCurrentYear] = secondMonthHeader.split(" ");
    // Convert MM/DD/YYYY to a format JavaScript can parse correctly
    const [endMonth, endDay, endYear] = internalEndDate.split("/");
    const endDate = new Date(`${endYear}-${endMonth}-${endDay}`);
    const endTargetYear = endDate.getFullYear();
    const endTargetMonth = endDate.toLocaleString("en-US", { month: "long" });

    // Calculate months to navigate for end date
    const endTotalMonthsToNavigate = calculateMonthsToNavigate(
      endCurrentMonth,
      endCurrentYear,
      endTargetMonth,
      endTargetYear.toString(),
      {
        January: 1,
        February: 2,
        March: 3,
        April: 4,
        May: 5,
        June: 6,
        July: 7,
        August: 8,
        September: 9,
        October: 10,
        November: 11,
        December: 12,
      }
    );

    // Make sure navigation buttons are visible
    await page.waitForSelector(".fds-datepicker-navigation button", {
      visible: true,
    });
    const navigationButtonsEnd = await page.$$(
      ".fds-datepicker-navigation button"
    );

    // Navigate to end date month
    const endNavigationButton =
      endTotalMonthsToNavigate > 0
        ? navigationButtonsEnd[0] // prev button for going back in time
        : navigationButtonsEnd[1]; // next button for going forward

    if (!endNavigationButton) {
      throw new Error("End navigation button not found");
    }

    // Click navigation button with evaluation
    for (let i = 0; i < Math.abs(endTotalMonthsToNavigate); i++) {
      await page.evaluate(
        (button) => (button as HTMLElement).click(),
        endNavigationButton
      );
      await new Promise((r) => setTimeout(r, 200));
    }

    // Select end day with evaluation
    const endTargetDay = endDate.getDate();
    await page.evaluate((day) => {
      const dayButtons = document.querySelectorAll(
        ".second-month .fds-datepicker-day"
      );
      const dayIndex = day - 1;
      const dayButton = dayButtons[dayIndex] as HTMLElement;
      if (dayButton && !(dayButton as any).disabled) {
        dayButton.click();
      } else {
        throw new Error("End date day button not found or disabled");
      }
    }, endTargetDay);

    await new Promise((r) => setTimeout(r, 1000));

    // Click done button
    await page.evaluate(() => {
      const doneButton = document.querySelector(
        ".fds-dropdown-footer button"
      ) as HTMLElement;
      if (doneButton) {
        doneButton.click();
      } else {
        throw new Error("Done button not found");
      }
    });
    await new Promise((r) => setTimeout(r, 1000));

    // Verify dates were set
    const fromValue = await page.$eval(
      ".from-input-label input.fds-field-input",
      (el) => (el as HTMLInputElement).value
    );
    const toValue = await page.$eval(
      ".to-input-label input.fds-field-input",
      (el) => (el as HTMLInputElement).value
    );

    // Convert URL dates to DD/MM/YYYY format for comparison with Expedia's interface
    const expectedFromDateExpediaFormat = convertUrlToExpediaFormat(start_date);
    const expectedToDateExpediaFormat = convertUrlToExpediaFormat(end_date);

    // Compare with expected dates in Expedia format (DD/MM/YYYY)
    const fromMatches = fromValue === expectedFromDateExpediaFormat;
    const toMatches = toValue === expectedToDateExpediaFormat;

    if (!fromMatches || !toMatches) {
      await page.evaluate(
        (dates) => {
          const [startDateStr, endDateStr] = dates;
          // Parse dates - input is in MM/DD/YYYY format from URL
          const [startMonth, startDay, startYear] = startDateStr.split("/");
          const [endMonth, endDay, endYear] = endDateStr.split("/");

          // Re-open the date picker
          const fromInput = document.querySelector(
            ".from-input-label input.fds-field-input"
          ) as HTMLElement;
          if (fromInput) {
            fromInput.click();
          }

          // Wait a bit and try to select dates again
          setTimeout(() => {
            // Get all days from both months
            const allDays = document.querySelectorAll(".fds-datepicker-day");

            // Convert to array for easier manipulation
            const daysArray = Array.from(allDays) as HTMLElement[];

            // Find start and end dates considering both months
            const startDateElement = daysArray.find(
              (el) =>
                el.textContent?.trim() === startDay &&
                !el.classList.contains("disabled")
            );

            const endDateElement = daysArray.find(
              (el) =>
                el.textContent?.trim() === endDay &&
                !el.classList.contains("disabled") &&
                (!startDateElement ||
                  el.compareDocumentPosition(startDateElement) === 4)
            );

            if (startDateElement && endDateElement) {
              startDateElement.click();
              // Add delay between clicks to ensure proper state updates
              setTimeout(() => {
                endDateElement.click();
                // Verify date selection before closing
                setTimeout(() => {
                  const selectedStartInput = document.querySelector(
                    ".from-input-label input.fds-field-input"
                  ) as HTMLInputElement;
                  const selectedEndInput = document.querySelector(
                    ".to-input-label input.fds-field-input"
                  ) as HTMLInputElement;

                  const selectedStart = selectedStartInput?.value;
                  const selectedEnd = selectedEndInput?.value;

                  if (selectedStart && selectedEnd) {
                    const doneButton = document.querySelector(
                      ".fds-dropdown-footer button"
                    ) as HTMLElement;
                    if (doneButton) doneButton.click();
                  }
                }, 1000);
              }, 1000);
            }
          }, 1000);
        },
        [start_date, end_date]
      );

      // Wait for the final correction to complete
      await new Promise((r) => setTimeout(r, 2000));
    }

    return { from: fromValue, to: toValue };
  } catch (error) {
    console.error("Error setting date range:", error);
    throw error;
  }
}
