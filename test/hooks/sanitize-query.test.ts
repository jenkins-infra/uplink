import { BadRequest } from '@feathersjs/errors';

import sanitizeQuery from '../../src/hooks/sanitize-query';

describe('sanitizeQuery hook', () => {
  const hook = sanitizeQuery(['id', 'type', 'correlator', 'createdAt']);
  const run = (query) => hook({ params: { query } });

  it('allows the queries used by the UI', () => {
    const queries = [
      {},
      { type: 'jest-example' },
      { type: ['a', 'b'] },
      { correlator: 'abc' },
      { id: { $lt: '100' } },
      { type: { $in: ['a', 'b'] }, id: { $gte: 1 } },
      { $sort: { id: '-1' } },
      { $sort: { createdAt: 1 } },
      { $limit: '25', $skip: 0 },
    ];
    for (const query of queries) {
      expect(() => run(query)).not.toThrow();
    }
  });

  it('rejects $select (raw SQL attributes in Sequelize)', () => {
    expect(() => run({ $select: [['(SELECT 1)', 'x']] })).toThrow(BadRequest);
    expect(() => run({ $select: ['id'] })).toThrow(BadRequest);
  });

  it('rejects unknown columns, including JSON paths on payload', () => {
    expect(() => run({ payload: { a: '1' } })).toThrow(BadRequest);
    expect(() => run({ unknown: 'x' })).toThrow(BadRequest);
  });

  it('rejects unsupported operators', () => {
    expect(() => run({ $or: [{ type: 'a' }] })).toThrow(BadRequest);
    expect(() => run({ type: { $like: 'a%' } })).toThrow(BadRequest);
    expect(() => run({ type: { $in: [{ nested: 1 }] } })).toThrow(BadRequest);
    expect(() => run({ id: { $lt: { $gt: 1 } } })).toThrow(BadRequest);
  });

  it('rejects nested values', () => {
    expect(() => run({ type: [['a']] })).toThrow(BadRequest);
    expect(() => run({ type: null })).toThrow(BadRequest);
  });

  it('rejects invalid $sort, $limit and $skip', () => {
    expect(() => run({ $sort: { payload: 1 } })).toThrow(BadRequest);
    expect(() => run({ $sort: { id: 'DESC; DROP TABLE events' } })).toThrow(BadRequest);
    expect(() => run({ $sort: 'id' })).toThrow(BadRequest);
    expect(() => run({ $limit: '10 OR 1=1' })).toThrow(BadRequest);
    expect(() => run({ $skip: -1 })).toThrow(BadRequest);
  });
});
