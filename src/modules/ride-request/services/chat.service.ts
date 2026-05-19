import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ChatMessage } from '../entities/chat-message.entity';

@Injectable()
export class ChatService {
  constructor(
    @InjectRepository(ChatMessage)
    private readonly chatRepo: Repository<ChatMessage>,
  ) {}

  async saveMessage(rideRequestId: string, fromUserId: string, text: string) {
    const msg = this.chatRepo.create({ rideRequestId, fromUserId, text });
    return this.chatRepo.save(msg);
  }

  async getMessages(rideRequestId: string, limit = 100, before?: Date) {
    const qb = this.chatRepo.createQueryBuilder('m')
      .where('m.rideRequestId = :rideRequestId', { rideRequestId })
      .orderBy('m.sentAt', 'DESC')
      .limit(limit);

    if (before) qb.andWhere('m.sentAt < :before', { before });

    const rows = await qb.getMany();
    return rows.reverse(); // return chronological order
  }
}
