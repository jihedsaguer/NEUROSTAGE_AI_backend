import { IsNotEmpty, MinLength } from "class-validator";

export class LoginDto {
    @IsNotEmpty()
    email: string;

    @MinLength(6)
    password: string;
}
