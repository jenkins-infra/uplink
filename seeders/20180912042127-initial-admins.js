'use strict';

module.exports = {
  up: (queryInterface, Sequelize) => {
    return queryInterface.bulkInsert('grants', [
      {
        name: 'dduportal',
        type: '*',
      },
      {
        name: 'daniel-beck',
        type: '*',
      },
      {
        name: 'lemeurherve',
        type: '*',
      },
    ]);
  },

  down: (queryInterface, Sequelize) => {
    return queryInterface.bulkDelete('grants', null, {});
  }
};
