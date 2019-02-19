require('dotenv').config();
const pg = require('pg');
const Knex = require('knex');
const { SQLDataSource } = require('datasource-sql');
const isEmail = require('isemail');

if (!process.env.DATABASE_URL.match(/127.0.0.1/)) {
  pg.defaults.ssl = true;
}

// const MINUTE = 60 * 1000;

const createKnex = ({ connectionString }) =>
  Knex({
    client: 'pg',
    connection: connectionString,
    searchPath: ['public']
  });

class PgDB extends SQLDataSource {
  constructor({ connectionString, mock }) {
    super();
    this.context = {};
    if (mock !== undefined) {
      this.store = mock;
    } else {
      // Add your instance of Knex to the DataSource
      this.knex = createKnex({ connectionString });
      this.store = {
        users: {
          findOrCreate: async ({ where }) =>
            this.knex
              .withSchema('public')
              .insert(where)
              .into('users')
              .returning(['id', 'email']),
          findAll: async ({ where } = {}) => {
            try {
              if (where && Object.keys(where).length > 0) {
                return await this.knex
                  .withSchema('public')
                  .select('*')
                  .from('users')
                  .where(where);
              }
              return await this.knex
                .withSchema('public')
                .select('*')
                .from('users');
            } catch (err) {
              return null;
            }
          },
          dropTable: async () => this.knex.schema.withSchema('public').dropTable('users'),
          createTable: async () =>
            this.knex.schema.withSchema('public').createTable('users', table => {
              table.increments('id');
              table.string('email').unique();
              table.string('token');
            })
        },
        trips: {
          findOrCreate: async ({ userId, launchId }) =>
            this.knex
              .withSchema('public')
              .insert({ userId, launchId })
              .into('trips')
              .returning(['userId', 'launchId']),
          destroy: async (where = {}) =>
            this.knex
              .withSchema('public')
              .del()
              .from('trips')
              .where(where),
          findAll: async ({ where } = {}) => {
            try {
              if (where && Object.keys(where).length > 0) {
                return await this.knex
                  .withSchema('public')
                  .select('*')
                  .from('trips')
                  .where(where);
              }
              return await this.knex
                .withSchema('public')
                .select('*')
                .from('trips');
            } catch (err) {
              return null;
            }
          },
          dropTable: async () => this.knex.schema.withSchema('public').dropTable('trips'),
          createTable: async () =>
            this.knex.schema.withSchema('public').createTable('trips', trips => {
              trips.integer('launchId');
              trips.integer('userId');
              trips.primary(['launchId', 'userId']);
            })
        }
      };
    }
  }

  setContext(newContext) {
    this.context = newContext;
  }

  async init() {
    try {
      await this.store.users.dropTable();
    } catch (err) {
      if (err.code !== '42P01') {
        return false;
      }
    }

    try {
      await this.store.trips.dropTable();
    } catch (err) {
      if (err.code !== '42P01') {
        return false;
      }
    }

    try {
      await this.store.users.createTable();
    } catch (err) {
      return false;
    }

    try {
      await this.store.trips.createTable();
    } catch (err) {
      return false;
    }
    return true;
  }

  /*
  async getUsers(where) {
    return this.store.users.findAll(where) || [];
    
    // Batch the query with DataLoader
    return this.getBatched(query);

    // Cache the result for 1 minute
    return this.getCached(query, MINUTE);

    // Batch the query and cache the result for 1 minute
    return this.getBatchedAndCached(query, MINUTE);
  }
  */

  /*
  async getTrips(where) {
    return this.store.trips.findAll(where) || [];
  }
  */

  /**
   * User can be called with an argument that includes email, but it doesn't
   * have to be. If the user is already on the context, it will use that user
   * instead
   */
  async findOrCreateUser({ email: emailArg } = {}) {
    const email = this.context && this.context.user ? this.context.user.email : emailArg;
    if (!email || !isEmail.validate(email)) return null;
    try {
      const user = await this.store.users.findAll({ where: { email } });
      if (user && user.length) {
        return user[0];
      }
      return (await this.store.users.findOrCreate({ where: { email } }))[0];
    } catch (err) {
      return null;
    }
  }

  async findOrCreateTrip({ userId, launchId }) {
    try {
      const trip = await this.store.trips.findAll({ where: { userId, launchId } });
      if (trip && trip.length) {
        return trip[0];
      }
      return (await this.store.trips.findOrCreate({ where: { userId, launchId } }))[0];
    } catch (err) {
      return null;
    }
  }

  async bookTrips({ launchIds }) {
    const retVals = [];

    const results = launchIds.map(launchId => this.bookTrip({ launchId }));
    await Promise.all(results).then(asyncResults =>
      asyncResults.map(asyncResult => retVals.push(asyncResult.id))
    );
    return retVals;
  }

  async bookTrip({ launchId }) {
    return this.findOrCreateTrip({ userId: this.context.user.id, launchId });
  }

  async cancelTrip({ userId, launchId }) {
    const effectiveUserId = this.context.user && this.context.user.id ? this.context.user.id : userId;
    try {
      const numDeleted = await this.store.trips.destroy({ where: { userId: effectiveUserId, launchId } });
      return !!numDeleted;
    } catch (err) {
      return null;
    }
  }

  async getLaunchIdsByUser() {
    if (!this.context || !this.context.user) return [];
    const trips = await this.store.trips.findAll({ where: { userId: this.context.user.id } });
    return trips.map(trip => trip.id);
  }

  async isBookedOnLaunch({ launchId }) {
    if (!this.context || !this.context.user) return false;
    const found = await this.store.trips.findAll({ where: { userId: this.context.user.id, launchId } });
    return found && found.length > 0;
  }
}

module.exports = (() => {
  const instance = {};

  return {
    getInstance: (config = { connectionString: process.env.DATABASE_URL }) => {
      if (!instance[JSON.stringify(config)]) {
        instance[JSON.stringify(config)] = new PgDB(config);
      }
      return instance[JSON.stringify(config)];
    },
    destroy: () => Object.keys(instance).forEach(i => instance[i].knex.destroy())
  };
})();
