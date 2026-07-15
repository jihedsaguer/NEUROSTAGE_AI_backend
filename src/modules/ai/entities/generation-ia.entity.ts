import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

@Entity('generation_ia')
export class GenerationIA {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  type: string;

  @Column({ type: 'text' })
  prompt: string;

  @Column({ type: 'json', nullable: true })
  response: any;

  @Column({ type: 'uuid', nullable: true })
  validePar: string | null;

  @CreateDateColumn()
  createdAt: Date;
}
