const { HttpLink } = require('apollo-link-http');
const fetch = require('node-fetch');
const { execute, toPromise } = require('apollo-link');
const PgDB = require('../datasources/PgDB');

module.exports.toPromise = toPromise;

const {
  // dataSources,
  context: defaultContext,
  typeDefs,
  resolvers,
  ApolloServer,
  LaunchAPI,
} = require('../');

/**
 * Integration testing utils
 */
const constructTestServer = ({ context = defaultContext } = {}) => {
  const launchAPI = new LaunchAPI();
  const pgDB = PgDB.getInstance();

  const server = new ApolloServer({
    typeDefs,
    resolvers,
    dataSources: () => ({ launchAPI, pgDB }),
    context,
  });

  return { server, launchAPI, pgDB };
};

module.exports.constructTestServer = constructTestServer;

/**
 * e2e Testing Utils
 */

const startTestServer = async (server, headers = {}) => {
  // if using apollo-server-express...
  // const app = express();
  // server.applyMiddleware({ app });
  // const httpServer = await app.listen(0);

  const httpServer = await server.listen({ port: 0 });

  const link = new HttpLink({
    uri: `http://localhost:${httpServer.port}`,
    fetch,
    headers,
  });

  const executeOperation = ({ query, variables = {} }) => execute(link, { query, variables });

  return {
    link,
    stop: () => httpServer.server.close(),
    graphql: executeOperation,
  };
};

module.exports.startTestServer = startTestServer;
