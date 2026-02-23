import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  OneToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { User } from './user.entity';

@Entity('companies')
export class Company {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  legalName: string;

  @Column({ unique: true })
  pan: string;

  @Column({ nullable: true })
  gstin: string;

  @Column({ nullable: true })
  address: string;

  @OneToOne(() => User, (user) => user.company)
  @JoinColumn()
  user: User;

  @Column()
  userId: string;

  @Column({
    type: 'enum',
    enum: ['ACTIVE', 'PENDING', 'REJECTED'],
    default: 'PENDING',
  })
  status: string;

  @CreateDateColumn()
  createdAt: Date;
}
