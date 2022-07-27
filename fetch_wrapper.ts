import * as utils from "./utils.ts";
import {
  ExtendedRequest,
  ExtendedRequestInit,
  Validator,
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
  /** validator to run after each response with this fetch */
  validator?: Validator;
  /** if set, all requests will timeout after this amount of milliseconds passed */
  timeout?: number;
  /** if set, will be used as default headers. new added headers will be added on top of these. */
  headers?: Headers;
  /** if set, will be prepended to the target url using URL api. */
  baseURL?: string | URL;
};

export function wrapFetch(options?: WrapFetchOptions) {
  const {
    fetch = globalThis.fetch,
    userAgent,
    validator,
    timeout = 99999999,
    headers,
    baseURL,
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
      // doesn't support relative urls
      if (typeof input === "string" && input.includes("://")) {
        input = new URL(input);
      }

      if (input instanceof URL) {
        for (const [spKey, spValue] of searchParams.entries()) {
          if (spValue !== undefined) {
            input.searchParams.set(spKey, spValue);
          }
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

    let timeoutId: undefined | number;
    if (("timeout" in interceptedInit && interceptedInit.timeout) || timeout) {
      const abortController = new AbortController();
      timeoutId = setTimeout(
        () => abortController.abort(new Error("Timeout has been exceeded")),
        (interceptedInit as ExtendedRequestInit).timeout || timeout,
      );
      interceptedInit.signal = abortController.signal;
    }

    let newInput;
    if (input instanceof Request) {
      newInput = input.url;
    } else {
      newInput = input.toString();
    }

    if (baseURL) {
      newInput = new URL(newInput, baseURL);
    }

    const response = await fetch(newInput, interceptedInit as RequestInit);
    clearTimeout(timeoutId);

    if (typeof validator === "function") {
      await validator(response, interceptedInit as ExtendedRequest);
    }

    if (
      "validator" in interceptedInit &&
      typeof interceptedInit.validator === "function"
    ) {
      await interceptedInit.validator(
        response,
        interceptedInit as ExtendedRequest,
      );
    }

    return response;
  };
}
