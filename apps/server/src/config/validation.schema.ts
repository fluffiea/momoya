import * as Joi from 'joi';

export const validationSchema = Joi.object({
  NODE_ENV: Joi.string()
    .valid('development', 'production', 'test')
    .default('development'),
  PORT: Joi.number().integer().min(1).max(65535).default(3000),
  MONGODB_URI: Joi.string()
    .uri({ scheme: ['mongodb', 'mongodb+srv'] })
    .required(),
  REDIS_URL: Joi.string()
    .uri({ scheme: ['redis', 'rediss'] })
    .default('redis://127.0.0.1:6379'),
  JWT_ACCESS_SECRET: Joi.string().min(16).required(),
  JWT_ACCESS_TTL: Joi.string().default('2h'),
  JWT_REFRESH_SECRET: Joi.string().min(16).required(),
  JWT_REFRESH_TTL: Joi.string().default('14d'),
  UPLOAD_DIR: Joi.string().default('./uploads'),
  STATIC_BASE_URL: Joi.string().uri().default('http://localhost:3000/static'),
  UPLOAD_MAX_SIZE_BYTES: Joi.number()
    .integer()
    .min(1024)
    .default(5 * 1024 * 1024),
  SWAGGER_ENABLED: Joi.string()
    .valid('true', 'false', '1', '0', 'yes', 'no', 'on', 'off')
    .optional(),
  SWAGGER_PATH: Joi.string().default('api/docs'),
});
