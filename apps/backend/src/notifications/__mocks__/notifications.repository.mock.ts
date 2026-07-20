export const mockNotificationsRepository = {
    findMany: jest.fn(),
    findById: jest.fn(),
    countUnread: jest.fn(),
    markAsRead: jest.fn(),
    markAllAsRead: jest.fn(),
    delete: jest.fn(),
    createForUsers: jest.fn(),
    createForAllUsers: jest.fn(),
};