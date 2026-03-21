const UpiAccount = require('../../models/upiAccount');

exports.createUpi = async (req, res) => {
  try {
    const { upiId } = req.body;
    const existing = await UpiAccount.findOne({ upiId });
    if (existing) {
      return res.status(400).json({ message: 'UPI ID already exists.' });
    }
    const upi = new UpiAccount({
      upiId,
      createdBy: req.user?._id
    });
    await upi.save();
    res.status(201).json(upi);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.getAllUpis = async (req, res) => {
  try {
    const upis = await UpiAccount.find().populate('createdBy', 'name email');
    res.status(200).json(upis);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.getActiveUpi = async (req, res) => {
  try {
    // Pick a random active UPI
    const upis = await UpiAccount.find({ isActive: true });
    if (!upis || upis.length === 0) {
      return res.status(404).json({ message: 'No active UPI accounts found.' });
    }
    const randomIndex = Math.floor(Math.random() * upis.length);
    res.status(200).json(upis[randomIndex]);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.toggleUpi = async (req, res) => {
  try {
    const upi = await UpiAccount.findById(req.params.id);
    if (!upi) {
      return res.status(404).json({ message: 'UPI Account not found.' });
    }
    upi.isActive = !upi.isActive;
    await upi.save();
    res.status(200).json(upi);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.deleteUpi = async (req, res) => {
  try {
    await UpiAccount.findByIdAndDelete(req.params.id);
    res.status(200).json({ message: 'UPI Account deleted successfully.' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
