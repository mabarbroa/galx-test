const sqlite3 = require('sqlite3').verbose();
const path = require('path');

class Database {
    constructor() {
        this.dbPath = path.join(__dirname, '..', 'galxe_bot.db');
        this.db = new sqlite3.Database(this.dbPath);
        this.initTables();
    }

    initTables() {
        // Table untuk menyimpan chat yang aktif monitoring
        this.db.run(`
            CREATE TABLE IF NOT EXISTS monitoring_chats (
                chat_id TEXT PRIMARY KEY,
                is_active INTEGER DEFAULT 1,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // Table untuk menyimpan space yang dimonitor per chat
        this.db.run(`
            CREATE TABLE IF NOT EXISTS monitored_spaces (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                chat_id TEXT,
                space_id TEXT,
                space_name TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(chat_id, space_id)
            )
        `);

        // Table untuk menyimpan campaign yang sudah terdeteksi
        this.db.run(`
            CREATE TABLE IF NOT EXISTS detected_campaigns (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                campaign_id TEXT UNIQUE,
                space_id TEXT,
                campaign_name TEXT,
                campaign_type TEXT,
                start_time INTEGER,
                end_time INTEGER,
                status TEXT,
                detected_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // Table untuk log notifikasi
        this.db.run(`
            CREATE TABLE IF NOT EXISTS notification_logs (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                chat_id TEXT,
                campaign_id TEXT,
                message_sent INTEGER DEFAULT 0,
                sent_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        `);
    }

    // MONITORING CHATS
    addMonitoringChat(chatId) {
        return new Promise((resolve, reject) => {
            this.db.run(
                'INSERT OR REPLACE INTO monitoring_chats (chat_id, is_active, updated_at) VALUES (?, 1, CURRENT_TIMESTAMP)',
                [chatId],
                function(err) {
                    if (err) reject(err);
                    else resolve(this.lastID);
                }
            );
        });
    }

    removeMonitoringChat(chatId) {
        return new Promise((resolve, reject) => {
            this.db.run(
                'UPDATE monitoring_chats SET is_active = 0, updated_at = CURRENT_TIMESTAMP WHERE chat_id = ?',
                [chatId],
                function(err) {
                    if (err) reject(err);
                    else resolve(this.changes);
                }
            );
        });
    }

    getActiveMonitoringChats() {
        return new Promise((resolve, reject) => {
            this.db.all(
                'SELECT * FROM monitoring_chats WHERE is_active = 1',
                [],
                (err, rows) => {
                    if (err) reject(err);
                    else resolve(rows);
                }
            );
        });
    }

    // MONITORED SPACES
    addMonitoredSpace(chatId, spaceId, spaceName = null) {
        return new Promise((resolve, reject) => {
            this.db.run(
                'INSERT OR IGNORE INTO monitored_spaces (chat_id, space_id, space_name) VALUES (?, ?, ?)',
                [chatId, spaceId, spaceName],
                function(err) {
                    if (err) reject(err);
                    else resolve(this.lastID);
                }
            );
        });
    }

    getMonitoredSpaces(chatId) {
        return new Promise((resolve, reject) => {
            this.db.all(
                'SELECT * FROM monitored_spaces WHERE chat_id = ?',
                [chatId],
                (err, rows) => {
                    if (err) reject(err);
                    else resolve(rows);
                }
            );
        });
    }

    getAllMonitoredSpaces() {
        return new Promise((resolve, reject) => {
            this.db.all(
                'SELECT DISTINCT space_id FROM monitored_spaces',
                [],
                (err, rows) => {
                    if (err) reject(err);
                    else resolve(rows.map(row => row.space_id));
                }
            );
        });
    }

    removeMonitoredSpace(chatId, spaceId) {
        return new Promise((resolve, reject) => {
            this.db.run(
                'DELETE FROM monitored_spaces WHERE chat_id = ? AND space_id = ?',
                [chatId, spaceId],
                function(err) {
                    if (err) reject(err);
                    else resolve(this.changes);
                }
            );
        });
    }

    // DETECTED CAMPAIGNS
    addDetectedCampaign(campaign) {
        return new Promise((resolve, reject) => {
            this.db.run(
                `INSERT OR IGNORE INTO detected_campaigns 
                (campaign_id, space_id, campaign_name, campaign_type, start_time, end_time, status) 
                VALUES (?, ?, ?, ?, ?, ?, ?)`,
                [
                    campaign.id,
                    campaign.spaceId,
                    campaign.name,
                    campaign.type,
                    campaign.startTime,
                    campaign.endTime,
                    campaign.status
                ],
                function(err) {
                    if (err) reject(err);
                    else resolve(this.lastID);
                }
            );
        });
    }

    getCampaignExists(campaignId) {
        return new Promise((resolve, reject) => {
            this.db.get(
                'SELECT id FROM detected_campaigns WHERE campaign_id = ?',
                [campaignId],
                (err, row) => {
                    if (err) reject(err);
                    else resolve(!!row);
                }
            );
        });
    }

    // NOTIFICATION LOGS
    logNotification(chatId, campaignId, success = true) {
        return new Promise((resolve, reject) => {
            this.db.run(
                'INSERT INTO notification_logs (chat_id, campaign_id, message_sent) VALUES (?, ?, ?)',
                [chatId, campaignId, success ? 1 : 0],
                function(err) {
                    if (err) reject(err);
                    else resolve(this.lastID);
                }
            );
        });
    }

    // STATS
    getStats() {
        return new Promise((resolve, reject) => {
            const stats = {};
            
            Promise.all([
                new Promise((res, rej) => {
                    this.db.get('SELECT COUNT(*) as count FROM monitoring_chats WHERE is_active = 1', [], (err, row) => {
                        if (err) rej(err);
                        else { stats.activeChats = row.count; res(); }
                    });
                }),
                new Promise((res, rej) => {
                    this.db.get('SELECT COUNT(DISTINCT space_id) as count FROM monitored_spaces', [], (err, row) => {
                        if (err) rej(err);
                        else { stats.totalSpaces = row.count; res(); }
                    });
                }),
                new Promise((res, rej) => {
                    this.db.get('SELECT COUNT(*) as count FROM detected_campaigns', [], (err, row) => {
                        if (err) rej(err);
                        else { stats.totalCampaigns = row.count; res(); }
                    });
                }),
                new Promise((res, rej) => {
                    this.db.get('SELECT COUNT(*) as count FROM notification_logs WHERE message_sent = 1', [], (err, row) => {
                        if (err) rej(err);
                        else { stats.successfulNotifications = row.count; res(); }
                    });
                })
            ]).then(() => {
                resolve(stats);
            }).catch(reject);
        });
    }

    close() {
        this.db.close();
    }
}

module.exports = Database;
