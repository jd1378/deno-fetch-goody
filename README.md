# deno-fetch-goody

This library offers a fetch wrapper that automatically adds `Content-Type` header. also it can accepts object as body now to send as json.

Also adds `Accept` header with value `application/json, text/plain, */*` if not already set by you.

## usage

you can import `wrapFetch` from `mod.ts` file.

```js
export { wrapFetch } from 'https://deno.land/x/fetch_goody@v2.1.0/mod.ts';
```

### wrapFetch

```js
// this simple
const wrappedfetch = wrapFetch();
```

Or

```js
// you can also pass your own wrapped fetch function, allowing for wrapping fetch multiple times
const wrappedfetch = wrapFetch({ fetchFn: yourFetch });
```

#### using the new wrappedfetch

```js

const resp1 = await wrappedfetch("url",{
  form: {
    'foo': 'bar'
  }
}); // sets method to POST by default and converts object to FormData.

// or 

const resp2 = await wrappedfetch("url",{
  body: {
    'foo': 'bar'
  }
}); // is sent as json and corresponding header is set
// also if method is not defined for this, it will be set as POST

// other features:

// adding query string

const resp3 = await wrappedfetch("url",{
  qs: {
    'foo': 'bar'
  }
}); // results to url being sent to be "url?foo=bar"

// adding a response validator where you can throw errors

const resp4 = await wrappedfetch("url",{
  validator(response: Response, init: ExtendedRequestInit) {
    if (response.status > 200) {
      throw new Error('yada');
    }
  }
});

```

## test

fetch wrapper tests require network access to emulate server.

run with `deno test --allow-net`
