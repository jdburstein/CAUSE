import { BadRequestException, ConflictException, Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { SupabaseClient } from '@supabase/supabase-js';
import { SUPABASE_CLIENT } from '../supabase/supabase.module';
import { databaseError } from '../supabase/database-error';

export interface UserIdentity {
  user_id?: string;
  external_id?: string;
}

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);

  constructor(@Inject(SUPABASE_CLIENT) private readonly db: SupabaseClient) {}

  async resolve(identity: UserIdentity): Promise<string> {
    if (identity.user_id !== undefined) {
      const { data, error } = await this.db.from('users')
        .select('id, external_id').eq('id', identity.user_id).maybeSingle();
      if (error) databaseError(this.logger, 'Find user by ID', error);
      if (!data) throw new NotFoundException('User not found');
      if (identity.external_id !== undefined && data.external_id !== identity.external_id) {
        throw new ConflictException('User identifiers do not match');
      }
      return data.id;
    }

    if (identity.external_id === undefined) {
      throw new BadRequestException('user_id or external_id is required');
    }

    const existing = await this.findByExternalId(identity.external_id);
    if (existing) return existing.id;

    const { data, error } = await this.db.from('users')
      .insert({ external_id: identity.external_id }).select('id').single();
    if (error?.code === '23505') {
      // Another request may have created this identity after our lookup.
      const concurrent = await this.findByExternalId(identity.external_id);
      if (concurrent) return concurrent.id;
    }
    if (error || !data) databaseError(this.logger, 'Create user', error);
    return data.id;
  }

  private async findByExternalId(externalId: string): Promise<{ id: string } | null> {
    const { data, error } = await this.db.from('users')
      .select('id').eq('external_id', externalId).maybeSingle();
    if (error) databaseError(this.logger, 'Find user by external ID', error);
    return data;
  }
}
