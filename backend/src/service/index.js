import { s3Service } from './s3Service.js';
import { geminiService } from './geminiService.js';
import { parsingService } from './parsingService.js';
import { ragService } from './ragService.js';

export const services = {
  s3Service,
  geminiService,
  parsingService,
  ragService,
};

export { s3Service, geminiService, parsingService, ragService };
