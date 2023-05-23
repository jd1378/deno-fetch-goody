# deno-fetch-goody

This library offers a fetch wrapper that can:

- automatically add `Content-Type` header
- directly use objects for `body` as json (see below)
- send `form`, `formData`, `qs` (query string) easily from objects
- accept a `timeout` option and abort when timeout is reached
- accept a `retry` option and retry the request when it throws
- accept a `retryDelay` option to wait before retrying. it can be a function.
  further retries can be cancelled as well!
- add `Accept` header with value `application/json, text/plain, */*` if not
  already set by you
- set global headers when creating the wrapper
- set a `baseURL` when creating the wrapper
- add `interceptors` when creating the wrapper or for individual requests

**Deno v1.11+ is required.**

## usage

you can import `wrapFetch` from `mod.ts` file.

```ts
export { wrapFetch } from "https://deno.land/x/fetch_goody@v7.0.0/mod.ts";
```

### wrapFetch

```ts
// this simple
const wrappedfetch = wrapFetch();
```

Or

```ts
// you can also pass your own wrapped fetch function, allowing for wrapping fetch multiple times
const wrappedfetch = wrapFetch({ fetch: yourFetch });
```

You can also add global interceptors:

```ts
const wrappedfetch = wrapFetch({
  interceptors: {
    request(init: ExtendedRequest) {
      // add some header before each request is sent
      // for example add some headers from your cookie-jar
    },
  },
});
```

#### using the new wrappedfetch

```ts
// for sending a multipart/form-data body now you should use `formData`.
const resp1 = await wrappedfetch("url", {
  form: {
    "foo": "bar",
  },
}); // sets method to POST by default and converts object to application/x-www-form-urlencoded.

// or

const resp2 = await wrappedfetch("url", {
  body: {
    "foo": "bar",
  },
}); // is sent as json and corresponding header is set
// also if method is not defined for this, it will be set as POST

// other features:

// adding query string

const resp3 = await wrappedfetch("url", {
  qs: {
    "foo": "bar",
  },
}); // results to url being sent to be "url?foo=bar"

// adding interceptors where you can throw errors and other stuff

const resp4 = await wrappedfetch("url", {
  interceptors: {
    response(init: ExtendedRequest, response: Response) {
      if (response.status > 200) {
        throw new Error("yada");
      }
    },
  },
});
```

## test

fetch wrapper tests require network access to emulate server.

run with `deno test --allow-net`
