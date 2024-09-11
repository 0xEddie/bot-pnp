const path = require('path');
const fs = require('fs').promises;
require('dotenv').config();
const puppeteer = require('puppeteer');
const TelegramBot = require('node-telegram-bot-api');

// Config constants
const URL = 'https://www.picknpull.com/check-inventory/vehicle-search?make=147&model=2683&distance=10&zip=T5S1R2&year=';
const RECORD_FILE = path.join(__dirname, 'inventory_record.json');
const LOG_FILE = path.join(__dirname, 'pnp-scraper.log');
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;

/**
 * Log messages with timestamps.
 * @param {string} message - Message to log
 */
async function logMessage(message) {
    const timestamp = new Date().toISOString();
    const logEntry = `${timestamp} - ${message}\n`;
    console.log(logEntry.trim());
    await fs.appendFile(LOG_FILE, logEntry);
}

// Initialize TG bot
if (!process.env.TELEGRAM_BOT_TOKEN) {
    await logMessage('Error: TELEGRAM_BOT_TOKEN is not defined in the .env file.');
    process.exit(1);
}
if (!process.env.TELEGRAM_CHAT_ID) {
    await logMessage('Error: TELEGRAM_CHAT_ID is not defined in the .env file.');
    process.exit(1);
}
const tgBot = new TelegramBot(TELEGRAM_BOT_TOKEN);

/**
 * Scrape the webpage using Puppeteer
 * @returns {Promise<Array>} Array of inventory items
 */
async function scrapeWebpage() {
    try {
        await logMessage("Launching Puppeteer.");
        const browser = await puppeteer.launch({
            headless: true,
            args: ['--no-sandbox', '--disable-setuid-sandbox']
        });

        const page = await browser.newPage();

        await logMessage("Navigating to URL, waiting for table data to load...");
        await page.goto(URL, { waitUntil: 'networkidle0' });

        await page.waitForSelector('table', { timeout: 10000 });

        const results = await page.evaluate(() => {
            const rows = Array.from(document.querySelectorAll('table tbody tr'));
            return rows.map(row => {
                const columns = row.querySelectorAll('td');
                return {
                    id: columns[0].textContent.trim(),
                    make: columns[1].textContent.trim(),
                    model: columns[2].textContent.trim(),
                    year: columns[3].textContent.trim(),
                    color: columns[4].textContent.trim(),
                    location: columns[5].textContent.trim(),
                    dateAdded: columns[6].textContent.trim()
                };
            });
        });

        await browser.close();
        await logMessage("Successfully scraped data from the webpage.");
        return results;

    } catch (error) {
        await logMessage(`Error scraping webpage: ${error.message}`);
        throw error;
    }
}

/**
 * Loads the previous inventory record from a file
 * @returns {Promise<Array>} Array of previous inventory items
 */
async function loadRecord() {
    try {
        await logMessage("Loading previous inventory record.");
        const data = await fs.readFile(RECORD_FILE, 'utf8');
        return JSON.parse(data);
    } catch (error) {
        if (error.code === 'ENOENT') {
            await logMessage("No previous record found. Creating a new one.");
            return [];
        }
        await logMessage(`Error loading inventory record: ${error.message}`);
        throw error;
    }
}

/**
 * Saves the current inventory record to a file
 * @param {Array} record - Current inventory items
 */
async function saveRecord(record) {
    try {
        await logMessage("Saving new inventory record.");
        await fs.writeFile(RECORD_FILE, JSON.stringify(record, null, 2));
        await logMessage("Inventory record saved successfully.");
    } catch (error) {
        await logMessage(`Error saving inventory record: ${error.message}`);
        throw error;
    }
}

/**
 * Sends a message via Telegram
 * @param {string} message - Message to send
 */
async function sendTelegramMessage(message) {
    try {
        await logMessage("Sending Telegram notification.");
        await tgBot.sendMessage(TELEGRAM_CHAT_ID, message);
        await logMessage("Telegram message sent successfully.");
    } catch (error) {
        await logMessage(`Error sending Telegram message: ${error.message}`);
        throw error;
    }
}

/**
 * Main function to run the inventory check
 */
async function main() {
    try {
        await logMessage("Starting inventory check.");

        // Scrape the current inventory
        const currentInventory = await scrapeWebpage();

        // Find new inventory by comparing current results with previous record
        const previousInventory = await loadRecord();
        const newEntries = currentInventory.filter(
            newEntry => !previousInventory.some(previousEntry => previousEntry.id === newEntry.id)
        );

        if (newEntries.length > 0) {
            // Save the updated record
            await logMessage(`Found ${newEntries.length} new entries. Updating record.`);
            await saveRecord(currentInventory);

            // Send Telegram inventory update message
            const message = `🤩 Found ${newEntries.length} new Hyundai Accents:\n` +
                newEntries.map(entry => `🚙 Date Added: ${entry.dateAdded}, Year: ${entry.year}, Colour: ${entry.color}, Row: ${entry.row}`).join('\n');

            await sendTelegramMessage(message);
        } else {
            await logMessage("No new entries found.");
        }

        await logMessage("Inventory check completed.");

    } catch (error) {
        await logMessage(`An error occurred during the inventory check: ${error.message}`);
    }
}

// Run the main function
main();
