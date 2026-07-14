import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { LoginUseCase } from 'src/application/auth/login-use-case';
import type { PasswordHasher } from 'src/domain/ports/password-hasher';
import type { TokenSigner } from 'src/domain/ports/token-signer';
import type { UserRepository } from 'src/domain/user/user-repository';
import { NestJwtTokenSigner } from 'src/infrastructure/auth/nest-jwt-token-signer';
import {
  PASSWORD_HASHER,
  TOKEN_SIGNER,
  USER_REPOSITORY,
} from 'src/infrastructure/nest/injection-tokens';
import { UserModule } from 'src/presentation/user/user.module';
import { AuthController } from './auth.controller';
import { JWT_EXPIRES_IN } from './auth.constants';
import { JwtStrategy } from './strategies/jwt.strategy';

@Module({
  imports: [
    UserModule,
    PassportModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        secret: configService.get<string>('JWT_SECRET', 'dev-jwt-secret'),
        signOptions: { expiresIn: JWT_EXPIRES_IN },
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [
    {
      provide: TOKEN_SIGNER,
      useClass: NestJwtTokenSigner,
    },
    {
      provide: LoginUseCase,
      useFactory: (
        userRepository: UserRepository,
        passwordHasher: PasswordHasher,
        tokenSigner: TokenSigner,
      ) => new LoginUseCase(userRepository, passwordHasher, tokenSigner),
      inject: [USER_REPOSITORY, PASSWORD_HASHER, TOKEN_SIGNER],
    },
    JwtStrategy,
  ],
})
export class AuthModule {}
