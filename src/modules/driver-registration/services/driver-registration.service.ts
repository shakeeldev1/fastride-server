import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { normalizeAreaText } from '../../../common/utils/area-normalizer';
import { CloudinaryService } from '../../user/services/cloudinary.service';
import { User } from '../../user/entities/user.entity';
import { CreateDriverRegistrationDto } from '../dto/create-driver-registration.dto';
import { DriverRegistration } from '../entities/driver-registration.entity';

type UploadableFile = {
  buffer: Buffer;
  mimetype: string;
  originalname: string;
  size?: number;
};

@Injectable()
export class DriverRegistrationService {
  constructor(
    @InjectRepository(DriverRegistration)
    private readonly driverRegistrationRepository: Repository<DriverRegistration>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    private readonly cloudinaryService: CloudinaryService,
  ) {}

  async create(
    userId: string,
    dto: CreateDriverRegistrationDto,
    files: Record<string, UploadableFile[]>,
  ) {
    const user = await this.userRepository.findOne({ where: { id: userId } });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    const existingRegistration = await this.driverRegistrationRepository.findOne({
      where: { userId },
    });

    if (existingRegistration) {
      throw new ConflictException('Driver registration already exists for this user');
    }

    const personalPicture = this.requireFile(files, 'personalPicture');
    const frontSideOfLicense = this.requireFile(files, 'frontSideOfLicense');
    const cnicFront = this.requireFile(files, 'cnicFront');
    const cnicBack = this.requireFile(files, 'cnicBack');

    // These four are optional now — the client wants a simpler signup, so a
    // driver can submit without them and add them later if ever required.
    const selfieWithDriverLicense = this.optionalFile(files, 'selfieWithDriverLicense');
    const photoOfVehicle = this.optionalFile(files, 'photoOfVehicle');
    const vehicleRegistrationCertificate = this.optionalFile(
      files,
      'vehicleRegistrationCertificate',
    );
    const backsideOfVehicleInformation = this.optionalFile(
      files,
      'backsideOfVehicleInformation',
    );

    const folder = `indrive/driver-registrations/${userId}`;

    const [
      personalPictureUpload,
      frontSideOfLicenseUpload,
      cnicFrontUpload,
      cnicBackUpload,
      selfieWithDriverLicenseUpload,
      photoOfVehicleUpload,
      vehicleRegistrationCertificateUpload,
      backsideOfVehicleInformationUpload,
    ] = await Promise.all([
      this.cloudinaryService.uploadImage(personalPicture, `${folder}/personal-picture`),
      this.cloudinaryService.uploadImage(frontSideOfLicense, `${folder}/front-side-of-license`),
      this.cloudinaryService.uploadImage(cnicFront, `${folder}/cnic-front`),
      this.cloudinaryService.uploadImage(cnicBack, `${folder}/cnic-back`),
      this.uploadIfPresent(selfieWithDriverLicense, `${folder}/selfie-with-driver-license`),
      this.uploadIfPresent(photoOfVehicle, `${folder}/photo-of-vehicle`),
      this.uploadIfPresent(
        vehicleRegistrationCertificate,
        `${folder}/vehicle-registration-certificate`,
      ),
      this.uploadIfPresent(
        backsideOfVehicleInformation,
        `${folder}/backside-of-vehicle-information`,
      ),
    ]);

    const registration = this.driverRegistrationRepository.create({
      userId,
      firstName: dto.firstName ?? null,
      lastName: dto.lastName ?? null,
      dateOfBirth: dto.dateOfBirth ?? null,
      personalPictureUrl: personalPictureUpload.secure_url,
      personalPicturePublicId: personalPictureUpload.public_id,
      licenseNumber: dto.licenseNumber,
      expirationDate: dto.expirationDate,
      frontSideOfLicenseUrl: frontSideOfLicenseUpload.secure_url,
      frontSideOfLicensePublicId: frontSideOfLicenseUpload.public_id,
      selfieWithDriverLicenseUrl: selfieWithDriverLicenseUpload?.secure_url ?? null,
      selfieWithDriverLicensePublicId: selfieWithDriverLicenseUpload?.public_id ?? null,
      idNumber: dto.idNumber,
      cnicFrontUrl: cnicFrontUpload.secure_url,
      cnicFrontPublicId: cnicFrontUpload.public_id,
      cnicBackUrl: cnicBackUpload.secure_url,
      cnicBackPublicId: cnicBackUpload.public_id,
      photoOfVehicleUrl: photoOfVehicleUpload?.secure_url ?? null,
      photoOfVehiclePublicId: photoOfVehicleUpload?.public_id ?? null,
      vehicleRegistrationCertificateUrl: vehicleRegistrationCertificateUpload?.secure_url ?? null,
      vehicleRegistrationCertificatePublicId:
        vehicleRegistrationCertificateUpload?.public_id ?? null,
      backsideOfVehicleInformationUrl: backsideOfVehicleInformationUpload?.secure_url ?? null,
      backsideOfVehicleInformationPublicId:
        backsideOfVehicleInformationUpload?.public_id ?? null,
      vehicleBrand: dto.vehicleBrand ?? null,
      vehicleType: dto.vehicleType,
      operatingArea: normalizeAreaText(dto.operatingArea),
      vehicleModel: dto.vehicleModel,
      vehicleColor: dto.vehicleColor ?? null,
      numberPlate: dto.numberPlate,
      productionYear: dto.productionYear,
      status: 'pending',
    });

    await this.driverRegistrationRepository.save(registration);

    return {
      message: 'Driver registration submitted successfully',
      driverRegistration: this.formatResponse(registration),
    };
  }

  async getMyRegistration(userId: string) {
    const registration = await this.driverRegistrationRepository.findOne({
      where: { userId },
    });

    if (!registration) {
      throw new NotFoundException('Driver registration not found');
    }

    return {
      driverRegistration: this.formatResponse(registration),
    };
  }

  private requireFile(files: Record<string, UploadableFile[]>, fieldName: string) {
    const file = files[fieldName]?.[0];

    if (!file) {
      throw new BadRequestException(`${fieldName} is required`);
    }

    this.validateImageMimeType(file, fieldName);
    return file;
  }

  private optionalFile(
    files: Record<string, UploadableFile[]>,
    fieldName: string,
  ): UploadableFile | undefined {
    const file = files[fieldName]?.[0];
    if (!file) return undefined;

    this.validateImageMimeType(file, fieldName);
    return file;
  }

  private validateImageMimeType(file: UploadableFile, fieldName: string) {
    const allowedMimeTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
    if (!allowedMimeTypes.includes(file.mimetype)) {
      throw new BadRequestException(
        `${fieldName} must be a valid image file (JPEG, PNG, WebP, GIF)`,
      );
    }
  }

  private async uploadIfPresent(file: UploadableFile | undefined, folder: string) {
    if (!file) return null;
    return this.cloudinaryService.uploadImage(file, folder);
  }

  async uploadPoliceCertificate(userId: string, file?: UploadableFile) {
    if (!file) {
      throw new BadRequestException('policeCertificate file is required');
    }

    const allowedMimeTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'application/pdf'];
    if (!allowedMimeTypes.includes(file.mimetype)) {
      throw new BadRequestException(
        'policeCertificate must be an image (JPEG, PNG, WebP, GIF) or a PDF',
      );
    }

    const registration = await this.driverRegistrationRepository.findOne({ where: { userId } });

    if (!registration) {
      throw new NotFoundException(
        'Complete your driver registration before uploading a police certificate',
      );
    }

    const folder = `indrive/driver-registrations/${userId}`;
    const upload = await this.cloudinaryService.uploadImage(file, `${folder}/police-certificate`);

    registration.policeCertificateUrl = upload.secure_url;
    registration.policeCertificatePublicId = upload.public_id;
    await this.driverRegistrationRepository.save(registration);

    return {
      message: 'Police certificate uploaded successfully',
      driverRegistration: this.formatResponse(registration),
    };
  }

  private formatResponse(registration: DriverRegistration) {
    return {
      id: registration.id,
      userId: registration.userId,
      firstName: registration.firstName,
      lastName: registration.lastName,
      dateOfBirth: registration.dateOfBirth,
      personalPictureUrl: registration.personalPictureUrl,
      licenseNumber: registration.licenseNumber,
      expirationDate: registration.expirationDate,
      frontSideOfLicenseUrl: registration.frontSideOfLicenseUrl,
      selfieWithDriverLicenseUrl: registration.selfieWithDriverLicenseUrl,
      idNumber: registration.idNumber,
      cnicFrontUrl: registration.cnicFrontUrl,
      cnicBackUrl: registration.cnicBackUrl,
      photoOfVehicleUrl: registration.photoOfVehicleUrl,
      vehicleRegistrationCertificateUrl:
        registration.vehicleRegistrationCertificateUrl,
      backsideOfVehicleInformationUrl:
        registration.backsideOfVehicleInformationUrl,
      policeCertificateUrl: registration.policeCertificateUrl,
      vehicleBrand: registration.vehicleBrand,
      vehicleType: registration.vehicleType,
      operatingArea: registration.operatingArea,
      vehicleModel: registration.vehicleModel,
      vehicleColor: registration.vehicleColor,
      numberPlate: registration.numberPlate,
      productionYear: registration.productionYear,
      status: registration.status,
      createdAt: registration.createdAt,
      updatedAt: registration.updatedAt,
    };
  }
}