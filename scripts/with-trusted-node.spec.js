/** @jest-environment node */
const fs = require("node:fs");
const path = require("node:path");
const tls = require("node:tls");
const { X509Certificate } = require("node:crypto");
const { spawnSync } = require("node:child_process");
const { filterCertificates, readCertificates, prepareEnvironment, main } = require("./with-trusted-node.cjs");

const root = path.resolve(__dirname, "../.private/node-trust-tests");
const blocked = tls.rootCertificates.find((pem) =>
  new X509Certificate(pem).subject.includes("CN=AAA Certificate Services"),
);
const allowed = tls.rootCertificates.filter(
  (pem) => !new X509Certificate(pem).subject.includes("emSign") && pem !== blocked,
);
const npmConfig = { ca: null, cafile: null, strictSsl: true, nodeOptions: null };
let temporary;

beforeEach(() => {
  fs.mkdirSync(root, { recursive: true });
  temporary = fs.mkdtempSync(path.join(root, "run-"));
});

afterEach(() => {
  const resolved = fs.realpathSync(temporary);
  expect(path.dirname(resolved)).toBe(fs.realpathSync(root));
  fs.rmSync(resolved, { recursive: true, force: true });
});

test("excludes an affected root by public key and retains unrelated roots without duplicates", () => {
  expect(blocked).toBeDefined();
  const result = filterCertificates([allowed[0], blocked, allowed[0]]);
  expect(result).toBe(new X509Certificate(allowed[0]).toString());
  expect(() => filterCertificates([blocked])).toThrow(/No trusted certificates/);
  expect(() => filterCertificates(["invalid"])).toThrow();
});

test("preserves extra custom certificates absent from the default set and leaves the parent environment unchanged", () => {
  const extra = path.join(temporary, "extra.pem");
  fs.writeFileSync(extra, [allowed[1], blocked].join("\n"));
  const original = { NODE_EXTRA_CA_CERTS: extra, NODE_OPTIONS: "--max-old-space-size=512", UNRELATED: "preserved" };
  const env = prepareEnvironment(temporary, original, [allowed[0]]);
  expect(readCertificates(env.SSL_CERT_FILE)).toHaveLength(2);
  expect(fs.readFileSync(env.SSL_CERT_FILE, "utf8")).toContain(new X509Certificate(allowed[1]).toString().trim());
  expect(fs.readFileSync(env.SSL_CERT_FILE, "utf8")).not.toContain(new X509Certificate(blocked).toString().trim());
  expect(env.NODE_EXTRA_CA_CERTS).toBeUndefined();
  expect(env.NODE_OPTIONS).toBe("--max-old-space-size=512 --use-openssl-ca");
  expect(env.UNRELATED).toBe("preserved");
  expect(fs.readdirSync(env.SSL_CERT_DIR)).toEqual([]);
  expect(original).toEqual({
    NODE_EXTRA_CA_CERTS: extra,
    NODE_OPTIONS: "--max-old-space-size=512",
    UNRELATED: "preserved",
  });
});

test("filters npm-specific custom trust without adding it to other Node clients", () => {
  const cafile = path.join(temporary, "custom.pem");
  fs.writeFileSync(cafile, [allowed[1], blocked].join("\n"));
  const env = prepareEnvironment(temporary, {}, [allowed[0]], {
    ...npmConfig,
    cafile,
    nodeOptions: "--max-old-space-size=512",
  });
  expect(fs.readFileSync(env.npm_config_cafile, "utf8")).toBe(new X509Certificate(allowed[1]).toString());
  expect(fs.readFileSync(env.SSL_CERT_FILE, "utf8")).not.toContain(new X509Certificate(allowed[1]).toString().trim());
  expect(env.npm_config_node_options).toBe("--max-old-space-size=512 --use-openssl-ca");
  expect(env.npm_config_strict_ssl).toBe("true");
});

test.each([
  { NODE_OPTIONS: "--use-system-ca" },
  { NODE_OPTIONS: "--use_openssl_ca" },
  { NODE_OPTIONS: "--use-bundled-ca" },
  { NODE_OPTIONS: "--no-use-openssl-ca" },
  { NODE_OPTIONS: "--no_use_openssl_ca" },
  { NODE_OPTIONS: "--experimental-config-file=existing.json" },
  { NODE_OPTIONS: "--openssl-config=config.cnf" },
  { SSL_CERT_FILE: "existing.pem" },
  { SSL_CERT_DIR: "existing-directory" },
  { OPENSSL_CONF: "existing.cnf" },
  { NODE_USE_SYSTEM_CA: "1" },
  { NODE_TLS_REJECT_UNAUTHORIZED: "0" },
])("rejects unsupported trust overrides %p", (env) => {
  expect(() => prepareEnvironment(temporary, env, [allowed[0]])).toThrow();
});

test.each([
  { ...npmConfig, strictSsl: false },
  { ...npmConfig, ca: "inline" },
])("rejects unsupported npm TLS configuration %p", (config) =>
  expect(() => prepareEnvironment(temporary, {}, [allowed[0]], config)).toThrow(),
);

test.each(["--no-use-openssl-ca", "--no-use_openssl_ca"])("rejects npm lifecycle trust overrides %s", (nodeOptions) => {
  expect(() => prepareEnvironment(temporary, {}, [allowed[0]], { ...npmConfig, nodeOptions })).toThrow();
});

test.each([
  "--no-use-openssl-ca",
  "--no-use_openssl_ca",
  "--env-file=existing.env",
  "--env-file-if-exists=existing.env",
  "--experimental-config-file=existing.json",
  "--experimental-default-config-file",
])("rejects child Node trust/configuration overrides %s", (option) => {
  expect(() => main(["node", option, "-e", "process.exit(0)"])).toThrow(/CA-store/);
});

test.each(["--use-openssl-ca", "--no-use-openssl-ca", "--no-use_openssl_ca"])(
  "rejects trust overrides on the wrapper's own Node process %s",
  (option) => {
    const env = { ...process.env };
    for (const key of Object.keys(env)) {
      if (/^(NODE_OPTIONS|SSL_CERT_FILE|SSL_CERT_DIR|NODE_EXTRA_CA_CERTS)$/i.test(key)) delete env[key];
    }
    const result = spawnSync(
      process.execPath,
      [option, path.join(__dirname, "with-trusted-node.cjs"), "node", "-e", "process.exit(0)"],
      { env, encoding: "utf8" },
    );
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("CA-store");
  },
);

test("fails on incomplete custom bundles rather than silently dropping custom trust", () => {
  const filename = path.join(temporary, "broken.pem");
  fs.writeFileSync(filename, `${allowed[0]}\n-----BEGIN CERTIFICATE-----\nbroken`);
  expect(() => readCertificates(filename)).toThrow(/incomplete/);
});

test.each([
  "--prefix=Website",
  "--userconfig=other.npmrc",
  "-g",
  "--cafile=other.pem",
  "--ca=inline",
  "--pref=Website",
])("rejects npm configuration-selection overrides %s before inspecting npm", (option) =>
  expect(() => main(["npm", option, "test"])).toThrow(/Unsupported npm option/),
);

test("applies the replacement store in a native Node child and propagates its exit status", () => {
  const env = { ...process.env };
  for (const key of Object.keys(env)) {
    if (/^(NODE_OPTIONS|SSL_CERT_FILE|SSL_CERT_DIR|NODE_EXTRA_CA_CERTS)$/i.test(key)) delete env[key];
  }
  const result = spawnSync(
    process.execPath,
    [path.join(__dirname, "with-trusted-node.cjs"), "node", "-e", "require('https').createServer(); process.exit(17)"],
    {
      env,
      encoding: "utf8",
    },
  );
  expect(result.stderr).toBe("");
  expect(result.status).toBe(17);
});

test("reads real npm custom CA paths with spaces and lifecycle options without treating them as JSON", () => {
  const cafile = path.join(temporary, "custom CA.pem");
  fs.writeFileSync(cafile, [allowed[0], blocked].join("\n"));
  const env = { ...process.env, npm_config_cafile: cafile, npm_config_node_options: "--max-old-space-size=256" };
  for (const key of Object.keys(env)) {
    if (/^(NODE_OPTIONS|SSL_CERT_FILE|SSL_CERT_DIR|NODE_EXTRA_CA_CERTS)$/i.test(key)) delete env[key];
  }
  const result = spawnSync(
    process.execPath,
    [path.join(__dirname, "with-trusted-node.cjs"), "npm", "--no-update-notifier", "--version"],
    { env, encoding: "utf8" },
  );
  expect(result.stderr).toBe("");
  expect(result.status).toBe(0);
  expect(result.stdout.trim()).toMatch(/^\d+\.\d+\.\d+$/);
});
