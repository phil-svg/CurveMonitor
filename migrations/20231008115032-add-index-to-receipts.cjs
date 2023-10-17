"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.sequelize.query(`CREATE INDEX CONCURRENTLY "transactionHash_idx" ON "receipts" ("transactionHash")`);
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeIndex("receipts", "transactionHash_idx");
  },
};
