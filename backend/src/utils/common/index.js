import _ from 'lodash';
import { v4 as uuidv4 } from 'uuid';
import { mysqlConnection } from '../../db/mysql/connection/index.js';

export const common = {
  /**
   * Converts a JSON object to a string.
   * @function stringifyJSON
   * @param {Object} data - The JSON object to stringify.
   * @returns {string} The stringified JSON.
   * @example
   * const jsonData = { key: 'value' };
   * const result = common.stringifyJSON(jsonData);
   * console.log(result); // '{"key":"value"}'
   */
  stringifyJSON: (data) => {
    return JSON.stringify(data);
  },

  /**
   * Checks if the given data is `null` or `undefined`.
   * @function isNullorUndefined
   * @param {*} data - The data to check.
   * @returns {boolean} `true` if the data is `null` or `undefined`, otherwise `false`.
   * @example
   * console.log(common.isNullorUndefined(null)); // true
   * console.log(common.isNullorUndefined(undefined)); // true
   * console.log(common.isNullorUndefined('value')); // false
   */
  isNullorUndefined: (data) => {
    return _.isNull(data) || _.isUndefined(data);
  },

  /**
   * Checks if the given data is a boolean value.
   * @function isBoolean
   * @param {*} data - The data to check.
   * @returns {boolean} `true` if the data is a boolean, otherwise `false`.
   * @example
   * console.log(common.isBoolean(true)); // true
   * console.log(common.isBoolean('true')); // false
   */
  isBoolean: (data) => {
    return _.isBoolean(data);
  },

  /**
   * Parses a value to its boolean representation.
   * @function parseBoolean
   * @param {*} data - The data to parse.
   * @param {boolean} [defaultVal=false] - The default value to return if the data is `null` or `undefined`.
   * @returns {boolean} `true` if the value is boolean `true` or the string `'true'` (case-insensitive), otherwise `false`.
   * @example
   * console.log(common.parseBoolean('true')); // true
   * console.log(common.parseBoolean('false')); // false
   * console.log(common.parseBoolean(undefined, true)); // true
   */
  parseBoolean: (data, defaultVal = false) => {
    if (common.isNullorUndefined(data)) {
      return defaultVal;
    }

    if (common.isBoolean(data)) {
      return data;
    }

    return data.toLowerCase() === 'true';
  },

  /**
   * Generates a unique UUID (Universally Unique Identifier).
   * @function createUuid
   * @returns {string} A new UUID.
   * @example
   * const uuid = common.createUuid();
   * console.log(uuid); // Example: '123e4567-e89b-12d3-a456-426614174000'
   */
  createUuid: () => {
    return uuidv4();
  },

  /**
   * Fetches a new SQL transaction instance.
   * @async
   * @function fetchSqlTransactionInstance
   * @returns {Promise<object>} Resolves to the transaction instance.
   * @description This function retrieves a new transaction instance from the MySQL connection.
   */
  fetchSqlTransactionInstance: async () => {
    return mysqlConnection.getInstance().transaction();
  },

  /**
   * Commits the provided SQL transaction.
   * @async
   * @function commitTransaction
   * @param {object} transaction - The transaction instance to commit.
   * @returns {Promise<void>} Resolves once the transaction is committed.
   * @description This function commits the given transaction to the database.
   */
  commitTransaction: async (transaction) => {
    return transaction.commit();
  },

  /**
   * Rolls back the provided SQL transaction.
   * @async
   * @function rollbackTransaction
   * @param {object} transaction - The transaction instance to roll back.
   * @returns {Promise<void>} Resolves once the transaction is rolled back, or undefined if no transaction is provided.
   * @description This function rolls back the given transaction if it exists, reverting any changes made during the transaction.
   */
  rollbackTransaction: async (transaction) => {
    if (transaction) {
      return transaction.rollback();
    }
  },
};
