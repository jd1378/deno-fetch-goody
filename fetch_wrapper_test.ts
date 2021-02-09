import {
  assert,
  assertStrictEquals,
} from "https://deno.land/std@0.85.0/testing/asserts.ts";
import { serve, Server } from "https://deno.land/std@0.85.0/http/server.ts";
import { wrapFetch } from "./mod.ts";
import { delay } from "https://deno.land/std@0.85.0/async/delay.ts";
import { MultipartReader } from "https://deno.land/std@0.85.0/mime/multipart.ts";

let server1: Server | undefined;
const serverOneUrl = "http://localhost:54933";

let handlers: Promise<void | string>[];
handlers = [];

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
    let bodyContent;
    if (request.url.endsWith("formdata")) {
      const params = getHeaderValueParams(request.headers.get("content-type"));
      const reader = new MultipartReader(request.body, params.get("boundary"));
      const form = await reader.readForm();
      const data = [];
      for (const entry of form.entries()) {
        data.push(entry as string[]);
      }
      bodyContent = new URLSearchParams(data)
        .toString();
    } else if (request.url.startsWith("/qsparams")) {
      bodyContent = new URL("http://foo.bar" + request.url).searchParams
        .toString();
    } else {
      bodyContent = request.headers.get(request.url.substr(1)) || "";
    }
    await request.respond({ status: 200, body: bodyContent });
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
  }
}

Deno.test("WrappedFetch sends a default accept header", async () => {
  try {
    handlers.push(handleServer1());

    const wrappedFetch = wrapFetch();
    const headerString = await wrappedFetch(serverOneUrl + "/accept").then((
      r,
    ) => r.text());

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

Deno.test("WrappedFetch sends a content-type header if set", async () => {
  try {
    handlers.push(handleServer1());

    const wrappedFetch = wrapFetch();
    const headerString = await wrappedFetch(serverOneUrl + "/content-type", {
      headers: {
        "content-type": "foobario",
      },
      method: "POST",
    }).then((
      r,
    ) => r.text());

    assertStrictEquals(headerString, "foobario");
  } finally {
    await closeServers();
  }
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

Deno.test("WrappedFetch sends FormData when form is defined", async () => {
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
      headerString.startsWith("multipart/form-data"),
      "form data header is not sent",
    );

    const response = await wrappedFetch(serverOneUrl + "/formdata", {
      method: "POST",
      form: {
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
