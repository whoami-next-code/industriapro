import { Test, TestingModule } from '@nestjs/testing';
import { CotizacionesService } from './cotizaciones.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Cotizacion } from './cotizacion.entity';
import { Product } from '../productos/product.entity';
import { EventsService } from '../realtime/events.service';
import { Repository } from 'typeorm';
import { NotFoundException, BadRequestException } from '@nestjs/common';

describe('CotizacionesService', () => {
  let service: CotizacionesService;
  let repo: Repository<Cotizacion>;

  const mockRepo = {
    findOneBy: jest.fn(),
    save: jest.fn(),
    create: jest.fn(),
    createQueryBuilder: jest.fn(() => ({
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      take: jest.fn().mockReturnThis(),
      skip: jest.fn().mockReturnThis(),
      getManyAndCount: jest.fn().mockResolvedValue([[], 0]),
      getMany: jest.fn().mockResolvedValue([]),
      select: jest.fn().mockReturnThis(),
      addSelect: jest.fn().mockReturnThis(),
      groupBy: jest.fn().mockReturnThis(),
      getRawMany: jest.fn().mockResolvedValue([]),
    })),
  };

  const mockProductRepo = {
    findBy: jest.fn().mockResolvedValue([]),
  };

  const mockEvents = {
    cotizacionesUpdated: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CotizacionesService,
        {
          provide: getRepositoryToken(Cotizacion),
          useValue: mockRepo,
        },
        {
          provide: getRepositoryToken(Product),
          useValue: mockProductRepo,
        },
        {
          provide: EventsService,
          useValue: mockEvents,
        },
      ],
    }).compile();

    service = module.get<CotizacionesService>(CotizacionesService);
    repo = module.get<Repository<Cotizacion>>(getRepositoryToken(Cotizacion));
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('addProgress', () => {
    it('should add a progress update successfully', async () => {
      const mockQuote = {
        id: 1,
        progressUpdates: [],
        status: 'PENDIENTE',
        progressPercent: 0,
      } as Cotizacion;

      mockRepo.findOneBy.mockResolvedValue(mockQuote);
      mockRepo.save.mockImplementation((val) => Promise.resolve(val));

      const result = await service.addProgress(1, { message: 'Test update' });

      expect(result.progressUpdates).toHaveLength(1);
      expect(result.progressUpdates[0].message).toBe('Test update');
      expect(mockRepo.save).toHaveBeenCalled();
    });

    it('should throw NotFoundException if quote not found', async () => {
      mockRepo.findOneBy.mockResolvedValue(null);
      await expect(
        service.addProgress(99, { message: 'Fail' }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should update status and progress percent', async () => {
      const mockQuote = {
        id: 1,
        progressUpdates: [],
        status: 'PENDIENTE',
        progressPercent: 0,
      } as Cotizacion;

      mockRepo.findOneBy.mockResolvedValue(mockQuote);
      mockRepo.save.mockImplementation((val) => Promise.resolve(val));

      const result = await service.addProgress(1, {
        message: 'Moving to production',
        status: 'PRODUCCION',
      });

      expect(result.status).toBe('PRODUCCION');
      // statusToProgress('PRODUCCION') returns 55
      expect(result.progressPercent).toBe(55);
    });

    it('should handle persistence errors', async () => {
      const mockQuote = { id: 1, progressUpdates: [] } as Cotizacion;
      mockRepo.findOneBy.mockResolvedValue(mockQuote);
      mockRepo.save.mockRejectedValue(new Error('DB Error'));

      await expect(
        service.addProgress(1, { message: 'Crash' }),
      ).rejects.toThrow(BadRequestException);
    });
  });
});
