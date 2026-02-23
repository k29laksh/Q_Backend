import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { User } from '../entity/user.entity';
import { Company } from '../entity/company.entity';
import { OnboardingDraft } from '../entity/onboarding.entity';
import { SignupStep1Dto, SignupStep2Dto, LoginDto } from './dto/auth.dto';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(Company)
    private readonly companyRepository: Repository<Company>,
    @InjectRepository(OnboardingDraft)
    private readonly onboardingDraftRepository: Repository<OnboardingDraft>,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly dataSource: DataSource,
  ) {}

  // ─── Signup Step 1: Save personal details to draft ────────
  async signupStep1(dto: SignupStep1Dto) {
    // Check if user already exists (fully registered)
    const existingUser = await this.userRepository.findOne({
      where: { email: dto.email },
    });
    if (existingUser) {
      throw new ConflictException('Email already registered');
    }

    // Check if phone number is already taken
    const existingMobile = await this.userRepository.findOne({
      where: { mobile: dto.phoneNumber },
    });
    if (existingMobile) {
      throw new ConflictException('Phone number already registered');
    }

    // Check if a draft already exists for this email
    let draft = await this.onboardingDraftRepository.findOne({
      where: { email: dto.email },
    });

    const hashedPassword = await bcrypt.hash(dto.password, 10);

    const formData = {
      fullName: dto.fullName,
      email: dto.email,
      phoneNumber: dto.phoneNumber,
      password: hashedPassword,
    };

    if (draft) {
      // Update existing draft
      draft.formData = { ...draft.formData, ...formData };
      draft.currentStep = 1;
      draft.status = 'IN_PROGRESS';
    } else {
      // Create new draft
      draft = this.onboardingDraftRepository.create({
        email: dto.email,
        formData,
        currentStep: 1,
        status: 'IN_PROGRESS',
      });
    }

    const savedDraft = await this.onboardingDraftRepository.save(draft);

    return {
      message: 'Step 1 completed. Proceed to step 2.',
      draftId: savedDraft.id,
      currentStep: savedDraft.currentStep,
      email: savedDraft.email,
    };
  }

  // ─── Signup Step 2: Save business details + create User & Company ─
  async signupStep2(dto: SignupStep2Dto) {
    // Find the draft from step 1
    const draft = await this.onboardingDraftRepository.findOne({
      where: { email: dto.email },
    });

    if (!draft) {
      throw new NotFoundException(
        'No onboarding draft found. Please complete step 1 first.',
      );
    }

    if (draft.status === 'SUBMITTED') {
      throw new BadRequestException(
        'This onboarding has already been completed.',
      );
    }

    const { fullName, email, phoneNumber, password } = draft.formData;

    if (!fullName || !email || !phoneNumber || !password) {
      throw new BadRequestException(
        'Incomplete step 1 data. Please complete step 1 first.',
      );
    }

    // Check if user already exists
    const existingUser = await this.userRepository.findOne({
      where: { email },
    });
    if (existingUser) {
      throw new ConflictException('Email already registered');
    }

    // Check if mobile number is already taken
    const existingMobile = await this.userRepository.findOne({
      where: { mobile: phoneNumber },
    });
    if (existingMobile) {
      throw new ConflictException('Phone number already registered');
    }

    // Check if PAN is already taken
    const existingCompany = await this.companyRepository.findOne({
      where: { pan: dto.pan },
    });
    if (existingCompany) {
      throw new ConflictException('PAN already registered');
    }

    // Use a transaction to create User + Company + update draft atomically
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // Create User
      const user = queryRunner.manager.create(User, {
        fullName,
        email,
        password, // already hashed in step 1
        mobile: phoneNumber,
      });
      const savedUser = await queryRunner.manager.save(user);

      // Create Company
      const company = queryRunner.manager.create(Company, {
        legalName: dto.legalName,
        pan: dto.pan,
        gstin: dto.gstin,
        address: dto.address,
        userId: savedUser.id,
      });
      const savedCompany = await queryRunner.manager.save(company);

      // Mark draft as submitted
      draft.formData = {
        ...draft.formData,
        pan: dto.pan,
        legalName: dto.legalName,
        gstin: dto.gstin,
        address: dto.address,
      };
      draft.currentStep = 2;
      draft.status = 'SUBMITTED';
      await queryRunner.manager.save(draft);

      await queryRunner.commitTransaction();

      return {
        message: 'Signup completed successfully. Please login to continue.',
        user: this.sanitizeUser(savedUser),
        company: {
          id: savedCompany.id,
          legalName: savedCompany.legalName,
          pan: savedCompany.pan,
          gstin: savedCompany.gstin,
          address: savedCompany.address,
        },
      };
    } catch (error) {
      await queryRunner.rollbackTransaction();
      // Handle unique constraint violations from DB race conditions
      if (error?.code === '23505') {
        const detail: string = error.detail || '';
        if (detail.includes('email')) {
          throw new ConflictException('Email already registered');
        } else if (detail.includes('mobile')) {
          throw new ConflictException('Phone number already registered');
        } else if (detail.includes('pan')) {
          throw new ConflictException('PAN already registered');
        }
        throw new ConflictException(
          'Duplicate value violates unique constraint',
        );
      }
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  // ─── Login ─────────────────────────────────────────────────
  async login(dto: LoginDto) {
    const user = await this.userRepository.findOne({
      where: { email: dto.email },
    });
    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const passwordMatches = await bcrypt.compare(dto.password, user.password);
    if (!passwordMatches) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const tokens = await this.generateTokens(user.id, user.email);
    await this.updateRefreshToken(user.id, tokens.refreshToken);

    return {
      user: this.sanitizeUser(user),
      ...tokens,
    };
  }

  // ─── Refresh Tokens ───────────────────────────────────────
  async refreshTokens(userId: string, refreshToken: string) {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user || !user.hashedRefreshToken) {
      throw new ForbiddenException('Access denied');
    }

    const rtMatches = await bcrypt.compare(
      refreshToken,
      user.hashedRefreshToken,
    );
    if (!rtMatches) {
      throw new ForbiddenException('Access denied');
    }

    const tokens = await this.generateTokens(user.id, user.email);
    await this.updateRefreshToken(user.id, tokens.refreshToken);

    return tokens;
  }

  // ─── Logout ────────────────────────────────────────────────
  async logout(userId: string) {
    await this.userRepository.update(userId, { hashedRefreshToken: null });
    return { message: 'Logged out successfully' };
  }

  // ─── Get Profile ──────────────────────────────────────────
  async getProfile(userId: string) {
    const user = await this.userRepository.findOne({
      where: { id: userId },
      relations: ['company'],
    });
    if (!user) {
      throw new UnauthorizedException('User not found');
    }
    return this.sanitizeUser(user);
  }

  // ─── Get Draft Status ─────────────────────────────────────
  async getDraftStatus(email: string) {
    const draft = await this.onboardingDraftRepository.findOne({
      where: { email },
    });
    if (!draft) {
      throw new NotFoundException('No onboarding draft found for this email.');
    }

    return {
      id: draft.id,
      email: draft.email,
      currentStep: draft.currentStep,
      status: draft.status,
      formData: {
        fullName: draft.formData.fullName,
        email: draft.formData.email,
        phoneNumber: draft.formData.phoneNumber,
        // Never expose password hash
      },
    };
  }

  // ─── Helpers ──────────────────────────────────────────────
  private async generateTokens(userId: string, email: string) {
    const payload = { sub: userId, email };

    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(payload, {
        secret: this.configService.get<string>('JWT_ACCESS_SECRET'),
        expiresIn: '15m',
      }),
      this.jwtService.signAsync(payload, {
        secret: this.configService.get<string>('JWT_REFRESH_SECRET'),
        expiresIn: '7d',
      }),
    ]);

    return { accessToken, refreshToken };
  }

  private async updateRefreshToken(userId: string, refreshToken: string) {
    const hashed = await bcrypt.hash(refreshToken, 10);
    await this.userRepository.update(userId, { hashedRefreshToken: hashed });
  }

  private sanitizeUser(user: User) {
    const { password, hashedRefreshToken, ...result } = user;
    return result;
  }
}
