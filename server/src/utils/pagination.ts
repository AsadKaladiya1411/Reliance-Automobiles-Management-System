import { ApiError } from "./api-error";

export type PageQuery = {
  search?: string;
  page: number;
  pageSize: number;
  skip: number;
  take: number;
};

function numberFromQuery(value: unknown, fallback: number) {
  if (value === undefined || value === null || value === "") {
    return fallback;
  }

  const number = Number(value);
  if (!Number.isInteger(number) || number <= 0) {
    throw new ApiError(400, "INVALID_PAGINATION", "Page and pageSize must be positive whole numbers.");
  }

  return number;
}

export function parsePageQuery(query: Record<string, unknown>): PageQuery {
  const page = numberFromQuery(query.page, 1);
  const pageSize = Math.min(numberFromQuery(query.pageSize, 25), 100);
  const search = typeof query.search === "string" && query.search.trim() !== "" ? query.search.trim() : undefined;

  return {
    search,
    page,
    pageSize,
    skip: (page - 1) * pageSize,
    take: pageSize,
  };
}

export function pagedResult<T>(items: T[], total: number, query: PageQuery) {
  return {
    items,
    page: query.page,
    pageSize: query.pageSize,
    total,
    pageCount: Math.ceil(total / query.pageSize),
  };
}
