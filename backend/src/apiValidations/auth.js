import Joi from 'joi';

/**
 * @typedef {Object} SignupSchema
 * @property {string} name - The name of the user (required).
 * @property {string} email - The email address of the user (must be a valid email, required).
 * @property {string} password - The password for the user account (required).
 */
const test = {
  body: Joi.object({
    name: Joi.string().required(),
    email: Joi.string().email().required(),
    password: Joi.string().required(),
  }),
};

export const authSchema = {
  test,
};
