const GenericMaster = require('../../models/genericMaster');

// ✅ CREATE
exports.createGenericMaster = async (req, res) => {
  try {
    const { key, value, desc } = req.body;
    const createdBy = req.user?._id;

    const item = new GenericMaster({ key, value, desc, createdBy });
    await item.save();

    res.status(201).json(item);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

// ✅ GET ALL BY KEY (e.g., all categories)
exports.getByKey = async (req, res) => {
  try {
    const { key } = req.params;
    const search = req.query.q || '';
    const query = { key };
    if (search) {
      query.value = { $regex: search, $options: 'i' };
    }
    const items = await GenericMaster.find(query);
    res.json(items);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// ✅ GET BY ID
exports.getById = async (req, res) => {
  try {
    const item = await GenericMaster.findById(req.params.id);
    if (!item) return res.status(404).json({ error: 'Not found' });
    res.json(item);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// ✅ UPDATE
exports.updateGenericMaster = async (req, res) => {
  try {
    const updatedBy = req.user?._id;
    const item = await GenericMaster.findByIdAndUpdate(
      req.params.id,
      { ...req.body, updatedBy },
      { new: true }
    );
    if (!item) return res.status(404).json({ error: 'Not found' });
    res.json(item);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

// ✅ DELETE
exports.deleteGenericMaster = async (req, res) => {
  try {
    const item = await GenericMaster.findByIdAndDelete(req.params.id);
    if (!item) return res.status(404).json({ error: 'Not found' });
    res.json({ message: 'Deleted successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
