interface RequestInitDiff {
  qs?: Record<string, string>;
  form?: Record<string, string>;
  body?: Record<string, unknown> | BodyInit | null;
}

export type ExtendedRequestInit =
  & RequestInitDiff
  & Omit<RequestInit, keyof RequestInitDiff>;
