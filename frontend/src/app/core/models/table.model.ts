import { TableStatus } from './enums';

export interface Table {
  id: number;
  name: string;
  capacity: number;
  status: TableStatus;
  location?: string;
  notes?: string;
}

export interface CreateTableInput {
  name: string;
  capacity: number;
  status?: TableStatus;
  location?: string;
  notes?: string;
}

export interface UpdateTableInput {
  name?: string;
  capacity?: number;
  status?: TableStatus;
  location?: string;
  notes?: string;
}
