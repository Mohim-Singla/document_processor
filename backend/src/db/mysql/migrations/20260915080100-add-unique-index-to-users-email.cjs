/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addIndex('users', ['email'], {
      unique: true,
      name: 'users_email_unique',
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeIndex('users', 'users_email_unique');
  },
};
