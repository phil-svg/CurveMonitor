"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    // Add a foreign key in 'transactions' referencing 'transaction_details'
    await queryInterface.addColumn("transactions", "transactionDetailsTxId", {
      type: Sequelize.INTEGER,
      allowNull: true,
      references: {
        model: "transaction_details", // Name of the referenced table
        key: "tx_id",
      },
      onUpdate: "CASCADE",
      onDelete: "SET NULL",
    });
  },

  async down(queryInterface, Sequelize) {
    // Revert the changes by removing the column from 'transactions'
    await queryInterface.removeColumn("transactions", "transactionDetailsTxId");
  },
};
