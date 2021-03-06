'use strict';

var _ = require('lodash');
var util = require('util');
var BluebirdPromise = require('bluebird');
var Class = require('../util/class');
var Manager = require('./manager');
var HasMany = require('../relations/has_many');
var BelongsTo = require('../relations/belongs_to');
var property = require('../util/property').fn;
var attr = require('./attr').fn;
var inflection = require('../util/inflection');

// TODO: consider how to set up the model class. we would like to get the
// schema from the db before doing anything with the model so that we can
// support getter/setter methods that are aware of the types they're working
// with and can report better errors. that may mean using a `setup` function
// like:
//
//     var Person = db.Model.extend();
//     Person.setup().then(function() {
//       Person.create().save();
//     });
//
// or on the database:
//
//     db.setup().then(function() {
//       Person.create().save();
//     });
//
// other thoughts:
//
//     db.loadModels('./path/to/dir')
//     db.prepareModels(Person, ...)
//     var Person = db.Model.extend().prepare().then('...')
//
// another idea:
//
// simply force the user to define all attributes on a model. an advantage to
// this is self-documenting code. a disadvantage is having to write more code.
// the writing more code could be solved by adding tools to the CLI that would
// allow inspection of a database to create/update models (similar to what the
// rails annotate tool does).

// REVISIT: createOrUpdate()

// REVISIT: support difference between join queries (one-to-one) and
// prefetching (one-to-many)?

// REVISIT: support difference between join queries (for actual querying) and
// prefetching (associations for use)?

// REVISIT: perform a join query when there are conditions & build all objects
// from the result data (which will include duplicates). when there are no
// conditions, simply perform multiple queries to prefetch data to avoid
// duplicate data being sent back to JS.

// TODO: some of the features that are desired like using `pk` as part of a
// `where` or having joins performed automatically based on the key in a
// `where` would require some sort of introspection of the condition &
// manipulation of the query. this may be hard to achieve. in addition, it may
// not actually lead to better code -- forcing the user to actually specify a
// `join`, for instance, leads to more clarity in the code & forces the
// developer to make a conscious decision while writing the query. make a
// decision regarding how to handle this.

/**
 * The base model class.
 *
 * ## Accessing Objects
 *
 *     Article.objects.all().then('...'); // -> select * from "articles";
 *     Article.objects.where({ pk: 1 }).fetch().then('...');
 *     // -> select * from "articles" where "articles"."id" = ?;
 *     // !> [1]
 *
 * ## Table Level Queries
 *
 *     var Article = Model.extend();
 *     Article.objects.delete(); // -> delete from "articles";
 *     Article.objects.update({ title: 'Article' });
 *     // -> update "articles" set "title" = ?;
 *     // !> ['Article']
 *
 * ## Options
 *
 *     var Article = Model.extend();
 *
 *     Article.reopenClass({
 *       tableName: 'articles',
 *       primaryKey: 'id'
 *     });
 *
 * ## Associations
 *
 *     var hasMany = Model.hasMany;
 *     var belongsTo = Model.belongsTo;
 *
 *     var Article = Model.extend({
 *       author: belongsTo('user', { foreignKey: 'author_id', primaryKey: 'id' })
 *     });
 *     module.exports = Article.reopenClass({ __name__: 'Article' });
 *
 *     var User = Model.extend({
 *       articles: hasMany(Article, { foreignKey: 'author_id', primaryKey: 'id' })
 *     });
 *     module.exports = User.reopenClass({ __name__: 'User' });
 *
 *     Article.objects.with('blog').fetch().then('...');
 *     // -> select * from "articles";
 *     // -> select * from "blogs" where "blog"."id" in (?, ?);
 *     // !> [3,5,8]
 *
 *     Article.objects.where({ 'blog.title[contains]': 'Azul' }).fetch().then('...');
 *     // -> select * from "articles" left join "blogs" on "articles"."blog_id" = "blog"."id"
 *     // -> where "blogs"."title" like ?;
 *     // !> ["%Whit%"];
 *
 *     Article.objects.where({ 'title[contains]': 'Azul' }).fetchOne().then('...');
 *     // throws if not exactly one record
 *
 *     var user = User.create();
 *     user.save().then('...'); // insert
 *
 *     user.save().then('...'); // no save because no changes
 *     user.name = 'Whitney';
 *     user.save().then('...'); // update
 *
 *     user.delete();
 *     user.save(); // delete
 *
 *     // note: user.destory(); // shortcut for user.delete().save()
 *
 * ### Accessing Relationships
 *
 *     User.objects.find(1).then(function(user) {
 *       user.articles; // throws because this was not `with` articles
 *     });
 *
 *     User.objects.with('articles').find(1).fetch().then(function(user) {
 *       user.articles; // okay
 *     });
 *
 *     User.objects.find(1)
 *     .then(function(user) { return user.fetch('articles'); })
 *     .then(function(user) {
 *       return bog.articles; // okay because of prior fetch
 *     });
 *
 *     Article.objects.find(1).then(function(article) {
 *       article.author; // throws because this was not `with` the author
 *     });
 *
 *     Article.objects.with('author').find(1).then(function(article) {
 *       article.author; // okay
 *     });
 *
 * ### Querying
 *
 *     Article.objects.where({ 'author.name[contains]': 'Whit' }).fetch().then('...');
 *     // -> select * from "articles"
 *     // -> left join "users" on "articles"."author_id" = "users"."id"
 *     // -> where "users"."name" like ?;
 *     // !> ["%Whit%"]
 *
 *     Article.objects.where({ 'author.name[contains]': 'Whit' })
 *       .orderBy('name', 'desc')
 *       .limit(10)
 *       .offset(20)
 *       .fetch()
 *       .then('...');
 *     // -> select * from "articles"
 *     // -> left join users on "articles"."author_id" = "users"."id"
 *     // -> where "users"."name" like ?
 *     // -> order by "users"."name" desc
 *     // -> limit 10 offset 20;
 *     // !> ["%Whit%"]
 *
 *     Article.objects.with('author', 'comments').fetch().then('...');
 *     // -> select * from "articles";
 *     // -> select * from "users" where "users"."id" in (?, ?);
 *     // !> [10,32]
 *     // -> select * from "comments" where "comments"."id" in (?, ?, ?);
 *     // !> [12,43,73]
 *
 *
 * ### Manipulating Relationships
 *
 *
 *     var article = Article.create({ title: 'Example' });
 *     user.addArticle(article).then('...');
 *     // -> insert into "articles" ("title", "author_id") values ?, ?;
 *     // !> ["Example", 1]
 *
 *     user.createArticle({ title: 'Example' }).save().then(function(article) {
 *       // ...
 *     });
 *     // -> insert into "articles" ("title", "author_id") values ?, ?;
 *     // !> ["Example", 1]
 *
 *     user.addArticles(article1, article2).then(function(articles) {
 *       // ...
 *     });
 *     // -> insert into "articles" ("title", "author_id") values (?, ?), (?, ?);
 *     // !> ["Example1", 1, "Example2", 1]
 *
 *     user.removeArticles(article1, article2).then('...');
 *     // -> update "articles" set "author_id" = null
 *     // -> where "articles"."id" in (?, ?);
 *     // !> [1, 2]
 *
 *     user.removeArticle(article1).then('...');
 *     // -> update "articles" set "author_id" = null
 *     // -> where "articles"."id" = ?;
 *     // !> [1]
 *
 *     user.clearArticles().then('...');
 *     // -> update "articles" set "author_id" = null
 *     // -> where "articles"."author_id" = ?;
 *     // !> [1]
 *
 * @since 1.0
 * @public
 * @constructor Model
 */
var Model = Class.extend(/** @lends Model# */ {
  init: function(properties) {
    this._attrs = {};
    this._dirty = false;
    this._persisted = false;
    this._inFlight = false;

    _.extend(this, properties, { dirty: false });
  },

  id: attr(), // TODO: how to allow this to be removed/configured?

  /**
   * Documentation forthcoming.
   *
   * @since 1.0
   * @protected
   * @method
   */
  loaded: function() {
    this.dirty = false;
    this.persisted = true;
    this.inFlight = false;
  },

  /**
   * Documentation forthcoming.
   *
   * @since 1.0
   * @public
   * @method
   */
  save: BluebirdPromise.method(function(options) {
    var self = this;
    var opts = options || {};
    var pk = this.__identity__.primaryKey;
    var where = _.pick(this.attrs, pk);
    var attrs = _.omit(this.attrs, pk);
    var loaded = this.loaded.bind(this);
    var query;

    if (this.inFlight) {
      throw new Error(util.format(
        'Cannot save %s while another save is in flight.',
        this.__identity__.__name__));
    }

    this.inFlight = true;

    if (!this.persisted) {
      query = this.__identity__.objects
      .insert(attrs).returning(pk)
      .execute()
      .tap(function(result) {
        self.id = result[0][pk];
        self.loaded();
      });
    }
    else if (this.dirty || opts.force) {
      query = this.__identity__.objects
        .where(where).update(attrs)
        .execute()
        .tap(loaded);
    }
    return BluebirdPromise.resolve(query).return(this);
  }),

  /**
   * Documentation forthcoming.
   *
   * @since 1.0
   * @protected
   * @type {Object}
   */
  attrs: property({ writable: true }),

  /**
   * Documentation forthcoming.
   *
   * @since 1.0
   * @protected
   * @type {Boolean}
   */
  persisted: property({ writable: true }),

  /**
   * Documentation forthcoming.
   *
   * @since 1.0
   * @protected
   * @type {Boolean}
   */
  dirty: property({ writable: true }),

  /**
   * Documentation forthcoming.
   *
   * @since 1.0
   * @protected
   * @type {Boolean}
   */
  inFlight: property({ writable: true })

});

Model.reopenClass(/** @lends Model */{
  /**
   * Documentation forthcoming.
   *
   * @since 1.0
   * @protected
   * @type {Manager}
   */
  objects: Manager.create(),

  /**
   * Documentation forthcoming.
   *
   * @since 1.0
   * @protected
   * @function
   */
  attr: attr,

  /**
   * Documentation forthcoming.
   *
   * @since 1.0
   * @protected
   * @function
   */
  hasMany: HasMany.attribute(),

  /**
   * Documentation forthcoming.
   *
   * @since 1.0
   * @protected
   * @function
   */
  belongsTo: BelongsTo.attribute(),

  /**
   * Documentation forthcoming.
   *
   * @since 1.0
   * @protected
   * @type {String}
   */
  tableName: property(function() {
    return this._tableName || inflection.pluralize(this.__name__.toLowerCase());
  }, { writable: true }),

  /**
   * Documentation forthcoming.
   *
   * @since 1.0
   * @protected
   * @type {String}
   */
  primaryKey: property(function() {
    return this._primaryKey || 'id';
  }, { writable: true }),

  /**
   * Documentation forthcoming.
   *
   * @since 1.0
   * @protected
   * @method
   */
  load: function(attrs) {
    return _.extend(this.create(), {
      _attrs: attrs,
      _persisted: true
    });
  }
});

module.exports = Model.reopenClass({ __name__: 'Model' });
