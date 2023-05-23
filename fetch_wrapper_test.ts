import {
  assert,
  assertEquals,
  assertStrictEquals,
} from "https://deno.land/std@0.119.0/testing/asserts.ts";
import { Server } from "https://deno.land/std@0.119.0/http/server.ts";
import { ExtendedRequest, wrapFetch } from "./mod.ts";
import { delay } from "https://deno.land/std@0.119.0/async/delay.ts";
const serverOneUrl = "http://localhost:54933";

async function server1Handler(request: Request): Promise<Response> {
  let bodyContent = "";
  if (request.url.endsWith("formdata")) {
    const form = await request.formData();
    const data = [];
    for (const entry of form.entries()) {
      data.push(entry as string[]);
    }
    bodyContent = new URLSearchParams(data)
      .toString();
  } else if (request.url.includes("/formurldata")) {
    // skips setting anything and it defaults to request.body
  } else if (request.url.includes("/qsparams")) {
    bodyContent = new URL("http://foo.bar" + request.url).searchParams
      .toString();
  } else if (request.url.includes("/timeout")) {
    bodyContent = "ok";
    const url = new URL("http://foo.bar" + request.url);
    const timeout = parseInt(url.searchParams.get("ms") || "") || 0;
    if (timeout > 0) {
      await delay(timeout);
    }
  } else {
    const headerName = request.url.substring(request.url.lastIndexOf("/") + 1)
      .replace(/[^\w-_]/gi, "");
    if (headerName) {
      bodyContent = request.headers.get(headerName) || "";
    }
  }

  return new Response(bodyContent || request.body, { status: 200 });
}

console.log(
  "Test HTTP webserver running at:",
  "http://localhost:54933",
);
console.log('GET/POST "/formdata" echos formdata of request');
console.log('GET/POST "/<path>" echos "<path>" header of request');

Deno.test("interaction with a server", {
  sanitizeOps: false,
  sanitizeResources: false,
}, async (t) => {
  const server1 = new Server({ handler: server1Handler, hostname: "0.0.0.0" });
  const listener = Deno.listen({ port: 54933 });

  try {
    server1.serve(listener);
    await delay(100);

    await t.step(
      "WrappedFetch global timeout option works",
      async () => {
        const wrappedFetch = wrapFetch({
          timeout: 500,
        });

        const resp = await wrappedFetch(serverOneUrl + "/timeout", {
          qs: {
            ms: "0",
          },
        }).then((r) => r.text());

        assertStrictEquals(
          resp,
          "ok",
        );

        // see if it throws with timeout error
        let fetchError;
        try {
          await wrappedFetch(serverOneUrl + "/timeout", {
            qs: {
              ms: "2000",
            },
          });
        } catch (err) {
          fetchError = err;
        }
        await delay(10);

        assert(fetchError !== undefined, "timeout has not thrown");
        assertStrictEquals(fetchError.message, "Timeout has been exceeded");
      },
    );

    await t.step("WrappedFetch per request timeout option works", async () => {
      const wrappedFetch = wrapFetch(
        {
          timeout: 3000,
        },
      );

      let resp = await wrappedFetch(serverOneUrl + "/timeout", {
        qs: {
          ms: "0",
        },
        timeout: 500,
      }).then((r) => r.text());

      assertStrictEquals(
        resp,
        "ok",
      );

      resp = "";

      // see if it throws with timeout error
      let fetchError;
      try {
        resp = await wrappedFetch(serverOneUrl + "/timeout", {
          qs: {
            ms: "2000",
          },
          timeout: 500,
        }).then((r) => r.text());
      } catch (err) {
        fetchError = err;
      }
      assert(resp === "", "response should not be available");
      assert(fetchError !== undefined, "timeout has not thrown");
      assertStrictEquals(fetchError.message, "Timeout has been exceeded");

      // dummy fetch for letting the async ops finish
      // await (await fetch(serverOneUrl + "/accept")).text();
    });

    await t.step("WrappedFetch sends a default accept header", async () => {
      const wrappedFetch = wrapFetch();
      const headerString = await wrappedFetch(serverOneUrl + "/accept").then(
        (r) => r.text(),
      );

      assertStrictEquals(headerString, "application/json, text/plain, */*");
    });

    await t.step(
      "WrappedFetch sends caller's accept header if set",
      async () => {
        const wrappedFetch = wrapFetch();
        const headerString = await wrappedFetch(serverOneUrl + "/accept", {
          headers: {
            "Accept": "foobario",
          },
        }).then((
          r,
        ) => r.text());

        assertStrictEquals(headerString, "foobario");
      },
    );

    await t.step({
      name: "WrappedFetch sends a content-type header if set",
      fn: async () => {
        const wrappedFetch = wrapFetch();
        const headerString = await wrappedFetch(
          serverOneUrl + "/content-type",
          {
            headers: {
              "content-type": "foobario",
            },
            method: "POST",
          },
        ).then(
          (r) => r.text(),
        );

        assertStrictEquals(headerString, "foobario");
      },
      sanitizeOps: false, // workaround for some kind of bug due to timeout implementation
    });

    await t.step(
      "WrappedFetch sends a default content-type header if posting anything",
      async () => {
        const wrappedFetch = wrapFetch();
        const headerString = await wrappedFetch(
          serverOneUrl + "/content-type",
          {
            method: "POST",
            body: "yay",
          },
        ).then((
          r,
        ) => r.text());

        assertStrictEquals(headerString, "application/x-www-form-urlencoded");
      },
    );

    await t.step(
      "WrappedFetch sends corresponding content-type header when body is defined",
      async () => {
        const wrappedFetch = wrapFetch();
        let headerString = await wrappedFetch(serverOneUrl + "/content-type", {
          method: "POST",
          body: {
            "test": "sa",
          },
        }).then((
          r,
        ) => r.text());

        assertStrictEquals(headerString, "application/json;charset=utf-8");

        headerString = await wrappedFetch(serverOneUrl + "/content-type", {
          method: "POST",
          body: new URLSearchParams({
            "a": "b",
          }),
        }).then((
          r,
        ) => r.text());

        assertStrictEquals(
          headerString,
          "application/x-www-form-urlencoded;charset=utf-8",
        );

        // Anything else behaviour is same as FormData
        headerString = await wrappedFetch(serverOneUrl + "/content-type", {
          method: "POST",
          body: new FormData(),
        }).then((
          r,
        ) => r.text());

        assert(
          headerString.startsWith("multipart/form-data"),
          "form data header is not sent",
        );
      },
    );

    await t.step(
      "WrappedFetch sends the given headers when creating wrapper",
      async () => {
        const headers = new Headers();
        headers.set("test", "foo");
        headers.set("bar", "baz");
        const wrappedFetch = wrapFetch({
          headers,
        });

        let headerString = await wrappedFetch(serverOneUrl + "/test").then(
          (r) => r.text(),
        );
        assertStrictEquals(headerString, "foo");

        headerString = await wrappedFetch(serverOneUrl + "/bar").then(
          (r) => r.text(),
        );
        assertStrictEquals(headerString, "baz");
      },
    );

    await t.step(
      "WrappedFetch doesnt override the user's newly given headers",
      async () => {
        const headers = new Headers();
        headers.set("test", "foo");
        const wrappedFetch = wrapFetch({
          headers,
        });

        const headerString = await wrappedFetch(serverOneUrl + "/test", {
          headers: {
            "test": "baz",
          },
        }).then(
          (r) => r.text(),
        );
        assertStrictEquals(headerString, "baz");
      },
    );

    await t.step(
      "WrappedFetch sends FormData when formData is defined",
      async () => {
        const wrappedFetch = wrapFetch();
        const headerString = await wrappedFetch(
          serverOneUrl + "/content-type",
          {
            method: "POST",
            formData: {
              "test": "sa",
            },
          },
        ).then((
          r,
        ) => r.text());

        assert(
          headerString.startsWith("multipart/form-data"),
          "form data header is not sent",
        );

        const response = await wrappedFetch(serverOneUrl + "/formdata", {
          method: "POST",
          formData: {
            "test": "sa",
          },
        }).then((
          r,
        ) => r.text());

        assertStrictEquals(
          response,
          "test=sa",
        );
      },
    );

    await t.step(
      "WrappedFetch sends form url encoded body when form is defined",
      async () => {
        const wrappedFetch = wrapFetch();
        const headerString = await wrappedFetch(
          serverOneUrl + "/content-type",
          {
            method: "POST",
            form: {
              "test": "sa",
            },
          },
        ).then((
          r,
        ) => r.text());

        assert(
          headerString.startsWith("application/x-www-form-urlencoded"),
          "form header is not sent",
        );

        const response = await wrappedFetch(serverOneUrl + "/formurldata", {
          method: "POST",
          form: {
            "test": "sa",
            "arr": ["1", "2"],
          },
        }).then((
          r,
        ) => r.text());

        assertStrictEquals(
          decodeURIComponent(response),
          "test=sa&arr[]=1&arr[]=2",
        );
      },
    );

    await t.step("WrappedFetch formData option supports array", async () => {
      const wrappedFetch = wrapFetch();

      const response = await wrappedFetch(serverOneUrl + "/formdata", {
        method: "POST",
        formData: {
          "foo": ["bar", "baz"],
        },
      }).then((
        r,
      ) => r.text());

      assertStrictEquals(
        response,
        "foo=bar&foo=baz",
      );
    });

    await t.step("WrappedFetch form option supports array", async () => {
      const wrappedFetch = wrapFetch();

      const response = await wrappedFetch(serverOneUrl + "/formurldata", {
        method: "POST",
        form: {
          "foo": ["bar", "baz"],
        },
      }).then((
        r,
      ) => r.text());

      assertStrictEquals(
        decodeURIComponent(response),
        "foo[]=bar&foo[]=baz",
      );
    });

    await t.step(
      "WrappedFetch sets the User-Agent if given at creation",
      async () => {
        const wrappedFetch = wrapFetch({ userAgent: "foo v1.0" });
        const headerString = await wrappedFetch(serverOneUrl + "/user-agent")
          .then((
            r,
          ) => r.text());

        assertStrictEquals(headerString, "foo v1.0");
      },
    );

    await t.step(
      "WrappedFetch sets url search parameters for qs option",
      async () => {
        const wrappedFetch = wrapFetch();

        const qs = {
          foo: "bar",
          baz: "thud",
          goo: undefined,
        };

        const filteredQs = Object.entries(qs).filter(
          ([_, qv]) => {
            if (qv !== undefined) return true;
            return false;
          },
        ) as [string, string][];

        const assertionQueryString = new URLSearchParams(filteredQs).toString();

        assertStrictEquals(assertionQueryString.includes("undefined"), false);

        // for string
        let paramsString = await wrappedFetch(serverOneUrl + "/qsparams", {
          qs,
        }).then((r) => r.text());

        assertStrictEquals(
          paramsString,
          assertionQueryString,
        );

        // for URL
        paramsString = await wrappedFetch(new URL(serverOneUrl + "/qsparams"), {
          qs,
        }).then((r) => r.text());
        assertStrictEquals(
          paramsString,
          assertionQueryString,
        );

        // Request type is not supported
      },
    );

    await t.step(
      "WrappedFetch interceptors are called with the proper arguments",
      async () => {
        const wrappedFetch = wrapFetch();

        let requestInterceptorRan = false;
        let responseInterceptorRan = false;

        // for string
        await wrappedFetch(serverOneUrl + "/user-agent", {
          interceptors: {
            request(init) {
              assertStrictEquals(init.method, "delete");
              assertStrictEquals(
                init.url.toString(),
                serverOneUrl + "/user-agent",
              );
              requestInterceptorRan = true;
            },
            response(init, response) {
              assertStrictEquals(response.status, 200);
              assertStrictEquals(init.method, "delete");
              assertStrictEquals(
                init.url.toString(),
                serverOneUrl + "/user-agent",
              );
              responseInterceptorRan = true;
            },
          },
          body: {
            "baz": "zab",
          },
          method: "delete",
        }).then((r) => r.text());

        assertStrictEquals(requestInterceptorRan, true);
        assertStrictEquals(responseInterceptorRan, true);
      },
    );

    await t.step(
      "WrappedFetch interceptors are called in the right order",
      async () => {
        const wrappedFetch = wrapFetch();

        const runOrder: string[] = [];

        // for string
        await wrappedFetch(serverOneUrl + "/user-agent", {
          interceptors: {
            request() {
              runOrder.push("req");
            },
            response() {
              runOrder.push("res");
            },
          },
        }).then((r) => r.text());

        assertEquals(
          runOrder,
          ["req", "res"],
        );
      },
    );

    await t.step(
      "WrappedFetch runs global interceptors first then per fetch interceptors",
      async () => {
        const interceptorRunOrder: string[] = [];

        const wrappedFetch = wrapFetch({
          interceptors: {
            request(init) {
              interceptorRunOrder.push("glob_req");
              assertStrictEquals(init.method, "delete");
            },
            response(init, response) {
              assertStrictEquals(response.status, 200);
              interceptorRunOrder.push("glob_res");
              assertStrictEquals(init.method, "delete");
            },
          },
        });

        // for string
        await wrappedFetch(serverOneUrl + "/user-agent", {
          body: {
            "baz": "zab",
          },
          method: "delete",
          interceptors: {
            request(init) {
              interceptorRunOrder.push("req");
              assertStrictEquals(init.method, "delete");
            },
            response(init, response) {
              assertStrictEquals(response.status, 200);
              interceptorRunOrder.push("res");
              assertStrictEquals(init.method, "delete");
            },
          },
        }).then((r) => r.text());

        assertEquals(
          interceptorRunOrder,
          ["glob_req", "req", "glob_res", "res"],
        );
      },
    );

    await t.step(
      "WrappedFetch interceptors first arg contains `url` prop",
      async () => {
        const wrappedFetch = wrapFetch();
        let isUrlInInitCorrect = false;
        // for string
        await wrappedFetch(serverOneUrl + "/accept", {
          interceptors: {
            request(init) {
              isUrlInInitCorrect = init.url.pathname === "/accept";
            },
          },
        }).then((r) => r.text());

        assertEquals(
          isUrlInInitCorrect,
          true,
        );
      },
    );

    await t.step(
      "WrappedFetch throws when a baseURL is missing",
      async () => {
        const wrappedFetch = wrapFetch();
        let thrown = false;
        // for string
        await wrappedFetch("/test").then((r) => r.text()).catch(() => {
          thrown = true;
        });

        assertEquals(
          thrown,
          true,
        );
      },
    );

    await t.step("WrappedFetch uses the given baseURL", async () => {
      const wrappedFetch = wrapFetch({
        baseURL: serverOneUrl,
      });

      const headerString = await wrappedFetch("/accept").then((
        r,
      ) => r.text());

      assertStrictEquals(headerString, "application/json, text/plain, */*");
    });
  } finally {
    server1.close();
  }
});

Deno.test("Retry option", {
  sanitizeOps: false,
  sanitizeResources: false,
}, async (t) => {
  await t.step(
    "WrappedFetch global retry option set to zero doesn't retry",
    async () => {
      const wrappedFetch = wrapFetch({
        retry: 0,
      });

      let count = 0;
      // see if it retries the connection by retry times:
      try {
        await wrappedFetch(serverOneUrl + "/count", {
          interceptors: {
            request() {
              count++;
              throw new Error("arbitrary");
            },
          },
        });
      } catch {
      }

      assertStrictEquals(
        count,
        1,
      );
    },
  );

  await t.step(
    "WrappedFetch local retry option set to zero doesn't retry, even with global retry set",
    async () => {
      const wrappedFetch = wrapFetch({
        retry: 10,
      });

      let count = 0;
      // see if it retries the connection by retry times:
      try {
        await wrappedFetch(serverOneUrl + "/count", {
          interceptors: {
            request() {
              count++;
              throw new Error("arbitrary");
            },
          },
          retry: 0,
        });
      } catch {
      }

      assertStrictEquals(
        count,
        1,
      );
    },
  );

  await t.step(
    "WrappedFetch global retry option set to a number, retries that times after the first failure",
    async () => {
      const differentRetries = [1, 2, 3, 4];

      for (const retry of differentRetries) {
        const wrappedFetch = wrapFetch({
          retry, // meaning first fail + 3 fails = 4 fails
          retryDelay: 0,
        });

        let count = 0;
        // see if it retries the connection by retry times:
        try {
          await wrappedFetch(serverOneUrl + "/count", {
            interceptors: {
              request() {
                count++;
                throw new Error("arbitrary");
              },
            },
          });
        } catch {
        }

        assertStrictEquals(
          count,
          retry + 1,
        );
      }
    },
  );

  await t.step(
    "WrappedFetch local retry option set to a number, retries that times after the first failure",
    async () => {
      const differentRetries = [1, 2, 3, 4];

      for (const retry of differentRetries) {
        const wrappedFetch = wrapFetch();

        let count = 0;
        // see if it retries the connection by retry times:
        try {
          await wrappedFetch(serverOneUrl + "/count", {
            interceptors: {
              request() {
                count++;
                throw new Error("arbitrary");
              },
            },
            retry,
            retryDelay: 0,
          });
        } catch {
        }

        assertStrictEquals(
          count,
          retry + 1,
        );
      }
    },
  );

  await t.step(
    "if WrappedFetch retryDelay is a function, it will be called with attempt number, input url and request init",
    async () => {
      const wrappedFetch = wrapFetch();

      let count = 0;
      let lastAttempt = 0;
      let lastInit: ExtendedRequest | undefined;
      // see if it retries the connection by retry times:
      try {
        await wrappedFetch(serverOneUrl + "/count", {
          body: "foo",
          interceptors: {
            request() {
              count++;
              throw new Error("arbitrary");
            },
          },
          retry: 3,
          retryDelay: ({ attempt, request }) => {
            lastAttempt = attempt;
            lastInit = request;
            assertStrictEquals(count, attempt);
            return 0;
          },
        });
      } catch {
      }

      assertStrictEquals(
        lastInit?.body,
        "foo",
        "didnt receive the init body in retryDelay",
      );
      assertStrictEquals(
        lastInit?.url.toString(),
        serverOneUrl + "/count",
        "didnt receive the url in retryDelay",
      );
      assertStrictEquals(
        count,
        4,
        "retry count is incorrect",
      );
      assertStrictEquals(
        lastAttempt,
        4,
        "attempt count is incorrect",
      );
    },
  );

  await t.step(
    "retryDelay can be aborted",
    async () => {
      const wrappedFetch = wrapFetch();

      let count = 0;

      try {
        await wrappedFetch(serverOneUrl + "/count", {
          body: "foo",
          interceptors: {
            request() {
              count++;
              throw new Error("arbitrary");
            },
          },
          retry: 10,
          retryDelay: ({ abortController }) => {
            if (count >= 2) {
              // means if we already failed 2 times, do not retry anymore
              abortController.abort();
            }
            return 0;
          },
        });
      } catch {
      }

      assert(
        count < 10,
        "count (" + count + ") is bigger than retry (10)",
      );

      assertStrictEquals(
        count,
        2,
        "retry count is " + count + " but should be " + 2,
      );
    },
  );
});
