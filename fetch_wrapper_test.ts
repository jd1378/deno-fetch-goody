import {
  assertStrictEquals,
} from "https://deno.land/std@0.85.0/testing/asserts.ts";
import { serve, Server } from "https://deno.land/std@0.85.0/http/server.ts";
import { wrapFetch } from "./mod.ts";
import { delay } from "https://deno.land/std@0.85.0/async/delay.ts";

let server1: Server | undefined;
const serverOneUrl = "http://localhost:54933";

let handlers: Promise<void | string>[];
handlers = [];

async function handleServer1() {
  await delay(100);
  server1 = serve({ hostname: "0.0.0.0", port: 54933 });
  for await (const request of server1) {
    const bodyContent = request.headers.get(request.url.substr(1)) || "";
    await request.respond({ status: 200, body: bodyContent });
  }
}

console.log(
  "Test HTTP webserver running at:",
  "http://localhost:54933",
);
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

    assertStrictEquals(
      headerString,
      "application/x-www-form-urlencoded",
    );
  } finally {
    await closeServers();
  }
});
