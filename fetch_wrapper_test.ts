import {
  assert,
  assertStrictEquals,
} from "https://deno.land/std@0.86.0/testing/asserts.ts";
import { serve, Server } from "https://deno.land/std@0.86.0/http/server.ts";
import { wrapFetch } from "./mod.ts";
import { delay } from "https://deno.land/std@0.86.0/async/delay.ts";
import { MultipartReader } from "https://deno.land/std@0.86.0/mime/multipart.ts";

let server1: Server | undefined;
const serverOneUrl = "http://localhost:54933";

let handlers: Promise<void | string>[] = [];

// deno-lint-ignore no-explicit-any
function getHeaderValueParams(value: any) {
  const params = new Map();
  // Forced to do so for some Map constructor param mismatch
  value
    .split(";")
    .slice(1)
    // deno-lint-ignore no-explicit-any
    .map((s: any) => s.trim().split("="))
    // deno-lint-ignore no-explicit-any
    .filter((arr: any) => arr.length > 1)
    // deno-lint-ignore ban-ts-comment
    // @ts-ignore
    .map(([k, v]) => [k, v.replace(/^"([^"]*)"$/, "$1")])
    // deno-lint-ignore ban-ts-comment
    // @ts-ignore
    .forEach(([k, v]) => params.set(k, v));
  return params;
}

async function handleServer1() {
  await delay(100);
  server1 = serve({ hostname: "0.0.0.0", port: 54933 });
  for await (const request of server1) {
    let bodyContent = "";
    if (request.url.endsWith("formdata")) {
      const contentTypeHeader = request.headers.get("content-type");
      const params = getHeaderValueParams(contentTypeHeader);
      const reader = new MultipartReader(request.body, params.get("boundary"));
      const form = await reader.readForm();
      const data = [];
      for (const entry of form.entries()) {
        data.push(entry as string[]);
      }
      bodyContent = new URLSearchParams(data)
        .toString();
    } else if (request.url.startsWith("/formurldata")) {
      // skips setting anything and it defaults to request.body
    } else if (request.url.startsWith("/qsparams")) {
      bodyContent = new URL("http://foo.bar" + request.url).searchParams
        .toString();
    } else if (request.url.startsWith("/timeout")) {
      bodyContent = "ok";
      const url = new URL("http://foo.bar" + request.url);
      await delay(parseInt(url.searchParams.get("ms") || ""));
    } else {
      const headerName = request.url.substr(1).replace(/[^\w-_]/gi, "");
      if (headerName) {
        bodyContent = request.headers.get(headerName) || "";
      }
    }
    await request.respond({ status: 200, body: bodyContent || request.body });
  }
}

console.log(
  "Test HTTP webserver running at:",
  "http://localhost:54933",
);
console.log('GET/POST "/formdata" echos formdata of request');
console.log('GET/POST "/<path>" echos "<path>" header of request');

async function closeServers() {
  try {
    //send a dummy req after close to close the server
    server1 && server1.close();
    handlers.push(
      fetch(serverOneUrl).then((r) => r.text()).catch((err) => {}),
    );
    await Promise.all(handlers);
    handlers = [];
    server1 = undefined;
  } catch {
    //
  } finally {
    await delay(10);
  }
}

Deno.test({
  name: "WrappedFetch global timeout option works",
  fn: async () => {
    try {
      handlers.push(handleServer1());

      const wrappedFetch = wrapFetch({
        timeout: 1000,
      });

      let resp = await wrappedFetch(serverOneUrl + "/timeout", {
        qs: {
          ms: "0",
        },
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
        }).then((r) => r.text());
      } catch (err) {
        fetchError = err;
      }
      assert(resp === "", "response should not be available");
      assert(fetchError !== undefined, "timeout has not thrown");
      assertStrictEquals(fetchError.message, "timeout");
    } finally {
      await closeServers();
    }
  },
  sanitizeOps: false,
});

Deno.test({
  name: "WrappedFetch per request timeout option works",
  fn: async () => {
    try {
      handlers.push(handleServer1());

      const wrappedFetch = wrapFetch();

      let resp = await wrappedFetch(serverOneUrl + "/timeout", {
        qs: {
          ms: "0",
        },
        timeout: 1000,
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
          timeout: 1000,
        }).then((r) => r.text());
      } catch (err) {
        fetchError = err;
      }
      assert(resp === "", "response should not be available");
      assert(fetchError !== undefined, "timeout has not thrown");
      assertStrictEquals(fetchError.message, "timeout");
    } finally {
      await closeServers();
    }
  },
  sanitizeOps: false,
});

Deno.test("WrappedFetch sends a default accept header", async () => {
  try {
    handlers.push(handleServer1());

    const wrappedFetch = wrapFetch();
    const headerString = await wrappedFetch(serverOneUrl + "/accept").then(
      (r) => r.text(),
    );

    assertStrictEquals(headerString, "application/json, text/plain, */*");
  } finally {
    await closeServers();
  }
});

Deno.test("WrappedFetch sends caller's accept header if set", async () => {
  try {
    handlers.push(handleServer1());

    const wrappedFetch = wrapFetch();
    const headerString = await wrappedFetch(serverOneUrl + "/accept", {
      headers: {
        "Accept": "foobario",
      },
    }).then((
      r,
    ) => r.text());

    assertStrictEquals(headerString, "foobario");
  } finally {
    await closeServers();
  }
});

Deno.test({
  name: "WrappedFetch sends a content-type header if set",
  fn: async () => {
    try {
      handlers.push(handleServer1());

      const wrappedFetch = wrapFetch();
      const headerString = await wrappedFetch(serverOneUrl + "/content-type", {
        headers: {
          "content-type": "foobario",
        },
        method: "POST",
      }).then(
        (r) => r.text(),
      );

      assertStrictEquals(headerString, "foobario");
    } finally {
      await closeServers();
    }
  },
  sanitizeOps: false, // workaround for some kind of bug due to timeout implementation
});

Deno.test("WrappedFetch sends a default content-type header if posting anything", async () => {
  try {
    handlers.push(handleServer1());

    const wrappedFetch = wrapFetch();
    const headerString = await wrappedFetch(serverOneUrl + "/content-type", {
      method: "POST",
      body: "yay",
    }).then((
      r,
    ) => r.text());

    assertStrictEquals(headerString, "application/x-www-form-urlencoded");
  } finally {
    await closeServers();
  }
});

Deno.test("WrappedFetch sends corresponding content-type header when body is defined", async () => {
  try {
    handlers.push(handleServer1());

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
  } finally {
    await closeServers();
  }
});

Deno.test("WrappedFetch sends FormData when formData is defined", async () => {
  try {
    handlers.push(handleServer1());

    const wrappedFetch = wrapFetch();
    const headerString = await wrappedFetch(serverOneUrl + "/content-type", {
      method: "POST",
      formData: {
        "test": "sa",
      },
    }).then((
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
  } finally {
    await closeServers();
  }
});

Deno.test("WrappedFetch sends form url encoded body when form is defined", async () => {
  try {
    handlers.push(handleServer1());

    const wrappedFetch = wrapFetch();
    const headerString = await wrappedFetch(serverOneUrl + "/content-type", {
      method: "POST",
      form: {
        "test": "sa",
      },
    }).then((
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
  } finally {
    await closeServers();
  }
});

// Deno.test("WrappedFetch formData option supports array", async () => {
//   try {
//     handlers.push(handleServer1());

//     const wrappedFetch = wrapFetch();

//     const response = await wrappedFetch(serverOneUrl + "/formdata", {
//       method: "POST",
//       formData: {
//         "foo": ["bar", "baz"],
//       },
//     }).then((
//       r,
//     ) => r.text());

//     assertStrictEquals(
//       response,
//       "foo=bar&foo=baz", // test fails, but data is sent: https://github.com/denoland/deno_std/issues/716
//     );
//   } finally {
//     await closeServers();
//   }
// });

Deno.test("WrappedFetch form option supports array", async () => {
  try {
    handlers.push(handleServer1());

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
  } finally {
    await closeServers();
  }
});

Deno.test("WrappedFetch sets the User-Agent if given at creation", async () => {
  try {
    handlers.push(handleServer1());

    const wrappedFetch = wrapFetch({ userAgent: "foo v1.0" });
    const headerString = await wrappedFetch(serverOneUrl + "/user-agent").then((
      r,
    ) => r.text());

    assertStrictEquals(headerString, "foo v1.0");
  } finally {
    await closeServers();
  }
});

Deno.test("WrappedFetch sets url search parameters for qs option", async () => {
  try {
    handlers.push(handleServer1());

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
  } finally {
    await closeServers();
  }
});

Deno.test("WrappedFetch runs init.validator if set", async () => {
  try {
    handlers.push(handleServer1());

    const wrappedFetch = wrapFetch();

    let validatorRan = false;
    let initPassed = false;

    // for string
    await wrappedFetch(serverOneUrl + "/user-agent", {
      validator(response, init) {
        assertStrictEquals(response.status, 200);
        validatorRan = true;
        initPassed = init.method === "delete";
      },
      body: {
        "baz": "zab",
      },
      method: "delete",
    }).then((r) => r.text());

    assertStrictEquals(
      validatorRan,
      true,
    );
    assertStrictEquals(
      initPassed,
      true,
    );
  } finally {
    await closeServers();
  }
});

Deno.test("WrappedFetch runs WrapperOption.validator if set", async () => {
  try {
    handlers.push(handleServer1());

    let validatorRan = false;
    let initPassed = false;

    const wrappedFetch = wrapFetch({
      validator(response, init) {
        assertStrictEquals(response.status, 200);
        validatorRan = true;
        initPassed = init.method === "delete";
      },
    });

    // for string
    await wrappedFetch(serverOneUrl + "/user-agent", {
      body: {
        "baz": "zab",
      },
      method: "delete",
    }).then((r) => r.text());

    assertStrictEquals(
      validatorRan,
      true,
    );
    assertStrictEquals(
      initPassed,
      true,
    );
  } finally {
    await closeServers();
  }
});

Deno.test("WrappedFetch runs both validators in order", async () => {
  try {
    handlers.push(handleServer1());

    let validatorRan = false;
    let initPassed = false;

    const wrappedFetch = wrapFetch({
      validator(response, init) {
        assertStrictEquals(response.status, 200);
        validatorRan = true;
        initPassed = init.method === "delete";
      },
    });

    let secondValidatorRan = false;
    let secondInitPassed = false;

    // for string
    await wrappedFetch(serverOneUrl + "/user-agent", {
      body: {
        "baz": "zab",
      },
      method: "delete",
      validator(response, init) {
        assertStrictEquals(response.status, 200);
        secondValidatorRan = true;
        secondInitPassed = init.method === "delete";
      },
    }).then((r) => r.text());

    assertStrictEquals(
      validatorRan,
      true,
    );
    assertStrictEquals(
      initPassed,
      true,
    );

    assertStrictEquals(
      secondValidatorRan,
      true,
    );
    assertStrictEquals(
      secondInitPassed,
      true,
    );
  } finally {
    await closeServers();
  }
});
