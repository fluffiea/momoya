import { Injectable, Logger } from '@nestjs/common';
import type { AnniversaryDto, PostCommentDto, PostDto } from '@momoya/shared';
import { Server } from 'socket.io';

/**
 * 情侣维度的实时事件分发。
 *
 * 所有 emit 都按 `room(coupleKey)` 定向，CoupleGateway 在 handshake 校验通过后
 * 已把双方都加入了同一个 room，伴侣中任意一端在线即收到。
 */
@Injectable()
export class CoupleRealtimeService {
  private readonly logger = new Logger(CoupleRealtimeService.name);

  private server: Server | null = null;

  attachServer(server: Server): void {
    this.server = server;
  }

  emitDailyCreated(coupleKey: string, post: PostDto): void {
    this.emit(coupleKey, 'daily:created', { post });
  }

  emitDailyUpdated(coupleKey: string, post: PostDto): void {
    this.emit(coupleKey, 'daily:updated', { post });
  }

  emitDailyDeleted(coupleKey: string, id: string): void {
    this.emit(coupleKey, 'daily:deleted', { id });
  }

  emitReportCreated(coupleKey: string, post: PostDto): void {
    this.emit(coupleKey, 'report:created', { post });
  }

  emitReportUpdated(coupleKey: string, post: PostDto): void {
    this.emit(coupleKey, 'report:updated', { post });
  }

  emitReportDeleted(coupleKey: string, id: string): void {
    this.emit(coupleKey, 'report:deleted', { id });
  }

  emitCommentAdded(
    coupleKey: string,
    postId: string,
    comment: PostCommentDto,
    parentId: string | null,
  ): void {
    this.emit(coupleKey, 'comment:added', { postId, comment, parentId });
  }

  emitCommentUpdated(
    coupleKey: string,
    postId: string,
    comment: PostCommentDto,
  ): void {
    this.emit(coupleKey, 'comment:updated', { postId, comment });
  }

  emitCommentDeleted(
    coupleKey: string,
    postId: string,
    commentId: string,
    parentId: string | null,
  ): void {
    this.emit(coupleKey, 'comment:deleted', { postId, commentId, parentId });
  }

  emitAnniversaryCreated(coupleKey: string, item: AnniversaryDto): void {
    this.emit(coupleKey, 'anniversary:created', { item });
  }

  emitAnniversaryUpdated(coupleKey: string, item: AnniversaryDto): void {
    this.emit(coupleKey, 'anniversary:updated', { item });
  }

  emitAnniversaryDeleted(coupleKey: string, id: string): void {
    this.emit(coupleKey, 'anniversary:deleted', { id });
  }

  private emit(
    coupleKey: string,
    event: string,
    payload: Record<string, unknown>,
  ): void {
    if (!this.server) {
      this.logger.warn(`io server not attached yet, skip emit: ${event}`);
      return;
    }
    this.server.to(roomKey(coupleKey)).emit(event, payload);
  }
}

function roomKey(coupleKey: string): string {
  return `couple:${coupleKey}`;
}
