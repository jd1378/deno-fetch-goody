interface RequestInitDiff {
  /** if this is set, entries will be appended to url query parameters (previous parameters will be preserved). */
  qs?: Record<string, string | undefined>;
  /** if this is set, object entries will be used to create a form-urlencoded body. takes precedence over body */
  form?: Record<string, string | string[]>;
  /** if this is set, object entries will be used to create a FormData and used as body. takes precedence over body */
  formData?: Record<string, string | string[]>;
  /** if an object is passed, it will be sent as serialized json and header is set accordingly. */
  body?: Record<string, unknown> | BodyInit | null;
  /** interceptors can be used for validating request and response and throwing errors */
  interceptors?: Interceptors;
  /** time in milliseconds which after the request should be cancelled and rejected */
  timeout?: number;
  /** if set, all requests will be retried this much. it's in addition to first request. so a retry with value of 1 will send 2 requests in total. */
  retry?: number;
  /** retry delay in milliseconds. if you need non linear delays, you can do that by passing in a function instead of number. defaults to `500ms`. */
  retryDelay?: number | RetryDelayFunction;
}

export type RetryDelayFunction = (
  /** current attempt (1 = it is going to retry for the first time and so on) */
  attempt: number,
  init: ExtendedRequest,
) => number;

export type Interceptors = {
  /** function that is called just before a request is sent*/
  request?: (
    init: ExtendedRequest,
  ) => void | Promise<void>;
  /** function that is called just before a response is returned from the fetch*/
  response?: (
    init: ExtendedRequest,
    response: Response,
  ) => void | Promise<void>;
};

export type ExtendedRequestInit =
  & RequestInitDiff
  & Omit<RequestInit, keyof RequestInitDiff>;

export type ExtendedRequest =
  & RequestInitDiff
  & Omit<RequestInit, keyof RequestInitDiff | "headers">
  & { headers: Headers; url: URL };
