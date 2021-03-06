'use strict';

var BluebirdPromise = require('bluebird');
var Adapter = require('../../lib/adapters/base');

var sequence = 0;
function FakeAdapterClient() { this.id = sequence++; }

/**
 * Mock adapter for testing.
 *
 * @since 1.0
 * @public
 * @constructor
 * @extends Adapter
 */
var FakeAdapter = Adapter.extend(/** @lends FakeAdapter# */ {

  init: function() {
    this._super.apply(this, arguments);
    this._interceptors = [];
    this._executed = [];
  },

  /**
   * Connect for FakeAdapter.
   *
   * @method
   * @protected
   * @see {Adapter#_connect}
   */
  _connect: BluebirdPromise.method(function() {
    return new FakeAdapterClient();
  }),

  /**
   * Disconnect for FakeAdapter.
   *
   * @method
   * @protected
   * @see {Adapter#_disconnect}
   */
  _disconnect: BluebirdPromise.method(function(/*client*/) {
  }),

  /**
   * Execute for FakeAdapter.
   *
   * @method
   * @protected
   * @see {Adapter#_execute}
   */
  _execute: BluebirdPromise.method(function(client, sql, args) {
    var result = { rows: [], fields: [] };
    this._executed.push([sql, args]);
    this._interceptors.some(function(interceptor) {
      var match = sql.match(interceptor.regex);
      if (match) {
        result = interceptor.result;
        if (typeof result === 'function') {
          result = result();
        }
      }
      return match;
    });
    return result;
  }),

  /**
   * Get all SQL & args that have been executed.
   *
   * @return {Array} An array of SQL/arg pairs.
   */
  executedSQL: function() {
    return this._executed;
  },

  /**
   * Intercept execution & return results via a function.
   *
   * @param {Regex} regex Interception will occur when this regex matches the
   * SQL query.
   * @param {Object|Function} result A object that will be used for the
   * execution result or a function whose result will serve the same purpose.
   */
  intercept: function(regex, result) {
    this._interceptors.unshift({
      regex: regex,
      result: result
    });
  },

  /**
   * Intercept specifically for selecting migrations.
   *
   * @param {Array} names Names of migrations that will be used to build the
   * full result.
   */
  interceptSelectMigrations: function(names) {
    this.intercept(/select.*from "azul_migrations"/i, {
      fields: ['id', 'name', 'batch'],
      rows: names.map(function(name, index) {
        return { id: index + 1, name: name, batch: 1 };
      })
    });
  }

});

module.exports = FakeAdapter.reopenClass({ __name__: 'FakeAdapter' });
