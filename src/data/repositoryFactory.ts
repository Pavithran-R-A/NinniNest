import { Platform } from 'react-native';
import type { CareRepository } from './CareRepository';
import { SqliteCareRepository } from './SqliteCareRepository';
import { IndexedDbCareRepository } from './IndexedDbCareRepository';

export function createRepository(): CareRepository {
  if (Platform.OS === 'web') return new IndexedDbCareRepository();
  return new SqliteCareRepository();
}
