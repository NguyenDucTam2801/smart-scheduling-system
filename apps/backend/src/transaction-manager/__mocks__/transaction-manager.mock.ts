export const mockTransactionManager = {
    // immediately invokes the callback with undefined tx
    runInTransaction: jest.fn((fn) => fn(undefined)),
};