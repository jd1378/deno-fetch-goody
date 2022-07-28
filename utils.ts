import type { Buffer } from "https://deno.land/std@0.85.0/node/buffer.ts";

// the following is from axios library with a bit of touch up for ts

const toString = Object.prototype.toString;

/**
 * Determine if a value is an Array
 *
 * @param val The value to test
 * @returns {boolean} True if value is an Array, otherwise false
 */
export function isArray(val: unknown): val is Array<unknown> {
  return toString.call(val) === "[object Array]";
}

/**
 * Determine if a value is a FormData
 *
 * @param val The value to test
 * @returns {boolean} True if value is an FormData, otherwise false
 */
export function isFormData(val: unknown): val is FormData {
  return (typeof FormData !== "undefined") && (val instanceof FormData);
}

/**
 * Determine if a value is an Object
 *
 * @param val The value to test
 * @returns {boolean} True if value is an Object, otherwise false
 */
export function isObject(val: unknown): val is Record<string, unknown> {
  return !!val && typeof val === "object";
}

/**
 * Determine if a value is undefined
 *
 * @param val The value to test
 * @returns {boolean} True if the value is undefined, otherwise false
 */
export function isUndefined(val: unknown): val is undefined {
  return typeof val === "undefined";
}

/**
 * Determine if a value is a Buffer
 *
 * @param val The value to test
 * @returns {boolean} True if value is a Buffer, otherwise false
 */
export function isBuffer(val: unknown): val is Buffer {
  // deno-lint-ignore ban-ts-comment
  // @ts-ignore
  return val !== null && !isUndefined(val) && val.constructor !== null &&
    // deno-lint-ignore ban-ts-comment
    // @ts-ignore
    !isUndefined(val.constructor) &&
    // deno-lint-ignore ban-ts-comment
    // @ts-ignore
    typeof val.constructor.isBuffer === "function" &&
    // deno-lint-ignore ban-ts-comment
    // @ts-ignore
    val.constructor.isBuffer(val);
}

/**
 * Determine if a value is an ArrayBuffer
 *
 * @param val The value to test
 * @returns {boolean} True if value is an ArrayBuffer, otherwise false
 */
export function isArrayBuffer(val: unknown): val is ArrayBuffer {
  return toString.call(val) === "[object ArrayBuffer]";
}

/**
 * Determine if a value is a view on an ArrayBuffer
 *
 * @param val The value to test
 * @returns {boolean} True if value is a view on an ArrayBuffer, otherwise false
 */
export function isArrayBufferView(val: unknown): val is ArrayBufferView {
  let result;
  if ((typeof ArrayBuffer !== "undefined") && (ArrayBuffer.isView)) {
    result = ArrayBuffer.isView(val);
  } else {
    // deno-lint-ignore ban-ts-comment
    // @ts-ignore
    result = (val) && (val.buffer) && (val.buffer instanceof ArrayBuffer);
  }
  return result;
}

/**
 * Determine if a value is a File
 *
 * @param val The value to test
 * @returns {boolean} True if value is a File, otherwise false
 */
export function isFile(val: unknown): val is File {
  return toString.call(val) === "[object File]";
}

/**
 * Determine if a value is a Blob
 *
 * @param val The value to test
 * @returns {boolean} True if value is a Blob, otherwise false
 */
export function isBlob(val: unknown): val is Blob {
  return toString.call(val) === "[object Blob]";
}

/**
 * Determine if a value is a Function
 *
 * @param val The value to test
 * @returns {boolean} True if value is a Function, otherwise false
 */
// deno-lint-ignore ban-types
export function isFunction(val: unknown): val is Function {
  return toString.call(val) === "[object Function]";
}

/**
 * Determine if a value is a Stream
 *
 * @param val The value to test
 * @returns {boolean} True if value is a Stream, otherwise false
 */
export function isStream(val: unknown): val is ReadableStream {
  return isObject(val) && isFunction(val.pipe);
}

/**
 * Determine if a value is a URLSearchParams object
 *
 * @param val The value to test
 * @returns {boolean} True if value is a URLSearchParams object, otherwise false
 */
export function isURLSearchParams(val: unknown): val is URLSearchParams {
  return typeof URLSearchParams !== "undefined" &&
    val instanceof URLSearchParams;
}
