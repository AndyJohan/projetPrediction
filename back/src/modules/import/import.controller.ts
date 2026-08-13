import { BadRequestException, Body, Controller, Post, UploadedFile, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ImportOptionsDto } from './dto/import-options.dto';
import { ImportService } from './import.service';

const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;
const ALLOWED_EXTENSIONS = /\.(xlsx|xlsm|xls)$/i;
const ALLOWED_MIME_TYPES = new Set([
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-excel',
  'application/octet-stream',
]);

@Controller('import')
export class ImportController {
  constructor(private readonly importService: ImportService) {}

  @Post('upload')
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: MAX_UPLOAD_BYTES, files: 1 },
      fileFilter: (_request, file, callback) => {
        const hasAllowedExtension = ALLOWED_EXTENSIONS.test(file.originalname);
        const hasAllowedMimeType = ALLOWED_MIME_TYPES.has(file.mimetype);

        if (!hasAllowedExtension || !hasAllowedMimeType) {
          callback(
            new BadRequestException('Seuls les fichiers Excel .xlsx, .xlsm ou .xls sont acceptes.'),
            false,
          );
          return;
        }

        callback(null, true);
      },
    }),
  )
  async upload(
    @UploadedFile() file?: Express.Multer.File,
    @Body('category') category?: string,
    @Body('year') year?: string,
  ) {
    if (!file) {
      throw new BadRequestException('Aucun fichier fourni.');
    }

    const options: ImportOptionsDto = { category, year };
    return this.importService.importBuffer(file.buffer, file.originalname, options);
  }
}
