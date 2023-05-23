# Changelog

## v6.2.1

- update `retryDelay` signiture

## v6.2.0

- add `retry` and `retryDelay`

## v6.1.0

- add `url` prop to `ExtendedRequest` that is passed as first arg to
  interceptors.

## v6.0.0

- remmove `validator`.
- add `interceptors`.

## v5.2.0

- fix a small issue when no header was given
- add support for baseURL option
- export ExtendedRequest type for validator typing

## v5.1.0

- add support for initial headers when creating wrapper
- remove unnecessary header utils
- improve types for validator for easier header usage

## v5.0.0

- fix timeout functionality as the abort signal is now supported as of deno
  v1.11

Version v5.0.0+ is the recommended version now (abort controller is used now).
please don't use v4 of fetch goody anymore.

## v4.0.0

- due to adding `timeout` option and the way it works, it may cause issues. so I
  release this as breaking change.

## v3.0.1

- fix `form` keys not getting url encoded.

## v3.0.0

- BREAKING CHANGE: Changed `form` option to `formData` and used `form` option as
  a `application/x-www-form-urlencoded` value instead of `multipart/form-data`.
  this means anything meant to be sent as a `multipart/form-data` now should be
  passed as `formData` option.

## v2.1.0

- Allow array of strings as value in form option.

## v2.0.0

- BREAKING CHANGE: rename `fetchFn` to `fetch` in WrapFetchOptions
- create WrapFetchOptions type
- add a validator option to WrapFetchOptions
- the validator that is passed to WrapFetchOptions will run before the validator
  of ExtendedRequestInit

## v1.5.0

- pass init to validator

## v1.4.0

- add validator option
- update docs a bit

## v1.3.3

- fix bug introduced in last version and add test

# v1.3.2

- allow qs value to be undefined

# v1.3.1

- only add qs if value not undefined

# v1.3.0

- added support for "qs" option

# v1.2.1

- fix some code smells

# v1.2.0

- Add support for user-agent when wrapping.

# v1.1.0

- Very important fix for `ExtendedRequestInit` type. The type is also exported
  now.
- Very important fix for FormData.
- automatically add method for object body (json).
- automatically build and use form data if `form` is defined inside `init`

# v1.0.0
