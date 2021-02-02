import * as utils from "./utils.ts";
import { getHeader, setHeader } from "./header_utils.ts";
import { ExtendedRequestInit } from "./extended_request_init.ts";

declare module "./extended_request_init.ts" {
  interface ExtendedRequestInit {
    body: Record<string, unknown>;
  }
}

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
    return JSON.stringify(data);
  }
  return data;
}

/**
 * @param options - Wrap options
 * @param options.fetchFn - If no `fetchFn` is provided, will default to global fetch.
 *  This allows wrapping your fetch function multiple times.
 */
export function wrapFetch(
  { fetchFn = fetch } = {},
) {
  return async function wrappedFetch(
    input: string | Request | URL,
    init?: ExtendedRequestInit | RequestInit | undefined,
  ) {
    // let fetch handle the error
    if (!input) {
      return await fetchFn(input);
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

    if (interceptedInit.body) {
      interceptedInit.body = transformData(
        interceptedInit.body,
        interceptedInit.headers,
      );

      // only when a body is sent we set a default Content-Type
      if (!getHeader(interceptedInit.headers, "Content-Type")) {
        setHeader(
          interceptedInit.headers,
          "Content-Type",
          "application/x-www-form-urlencoded",
        );
      }
    }

    const response = await fetchFn(input, interceptedInit as RequestInit);

    return response;
  };
}
