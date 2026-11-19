import { BadRequest } from '@feathersjs/errors';

/*
 * Feathers passes the query object more or less straight through to
 * feathers-sequelize/Sequelize. Several of the query features that allows are
 * dangerous with the Sequelize version in use, most notably `$select`, whose
 * `[expression, alias]` form is emitted as raw SQL (arbitrary SQL injection),
 * and nested objects on JSON columns, which turn into JSON path expressions.
 *
 * This hook only lets through the small subset of query features that the
 * Uplink UI actually needs, for the columns it is explicitly given:
 *
 *   column=value, column[]=v1&column[]=v2
 *   column[$lt|$lte|$gt|$gte|$ne]=value, column[$in|$nin][]=value
 *   $sort[column]=1|-1, $limit=n, $skip=n
 *
 * Everything else, including `$select` and `$or`, is rejected. It must run for
 * internal calls too, because the dashboard controller forwards the browser's
 * query string to the events service as an internal call.
 */

const COMPARISON_OPERATORS = ['$lt', '$lte', '$gt', '$gte', '$ne'];
const LIST_OPERATORS = ['$in', '$nin'];

const isScalar = (value : any) : boolean => {
  return ['string', 'number', 'boolean'].includes(typeof value);
};

const isPlainObject = (value : any) : boolean => {
  return (value !== null) && (typeof value === 'object') && !Array.isArray(value);
};

const isScalarList = (value : any) : boolean => {
  return Array.isArray(value) && value.every(isScalar);
};

const isInteger = (value : any) : boolean => {
  return isScalar(value) && /^\d+$/.test(String(value));
};

const checkValue = (column : string, value : any) => {
  if (isScalar(value) || isScalarList(value)) {
    return;
  }

  if (isPlainObject(value)) {
    for (const operator of Object.keys(value)) {
      const operand = value[operator];
      if (COMPARISON_OPERATORS.includes(operator) && isScalar(operand)) {
        continue;
      }
      if (LIST_OPERATORS.includes(operator) && isScalarList(operand)) {
        continue;
      }
      throw new BadRequest(`Unsupported query operator for '${column}'`);
    }
    return;
  }

  throw new BadRequest(`Unsupported query value for '${column}'`);
};

export default (columns : Array<string>) => {
  return (context) => {
    const query = context.params.query || {};

    for (const key of Object.keys(query)) {
      const value = query[key];

      if (key === '$limit' || key === '$skip') {
        if (!isInteger(value)) {
          throw new BadRequest(`Invalid value for '${key}'`);
        }
        continue;
      }

      if (key === '$sort') {
        if (!isPlainObject(value)) {
          throw new BadRequest('Invalid value for \'$sort\'');
        }
        for (const column of Object.keys(value)) {
          if (!columns.includes(column) || !['1', '-1'].includes(String(value[column]))) {
            throw new BadRequest('Invalid value for \'$sort\'');
          }
        }
        continue;
      }

      if (!columns.includes(key)) {
        throw new BadRequest(`Unsupported query parameter '${key}'`);
      }

      checkValue(key, value);
    }

    return context;
  };
};
