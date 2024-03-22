"use strict";

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addIndex("abis_ethereum", ["contract_address"]);
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.removeIndex("abis_ethereum", ["contract_address"]);
  },
};
