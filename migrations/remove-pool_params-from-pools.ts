// migrations/20230330123000-remove-underlying-coins.js
// sequelize db:migrate
'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.removeColumn('pools', 'pool_params');
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn('pools', 'pool_params', {
      type: Sequelize.INTEGER,
      allowNull: true,
    });
  },
};
