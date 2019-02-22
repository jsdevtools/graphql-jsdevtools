// import our production apollo-server instance
const gql = require('graphql-tag');
const { server } = require('../');
const PgDB = require('../datasources/PgDB');

const { startTestServer, toPromise } = require('./__utils');

const LAUNCH_LIST_QUERY = gql`
  query myLaunches($pageSize: Int, $after: String) {
    launches(pageSize: $pageSize, after: $after) {
      cursor
      launches {
        mission {
          name
          missionPatch
        }
      }
    }
  }
`;

const GET_LAUNCH = gql`
  query launch($id: ID!) {
    launch(id: $id) {
      id
      isBooked
      rocket {
        type
      }
      mission {
        name
      }
    }
  }
`;

afterAll(() => {
  PgDB.destroy();
});

describe('DB Initialization', () => {
  it('PgDB Init', async () => {
    const res = await PgDB.getInstance().init();

    expect(res).toEqual(true);
  });

  it('PgDB.users findOrCreate', async () => {
    const res = await PgDB.getInstance().store.users.findOrCreate({ where: { email: 'foo@bar.com' } });

    expect(res).toBeTruthy();
  });

  it('PgDB.users findOrCreate2', async () => {
    const res = await PgDB.getInstance().store.users.findOrCreate({ where: { email: 'bar@foo.com' } });

    expect(res).toBeTruthy();
  });

  it('PgDB.users findOrCreate3', async () => {
    expect(PgDB.getInstance().store.users.findOrCreate({ where: { email: 'foo@bar.com' } })).rejects.toThrow(
      /users_email_unique/
    );
  });

  it('PgDB.users findAll', async () => {
    const res = await PgDB.getInstance().store.users.findAll({ where: { email: 'foo@bar.com' } });

    expect(res).toBeTruthy();
  });

  it('PgDB.users findAll2', async () => {
    const res = await PgDB.getInstance().store.users.findAll();

    expect(res).toBeTruthy();
  });

  it('PgDB.users findAll3', async () => {
    const res = await PgDB.getInstance().store.users.findAll({ where: { email: 'not@found.com' } });

    expect(res).toEqual([]);
  });

  it('PgDB.users findAll4', async () => {
    const res = await PgDB.getInstance().store.users.findAll({ where: { blah: 1 } });

    expect(res).toEqual(null);
  });

  it('PgDB.trips findOrCreate', async () => {
    const res = await PgDB.getInstance().store.trips.findOrCreate({ launchId: 1, userId: 1 });

    expect(res).toBeTruthy();
  });

  it('PgDB.trips findOrCreate2', async () => {
    const res = await PgDB.getInstance().store.trips.findOrCreate({ launchId: 1, userId: 2 });

    expect(res).toBeTruthy();
  });

  it('PgDB.trips findOrCreate3', async () => {
    expect(PgDB.getInstance().store.trips.findOrCreate({ launchId: 1, userId: 2 })).rejects.toThrow(
      /trips_pkey/
    );
  });

  it('PgDB.trips findAll', async () => {
    const res = await PgDB.getInstance().store.trips.findAll({ where: { launchId: 1, userId: 2 } });

    expect(res).toBeTruthy();
  });

  it('PgDB.trips findAll2', async () => {
    const res = await PgDB.getInstance().store.trips.findAll({ where: { launchId: 1 } });

    expect(res).toBeTruthy();
  });

  it('PgDB.trips findAll3', async () => {
    const res = await PgDB.getInstance().store.trips.findAll({ where: { userId: 2 } });

    expect(res).toBeTruthy();
  });

  it('PgDB.trips findAll4', async () => {
    const res = await PgDB.getInstance().store.trips.findAll({ where: { launchId: 99, userId: 99 } });

    expect(res).toEqual([]);
  });

  it('PgDB.trips findAll5', async () => {
    const res = await PgDB.getInstance().store.trips.findAll();

    expect(res).toBeTruthy();
  });

  it('PgDB.trips findAll6', async () => {
    const res = await PgDB.getInstance().store.trips.findAll({ where: { blah: 1 } });

    expect(res).toEqual(null);
  });

  it('PgDB.trips destroy', async () => {
    const res = await PgDB.getInstance().store.trips.destroy({ userId: 2 });

    expect(res).toEqual(1);
  });

  it('PgDB.trips destroy2', async () => {
    const res = await PgDB.getInstance().store.trips.destroy({ launchId: 1, userId: 2 });

    expect(res).toEqual(0);
  });

  it('PgDB.trips destroy3', async () => {
    expect(PgDB.getInstance().store.trips.destroy({ blah: 1 })).rejects.toThrow(
      /column "blah" does not exist/
    );
  });

  it('PgDB.trips destroy4', async () => {
    const res = await PgDB.getInstance().store.trips.destroy();

    expect(res).toEqual(1);
  });
});

describe('Server - e2e, valid auth', () => {
  let stop;
  let graphql;

  beforeEach(async () => {
    const testServer = await startTestServer(server, {
      'client-name': 'e2e test client',
      'client-version': '0.0.1',
    });
    // eslint-disable-next-line prefer-destructuring
    stop = testServer.stop;
    // eslint-disable-next-line prefer-destructuring
    graphql = testServer.graphql;
  });

  afterEach(() => {
    stop();
  });

  it('gets list of launches', async () => {
    const res = await toPromise(
      graphql({
        query: LAUNCH_LIST_QUERY,
        variables: { pageSize: 1, after: '1517949900' },
      })
    );

    expect(res).toMatchSnapshot();
  });

  it('gets a single launch', async () => {
    const res = await toPromise(graphql({ query: GET_LAUNCH, variables: { id: 30 } }));

    expect(res).toMatchSnapshot();
  });
});

describe('Server - e2e, invalid auth', () => {
  let stop;
  let graphql;

  beforeEach(async () => {
    const testServer = await startTestServer(server, {
      authorization: 'Zm9vQGJhci5jb20=',
      'client-name': 'JestTestingClient',
      'client-version': '0.0.1',
    });
    // eslint-disable-next-line prefer-destructuring
    stop = testServer.stop;
    // eslint-disable-next-line prefer-destructuring
    graphql = testServer.graphql;
  });

  afterEach(() => {
    stop();
  });

  it('gets list of launches', async () => {
    const res = await toPromise(
      graphql({
        query: LAUNCH_LIST_QUERY,
        variables: { pageSize: 1, after: '1517949900' },
      })
    );

    expect(res).toMatchSnapshot();
  });

  it('gets a single launch2', async () => {
    const res = await toPromise(graphql({ query: GET_LAUNCH, variables: { id: 30 } }));

    expect(res).toMatchSnapshot();
  });
});
