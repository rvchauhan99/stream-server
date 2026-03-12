const User = require('../../models/user');
const bcrypt = require('bcrypt');
const validators = require('../../middleware/user');
// const LoginHistory = require('../models/loginHistory');
// Create new user
exports.createUser = async (req, res) => {
  try {

    const { isValid, errors } = validators.validateCreateUser(req.body);
    if (!isValid) {
      return res.status(400).json({ message: "validation failed", errors: errors });
    }

    const { name, email, password, role, profileImage, subscriptionId, preferences } = req.body;
    const existing = await User.findOne({ email });
    if (existing) {
      return res.status(409).json({ message: 'Email already exists' });
    }
    const hashedPassword = await bcrypt.hash(password, 10);
    const user = new User({ name, email, passwordHash: hashedPassword, role, profileImage, subscriptionId, preferences });
    await user.save();
    res.status(201).json({ message: 'User created successfully', user });
  } catch (error) {
    console.error('Create User error:', error.message);
    res.status(500).json({ message: 'Internal Server Error' });
  }
};

// Get all users
exports.getAllUsers = async (req, res) => {
  try {
    const users = await User.find().select('-passwordHash'); // Exclude password
    res.json(users);
  } catch (error) {
    console.error('Get All Users error:', error.message);
    res.status(500).json({ message: 'Internal Server Error' });
  }
};

// Get single user
exports.getUserById = async (req, res) => {
  try {
    const user = await User.findById(req.params.id).select('-passwordHash');
    if (!user) return res.status(404).json({ message: 'User not found' });
    res.json(user);
  } catch (error) {
    console.error('Get User error:', error.message);
    res.status(500).json({ message: 'Internal Server Error' });
  }
};

// Update user
exports.updateUser = async (req, res) => {
  try {
    let validate = validators.validateUpdateUser(req, req.body);
    if (!validate.isValid) {
      return res.status(400).json({ message: "validation failed", errors: validate.errors });
    }
    console.log("Validation  PAssed ");

    const { name, preferences } = req.body;

    console.log("Name", name);
    // console.log("Profile Image" ,  profileImage);
    console.log("Preferences", preferences);


    const updateData = { name, preferences };

    // console.log("Update Data" ,  updateData);

    const user = await User.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true, runValidators: true }
    ).select('-passwordHash');

    if (!user) return res.status(404).json({ message: 'User not found' });

    res.json({ message: 'User updated successfully', user });
  } catch (error) {
    console.error('Update User error:', error.message);
    res.status(500).json({ message: 'Internal Server Error' });
  }
};

// Delete user
exports.deleteUser = async (req, res) => {
  try {
    const user = await User.findByIdAndDelete(req.params.id);
    if (!user) return res.status(404).json({ message: 'User not found' });

    res.json({ message: 'User deleted successfully' });
  } catch (error) {
    console.error('Delete User error:', error.message);
    res.status(500).json({ message: 'Internal Server Error' });
  }
};
exports.getUsers = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const search = req.query.search || '';

    const matchQuery = search != '' ? {
      $or: [
        { name: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } }
      ]
    } : {};

    const users = await User.aggregate([
      { $match: matchQuery },

      // Join with login history for last login time
      {
        $lookup: {
          from: 'loginhistories', // MongoDB pluralizes model names automatically
          let: { userId: '$_id' },
          pipeline: [
            { $match: { $expr: { $eq: ['$user', '$$userId'] } } },
            { $sort: { loginTime: -1 } },
            { $limit: 1 }
          ],
          as: 'lastLogin'
        }
      },

      {
        $addFields: {
          lastLoginTime: {
            $ifNull: [{ $arrayElemAt: ['$lastLogin.loginTime', 0] }, null]
          }
        }
      },

      { $project: { passwordHash: 0, lastLogin: 0 } },

      { $sort: { createdAt: -1 } },
      { $skip: (page - 1) * limit },
      { $limit: limit }
    ]);

    const total = await User.countDocuments(matchQuery);

    res.status(200).json({
      users,
      page,
      totalPages: Math.ceil(total / limit),
      total
    });
  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).json({ message: 'Failed to fetch users' });
  }
};
exports.getUserStats = async (req, res) => {
  try {
    console.log("getUserStats called");

    const [totalUsers, activeUsers, usersWithSubscriptions] = await Promise.all([
      User.countDocuments(),
      User.countDocuments({ isActive: true }),
      User.countDocuments({ subscriptionId: { $ne: null } }),
    ]);

    res.status(200).json({
      totalUsers,
      activeUsers,
      activeSubscriptions: usersWithSubscriptions,
    });
  } catch (error) {
    console.error('Error fetching user stats:', error);
    res.status(500).json({ message: 'Failed to fetch user statistics' });
  }
};
exports.blockUser = async (req, res) => {
  try {
    const { id } = req.params;
    const user = await User.findById(id);

    if (!user) return res.status(404).json({ message: 'User not found' });

    user.isActive = !user.isActive;
    await user.save();

    res.json({ message: `User is now ${user.isActive ? 'active' : 'blocked'}` });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Internal server error' });
  }
}

exports.searchUsers = async (req, res) => {
  try {
    const search = req.query.q || req.query.search || '';
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;

    const matchQuery = {
      ...(search && {
        $or: [
          { name: { $regex: search, $options: 'i' } },
          { email: { $regex: search, $options: 'i' } },
        ],
      }),
      ...(req.query.role && { role: req.query.role })
    };

    const users = await User.find(matchQuery)
      .select('-passwordHash')
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit);

    const total = await User.countDocuments(matchQuery);

    res.status(200).json({ users, page, total, totalPages: Math.ceil(total / limit) });
  } catch (error) {
    console.error('Search Users error:', error.message);
    res.status(500).json({ message: 'Internal Server Error' });
  }
};
