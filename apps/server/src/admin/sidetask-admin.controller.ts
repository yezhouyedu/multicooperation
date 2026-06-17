import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { SideTaskAdminService } from './sidetask-admin.service';
import { storagePath } from '../storage-paths';
import { AdminAuthGuard } from './admin-auth.guard';

const TEMP_UPLOAD_DIR = storagePath('tmp');

@Controller('admin/sidetask')
@UseGuards(AdminAuthGuard)
export class SideTaskAdminController {
  constructor(private readonly sideTaskAdminService: SideTaskAdminService) {}

  @Post('import')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: TEMP_UPLOAD_DIR,
        filename: (_req, file, cb) => {
          const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
          const ext = file.originalname.split('.').pop() ?? 'xlsx';
          cb(null, `sidetask-import-${uniqueSuffix}.${ext}`);
        },
      }),
      fileFilter: (_req, file, cb) => {
        if (!file.originalname.match(/\.(xlsx|xls)$/i)) {
          cb(new BadRequestException('仅支持 .xlsx / .xls 文件'), false);
        } else {
          cb(null, true);
        }
      },
    }),
  )
  async importExcel(@UploadedFile() file: Express.Multer.File) {
    if (!file) throw new BadRequestException('未上传文件');
    return this.sideTaskAdminService.importExcel(file.path);
  }

  @Get('items')
  listItems(
    @Query('poolType') poolType?: string,
    @Query('workSegment') workSegment?: string,
    @Query('narrativeCategory') narrativeCategory?: string,
    @Query('directAiFlag') directAiFlag?: string,
    @Query('version') version?: string,
    @Query('isActive') isActive?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    return this.sideTaskAdminService.listItems({
      poolType: poolType || undefined,
      workSegment: workSegment ? Number(workSegment) : undefined,
      narrativeCategory: narrativeCategory || undefined,
      directAiFlag: directAiFlag === 'true' ? true : directAiFlag === 'false' ? false : undefined,
      version: version || undefined,
      isActive: isActive === 'true' ? true : isActive === 'false' ? false : undefined,
      page: page ? Number(page) : undefined,
      pageSize: pageSize ? Number(pageSize) : undefined,
    });
  }

  @Get('items/stats')
  getStats() {
    return this.sideTaskAdminService.getStats();
  }

  @Patch('items/:id/toggle-active')
  toggleActive(@Param('id') id: string) {
    return this.sideTaskAdminService.toggleActive(id);
  }
}
