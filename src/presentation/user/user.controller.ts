import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Req,
  UseFilters,
  UseGuards,
} from '@nestjs/common';
import { Request } from 'express';
import { CreateUserUseCase } from 'src/application/user/create-user-use-case';
import { DeleteUserUseCase } from 'src/application/user/delete-user-use-case';
import { GetUserByIdUseCase } from 'src/application/user/get-user-by-id-use-case';
import { ListUsersUseCase } from 'src/application/user/list-users-use-case';
import { UpdateUserUseCase } from 'src/application/user/update-user-use-case';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { AuthenticatedUser } from 'src/auth/strategies/jwt.strategy';
import { DomainExceptionFilter } from 'src/infrastructure/nest/domain-exception.filter';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UserResponseDto } from './dto/user-response.dto';

type AuthenticatedRequest = Request & { user: AuthenticatedUser };

@Controller('users')
@UseFilters(DomainExceptionFilter)
export class UserController {
  constructor(
    private readonly createUserUseCase: CreateUserUseCase,
    private readonly listUsersUseCase: ListUsersUseCase,
    private readonly getUserByIdUseCase: GetUserByIdUseCase,
    private readonly updateUserUseCase: UpdateUserUseCase,
    private readonly deleteUserUseCase: DeleteUserUseCase,
  ) {}

  @Post()
  async create(@Body() createUserDto: CreateUserDto): Promise<UserResponseDto> {
    const user = await this.createUserUseCase.execute(createUserDto);
    return UserResponseDto.fromDomain(user);
  }

  @Get()
  @UseGuards(JwtAuthGuard)
  async findAll(): Promise<UserResponseDto[]> {
    const users = await this.listUsersUseCase.execute();
    return users.map((user) => UserResponseDto.fromDomain(user));
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  async findMe(
    @Req() request: AuthenticatedRequest,
  ): Promise<UserResponseDto> {
    const user = await this.getUserByIdUseCase.execute(request.user.userId);
    return UserResponseDto.fromDomain(user);
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard)
  async findOne(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<UserResponseDto> {
    const user = await this.getUserByIdUseCase.execute(id);
    return UserResponseDto.fromDomain(user);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard)
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateUserDto: UpdateUserDto,
  ): Promise<UserResponseDto> {
    const user = await this.updateUserUseCase.execute(id, updateUserDto);
    return UserResponseDto.fromDomain(user);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  async remove(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    await this.deleteUserUseCase.execute(id);
  }
}
