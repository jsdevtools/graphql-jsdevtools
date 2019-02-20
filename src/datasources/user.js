const { DataSource } = require('apollo-datasource');
const isEmail = require('isemail');

class UserAPI extends DataSource {
  constructor({ store }) {
    super();
    this.store = store;
  }

  /**
   * This is a function that gets called by ApolloServer when being setup.
   * This function gets called with the datasource config including things
   * like caches and context. We'll assign this.context to the request context
   * here, so we can know about the user making requests
   */
  initialize(config) {
    this.context = config.context;
  }

  /**
   * User can be called with an argument that includes email, but it doesn't
   * have to be. If the user is already on the context, it will use that user
   * instead
   */
  async findOrCreateUser({ email: emailArg } = {}) {
    const email = this.context && this.context.user ? this.context.user.email : emailArg;
    if (!email || !isEmail.validate(email)) return null;

    const users = await this.store.users.findOrCreate({ where: { email } });
    return users && users[0] ? users[0] : null;
  }

  async bookTrips({ launchIds }) {
    console.log('pre-context check', this.context);
    if (!this.context || !this.context.user || !this.context.user.id) return [];
    console.log('post-context check', this.context);
    const retVals = [];

    // for each launch id, try to book the trip and add it to the results array
    // if successful
    const results = launchIds.map(async launchId => this.bookTrip({ launchId }));
    console.log('results', results);
    Promise.all(results).then(completed => {
      console.log('completed', completed);
      completed
        .filter(res => {
          console.log('res', res);
          return !!res;
        })
        .forEach(res2 => {
          console.log('res2', res2);
          retVals.push(res2);
        });
    });
    return retVals;
  }

  async bookTrip({ launchId }) {
    const userId = this.context.user.id;
    const res = await this.store.trips.findOrCreate({
      where: { userId, launchId }
    });
    return res[0].get();
  }

  async cancelTrip({ launchId }) {
    const userId = this.context.user.id;
    return !!this.store.trips.destroy({ where: { userId, launchId } });
  }

  async getLaunchIdsByUser() {
    const userId = this.context.user.id;
    const found = await this.store.trips.findAll({
      where: { userId }
    });
    return found && found.length ? found.map(l => l.dataValues.launchId).filter(l => !!l) : [];
  }

  async isBookedOnLaunch({ launchId }) {
    if (!this.context || !this.context.user) return false;
    const userId = this.context.user.id;
    const found = await this.store.trips.findAll({
      where: { userId, launchId }
    });
    return found && found.length > 0;
  }
}

module.exports = UserAPI;
