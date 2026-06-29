import { IsIn, IsOptional, IsString, Length, Matches, MaxLength } from "class-validator";

export class VerifyPinDto {
  @IsString()
  @Length(4, 6)
  pin!: string;
}

export class RegisterPinDto {
  @IsString()
  @Length(4, 4)
  @Matches(/^\d{4}$/)
  newPin!: string;
}

export class ChangePinDto {
  @IsString()
  @Length(4, 4)
  @Matches(/^\d{4}$/)
  currentPin!: string;

  @IsString()
  @Length(4, 4)
  @Matches(/^\d{4}$/)
  newPin!: string;
}

export class UploadProfileAvatarDto {
  @IsString()
  @MaxLength(3_000_000)
  imageData!: string;

  @IsOptional()
  @IsIn(["image/jpeg", "image/png", "image/webp"])
  contentType?: string;
}
