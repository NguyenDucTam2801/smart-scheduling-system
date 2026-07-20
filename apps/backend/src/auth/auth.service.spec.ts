// ── MUST be before all imports ─────────────────────────────────────
jest.mock('bcrypt', () => ({
  hash: jest.fn().mockResolvedValue('$2b$mock-hashed-value'),
  compare: jest.fn().mockResolvedValue(true),
}));

import { Test, TestingModule } from '@nestjs/testing';
import {
  BadRequestException, NotFoundException,
  UnauthorizedException
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { RoleEnum } from '@prisma/client';
import { AuthService } from './auth.service';
import { AuthRepository } from './auth.repository';
import { mockAuthRepository } from './__mocks__/auth.repository.mock';

const mockJwtService = {
  signAsync: jest.fn().mockResolvedValue('mock-token'),
};

// ── Helper ──────────────────────────────────────────────────────────
const makeUser = (overrides = {}) => ({
  id: 'user-uuid',
  email: 'user@example.com',
  name: 'Tâm',
  passwordHash: '$2b$mock-hashed-value',
  role: RoleEnum.USER,
  refreshTokenHash: null,
  createdAt: new Date(),
  ...overrides,
});

describe('AuthService', () => {
  let service: AuthService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: AuthRepository, useValue: mockAuthRepository },
        { provide: JwtService, useValue: mockJwtService },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    jest.clearAllMocks();

    // Reset bcrypt mocks to default after each test
    (bcrypt.hash as jest.Mock).mockResolvedValue('$2b$mock-hashed-value');
    (bcrypt.compare as jest.Mock).mockResolvedValue(true);

    // Reset JwtService mock
    mockJwtService.signAsync.mockResolvedValue('mock-token');
  });

  // ── register() ─────────────────────────────────────────────────────

  describe('register()', () => {
    const dto = { name: 'Tâm', email: 'user@example.com', password: 'User1234!' };

    it('should register user and return void', async () => {
      mockAuthRepository.findByEmail.mockResolvedValue(null);
      mockAuthRepository.createUser.mockResolvedValue(makeUser());
      (bcrypt.hash as jest.Mock).mockResolvedValue('$2b$mock-hashed-value');
      const result = await service.register(dto);

      expect(result).toBeUndefined();
      expect(mockAuthRepository.createUser).toHaveBeenCalledTimes(1);
    });

    it('should hash password before saving', async () => {
      mockAuthRepository.findByEmail.mockResolvedValue(null);
      mockAuthRepository.createUser.mockResolvedValue(makeUser());

      await service.register(dto);

      expect(bcrypt.hash).toHaveBeenCalledTimes(1);
      // second arg is saltRounds — in test env should be 1
      const [plainText] = (bcrypt.hash as jest.Mock).mock.calls[0];
      expect(plainText).toBe('User1234!');
    });

    it('should throw BadRequestException when email already exists', async () => {
      mockAuthRepository.findByEmail.mockResolvedValue(makeUser());

      await expect(service.register(dto))
        .rejects.toThrow(BadRequestException);

      await expect(service.register(dto))
        .rejects.toThrow('Email already registered');

      expect(mockAuthRepository.createUser).not.toHaveBeenCalled();
    });

    it('should not return tokens on register', async () => {
      mockAuthRepository.findByEmail.mockResolvedValue(null);
      mockAuthRepository.createUser.mockResolvedValue(makeUser());

      const result = await service.register(dto);

      expect(result).toBeUndefined();
      // no JWT signing on register anymore
      expect(mockJwtService.signAsync).not.toHaveBeenCalled();
    });
  });

  // ── login() ────────────────────────────────────────────────────────

  describe('login()', () => {
    const dto = { email: 'user@example.com', password: 'User1234!' };

    it('should return tokens on valid credentials', async () => {
      mockAuthRepository.findByEmail.mockResolvedValue(makeUser());
      mockAuthRepository.updateRefreshTokenHash.mockResolvedValue(undefined);

      const result = await service.login(dto);

      expect(result).toHaveProperty('accessToken');
      expect(result).toHaveProperty('refreshToken');
      expect(mockJwtService.signAsync).toHaveBeenCalledTimes(2); // access + refresh
    });

    it('should save refresh token hash after login', async () => {
      mockAuthRepository.findByEmail.mockResolvedValue(makeUser());
      mockAuthRepository.updateRefreshTokenHash.mockResolvedValue(undefined);

      await service.login(dto);

      expect(mockAuthRepository.updateRefreshTokenHash).toHaveBeenCalledTimes(1);
      const [calledUserId, calledHash] = mockAuthRepository.updateRefreshTokenHash.mock.calls[0];
      expect(calledUserId).toBe('user-uuid');
      expect(calledHash).toBe('$2b$mock-hashed-value');
    });

    it('should throw UnauthorizedException when email not found', async () => {
      mockAuthRepository.findByEmail.mockResolvedValue(null);

      await expect(service.login(dto))
        .rejects.toThrow(UnauthorizedException);

      await expect(service.login(dto))
        .rejects.toThrow('Invalid Credentials');

      expect(mockJwtService.signAsync).not.toHaveBeenCalled();
    });

    it('should throw UnauthorizedException when password is wrong', async () => {
      mockAuthRepository.findByEmail.mockResolvedValue(makeUser());
      (bcrypt.compare as jest.Mock).mockResolvedValueOnce(false); // wrong password

      const loginPromise = service.login(dto);

      await expect(loginPromise)
        .rejects.toThrow(UnauthorizedException);

      expect(mockAuthRepository.findByEmail).toHaveBeenCalledWith(dto.email);

    });
  });

  // ── refreshTokens() ────────────────────────────────────────────────

  describe('refreshTokens()', () => {

    it('should return new tokens when refresh token is valid', async () => {
      mockAuthRepository.findById.mockResolvedValue(
        makeUser({ refreshTokenHash: '$2b$mock-hashed-value' })
      );
      mockAuthRepository.updateRefreshTokenHash.mockResolvedValue(undefined);
      (bcrypt.compare as jest.Mock).mockResolvedValueOnce(true); // valid token
      mockJwtService.signAsync
        .mockResolvedValueOnce('new-access-token')
        .mockResolvedValueOnce('new-refresh-token');
      const result = await service.refreshTokens('user-uuid', 'valid-refresh-token');

      expect(result).toHaveProperty('accessToken');
      expect(result).toHaveProperty('refreshToken');
      expect(mockJwtService.signAsync).toHaveBeenCalledTimes(2);
    });

    it('should generate a new refresh token (not reuse old one)', async () => {
      mockAuthRepository.findById.mockResolvedValue(
        makeUser({ refreshTokenHash: '$2b$mock-hashed-value' })
      );
      mockAuthRepository.updateRefreshTokenHash.mockResolvedValue(undefined);
      mockJwtService.signAsync
        .mockResolvedValueOnce('new-access-token')
        .mockResolvedValueOnce('new-refresh-token');

      const result = await service.refreshTokens('user-uuid', 'old-refresh-token');

      // New service always generates new refresh token
      expect(result.refreshToken).toBe('new-refresh-token');
    });

    it('should save new refresh token hash after refresh', async () => {
      mockAuthRepository.findById.mockResolvedValue(
        makeUser({ refreshTokenHash: '$2b$mock-hashed-value' })
      );
      mockAuthRepository.updateRefreshTokenHash.mockResolvedValue(undefined);

      await service.refreshTokens('user-uuid', 'valid-refresh-token');

      expect(mockAuthRepository.updateRefreshTokenHash).toHaveBeenCalledTimes(1);
    });

    it('should throw UnauthorizedException when user not found', async () => {
      mockAuthRepository.findById.mockResolvedValue(null);

      await expect(service.refreshTokens('non-existent', 'any-token'))
        .rejects.toThrow(UnauthorizedException);

      await expect(service.refreshTokens('non-existent', 'any-token'))
        .rejects.toThrow('Invalid Credentials');
    });

    it('should throw UnauthorizedException when refreshTokenHash is null (logged out)', async () => {
      mockAuthRepository.findById.mockResolvedValue(
        makeUser({ refreshTokenHash: null })
      );

      await expect(service.refreshTokens('user-uuid', 'any-token'))
        .rejects.toThrow(UnauthorizedException);
    });

    it('should throw UnauthorizedException when token does not match hash', async () => {
      mockAuthRepository.findById.mockResolvedValue(
        makeUser({ refreshTokenHash: '$2b$mock-hashed-value' })
      );
      (bcrypt.compare as jest.Mock).mockResolvedValueOnce(false); // mismatch

      await expect(service.refreshTokens('user-uuid', 'tampered-token'))
        .rejects.toThrow(UnauthorizedException);
    });
  });

  // ── logOut() ───────────────────────────────────────────────────────

  describe('logOut()', () => {

    it('should clear refresh token hash on logout', async () => {
      mockAuthRepository.updateRefreshTokenHash.mockResolvedValue(undefined);

      await service.logOut('user-uuid');

      expect(mockAuthRepository.updateRefreshTokenHash).toHaveBeenCalledTimes(1);
      expect(mockAuthRepository.updateRefreshTokenHash).toHaveBeenCalledWith(
        'user-uuid',
        null,   // hash must be null after logout
      );
    });

    it('should return void on successful logout', async () => {
      mockAuthRepository.updateRefreshTokenHash.mockResolvedValue(undefined);

      const result = await service.logOut('user-uuid');

      expect(result).toBeUndefined();
    });

    it('should throw when updateRefreshTokenHash fails', async () => {
      mockAuthRepository.updateRefreshTokenHash.mockRejectedValue(
        new Error('DB error')
      );

      await expect(service.logOut('user-uuid')).rejects.toThrow('DB error');
    });
  });

  // ── promote() ──────────────────────────────────────────────────────

  describe('promote()', () => {
    const adminSecret = 'admin-secret';
    const superAdminSecret = 'superadmin-secret';

    beforeEach(() => {
      process.env.ADMIN_SECRET_KEY = adminSecret;
      process.env.SUPER_ADMIN_SECRET_KEY = superAdminSecret;
    });

    it('should promote user to ADMIN with correct secret', async () => {
      mockAuthRepository.findById.mockResolvedValue(makeUser());
      mockAuthRepository.updateRole.mockResolvedValue({
        id: 'user-uuid', email: 'user@example.com', role: RoleEnum.ADMIN,
      });

      const result = await service.promote({
        userId: 'user-uuid', targetRole: RoleEnum.ADMIN, secretKey: adminSecret,
      });

      expect(result.role).toBe(RoleEnum.ADMIN);
      expect(mockAuthRepository.updateRole)
        .toHaveBeenCalledWith('user-uuid', RoleEnum.ADMIN);
    });

    it('should promote user to SUPERADMIN with correct secret', async () => {
      mockAuthRepository.findById.mockResolvedValue(makeUser());
      mockAuthRepository.updateRole.mockResolvedValue({
        id: 'user-uuid', email: 'user@example.com', role: RoleEnum.SUPERADMIN,
      });

      const result = await service.promote({
        userId: 'user-uuid', targetRole: RoleEnum.SUPERADMIN, secretKey: superAdminSecret,
      });

      expect(result.role).toBe(RoleEnum.SUPERADMIN);
    });

    it('should throw NotFoundException when user does not exist', async () => {
      mockAuthRepository.findById.mockResolvedValue(null);

      await expect(
        service.promote({ userId: 'ghost', targetRole: RoleEnum.ADMIN, secretKey: adminSecret })
      ).rejects.toThrow(NotFoundException);

      await expect(
        service.promote({ userId: 'ghost', targetRole: RoleEnum.ADMIN, secretKey: adminSecret })
      ).rejects.toThrow('User not found');

      expect(mockAuthRepository.updateRole).not.toHaveBeenCalled();
    });

    it('should throw BadRequestException when targetRole is USER', async () => {
      mockAuthRepository.findById.mockResolvedValue(makeUser());

      await expect(
        service.promote({ userId: 'user-uuid', targetRole: RoleEnum.USER, secretKey: adminSecret })
      ).rejects.toThrow(BadRequestException);

      await expect(
        service.promote({ userId: 'user-uuid', targetRole: RoleEnum.USER, secretKey: adminSecret })
      ).rejects.toThrow('Target role cannot be USER');

      expect(mockAuthRepository.updateRole).not.toHaveBeenCalled();
    });

    it('should throw UnauthorizedException when ADMIN secret is wrong', async () => {
      mockAuthRepository.findById.mockResolvedValue(makeUser());

      await expect(
        service.promote({ userId: 'user-uuid', targetRole: RoleEnum.ADMIN, secretKey: 'wrong' })
      ).rejects.toThrow(UnauthorizedException);

      await expect(
        service.promote({ userId: 'user-uuid', targetRole: RoleEnum.ADMIN, secretKey: 'wrong' })
      ).rejects.toThrow('Invalid secret key');
    });

    it('should throw UnauthorizedException when SUPERADMIN secret is wrong', async () => {
      mockAuthRepository.findById.mockResolvedValue(makeUser());

      await expect(
        service.promote({
          userId: 'user-uuid',
          targetRole: RoleEnum.SUPERADMIN,
          secretKey: adminSecret,  // wrong — this is admin secret not superadmin
        })
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should not call updateRole when secret is wrong', async () => {
      mockAuthRepository.findById.mockResolvedValue(makeUser());

      await service.promote({
        userId: 'user-uuid', targetRole: RoleEnum.ADMIN, secretKey: 'wrong',
      }).catch(() => { });

      expect(mockAuthRepository.updateRole).not.toHaveBeenCalled();
    });
  });
});