const nodemailer = require('nodemailer');

// Create a transporter
const transporter = nodemailer.createTransport({
  host: 'smtp-relay.brevo.com',
  port: 587,
  secure: false, // Use TLS - false for port 587
  auth: {
    user: process.env.BREVO_USER, // Your Brevo login
    pass: process.env.BREVO_MASTER_KEY,          // Your Brevo master key
  },
});

// Define the email sending function
async function sendEmail(to, subject, text) {
  try {
    const mailOptions = {
      from: `'${process.env.APP_NAME} ${process.env.BREVO_FROM}'`, // sender address
      to: to, // list of receivers
      subject: subject, // Subject line
      text: text, // plain text body
      // html: '<b>Hello world?</b>' // If you want to send HTML mail
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
