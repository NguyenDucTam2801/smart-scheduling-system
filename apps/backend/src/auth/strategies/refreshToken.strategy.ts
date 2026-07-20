import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { Request } from 'express';

@Injectable()
export class RefreshTokenStrategy extends PassportStrategy(
    Strategy,
    'jwt-refresh',
) {
    constructor() {
        super({
            jwtFromRequest: ExtractJwt.fromExtractors([
                (req: Request) => req?.cookies?.refresh_token,
            ]),
            secretOrKey: process.env.JWT_REFRESH_SECRET!,
            passReqToCallback: true,
            ignoreExpiration: false,
        });
    }

    validate(
        req: Request,
        payload: { sub: string; email: string; role: string },
    ) {
        const refreshToken = req.cookies.refresh_token;

        return {
            ...payload,
            refreshToken,
        };
    }
}