import { IsString, IsUUID, Matches, ValidateIf } from 'class-validator';

export class CreateChatDto {
  @ValidateIf((_object, value) => value !== undefined)
  @IsUUID()
  user_id?: string;

  @ValidateIf((_object, value) => value !== undefined)
  @IsString()
  @Matches(/\S/, { message: 'external_id must not be blank' })
  external_id?: string;
}
