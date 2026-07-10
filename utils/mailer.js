const nodemailer = require('nodemailer');

// Create a transporter
const transporter = nodemailer.createTransport({
  host: 'smtp-relay.brevo.com',
  port: 587,
  secure: false,
  auth: {
    user: (process.env.BREVO_USER || '').trim(),
    pass: (process.env.BREVO_MASTER_KEY || '').trim(),
  },
});

async function sendEmail(to, subject, text) {
  try {
    const fromEmail = (process.env.BREVO_FROM || '').trim();
    const appName = (process.env.APP_NAME || 'Knight Kings').trim();
    const mailOptions = {
      from: `${appName} <${fromEmail}>`,
      to,
      subject,
      text,
    };

    const info = await transporter.sendMail(mailOptions);
    console.log('Message sent: %s', info.messageId);
  } catch (error) {
    console.error('Error sending email:', error.message);
    throw new Error("Error While Sent An OTP on Emails");
  }
}

module.exports = {
  sendEmail, 
}

// Example usage
