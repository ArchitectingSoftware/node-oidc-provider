'use strict';

const _ = require('lodash');
const config = _.clone(require('../default.config'));

module.exports = {
  config,
  client: {
    client_id: 'client',
    client_secret: 'secret',
    grant_types: ['authorization_code', 'lotto'],
    response_types: ['code'],
    redirect_uris: ['https://client.example.com/cb'],
  }
};
