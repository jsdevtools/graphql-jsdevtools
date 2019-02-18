const PgDB = require('../PgDB');

const mockStore = {
  users: {
    findOrCreate: jest.fn(),
    findAll: jest.fn(),
    dropTable: jest.fn(),
    createTable: jest.fn()
  },
  trips: {
    findOrCreate: jest.fn(),
    destroy: jest.fn(),
    findAll: jest.fn(),
    dropTable: jest.fn(),
    createTable: jest.fn()
  }
};
module.exports.mockStore = mockStore;

const pg = PgDB.getInstance({ mock: mockStore });

describe('[PgDB.init]', () => {
  class CustomError extends Error {
    constructor(code = '42P01', ...params) {
      super(params);
      if (Error.captureStackTrace) {
        Error.captureStackTrace(this, CustomError);
      }
      this.code = code;
    }
  }

  it('returns true when successfully initializes', async () => {
    const res = await pg.init();
    expect(mockStore.users.dropTable).not.toBeCalledWith(expect.anything);
    expect(mockStore.users.createTable).not.toBeCalledWith(expect.anything);
    expect(mockStore.trips.dropTable).not.toBeCalledWith(expect.anything);
    expect(mockStore.trips.createTable).not.toBeCalledWith(expect.anything);
    expect(res).toEqual(true);
  });

  it('throws when can not drop users table', async () => {
    mockStore.users.dropTable.mockImplementationOnce(() => {
      throw new Error();
    });

    const res = await pg.init();
    expect(res).toEqual(false);
  });

  it('ignores when can not drop users table if not exists', async () => {
    mockStore.users.dropTable.mockImplementationOnce(() => {
      throw new CustomError();
    });

    const res = await pg.init();
    expect(res).toEqual(true);
  });

  it('throws when can not create users table', async () => {
    mockStore.users.createTable.mockImplementationOnce(() => {
      throw new Error();
    });

    const res = await pg.init();
    expect(res).toEqual(false);
  });

  it('throws when can not drop trips table', async () => {
    mockStore.trips.dropTable.mockImplementationOnce(() => {
      throw new Error();
    });

    const res = await pg.init();
    expect(res).toEqual(false);
  });

  it('ignores when can not drop trips table if not exists', async () => {
    mockStore.trips.dropTable.mockImplementationOnce(() => {
      throw new CustomError();
    });

    const res = await pg.init();
    expect(res).toEqual(true);
  });

  it('throws when can not create trips table', async () => {
    mockStore.trips.createTable.mockImplementationOnce(() => {
      throw new Error();
    });

    const res = await pg.init();
    expect(res).toEqual(false);
  });
});

describe('[PgDB.findOrCreateUser]', () => {
  it('returns null for invalid emails', async () => {
    const res = await pg.findOrCreateUser({ email: 'boo!' });
    expect(res).toEqual(null);
  });

  it('looks up user in store', async () => {
    const args = { email: 'a@a.a' };

    mockStore.users.findAll.mockReturnValueOnce([{ id: 1 }]);

    const res = await pg.findOrCreateUser(args);
    expect(mockStore.users.findAll).toBeCalledWith({ where: args });
    expect(res).toEqual({ id: 1 });
  });

  it('creates user in store', async () => {
    const args = { email: 'a@a.a' };

    mockStore.users.findAll.mockReturnValueOnce([]);
    mockStore.users.findOrCreate.mockReturnValueOnce([{ id: 1 }]);

    const res = await pg.findOrCreateUser(args);
    expect(mockStore.users.findAll).toBeCalledWith({ where: args });
    expect(mockStore.users.findOrCreate).toBeCalledWith({ where: args });
    expect(res).toEqual({ id: 1 });
  });

  it('looks up user in store using context', async () => {
    const args = { email: 'a@a.a' };
    pg.setContext({ user: { email: 'a@a.a' } });

    mockStore.users.findAll.mockReturnValueOnce([{ id: 1 }]);

    const res = await pg.findOrCreateUser();
    expect(mockStore.users.findAll).toBeCalledWith({ where: args });
    expect(res).toEqual({ id: 1 });
  });

  it('creates user in store using context', async () => {
    const args = { email: 'a@a.a' };
    pg.setContext({ user: { email: 'a@a.a' } });

    mockStore.users.findAll.mockReturnValueOnce([]);
    mockStore.users.findOrCreate.mockReturnValueOnce([{ id: 1 }]);

    const res = await pg.findOrCreateUser();
    expect(mockStore.users.findAll).toBeCalledWith({ where: args });
    expect(mockStore.users.findOrCreate).toBeCalledWith({ where: args });
    expect(res).toEqual({ id: 1 });
  });

  it('exception during find user', async () => {
    const args = { email: 'a@a.a' };
    mockStore.users.findAll.mockImplementationOnce(() => {
      throw new Error('Error during find user');
    });

    const res = await pg.findOrCreateUser(args);
    expect(res).toEqual(null);
  });

  it('exception during create user', async () => {
    const args = { email: 'a@a.a' };

    mockStore.users.findAll.mockReturnValueOnce([]);
    mockStore.users.findAll.mockImplementationOnce(() => {
      throw new Error('Error during create user');
    });

    const res = await pg.findOrCreateUser(args);
    expect(mockStore.users.findAll).toBeCalledWith({ where: args });
    expect(res).toEqual(null);
  });
});

describe('[PgDB.bookTrip]', () => {
  it('calls store creator and returns result', async () => {
    pg.setContext({ user: { id: 1 } });

    mockStore.trips.findAll.mockReturnValueOnce([]);
    mockStore.trips.findOrCreate.mockReturnValueOnce([{ id: 1 }]);

    const res = await pg.bookTrip({ launchId: 1 });
    expect(mockStore.trips.findAll).toBeCalledWith({ where: { launchId: 1, userId: 1 } });
    expect(mockStore.trips.findOrCreate).toBeCalledWith({ where: { launchId: 1, userId: 1 } });
    expect(res).toEqual({ id: 1 });
  });

  it('returns id if trip already exists', async () => {
    pg.setContext({ user: { id: 1 } });

    mockStore.trips.findAll.mockReturnValueOnce([{ id: 1 }]);

    const res = await pg.bookTrip({ launchId: 1 });
    expect(mockStore.trips.findAll).toBeCalledWith({ where: { launchId: 1, userId: 1 } });
    expect(res).toEqual({ id: 1 });
  });

  it('throws when can not get trips', async () => {
    const args = { launchId: 1 };
    pg.setContext({ user: { id: 1 } });

    mockStore.trips.findAll.mockImplementationOnce(() => {
      throw new Error('Error fetching trips');
    });

    const res = await pg.bookTrip(args);
    expect(res).toEqual(null);
  });

  it('throws when can not insert trip', async () => {
    const args = { launchId: 1 };
    pg.setContext({ user: { id: 1 } });

    mockStore.trips.findAll.mockReturnValueOnce([]);
    mockStore.trips.findOrCreate.mockImplementationOnce(() => {
      throw new Error('Error inserting trips');
    });

    const res = await pg.bookTrip(args);
    expect(mockStore.trips.findAll).toBeCalledWith({ where: { userId: 1, launchId: 1 } });
    expect(res).toEqual(null);
  });
});

describe('[PgDB.bookTrips]', () => {
  it('returns multiple lookups from bookTrip', async () => {
    pg.setContext({ user: { id: 1 } });

    mockStore.trips.findOrCreate.mockReturnValueOnce([{ id: 1 }]);
    mockStore.trips.findOrCreate.mockReturnValueOnce([{ id: 2 }]);

    const res = await pg.bookTrips({ launchIds: [3, 4] });
    expect(mockStore.trips.findOrCreate).toBeCalledWith({ where: { launchId: 3, userId: 1 } });
    expect(mockStore.trips.findOrCreate).toBeCalledWith({ where: { launchId: 4, userId: 1 } });
    expect(res).toEqual([1, 2]);
  });
});

describe('[PgDB.cancelTrip]', () => {
  it('calls store destroy and returns result', async () => {
    const args = { launchId: 1 };
    pg.setContext({ user: { id: 1 } });

    mockStore.trips.destroy.mockReturnValueOnce('heya');

    const res = await pg.cancelTrip(args);
    expect(mockStore.trips.destroy).toBeCalledWith({ where: { ...args, userId: 1 } });
    expect(res).toEqual(true);
  });

  it('calls store destroy and returns result w/o context', async () => {
    const args = { userId: 1, launchId: 1 };
    pg.setContext({ user: {} });

    mockStore.trips.destroy.mockReturnValueOnce('heya');

    const res = await pg.cancelTrip(args);
    expect(mockStore.trips.destroy).toBeCalledWith({ where: args });
    expect(res).toEqual(true);
  });

  it('calls store destroy and returns result', async () => {
    const args = { userId: 1, launchId: 1 };

    mockStore.trips.destroy.mockReturnValueOnce('heya');

    const res = await pg.cancelTrip(args);
    expect(mockStore.trips.destroy).toBeCalledWith({ where: args });
    expect(res).toEqual(true);
  });

  it('returns false when trip not found', async () => {
    const args = { launchId: 1 };
    pg.setContext({ user: { id: 1 } });

    mockStore.trips.destroy.mockReturnValueOnce(false);

    const res = await pg.cancelTrip(args);
    expect(res).toEqual(false);
  });

  it('throws when error deleting', async () => {
    const args = { launchId: 1 };
    pg.setContext({ user: { id: 1 } });

    mockStore.trips.destroy.mockImplementationOnce(() => {
      throw new Error('Error deleting trip');
    });

    const res = await pg.cancelTrip(args);
    expect(res).toEqual(null);
  });
});

describe('[PgDB.getLaunchIdsByUser]', () => {
  it('looks up launches by user', async () => {
    const args = { userId: 1 };
    const launches = [{ id: 1, userId: 1, launchId: 1 }, { id: 2, userId: 1, launchId: 2 }];
    pg.setContext({ user: { id: 1 } });

    mockStore.trips.findAll.mockReturnValueOnce(launches);

    const res = await pg.getLaunchIdsByUser();
    expect(mockStore.trips.findAll).toBeCalledWith({ where: args });
    expect(res).toEqual([1, 2]);
  });

  it('returns empty array if nothing found', async () => {
    const args = { userId: 1 };
    const launches = [];
    pg.setContext({ user: { id: 1 } });

    mockStore.trips.findAll.mockReturnValueOnce(launches);

    const res = await pg.getLaunchIdsByUser();
    expect(mockStore.trips.findAll).toBeCalledWith({ where: args });
    expect(res).toEqual([]);
  });

  it('returns empty if user.id not in context', async () => {
    pg.setContext({});
    const res = await pg.getLaunchIdsByUser();
    expect(res).toEqual([]);
  });
});

describe('[PgDB.isBookedOnLaunch]', () => {
  it('checks if trip with launch for user', async () => {
    pg.setContext({ user: { id: 1 } });

    mockStore.trips.findAll.mockReturnValueOnce([{ id: 1 }]);

    const res = await pg.isBookedOnLaunch({ launchId: 1 });
    expect(mockStore.trips.findAll).toBeCalledWith({ where: { userId: 1, launchId: 1 } });
    expect(res).toBeTruthy();
  });

  it('returns empty array if nothing found', async () => {
    pg.setContext({ user: { id: 1 } });

    mockStore.trips.findAll.mockReturnValueOnce([]);

    const res = await pg.isBookedOnLaunch({ launchId: 1 });
    expect(mockStore.trips.findAll).toBeCalledWith({ where: { userId: 1, launchId: 1 } });
    expect(res).toEqual(false);
  });

  it('returns null if no user.id in context', async () => {
    pg.setContext({});
    const res = await pg.isBookedOnLaunch({ launchId: 1 });
    expect(res).toEqual(false);
  });
});
