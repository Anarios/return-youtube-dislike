const { LiveYoutubeDriver } = require("../e2e/live/live-youtube-driver");

class FakeBrowserContext {
  constructor() {
    this.listeners = new Map();
    this.routes = [];
    this.routeCalls = 0;
    this.unrouteCalls = 0;
    this.unrouteImplementation = null;
  }

  on(event, handler) {
    if (!this.listeners.has(event)) this.listeners.set(event, new Set());
    this.listeners.get(event).add(handler);
  }

  off(event, handler) {
    this.listeners.get(event)?.delete(handler);
  }

  async route(matcher, handler) {
    this.routeCalls += 1;
    this.routes.push({ handler, matcher });
  }

  async unroute(matcher, handler) {
    this.unrouteCalls += 1;
    this.routes = this.routes.filter((route) => route.matcher !== matcher || route.handler !== handler);
    if (this.unrouteImplementation) await this.unrouteImplementation();
  }

  async dispatch(request) {
    for (const listener of this.listeners.get("request") ?? []) listener(request);

    const route = {
      abort: jest.fn().mockResolvedValue(undefined),
      fallback: jest.fn().mockResolvedValue(undefined),
      request: () => request,
    };
    for (const registered of [...this.routes].reverse()) {
      if (registered.matcher(new URL(request.url()))) {
        await registered.handler(route);
        break;
      }
    }
    return route;
  }
}

function createDriver(context, options = {}) {
  const page = {
    setDefaultNavigationTimeout: jest.fn(),
    setDefaultTimeout: jest.fn(),
  };
  return new LiveYoutubeDriver(page, context, options);
}

function request(method, url) {
  return {
    frame: jest.fn(() => {
      throw new Error("Service-worker requests do not have a frame");
    }),
    method: () => method,
    url: () => url,
  };
}

describe("live read-only production-interaction guard", () => {
  test("installs the route first, aborts a frame-less interaction POST, and reports the attempt", async () => {
    const context = new FakeBrowserContext();
    const driver = createDriver(context);
    const frameLessRequest = request("POST", "https://returnyoutubedislikeapi.com/interact/vote?source=service-worker");
    let interceptedRoute;

    await expect(
      driver.withNoProductionInteractions(async () => {
        expect(context.routeCalls).toBe(1);
        interceptedRoute = await context.dispatch(frameLessRequest);
      }),
    ).rejects.toThrow("attempted a production interaction");

    expect(interceptedRoute.abort).toHaveBeenCalledWith("blockedbyclient");
    expect(interceptedRoute.fallback).not.toHaveBeenCalled();
    expect(frameLessRequest.frame).not.toHaveBeenCalled();
    expect(context.unrouteCalls).toBe(1);
    expect(context.routes).toEqual([]);
  });

  test("shares one deny route across nested read-only guards", async () => {
    const context = new FakeBrowserContext();
    const driver = createDriver(context);
    const frameLessRequest = request("POST", "https://returnyoutubedislikeapi.com/interact/confirmVote");

    await expect(
      driver.withNoProductionInteractions(() =>
        driver.withNoProductionInteractions(async () => {
          await context.dispatch(frameLessRequest);
        }),
      ),
    ).rejects.toThrow("attempted a production interaction");

    expect(context.routeCalls).toBe(1);
    expect(context.unrouteCalls).toBe(1);
    expect(frameLessRequest.frame).not.toHaveBeenCalled();
  });

  test("allows non-interaction traffic and removes the route after success", async () => {
    const context = new FakeBrowserContext();
    const driver = createDriver(context);
    const result = await driver.withNoProductionInteractions(async () => {
      const unrelatedRoute = await context.dispatch(request("POST", "https://www.youtube.com/youtubei/v1/player"));
      expect(unrelatedRoute.abort).not.toHaveBeenCalled();
      return "complete";
    });

    expect(result).toBe("complete");
    expect(context.routeCalls).toBe(1);
    expect(context.unrouteCalls).toBe(1);
    expect(context.routes).toEqual([]);
  });

  test("bounds a stalled route removal, clears the guard, and allows a fresh guard", async () => {
    const context = new FakeBrowserContext();
    const reportProgress = jest.fn();
    const driver = createDriver(context, {
      readOnlyInteractionGuardCleanupTimeout: 10,
      reportProgress,
    });
    context.unrouteImplementation = () => new Promise(() => {});

    await expect(driver.withNoProductionInteractions(async () => "first action complete")).rejects.toThrow(
      "Timed out after 10ms while removing the live read-only production-interaction route.",
    );

    expect(driver.readOnlyInteractionGuard).toBeNull();
    expect(context.listeners.get("request")?.size ?? 0).toBe(0);
    expect(context.routes).toEqual([]);
    expect(reportProgress).toHaveBeenCalledWith("read-only-interaction-guard.unroute-started", { timeoutMs: 10 });
    expect(reportProgress).toHaveBeenCalledWith("read-only-interaction-guard.unroute-failed", {
      message: "Timed out after 10ms while removing the live read-only production-interaction route.",
      timeoutMs: 10,
    });

    context.unrouteImplementation = null;
    await expect(driver.withNoProductionInteractions(async () => "second action complete")).resolves.toBe(
      "second action complete",
    );
    expect(context.routeCalls).toBe(2);
    expect(context.unrouteCalls).toBe(2);
  });

  test("preserves both the action failure and a stalled route-removal failure", async () => {
    const context = new FakeBrowserContext();
    const driver = createDriver(context, { readOnlyInteractionGuardCleanupTimeout: 10 });
    const actionError = new Error("read-only action failed");
    context.unrouteImplementation = () => new Promise(() => {});

    const failure = await driver
      .withNoProductionInteractions(async () => {
        throw actionError;
      })
      .catch((error) => error);

    expect(failure).toBeInstanceOf(AggregateError);
    expect(failure.message).toBe("The read-only live scenario and its production-interaction guard both failed.");
    expect(failure.errors).toHaveLength(2);
    expect(failure.errors[0]).toBe(actionError);
    expect(failure.errors[1]).toEqual(
      expect.objectContaining({
        message: "Timed out after 10ms while removing the live read-only production-interaction route.",
      }),
    );
    expect(driver.readOnlyInteractionGuard).toBeNull();
    expect(context.listeners.get("request")?.size ?? 0).toBe(0);
  });
});
