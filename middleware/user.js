const validator = require('validator');
const mongoose = require('mongoose');

// Helper: Validate MongoDB ObjectId
function isValidObjectId(id) {
  return mongoose.Types.ObjectId.isValid(id);
}

// ➡️ Validate Create User
function validateCreateUser(data) {
  const errors = {};

  if (!data.name || typeof data.name !== 'string' || data.name.trim().length < 2) {
    errors.name = 'Name must be at least 2 characters';
  }

  if (!data.email || !validator.isEmail(data.email)) {
    errors.email = 'Valid email is required';
  }

  if (!data.password || !validator.isStrongPassword(data.password)) {
    errors.password = 'Password must be strong (8+ characters, uppercase, lowercase, number, special char)';
  }

  const allowedRoles = ['viewer', 'creator', 'admin', 'superadmin'];
  if (!data.role || !allowedRoles.includes(data.role)) {
    errors.role = 'Role must be one of viewer, creator, admin, superadmin';
  }

  const isValid = Object.keys(errors).length === 0;
  return { isValid, errors };
}

// ➡️ Validate Update User
function validateUpdateUser(req , data) {
  const errors = {};

  if(!req.params.id || !isValidObjectId(req.params.id)) {
    errors.id = 'Valid User ID is required';
  }
  if (data.name && (typeof data.name !== 'string' || data.name.trim().length < 2)) {
    errors.name = 'Name must be at least 2 characters';
  }

  if (data.email && !validator.isEmail(data.email)) {
    errors.email = 'Valid email is required';
  }

  const allowedRoles = ['viewer', 'creator', 'admin', 'superadmin'];
  if (data.role && !allowedRoles.includes(data.role)) {
    errors.role = 'Role must be one of viewer, creator, admin, superadmin';
  }

  if (data.profileImage && !validator.isURL(data.profileImage)) {
    errors.profileImage = 'Profile image must be a valid URL';
  }

  if (data.subscriptionId && !Number.isInteger(data.subscriptionId)) {
    errors.subscriptionId = 'Subscription ID must be an integer';
  }

  if (data.preferences) {
    const allowedQualities = ['auto', '1080p', '720p', '480p'];
    if (data.preferences.quality && !allowedQualities.includes(data.preferences.quality)) {
      errors['preferences.quality'] = 'Quality must be one of auto, 1080p, 720p, 480p';
    }

    if (data.preferences.notifications !== undefined && typeof data.preferences.notifications !== 'boolean') {
      errors['preferences.notifications'] = 'Notifications must be a boolean';
    }

    if (data.preferences.autoplay !== undefined && typeof data.preferences.autoplay !== 'boolean') {
      errors['preferences.autoplay'] = 'Autoplay must be a boolean';
    }
  }

  const isValid = Object.keys(errors).length === 0;
  return { isValid, errors };
}

// ➡️ Validate User ID (for Get / Delete APIs)
function validateUserIdParam(id) {
  const errors = {};

  if (!id || !isValidObjectId(id)) {
    errors.id = 'Valid User ID is required';
  }

  const isValid = Object.keys(errors).length === 0;
  return { isValid, errors };
}

// ➡️ (Optional) Validate Login User
function validateLoginUser(data) {
  const errors = {};

  if (!data.email || !validator.isEmail(data.email)) {
    errors.email = 'Valid email is required';
  }

  if (!data.password || typeof data.password !== 'string' || data.password.length < 6) {
    errors.password = 'Password must be at least 6 characters';
  }

  const isValid = Object.keys(errors).length === 0;
  return { isValid, errors };
}

// ➡️ (Optional) Validate Change Password
function validateChangePassword(data) {
  const errors = {};

  if (!data.oldPassword || typeof data.oldPassword !== 'string') {
    errors.oldPassword = 'Old password is required';
  }

  if (!data.newPassword || !validator.isStrongPassword(data.newPassword)) {
    errors.newPassword = 'New password must be strong (8+ characters, uppercase, lowercase, number, special char)';
  }

  const isValid = Object.keys(errors).length === 0;
  return { isValid, errors };
}

module.exports = {
  validateCreateUser,
  validateUpdateUser,
  validateUserIdParam,
  validateLoginUser,
  validateChangePassword
};
