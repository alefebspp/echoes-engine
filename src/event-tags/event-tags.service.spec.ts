import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EventTag } from './event-tag.entity';
import { EventTagsService } from './event-tags.service';

describe('EventTagsService', () => {
  let service: EventTagsService;
  let eventTagsRepository: jest.Mocked<
    Pick<Repository<EventTag>, 'create' | 'save'>
  >;

  beforeEach(async () => {
    eventTagsRepository = {
      create: jest.fn(),
      save: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EventTagsService,
        {
          provide: getRepositoryToken(EventTag),
          useValue: eventTagsRepository,
        },
      ],
    }).compile();

    service = module.get(EventTagsService);
    jest.clearAllMocks();
  });

  it('creates social media tag for YouTube URLs', async () => {
    const eventId = '770e8400-e29b-41d4-a716-446655440002';
    const createdTag = {
      id: '880e8400-e29b-41d4-a716-446655440003',
      eventId,
      tag: 'social media',
      confidence: '0.9500',
      createdAt: new Date(),
    } as EventTag;

    eventTagsRepository.create.mockReturnValue(createdTag);
    eventTagsRepository.save.mockResolvedValue([createdTag]);

    await expect(
      service.tagEventFromMetadata(eventId, {
        url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
        title: 'Video',
      }),
    ).resolves.toEqual([createdTag]);

    expect(eventTagsRepository.create).toHaveBeenCalledWith({
      eventId,
      tag: 'social media',
      confidence: '0.9500',
    });
  });

  it('creates developer tools tag for GitHub URLs', async () => {
    const eventId = '770e8400-e29b-41d4-a716-446655440002';
    const createdTag = {
      id: '880e8400-e29b-41d4-a716-446655440004',
      eventId,
      tag: 'developer tools',
      confidence: '0.9500',
      createdAt: new Date(),
    } as EventTag;

    eventTagsRepository.create.mockReturnValue(createdTag);
    eventTagsRepository.save.mockResolvedValue([createdTag]);

    await service.tagEventFromMetadata(eventId, {
      url: 'https://github.com/nestjs/nest',
      title: 'NestJS',
    });

    expect(eventTagsRepository.create).toHaveBeenCalledWith({
      eventId,
      tag: 'developer tools',
      confidence: '0.9500',
    });
  });

  it('returns empty array when metadata has no url', async () => {
    await expect(
      service.tagEventFromMetadata('770e8400-e29b-41d4-a716-446655440002', {
        title: 'No URL',
      }),
    ).resolves.toEqual([]);
    expect(eventTagsRepository.save).not.toHaveBeenCalled();
  });

  it('returns empty array for unrecognized URLs', async () => {
    await expect(
      service.tagEventFromMetadata('770e8400-e29b-41d4-a716-446655440002', {
        url: 'https://example-unknown-site.local',
        title: 'Unknown',
      }),
    ).resolves.toEqual([]);
    expect(eventTagsRepository.save).not.toHaveBeenCalled();
  });
});
