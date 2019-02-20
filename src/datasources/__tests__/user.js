const UserAPI = require('../user');

const mockStore = {
  users: {
    findOrCreate: jest.fn(),
    findAll: jest.fn()
  },
  trips: {
    findOrCreate: jest.fn(),
    destroy: jest.fn(),
    findAll: jest.fn()
  }
};
module.exports.mockStore = mockStore;

const ds = new UserAPI({ store: mockStore });
ds.initialize({ context: { user: { id: 1, email: 'a@a.a' }, cache: null } });

const ds2 = new UserAPI({ store: mockStore });
ds2.initialize({ context: {}, cache: null });

describe('[UserAPI.findOrCreateUser]', () => {
  it('returns null for invalid emails', async () => {
    const res = await ds2.findOrCreateUser({ email: 'boo!' });
    expect(res).toEqual(null);
  });

  it('looks up/creates user in store', async () => {
    mockStore.users.findOrCreate.mockReturnValueOnce([{ id: 1 }]);

    // check the result of the fn
    const res = await ds.findOrCreateUser({ email: 'a@a.a' });
    expect(res).toEqual({ id: 1 });

    // make sure store is called properly
    expect(mockStore.users.findOrCreate).toBeCalledWith({
      where: { email: 'a@a.a' }
    });
  });

  it('returns null if no user found/created', async () => {
    // store lookup is not mocked to return anything, so this
    // simulates a failed lookup

    const res = await ds.findOrCreateUser({ email: 'a@a.a' });
    expect(res).toEqual(null);
  });

  it('findOrCreateUser using email in context', async () => {
    mockStore.users.findOrCreate.mockReturnValueOnce([{ id: 1 }]);

    // check the result of the fn
    const res = await ds.findOrCreateUser();
    expect(res).toEqual({ id: 1 });

    // make sure store is called properly
    expect(mockStore.users.findOrCreate).toBeCalledWith({
      where: { email: 'a@a.a' }
    });
  });
});

describe('[UserAPI.bookTrip]', () => {
  it('calls store creator and returns result', async () => {
    mockStore.trips.findOrCreate.mockReturnValueOnce([{ get: () => 'heya' }]);

    // check the result of the fn
    const res = await ds.bookTrip({ launchId: 1 });
    expect(res).toBeTruthy();

    // make sure store is called properly
    expect(mockStore.trips.findOrCreate).toBeCalledWith({
      where: { launchId: 1, userId: 1 }
    });
  });
});

describe('[UserAPI.bookTrips]', () => {
  it('returns multiple lookups from bookTrip', async () => {
    mockStore.trips.findOrCreate.mockReturnValueOnce([{ get: () => 'heya' }]);
    mockStore.trips.findOrCreate.mockReturnValueOnce([{ get: () => 'okay' }]);

    const res = await ds.bookTrips({ launchIds: [1, 2] });
    expect(res).toEqual(['heya', 'okay']);
    console.log('finished first');
  });

  it('returns empty array when no userId in context', async () => {
    console.log('starting second');
    const res = await ds2.bookTrips({ launchIds: [1, 2] });
    expect(res).toEqual([]);
  });
});

describe('[UserAPI.cancelTrip]', () => {
  it('calls store destroy and returns result', async () => {
    const args = { userId: 1, launchId: 1 };
    mockStore.trips.destroy.mockReturnValueOnce('heya');

    // check the result of the fn
    const res = await ds.cancelTrip(args);
    expect(res).toEqual(true);

    // make sure store is called properly
    expect(mockStore.trips.destroy).toBeCalledWith({ where: args });
  });
});

describe('[UserAPI.getLaunchIdsByUser]', () => {
  it('looks up launches by user', async () => {
    const args = { userId: 1 };
    const launches = [{ dataValues: { launchId: 1 } }, { dataValues: { launchId: 2 } }];
    mockStore.trips.findAll.mockReturnValueOnce(launches);

    // check the result of the fn
    const res = await ds.getLaunchIdsByUser(args);
    expect(res).toEqual([1, 2]);

    // make sure store is called properly
    expect(mockStore.trips.findAll).toBeCalledWith({ where: args });
  });

  it('returns empty array if nothing found', async () => {
    const args = { userId: 1 };
    // store lookup is not mocked to return anything, so this
    // simulates a failed lookup

    // check the result of the fn
    const res = await ds.getLaunchIdsByUser(args);
    expect(res).toEqual([]);
  });

  describe('[UserAPI.isBookedOnLaunch]', () => {
    it('looks up if user booked on launch', async () => {
      const args = { launchId: 1 };
      const ctx = { userId: 1 };
      mockStore.trips.findAll.mockReturnValueOnce([{ ...args, ...ctx }]);

      // check the result of the fn
      const res = await ds.isBookedOnLaunch(args);
      expect(res).toEqual(true);

      // make sure store is called properly
      expect(mockStore.trips.findAll).toBeCalledWith({ where: { ...args, ...ctx } });
    });

    it('looks up and user is not booked on launch', async () => {
      const args = { launchId: 1 };
      const ctx = { userId: 1 };
      mockStore.trips.findAll.mockReturnValueOnce([]);

      // check the result of the fn
      const res = await ds.isBookedOnLaunch(args);
      expect(res).toEqual(false);

      // make sure store is called properly
      expect(mockStore.trips.findAll).toBeCalledWith({ where: { ...args, ...ctx } });
    });

    it('looks up if user booked on launch, but no user in context', async () => {
      const args = { launchId: 1 };

      // check the result of the fn
      const res = await ds2.isBookedOnLaunch(args);
      expect(res).toEqual(false);
    });
  });
});
