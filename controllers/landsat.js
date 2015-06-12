'use strict';

var ejs = require('elastic.js');
var client = require('../services/elasticsearch.js');
var queries = require('./queries.js');
var Boom = require('boom');

module.exports = function (params, request, cb) {
  var err;

  // Build Elastic Search Query
  var q = ejs.Request();

  // Do legacy search
  if (Object.keys(params).length > 0) {
    q = queries(params, q, request.limit);
  } else {
    q.query(ejs.MatchAllQuery()).sort('acquisitionDate', 'desc');
  }

  // Legacy support for skip parameter
  if (params.skip) {
    request.page = Math.floor(parseInt(params.skip, 10) / request.limit);
  }

  // Decide from
  var from = (request.page - 1) * request.limit;

  var search_params = {
    index: process.env.ES_INDEX || 'landsat',
    body: q
  };

  if (!params.count) {
    search_params.from = from;
    search_params.size = request.limit;
  }

  client.search(search_params).then(function (body) {
    var response = [];
    var count = 0;

    // Process Facets
    if (params.count) {
      // Term facet count
      if (body.facets.count.terms.length !== 0) {
        response = body.facets.count.terms;
        count = body.facets.count.total;
      } else {
        return cb(Boom.notFound('Nothing to count!'));
      }

    // Process search
    } else {
      if (body.hits.hits.length === 0) {
        return cb(Boom.notFound('No matches found!'));
      }
      count = body.hits.total;

      for (var i = 0; i < body.hits.hits.length; i++) {
        response.push(body.hits.hits[i]._source);
      }
    }

    return cb(err, response, count);
  }, function (err) {
    return cb(Boom.badRequest(err));
  });
};
