import { User } from 'src/domain/user/user';

export class UserResponseDto {
  id: string;
  name: string;
  surname: string;
  email: string;
  createdAt: Date;
  updatedAt: Date;

  static fromDomain(user: User): UserResponseDto {
    const dto = new UserResponseDto();
    dto.id = user.getId().toString();
    dto.name = user.getName();
    dto.surname = user.getSurname();
    dto.email = user.getEmail().toString();
    dto.createdAt = user.getCreatedAt();
    dto.updatedAt = user.getUpdatedAt();
    return dto;
  }
}
