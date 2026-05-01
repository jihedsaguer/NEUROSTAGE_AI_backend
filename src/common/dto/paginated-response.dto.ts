export class PaginatedResponseDto<T> {
  data: T[];
  total: number;
  limit: number;
  offset: number;
  pages: number;

  constructor(data: T[], total: number, limit: number, offset: number) {
    this.data = data;
    this.total = total;
    this.limit = limit;
    this.offset = offset;
    this.pages = Math.ceil(total / limit);
  }
}
