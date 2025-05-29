const pool = require('../config/dbConfig');
const { sendNotificationEmail } = require('../util/emailService');

const NOTIFICATION_INTERVALS_DAYS = [30, 28, 21, 14, 7, 6, 5, 4, 3, 2, 1, 0];

async function checkResourceExpirations() {
    console.log('Running checkResourceExpirations task...');
    try {
        const resourceResult = await pool.query(
            "SELECT id, name, expiration_date, user_id FROM resources WHERE expiration_date IS NOT NULL"
        );

        for (const resource of resourceResult.rows) {
            if (!resource.expiration_date) continue;

            const parts = resource.expiration_date.split('-');
            const year = parseInt(parts[0], 10);
            const month = parseInt(parts[1], 10) - 1;
            const day = parseInt(parts[2], 10);
            
            const expDateUtcMidnight = new Date(Date.UTC(year, month, day));

            const currentLocalTime = new Date();
            const currentDayUtcMidnight = new Date(Date.UTC(currentLocalTime.getFullYear(), currentLocalTime.getMonth(), currentLocalTime.getDate()));

            const timeDiff = expDateUtcMidnight.getTime() - currentDayUtcMidnight.getTime();
            const daysUntilExpiration = timeDiff / (1000 * 3600 * 24);

            for (const interval of NOTIFICATION_INTERVALS_DAYS) {
                if (daysUntilExpiration === interval) {
                    const notificationTypeSuffix = interval === 0 ? 'today' : `${interval}_days_prior`;
                    const notificationType = `expiration_${notificationTypeSuffix}`;
                    
                    const friendlyExpirationDate = expDateUtcMidnight.toLocaleDateString(undefined, { 
                        year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC' 
                    });

                    let message;
                    if (interval === 0) {
                        message = `Attention: Resource \"${resource.name}\" requires inspection/is expiring today, ${friendlyExpirationDate}.`;
                    } else if (interval === 1) {
                        message = `Reminder: Resource \"${resource.name}\" requires inspection/is expiring in 1 day, on ${friendlyExpirationDate}.`;
                    } else {
                        message = `Reminder: Resource \"${resource.name}\" requires inspection/is expiring in ${interval} days, on ${friendlyExpirationDate}.`;
                    }

                    const alreadyNotifiedToday = await pool.query(
                        `SELECT id FROM notifications 
                         WHERE resource_id = $1 AND type = $2 AND DATE(created_at AT TIME ZONE 'UTC') = DATE($3 AT TIME ZONE 'UTC')`,
                        [resource.id, notificationType, new Date()]
                    );


                    if (alreadyNotifiedToday.rows.length === 0) {
                        console.log(`Resource \"${resource.name}\" (ID: ${resource.id}) matches ${interval} day(s) interval. Sending notifications.`);
                        
                        const ownerDetailsResult = await pool.query('SELECT id, email, group_id FROM users WHERE id = $1', [resource.user_id]);
                        if (ownerDetailsResult.rows.length > 0) {
                            const owner = ownerDetailsResult.rows[0];
                            const recipients = [];

                            if (owner.group_id) {
                                const groupMembersResult = await pool.query('SELECT id, email FROM users WHERE group_id = $1', [owner.group_id]);
                                groupMembersResult.rows.forEach(member => recipients.push({id: member.id, email: member.email}));
                            } else {
                                recipients.push({id: owner.id, email: owner.email});
                            }

                            for (const recipient of recipients) {
                                try {
                                    await pool.query(
                                        'INSERT INTO notifications (user_id, resource_id, message, type, is_read, created_at) VALUES ($1, $2, $3, $4, FALSE, NOW())',
                                        [recipient.id, resource.id, message, notificationType]
                                    );
                                    if (recipient.email) {
                                        sendNotificationEmail(recipient.email, `Resource Expiration Alert: ${resource.name}`, message)
                                            .catch(emailErr => console.error(`Failed to send expiration email to ${recipient.email}:`, emailErr));
                                    }
                                } catch (dbErr) {
                                    console.error(`Failed to insert expiration notification for user ${recipient.id}, resource ${resource.id}:`, dbErr);
                                }
                            }
                        }
                    } else {
                         console.log(`Resource \"${resource.name}\" (ID: ${resource.id}) already notified for ${interval} day(s) interval today.`);
                    }
                    break; 
                }
            }
        }
        console.log('Finished checkResourceExpirations task.');
    } catch (error) {
        console.error('Error in checkResourceExpirations task:', error);
    }
}

function startExpirationChecker(intervalMinutes = 60 * 24) {
    console.log(`Starting expiration checker. Will run every ${intervalMinutes} minutes.`);
    
    checkResourceExpirations().catch(err => console.error("Initial expiration check failed:", err));
    
    setInterval(() => {
        checkResourceExpirations().catch(err => console.error("Scheduled expiration check failed:", err));
    }, intervalMinutes * 60 * 1000);
}

module.exports = { checkResourceExpirations, startExpirationChecker };
