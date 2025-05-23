const moment = require('moment');

class Helpers {
    /**
     * Format timestamp ke string yang readable
     */
    static formatDateTime(timestamp) {
        return moment(timestamp * 1000).format('DD/MM/YYYY HH:mm:ss');
    }

    /**
     * Format duration antara dua timestamp
     */
    static formatDuration(startTime, endTime) {
        const start = moment(startTime * 1000);
        const end = moment(endTime * 1000);
        const duration = moment.duration(end.diff(start));
        
        const days = duration.days();
        const hours = duration.hours();
        const minutes = duration.minutes();
        
        let result = '';
        if (days > 0) result += `${days}d `;
        if (hours > 0) result += `${hours}h `;
        if (minutes > 0) result += `${minutes}m`;
        
        return result.trim() || '< 1m';
    }

    /**
     * Cek apakah campaign adalah FCFS
     */
    static isFCFSCampaign(campaign) {
        const fcfsKeywords = [
            'fcfs', 'first come first served', 'first come',
            'limited', 'while supplies last', 'grab now',
            'hurry', 'limited time', 'limited quantity'
        ];

        const searchText = `${campaign.name} ${campaign.description || ''}`.toLowerCase();
        
        return campaign.type === 'Drop' || 
               fcfsKeywords.some(keyword => searchText.includes(keyword));
    }

    /**
     * Extract space ID dari URL Galxe
     */
    static extractSpaceIdFromUrl(url) {
        const regex = /app\.galxe\.com\/quest\/([^\/]+)/;
        const match = url.match(regex);
        return match ? match[1] : null;
    }

    /**
     * Generate campaign URL
     */
    static generateCampaignUrl(spaceId, campaignId) {
        return `https://app.galxe.com/quest/${spaceId}/${campaignId}`;
    }

    /**
     * Format notification message
     */
    static formatNotificationMessage(campaign, spaceId) {
        const startTime = this.formatDateTime(campaign.startTime);
        const endTime = this.formatDateTime(campaign.endTime);
        const duration = this.formatDuration(campaign.startTime, campaign.endTime);
        const campaignUrl = this.generateCampaignUrl(spaceId, campaign.id);
        
        // Status emoji
        const statusEmoji = campaign.status === 'Active' ? '🟢' : 
                           campaign.status === 'Ready' ? '🟡' : '🔴';
        
        return `
🎯 *NEW FCFS REWARD DETECTED!*

📝 *Campaign:* ${campaign.name}
🆔 *ID:* #${campaign.numberID}
${statusEmoji} *Status:* ${campaign.status}
⏰ *Start:* ${startTime}
⏰ *End:* ${endTime}
⏳ *Duration:* ${duration}

📋 *Description:*
${campaign.description || 'No description available'}

🔗 [**CLAIM NOW**](${campaignUrl})

⚡ *Action Required:* Claim sekarang sebelum kehabisan!

#GalxeFCFS #CryptoReward #${spaceId}
        `.trim();
    }

    /**
     * Format status message
     */
    static formatStatusMessage(stats, monitoredSpaces) {
        return `
📊 *Bot Status Dashboard*

🔄 *Monitoring Status:* ✅ Active
👥 *Active Chats:* ${stats.activeChats}
📁 *Total Spaces Monitored:* ${stats.totalSpaces}
🎯 *Campaigns Detected:* ${stats.totalCampaigns}
📨 *Notifications Sent:* ${stats.successfulNotifications}

📋 *Your Monitored Spaces:*
${monitoredSpaces.length > 0 ? 
    monitoredSpaces.map((space, index) => 
        `${index + 1}. \`${space.space_id}\`${space.space_name ? ` - ${space.space_name}` : ''}`
    ).join('\n') : 
    'No spaces monitored yet'
}

⏰ *Last Check:* ${moment().format('DD/MM/YYYY HH:mm:ss')}
🔄 *Check Interval:* Every 30 seconds
        `.trim();
    }

    /**
     * Validate space ID format
     */
    static isValidSpaceId(spaceId) {
        // Galxe space ID biasanya format: huruf dan angka, panjang tertentu
        const regex = /^[a-zA-Z0-9]{15,25}$/;
        return regex.test(spaceId);
    }

    /**
     * Sanitize text untuk Telegram markdown
     */
    static sanitizeMarkdown(text) {
        if (!text) return text;
        
        // Escape special markdown characters
        return text
        .replace(/[_*[\]()~`>#+=|{}.!-]/g, '\\$&')
        
            .replace(/\n/g, '\n');
    }

    /**
     * Generate random delay untuk avoid rate limiting
     */
    static getRandomDelay(min = 1000, max = 3000) {
        return Math.floor(Math.random() * (max - min + 1)) + min;
    }

    /**
     * Sleep function
     */
    static sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    /**
     * Retry function dengan exponential backoff
     */
    static async retry(fn, maxRetries = 3, delay = 1000) {
        for (let i = 0; i < maxRetries; i++) {
            try {
                return await fn();
            } catch (error) {
                if (i === maxRetries - 1) throw error;
                
                const backoffDelay = delay * Math.pow(2, i);
                console.log(`Retry ${i + 1}/${maxRetries} after ${backoffDelay}ms`);
                await this.sleep(backoffDelay);
            }
        }
    }

    /**
     * Log dengan timestamp
     */
    static log(message, level = 'INFO') {
        const timestamp = moment().format('YYYY-MM-DD HH:mm:ss');
        console.log(`[${timestamp}] [${level}] ${message}`);
    }

    /**
     * Error handler untuk bot
     */
    static handleError(error, context = '') {
        this.log(`Error ${context}: ${error.message}`, 'ERROR');
        console.error(error);
    }

    /**
     * Format file size
     */
    static formatFileSize(bytes) {
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        if (bytes === 0) return '0 Bytes';
        
        const i = parseInt(Math.floor(Math.log(bytes) / Math.log(1024)));
        return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
    }

    /**
     * Get system info
     */
    static getSystemInfo() {
        const process = require('process');
        const os = require('os');
        
        return {
            nodeVersion: process.version,
            platform: os.platform(),
            uptime: process.uptime(),
            memoryUsage: process.memoryUsage(),
            cpuUsage: process.cpuUsage()
        };
    }
}

module.exports = Helpers;
