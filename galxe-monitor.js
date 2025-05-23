const axios = require('axios');
const cron = require('cron');
const Database = require('./utils/database');
const Helpers = require('./utils/helpers');

class GalxeMonitor {
    constructor(bot, database) {
        this.bot = bot;
        this.db = database;
        this.cronJob = null;
        this.isMonitoring = false;
        this.rateLimitDelay = 1000; // 1 second delay between requests
        this.maxRetries = 3;
    }

    async fetchSpaceCampaigns(spaceId) {
        const query = `
            query SpaceCampaignList($id: ID!, $first: Int, $after: String) {
                space(id: $id) {
                    id
                    name
                    campaigns(first: $first, after: $after, orderBy: CreateTime, orderDirection: DESC) {
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
                                useCred
                                space {
                                    id
                                    name
                                }
                                credentialGroups {
                                    conditionLogic
                                    conditions {
                                        ... on GitcoinPassportCondition {
                                            score
                                        }
                                    }
                                }
                                rewardInfo {
                                    discordRole {
                                        guildId
                                        roleId
                                    }
                                    premint {
                                        chainId
                                    }
                                    loyaltyPoints {
                                        points
                                    }
                                    nft {
                                        chainId
                                    }
                                }
                            }
                        }
                        pageInfo {
                            endCursor
                            hasNextPage
                        }
                    }
                }
            }
        `;

        try {
            const response = await Helpers.retry(async () => {
                return await axios.post(process.env.GALXE_API_BASE, {
                    query,
                    variables: {
                        id: spaceId,
                        first: 20 // Reduce untuk menghindari rate limit
                    }
                }, {
                    headers: {
                        'Content-Type': 'application/json',
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
                        'Accept': 'application/json',
                        'Accept-Language': 'en-US,en;q=0.9',
                        'Origin': 'https://app.galxe.com',
                        'Referer': 'https://app.galxe.com/'
                    },
                    timeout: 10000
                });
            }, this.maxRetries);

            if (response.data.errors) {
                console.error('GraphQL Errors:', response.data.errors);
                return [];
            }

            if (!response.data.data || !response.data.data.space) {
                Helpers.log(`No data found for space: ${spaceId}`, 'WARN');
                return [];
            }

            const campaigns = response.data.data.space.campaigns.edges.map(edge => ({
                ...edge.node,
                spaceId: spaceId,
                spaceName: response.data.data.space.name
            }));

            Helpers.log(`Fetched ${campaigns.length} campaigns for space ${spaceId}`);
            return campaigns;

        } catch (error) {
            Helpers.handleError(error, `fetching campaigns for space ${spaceId}`);
            return [];
        }
    }

    async checkForNewCampaigns() {
        if (!this.isMonitoring) return;

        try {
            const allSpaces = await this.db.getAllMonitoredSpaces();
            Helpers.log(`Checking ${allSpaces.length} spaces for new campaigns`);

            for (const spaceId of allSpaces) {
                try {
                    // Add delay to avoid rate limiting
                    await Helpers.sleep(this.rateLimitDelay);

                    const campaigns = await this.fetchSpaceCampaigns(spaceId);
                    
                    // Filter FCFS campaigns only
                    const fcfsCampaigns = campaigns.filter(campaign => 
                        Helpers.isFCFSCampaign(campaign)
                    );

                    // Check for new campaigns
                    for (const campaign of fcfsCampaigns) {
                        const exists = await this.db.getCampaignExists(campaign.id);
                        
                        if (!exists) {
                            // New campaign detected!
                            await this.db.addDetectedCampaign(campaign);
                            await this.notifySubscribers(campaign, spaceId);
                            
                            Helpers.log(`New FCFS campaign detected: ${campaign.name} (${campaign.id})`);
                        }
                    }

                } catch (error) {
                    Helpers.handleError(error, `checking campaigns for space ${spaceId}`);
                    continue; // Continue dengan space lainnya
                }
            }

        } catch (error) {
            Helpers.handleError(error, 'checking for new campaigns');
        }
    }

    async notifySubscribers(campaign, spaceId) {
        try {
            const activeChats = await this.db.getActiveMonitoringChats();
            
            for (const chat of activeChats) {
                try {
                    // Check if this chat monitors this space
                    const monitoredSpaces = await this.db.getMonitoredSpaces(chat.chat_id);
                    const monitorsThisSpace = monitoredSpaces.some(space => space.space_id === spaceId);
                    
                    if (monitorsThisSpace) {
                        const message = Helpers.formatNotificationMessage(campaign, spaceId);
                        
                        await this.bot.sendMessage(chat.chat_id, message, {
                            parse_mode: 'Markdown',
                            disable_web_page_preview: false
                        });
                        
                        await this.db.logNotification(chat.chat_id, campaign.id, true);
                        Helpers.log(`Notification sent to chat ${chat.chat_id} for campaign ${campaign.id}`);
                        
                        // Delay between notifications to avoid spam limits
                        await Helpers.sleep(500);
                    }
                    
                } catch (error) {
                    await this.db.logNotification(chat.chat_id, campaign.id, false);
                    Helpers.handleError(error, `sending notification to chat ${chat.chat_id}`);
                }
            }
            
        } catch (error) {
            Helpers.handleError(error, 'notifying subscribers');
        }
    }

    async startMonitoring(chatId) {
        try {
            await this.db.addMonitoringChat(chatId);
            
            if (!this.isMonitoring) {
                this.isMonitoring = true;
                
                // Start cron job
                this.cronJob = new cron.CronJob('*/30 * * * * *', () => {
                    this.checkForNewCampaigns();
                }, null, true);
                
                Helpers.log('Global monitoring started');
            }

            this.bot.sendMessage(chatId, `
✅ *Monitoring Started!*

Bot sekarang akan memantau semua space yang Anda tambahkan dan mengirim notifikasi real-time untuk FCFS rewards baru.

⏰ *Check Interval:* Setiap 30 detik
🔍 *Auto-detect:* FCFS campaigns
📨 *Instant notification:* Ketika ada reward baru

Gunakan /status untuk melihat status monitoring Anda.
            `, { parse_mode: 'Markdown' });

        } catch (error) {
            Helpers.handleError(error, 'starting monitoring');
            this.bot.sendMessage(chatId, '❌ Error saat memulai monitoring. Silakan coba lagi.');
        }
    }

    async stopMonitoring(chatId) {
        try {
            await this.db.removeMonitoringChat(chatId);
            
            // Check if any chats are still monitoring
            const activeChats = await this.db.getActiveMonitoringChats();
            if (activeChats.length === 0 && this.cronJob) {
                this.cronJob.stop();
                this.cronJob = null;
                this.isMonitoring = false;
                Helpers.log('Global monitoring stopped - no active chats');
            }

            this.bot.sendMessage(chatId, `
⏹️ *Monitoring Stopped!*

Bot berhenti memantau untuk chat ini. Space yang sudah ditambahkan tetap tersimpan.

Untuk mulai monitoring lagi, gunakan /monitor
            `, { parse_mode: 'Markdown' });

        } catch (error) {
            Helpers.handleError(error, 'stopping monitoring');
            this.bot.sendMessage(chatId, '❌ Error saat menghentikan monitoring.');
        }
    }

    async getStatus(chatId) {
        try {
            const stats = await this.db.getStats();
            const monitoredSpaces = await this.db.getMonitoredSpaces(chatId);
            const activeChats = await this.db.getActiveMonitoringChats();
            const isActive = activeChats.some(chat => chat.chat_id === chatId);

            const message = Helpers.formatStatusMessage(stats, monitoredSpaces);
            const fullMessage = `${message}

🔄 *Your Status:* ${isActive ? '✅ Active' : '❌ Inactive'}
⚡ *Bot Status:* ${this.isMonitoring ? '🟢 Running' : '🔴 Stopped'}
            `;

            this.bot.sendMessage(chatId, fullMessage, { parse_mode: 'Markdown' });

        } catch (error) {
            Helpers.handleError(error, 'getting status');
            this.bot.sendMessage(chatId, '❌ Error saat mengambil status.');
        }
    }

    async addSpace(chatId, spaceId) {
        try {
            // Check current count
            const currentSpaces = await this.db.getMonitoredSpaces(chatId);
            if (currentSpaces.length >= 10) {
                this.bot.sendMessage(chatId, '❌ Maksimal 10 space per chat. Hapus space lama dengan /remove terlebih dahulu.');
                return;
            }

            // Try to fetch space info to validate
            const campaigns = await this.fetchSpaceCampaigns(spaceId);
            if (campaigns.length === 0) {
                this.bot.sendMessage(chatId, '❌ Space ID tidak valid atau tidak ditemukan. Pastikan Space ID benar.');
                return;
            }

            const spaceName = campaigns[0]?.spaceName || null;
            await this.db.addMonitoredSpace(chatId, spaceId, spaceName);

            this.bot.sendMessage(chatId, `
✅ *Space berhasil ditambahkan!*

🆔 *Space ID:* \`${spaceId}\`
📝 *Space Name:* ${spaceName || 'Unknown'}
🎯 *Total Campaigns:* ${campaigns.length}

Space ini akan dimonitor untuk FCFS rewards. Gunakan /monitor untuk memulai monitoring.
            `, { parse_mode: 'Markdown' });

        } catch (error) {
            Helpers.handleError(error, 'adding space');
            this.bot.sendMessage(chatId, '❌ Error saat menambahkan space. Pastikan Space ID valid.');
        }
    }

    async removeSpace(chatId, spaceId) {
        try {
            const removed = await this.db.removeMonitoredSpace(chatId, spaceId);
            
            if (removed > 0) {
                this.bot.sendMessage(chatId, `✅ Space \`${spaceId}\` berhasil dihapus dari monitoring.`, 
                    { parse_mode: 'Markdown' });
            } else {
                this.bot.sendMessage(chatId, `❌ Space \`${spaceId}\` tidak ditemukan dalam daftar monitoring Anda.`, 
                    { parse_mode: 'Markdown' });
            }

        } catch (error) {
            Helpers.handleError(error, 'removing space');
            this.bot.sendMessage(chatId, '❌ Error saat menghapus space.');
        }
    }

    async listSpaces(chatId) {
        try {
            const spaces = await this.db.getMonitoredSpaces(chatId);
            
            if (spaces.length === 0) {
                this.bot.sendMessage(chatId, `
📝 *Belum ada space yang dimonitor*

Tambahkan space dengan:
/add [space_id]
/add [galxe_url]

Contoh:
/add Za7zYyykeFvi9KYGmxWSrb
                `, { parse_mode: 'Markdown' });
                return;
            }

            const message = `
📁 *Spaces yang dimonitor:*

${spaces.map((space, index) => `
${index + 1}. \`${space.space_id}\`
   ${space.space_name ? `📝 ${space.space_name}` : ''}
   📅 Added: ${new Date(space.created_at).toLocaleDateString()}
`).join('')}

📊 *Total:* ${spaces.length}/10 spaces
🗑️ *Hapus space:* /remove [space_id]
            `;

            this.bot.sendMessage(chatId, message, { parse_mode: 'Markdown' });

        } catch (error) {
            Helpers.handleError(error, 'listing spaces');
            this.bot.sendMessage(chatId, '❌ Error saat mengambil daftar space.');
        }
    }

    async getStats(chatId) {
        try {
            const stats = await this.db.getStats();
            const systemInfo = Helpers.getSystemInfo();
            
            const message = `
📈 *Bot Statistics*

👥 *Users:*
   • Active Chats: ${stats.activeChats}
   • Total Spaces Monitored: ${stats.totalSpaces}

🎯 *Campaigns:*
   • Total Detected: ${stats.totalCampaigns}
   • Notifications Sent: ${stats.successfulNotifications}

⚙️ *System Info:*
   • Node Version: ${systemInfo.nodeVersion}
   • Platform: ${systemInfo.platform}
   • Uptime: ${Math.floor(systemInfo.uptime / 3600)}h ${Math.floor((systemInfo.uptime % 3600) / 60)}m
   • Memory Usage: ${Helpers.formatFileSize(systemInfo.memoryUsage.heapUsed)}

🔄 *Monitoring Status:*
   • Global Status: ${this.isMonitoring ? '🟢 Active' : '🔴 Inactive'}
   • Check Interval: 30 seconds
   • Rate Limit Delay: ${this.rateLimitDelay}ms

📊 *Performance:*
   • Success Rate: ${stats.totalCampaigns > 0 ? Math.round((stats.successfulNotifications / stats.totalCampaigns) * 100) : 0}%
   • Last Check: ${new Date().toLocaleString()}
            `;

            this.bot.sendMessage(chatId, message, { parse_mode: 'Markdown' });

        } catch (error) {
            Helpers.handleError(error, 'getting stats');
            this.bot.sendMessage(chatId, '❌ Error saat mengambil statistik.');
        }
    }

    cleanup() {
        if (this.cronJob) {
            this.cronJob.stop();
            this.cronJob = null;
        }
        this.isMonitoring = false;
        Helpers.log('Monitor cleanup completed');
    }
}

module.exports = GalxeMonitor;
