export function timeoutFetch(
  ms: number,
  promise: Promise<Response>,
): Promise<Response> {
  return new Promise((resolve, reject) => {
    let timeoutId: undefined | number = setTimeout(() => {
      timeoutId = undefined;
      reject(new Error("timeout"));
    }, ms);
    promise.then(
      (res) => {
        if (timeoutId) {
          clearTimeout(timeoutId);
          resolve(res);
        }
      },
      (err) => {
        if (timeoutId) {
          clearTimeout(timeoutId);
          reject(err);
        }
      },
    );
  });
}
