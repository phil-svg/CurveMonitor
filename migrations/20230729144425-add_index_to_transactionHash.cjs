"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addIndex("receipts", {
      fields: ["transactionHash"],
      name: "transactionHash_index",
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeIndex("receipts", "transactionHash_index");
  },
};
