import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('onboarding_drafts')
@Index(['email'], { unique: true })
export class OnboardingDraft {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  email: string;

  @Column({ type: 'jsonb', default: {} })
  formData: Record<string, any>;

  @Column({ default: 1 })
  currentStep: number;

  @Column({
    type: 'enum',
    enum: ['IN_PROGRESS', 'SUBMITTED'],
    default: 'IN_PROGRESS',
  })
  status: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
