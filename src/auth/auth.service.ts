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
import { DataSource, MoreThan, Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { Customer } from '../entity/customer.entity';
import { Company } from '../entity/company.entity';
import { OnboardingDraft } from '../entity/onboarding.entity';
import { OtpCode } from '../entity/otp.entity';
import {
  SignupStep1Dto,
  SignupStep2Dto,
  SendOtpDto,
  VerifyOtpDto,
} from './dto/auth.dto';
import { ConfigService } from '@nestjs/config';
import { EmailService } from './email.service';

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(Customer)
    private readonly customerRepository: Repository<Customer>,
    @InjectRepository(Company)
    private readonly companyRepository: Repository<Company>,
    @InjectRepository(OnboardingDraft)
    private readonly onboardingDraftRepository: Repository<OnboardingDraft>,
    @InjectRepository(OtpCode)
    private readonly otpRepository: Repository<OtpCode>,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly dataSource: DataSource,
    private readonly emailService: EmailService,
  ) {}

  // ─── Signup Step 1: Save personal details to draft ────────
  async signupStep1(dto: SignupStep1Dto) {
    // Check if customer already exists (fully registered)
    const existingCustomer = await this.customerRepository.findOne({
      where: { email: dto.email },
    });
    if (existingCustomer) {
      throw new ConflictException('Email already registered');
    }

    // Check if phone number is already taken
    const existingMobile = await this.customerRepository.findOne({
      where: { mobile: dto.phoneNumber },
    });
    if (existingMobile) {
      throw new ConflictException('Phone number already registered');
    }

    // Check if a draft already exists for this email
    let draft = await this.onboardingDraftRepository.findOne({
      where: { email: dto.email },
    });

    const formData = {
      fullName: dto.fullName,
      email: dto.email,
      phoneNumber: dto.phoneNumber,
    };

    if (draft) {
      draft.formData = { ...draft.formData, ...formData };
      draft.currentStep = 1;
      draft.status = 'IN_PROGRESS';
    } else {
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

  // ─── Signup Step 2: Save business details + create Customer & Company ─
  async signupStep2(dto: SignupStep2Dto) {
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

    const { fullName, email, phoneNumber } = draft.formData;

    if (!fullName || !email || !phoneNumber) {
      throw new BadRequestException(
        'Incomplete step 1 data. Please complete step 1 first.',
      );
    }

    // Check if customer already exists
    const existingCustomer = await this.customerRepository.findOne({
      where: { email },
    });
    if (existingCustomer) {
      throw new ConflictException('Email already registered');
    }

    // Check if mobile number is already taken
    const existingMobile = await this.customerRepository.findOne({
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

    // Use a transaction to create Customer + Company + update draft atomically
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const customer = queryRunner.manager.create(Customer, {
        fullName,
        email,
        mobile: phoneNumber,
      });
      const savedCustomer = await queryRunner.manager.save(customer);

      const company = queryRunner.manager.create(Company, {
        legalName: dto.legalName,
        pan: dto.pan,
        gstin: dto.gstin,
        address: dto.address,
        customer: savedCustomer,
      });
      const savedCompany = await queryRunner.manager.save(company);

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
        user: this.sanitizeCustomer(savedCustomer),
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

  // ─── Send OTP (for login) ─────────────────────────────────
  async sendOtp(dto: SendOtpDto) {
    const customer = await this.customerRepository.findOne({
      where: { email: dto.email },
    });
    if (!customer) {
      throw new NotFoundException('No account found with this email');
    }

    // Rate limit: check if an unexpired OTP was sent in the last 60 seconds
    const recentOtp = await this.otpRepository.findOne({
      where: {
        email: dto.email,
        isUsed: false,
        expiresAt: MoreThan(new Date(Date.now() + 4 * 60 * 1000)), // created < 60s ago (5min - 4min = 1min)
      },
    });
    if (recentOtp) {
      throw new BadRequestException(
        'OTP already sent. Please wait before requesting a new one.',
      );
    }

    // Generate 6-digit OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const otpHash = await bcrypt.hash(otp, 10);

    // Invalidate any existing unused OTPs for this email
    await this.otpRepository.update(
      { email: dto.email, isUsed: false },
      { isUsed: true },
    );

    // Save new OTP
    const otpRecord = this.otpRepository.create({
      email: dto.email,
      otpHash,
      expiresAt: new Date(Date.now() + 5 * 60 * 1000), // 5 minutes
    });
    await this.otpRepository.save(otpRecord);

    // Send email via Mailtrap sandbox
    await this.emailService.sendOtpEmail(dto.email, otp);

    return { message: 'OTP sent to your email' };
  }

  // ─── Verify OTP (login) ───────────────────────────────────
  async verifyOtp(dto: VerifyOtpDto) {
    const customer = await this.customerRepository.findOne({
      where: { email: dto.email },
    });
    if (!customer) {
      throw new UnauthorizedException('Invalid credentials');
    }

    // Find the latest unused, unexpired OTP for this email
    const otpRecord = await this.otpRepository.findOne({
      where: {
        email: dto.email,
        isUsed: false,
        expiresAt: MoreThan(new Date()),
      },
      order: { createdAt: 'DESC' },
    });

    if (!otpRecord) {
      throw new UnauthorizedException(
        'OTP expired or not found. Request a new one.',
      );
    }

    // Check max attempts (5)
    if (otpRecord.attempts >= 5) {
      otpRecord.isUsed = true;
      await this.otpRepository.save(otpRecord);
      throw new UnauthorizedException(
        'Too many failed attempts. Request a new OTP.',
      );
    }

    // Verify OTP hash
    const isValid = await bcrypt.compare(dto.otp, otpRecord.otpHash);
    if (!isValid) {
      otpRecord.attempts += 1;
      await this.otpRepository.save(otpRecord);
      throw new UnauthorizedException('Invalid OTP');
    }

    // Mark OTP as used
    otpRecord.isUsed = true;
    await this.otpRepository.save(otpRecord);

    // Generate tokens
    const tokens = await this.generateTokens(customer.id, customer.email);
    await this.updateRefreshToken(customer.id, tokens.refreshToken);

    return {
      user: this.sanitizeCustomer(customer),
      ...tokens,
    };
  }

  // ─── Refresh Tokens ───────────────────────────────────────
  async refreshTokens(customerId: string, refreshToken: string) {
    const customer = await this.customerRepository.findOne({
      where: { id: customerId },
    });
    if (!customer || !customer.hashedRefreshToken) {
      throw new ForbiddenException('Access denied');
    }

    const rtMatches = await bcrypt.compare(
      refreshToken,
      customer.hashedRefreshToken,
    );
    if (!rtMatches) {
      throw new ForbiddenException('Access denied');
    }

    const tokens = await this.generateTokens(customer.id, customer.email);
    await this.updateRefreshToken(customer.id, tokens.refreshToken);

    return tokens;
  }

  // ─── Logout ────────────────────────────────────────────────
  async logout(customerId: string) {
    await this.customerRepository.update(customerId, {
      hashedRefreshToken: null,
    });
    return { message: 'Logged out successfully' };
  }

  // ─── Get Profile ──────────────────────────────────────────
  async getProfile(customerId: string) {
    const customer = await this.customerRepository.findOne({
      where: { id: customerId },
      relations: ['companies'],
    });
    if (!customer) {
      throw new UnauthorizedException('Customer not found');
    }
    return this.sanitizeCustomer(customer);
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
    await this.customerRepository.update(userId, {
      hashedRefreshToken: hashed,
    });
  }

  private sanitizeCustomer(customer: Customer) {
    const { hashedRefreshToken, ...result } = customer;
    return result;
  }
}
