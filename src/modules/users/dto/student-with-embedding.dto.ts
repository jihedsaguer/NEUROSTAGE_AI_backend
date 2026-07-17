import { Expose } from 'class-transformer';

export class StudentWithEmbeddingDto {
  @Expose()
  id: string;

  @Expose()
  firstName: string;

  @Expose()
  lastName: string;

  @Expose()
  email: string;

  @Expose()
  university?: string;

  @Expose()
  level?: string;

  @Expose()
  skills?: string[];

  @Expose()
  isAiProcessed: boolean;
}
