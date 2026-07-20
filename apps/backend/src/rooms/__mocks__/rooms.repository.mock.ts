export const mockRoomRepository = {
    findMany: jest.fn(),
    findById: jest.fn(),
    findByName: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    remove: jest.fn(),
    hasActiveSchedules: jest.fn(),
};