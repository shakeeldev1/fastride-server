import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
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
    const selfieWithDriverLicense = this.requireFile(files, 'selfieWithDriverLicense');
    const cnicFront = this.requireFile(files, 'cnicFront');
    const cnicBack = this.requireFile(files, 'cnicBack');
    const photoOfVehicle = this.requireFile(files, 'photoOfVehicle');
    const vehicleRegistrationCertificate = this.requireFile(
      files,
      'vehicleRegistrationCertificate',
    );
    const backsideOfVehicleInformation = this.requireFile(
      files,
      'backsideOfVehicleInformation',
    );

    const folder = `indrive/driver-registrations/${userId}`;

    const [personalPictureUpload, frontSideOfLicenseUpload, selfieWithDriverLicenseUpload, cnicFrontUpload, cnicBackUpload, photoOfVehicleUpload, vehicleRegistrationCertificateUpload, backsideOfVehicleInformationUpload] =
      await Promise.all([
        this.cloudinaryService.uploadImage(personalPicture, `${folder}/personal-picture`),
        this.cloudinaryService.uploadImage(frontSideOfLicense, `${folder}/front-side-of-license`),
        this.cloudinaryService.uploadImage(selfieWithDriverLicense, `${folder}/selfie-with-driver-license`),
        this.cloudinaryService.uploadImage(cnicFront, `${folder}/cnic-front`),
        this.cloudinaryService.uploadImage(cnicBack, `${folder}/cnic-back`),
        this.cloudinaryService.uploadImage(photoOfVehicle, `${folder}/photo-of-vehicle`),
        this.cloudinaryService.uploadImage(
          vehicleRegistrationCertificate,
          `${folder}/vehicle-registration-certificate`,
        ),
        this.cloudinaryService.uploadImage(
          backsideOfVehicleInformation,
          `${folder}/backside-of-vehicle-information`,
        ),
      ]);

    const registration = this.driverRegistrationRepository.create({
      userId,
      firstName: dto.firstName,
      lastName: dto.lastName,
      dateOfBirth: dto.dateOfBirth,
      personalPictureUrl: personalPictureUpload.secure_url,
      personalPicturePublicId: personalPictureUpload.public_id,
      licenseNumber: dto.licenseNumber,
      expirationDate: dto.expirationDate,
      frontSideOfLicenseUrl: frontSideOfLicenseUpload.secure_url,
      frontSideOfLicensePublicId: frontSideOfLicenseUpload.public_id,
      selfieWithDriverLicenseUrl: selfieWithDriverLicenseUpload.secure_url,
      selfieWithDriverLicensePublicId: selfieWithDriverLicenseUpload.public_id,
      idNumber: dto.idNumber,
      cnicFrontUrl: cnicFrontUpload.secure_url,
      cnicFrontPublicId: cnicFrontUpload.public_id,
      cnicBackUrl: cnicBackUpload.secure_url,
      cnicBackPublicId: cnicBackUpload.public_id,
      photoOfVehicleUrl: photoOfVehicleUpload.secure_url,
      photoOfVehiclePublicId: photoOfVehicleUpload.public_id,
      vehicleRegistrationCertificateUrl:
        vehicleRegistrationCertificateUpload.secure_url,
      vehicleRegistrationCertificatePublicId:
        vehicleRegistrationCertificateUpload.public_id,
      backsideOfVehicleInformationUrl:
        backsideOfVehicleInformationUpload.secure_url,
      backsideOfVehicleInformationPublicId:
        backsideOfVehicleInformationUpload.public_id,
      vehicleBrand: dto.vehicleBrand,
      vehicleModel: dto.vehicleModel,
      vehicleColor: dto.vehicleColor,
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

    const allowedMimeTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
    if (!allowedMimeTypes.includes(file.mimetype)) {
      throw new BadRequestException(
        `${fieldName} must be a valid image file (JPEG, PNG, WebP, GIF)`,
      );
    }

    return file;
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
      vehicleBrand: registration.vehicleBrand,
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