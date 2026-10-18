import { logger, setLoggingDisabled } from "./logging";

afterEach(() => {
  setLoggingDisabled(false);
  jest.restoreAllMocks();
});

test("suppresses only extension log/debug calls without changing the console", () => {
  const methods = Object.fromEntries(
    ["log", "debug", "info", "warn", "error"].map((name) => [
      name,
      jest.spyOn(console, name).mockImplementation(() => {}),
    ]),
  );
  const payload = { count: 42 };

  for (const disabled of [true, false, true, false]) {
    Object.values(methods).forEach((method) => method.mockClear());
    setLoggingDisabled(disabled);
    logger.log("extension log", payload);
    logger.debug("extension debug", payload);
    for (const [name, method] of Object.entries(methods)) {
      expect(console[name]).toBe(method);
      console[name]("unrelated message");
      const expectedCalls = !disabled && ["log", "debug"].includes(name) ? 2 : 1;
      expect(method).toHaveBeenCalledTimes(expectedCalls);
      expect(method).toHaveBeenLastCalledWith("unrelated message");
      if (expectedCalls === 2) {
        expect(method).toHaveBeenNthCalledWith(1, `extension ${name}`, payload);
        expect(method.mock.contexts[0]).toBe(console);
      }
    }
  }
});
