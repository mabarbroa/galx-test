require('dotenv').config();
const TelegramBot = require('node-telegram-bot-api');
const GalxeMonitor = require('./galxe-monitor');

const bot = new TelegramBot(process.env.BOT_TOKEN, { polling: true });
const monitor = new GalxeMonitor(bot);

// Command handlers
bot.onText(/\/start/, (msg) => {
    const chatId = msg.chat.id;
    bot.sendMessage(chatId, `
🚀 *Galxe FCFS Monitor Bot*

Bot ini akan memantau reward FCFS di Galxe dan memberikan notifikasi real-time.

*Commands:*
/monitor - Mulai monitoring
/stop - Stop monitoring  
/status - Cek status monitoring
/add [space_id] - Tambah space untuk dimonitor
/list - List space yang dimonitor
/help - Bantuan

*Format menambah space:*
/add Za7zYyykeFvi9KYGmxWSrb
    `, { parse_mode: 'Markdown' });
});

bot.onText(/\/monitor/, (msg) => {
    const chatId = msg.chat.id;
    monitor.startMonitoring(chatId);
});

bot.onText(/\/stop/, (msg) => {
    const chatId = msg.chat.id;
    monitor.stopMonitoring(chatId);
});

bot.onText(/\/status/, (msg) => {
    const chatId = msg.chat.id;
    monitor.getStatus(chatId);
});

bot.onText(/\/add (.+)/, (msg, match) => {
    const chatId = msg.chat.id;
    const spaceId = match[1];
    monitor.addSpace(chatId, spaceId);
});

bot.onText(/\/list/, (msg) => {
    const chatId = msg.chat.id;
    monitor.listSpaces(chatId);
});

console.log('🤖 Galxe FCFS Monitor Bot started!');
