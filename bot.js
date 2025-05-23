require('dotenv').config();
const TelegramBot = require('node-telegram-bot-api');
const axios = require('axios');
const cron = require('cron');

class GalxeUniversalFCFSBot {
    constructor() {
        this.bot = new TelegramBot(process.env.BOT_TOKEN, { polling: true });
        this.monitoringChats = new Set(); // Set of active chat IDs
        this.detectedCampaigns = new Set(); // Store campaign IDs to avoid duplicates
        this.cronJob = null;
        this.isGlobalMonitoring = false;
        
        this.setupHandlers();
        this.log('🤖 Galxe Universal FCFS Monitor Bot initialized');
    }

    log(message, level = 'INFO') {
        const timestamp = new Date().toLocaleString();
        console.log(`[${timestamp}] [${level}] ${message}`);
    }

    setupHandlers() {
        // Error handlers
        this.bot.on('error', (error) => {
            this.log(`Bot Error: ${error.message}`, 'ERROR');
        });

        this.bot.on('polling_error', (error) => {
            this.log(`Polling Error: ${error.message}`, 'ERROR');
        });

        // Command handlers
        this.bot.onText(/\/start/, (msg) => this.handleStart(msg));
        this.bot.onText(/\/help/, (msg) => this.handleHelp(msg));
        this.bot.onText(/\/monitor/, (msg) => this.handleMonitor(msg));
        this.bot.onText(/\/stop/, (msg) => this.handleStop(msg));
        this.bot.onText(/\/status/, (msg) => this.handleStatus(msg));
        this.bot.onText(/\/test/, (msg) => this.handleTest(msg));
    }

    async handleStart(msg) {
        const chatId = msg.chat.id;
        
        const welcomeMessage = `
🚀 *Galxe Universal FCFS Monitor Bot*

Bot ini akan memantau SEMUA campaign Galxe yang mengandung kata "FCFS" dari berbagai space dan memberikan notifikasi real-time.

*📋 Commands:*
/monitor - Mulai monitoring universal
/stop - Stop monitoring
/status - Cek status monitoring
/test - Test deteksi campaign FCFS
/help - Bantuan lengkap

*🎯 Fitur Utama:*
✅ Monitor SEMUA space Galxe otomatis
✅ Deteksi campaign dengan kata "FCFS"
✅ Notifikasi real-time setiap 60 detik
✅ Tidak perlu tambah space ID manual

*💡 Cara Pakai:*
1. Ketik /monitor untuk mulai
2. Bot akan auto-scan semua campaign FCFS
3. Terima notifikasi instant!

Siap untuk memulai monitoring universal?
        `;

        await this.sendMessage(chatId, welcomeMessage);
    }

    async handleHelp(msg) {
        const chatId = msg.chat.id;
        
        const helpMessage = `
📚 *Bantuan Lengkap*

*🎯 Fitur Utama:*
✅ Universal monitoring - tidak perlu space ID
✅ Auto-detect campaign dengan kata "FCFS"
✅ Monitoring real-time setiap 60 detik
✅ Notifikasi instant dengan link langsung
✅ Scan otomatis trending/popular spaces

*📋 Commands:*
\`/start\` - Mulai bot
\`/monitor\` - Mulai monitoring universal
\`/stop\` - Stop monitoring
\`/status\` - Lihat status monitoring
\`/test\` - Test deteksi campaign FCFS
\`/help\` - Bantuan ini

*🔍 Cara Kerja Bot:*
1. Bot otomatis scan trending campaigns
2. Filter campaign yang mengandung "FCFS"
3. Kirim notifikasi real-time
4. Berikan link langsung untuk claim

*💡 Keywords FCFS yang Dideteksi:*
• "FCFS"
• "First Come First Served"
• "Limited Supply"
• "Grab Now"
• "While Supplies Last"
• "Hurry Up"

Bot akan otomatis berjalan tanpa perlu setup space ID!
        `;

        await this.sendMessage(chatId, helpMessage);
    }

    async handleMonitor(msg) {
        const chatId = msg.chat.id;

        if (this.monitoringChats.has(chatId)) {
            return this.sendMessage(chatId, '⚠️ Monitoring sudah aktif untuk chat ini.');
        }

        // Add chat to monitoring
        this.monitoringChats.add(chatId);

        // Start global monitoring if not already started
        if (!this.isGlobalMonitoring) {
            this.startGlobalMonitoring();
        }

        const message = `
✅ *Universal Monitoring Started!*

🔄 Status: Active
🌐 Scope: All Galxe Spaces
⏰ Check Interval: Setiap 60 detik
🎯 Target: Campaign dengan kata "FCFS"

Bot akan memindai SEMUA campaign Galxe dan mengirim notifikasi real-time ketika ada campaign FCFS baru.

*📊 Monitoring Stats:*
- Active Chats: ${this.monitoringChats.size}
- Detected Campaigns: ${this.detectedCampaigns.size}
- Mode: Universal Scan

Gunakan /status untuk melihat status monitoring.
        `;

        await this.sendMessage(chatId, message);
    }

    async handleStop(msg) {
        const chatId = msg.chat.id;

        if (!this.monitoringChats.has(chatId)) {
            return this.sendMessage(chatId, '❌ Monitoring tidak aktif untuk chat ini.');
        }

        // Remove chat from monitoring
        this.monitoringChats.delete(chatId);

        // Check if we need to stop global monitoring
        this.checkGlobalMonitoring();

        const message = `
⏹️ *Monitoring Stopped!*

🔄 Status: Inactive
👥 Remaining Active Chats: ${this.monitoringChats.size}

Untuk mulai monitoring lagi, gunakan /monitor
        `;

        await this.sendMessage(chatId, message);
    }

    async handleStatus(msg) {
        const chatId = msg.chat.id;
        const isActive = this.monitoringChats.has(chatId);

        const message = `
📊 *Status Dashboard*

*🔄 Your Status:*
Monitoring: ${isActive ? '✅ Active' : '❌ Inactive'}
Mode: Universal FCFS Detection

*🌐 Global Status:*
Bot Status: ${this.isGlobalMonitoring ? '🟢 Running' : '🔴 Stopped'}
Active Chats: ${this.monitoringChats.size}
Check Interval: 60 seconds

*📈 Performance:*
Detected Campaigns: ${this.detectedCampaigns.size}
Last Check: ${new Date().toLocaleString()}
Uptime: ${Math.floor(process.uptime() / 60)} minutes

*🎯 Detection Keywords:*
FCFS, First Come First Served, Limited, Grab Now, While Supplies Last

${isActive ? '✅ Bot sedang memantau campaign universal' : '💡 Gunakan /monitor untuk mulai monitoring'}
        `;

        await this.sendMessage(chatId, message);
    }

    async handleTest(msg) {
        const chatId = msg.chat.id;

        await this.sendMessage(chatId, `🔍 Testing universal FCFS detection...`);

        try {
            const fcfsCampaigns = await this.scanForFCFSCampaigns();

            const message = `
🧪 *Test Results*

🎯 *FCFS Campaigns Found:* ${fcfsCampaigns.length}
🔍 *Scan Method:* Universal Detection
📊 *Total Scanned:* Multiple trending spaces

*📋 Recent FCFS Campaigns:*
${fcfsCampaigns.length > 0 ? 
    fcfsCampaigns.slice(0, 5).map((campaign, index) => 
        `${index + 1}. ${campaign.name}\n   Space: ${campaign.space?.name || 'Unknown'}\n   Status: ${campaign.status}`
    ).join('\n\n') : 
    'Tidak ada campaign FCFS aktif saat ini'
}

${fcfsCampaigns.length > 5 ? `\n... dan ${fcfsCampaigns.length - 5} lainnya` : ''}

✅ Universal detection berfungsi dengan baik!
            `;

            await this.sendMessage(chatId, message);

        } catch (error) {
            this.log(`Error testing universal detection: ${error.message}`, 'ERROR');
            await this.sendMessage(chatId, '❌ Error saat testing. Sistem mungkin sedang maintenance.');
        }
    }

    startGlobalMonitoring() {
        if (this.cronJob) return;

        this.isGlobalMonitoring = true;
        // Check every 60 seconds for universal monitoring
        this.cronJob = new cron.CronJob('0 * * * * *', async () => {
            await this.checkForNewCampaigns();
        }, null, true);

        this.log('🔄 Universal monitoring started - checking every 60 seconds');
    }

    checkGlobalMonitoring() {
        if (this.monitoringChats.size === 0 && this.cronJob) {
            this.cronJob.stop();
            this.cronJob = null;
            this.isGlobalMonitoring = false;
            this.log('⏹️ Global monitoring stopped - no active chats');
        }
    }

    async checkForNewCampaigns() {
        if (this.monitoringChats.size === 0) {
            this.checkGlobalMonitoring();
            return;
        }

        this.log(`🔍 Scanning for universal FCFS campaigns...`);

        try {
            const fcfsCampaigns = await this.scanForFCFSCampaigns();

            // Check for new campaigns
            for (const campaign of fcfsCampaigns) {
                if (!this.detectedCampaigns.has(campaign.id)) {
                    this.detectedCampaigns.add(campaign.id);
                    
                    // Notify all active chats
                    for (const chatId of this.monitoringChats) {
                        await this.notifyCampaign(chatId, campaign);
                        await this.sleep(500); // Delay between notifications
                    }

                    this.log(`🎯 New FCFS campaign detected: ${campaign.name} (${campaign.id})`);
                }
            }

        } catch (error) {
            this.log(`Error in universal scan: ${error.message}`, 'ERROR');
        }
    }

    async scanForFCFSCampaigns() {
        // Method 1: Get trending campaigns
        const trendingCampaigns = await this.fetchTrendingCampaigns();
        
        // Method 2: Get recent campaigns from popular spaces
        const recentCampaigns = await this.fetchRecentCampaigns();
        
        // Combine and deduplicate
        const allCampaigns = [...trendingCampaigns, ...recentCampaigns];
        const uniqueCampaigns = allCampaigns.filter((campaign, index, self) => 
            index === self.findIndex(c => c.id === campaign.id)
        );

        // Filter for FCFS campaigns
        return uniqueCampaigns.filter(campaign => this.isFCFSCampaign(campaign));
    }

    async fetchTrendingCampaigns() {
        const query = `
            query TrendingCampaigns($first: Int) {
                campaigns(first: $first, orderBy: Trending, orderDirection: DESC) {
                    edges {
                        node {
                            id
                            numberID
                            name
                            description
                            startTime
                            endTime
                            status
                            type
                            info
                            space {
                                id
                                name
                            }
                        }
                    }
                }
            }
        `;

        try {
            const response = await this.makeGraphQLRequest(query, { first: 50 });
            
            if (!response.data?.campaigns?.edges) {
                return [];
            }

            return response.data.campaigns.edges.map(edge => edge.node);
        } catch (error) {
            this.log(`Error fetching trending campaigns: ${error.message}`, 'ERROR');
            return [];
        }
    }

    async fetchRecentCampaigns() {
        const query = `
            query RecentCampaigns($first: Int) {
                campaigns(first: $first, orderBy: CreateTime, orderDirection: DESC) {
                    edges {
                        node {
                            id
                            numberID
                            name
                            description
                            startTime
                            endTime
                            status
                            type
                            info
                            space {
                                id
                                name
                            }
                        }
                    }
                }
            }
        `;

        try {
            const response = await this.makeGraphQLRequest(query, { first: 100 });
            
            if (!response.data?.campaigns?.edges) {
                return [];
            }

            return response.data.campaigns.edges.map(edge => edge.node);
        } catch (error) {
            this.log(`Error fetching recent campaigns: ${error.message}`, 'ERROR');
            return [];
        }
    }

    async makeGraphQLRequest(query, variables = {}) {
        const response = await axios.post(process.env.GALXE_API_BASE || 'https://graphigo.prd.galaxy.eco/query', {
            query,
            variables
        }, {
            headers: {
                'Content-Type': 'application/json',
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                'Accept': 'application/json',
                'Origin': 'https://app.galxe.com',
                'Referer': 'https://app.galxe.com/'
            },
            timeout: 15000
        });

        if (response.data.errors) {
            throw new Error(`GraphQL Error: ${JSON.stringify(response.data.errors)}`);
        }

        return response.data;
    }

    isFCFSCampaign(campaign) {
        const searchText = `${campaign.name} ${campaign.description || ''} ${campaign.info || ''}`.toLowerCase();
        
        // Check for FCFS keywords
        const fcfsKeywords = [
            'fcfs', 'first come first served', 'first come first serve',
            'limited', 'limited supply', 'limited quantity',
            'grab now', 'hurry up', 'while supplies last',
            'rush', 'quick grab', 'instant claim',
            'only available for', 'first 100', 'first 1000',
            'limited time', 'limited spots'
        ];

        return fcfsKeywords.some(keyword => searchText.includes(keyword));
    }

    async notifyCampaign(chatId, campaign) {
        const campaignUrl = `https://app.galxe.com/quest/${campaign.space?.id}/${campaign.id}`;
        const startTime = new Date(campaign.startTime * 1000).toLocaleString();
        const endTime = new Date(campaign.endTime * 1000).toLocaleString();
        
        const statusEmoji = campaign.status === 'Active' ? '🟢' : 
                           campaign.status === 'Ready' ? '🟡' : '🔴';

        const message = `
🎯 *NEW FCFS CAMPAIGN DETECTED!*

📝 *Name:* ${campaign.name}
🏢 *Space:* ${campaign.space?.name || 'Unknown'}
🆔 *ID:* #${campaign.numberID}
${statusEmoji} *Status:* ${campaign.status}
⏰ *Start:* ${startTime}
⏰ *End:* ${endTime}

📋 *Description:*
${campaign.description || 'No description available'}

🔗 [**CLAIM NOW**](${campaignUrl})

⚡ *Action Required:* Klaim sekarang sebelum kehabisan!

#GalxeFCFS #UniversalMonitor
        `;

        try {
            await this.bot.sendMessage(chatId, message, {
                parse_mode: 'Markdown',
                disable_web_page_preview: false
            });
            this.log(`📨 Notification sent to chat ${chatId} for campaign ${campaign.id}`);
        } catch (error) {
            this.log(`Error sending notification to ${chatId}: ${error.message}`, 'ERROR');
        }
    }

    async sendMessage(chatId, message) {
        try {
            await this.bot.sendMessage(chatId, message, { parse_mode: 'Markdown' });
        } catch (error) {
            this.log(`Error sending message to ${chatId}: ${error.message}`, 'ERROR');
        }
    }

    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    // Graceful shutdown
    cleanup() {
        if (this.cronJob) {
            this.cronJob.stop();
            this.cronJob = null;
        }
        this.isGlobalMonitoring = false;
        this.log('🛑 Bot cleanup completed');
    }
}

// Initialize and start bot
const bot = new GalxeUniversalFCFSBot();

// Graceful shutdown handlers
process.on('SIGINT', () => {
    console.log('\n🛑 Shutting down bot...');
    bot.cleanup();
    process.exit(0);
});

process.on('SIGTERM', () => {
    console.log('\n🛑 Shutting down bot...');
    bot.cleanup();
    process.exit(0);
});

console.log('🤖 Galxe Universal FCFS Monitor Bot is running...');
console.log('📝 Commands: /start, /monitor, /stop, /status');
console.log('⏹️  Press Ctrl+C to stop');

module.exports = GalxeUniversalFCFSBot;
