/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface) {
    await queryInterface.addIndex('users', ['email'], {
      unique: true,
      name: 'users_email_unique',
    });
  },

  async down(queryInterface) {
    await queryInterface.removeIndex('users', 'users_email_unique');
  },
};
