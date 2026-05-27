import { Module } from '@nestjs/common';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { SideTaskAdminController } from './sidetask-admin.controller';
import { SideTaskAdminService } from './sidetask-admin.service';

@Module({
  controllers: [AdminController, SideTaskAdminController],
  providers: [AdminService, SideTaskAdminService],
})
export class AdminModule {}
