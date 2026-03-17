import { chromium } from "playwright";

(async () => {
  const browser = await chromium.launch({ headless: true });
  const ownerContext = await browser.newContext();
  const guestContext = await browser.newContext();

  const ownerPage = await ownerContext.newPage();
  const guestPage = await guestContext.newPage();

  // 1. Owner logs in and creates a board
  await ownerPage.goto("http://localhost:3000/login");
  await ownerPage.fill("input[type='email']", "kunal@gmail.com");
  await ownerPage.fill("input[type='password']", "Kr1shna@");
  await ownerPage.click("button:has-text('Sign in')");
  
  await ownerPage.waitForURL("http://localhost:3000/");
  console.log("Owner logged in");

  await ownerPage.click("text=New Board");
  await ownerPage.waitForURL(/\/board\/.+/);
  const boardUrl = ownerPage.url();
  console.log("Owner created board:", boardUrl);

  // 2. Guest opens the same board
  guestPage.on('framenavigated', frame => {
    if (frame === guestPage.mainFrame()) {
      console.log("GUEST PAGE NAVIGATED/RELOADED:", frame.url());
    }
  });

  await guestPage.goto(boardUrl);
  await guestPage.waitForSelector("canvas");
  console.log("Guest joined board");

  await guestPage.waitForTimeout(2000);

  console.log("Owner toggling lock...");
  await ownerPage.click("button[title='Lock board to prevent collaborators from drawing']");

  await guestPage.waitForTimeout(2000);
  
  if (await guestPage.locator("text=Board is locked by the owner").isVisible()) {
    console.log("Guest saw lock banner");
  } else {
    console.log("Guest did NOT see lock banner");
  }

  console.log("Owner toggling unlock...");
  await ownerPage.click("button[title='Unlock board for collaborators']");

  await guestPage.waitForTimeout(2000);

  if (!(await guestPage.locator("text=Board is locked by the owner").isVisible())) {
    console.log("Guest lock banner removed");
  } else {
    console.log("Guest lock banner still visible");
  }

  await browser.close();
  console.log("Done");
})();
