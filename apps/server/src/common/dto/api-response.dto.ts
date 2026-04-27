import { ApiProperty } from '@nestjs/swagger';
import type { Type } from '@nestjs/common';

/**
 * 统一响应体基类（与 ResponseInterceptor 产出形状一致）。
 * 成功: { code: 0, data: T, msg: 'ok' }
 * 失败: { code: <非0>, data: null, msg: <可读信息>, errorKey: <业务错误码> }
 *
 * 泛型在 TS 类型层可表达，但 Swagger 需要运行时可反射的 class。
 * 因此对每个接口用 ApiResponseOf(SomeDataDto) 生成一个命名子类即可。
 */
export class ApiResponseBaseDto {
  @ApiProperty({
    example: 0,
    description: '0 表示成功；非 0 为业务错误码，详见 errorKey',
  })
  code!: number;

  @ApiProperty({ example: 'ok' })
  msg!: string;

  @ApiProperty({
    required: false,
    nullable: true,
    example: null,
    description: '业务错误码枚举（仅失败时存在）',
  })
  errorKey?: string;
}

/**
 * 为某个 data DTO 生成对应的 { code, data, msg } 包装 DTO，
 * 便于在 @ApiOkResponse({ type: ApiResponseOf(FooDto) }) 中复用。
 */
export function ApiResponseOf<TData extends Type<unknown>>(dataType: TData) {
  class ApiResponseDto extends ApiResponseBaseDto {
    @ApiProperty({ type: dataType })
    data!: InstanceType<TData>;
  }
  Object.defineProperty(ApiResponseDto, 'name', {
    value: `ApiResponseOf${dataType.name}`,
  });
  return ApiResponseDto;
}
