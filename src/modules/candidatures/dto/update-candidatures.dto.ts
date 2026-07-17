import { IsEnum, IsNotEmpty, IsString, IsUUID, IsOptional, IsEmail } from "class-validator";
import { CandidatureStatus } from "../entities/candidature.entity";

export class UpdateCandidatureDto {
    @IsEnum(CandidatureStatus)
    status: CandidatureStatus;

    // Optional: Admin can specify encadrant pro when accepting candidature
    // Used when subject creator is not an encadrant pro (e.g., admin created the subject)
    @IsUUID()
    @IsOptional()
    encadrantProId?: string;

    @IsEmail()
    @IsOptional()
    encadrantProEmail?: string;
}