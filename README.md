# deno-fetch-goody

This library offers a fetch wrapper that automatically adds `Content-Type` header. also it can accepts object as body now to send as json.

## usage

you can import `wrapFetch` from `mod.ts` file.

```js
export { wrapFetch } from 'https://deno.land/x/fetch_goody@v1.0.0/mod.ts';
```

### wrapFetch

```js
// this simple
const fetch = wrapFetch();
```

Or

```js
// you can also pass your own wrapped fetch function, allowing for wrapping fetch multiple times
const fetch = wrapFetch({ fetchFn: yourFetch });
```

## test

fetch wrapper tests require network access to emulate server.

run with `deno test --allow-net`
