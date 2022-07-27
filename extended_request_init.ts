interface RequestInitDiff {
  /** if this is set, entries will be appended to url query parameters (previous parameters will be preserved). */
  qs?: Record<string, string | undefined>;
  /** if this is set, object entries will be used to create a form-urlencoded body. takes precedence over body */
  form?: Record<string, string | string[]>;
  /** if this is set, object entries will be used to create a FormData and used as body. takes precedence over body */
  formData?: Record<string, string | string[]>;
  /** if an object is passed, it will be sent as serialized json and header is set accordingly. */
  body?: Record<string, unknown> | BodyInit | null;
  /** a function that will be called before returning response.
   *  can be used for validating response and throwing errors */
  validator?: Validator;
  /** time in milliseconds which after the request should be cancelled and rejected */
  timeout?: number;
}

export type Validator = (
  response: Response,
  init: ExtendedRequest,
) => void | Promise<void>;

export type ExtendedRequestInit =
  & RequestInitDiff
  & Omit<RequestInit, keyof RequestInitDiff>;

export type ExtendedRequest =
  & RequestInitDiff
  & Omit<RequestInit, keyof RequestInitDiff | "headers">
  & { headers: Headers };
