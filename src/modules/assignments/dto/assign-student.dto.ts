import { IsString , IsNotEmpty, IsOptional} from "class-validator";

export class AssignStudentDto {
    @IsString()
    @IsNotEmpty()
    studentId: string;

    @IsString()
    @IsNotEmpty()
    encadreurId: string;
}

