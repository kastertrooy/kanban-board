import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { IsNotEmpty, IsString } from 'class-validator';

import { AuthService } from './auth.service';
import { GenerateMagicLinkDto, LoginDto, RegisterDto } from './dto/auth.dto';

class VerifyMagicLinkQueryDto {
  @IsString()
  @IsNotEmpty()
  token!: string;
}

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  register(@Body() dto: RegisterDto) {
    return this.authService.register(dto);
  }

  @Post('login')
  login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }

  @Post('magic-link/generate')
  generateMagicLink(@Body() dto: GenerateMagicLinkDto) {
    return this.authService.generateMagicLink(dto);
  }

  @Get('magic-link/verify')
  verifyMagicLink(@Query() query: VerifyMagicLinkQueryDto) {
    return this.authService.verifyMagicLink(query.token);
  }
}
