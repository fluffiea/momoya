import { ApiProperty } from '@nestjs/swagger';
import { POST_COMMENT_MAX } from '@momoya/shared';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class UpdatePostCommentDto {
  @ApiProperty({
    example: '打错字了，改一下',
    description: `1~${POST_COMMENT_MAX} 字；编辑后该评论会被打上 editedAt 标记。`,
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(POST_COMMENT_MAX)
  text!: string;
}
