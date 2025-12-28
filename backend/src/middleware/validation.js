import Joi from 'joi';

/**
 * Validation middleware factory
 * @param {Object} schema - Joi schema for validation
 * @param {string} property - Property to validate (body, query, params)
 * @returns {Function} Express middleware function
 */
const validate = (schema, property = 'body') => {
  return (req, res, next) => {
    const { error, value } = schema.validate(req[property], {
      abortEarly: false,
      allowUnknown: false,
      stripUnknown: true
    });

    if (error) {
      const errors = error.details.map(detail => ({
        field: detail.path.join('.'),
        message: detail.message
      }));

      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors
      });
    }

    req[property] = value;
    next();
  };
};

// Auth validation schemas
const authSchemas = {
  signup: Joi.object({
    name: Joi.string().min(2).max(100).required().messages({
      'string.min': 'Name must be at least 2 characters',
      'string.max': 'Name cannot exceed 100 characters',
      'any.required': 'Name is required'
    }),
    email: Joi.string().email().required().messages({
      'string.email': 'Please provide a valid email',
      'any.required': 'Email is required'
    }),
    password: Joi.string().min(6).required().messages({
      'string.min': 'Password must be at least 6 characters',
      'any.required': 'Password is required'
    }),
    language: Joi.string().valid('en', 'hi', 'es', 'fr').default('en')
  }),

  login: Joi.object({
    email: Joi.string().email().required(),
    password: Joi.string().required()
  })
};

// Session validation schemas
const sessionSchemas = {
  create: Joi.object({
    title: Joi.string().min(3).max(200).required().messages({
      'string.min': 'Title must be at least 3 characters',
      'string.max': 'Title cannot exceed 200 characters',
      'any.required': 'Title is required'
    }),
    description: Joi.string().max(1000).allow(''),
    language: Joi.string().valid('en', 'hi', 'es', 'fr').default('en'),
    maxUsers: Joi.number().integer().min(1).max(1000).default(100)
  }),

  join: Joi.object({
    sessionId: Joi.string().required()
  }),

  update: Joi.object({
    title: Joi.string().min(3).max(200),
    description: Joi.string().max(1000).allow(''),
    isLive: Joi.boolean(),
    language: Joi.string().valid('en', 'hi', 'es', 'fr'),
    maxUsers: Joi.number().integer().min(1).max(1000)
  })
};

// Message validation schemas
const messageSchemas = {
  create: Joi.object({
    sessionId: Joi.string().required(),
    text: Joi.string().min(1).max(1000).required().messages({
      'string.min': 'Message cannot be empty',
      'string.max': 'Message cannot exceed 1000 characters',
      'any.required': 'Message text is required'
    })
  })
};

// Summary validation schemas
const summarySchemas = {
  generate: Joi.object({
    sessionId: Joi.string().required(),
    type: Joi.string().valid('key_points', 'action_items', 'full_summary').default('full_summary')
  })
};

export {
  validate,
  authSchemas,
  sessionSchemas,
  messageSchemas,
  summarySchemas
};

