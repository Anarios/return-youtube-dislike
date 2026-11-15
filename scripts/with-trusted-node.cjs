const fs = require("node:fs");
const path = require("node:path");
const tls = require("node:tls");
const { createHash, X509Certificate } = require("node:crypto");
const { spawnSync } = require("node:child_process");

// Temporary root exclusion until Node releases the intermediate-key blocklist:
// https://github.com/nodejs/node/pull/66871
// https://emudhra.we-have-a-problem.com/roots.json
// https://emudhra.we-have-a-problem.com/impacted-intermediates.json
const BLOCKED_KEYS = new Set([
  "c619e4780ed8e0abeda24ad732567de4383a7ea941338f6d1a7d1b49ac792fe9",
  "0a6c2b2ca5b364207954171987ac9d2178561569d8205457e77ca90c32ede282",
  "bd153ed7b0434f6886b17bce8bbe84ed340c7132d702a8f4fa318f756ecbd6f3",
  "8d417db2dd8bf5e3084d1e3f196d583849d81bdd4c00c70b9d39369e96b8c782",
  "ebed6475c2c2d80fcb199f3fe8dd6e6b3ce60b77eb15d4e42c3dec0c6f5b5105",
  "43bffa19d6ef651451f6841e019931e96f6f2eaeff28ab4b6f1ce4576de2717b",
  "e0254c7fcdc265e2f0f8a428dabb75ab4ae039b4872d62f5ee57f0877d5a8a41",
  "49dd353dc2b919a3770645117d0e60c16115e7d1bc259eefe734b00ea434fe5f",
  "63ecefee431d49523bc1136c4e72d0206a477086caf606cd5cf025686c109cf8",
  "5c0660a2b164910d8ff589c18e14552e9e0ec237dcefe2cb736d41a4811f81a0",
  "ec4ffa1ad0ac88081314b7aaffef6a91f97cd57291bb5ba686c5415f5eb4f6b6",
  "92c063d67e8f14db71d288e11266ffdaf69cbf115f7bab14f3bc2f68d25e0e30",
]);

function filterCertificates(pems) {
  const certificates = new Map();
  for (const pem of pems) {
    const cert = new X509Certificate(pem);
    const keyHash = createHash("sha256")
      .update(cert.publicKey.export({ type: "spki", format: "der" }))
      .digest("hex");
    if (!BLOCKED_KEYS.has(keyHash)) certificates.set(cert.fingerprint256, cert.toString());
  }
  if (!certificates.size) throw new Error("No trusted certificates remain after filtering.");
  return [...certificates.values()].join("\n");
}

function readCertificates(filename) {
  const source = fs.readFileSync(filename, "utf8");
  const certificates = source.match(/-----BEGIN CERTIFICATE-----[\s\S]*?-----END CERTIFICATE-----/g) || [];
  if (!certificates.length || certificates.length !== (source.match(/-----BEGIN CERTIFICATE-----/g) || []).length) {
    throw new Error("A custom CA file contains missing or incomplete PEM certificates.");
  }
  return certificates;
}

function assertSupportedOptions(options = "") {
  if (
    /--(?:no[-_])?(?:use[-_](?:bundled|system|openssl)[-_]ca|openssl[-_](?:config|shared[-_]config)|env[-_]file(?:[-_]if[-_]exists)?|experimental[-_](?:default[-_])?config[-_]file)\b/.test(
      options,
    )
  ) {
    throw new Error("Existing CA-store or configuration-loading options require review before using this wrapper.");
  }
}

function prepareEnvironment(directory, environment = process.env, roots = tls.rootCertificates, npmConfig) {
  const env = { ...environment };
  // Normalize controlled names, including npm's lowercase Windows environment entries.
  for (const key of Object.keys(env)) {
    const normalized = key.toUpperCase();
    if (
      [
        "NODE_OPTIONS",
        "NODE_EXTRA_CA_CERTS",
        "NODE_TLS_REJECT_UNAUTHORIZED",
        "NODE_USE_SYSTEM_CA",
        "SSL_CERT_FILE",
        "SSL_CERT_DIR",
        "OPENSSL_CONF",
      ].includes(normalized)
    ) {
      delete env[key];
      env[normalized] = environment[key];
    }
  }
  assertSupportedOptions(env.NODE_OPTIONS);
  if (env.SSL_CERT_FILE || env.SSL_CERT_DIR || env.OPENSSL_CONF || env.NODE_USE_SYSTEM_CA) {
    throw new Error("Existing system/OpenSSL CA overrides require review before using this wrapper.");
  }
  if (env.NODE_TLS_REJECT_UNAUTHORIZED === "0") throw new Error("TLS verification must remain enabled.");
  const certificates = [...roots];
  if (env.NODE_EXTRA_CA_CERTS) certificates.push(...readCertificates(env.NODE_EXTRA_CA_CERTS));
  const bundle = path.join(directory, "ca.pem");
  fs.writeFileSync(bundle, filterCertificates(certificates), { flag: "wx" });
  fs.mkdirSync(path.join(directory, "empty"));
  env.SSL_CERT_FILE = bundle;
  env.SSL_CERT_DIR = path.join(directory, "empty");
  env.NODE_OPTIONS = `${env.NODE_OPTIONS || ""} --use-openssl-ca`.trim();
  delete env.NODE_EXTRA_CA_CERTS;
  if (npmConfig) {
    if (npmConfig.ca !== null || npmConfig.strictSsl !== true) {
      throw new Error("npm inline CA overrides or disabled TLS verification require review before using this wrapper.");
    }
    assertSupportedOptions(npmConfig.nodeOptions || "");
    for (const key of Object.keys(env)) {
      if (/^npm_config_(ca|cafile|strict_ssl|node_options)$/i.test(key)) delete env[key];
    }
    env.npm_config_strict_ssl = "true";
    env.npm_config_node_options = npmConfig.nodeOptions
      ? `${npmConfig.nodeOptions} --use-openssl-ca`
      : env.NODE_OPTIONS;
    if (npmConfig.cafile) {
      const npmBundle = path.join(directory, "npm-ca.pem");
      fs.writeFileSync(npmBundle, filterCertificates(readCertificates(npmConfig.cafile)), { flag: "wx" });
      env.npm_config_cafile = npmBundle;
    }
  }
  return env;
}

function findNpmCli() {
  const candidates = [
    process.env.npm_execpath,
    path.join(path.dirname(process.execPath), "node_modules/npm/bin/npm-cli.js"),
    path.resolve(path.dirname(process.execPath), "../lib/node_modules/npm/bin/npm-cli.js"),
  ];
  const cli = candidates.find((candidate) => candidate && fs.existsSync(candidate));
  if (!cli) throw new Error("Cannot find the npm CLI alongside the current Node installation.");
  return cli;
}

function readNpmConfig(cli) {
  const config = {};
  for (const [name, key] of [
    ["ca", "ca"],
    ["cafile", "cafile"],
    ["strict-ssl", "strictSsl"],
    ["node-options", "nodeOptions"],
  ]) {
    const result = spawnSync(process.execPath, [cli, "config", "get", name, "--no-update-notifier"], {
      encoding: "utf8",
    });
    if (result.error || result.status !== 0) throw new Error("Could not inspect npm's existing TLS configuration.");
    const value = result.stdout.trim();
    config[key] = name === "strict-ssl" ? value === "true" : value === "null" ? null : value;
  }
  return config;
}

function main(argv = process.argv.slice(2)) {
  const [command, ...args] = argv;
  if (!["node", "npm"].includes(command)) {
    throw new Error("Usage: node scripts/with-trusted-node.cjs <node|npm> [...arguments]");
  }
  assertSupportedOptions(
    [...process.execArgv, ...args]
      .filter((arg) => arg.startsWith("--"))
      .map((arg) => arg.split("=")[0])
      .join(" "),
  );
  if (command === "npm") {
    const options = args.slice(0, args.includes("--") ? args.indexOf("--") : args.length);
    const supported = new Set([
      "--version",
      "-v",
      "--no-audit",
      "--no-fund",
      "--ignore-scripts",
      "--offline",
      "--prefer-offline",
      "--no-update-notifier",
      "--silent",
    ]);
    if (options.some((arg) => arg.startsWith("-") && !supported.has(arg))) {
      throw new Error(
        "Unsupported npm option. Select the project directory and TLS settings before invoking this wrapper.",
      );
    }
  }
  const cli = command === "npm" ? findNpmCli() : null;
  const npmConfig = cli ? readNpmConfig(cli) : null;
  const privateRoot = path.resolve(__dirname, "../.private/node-trust");
  fs.mkdirSync(privateRoot, { recursive: true });
  const directory = fs.mkdtempSync(path.join(privateRoot, "run-"));
  try {
    const env = prepareEnvironment(directory, process.env, tls.rootCertificates, npmConfig);
    const result = spawnSync(process.execPath, cli ? [cli, ...args] : args, { env, stdio: "inherit" });
    if (result.error) throw result.error;
    return result.status === null ? 1 : result.status;
  } finally {
    const resolved = fs.realpathSync(directory);
    if (path.dirname(resolved) !== fs.realpathSync(privateRoot)) throw new Error("Unexpected temporary CA location.");
    fs.rmSync(resolved, { recursive: true, force: true });
  }
}

module.exports = { filterCertificates, readCertificates, prepareEnvironment, main };

if (require.main === module) {
  try {
    process.exitCode = main();
  } catch (error) {
    console.error(`Protected Node command failed: ${error.message}`);
    process.exitCode = 1;
  }
}
