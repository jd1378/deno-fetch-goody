import {
  assertNotStrictEquals,
  assertStrictEquals,
  equal,
} from "https://deno.land/std@0.85.0/testing/asserts.ts";
import {
  appendHeader,
  deleteHeader,
  getHeader,
  setHeader,
} from "./header_utils.ts";

Deno.test("deleteHeader works if header is of type Headers", () => {
  const headers = new Headers();
  headers.set("foo", "bar");
  deleteHeader(headers, "foo");
  assertStrictEquals(headers.get("foo"), null);
});

Deno.test("deleteHeader works if header is of type object", () => {
  const headers = {
    "foo": "bar",
  };
  deleteHeader(headers, "foo");
  assertStrictEquals(headers.foo, undefined);
  assertNotStrictEquals(headers.foo, "bar");
});

Deno.test("deleteHeader works if header is of type array", () => {
  const headers = [
    ["foo", "bar"],
  ];

  deleteHeader(headers, "foo");
  assertStrictEquals(headers.length, 0);
});

Deno.test("setHeader works if header is of type Headers", () => {
  const headers = new Headers();
  setHeader(headers, "foo", "bar");

  assertStrictEquals(headers.get("foo"), "bar");
});

Deno.test("setHeader works if header is of type object", () => {
  const headers: Record<string, string> = {};
  setHeader(headers, "foo", "bar");
  assertStrictEquals(headers["foo"], "bar");
  setHeader(headers, "foo", "baz");
  assertStrictEquals(headers["foo"], "baz");
});

Deno.test("setHeader works if header is of type Array", () => {
  const headers: string[][] = [];

  setHeader(headers, "foo", "bar");
  assertStrictEquals(headers.length, 1);
  equal(headers[0], ["foo", "bar"]);

  setHeader(headers, "foo", "baz");
  assertStrictEquals(headers.length, 1);
  equal(headers[0], ["foo", "baz"]);
});

Deno.test("appendHeader works if header is of type Headers", () => {
  const headers = new Headers();
  appendHeader(headers, "foo", "bar");

  assertStrictEquals(headers.get("foo"), "bar");
});

Deno.test("appendHeader works if header is of type object", () => {
  const headers: Record<string, string> = {};
  appendHeader(headers, "foo", "bar");
  assertStrictEquals(headers["foo"], "bar");
  appendHeader(headers, "foo", "baz");
  assertStrictEquals(headers["foo"], "bar, baz");
});

Deno.test("appendHeader works if header is of type Array", () => {
  const headers: string[][] = [];
  appendHeader(headers, "foo", "bar");

  assertStrictEquals(headers.length, 1);
  equal(headers[0], ["foo", "bar"]);
  appendHeader(headers, "foo", "baz");
  assertStrictEquals(headers.length, 1);
  equal(headers[0], ["foo", "bar, baz"]);
});

Deno.test("getHeader works if header is of type Headers", () => {
  const headers = new Headers();
  headers.set("foo", "bar");

  assertStrictEquals(getHeader(headers, "foo"), "bar");
});

Deno.test("getHeader works if header is of type object", () => {
  const headers: Record<string, string> = {
    foo: "bar",
  };
  assertStrictEquals(getHeader(headers, "foo"), "bar");
});

Deno.test("getHeader works if header is of type Array", () => {
  const headers: string[][] = [
    ["foo", "bar"],
  ];

  assertStrictEquals(getHeader(headers, "foo"), "bar");
});
