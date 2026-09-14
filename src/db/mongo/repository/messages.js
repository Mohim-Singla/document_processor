import { modelMap } from '../models/index.js';

/**
 * Fetches messages from the database for a specific group with optional filters, pagination, and sorting.
 * @async
 * @function fetchAllWithGroupId
 * @param {string} groupId - The ID of the group to filter messages by.
 * @param {object} params - Additional query parameters for fetching messages.
 * @param {number} [params.limit] - The maximum number of messages to retrieve.
 * @param {number} [params.offset] - The number of messages to skip (used for pagination).
 * @returns {Promise<Array<object>>} A promise that resolves to an array of messages matching the criteria.
 * @throws {Error} If there is an issue fetching the records from the database.
 * @example
 * const messages = await fetchAllWithGroupId('group456', { limit: 10, offset: 0 });
 * console.log(messages);
 * @description Retrieves messages for the specified group from the database.
 * Results are sorted in descending order by timestamp by default.
 */
async function fetchAll(filter, projection, options) {
  return modelMap.messagesModel.getModel().find(filter, projection, options);
}

/**
 * Module containing database operations for messages.
 * @module messages
 */
export const messages = {
  create,
  fetchAll,
};
