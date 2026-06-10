import { Test, TestingModule } from '@nestjs/testing';
import { ChangeRequestsService } from './change-requests.service';

describe('ChangeRequestsService', () => {
  let service: ChangeRequestsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [ChangeRequestsService],
    }).compile();

    service = module.get<ChangeRequestsService>(ChangeRequestsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
