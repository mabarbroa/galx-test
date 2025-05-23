const axios = require('axios');
const cron = require('cron');

class GalxeMonitor {
    constructor(bot) {
        this.bot = bot;
        this.monitoringChats = new Set();
        this.monitoredSpaces = new Map(); // chatId -> [spaceIds]
        this.lastCampaigns = new Map(); // spaceId -> campaigns
        this.cronJob = null;
    }

    async fetchSpaceCampaigns(spaceId) {
        const query = `
            query SpaceCampaignList($id: ID!, $first: Int, $after: String) {
                space(id: $id) {
                    campaigns(first: $first, after: $after) {
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
                                credentialGroups {
                                    conditionLogic
                                    conditions {
                                        ... on GitcoinPassportCondition {
                                            score
                                        }
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
            const response = await axios.post(process.env.GALXE_API_BASE, {
                query,
                variables: {
                    id: spaceId,
                    first: 50
                }
            }, {
                headers: {
                    'Content-Type': 'application/json',
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                }
            });

            if (response.data.errors) {
                console.error('GraphQL Errors:', response.data.errors);
                return [];
            }

            return response.data.data.space.campaigns.edges.map(edge => edge.node);
        } catch (error) {
            console.error('Error fetching campaigns:', error);
            return [];
        }
    }

    async checkForNewCampaigns() {
        for (const [chatId, spaceIds] of this.monitoredSpaces.entries()) {
            for (const spaceId of spaceIds) {
                try {
                    const campaigns = await this.fetchSpaceCampaigns(spaceId);
                    const lastCampaigns = this.lastCampaigns.get(spaceId) || [];
                    
                    // Filter FCFS campaigns only
                    const fcfsCampaigns = campaigns.filter(campaign => 
                        campaign.type === 'Drop' || 
                        (campaign.info && campaign.info.includes('FCFS')) ||
                        (campaign.description && campaign.description.toLowerCase().includes('first come'))
                    );

                    // Check for new campaigns
                    const newCampaigns = fcfsCampaigns.filter(campaign => 
                        !lastCampaigns.some(last => last.id === campaign.id)
                    );

                    if (newCampaigns.length > 0) {
                        for (const campaign of newCampaigns) {
                            await this.sendCampaignNotification(chatId, campaign, spaceId);
                        }
                    }

                    this.lastCampaigns.set(spaceId, fcfsCampaigns);
                    
                } catch (error) {
                    console.error(`Error checking campaigns for space ${spaceId}:`, error);
                }
            }
        }
    }

    async sendCampaignNotification(chatId, campaign, spaceId) {
        const message = `
🎯 *NEW FCFS REWARD DETECTED!*

📝 *Campaign:* ${campaign.name}
🆔 *ID:* ${campaign.numberID}
📊 *Status:* ${campaign.status}
⏰ *Start:* ${new Date(campaign.startTime * 1000).toLocaleString()}
⏰ *End:* ${new Date(campaign.endTime * 1000).toLocaleString()}

📝 *Description:*
${campaign.description || 'No description available'}

🔗 *Link:* https://app.galxe.com/quest/${spaceId}/${campaign.id}

⚡ *Action Required:* Claim sekarang sebelum kehabisan!
        `;

        try {
            await this.bot.sendMessage(chatId, message, { 
                parse_mode: 'Markdown',
                disable_web_page_preview: false
            });
        } catch (error) {
            console.error('Error sending notification:', error);
        }
    }

    startMonitoring(chatId) {
        this.monitoringChats.add(chatId);
        
        if (!this.cronJob) {
            this.cronJob = new cron.CronJob('*/30 * * * * *', () => {
                this.checkForNewCampaigns();
            }, null, true);
        }

        this.bot.sendMessage(chatId, '✅ Monitoring started! Bot akan cek setiap 30 detik untuk reward FCFS baru.');
    }

    stopMonitoring(chatId) {
        this.monitoringChats.delete(chatId);
        
        if (this.monitoringChats.size === 0 && this.cronJob) {
            this.cronJob.stop();
            this.cronJob = null;
        }

        this.bot.sendMessage(chatId, '⏹️ Monitoring stopped!');
    }

    getStatus(chatId) {
        const isMonitoring = this.monitoringChats.has(chatId);
        const spacesCount = this.monitoredSpaces.get(chatId)?.length || 0;
        
        const message = `
📊 *Status Monitor:*
🔄 Monitoring: ${isMonitoring ? '✅ Active' : '❌ Inactive'}
📁 Spaces Monitored: ${spacesCount}
⏰ Check Interval: 30 seconds
        `;

        this.bot.sendMessage(chatId, message, { parse_mode: 'Markdown' });
    }

    addSpace(chatId, spaceId) {
        if (!this.monitoredSpaces.has(chatId)) {
            this.monitoredSpaces.set(chatId, []);
        }

        const spaces = this.monitoredSpaces.get(chatId);
        if (!spaces.includes(spaceId)) {
            spaces.push(spaceId);
            this.bot.sendMessage(chatId, `✅ Space ${spaceId} berhasil ditambahkan untuk monitoring!`);
        } else {
            this.bot.sendMessage(chatId, `⚠️ Space ${spaceId} sudah ada dalam daftar monitoring.`);
        }
    }

    listSpaces(chatId) {
        const spaces = this.monitoredSpaces.get(chatId) || [];
        
        if (spaces.length === 0) {
            this.bot.sendMessage(chatId, '📝 Belum ada space yang dimonitor. Gunakan /add [space_id] untuk menambah.');
            return;
        }

        const message = `
📁 *Spaces yang dimonitor:*
${spaces.map((space, index) => `${index + 1}. \`${space}\``).join('\n')}

Total: ${spaces.length} spaces
        `;

        this.bot.sendMessage(chatId, message, { parse_mode: 'Markdown' });
    }
}

module.exports = GalxeMonitor;
