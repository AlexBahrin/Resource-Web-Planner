const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  host: 'smtp.ethereal.email',
  port: 587,
  secure: false,
  auth: {
    user: 'ashton.cruickshank@ethereal.email',
    pass: '3CcTnvyqWEUjpx6Bm4',
  },
});

/**
 * Sends an email notification.
 * @param {string} toEmail The recipient's email address.
 * @param {string} subject The subject of the email.
 * @param {string} textBody The plain text body of the email.
 * @param {string} htmlBody The HTML body of the email (optional).
 */
async function sendNotificationEmail(toEmail, subject, textBody, htmlBody) {
  if (!toEmail) {
    console.error('Email recipient not provided.');
    return;
  }

  const mailOptions = {
    from: '"Resource Web Planner" <rew@rew.com>',
    to: toEmail,
    subject: subject,
    text: textBody,
    html: htmlBody || textBody,
  };

  try {
    let info = await transporter.sendMail(mailOptions);
    console.log('Email sent!');
    if (nodemailer.getTestMessageUrl(info)) {
        console.log('Preview URL: %s', nodemailer.getTestMessageUrl(info));
    }
  } catch (error) {
    console.error('Error sending email:', error);
  }
}

module.exports = { sendNotificationEmail };
