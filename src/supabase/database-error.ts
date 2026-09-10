import { InternalServerErrorException, Logger } from '@nestjs/common';

export function databaseError(logger: Logger, operation: string, error: unknown): never {
  logger.error({ operation, error });
  throw new InternalServerErrorException('Database operation failed');
}
