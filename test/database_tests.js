'use strict';

var expect = require('chai').expect;
var Database = require('../lib/database');

describe('Database', function() {
  it('fails with an invalid adapter', function() {
    var connection = {
      adapter: 'invalid_adapter',
      username: 'root',
      password: '',
      database: 'azul_test'
    };
    expect(function() {
      Database.create(connection);
    }).to.throw(/no adapter.*invalid_adapter/i);
  });

  it('fails with an object that is not an adapter', function() {
    var connection = {
      adapter: {},
    };
    expect(function() {
      Database.create(connection);
    }).to.throw(/invalid adapter/i);
  });

  it('shows require errors for non-invalid-adapter errors', function() {
    var connection = {
      adapter: '../../../test/fixtures/adapters/missing',
      username: 'root',
      password: '',
      database: 'azul_test'
    };
    expect(function() {
      Database.create(connection);
    }).to.throw(/cannot find module.*missing/i);
  });

  it('fails with when no connection is given', function() {
    expect(function() {
      Database.create();
    }).to.throw(/missing connection/i);
  });
});
