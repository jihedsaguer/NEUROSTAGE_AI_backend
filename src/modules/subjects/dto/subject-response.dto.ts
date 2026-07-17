export class SubjectResponseDto {
  id: string;
  title: string;
  description: string;
  technologies: string[];
  level: string;
  prerequisites: string;
  status: string;

  createdBy: {
    id: string;
    firstName: string;
    lastName: string;
  };

  createdAt: Date;
  updatedAt: Date;
}