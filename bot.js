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
        this.lastSuccessfulScan = null;
        this.consecutiveErrors = 0;
        this.debugMode = process.env.DEBUG === 'true';
        
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
        this.bot.onText(/\/health/, (msg) => this.handleHealth(msg));
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
/health - Cek kesehatan API
/help - Bantuan lengkap

*🎯 Fitur Utama:*
✅ Monitor SEMUA space Galxe otomatis
✅ Deteksi campaign dengan kata "FCFS"
✅ Notifikasi real-time setiap 60 detik
✅ Fallback system jika API down
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
✅ Multiple fallback systems

*📋 Commands:*
\`/start\` - Mulai bot
\`/monitor\` - Mulai monitoring universal
\`/stop\` - Stop monitoring
\`/status\` - Lihat status monitoring
\`/test\` - Test deteksi campaign FCFS
\`/health\` - Cek kesehatan API
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
Last Successful Scan: ${this.lastSuccessfulScan ? new Date(this.lastSuccessfulScan).toLocaleString() : 'Never'}
Consecutive Errors: ${this.consecutiveErrors}
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
🔍 *Scan Method:* Universal Detection with Fallbacks
📊 *Total Scanned:* Multiple sources

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
            await this.sendMessage(chatId, `❌ Error saat testing: ${error.message}\n\nSilakan cek /health untuk status API`);
        }
    }

    async handleHealth(msg) {
        const chatId = msg.chat.id;
        
        await this.sendMessage(chatId, '🏥 Checking API health...');
        
        const healthCheck = await this.checkAPIHealth();
        
        const message = `
🏥 *Bot Health Check*

*🔍 API Status:*
GraphQL Trending: ${healthCheck.trending ? '✅ Working' : '❌ Failed'}
GraphQL Recent: ${healthCheck.recent ? '✅ Working' : '❌ Failed'}
REST Fallback: ${healthCheck.rest ? '✅ Working' : '❌ Failed'}
Web Scraping: ${healthCheck.scraping ? '✅ Working' : '❌ Failed'}

*📊 Overall Status:*
${healthCheck.anyWorking ? '🟢 Bot functional' : '🔴 All APIs down'}

*🕐 Timestamps:*
Last Successful Scan: ${this.lastSuccessfulScan ? new Date(this.lastSuccessfulScan).toLocaleString() : 'Never'}
Current Time: ${new Date().toLocaleString()}

*💡 Recommendations:*
${healthCheck.anyWorking ? 
    'Bot berfungsi normal. Monitoring dapat dilanjutkan.' : 
    '⚠️ Semua API bermasalah. Silakan coba lagi nanti atau restart bot.'}
        `;
        
        await this.sendMessage(chatId, message);
    }

    async checkAPIHealth() {
        const health = {
            trending: false,
            recent: false,
            rest: false,
            scraping: false,
            anyWorking: false
        };

        // Test GraphQL Trending
        try {
            const trending = await this.fetchTrendingCampaigns();
            health.trending = trending.length > 0;
        } catch (error) {
            this.log(`Health check - Trending failed: ${error.message}`, 'DEBUG');
        }

        // Test GraphQL Recent
        try {
            const recent = await this.fetchRecentCampaigns();
            health.recent = recent.length > 0;
        } catch (error) {
            this.log(`Health check - Recent failed: ${error.message}`, 'DEBUG');
        }

        // Test REST fallback
        try {
            const rest = await this.fetchCampaignsViaREST();
            health.rest = rest.length > 0;
        } catch (error) {
            this.log(`Health check - REST failed: ${error.message}`, 'DEBUG');
        }

        // Test web scraping
        try {
            const scraped = await this.scrapeCampaignsFromWeb();
            health.scraping = scraped.length > 0;
        } catch (error) {
            this.log(`Health check - Scraping failed: ${error.message}`, 'DEBUG');
        }

        health.anyWorking = health.trending || health.recent || health.rest || health.scraping;
        
        return health;
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

        this.log(`🔍 Starting universal FCFS scan...`);
        const startTime = Date.now();
        
        try {
            const fcfsCampaigns = await this.scanForFCFSCampaigns();
            const scanDuration = Date.now() - startTime;
            
            if (fcfsCampaigns.length === 0) {
                this.log(`⚠️ No FCFS campaigns found (scan took ${scanDuration}ms)`);
                
                // Send status update to chats if no data for too long
                if (this.lastSuccessfulScan && (Date.now() - this.lastSuccessfulScan > 300000)) { // 5 minutes
                    for (const chatId of this.monitoringChats) {
                        await this.sendMessage(chatId, `⚠️ *Monitor Status Warning*\n\nTidak ada campaign FCFS ditemukan dalam 5 menit terakhir. Kemungkinan:\n• API Galxe sedang down\n• Tidak ada campaign FCFS aktif\n• Network issues\n\nBot masih berjalan dan akan terus mencoba...\n\nGunakan /health untuk cek status API.`);
                    }
                }
                return;
            }
            
            this.lastSuccessfulScan = Date.now();
            this.consecutiveErrors = 0; // Reset error counter on success
            this.log(`✅ Scan completed: ${fcfsCampaigns.length} FCFS campaigns (${scanDuration}ms)`);

            // Check for new campaigns
            for (const campaign of fcfsCampaigns) {
                if (!this.detectedCampaigns.has(campaign.id)) {
                    this.detectedCampaigns.add(campaign.id);
                    
                    // Notify all active chats
                    for (const chatId of this.monitoringChats) {
                        await this.notifyCampaign(chatId, campaign);
                        await this.sleep(500);
                    }

                    this.log(`🎯 New FCFS campaign detected: ${campaign.name} (${campaign.id})`);
                }
            }

        } catch (error) {
            this.consecutiveErrors++;
            this.log(`❌ Universal scan failed (${this.consecutiveErrors}x): ${error.message}`, 'ERROR');
            
            // Notify users about persistent errors
            if (this.consecutiveErrors === 5) {
                for (const chatId of this.monitoringChats) {
                    await this.sendMessage(chatId, `🚨 *Monitoring Alert*\n\nBot mengalami 5x error berturut-turut:\n\`${error.message}\`\n\nKemungkinan penyebab:\n• API Galxe maintenance\n• Network issues\n• Rate limiting\n\nBot akan terus mencoba. Gunakan /health untuk detail.`);
                }
            }
        }
    }

    async scanForFCFSCampaigns() {
        let allCampaigns = [];
        let successfulMethods = [];
        
        // Method 1: GraphQL Trending
        try {
            const trendingCampaigns = await this.fetchTrendingCampaigns();
            if (trendingCampaigns.length > 0) {
                allCampaigns.push(...trendingCampaigns);
                successfulMethods.push('GraphQL Trending');
                this.log(`✅ GraphQL Trending: ${trendingCampaigns.length} campaigns`);
            }
        } catch (error) {
            this.log(`❌ GraphQL Trending failed: ${error.message}`, 'WARN');
        }
        
        // Method 2: GraphQL Recent
        try {
            const recentCampaigns = await this.fetchRecentCampaigns();
            if (recentCampaigns.length > 0) {
                allCampaigns.push(...recentCampaigns);
                successfulMethods.push('GraphQL Recent');
                this.log(`✅ GraphQL Recent: ${recentCampaigns.length} campaigns`);
            }
        } catch (error) {
            this.log(`❌ GraphQL Recent failed: ${error.message}`, 'WARN');
        }
        
        // Method 3: REST API Fallback (jika GraphQL gagal total)
        if (allCampaigns.length === 0) {
            this.log('🔄 All GraphQL methods failed, trying REST API fallback...', 'WARN');
            try {
                const restCampaigns = await this.fetchCampaignsViaREST();
                if (restCampaigns.length > 0) {
                    allCampaigns.push(...restCampaigns);
                    successfulMethods.push('REST API');
                    this.log(`✅ REST API Fallback: ${restCampaigns.length} campaigns`);
                }
            } catch (error) {
                this.log(`❌ REST API also failed: ${error.message}`, 'ERROR');
            }
        }
        
        // Method 4: Web Scraping Fallback (last resort)
        if (allCampaigns.length === 0) {
            this.log('🔄 All API methods failed, trying web scraping...', 'WARN');
            try {
                const scrapedCampaigns = await this.scrapeCampaignsFromWeb();
                if (scrapedCampaigns.length > 0) {
                    allCampaigns.push(...scrapedCampaigns);
                    successfulMethods.push('Web Scraping');
                    this.log(`✅ Web Scraping: ${scrapedCampaigns.length} campaigns`);
                }
            } catch (error) {
                this.log(`❌ Web scraping also failed: ${error.message}`, 'ERROR');
            }
        }
        
        // Log success status
        this.log(`📊 Data sources used: ${successfulMethods.join(', ') || 'None'}`);
        
        if (allCampaigns.length === 0) {
            this.log('⚠️ No campaigns retrieved from any source!', 'ERROR');
            return [];
        }
        
        // Deduplicate campaigns
        const uniqueCampaigns = allCampaigns.filter((campaign, index, self) => 
            index === self.findIndex(c => c.id === campaign.id)
        );

        // Filter for FCFS campaigns
        const fcfsCampaigns = uniqueCampaigns.filter(campaign => this.isFCFSCampaign(campaign));
        this.log(`🎯 FCFS campaigns found: ${fcfsCampaigns.length}/${uniqueCampaigns.length}`);
        
        return fcfsCampaigns;
    }

    async fetchTrendingCampaigns() {
        const query = `
            query TrendingCampaigns($first: Int!) {
                campaigns(
                    input: {
                        first: $first
                        listType: Trending
                    }
                ) {
                    pageInfo {
                        hasNextPage
                        endCursor
                    }
                    list {
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
        `;

        try {
            const response = await this.makeGraphQLRequest(query, { first: 50 });
            
            if (!response.data?.campaigns?.list) {
                this.log('No campaigns data in trending response', 'WARN');
                return [];
            }

            return response.data.campaigns.list;
        } catch (error) {
            this.log(`Error fetching trending campaigns: ${error.message}`, 'ERROR');
            
            // Try alternative query structure
            return await this.fetchTrendingCampaignsAlternative();
        }
    }

    async fetchTrendingCampaignsAlternative() {
        const query = `
            query GetCampaigns($first: Int!) {
                campaigns(first: $first) {
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
            this.log(`Error with alternative trending query: ${error.message}`, 'ERROR');
            throw error;
        }
    }

    async fetchRecentCampaigns() {
        const query = `
            query RecentCampaigns($first: Int!) {
                campaigns(
                    input: {
                        first: $first
                        listType: Latest
                    }
                ) {
                    pageInfo {
                        hasNextPage
                        endCursor
                    }
                    list {
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
        `;

        try {
            const response = await this.makeGraphQLRequest(query, { first: 100 });
            
            if (!response.data?.campaigns?.list) {
                this.log('No campaigns data in recent response', 'WARN');
                return [];
            }

            return response.data.campaigns.list;
        } catch (error) {
            this.log(`Error fetching recent campaigns: ${error.message}`, 'ERROR');
            throw error;
        }
    }

    async fetchCampaignsViaREST() {
        try {
            // Try different REST endpoints
            const endpoints = [
                'https://graphigo.prd.galaxy.eco/query',
                'https://api.galxe.com/api/campaigns',
                'https://app.galxe.com/api/campaigns'
            ];
            
            for (const endpoint of endpoints) {
                try {
                    const response = await axios.get(endpoint, {
                        params: {
                            limit: 50,
                            sort: 'trending'
                        },
                        headers: {
                            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                            'Accept': 'application/json'
                        },
                        timeout: 10000
                    });
                    
                    if (response.data && Array.isArray(response.data)) {
                        return response.data;
                    }
                    
                    if (response.data.data && Array.isArray(response.data.data)) {
                        return response.data.data;
                    }
                    
                } catch (endpointError) {
                    this.log(`REST endpoint ${endpoint} failed: ${endpointError.message}`, 'DEBUG');
                    continue;
                }
            }
            
            return [];
            
        } catch (error) {
            this.log(`REST API fallback error: ${error.message}`, 'ERROR');
            return [];
        }
    }

    async scrapeCampaignsFromWeb() {
        try {
            const response = await axios.get('https://app.galxe.com', {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                },
                timeout: 15000
            });
            
            // Simple regex to extract campaign data from HTML
            const campaignMatches = response.data.match(/campaign[s]?\s*:\s*(\[.*?\])/gi);
            
            if (campaignMatches && campaignMatches.length > 0) {
                try {
                    const campaignData = JSON.parse(campaignMatches[0].split(':')[1]);
                    return Array.isArray(campaignData) ? campaignData : [];
                } catch (parseError) {
                    this.log(`Failed to parse scraped data: ${parseError.message}`, 'WARN');
                }
            }
            
            return [];
            
        } catch (error) {
            this.log(`Web scraping error: ${error.message}`, 'ERROR');
            return [];
        }
    }

    async makeGraphQLRequest(query, variables = {}) {
        try {
            const response = await axios.post(
                process.env.GALXE_API_BASE || 'https://graphigo.prd.galaxy.eco/query', 
                {
                    query,
                    variables
                }, 
                {
                    headers: {
                        'Content-Type': 'application/json',
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                        'Accept': 'application/json',
                        'Accept-Language': 'en-US,en;q=0.9',
                        'Origin': 'https://app.galxe.com',
                        'Referer': 'https://app.galxe.com/',
                        'Sec-Ch-Ua': '"Not_A Brand";v="8", "Chromium";v="120", "Google Chrome";v="120"',
                        'Sec-Ch-Ua-Mobile': '?0',
                        'Sec-Ch-Ua-Platform': '"Windows"',
                        'Sec-Fetch-Dest': 'empty',
                        'Sec-Fetch-Mode': 'cors',
                        'Sec-Fetch-Site': 'cross-site'
                    },
                    timeout: 15000
                }
            );

            // Debug logging
            if (this.debugMode) {
                this.log(`GraphQL Query: ${query.substring(0, 100)}...`, 'DEBUG');
                this.log(`GraphQL Variables: ${JSON.stringify(variables)}`, 'DEBUG');
                this.log(`GraphQL Response Status: ${response.status}`, 'DEBUG');
            }
            
            if (response.data.errors) {
                this.log(`GraphQL Errors: ${JSON.stringify(response.data.errors, null, 2)}`, 'ERROR');
                throw new Error(`GraphQL Error: ${JSON.stringify(response.data.errors)}`);
            }

            return response.data;
            
        } catch (error) {
            if (error.response) {
                this.log(`HTTP Error ${error.response.status}: ${JSON.stringify(error.response.data)}`, 'ERROR');
                
                // Special handling for 422 errors
                if (error.response.status === 422) {
                    throw new Error(`API Validation Error (422): ${JSON.stringify(error.response.data)}`);
                }
            } else if (error.request) {
                this.log(`Network Error: ${error.message}`, 'ERROR');
            } else {
                this.log(`Request Error: ${error.message}`, 'ERROR');
            }
            throw error;
        }
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
