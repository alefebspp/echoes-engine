import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type {
  AccessTokenPayload,
  TokenSigner,
} from 'src/domain/ports/token-signer';

@Injectable()
export class NestJwtTokenSigner implements TokenSigner {
  constructor(private readonly jwtService: JwtService) {}

  sign(payload: AccessTokenPayload): string {
    return this.jwtService.sign({
      sub: payload.userId,
      email: payload.email,
    });
  }
}
