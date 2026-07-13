import puppeteer from 'puppeteer';
import fs from 'fs';

async function run() {
  const browser = await puppeteer.launch({ headless: 'new' });
  const page = await browser.newPage();
  
  // Set up console logging
  page.on('console', msg => console.log('PAGE LOG:', msg.text()));

  console.log("Navigating to http://localhost:3000");
  await page.goto('http://localhost:3000', { waitUntil: 'networkidle0' });

  console.log("Checking if data loaded...");
  // Wait for title or something indicating it loaded
  await page.waitForSelector('.card-title');
  const homeTitle = await page.$eval('.card-title', el => el.textContent);
  console.log("Home Title:", homeTitle);

  // Navigate to Betting View
  console.log("Navigating to Apuestas...");
  await page.click('nav ul li a[href="#/betting"]');
  await page.waitForSelector('#participant-select');

  // Select participant
  console.log("Selecting juan...");
  await page.select('#participant-select', 'juan');
  
  // Wait for form to appear
  await page.waitForSelector('#betting-form');

  console.log("Form is visible.");

  // Test Error 1: Bad PIN
  console.log("Testing bad PIN...");
  if (await page.$('#pin-input')) {
    await page.type('#pin-input', '9999');
  }
  await page.type('input[data-team="home"]', '2');
  await page.type('input[data-team="away"]', '1');
  
  await page.click('#btn-submit-bets');
  await page.waitForFunction(() => !document.querySelector('#btn-submit-bets').disabled);
  console.log("Wait after bad PIN finished.");
  // Assuming toast shows up
  await new Promise(r => setTimeout(r, 1000));

  // Test Valid Save
  console.log("Testing valid save...");
  await page.evaluate(() => document.querySelector('#pin-input').value = '');
  await page.type('#pin-input', '1234');
  await page.click('#btn-submit-bets');
  
  // wait for success and reload
  await new Promise(r => setTimeout(r, 3000));

  console.log("Done testing valid save.");
  
  await browser.close();
}

run().catch(e => {
  console.error(e);
  process.exit(1);
});
