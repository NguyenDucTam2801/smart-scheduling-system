export const mockChangeRequestsRepository = {
    findMany: jest.fn(),
    findById: jest.fn(),
    findRequestByScheduleWithStatus: jest.fn(),
    create: jest.fn(),
    approveRequest: jest.fn(),
    rejectRequest: jest.fn(),
};