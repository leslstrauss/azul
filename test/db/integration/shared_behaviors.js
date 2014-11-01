'use strict';

var _ = require('lodash');
var expect = require('chai').expect;
var path = require('path');
var BluebirdPromise = require('bluebird');

module.exports.shouldRunMigrationsAndQueries = function() {
  var db; before(function() { db = this.db; });

  describe('with migrations applied', function() {
    before(function(done) {
      var migration =
        path.join(__dirname, '../../fixtures/migrations/blog');
      this.migrator = db.migrator(migration);
      this.migrator.migrate().then(function() { done(); }, done);
    });

    after(function(done) {
      this.migrator.rollback().then(function() { done(); }, done);
    });

    afterEach(function(done) {
      this.resetSequence('articles').then(function() { done(); }, done);
    });

    it('can insert, update, and delete data', function(done) {
      BluebirdPromise.bind({})
      .then(function() {
        return db
          .insert('articles', { title: 'Title 1', body: 'Contents 1'});
      }).get('rows').get('0')
      .then(function(article) { expect(article).to.not.exist; })
      .then(function() {
        return db
          .insert('articles', { title: 'Title 2', body: 'Contents 2'})
          .returning('id');
      }).get('rows').get('0')
      .then(function(article) { expect(article.id).to.eql(2); })
      .then(function() { return db.select('articles'); }).get('rows')
      .then(function(articles) {
        expect(_.sortBy(articles, 'id')).to.eql([
          { id: 1, title: 'Title 1', body: 'Contents 1'},
          { id: 2, title: 'Title 2', body: 'Contents 2'}
        ]);
      })
      .then(function() {
        return db.update('articles', { title: 'Updated' }).where({ id: 1 });
      })
      .then(function() { return db.select('articles'); }).get('rows')
      .then(function(articles) {
        expect(_.sortBy(articles, 'id')).to.eql([
          { id: 1, title: 'Updated', body: 'Contents 1'},
          { id: 2, title: 'Title 2', body: 'Contents 2'}
        ]);
      })
      .then(function() { return db.delete('articles'); })
      .then(function() { return db.select('articles'); }).get('rows')
      .then(function(articles) {
        expect(articles).to.eql([]);
      })
      .done(done, done);
    });

    describe('conditions', function() {
      it('supports `exact`');
      it('supports `iexact`');
      it('supports `in`');
      it('supports `gt`');
      it('supports `gte`');
      it('supports `lt`');
      it('supports `lte`');
      it('supports `between`');
      it('supports `isull`');

      it('supports `contains`');
      it('supports `icontains`');
      it('supports `startsWith`');
      it('supports `istartsWith`');
      it('supports `endsWith`');
      it('supports `iendsWith`');
      it('supports `regex`');
      it('supports `iregex`');

      it('supports `year`');
      it('supports `month`');
      it('supports `day`');
      it('supports `weekday`');
      it('supports `hour`');
      it('supports `minute`');
      it('supports `second`');
    });
  });
};
