export const mockAuthRepository = {
    findByEmail: jest.fn(),
    findById: jest.fn(),
    createUser: jest.fn(),
    updateRefreshTokenHash: jest.fn(),
    updateRole: jest.fn(),
};