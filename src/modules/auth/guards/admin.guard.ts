import { CanActivate, ExecutionContext, Injectable, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../../user/entities/user.entity';

@Injectable()
export class AdminGuard implements CanActivate {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest();
    const user = req.user;

    if (!user || !user.id) {
      throw new ForbiddenException('Access denied');
    }

    const dbUser = await this.userRepository.findOne({ where: { id: user.id } });

    if (!dbUser || !dbUser.is_admin) {
      throw new ForbiddenException('Admin access required');
    }

    return true;
  }
}
