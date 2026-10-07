export type ApiMeta = Readonly<{
  requestId?: string;
  page?: number;
  pageSize?: number;
  total?: number;
}>;

export type ApiSuccess<T> = Readonly<{
  success: true;
  data: T;
  meta?: ApiMeta;
}>;

export type ApiError = Readonly<{
  success: false;
  error: {
    code: string;
    message: string;
    requestId?: string;
    details?: unknown;
  };
}>;

export type Paginated<T> = Readonly<{
  items: T[];
  page: number;
  pageSize: number;
  total: number;
}>;
