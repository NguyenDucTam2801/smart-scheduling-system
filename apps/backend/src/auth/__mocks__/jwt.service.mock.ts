export const mockJwtService = {
    signAsync: jest.fn().mockResolvedValue('mock-token'),
    verify: jest.fn(),
};