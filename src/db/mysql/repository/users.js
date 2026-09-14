import { modelMap } from '../models/index.js';

/**
 * Fetches a single user record from the MySQL database using Sequelize.
 * @async
 * @function fetchOne
 * @param {object} options - Sequelize query options, including `where` for filters and `attributes` for projections.
 * @returns {Promise<object|null>} The matched user record or `null` if no user is found.
 * @example
 * const user = await users.fetchOne({ where: { email: 'example@example.com' }, attributes: ['name', 'email'] });
 * console.log(user);
 * @description This function queries the database for a single user record based on the provided options.
 */
async function fetchOne(options) {
  return modelMap.usersModel.getModel().findOne(options);
}

/**
 * Creates a new user record in the MySQL database using Sequelize.
 * @async
 * @function create
 * @param {object} userData - Data for the new user.
 * @param {string} userData.email - User's email address.
 * @param {string} userData.name - User's name.
 * @param {string} userData.password - User's password.
 * @param {boolean} userData.isEnabled - Indicates if the user account is enabled.
  * @param {object} [transaction] - An optional transaction object for managing the operation within a transaction.
 * @returns {Promise<object>} The created user record.
 * @example
 * const newUser = await users.create({
 *   email: 'example@example.com',
 *   name: 'John Doe',
 *   password: 'securepassword',
 *   isEnabled: true
 * });
 * console.log(newUser);
 * @description This function interacts with the database to create a new user record using the `usersModel`.
 */
async function create(userData, transaction) {
  return modelMap.usersModel.getModel().create(userData, { transaction });
}

/**
 * Module containing database operations for groups.
 * @module users
 */
export const users = {
  create,
  fetchOne,
};
