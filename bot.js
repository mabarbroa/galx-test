require('dotenv').config();
const TelegramBot = require('node-telegram-bot-api');
const GalxeMonitor = require('./galxe-monitor');
const Database = require('./utils/database');
const Helpers = require('./utils/helpers');

const bot = new TelegramBot(process.env.BOT_TOKEN, { polling: true });
const db = new Database();
const monitor = new GalxeMonitor(bot, db);

// Error handler
bot.on('error', (error) => {
    Helpers.handleError(error, 'Bot Error');
});

bot.on('polling_error', (error) => {
    Helpers.handleError(error, 'Polling Error');
});

// Command handlers
bot.onText(/\/start/, async (msg) => {
    const chatId = msg.chat.id;
    
    try {
        // Add chat to database
        await db.addMonitoringChat(chatId);
        
        bot.sendMessage(chatId, `
🚀 *Galxe FCFS Monitor Bot*

Bot ini akan memantau reward FCFS di Galxe dan memberikan notifikasi real-time.

*Commands:*
/monitor - Mulai monitoring
/stop - Stop monitoring  
/status - Cek status monitoring
/add [space_id] - Tambah space untuk dimonitor
/remove [space_id] - Hapus space dari monitoring
/list - List space yang dimonitor
/stats - Statistik bot
/help - Bantuan lengkap

*Format menambah space:*
/add Za7zYyykeFvi9KYGmxWSrb

*Format dari URL:*
/add https://app.galxe.com/quest/Za7zYyykeFvi9KYGmxWSrb/GCahatmQxo

Silakan mulai dengan menambah space yang ingin dimonitor!
        `, { parse_mode: 'Markdown' });
    } catch (error) {
        Helpers.handleError(error, 'Start command');
        bot.sendMessage(chatId, '❌ Terjadi error saat memulai bot. Silakan coba lagi.');
    }
});

bot.onText(/\/help/, (msg) => {
    const chatId = msg.chat.id;
    
    const helpMessage = `
📚 *Bantuan Lengkap - Galxe FCFS Monitor*

*🎯 Cara Menggunakan:*
1. Mulai dengan /start
2. Tambah space dengan /add [space_id]
3. Mulai monitoring dengan /monitor
4. Bot akan kirim notifikasi otomatis!

*📋 Semua Commands:*
/start - Mulai bot dan daftar ke sistem
/help - Bantuan lengkap ini
/add [space_id] - Tambah space untuk monitoring
/remove [space_id] - Hapus space dari monitoring
/list - Lihat semua space yang dimonitor
/monitor - Mulai monitoring FCFS rewards
/stop - Stop monitoring
/status - Lihat status monitoring
/stats - Statistik penggunaan bot

*🔍 Format Space ID:*
- Manual: /add Za7zYyykeFvi9KYGmxWSrb
- Dari URL: /add https://app.galxe.com/quest/Za7zYyykeFvi9KYGmxWSrb/xxx

*⚡ Fitur Bot:*
✅ Real-time monitoring setiap 30 detik
✅ Deteksi otomatis FCFS campaigns
✅ Notifikasi instant dengan link langsung
✅ Multi-space monitoring
✅ Database persistent
✅ Error handling & recovery

*🛠️ Troubleshooting:*
- Bot tidak response? Restart dengan /start
- Tidak ada notifikasi? Cek dengan /status
- Error? Bot akan auto-recovery

*💡 Tips:*
- Monitor maksimal 10 space per chat
- Bot cek setiap 30 detik untuk update terbaru
- Notifikasi dikirim instant saat ada FCFS baru
- Gunakan /stats untuk lihat performa bot

Butuh bantuan? Contact developer atau cek status di /stats
    `;
    
    bot.sendMessage(chatId, helpMessage, { parse_mode: 'Markdown' });
});

bot.onText(/\/monitor/, async (msg) => {
    const chatId = msg.chat.id;
    await monitor.startMonitoring(chatId);
});

bot.onText(/\/stop/, async (msg) => {
    const chatId = msg.chat.id;
    await monitor.stopMonitoring(chatId);
});

bot.onText(/\/status/, async (msg) => {
    const chatId = msg.chat.id;
    await monitor.getStatus(chatId);
});

bot.onText(/\/add (.+)/, async (msg, match) => {
    const chatId = msg.chat.id;
    let input = match[1].trim();
    
    // Extract space ID from URL if provided
    if (input.startsWith('http')) {
        const extractedId = Helpers.extractSpaceIdFromUrl(input);
        if (extractedId) {
            input = extractedId;
        } else {
            bot.sendMessage(chatId, '❌ Format URL tidak valid. Gunakan format: https://app.galxe.com/quest/SPACE_ID/...');
            return;
        }
    }
    
    // Validate space ID
    if (!Helpers.isValidSpaceId(input)) {
        bot.sendMessage(chatId, '❌ Format Space ID tidak valid. Space ID harus 15-25 karakter alphanumerik.');
        return;
    }
    
    await monitor.addSpace(chatId, input);
});

bot.onText(/\/remove (.+)/, async (msg, match) => {
    const chatId = msg.chat.id;
    const spaceId = match[1].trim();
    await monitor.removeSpace(chatId, spaceId);
});

bot.onText(/\/list/, async (msg) => {
    const chatId = msg.chat.id;
    await monitor.listSpaces(chatId);
});

bot.onText(/\/stats/, async (msg) => {
    const chatId = msg.chat.id;
    await monitor.getStats(chatId);
});

// Handle any text that might be a space ID or URL
bot.on('message', async (msg) => {
    if (msg.text && !msg.text.startsWith('/')) {
        const chatId = msg.chat.id;
        const text = msg.text.trim();
        
        // Check if it's a Galxe URL
        if (text.includes('app.galxe.com/quest/')) {
            const spaceId = Helpers.extractSpaceIdFromUrl(text);
            if (spaceId && Helpers.isValidSpaceId(spaceId)) {
                bot.sendMessage(chatId, 
                    `🔍 Terdeteksi Galxe URL!\n\nSpace ID: \`${spaceId}\`\n\nIngin menambahkannya untuk monitoring? Gunakan:\n/add ${spaceId}`,
                    { parse_mode: 'Markdown' }
                );
            }
        }
        // Check if it looks like a space ID
        else if (Helpers.isValidSpaceId(text)) {
            bot.sendMessage(chatId, 
                `🔍 Terdeteksi Space ID!\n\nSpace ID: \`${text}\`\n\nIngin menambahkannya untuk monitoring? Gunakan:\n/add ${text}`,
                { parse_mode: 'Markdown' }
            );
        }
    }
});

// Graceful shutdown
process.on('SIGINT', () => {
    Helpers.log('Shutting down bot...');
    monitor.cleanup();
    db.close();
    process.exit(0);
});

process.on('SIGTERM', () => {
    Helpers.log('Shutting down bot...');
    monitor.cleanup();
    db.close();
    process.exit(0);
});

Helpers.log('🤖 Galxe FCFS Monitor Bot started successfully!');
console.log('Bot is running... Press Ctrl+C to stop.');
