import { IsNotEmpty, IsString } from 'class-validator';

export class CreateCandidatureDto {
    @IsString() 
    @IsNotEmpty()
    subjectId: string;

    @IsString()
    @IsNotEmpty()
    motivation: string;
}
