export const mockSchedulesRepository = {
    create: jest.fn(),
    findOverlappingSchedules: jest.fn(),
    findMany: jest.fn(),
    findById: jest.fn(),
    updateForAdminWithLock: jest.fn(),
    updateForUserWithLock: jest.fn(),
    delete: jest.fn(),
};