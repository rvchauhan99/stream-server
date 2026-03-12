function validateCreateVideo(data) {
  const errors = {};

  if (!data.title || typeof data.title !== 'string' || data.title.trim().length < 2) {
    errors.title = 'Title is required and must be at least 2 characters long';
  }

  if (data.description && typeof data.description !== 'string') {
    errors.description = 'Description must be a string';
  }

  if (!data.category || typeof data.category !== 'string') {
    errors.category = 'Category is required and must be a string';
  }


  if ((data.type && !['free', 'paid', 'rent'].includes(data.type)) || !data.type) {
    errors.type = 'Type must be one of: free, paid, or rent';
  }

  if (data.type === 'rent') {
    if (!data.price || isNaN(parseFloat(data.price)) || parseFloat(data.price) < 0) {
      errors.price = 'Price is required for rental videos and must be a valid number';
    }
  }

  if (!data.visibility || !['public', 'private', 'scheduled'].includes(data.visibility)) {
    errors.visibility = 'Visibility must be one of: public or private or scheduled';
  }
  data.tags = data.tags ? JSON.parse(data.tags) : [];

  console.log("Array.isArray(data.tags)", Array.isArray(data.tags))
  if (data.tags && !Array.isArray(data.tags)) {
    errors.tags = 'Tags must be an array of strings';
  }

  if (data.geoRestrictions && !Array.isArray(data.geoRestrictions)) {
    errors.geoRestrictions = 'Geo restrictions must be an array of country codes';
  }

  if (!data.socketId || typeof data.socketId !== 'string' || data.socketId.trim().length < 5) {
    errors.socketId = 'Socket ID is required and must be a valid string';
  }

  const isValid = Object.keys(errors).length === 0;
  return { isValid, errors };
}

function validateCreateThirdPartyVideo(data) {
  const errors = {};

  if (!data.title || typeof data.title !== 'string' || data.title.trim().length < 2) {
    errors.title = 'Title is required and must be at least 2 characters';
  }

  if (data.description && typeof data.description !== 'string') {
    errors.description = 'Description must be a string';
  }

  if (!data.category || typeof data.category !== 'string') {
    errors.category = 'Category is required and must be a string';
  }

  data.tags = data.tags ? JSON.parse(data.tags) : [];
  if (data.tags && !Array.isArray(data.tags)) {
    errors.tags = 'Tags must be an array of strings';
  }

  if (data.visibility && !['public', 'private', 'scheduled'].includes(data.visibility)) {
    errors.visibility = 'Visibility must be public, private, or scheduled';
  }

  if (!data.filepath || typeof data.filepath !== 'string') {
    errors.filepath = 'Filepath (third party video URL) is required';
  }

  const isValid = Object.keys(errors).length === 0;
  return { isValid, errors };
}

// module.exports = { validateCreateThirdPartyVideo };


module.exports = { validateCreateVideo, validateCreateThirdPartyVideo };
