import * as utils from "./utils.ts";
import { getHeader, setHeader } from "./header_utils.ts";
import { ExtendedRequestInit } from "./extended_request_init.ts";

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
  headers:
    | Headers
    | string[][]
    | Record<string, string>
    | undefined,
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
    setHeader(
      headers,
      "Content-Type",
      "application/x-www-form-urlencoded;charset=utf-8",
    );
    return data.toString();
  }
  if (utils.isObject(data)) {
    setHeader(
      headers,
      "Content-Type",
      "application/json;charset=utf-8",
    );
    if (init && !init.method) {
      init.method = "POST";
    }
    return JSON.stringify(data);
  }
  // the default header if type undefined
  setHeader(
    headers,
    "Content-Type",
    "application/x-www-form-urlencoded",
  );
  return data;
}

export type WrapFetchOptions = {
  /** your own fetch function. defaults to global fetch. */
  fetch?: typeof fetch;
  /** user agent header string */
  userAgent?: string;
  /** validator to run after each response with this fetch */
  validator?:
    ((response: Response, init: ExtendedRequestInit) => void | Promise<void>);
};

/**
 * @param options - Wrap options
 * @param options.fetchFn - If no `fetchFn` is provided, will default to global fetch.
 *  This allows wrapping your fetch function multiple times.
 */
export function wrapFetch(options?: WrapFetchOptions) {
  const { fetch = globalThis.fetch, userAgent, validator } = options || {};

  return async function wrappedFetch(
    input: string | Request | URL,
    init?: ExtendedRequestInit | RequestInit | undefined,
  ) {
    // let fetch handle the error
    if (!input) {
      return await fetch(input);
    }

    const interceptedInit = init || {};
    if (!interceptedInit.headers) {
      interceptedInit.headers = new Headers();
    }

    // setup a default accept
    if (!getHeader(interceptedInit.headers, "Accept")) {
      setHeader(
        interceptedInit.headers,
        "Accept",
        "application/json, text/plain, */*",
      );
    }
    // setup user agent if set
    if (userAgent) {
      setHeader(
        interceptedInit.headers,
        "User-Agent",
        userAgent,
      );
    }

    if ("form" in interceptedInit && interceptedInit.form) {
      interceptedInit.body = "";
      for (const key of Object.keys(interceptedInit.form)) {
        if (typeof interceptedInit.form[key] === "string") {
          interceptedInit.body += `${key}=${
            encodeURIComponent(interceptedInit.form[key] as string)
          }&`;
        } else {
          for (const str of interceptedInit.form[key]) {
            interceptedInit.body += `${key}[]=${
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

    const response = await fetch(input, interceptedInit as RequestInit);

    if (typeof validator === "function") {
      await validator(response, interceptedInit);
    }

    if (
      "validator" in interceptedInit &&
      typeof interceptedInit.validator === "function"
    ) {
      await interceptedInit.validator(response, interceptedInit);
    }

    return response;
  };
}
