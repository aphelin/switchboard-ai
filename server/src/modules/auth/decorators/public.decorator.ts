import { SetMetadata } from '@nestjs/common';
import { IS_PUBLIC_KEY } from '../auth.constants';

/** Opts a route out of authentication. Every other route requires a session or API key. */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
