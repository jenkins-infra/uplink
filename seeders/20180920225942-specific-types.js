'use strict';

module.exports = {
  up: (queryInterface, Sequelize) => {
    return queryInterface.bulkInsert('grants', [
      {
        name: 'dduportal',
        type: 'jest-example',
      },
    ]);
  },

  down: (queryInterface, Sequelize) => {
  }
};
