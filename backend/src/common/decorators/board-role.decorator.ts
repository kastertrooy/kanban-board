import { SetMetadata } from '@nestjs/common';
import { Role } from '@prisma/client';

export const BOARD_ROLE_KEY = 'board_role';

export const BoardRole = (role: Role) => SetMetadata(BOARD_ROLE_KEY, role);
