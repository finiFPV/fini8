import { TestBed } from '@angular/core/testing';

import { TempStorageService } from './temp-storage.service';

describe('TempStorageService', () => {
  let service: TempStorageService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(TempStorageService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
