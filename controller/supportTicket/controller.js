const SupportTicket = require('../../models/supportTicket');
const User = require('../../models/user');
const { sendEmail } = require('../../utils/mailer');

exports.createTicket = async (req, res) => {
  try {
    const { subject, message, priority } = req.body;
    const userId = req.user.id;

    if (!subject || !message) {
      return res.status(400).json({ message: 'Subject and message are required' });
    }

    const ticket = await SupportTicket.create({
      userId,
      subject,
      message,
      priority
    });

    const user = await User.findById(userId);
    const supportEmail = process.env.SUPPORT_EMAIL || process.env.BREVO_FROM;

    // Send email to admin/support
    await sendEmail(
      supportEmail,
      `[Support Ticket #${ticket._id}] ${subject}`,
      `A new support ticket has been submitted by ${user.name} (${user.email}).

Details:
Ticket ID: #${ticket._id}
Subject: ${subject}
Priority: ${priority || 'medium'}
Message:
${message}

User Details:
Name: ${user.name}
Email: ${user.email}
Role: ${user.role}
Account Created At: ${user.createdAt}
`
    );

    res.status(201).json({ 
      message: 'Support ticket submitted successfully. Our team will contact you soon.', 
      ticket 
    });

  } catch (error) {
    console.error('Error creating support ticket:', error);
    res.status(500).json({ message: 'Failed to submit support ticket' });
  }
};

exports.getMyTickets = async (req, res) => {
  try {
    const tickets = await SupportTicket.find({ userId: req.user.id }).sort({ createdAt: -1 });
    res.json(tickets);
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch tickets' });
  }
};

exports.getAllTickets = async (req, res) => {
  try {
    const tickets = await SupportTicket.find().populate('userId', 'name email').sort({ createdAt: -1 });
    res.json(tickets);
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch tickets' });
  }
};
