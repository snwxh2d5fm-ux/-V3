// Mock for @cloudbase/node-sdk — used in Jest unit tests
const mockAdd = jest.fn(() => Promise.resolve({ id: 'mock-id' }));
const mockGet = jest.fn(() => Promise.resolve({ data: [] }));
const mockCount = jest.fn(() => Promise.resolve({ total: 0 }));
const mockUpdate = jest.fn(() => Promise.resolve({ updated: 1 }));
const mockWhere = jest.fn(() => ({ get: mockGet, count: mockCount, update: mockUpdate }));
const mockLimit = jest.fn(() => ({ get: mockGet }));
const mockOrderBy = jest.fn(() => ({ limit: mockLimit, get: mockGet }));
const mockCollection = jest.fn(() => ({
  add: mockAdd, get: mockGet, where: mockWhere, limit: mockLimit,
  orderBy: mockOrderBy, count: mockCount, update: mockUpdate, doc: () => ({ get: mockGet, update: mockUpdate }),
}));
const mockDb = { collection: mockCollection };

function cloudbase() {
  return { database: () => mockDb };
}
cloudbase.SYMBOL_CURRENT_ENV = 'mock-env';
cloudbase.init = cloudbase;

module.exports = cloudbase;
module.exports._mockDb = mockDb;
module.exports._mockAdd = mockAdd;
module.exports._mockCollection = mockCollection;
