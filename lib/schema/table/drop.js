'use strict';

var _ = require('lodash');
var BaseQuery = require('../../query/base');

/**
 * A query that allows dropping tables.
 *
 * You will not create this query object directly. Instead, you will
 * receive it via {@link Schema#dropTable}.
 *
 * @since 1.0
 * @protected
 * @constructor DropTableQuery
 * @extends BaseQuery
 */
var DropTableQuery = BaseQuery.extend(/** @lends DropTableQuery# */{
  init: function() { throw new Error('DropTableQuery must be spawned.'); },

  _create: function(name) {
    this._super();
    this._name = name;
    this._options = {
      ifExists: false
    };
  },

  /**
   * Duplication implementation.
   *
   * @see {@link BaseQuery#_take}
   */
  _take: function(orig) {
    this._super(orig);
    this._name = orig._name;
    this._options = _.clone(orig._options);
  },

  /**
   * Generate SQL for a query.
   *
   * @see {@link BaseQuery#sql}
   */
  sql: function() {
    return this._adapter.phrasing.dropTable({
      name: this._name,
      options: this._options
    });
  },

  /**
   * Documentation forthcoming.
   */
  ifExists: function() {
    var dup = this._dup();
    dup._options.ifExists = true;
    return dup;
  }
});

module.exports = DropTableQuery.reopenClass({
  __name__: 'DropTableQuery'
});
