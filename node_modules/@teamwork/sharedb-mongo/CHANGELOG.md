# v3.0.0

# Breaking changes

- Update the major versions of the @teamwork/sharedb and @teamwork/sharedb-mingo-memory dependencies.


# v2.0.3

## Non-breaking changes

- Update dependencies.


# v2.0.2

## Non-breaking changes

- Fix a TypeError in `ShareDbMongo.invalidOpVersionError`.


# v2.0.1

## Non-breaking changes

- Improve performance of `getLinkedOps`.


# v1.0-beta

## Bugfixes

* Fix `skipPoll` for queries with `$not` or `$nor`

* Support Mongo 3.2

## Breaking changes

* Add options argument to all public database adapter methods that read
  or write from snapshots or ops.

* DB methods that get snapshots or ops no longer return metadata unless
  `{metadata: true}` option is passed.

* Deprecate `{new ShareDb({mongo: (mongo connection)})`. Instead, pass
  a callback in the `mongo` property.

* Change query format -- deprecate `$query`, support all Mongo methods
  as `$`-prefixed properties and change meaning of some meta operators.
  See the
  [query docs](https://github.com/teamwork/sharedb-mongo#queries))
  for more details.

* Deprecate `$orderby` in favor of `$sort`

## Non-breaking changes

* Don't add {_type: {$ne: null}} in Mongo queries unless necessary

* Upgrade to Mongo driver 2.x


# v0.8.7

Beginning of changelog.
