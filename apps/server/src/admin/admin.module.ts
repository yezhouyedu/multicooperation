import { Module } from '@nestjs/common';
import { AdminAuthController } from './admin-auth.controller';
import { AdminAuthGuard } from './admin-auth.guard';
import { AdminAuthService } from './admin-auth.service';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { SideTaskAdminController } from './sidetask-admin.controller';
import { SideTaskAdminService } from './sidetask-admin.service';

@Module({
  controllers: [AdminAuthController, AdminController, SideTaskAdminController],
  providers: [AdminAuthService, AdminAuthGuard, AdminService, SideTaskAdminService],
})
export class AdminModule {}
