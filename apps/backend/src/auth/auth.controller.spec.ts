import { Test, TestingModule } from '@nestjs/testing';
import {
  BadRequestException,
  NotFoundException,
  UnauthorizedException
} from '@nestjs/common';
import { RoleEnum } from '@prisma/client';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';

// ── Mock service — plain jest.fn() only, NO preset values ──────────
const mockAuthService = {
  register: jest.fn(),
  login: jest.fn(),
  refreshTokens: jest.fn(),
  logOut: jest.fn(),
  promote: jest.fn(),
};

// ── Reusable test data ─────────────────────────────────────────────
const mockTokens = {
  accessToken: 'mock-access-token',
  refreshToken: 'mock-refresh-token',
};

const mockUser = {
  sub: 'user-uuid',
  email: 'user@example.com',
  role: RoleEnum.USER,
};

const mockAdminUser = {
  sub: 'admin-uuid',
  email: 'admin@example.com',
  role: RoleEnum.ADMIN,
};

describe('AuthController', () => {
  let controller: AuthController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        { provide: AuthService, useValue: mockAuthService },
      ],
    }).compile();

    controller = module.get<AuthController>(AuthController);
    jest.clearAllMocks();  // ← clears all mocks before each test
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  // ── signup() ───────────────────────────────────────────────────────

  describe('signup()', () => {
    const dto = { name: 'Tâm', email: 'user@example.com', password: 'User1234!' };

    it('should call register with dto and return void', async () => {
      mockAuthService.register.mockResolvedValue(undefined);

      // Note: controller does NOT return — just calls the service
      await controller.signup(dto);

      expect(mockAuthService.register).toHaveBeenCalledWith(dto);
      expect(mockAuthService.register).toHaveBeenCalledTimes(1);
    });

    it('should return undefined since controller has no return statement', async () => {
      mockAuthService.register.mockResolvedValue(undefined);

      const result = await controller.signup(dto);

      // Controller calls service but doesn't return it
      expect(result).toBeUndefined();
    });

    it('should throw BadRequestException when email already registered', async () => {
      mockAuthService.register.mockRejectedValue(
        new BadRequestException('Email already registered')
      );

      // await expect(controller.signup(dto))
      //   .rejects.toThrow(BadRequestException);

      await expect(controller.signup(dto)).rejects.toThrow(
        new BadRequestException('Email already registered')
      );

      expect(mockAuthService.register).toHaveBeenCalledWith(dto);
    });
  });

  // ── login() ────────────────────────────────────────────────────────

  describe('login()', () => {
    const dto = { email: 'user@example.com', password: 'User1234!' };

    it('should return tokens on successful login', async () => {
      mockAuthService.login.mockResolvedValue(mockTokens);

      const result = await controller.login(dto);

      expect(result).toEqual(mockTokens);
      expect(result).toHaveProperty('accessToken');
      expect(result).toHaveProperty('refreshToken');
      expect(mockAuthService.login).toHaveBeenCalledWith(dto);
      expect(mockAuthService.login).toHaveBeenCalledTimes(1);
    });

    it('should throw UnauthorizedException when credentials are wrong', async () => {
      mockAuthService.login.mockRejectedValue(
        new UnauthorizedException('Invalid Credentials')
      );

      await expect(controller.login(dto))
        .rejects.toThrow(UnauthorizedException);

      await expect(controller.login(dto))
        .rejects.toThrow('Invalid Credentials');
    });

    it('should throw UnauthorizedException when email not found', async () => {
      mockAuthService.login.mockRejectedValue(
        new UnauthorizedException('Invalid Credentials')
      );

      await expect(
        controller.login({ email: 'nobody@example.com', password: 'any' })
      ).rejects.toThrow(UnauthorizedException);
    });
  });

  // ── refreshTokens() ───────────────────────────────────────────────

  describe('refreshTokens()', () => {

    it('should return new tokens with sub and refreshToken from req.user', async () => {
      mockAuthService.refreshTokens.mockResolvedValue(mockTokens);

      const mockReq = {
        user: {
          sub: 'user-uuid',
          email: 'user@example.com',
          role: RoleEnum.USER,
          refreshToken: 'mock-refresh-token',
        },
      } as any;

      const result = await controller.refreshTokens(mockReq);

      expect(result).toEqual(mockTokens);
      expect(mockAuthService.refreshTokens).toHaveBeenCalledWith(
        'user-uuid',
        'mock-refresh-token',
      );
      expect(mockAuthService.refreshTokens).toHaveBeenCalledTimes(1);
    });

    it('should throw UnauthorizedException when refresh token is invalid', async () => {
      mockAuthService.refreshTokens.mockRejectedValue(
        new UnauthorizedException('Invalid Credentials')
      );

      const mockReq = {
        user: { sub: 'user-uuid', refreshToken: 'invalid-token' },
      } as any;

      await expect(controller.refreshTokens(mockReq))
        .rejects.toThrow(UnauthorizedException);

      await expect(controller.refreshTokens(mockReq))
        .rejects.toThrow('Invalid Credentials');
    });

    it('should throw UnauthorizedException when user is logged out (null hash)', async () => {
      mockAuthService.refreshTokens.mockRejectedValue(
        new UnauthorizedException('Invalid Credentials')
      );

      const mockReq = {
        user: { sub: 'user-uuid', refreshToken: 'any' },
      } as any;

      await expect(controller.refreshTokens(mockReq))
        .rejects.toThrow(UnauthorizedException);
    });
  });

  // ── getUser() ─────────────────────────────────────────────────────

  describe('getUser()', () => {

    it('should return current user JWT payload', async () => {
      const result = await controller.getUser(mockUser as any);

      // getUser just returns the payload — no service call
      expect(result).toEqual(mockUser);
      expect(result).toHaveProperty('sub');
      expect(result).toHaveProperty('email');
      expect(result).toHaveProperty('role');
    });

    it('should return admin user payload correctly', async () => {
      const result = await controller.getUser(mockAdminUser as any);

      expect(result).toEqual(mockAdminUser);
      expect(result.role).toBe(RoleEnum.ADMIN);
    });

    it('should not call any service method', async () => {
      await controller.getUser(mockUser as any);

      expect(mockAuthService.register).not.toHaveBeenCalled();
      expect(mockAuthService.login).not.toHaveBeenCalled();
      expect(mockAuthService.logOut).not.toHaveBeenCalled();
    });
  });

  // ── logOut() ──────────────────────────────────────────────────────

  describe('logOut()', () => {

    it('should call logOut with current user sub', async () => {
      mockAuthService.logOut.mockResolvedValue(undefined);

      await controller.logOut(mockUser as any);

      expect(mockAuthService.logOut).toHaveBeenCalledWith(mockUser.sub);
      expect(mockAuthService.logOut).toHaveBeenCalledTimes(1);
    });

    it('should return undefined on successful logout', async () => {
      mockAuthService.logOut.mockResolvedValue(undefined);

      const result = await controller.logOut(mockUser as any);

      expect(result).toBeUndefined();
    });

    it('should throw when service throws on logout', async () => {
      mockAuthService.logOut.mockRejectedValue(new Error('DB error'));

      await expect(controller.logOut(mockUser as any))
        .rejects.toThrow('DB error');
    });
  });

  // ── promoteToAdmin() ──────────────────────────────────────────────

  describe('promoteToAdmin()', () => {
    const adminSecret = 'admin-secret';
    const superAdminSecret = 'superadmin-secret';

    it('should promote user to ADMIN', async () => {
      const promoted = {
        id: 'user-uuid',
        email: 'user@example.com',
        role: RoleEnum.ADMIN,
      };
      mockAuthService.promote.mockResolvedValue(promoted);

      const result = await controller.promoteToAdmin({
        userId: 'user-uuid',
        targetRole: RoleEnum.ADMIN,
        secretKey: adminSecret,
      });

      expect(result).toEqual(promoted);
      expect(result.role).toBe(RoleEnum.ADMIN);
      expect(mockAuthService.promote).toHaveBeenCalledWith({
        userId: 'user-uuid',
        targetRole: RoleEnum.ADMIN,
        secretKey: adminSecret,
      });
    });

    it('should promote user to SUPERADMIN', async () => {
      const promoted = {
        id: 'user-uuid',
        email: 'user@example.com',
        role: RoleEnum.SUPERADMIN,
      };
      mockAuthService.promote.mockResolvedValue(promoted);

      const result = await controller.promoteToAdmin({
        userId: 'user-uuid',
        targetRole: RoleEnum.SUPERADMIN,
        secretKey: superAdminSecret,
      });

      expect(result.role).toBe(RoleEnum.SUPERADMIN);
    });

    it('should throw BadRequestException when targetRole is USER', async () => {
      mockAuthService.promote.mockRejectedValue(
        new BadRequestException('Target role cannot be USER')
      );

      await expect(
        controller.promoteToAdmin({
          userId: 'user-uuid',
          targetRole: RoleEnum.USER,
          secretKey: adminSecret,
        })
      ).rejects.toThrow(BadRequestException);

      await expect(
        controller.promoteToAdmin({
          userId: 'user-uuid',
          targetRole: RoleEnum.USER,
          secretKey: adminSecret,
        })
      ).rejects.toThrow('Target role cannot be USER');
    });

    it('should throw UnauthorizedException when secret key is wrong', async () => {
      mockAuthService.promote.mockRejectedValue(
        new UnauthorizedException('Invalid secret key')
      );

      await expect(
        controller.promoteToAdmin({
          userId: 'user-uuid',
          targetRole: RoleEnum.ADMIN,
          secretKey: 'wrong-secret',
        })
      ).rejects.toThrow(UnauthorizedException);

      await expect(
        controller.promoteToAdmin({
          userId: 'user-uuid',
          targetRole: RoleEnum.ADMIN,
          secretKey: 'wrong-secret',
        })
      ).rejects.toThrow('Invalid secret key');
    });

    it('should throw BadRequestException when targetRole string is invalid', async () => {
      mockAuthService.promote.mockRejectedValue(
        new BadRequestException('targetRole must be a valid enum value')
      );

      await expect(
        controller.promoteToAdmin({
          userId: 'user-uuid',
          targetRole: 'ADMINasf' as any,
          secretKey: adminSecret,
        })
      ).rejects.toThrow(BadRequestException);

      await expect(
        controller.promoteToAdmin({
          userId: 'user-uuid',
          targetRole: 'ADMINasf' as any,
          secretKey: adminSecret,
        })
      ).rejects.toThrow('targetRole must be a valid enum value');
    });

    it('should throw NotFoundException when user does not exist', async () => {
      mockAuthService.promote.mockRejectedValue(
        new NotFoundException('User not found')
      );

      await expect(
        controller.promoteToAdmin({
          userId: '00000000-0000-0000-0000-000000000000',
          targetRole: RoleEnum.ADMIN,
          secretKey: adminSecret,
        })
      ).rejects.toThrow(NotFoundException);

      await expect(
        controller.promoteToAdmin({
          userId: '00000000-0000-0000-0000-000000000000',
          targetRole: RoleEnum.ADMIN,
          secretKey: adminSecret,
        })
      ).rejects.toThrow('User not found');
    });

    it('should call promote with exact dto', async () => {
      mockAuthService.promote.mockResolvedValue({
        id: 'user-uuid', email: 'user@example.com', role: RoleEnum.ADMIN,
      });

      const dto = { userId: 'user-uuid', targetRole: RoleEnum.ADMIN, secretKey: adminSecret };
      await controller.promoteToAdmin(dto);

      expect(mockAuthService.promote).toHaveBeenCalledWith(dto);
      expect(mockAuthService.promote).toHaveBeenCalledTimes(1);
    });
  });

});