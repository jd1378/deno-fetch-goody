import * as utils from "./utils.ts";
import {
  ExtendedRequest,
  ExtendedRequestInit,
  Interceptors,
} from "./extended_request_init.ts";

/**
 * Transforms data and adds corresponding headers if possible.
 */
function transformData(
  data:
    | string
    | Record<string, unknown>
    | ArrayBuffer
    | Blob
    | ArrayBufferView
    | FormData
    | URLSearchParams
    | ReadableStream<Uint8Array>
    | null
    | undefined,
  headers: Headers,
  init?: RequestInit | ExtendedRequestInit,
):
  | string
  | ArrayBuffer
  | Blob
  | ArrayBufferView
  | FormData
  | URLSearchParams
  | ReadableStream<Uint8Array>
  | null
  | undefined {
  if (
    utils.isFormData(data) ||
    utils.isArrayBuffer(data) ||
    utils.isBuffer(data) ||
    utils.isStream(data) ||
    utils.isFile(data) ||
    utils.isBlob(data)
  ) {
    return data;
  }
  if (utils.isArrayBufferView(data)) {
    return data.buffer;
  }
  if (utils.isURLSearchParams(data)) {
    headers.set(
      "Content-Type",
      "application/x-www-form-urlencoded;charset=utf-8",
    );
    return data.toString();
  }
  if (utils.isObject(data)) {
    headers.set("Content-Type", "application/json;charset=utf-8");
    if (init && !init.method) {
      init.method = "POST";
    }
    return JSON.stringify(data);
  }
  // the default header if type undefined
  headers.set("Content-Type", "application/x-www-form-urlencoded");
  return data;
}

export type WrapFetchOptions = {
  /** your own fetch function. defaults to global fetch. */
  fetch?: typeof fetch;
  /** user agent header string */
  userAgent?: string;
  /** if set, all requests will timeout after this amount of milliseconds passed */
  timeout?: number;
  /** if set, will be used as default headers. new added headers will be added on top of these. */
  headers?: Headers;
  /** if set, will be prepended to the target url using URL api. */
  baseURL?: string | URL;
  /** interceptors can be used for validating request and response and throwing errors */
  interceptors?: Interceptors;
  /** if set, all requests will be retried this much */
  retry?: number;
  /** retry delay in milliseconds. if you need non linear delays, you can do that by passing in a function instead of number. defaults to `500ms`. */
  retryDelay?: number | ((attempt: number) => number);
};

export function wrapFetch(options?: WrapFetchOptions) {
  const {
    fetch = globalThis.fetch,
    userAgent,
    interceptors,
    timeout = 99999999,
    headers,
    baseURL,
    retry = 0,
    retryDelay = 500,
  } = options || {};

  return async function wrappedFetch(
    input: string | Request | URL,
    init?: ExtendedRequestInit | RequestInit | undefined,
  ) {
    // let fetch handle the error
    if (!input) {
      return await fetch(input);
    }

    const interceptedInit = init || {};

    if (!(interceptedInit.headers instanceof Headers)) {
      interceptedInit.headers = new Headers(interceptedInit.headers || {});
    }

    {
      const baseHeaders = new Headers(headers);

      for (const header of interceptedInit.headers) {
        baseHeaders.set(header[0], header[1]);
      }

      interceptedInit.headers = baseHeaders;
    }

    // Normalize input to URL. when reading the specs (https://fetch.spec.whatwg.org/#request and https://fetch.spec.whatwg.org/#fetch-method),
    // I didn't see anything mentioned about fetch using anything from an input that is instance of Request except It's URL.
    // So it is safe to discard the Request object and use It's url only.
    // Normalizing the url simplifies any feature we want to add later.
    {
      if (typeof input !== "string") {
        if (input instanceof Request) {
          input = input.url;
        } else {
          input = input.toString();
        }
      }

      // URL doesn't support relative urls
      if (input.includes("://")) {
        input = new URL(input);
      } else {
        if (baseURL) {
          input = new URL(input, baseURL);
        } else {
          try {
            input = new URL(input, location.href);
          } catch {
            throw new Error(
              "Cannot parse the input url. Either provide `--location` parameter to Deno, or use complete url, or use baseURL when wrapping fetch.",
            );
          }
        }
      }
    }

    // add url to interceptedInit
    (interceptedInit as ExtendedRequest).url = input;

    // setup a default accept
    if (!interceptedInit.headers.get("Accept")) {
      interceptedInit.headers.set(
        "Accept",
        "application/json, text/plain, */*",
      );
    }

    // setup user agent if set
    if (userAgent) {
      interceptedInit.headers.set("User-Agent", userAgent);
    }

    if ("form" in interceptedInit && interceptedInit.form) {
      interceptedInit.body = "";
      for (const key of Object.keys(interceptedInit.form)) {
        if (typeof interceptedInit.form[key] === "string") {
          interceptedInit.body += `${encodeURIComponent(key)}=${
            encodeURIComponent(interceptedInit.form[key] as string)
          }&`;
        } else {
          for (const str of interceptedInit.form[key]) {
            interceptedInit.body += `${encodeURIComponent(key)}[]=${
              encodeURIComponent(str as string)
            }&`;
          }
        }
      }
      // remove ending &
      if (interceptedInit.body) {
        interceptedInit.body = interceptedInit.body.substring(
          0,
          interceptedInit.body.length - 1,
        );
      }
      if (!interceptedInit.method) {
        interceptedInit.method = "POST";
      }
    }

    if ("formData" in interceptedInit && interceptedInit.formData) {
      interceptedInit.body = new FormData();
      for (const key of Object.keys(interceptedInit.formData)) {
        if (typeof interceptedInit.formData[key] === "string") {
          interceptedInit.body.append(
            key,
            interceptedInit.formData[key] as string,
          );
        } else {
          for (const str of interceptedInit.formData[key]) {
            interceptedInit.body.append(key, str);
          }
        }
      }
      if (!interceptedInit.method) {
        interceptedInit.method = "POST";
      }
    }

    if ("qs" in interceptedInit && interceptedInit.qs) {
      // remove undefined values
      const filteredQs = Object.entries(interceptedInit.qs).filter(
        ([_, qv]) => {
          if (qv !== undefined) return true;
          return false;
        },
      ) as [string, string][];
      const searchParams = new URLSearchParams(filteredQs);

      for (const [spKey, spValue] of searchParams.entries()) {
        if (spValue !== undefined) {
          input.searchParams.set(spKey, spValue);
        }
      }
    }

    if (interceptedInit.body) {
      interceptedInit.body = transformData(
        interceptedInit.body,
        interceptedInit.headers,
        interceptedInit,
      );
    }

    let response: Response;
    let attempt = 0;
    let retryLimit = utils.getFirstDefined(
      (interceptedInit as ExtendedRequestInit).retry,
      retry,
    );
    if (retryLimit) retryLimit++; // we need to take into account the first time. so we retry times exactly as specified
    do {
      let timeoutId: undefined | number;

      try {
        if (typeof interceptors?.request === "function") {
          await interceptors.request(interceptedInit as ExtendedRequest);
        }

        if (
          "interceptors" in interceptedInit &&
          typeof interceptedInit.interceptors?.request === "function"
        ) {
          await interceptedInit.interceptors.request(
            interceptedInit as ExtendedRequest,
          );
        }

        if (
          ("timeout" in interceptedInit) || timeout
        ) {
          const abortController = new AbortController();
          timeoutId = setTimeout(
            () => abortController.abort(new Error("Timeout has been exceeded")),
            utils.getFirstDefined(
              (interceptedInit as ExtendedRequestInit).timeout,
              timeout,
            ),
          );
          interceptedInit.signal = abortController.signal;
        }

        response = await fetch(input, interceptedInit as RequestInit);
        clearTimeout(timeoutId);
      } catch (e) {
        clearTimeout(timeoutId);
        if (!retryLimit || attempt >= retryLimit) throw e;
        attempt++;
        const delayVal = utils.getFirstDefined(
          (interceptedInit as ExtendedRequestInit).retryDelay,
          retryDelay,
        );
        if (typeof delayVal === "function") {
          await utils.delay(delayVal(attempt));
        } else {
          await utils.delay(delayVal);
        }
      }
    } while (attempt < retryLimit);

    // because it would throw if otherwise and not reach here
    response = response!;

    if (typeof interceptors?.response === "function") {
      await interceptors.response(interceptedInit as ExtendedRequest, response);
    }

    if (
      "interceptors" in interceptedInit &&
      typeof interceptedInit.interceptors?.response === "function"
    ) {
      await interceptedInit.interceptors.response(
        interceptedInit as ExtendedRequest,
        response,
      );
    }

    return response;
  };
}
