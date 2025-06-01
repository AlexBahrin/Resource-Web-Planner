const pool = require('../config/dbConfig');
const { sendNotificationEmail } = require('../util/emailService');

const CHECK_INTERVAL_HOURS = 24;
const NOTIFICATION_THROTTLE_HOURS = 23.5;

async function checkLowStockResources() {
    console.log('Running checkLowStockResources task...');
    const now = new Date();

    try {
        const resourceResult = await pool.query(
            "SELECT id, name, quantity, low_stock_threshold, user_id FROM resources WHERE CAST(quantity AS NUMERIC(10,2)) < ROUND(CAST(low_stock_threshold AS NUMERIC(10,2)))"
        );

        if (resourceResult.rows.length === 0) {
            console.log('No resources are currently below their low stock threshold.');
            return;
        }

        for (const resource of resourceResult.rows) {
            const message = `Periodic Check: Resource \"${resource.name}\" is low in stock (${resource.quantity} remaining, threshold: ${resource.low_stock_threshold}).`;
            const notificationType = 'low_stock_periodic_check';

            const ownerDetailsResult = await pool.query('SELECT id, email, group_id FROM users WHERE id = $1', [resource.user_id]);
            if (ownerDetailsResult.rows.length === 0) {
                console.warn(`Owner not found for resource ID ${resource.id}, skipping low stock notification.`);
                continue;
            }
            
            const owner = ownerDetailsResult.rows[0];
            const recipients = [];

            if (owner.group_id) {
                const groupMembersResult = await pool.query('SELECT id, email FROM users WHERE group_id = $1', [owner.group_id]);
                groupMembersResult.rows.forEach(member => recipients.push({ id: member.id, email: member.email }));
            } else {
                recipients.push({ id: owner.id, email: owner.email });
            }

            for (const recipient of recipients) {
                const recentNotificationCheck = await pool.query(
                    `SELECT id FROM notifications
                     WHERE resource_id = $1
                       AND user_id = $2
                       AND type = $3
                       AND created_at >= NOW() - INTERVAL '${NOTIFICATION_THROTTLE_HOURS} hours'`,
                    [resource.id, recipient.id, notificationType]
                );

                if (recentNotificationCheck.rows.length === 0) {
                    console.log(`Resource \"${resource.name}\" (ID: ${resource.id}) is low. Sending notification to user ID ${recipient.id}.`);
                    try {
                        await pool.query(
                            'INSERT INTO notifications (user_id, resource_id, message, type, is_read, created_at) VALUES ($1, $2, $3, $4, FALSE, NOW())',
                            [recipient.id, resource.id, message, notificationType]
                        );
                        if (recipient.email) {
                            sendNotificationEmail(recipient.email, `Low Stock Alert: ${resource.name}`, message)
                                .catch(emailErr => console.error(`Failed to send periodic low stock email to ${recipient.email}:`, emailErr));
                        }
                    } catch (dbErr) {
                        console.error(`Failed to insert periodic low stock notification for user ${recipient.id}, resource ${resource.id}:`, dbErr);
                    }
                } else {
                    console.log(`Periodic low stock notification for resource \"${resource.name}\" (ID: ${resource.id}) already sent to user ID ${recipient.id} recently. Skipping.`);
                }
            }
        }
        console.log('Finished checkLowStockResources task.');
    } catch (error) {
        console.error('Error in checkLowStockResources task:', error);
    }
}

function startLowStockChecker(intervalMinutes = CHECK_INTERVAL_HOURS * 60) {
    console.log(`Starting low stock checker. Will run every ${intervalMinutes} minutes.`);
    
    checkLowStockResources().catch(err => console.error("Initial low stock check failed:", err));
    
    setInterval(() => {
        checkLowStockResources().catch(err => console.error("Scheduled low stock check failed:", err));
    }, intervalMinutes * 60 * 1000);
}

module.exports = { checkLowStockResources, startLowStockChecker };
