const validator = require('validator');
const mongoose = require('mongoose');

function validateCreatePlan(data) {
  const errors = {};

  if (!data.name || typeof data.name !== 'string' || data.name.trim().length < 2) {
    errors.name = 'Name is required and must be at least 2 characters';
  }

  if (data.description && typeof data.description !== 'string') {
    errors.description = 'Description must be a string';
  }

  if (!Array.isArray(data.features)) {
    errors.features = 'Features must be an array of strings';
  }

  if (typeof data.price !== 'number' || data.price < 0) {
    errors.price = 'Price must be a positive number';
  }

  if (!Number.isInteger(data.validity) || data.validity <= 0) {
    errors.validity = 'Validity must be a positive integer (months)';
  }

  const isValid = Object.keys(errors).length === 0;
  return { isValid, errors };
}

function validateUpdatePlan(id, data) {
  const errors = {};

  if (!id || !mongoose.Types.ObjectId.isValid(id)) {
    errors.id = 'Valid Plan ID is required';
  }

  if (data.name && (typeof data.name !== 'string' || data.name.trim().length < 2)) {
    errors.name = 'Name must be at least 2 characters';
  }

  if (data.description && typeof data.description !== 'string') {
    errors.description = 'Description must be a string';
  }

  if (data.features && !Array.isArray(data.features)) {
    errors.features = 'Features must be an array';
  }

  if (data.price !== undefined && (typeof data.price !== 'number' || data.price < 0)) {
    errors.price = 'Price must be a positive number';
  }

  if (data.validity !== undefined && (!Number.isInteger(data.validity) || data.validity <= 0)) {
    errors.validity = 'Validity must be a positive integer';
  }

  const isValid = Object.keys(errors).length === 0;
  return { isValid, errors };
}

module.exports = { validateCreatePlan, validateUpdatePlan };
