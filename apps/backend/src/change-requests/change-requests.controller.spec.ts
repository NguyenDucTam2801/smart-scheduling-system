import { Test, TestingModule } from '@nestjs/testing';
import { ChangeRequestsController } from './change-requests.controller';
import { ChangeRequestsService } from './change-requests.service';

describe('ChangeRequestsController', () => {
  let controller: ChangeRequestsController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ChangeRequestsController],
      providers: [ChangeRequestsService],
    }).compile();

    controller = module.get<ChangeRequestsController>(ChangeRequestsController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
