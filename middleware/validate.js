const AppError = require('../utils/AppError');

function validate({ body = {}, params = {}, query = {} }) {
  return function validateRequest(req, _res, next) {
    const errors = [];
    for (const [source, rules] of [['body', body], ['params', params], ['query', query]]) {
      const values = req[source] || {};
      for (const [field, rule] of Object.entries(rules)) {
        const value = values[field];
        if (rule.required && (value === undefined || value === null || value === '')) {
          errors.push({ field, message: 'is required' });
        } else if (value !== undefined && value !== null) {
          if (rule.type === 'string' && (typeof value !== 'string' || (rule.trim !== false && !value.trim()))) {
            errors.push({ field, message: 'must be a non-empty string' });
          } else if (rule.type === 'number' && (
            !Number.isFinite(Number(value)) ||
            (rule.min !== undefined && Number(value) < rule.min) ||
            (rule.max !== undefined && Number(value) > rule.max) ||
            (rule.integer && !Number.isInteger(Number(value)))
          )) {
            const range = [
              rule.min !== undefined ? `at least ${rule.min}` : null,
              rule.max !== undefined ? `at most ${rule.max}` : null,
              rule.integer ? 'an integer' : null
            ].filter(Boolean).join(' and ');
            errors.push({ field, message: `must be a number${range ? ` (${range})` : ''}` });
          } else if (rule.type === 'array' && !Array.isArray(value)) {
            errors.push({ field, message: 'must be an array' });
          } else if (rule.enum && !rule.enum.includes(value)) {
            errors.push({ field, message: `must be one of: ${rule.enum.join(', ')}` });
          } else if (rule.pattern && typeof value === 'string' && !rule.pattern.test(value)) {
            errors.push({ field, message: 'has an invalid format' });
          }
        }
      }
    }
    if (errors.length) return next(new AppError('Request validation failed', 400, errors));
    next();
  };
}

module.exports = validate;
