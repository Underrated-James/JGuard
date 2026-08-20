"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __commonJS = (cb, mod) => function __require() {
  return mod || (0, cb[__getOwnPropNames(cb)[0]])((mod = { exports: {} }).exports, mod), mod.exports;
};
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// node_modules/ignore/index.js
var require_ignore = __commonJS({
  "node_modules/ignore/index.js"(exports2, module2) {
    function makeArray(subject) {
      return Array.isArray(subject) ? subject : [subject];
    }
    var UNDEFINED = void 0;
    var EMPTY = "";
    var SPACE = " ";
    var ESCAPE = "\\";
    var REGEX_TEST_BLANK_LINE = /^\s+$/;
    var REGEX_INVALID_TRAILING_BACKSLASH = /(?:[^\\]|^)\\$/;
    var REGEX_REPLACE_LEADING_EXCAPED_EXCLAMATION = /^\\!/;
    var REGEX_REPLACE_LEADING_EXCAPED_HASH = /^\\#/;
    var REGEX_SPLITALL_CRLF = /\r?\n/g;
    var REGEX_TEST_INVALID_PATH = /^\.{0,2}\/|^\.{1,2}$/;
    var REGEX_TEST_TRAILING_SLASH = /\/$/;
    var SLASH = "/";
    var TMP_KEY_IGNORE = "node-ignore";
    if (typeof Symbol !== "undefined") {
      TMP_KEY_IGNORE = Symbol.for("node-ignore");
    }
    var KEY_IGNORE = TMP_KEY_IGNORE;
    var define = (object, key, value) => {
      Object.defineProperty(object, key, { value });
      return value;
    };
    var REGEX_REGEXP_RANGE = /([0-z])-([0-z])/g;
    var RETURN_FALSE = () => false;
    var sanitizeRange = (range) => range.replace(
      REGEX_REGEXP_RANGE,
      (match, from, to) => from.charCodeAt(0) <= to.charCodeAt(0) ? match : EMPTY
    );
    var negateRange = (range) => range.startsWith("!") || range.startsWith("\\^") ? `^${range.slice(range[0] === "!" ? 1 : 2)}` : range;
    var cleanRangeBackSlash = (slashes) => {
      const { length } = slashes;
      return slashes.slice(0, length - length % 2);
    };
    var REPLACERS = [
      [
        // Remove BOM
        // TODO:
        // Other similar zero-width characters?
        /^\uFEFF/,
        () => EMPTY
      ],
      // > Trailing spaces are ignored unless they are quoted with backslash ("\")
      [
        // (a\ ) -> (a )
        // (a  ) -> (a)
        // (a ) -> (a)
        // (a \ ) -> (a  )
        /((?:\\\\)*?)(\\?\s+)$/,
        (_, m1, m2) => m1 + (m2.indexOf("\\") === 0 ? SPACE : EMPTY)
      ],
      // Replace (\ ) with ' '
      // (\ ) -> ' '
      // (\\ ) -> '\\ '
      // (\\\ ) -> '\\ '
      [
        /(\\+?)\s/g,
        (_, m1) => {
          const { length } = m1;
          return m1.slice(0, length - length % 2) + SPACE;
        }
      ],
      // Escape metacharacters
      // which is written down by users but means special for regular expressions.
      // > There are 12 characters with special meanings:
      // > - the backslash \,
      // > - the caret ^,
      // > - the dollar sign $,
      // > - the period or dot .,
      // > - the vertical bar or pipe symbol |,
      // > - the question mark ?,
      // > - the asterisk or star *,
      // > - the plus sign +,
      // > - the opening parenthesis (,
      // > - the closing parenthesis ),
      // > - and the opening square bracket [,
      // > - the opening curly brace {,
      // > These special characters are often called "metacharacters".
      [
        /[\\$.|*+(){^]/g,
        (match) => `\\${match}`
      ],
      [
        // > a question mark (?) matches a single character
        /(?!\\)\?/g,
        () => "[^/]"
      ],
      // leading slash
      [
        // > A leading slash matches the beginning of the pathname.
        // > For example, "/*.c" matches "cat-file.c" but not "mozilla-sha1/sha1.c".
        // A leading slash matches the beginning of the pathname
        /^\//,
        () => "^"
      ],
      // replace special metacharacter slash after the leading slash
      [
        /\//g,
        () => "\\/"
      ],
      [
        // > A leading "**" followed by a slash means match in all directories.
        // > For example, "**/foo" matches file or directory "foo" anywhere,
        // > the same as pattern "foo".
        // > "**/foo/bar" matches file or directory "bar" anywhere that is directly
        // >   under directory "foo".
        // Notice that the '*'s have been replaced as '\\*'
        /^\^*(?:\\\*\\\*\\\/)+/,
        // '**/foo' <-> 'foo'
        () => "^(?:.*\\/)?"
      ],
      // starting
      [
        // there will be no leading '/'
        //   (which has been replaced by section "leading slash")
        // If starts with '**', adding a '^' to the regular expression also works
        /^(?=[^^])/,
        function startingReplacer() {
          return !/\/(?!$)/.test(this) ? "(?:^|\\/)" : "^";
        }
      ],
      // two globstars
      [
        // Use lookahead assertions so that we could match more than one `'/**'`
        /\\\/\\\*\\\*(?=\\\/|$)/g,
        // Zero, one or several directories
        // should not use '*', or it will be replaced by the next replacer
        // Check if it is not the last `'/**'`
        (_, index, str) => index + 6 < str.length ? "(?:\\/[^\\/]+)*" : "\\/.+"
      ],
      // normal intermediate wildcards
      [
        // Never replace escaped '*'
        // ignore rule '\*' will match the path '*'
        // 'abc.*/' -> go
        // 'abc.*'  -> skip this rule,
        //    coz trailing single wildcard will be handed by [trailing wildcard]
        /(^|[^\\]+)(\\\*)+(?=.+)/g,
        // '*.js' matches '.js'
        // '*.js' doesn't match 'abc'
        (_, p1, p2) => {
          const unescaped = p2.replace(/\\\*/g, "[^\\/]*");
          return p1 + unescaped;
        }
      ],
      [
        // unescape, revert step 3 except for back slash
        // For example, if a user escape a '\\*',
        // after step 3, the result will be '\\\\\\*'
        /\\\\\\(?=[$.|*+(){^])/g,
        () => ESCAPE
      ],
      [
        // '\\\\' -> '\\'
        /\\\\/g,
        () => ESCAPE
      ],
      [
        // > The range notation, e.g. [a-zA-Z],
        // > can be used to match one of the characters in a range.
        // `\` is escaped by step 3
        /(\\)?\[([^\]/]*?)(\\*)($|\])/g,
        (match, leadEscape, range, endEscape, close) => leadEscape === ESCAPE ? `\\[${range}${cleanRangeBackSlash(endEscape)}${close}` : close === "]" ? endEscape.length % 2 === 0 ? `[${negateRange(sanitizeRange(range))}${endEscape}]` : "[]" : "[]"
      ],
      // ending
      [
        // 'js' will not match 'js.'
        // 'ab' will not match 'abc'
        /(?:[^*])$/,
        // WTF!
        // https://git-scm.com/docs/gitignore
        // changes in [2.22.1](https://git-scm.com/docs/gitignore/2.22.1)
        // which re-fixes #24, #38
        // > If there is a separator at the end of the pattern then the pattern
        // > will only match directories, otherwise the pattern can match both
        // > files and directories.
        // 'js*' will not match 'a.js'
        // 'js/' will not match 'a.js'
        // 'js' will match 'a.js' and 'a.js/'
        (match) => /\/$/.test(match) ? `${match}$` : `${match}(?=$|\\/$)`
      ]
    ];
    var REGEX_REPLACE_TRAILING_WILDCARD = /(^|\\\/)?\\\*$/;
    var MODE_IGNORE = "regex";
    var MODE_CHECK_IGNORE = "checkRegex";
    var UNDERSCORE = "_";
    var TRAILING_WILD_CARD_REPLACERS = {
      [MODE_IGNORE](_, p1) {
        const prefix = p1 ? `${p1}[^/]+` : "[^/]*";
        return `${prefix}(?=$|\\/$)`;
      },
      [MODE_CHECK_IGNORE](_, p1) {
        const prefix = p1 ? `${p1}[^/]*` : "[^/]*";
        return `${prefix}(?=$|\\/$)`;
      }
    };
    var makeRegexPrefix = (pattern) => REPLACERS.reduce(
      (prev, [matcher, replacer]) => prev.replace(matcher, replacer.bind(pattern)),
      pattern
    );
    var isString = (subject) => typeof subject === "string";
    var checkPattern = (pattern) => pattern && isString(pattern) && !REGEX_TEST_BLANK_LINE.test(pattern) && !REGEX_INVALID_TRAILING_BACKSLASH.test(pattern) && pattern.indexOf("#") !== 0;
    var splitPattern = (pattern) => pattern.split(REGEX_SPLITALL_CRLF).filter(Boolean);
    var IgnoreRule = class {
      constructor(pattern, mark, body, ignoreCase, negative, prefix) {
        this.pattern = pattern;
        this.mark = mark;
        this.negative = negative;
        define(this, "body", body);
        define(this, "ignoreCase", ignoreCase);
        define(this, "regexPrefix", prefix);
      }
      get regex() {
        const key = UNDERSCORE + MODE_IGNORE;
        if (this[key]) {
          return this[key];
        }
        return this._make(MODE_IGNORE, key);
      }
      get checkRegex() {
        const key = UNDERSCORE + MODE_CHECK_IGNORE;
        if (this[key]) {
          return this[key];
        }
        return this._make(MODE_CHECK_IGNORE, key);
      }
      _make(mode, key) {
        const str = this.regexPrefix.replace(
          REGEX_REPLACE_TRAILING_WILDCARD,
          // It does not need to bind pattern
          TRAILING_WILD_CARD_REPLACERS[mode]
        );
        const regex = this.ignoreCase ? new RegExp(str, "i") : new RegExp(str);
        return define(this, key, regex);
      }
    };
    var createRule = ({
      pattern,
      mark
    }, ignoreCase) => {
      let negative = false;
      let body = pattern;
      if (body.indexOf("!") === 0) {
        negative = true;
        body = body.substr(1);
      }
      body = body.replace(REGEX_REPLACE_LEADING_EXCAPED_EXCLAMATION, "!").replace(REGEX_REPLACE_LEADING_EXCAPED_HASH, "#");
      const regexPrefix = makeRegexPrefix(body);
      return new IgnoreRule(
        pattern,
        mark,
        body,
        ignoreCase,
        negative,
        regexPrefix
      );
    };
    var RuleManager = class {
      constructor(ignoreCase) {
        this._ignoreCase = ignoreCase;
        this._rules = [];
      }
      _add(pattern) {
        if (pattern && pattern[KEY_IGNORE]) {
          this._rules = this._rules.concat(pattern._rules._rules);
          this._added = true;
          return;
        }
        if (isString(pattern)) {
          pattern = {
            pattern
          };
        }
        if (checkPattern(pattern.pattern)) {
          const rule = createRule(pattern, this._ignoreCase);
          this._added = true;
          this._rules.push(rule);
        }
      }
      // @param {Array<string> | string | Ignore} pattern
      add(pattern) {
        this._added = false;
        makeArray(
          isString(pattern) ? splitPattern(pattern) : pattern
        ).forEach(this._add, this);
        return this._added;
      }
      // Test one single path without recursively checking parent directories
      //
      // - checkUnignored `boolean` whether should check if the path is unignored,
      //   setting `checkUnignored` to `false` could reduce additional
      //   path matching.
      // - check `string` either `MODE_IGNORE` or `MODE_CHECK_IGNORE`
      // @returns {TestResult} true if a file is ignored
      test(path19, checkUnignored, mode) {
        let ignored = false;
        let unignored = false;
        let matchedRule;
        this._rules.forEach((rule) => {
          const { negative } = rule;
          if (unignored === negative && ignored !== unignored || negative && !ignored && !unignored && !checkUnignored) {
            return;
          }
          const matched = rule[mode].test(path19);
          if (!matched) {
            return;
          }
          ignored = !negative;
          unignored = negative;
          matchedRule = negative ? UNDEFINED : rule;
        });
        const ret = {
          ignored,
          unignored
        };
        if (matchedRule) {
          ret.rule = matchedRule;
        }
        return ret;
      }
    };
    var throwError = (message, Ctor) => {
      throw new Ctor(message);
    };
    var checkPath = (path19, originalPath, doThrow) => {
      if (!isString(path19)) {
        return doThrow(
          `path must be a string, but got \`${originalPath}\``,
          TypeError
        );
      }
      if (!path19) {
        return doThrow(`path must not be empty`, TypeError);
      }
      if (checkPath.isNotRelative(path19)) {
        const r = "`path.relative()`d";
        return doThrow(
          `path should be a ${r} string, but got "${originalPath}"`,
          RangeError
        );
      }
      return true;
    };
    var isNotRelative = (path19) => REGEX_TEST_INVALID_PATH.test(path19);
    checkPath.isNotRelative = isNotRelative;
    checkPath.convert = (p) => p;
    var Ignore2 = class {
      constructor({
        ignorecase = true,
        ignoreCase = ignorecase,
        allowRelativePaths = false
      } = {}) {
        define(this, KEY_IGNORE, true);
        this._rules = new RuleManager(ignoreCase);
        this._strictPathCheck = !allowRelativePaths;
        this._initCache();
      }
      _initCache() {
        this._ignoreCache = /* @__PURE__ */ Object.create(null);
        this._testCache = /* @__PURE__ */ Object.create(null);
      }
      add(pattern) {
        if (this._rules.add(pattern)) {
          this._initCache();
        }
        return this;
      }
      // legacy
      addPattern(pattern) {
        return this.add(pattern);
      }
      // @returns {TestResult}
      _test(originalPath, cache, checkUnignored, slices) {
        const path19 = originalPath && checkPath.convert(originalPath);
        checkPath(
          path19,
          originalPath,
          this._strictPathCheck ? throwError : RETURN_FALSE
        );
        return this._t(path19, cache, checkUnignored, slices);
      }
      checkIgnore(path19) {
        if (!REGEX_TEST_TRAILING_SLASH.test(path19)) {
          return this.test(path19);
        }
        const slices = path19.split(SLASH).filter(Boolean);
        slices.pop();
        if (slices.length) {
          const parent = this._t(
            slices.join(SLASH) + SLASH,
            this._testCache,
            true,
            slices
          );
          if (parent.ignored) {
            return parent;
          }
        }
        return this._rules.test(path19, false, MODE_CHECK_IGNORE);
      }
      _t(path19, cache, checkUnignored, slices) {
        if (path19 in cache) {
          return cache[path19];
        }
        if (!slices) {
          slices = path19.split(SLASH).filter(Boolean);
        }
        slices.pop();
        if (!slices.length) {
          return cache[path19] = this._rules.test(path19, checkUnignored, MODE_IGNORE);
        }
        const parent = this._t(
          slices.join(SLASH) + SLASH,
          cache,
          checkUnignored,
          slices
        );
        return cache[path19] = parent.ignored ? parent : this._rules.test(path19, checkUnignored, MODE_IGNORE);
      }
      ignores(path19) {
        return this._test(path19, this._ignoreCache, false).ignored;
      }
      createFilter() {
        return (path19) => !this.ignores(path19);
      }
      filter(paths) {
        return makeArray(paths).filter(this.createFilter());
      }
      // @returns {TestResult}
      test(path19) {
        return this._test(path19, this._testCache, true);
      }
    };
    var factory = (options) => new Ignore2(options);
    var isPathValid = (path19) => checkPath(path19 && checkPath.convert(path19), path19, RETURN_FALSE);
    var setupWindows = () => {
      const makePosix = (str) => /^\\\\\?\\/.test(str) || /["<>|\u0000-\u001F]+/u.test(str) ? str : str.replace(/\\/g, "/");
      checkPath.convert = makePosix;
      const REGEX_TEST_WINDOWS_PATH_ABSOLUTE = /^[a-z]:\//i;
      checkPath.isNotRelative = (path19) => REGEX_TEST_WINDOWS_PATH_ABSOLUTE.test(path19) || isNotRelative(path19);
    };
    if (
      // Detect `process` so that it can run in browsers.
      typeof process !== "undefined" && process.platform === "win32"
    ) {
      setupWindows();
    }
    module2.exports = factory;
    factory.default = factory;
    module2.exports.isPathValid = isPathValid;
    define(module2.exports, Symbol.for("setupWindows"), setupWindows);
  }
});

// src/extension.ts
var extension_exports = {};
__export(extension_exports, {
  activate: () => activate,
  deactivate: () => deactivate
});
module.exports = __toCommonJS(extension_exports);
var vscode12 = __toESM(require("vscode"));

// src/storage/MetadataStore.ts
var fs = __toESM(require("fs/promises"));
var path = __toESM(require("path"));
var MetadataStore = class {
  constructor(storageBaseDir) {
    this.storageBaseDir = storageBaseDir;
  }
  getCheckpointsDir() {
    return path.join(this.storageBaseDir, "checkpoints");
  }
  getSessionsDir() {
    return path.join(this.storageBaseDir, "sessions");
  }
  getCheckpointPath(id) {
    return path.join(this.getCheckpointsDir(), `${id}.json`);
  }
  getSessionPath(id) {
    return path.join(this.getSessionsDir(), `${id}.json`);
  }
  /**
   * Initializes the directory structure.
   */
  async initialize() {
    await fs.mkdir(this.getCheckpointsDir(), { recursive: true });
    await fs.mkdir(this.getSessionsDir(), { recursive: true });
  }
  /**
   * Writes a checkpoint to disk atomically.
   * @param id The checkpoint ID.
   * @param checkpoint The checkpoint data.
   */
  async write(id, checkpoint) {
    const cpPath = this.getCheckpointPath(id);
    const tmpPath = `${cpPath}.tmp.${Date.now()}`;
    await fs.writeFile(tmpPath, JSON.stringify(checkpoint, null, 2), "utf-8");
    await fs.rename(tmpPath, cpPath);
  }
  /**
   * Reads a checkpoint from disk.
   * @param id The checkpoint ID.
   * @returns The checkpoint data.
   */
  async read(id) {
    const cpPath = this.getCheckpointPath(id);
    const content = await fs.readFile(cpPath, "utf-8");
    return JSON.parse(content);
  }
  /**
   * Deletes a checkpoint from disk.
   * @param id The checkpoint ID.
   */
  async delete(id) {
    const cpPath = this.getCheckpointPath(id);
    try {
      await fs.unlink(cpPath);
    } catch (err) {
      if (err.code !== "ENOENT") {
        throw err;
      }
    }
  }
  /**
   * L1: Writes a checkpoint session to disk atomically.
   */
  async writeSession(id, session) {
    const sessionPath = this.getSessionPath(id);
    const tmpPath = `${sessionPath}.tmp.${Date.now()}`;
    await fs.writeFile(tmpPath, JSON.stringify(session, null, 2), "utf-8");
    await fs.rename(tmpPath, sessionPath);
  }
  /**
   * L1: Reads a checkpoint session from disk.
   */
  async readSession(id) {
    const sessionPath = this.getSessionPath(id);
    const content = await fs.readFile(sessionPath, "utf-8");
    return JSON.parse(content);
  }
  /**
   * L1: Deletes a checkpoint session from disk.
   */
  async deleteSession(id) {
    const sessionPath = this.getSessionPath(id);
    try {
      await fs.unlink(sessionPath);
    } catch (err) {
      if (err.code !== "ENOENT") {
        throw err;
      }
    }
  }
  /**
   * Lists all checkpoint IDs.
   */
  async listCheckpoints() {
    try {
      const files = await fs.readdir(this.getCheckpointsDir());
      return files.filter((f) => f.endsWith(".json")).map((f) => f.replace(".json", ""));
    } catch {
      return [];
    }
  }
  /**
   * Lists all session IDs.
   */
  async listSessions() {
    try {
      const files = await fs.readdir(this.getSessionsDir());
      return files.filter((f) => f.endsWith(".json")).map((f) => f.replace(".json", ""));
    } catch {
      return [];
    }
  }
};

// src/storage/ObjectStore.ts
var fs3 = __toESM(require("fs/promises"));
var path3 = __toESM(require("path"));

// src/core/Hasher.ts
var crypto = __toESM(require("crypto"));
var fs2 = __toESM(require("fs"));

// src/core/ContentNormalizer.ts
var path2 = __toESM(require("path"));
var ContentNormalizer = class {
  // A simple list of common text extensions. 
  // In a full implementation, we might use is-binary-path.
  static textExtensions = /* @__PURE__ */ new Set([
    ".ts",
    ".js",
    ".json",
    ".md",
    ".txt",
    ".csv",
    ".html",
    ".css",
    ".scss",
    ".xml",
    ".yml",
    ".yaml",
    ".toml",
    ".ini",
    ".sh",
    ".bat",
    ".ps1"
  ]);
  /**
   * Checks if a file is likely text based on its extension.
   */
  static isTextFile(filePath) {
    const ext = path2.extname(filePath).toLowerCase();
    return this.textExtensions.has(ext);
  }
  /**
   * Normalizes CRLF to LF in a buffer if it's a text file.
   * If it's a binary file, returns the buffer unmodified.
   */
  static normalize(buffer, filePath) {
    if (!this.isTextFile(filePath)) {
      return buffer;
    }
    const text = buffer.toString("utf-8");
    if (text.indexOf("\0") !== -1) {
      return buffer;
    }
    const normalizedText = text.replace(/\r\n/g, "\n");
    return Buffer.from(normalizedText, "utf-8");
  }
  /**
   * Creates a Transform stream that normalizes CRLF to LF on the fly.
   * Not fully implemented here for brevity, but this is where a streaming normalizer would go.
   */
};

// src/core/Hasher.ts
var Hasher = class {
  /**
   * Computes the SHA-256 hash of a file using streams to handle large files efficiently.
   * L7: Now buffers and normalizes text files to LF to avoid cross-OS hash mismatches.
   * @param absolutePath The absolute path to the file.
   * @returns A promise that resolves to the hex representation of the SHA-256 hash.
   */
  static hashFile(absolutePath) {
    return new Promise((resolve, reject) => {
      if (ContentNormalizer.isTextFile(absolutePath)) {
        fs2.readFile(absolutePath, (err, data) => {
          if (err) {
            reject(err);
            return;
          }
          const normalized = ContentNormalizer.normalize(data, absolutePath);
          const hash2 = crypto.createHash("sha256");
          hash2.update(normalized);
          resolve(hash2.digest("hex"));
        });
        return;
      }
      const hash = crypto.createHash("sha256");
      const stream = fs2.createReadStream(absolutePath);
      stream.on("data", (chunk) => {
        hash.update(chunk);
      });
      stream.on("end", () => {
        resolve(hash.digest("hex"));
      });
      stream.on("error", (err) => {
        reject(err);
      });
    });
  }
  /**
   * Computes the SHA-256 hash of a buffer.
   * @param content The buffer to hash.
   * @param filePath Optional filepath to determine if normalization is needed.
   * @returns The hex representation of the SHA-256 hash.
   */
  static hashBuffer(content, filePath) {
    const buffer = Buffer.isBuffer(content) ? content : Buffer.from(content);
    const finalBuffer = filePath ? ContentNormalizer.normalize(buffer, filePath) : buffer;
    const hash = crypto.createHash("sha256");
    hash.update(finalBuffer);
    return hash.digest("hex");
  }
};

// src/storage/ObjectStore.ts
var ObjectStore = class {
  constructor(storageBaseDir) {
    this.storageBaseDir = storageBaseDir;
  }
  getObjectDir(hash) {
    return path3.join(this.storageBaseDir, "objects", hash.substring(0, 2));
  }
  getObjectPath(hash) {
    return path3.join(this.getObjectDir(hash), hash);
  }
  /**
   * Initializes the object store directory structure.
   */
  async initialize() {
    const objectsDir = path3.join(this.storageBaseDir, "objects");
    await fs3.mkdir(objectsDir, { recursive: true });
  }
  /**
   * Writes content to the object store if it doesn't already exist.
   * L7: Normalizes text files to LF to avoid cross-OS discrepancies.
   * @param content The content to write.
   * @param filePath Optional filepath to determine if it's text.
   * @returns The SHA-256 hash of the content.
   */
  async write(content, filePath) {
    const buffer = Buffer.isBuffer(content) ? content : Buffer.from(content);
    const finalContent = filePath ? ContentNormalizer.normalize(buffer, filePath) : buffer;
    const hash = Hasher.hashBuffer(finalContent);
    const objPath = this.getObjectPath(hash);
    const objDir = this.getObjectDir(hash);
    try {
      await fs3.stat(objPath);
      return hash;
    } catch {
    }
    await fs3.mkdir(objDir, { recursive: true });
    const tmpPath = `${objPath}.tmp.${Date.now()}.${Math.random().toString(36).substring(2)}`;
    await fs3.writeFile(tmpPath, finalContent);
    await fs3.rename(tmpPath, objPath);
    return hash;
  }
  /**
   * Reads content from the object store.
   * @param hash The SHA-256 hash of the object.
   * @returns The content buffer.
   */
  async read(hash) {
    const objPath = this.getObjectPath(hash);
    return await fs3.readFile(objPath);
  }
  /**
   * Checks if an object exists in the store.
   * @param hash The SHA-256 hash of the object.
   */
  async exists(hash) {
    const objPath = this.getObjectPath(hash);
    try {
      await fs3.stat(objPath);
      return true;
    } catch {
      return false;
    }
  }
  /**
   * Deletes an object from the store.
   * @param hash The SHA-256 hash of the object.
   */
  async delete(hash) {
    const objPath = this.getObjectPath(hash);
    try {
      await fs3.unlink(objPath);
    } catch (err) {
      if (err.code !== "ENOENT") {
        throw err;
      }
    }
  }
};

// src/application/CheckpointService.ts
var path5 = __toESM(require("path"));
var fs5 = __toESM(require("fs/promises"));

// src/application/BlobGarbageCollector.ts
var fs4 = __toESM(require("fs/promises"));
var path4 = __toESM(require("path"));
var BlobGarbageCollector = class {
  constructor(metadataStore, objectStore, storageBaseDir) {
    this.metadataStore = metadataStore;
    this.objectStore = objectStore;
    this.storageBaseDir = storageBaseDir;
  }
  /**
   * Performs Mark-and-Sweep garbage collection on the ObjectStore.
   * Scans all CheckpointSessions to find reachable object hashes,
   * then deletes any objects in the ObjectStore that are not reachable.
   * L4: Prevents disk leak by removing orphaned blobs from rejected or deleted sessions.
   */
  async run() {
    const reachableHashes = /* @__PURE__ */ new Set();
    const sessionIds = await this.metadataStore.listSessions();
    for (const sessionId of sessionIds) {
      try {
        const session = await this.metadataStore.readSession(sessionId);
        for (const checkpoint of Object.values(session.folderCheckpoints)) {
          for (const snapshot of Object.values(checkpoint.files)) {
            reachableHashes.add(snapshot.hash);
          }
        }
        if (session.uiState?.aiSnapshotHashes) {
          for (const hash of Object.values(session.uiState.aiSnapshotHashes)) {
            reachableHashes.add(hash);
          }
        }
      } catch (err) {
        console.error(`GC: Failed to read session ${sessionId}`, err);
      }
    }
    const checkpointIds = await this.metadataStore.listCheckpoints();
    for (const cpId of checkpointIds) {
      try {
        const cp = await this.metadataStore.read(cpId);
        for (const snapshot of Object.values(cp.files)) {
          reachableHashes.add(snapshot.hash);
        }
      } catch (err) {
      }
    }
    let deletedCount = 0;
    let bytesFreed = 0;
    const objectsDir = path4.join(this.storageBaseDir, "objects");
    try {
      const prefixDirs = await fs4.readdir(objectsDir);
      for (const prefix of prefixDirs) {
        const prefixDirPath = path4.join(objectsDir, prefix);
        const stat5 = await fs4.stat(prefixDirPath);
        if (!stat5.isDirectory())
          continue;
        const objectHashes = await fs4.readdir(prefixDirPath);
        for (const hash of objectHashes) {
          if (!reachableHashes.has(hash)) {
            const objPath = path4.join(prefixDirPath, hash);
            try {
              const objStat = await fs4.stat(objPath);
              await fs4.unlink(objPath);
              deletedCount++;
              bytesFreed += objStat.size;
            } catch (err) {
              console.error(`GC: Failed to delete object ${hash}`, err);
            }
          }
        }
      }
    } catch (err) {
      if (err.code !== "ENOENT") {
        throw err;
      }
    }
    return { deletedCount, bytesFreed };
  }
};

// src/application/CheckpointService.ts
var CheckpointService = class {
  constructor(metadataStore, objectStore, scanner, workspaceRoot) {
    this.metadataStore = metadataStore;
    this.objectStore = objectStore;
    this.scanner = scanner;
    this.workspaceRoot = workspaceRoot;
  }
  gcEnabled = true;
  setGCEnabled(enabled) {
    this.gcEnabled = enabled;
  }
  /**
   * Generates a simple unique ID (ulid alternative)
   */
  generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substring(2);
  }
  /**
   * Helper to detect binary files (simple check for MVP)
   */
  isBinary(content) {
    const len = Math.min(content.length, 8192);
    for (let i = 0; i < len; i++) {
      if (content[i] === 0)
        return true;
    }
    return false;
  }
  /**
   * L1: Creates a CheckpointSession spanning all workspace folders.
   * Each folder gets its own Checkpoint, sharing the same ObjectStore.
   * 
   * @param workspaceId The unique ID of the workspace.
   * @param workspaceFolders Array of workspace folder paths. If empty/undefined, falls back to this.workspaceRoot.
   * @param onProgress Optional progress callback: (processedFiles, totalFiles) => void
   * @returns The created CheckpointSession.
   */
  async createSession(workspaceId, workspaceFolders, onProgress) {
    const sessionId = this.generateId();
    const folderCheckpoints = {};
    const folders = workspaceFolders && workspaceFolders.length > 0 ? workspaceFolders : [this.workspaceRoot];
    for (const folderRoot of folders) {
      const cp = await this.createCheckpointForFolder(workspaceId, folderRoot, onProgress);
      folderCheckpoints[folderRoot] = cp;
    }
    const session = {
      id: sessionId,
      createdAt: Date.now(),
      folderCheckpoints,
      status: "active"
    };
    await this.metadataStore.writeSession(sessionId, session);
    const lockFile = path5.join(this.metadataStore.storageBaseDir, "jguard.lock");
    await fs5.writeFile(lockFile, sessionId, "utf-8");
    this.cleanOldCheckpoints().catch(console.error);
    return session;
  }
  /**
   * L1: Creates a single checkpoint for one workspace folder.
   * L4: Uses batched parallel processing for I/O throughput.
   *
   * @param workspaceId The workspace ID.
   * @param folderRoot Absolute path to the workspace folder.
   * @param onProgress Optional progress callback.
   */
  async createCheckpointForFolder(workspaceId, folderRoot, onProgress) {
    const id = this.generateId();
    const files = {};
    const paths = await this.scanner.scan();
    const entries = [...paths.entries()];
    const totalFiles = entries.length;
    const BATCH_SIZE = 50;
    let processed = 0;
    for (let i = 0; i < entries.length; i += BATCH_SIZE) {
      const batch = entries.slice(i, i + BATCH_SIZE);
      const results = await Promise.all(
        batch.map(async ([relPath, meta]) => {
          const absPath = path5.join(folderRoot, relPath);
          const content = await fs5.readFile(absPath);
          const hash = await this.objectStore.write(content, absPath);
          return { relPath, hash, meta, isBinary: this.isBinary(content) };
        })
      );
      for (const r of results) {
        files[r.relPath] = {
          hash: r.hash,
          size: r.meta.size,
          mtime: r.meta.mtime,
          isBinary: r.isBinary
        };
      }
      processed += batch.length;
      if (onProgress) {
        onProgress(processed, totalFiles);
      }
    }
    const checkpoint = {
      id,
      workspaceId,
      createdAt: Date.now(),
      status: "active",
      files,
      workspaceRoot: folderRoot
    };
    await this.metadataStore.write(id, checkpoint);
    return checkpoint;
  }
  /**
   * Creates a new checkpoint of the current workspace state (legacy single-root API).
   * Now delegates to createSession internally but returns a single Checkpoint for compatibility.
   *
   * @param workspaceId The unique ID of the workspace.
   * @param onProgress Optional progress callback.
   * @returns The created checkpoint.
   */
  async createCheckpoint(workspaceId, onProgress) {
    const id = this.generateId();
    const files = {};
    const paths = await this.scanner.scan();
    const entries = [...paths.entries()];
    const totalFiles = entries.length;
    const BATCH_SIZE = 50;
    let processed = 0;
    for (let i = 0; i < entries.length; i += BATCH_SIZE) {
      const batch = entries.slice(i, i + BATCH_SIZE);
      const results = await Promise.all(
        batch.map(async ([relPath, meta]) => {
          const absPath = path5.join(this.workspaceRoot, relPath);
          const content = await fs5.readFile(absPath);
          const hash = await this.objectStore.write(content);
          return { relPath, hash, meta, isBinary: this.isBinary(content) };
        })
      );
      for (const r of results) {
        files[r.relPath] = {
          hash: r.hash,
          size: r.meta.size,
          mtime: r.meta.mtime,
          isBinary: r.isBinary
        };
      }
      processed += batch.length;
      if (onProgress) {
        onProgress(processed, totalFiles);
      }
    }
    const checkpoint = {
      id,
      workspaceId,
      createdAt: Date.now(),
      status: "active",
      files,
      workspaceRoot: this.workspaceRoot
    };
    await this.metadataStore.write(id, checkpoint);
    const lockFile = path5.join(this.metadataStore.storageBaseDir, "jguard.lock");
    await fs5.writeFile(lockFile, id, "utf-8");
    this.cleanOldCheckpoints().catch(console.error);
    return checkpoint;
  }
  /**
   * L7: Updates an existing checkpoint in the metadata store.
   */
  async updateCheckpoint(checkpoint) {
    await this.metadataStore.write(checkpoint.id, checkpoint);
  }
  /**
   * L7: Updates an existing session in the metadata store.
   */
  async updateSession(session) {
    await this.metadataStore.writeSession(session.id, session);
  }
  /**
   * Reads a checkpoint by ID from the metadata store.
   */
  async readCheckpoint(id) {
    return this.metadataStore.read(id);
  }
  /**
   * Cleans up old checkpoints, keeping only the most recent ones.
   * L7: Respects grace period — doesn't GC recently finalized checkpoints.
   */
  async cleanOldCheckpoints(keepCount = 3) {
    const GRACE_PERIOD = 5 * 60 * 1e3;
    const now = Date.now();
    const checkpointsDir = this.metadataStore.getCheckpointsDir();
    try {
      const dirFiles = await fs5.readdir(checkpointsDir);
      const cpFiles = dirFiles.filter((f) => f.endsWith(".json"));
      const checkpoints = [];
      for (const f of cpFiles) {
        const id = f.replace(".json", "");
        const cp = await this.metadataStore.read(id);
        checkpoints.push({ id, createdAt: cp.createdAt, status: cp.status, finalizedAt: cp.finalizedAt });
      }
      checkpoints.sort((a, b) => b.createdAt - a.createdAt);
      const deletable = checkpoints.filter((cp) => {
        if (cp.status === "active") {
          return false;
        }
        if (cp.finalizedAt && now - cp.finalizedAt < GRACE_PERIOD) {
          return false;
        }
        return true;
      });
      for (let i = keepCount; i < deletable.length; i++) {
        await this.metadataStore.delete(deletable[i].id);
        await this.metadataStore.deleteSession(deletable[i].id);
      }
      if (this.gcEnabled) {
        const storageBaseDir = this.metadataStore.storageBaseDir;
        const gc = new BlobGarbageCollector(this.metadataStore, this.objectStore, storageBaseDir);
        const { deletedCount, bytesFreed } = await gc.run();
        if (deletedCount > 0) {
          console.log(`JGuard GC: Deleted ${deletedCount} orphaned blobs, freed ${(bytesFreed / 1024 / 1024).toFixed(2)} MB`);
        }
      }
    } catch (e) {
      console.error("GC error", e);
    }
  }
  /**
   * Manually clears old finalized sessions from history, keeping only the 3 most recent ones.
   */
  async clearOldHistory(keepCount = 3) {
    try {
      const sessionIds = await this.metadataStore.listSessions();
      const sessions = [];
      for (const id of sessionIds) {
        try {
          const session = await this.metadataStore.readSession(id);
          sessions.push(session);
        } catch (e) {
          console.error(`Failed to read session ${id}`, e);
        }
      }
      sessions.sort((a, b) => b.createdAt - a.createdAt);
      const finalized = sessions.filter((session) => session.status !== "active");
      let deletedCount = 0;
      for (let i = keepCount; i < finalized.length; i++) {
        await this.deleteHistorySessionInternal(finalized[i].id);
        deletedCount++;
      }
      if (this.gcEnabled && deletedCount > 0) {
        const storageBaseDir = this.metadataStore.storageBaseDir;
        const gc = new BlobGarbageCollector(this.metadataStore, this.objectStore, storageBaseDir);
        const gcResult = await gc.run();
        console.log(`JGuard Manual GC: Deleted ${gcResult.deletedCount} orphaned blobs, freed ${(gcResult.bytesFreed / 1024 / 1024).toFixed(2)} MB`);
      }
    } catch (e) {
      console.error("Failed to clear history", e);
      throw e;
    }
  }
  /**
   * Internal helper that deletes a session without running GC, so we can bulk delete efficiently.
   */
  async deleteHistorySessionInternal(sessionId) {
    const cp = await this.metadataStore.readSession(sessionId);
    if (cp.folderCheckpoints) {
      for (const checkpoint of Object.values(cp.folderCheckpoints)) {
        await this.metadataStore.delete(checkpoint.id);
      }
    }
    await this.metadataStore.deleteSession(sessionId);
  }
  /**
   * Deletes a specific finalized session from history.
   */
  async deleteHistorySession(sessionId) {
    try {
      await this.deleteHistorySessionInternal(sessionId);
      if (this.gcEnabled) {
        const storageBaseDir = this.metadataStore.storageBaseDir;
        const gc = new BlobGarbageCollector(this.metadataStore, this.objectStore, storageBaseDir);
        const gcResult = await gc.run();
        console.log(`JGuard: Deleted specific session ${sessionId}. GC freed ${(gcResult.bytesFreed / 1024 / 1024).toFixed(2)} MB`);
      }
    } catch (e) {
      console.error(`Failed to delete session ${sessionId}`, e);
      throw e;
    }
  }
};

// src/application/RestoreService.ts
var fs6 = __toESM(require("fs/promises"));
var RestoreService = class {
  constructor(objectStore) {
    this.objectStore = objectStore;
  }
  /**
   * Executes a restore plan safely.
   * @param plan The restore plan to execute.
   * @throws If a safety check fails during execution.
   */
  async execute(plan) {
    for (const op of plan.operations) {
      if (op.type === "write") {
        if (!op.objectHash)
          throw new Error("Write operation missing objectHash");
        const content = await this.objectStore.read(op.objectHash);
        const verifiedHash = Hasher.hashBuffer(content);
        if (verifiedHash !== op.objectHash) {
          throw new Error(`Hash mismatch during restore of ${op.relativePath}`);
        }
        try {
          const vscode13 = require("vscode");
          await vscode13.workspace.fs.writeFile(vscode13.Uri.file(op.absolutePath), content);
        } catch (e) {
          await fs6.writeFile(op.absolutePath, content);
        }
      } else if (op.type === "delete") {
        try {
          try {
            const vscode13 = require("vscode");
            await vscode13.workspace.fs.delete(vscode13.Uri.file(op.absolutePath), { useTrash: false });
          } catch (e) {
            await fs6.unlink(op.absolutePath);
          }
        } catch (err) {
          if (err.code !== "ENOENT" && err.name !== "EntryNotFound (FileSystemError)") {
            throw err;
          }
        }
      }
    }
  }
};

// src/vscode/WorkspaceScanner.ts
var vscode = __toESM(require("vscode"));
var fs7 = __toESM(require("fs/promises"));
var WorkspaceScanner = class {
  constructor(ignoreManager, excludePatterns = ["**/node_modules/**", "**/.git/**", "**/dist/**", "**/build/**", "**/.angular/**", "**/target/**"]) {
    this.ignoreManager = ignoreManager;
    this.excludePatterns = excludePatterns;
  }
  /**
   * Scans workspace files. 
   * L1: When folderUri is provided, scans only that folder and returns folder-relative paths.
   *     When omitted, scans all workspace folders — if multiple roots exist, prefixes paths
   *     with the folder name to avoid collisions.
   * L4: No hard file cap. Shows a non-blocking warning if > 100K files are found.
   *
   * @param folderUri Optional URI to scope scanning to a single workspace folder.
   */
  async scan(folderUri) {
    const map = /* @__PURE__ */ new Map();
    const excludeGlob = `{${this.excludePatterns.join(",")}}`;
    if (folderUri) {
      const pattern = new vscode.RelativePattern(folderUri, "**/*");
      const uris = await vscode.workspace.findFiles(pattern, excludeGlob);
      this.warnIfLarge(uris.length);
      for (const uri of uris) {
        if (uri.scheme === "file") {
          if (this.ignoreManager.isIgnored(uri.fsPath))
            continue;
          const stat5 = await fs7.stat(uri.fsPath);
          const relativePath = vscode.workspace.asRelativePath(uri, false);
          map.set(relativePath, {
            relativePath,
            size: stat5.size,
            mtime: stat5.mtimeMs
          });
        }
      }
    } else {
      const folders = vscode.workspace.workspaceFolders;
      if (!folders || folders.length === 0) {
        return map;
      }
      const isMultiRoot = folders.length > 1;
      for (const folder of folders) {
        const pattern = new vscode.RelativePattern(folder.uri, "**/*");
        const uris = await vscode.workspace.findFiles(pattern, excludeGlob);
        for (const uri of uris) {
          if (uri.scheme === "file") {
            if (this.ignoreManager.isIgnored(uri.fsPath))
              continue;
            const stat5 = await fs7.stat(uri.fsPath);
            const folderRelPath = vscode.workspace.asRelativePath(uri, isMultiRoot);
            map.set(folderRelPath, {
              relativePath: folderRelPath,
              size: stat5.size,
              mtime: stat5.mtimeMs
            });
          }
        }
      }
      this.warnIfLarge(map.size);
    }
    return map;
  }
  /**
   * L4: Non-blocking warning when file count is very high.
   */
  warnIfLarge(count) {
    if (count > 1e5) {
      vscode.window.showInformationMessage(
        `JGuard: Scanning ${count.toLocaleString()} files. This may take a while. Consider adding exclusions to .gitignore or workspace settings.`
      );
    }
  }
};

// src/vscode/StatusBar.ts
var vscode2 = __toESM(require("vscode"));
var StatusBar = class {
  item;
  constructor() {
    this.item = vscode2.window.createStatusBarItem(vscode2.StatusBarAlignment.Left, 100);
    this.item.command = "jguard.toggleProtection";
    this.setState("off");
    this.item.show();
  }
  setState(state, changeCount = 0) {
    switch (state) {
      case "off":
        this.item.text = "$(shield) AI Guard: OFF";
        this.item.tooltip = "Click to enable AI Guard checkpoint";
        this.item.backgroundColor = void 0;
        this.item.command = "jguard.toggleProtection";
        break;
      case "protecting":
        this.item.text = "$(shield-check) AI Guard: PROTECTING";
        this.item.tooltip = "Workspace protected. Click to disable.";
        this.item.backgroundColor = void 0;
        this.item.command = "jguard.toggleProtection";
        break;
      case "changes":
        this.item.text = `$(repo-sync) AI Guard: ${changeCount} CHANGES`;
        this.item.tooltip = "AI changes detected. Click to review.";
        this.item.backgroundColor = new vscode2.ThemeColor("statusBarItem.warningBackground");
        this.item.command = "jguardSidebar.focus";
        break;
      case "conflict":
        this.item.text = "$(alert) AI Guard: CONFLICT";
        this.item.tooltip = "Manual edits detected after AI changes. Review required.";
        this.item.backgroundColor = new vscode2.ThemeColor("statusBarItem.errorBackground");
        this.item.command = "jguardSidebar.focus";
        break;
      case "restoring":
        this.item.text = "$(sync~spin) AI Guard: RESTORING...";
        this.item.tooltip = "Restoring checkpoint...";
        this.item.backgroundColor = new vscode2.ThemeColor("statusBarItem.warningBackground");
        this.item.command = void 0;
        break;
    }
  }
  dispose() {
    this.item.dispose();
  }
};

// src/vscode/Sidebar.ts
var vscode3 = __toESM(require("vscode"));
var path6 = __toESM(require("path"));
var GuardTreeItem = class extends vscode3.TreeItem {
  constructor(label, collapsibleState, change, decision, fileViewState, isBinary) {
    super(label, collapsibleState);
    this.label = label;
    this.collapsibleState = collapsibleState;
    this.change = change;
    this.decision = decision;
    this.fileViewState = fileViewState;
    this.isBinary = isBinary;
    if (change) {
      this.tooltip = this.buildTooltip(change);
      let attrLabel = "";
      if (change.attribution === "human")
        attrLabel = " (Human)";
      else if (change.attribution === "ai")
        attrLabel = " (AI)";
      else if (change.attribution === "git")
        attrLabel = " (Git)";
      if (decision === "accepted") {
        this.description = `${change.type}${attrLabel} \u2713 accepted`;
      } else if (decision === "rejected") {
        this.description = `${change.type}${attrLabel} \u2717 rejected`;
      } else {
        if (fileViewState === "original") {
          this.description = `${change.type}${attrLabel} (showing original)`;
        } else {
          this.description = `${change.type}${attrLabel}`;
        }
      }
      if (decision === "accepted") {
        this.iconPath = new vscode3.ThemeIcon("check", new vscode3.ThemeColor("charts.green"));
      } else if (decision === "rejected") {
        this.iconPath = new vscode3.ThemeIcon("close", new vscode3.ThemeColor("charts.red"));
      } else if (isBinary) {
        this.iconPath = new vscode3.ThemeIcon("file-binary");
      } else if (change.type === "modified") {
        this.iconPath = new vscode3.ThemeIcon("edit");
      } else if (change.type === "created") {
        this.iconPath = new vscode3.ThemeIcon("add");
      } else if (change.type === "deleted") {
        this.iconPath = new vscode3.ThemeIcon("trash");
      }
      if (decision === "accepted") {
        this.contextValue = "jguard.changeItem.accepted";
      } else if (decision === "rejected") {
        this.contextValue = "jguard.changeItem.rejected";
      } else {
        this.contextValue = "jguard.changeItem";
      }
      this.command = {
        command: "jguard.openDiff",
        title: "Open Diff",
        arguments: [change]
      };
    }
  }
  buildTooltip(change) {
    const md = new vscode3.MarkdownString();
    md.isTrusted = true;
    md.appendMarkdown(`**${change.relativePath}**

`);
    md.appendMarkdown(`Type: \`${change.type}\`
`);
    if (change.attribution) {
      const attrLabel = change.attribution === "ai" ? "AI" : change.attribution === "human" ? "Human" : "Git / External";
      md.appendMarkdown(`Attribution: \`${attrLabel}\`

`);
    } else {
      md.appendMarkdown(`
`);
    }
    md.appendMarkdown(`Click to view diff \u2022 Use inline buttons to Accept \u2713, Reject \u2717, or Toggle \u{1F441}`);
    return md;
  }
};
var SidebarProvider = class {
  _onDidChangeTreeData = new vscode3.EventEmitter();
  onDidChangeTreeData = this._onDidChangeTreeData.event;
  // L1: Multi-root changesets
  changeSets = null;
  isProtecting = false;
  isHidden = false;
  // L3: Per-file view states
  fileViewStates = /* @__PURE__ */ new Map();
  /**
   * L1: Accepts either a Map of changesets (multi-root) or null.
   */
  refresh(changeSets, isProtecting, isHidden = false, fileViewStates) {
    this.changeSets = changeSets;
    this.isProtecting = isProtecting;
    this.isHidden = isHidden;
    this.fileViewStates = fileViewStates || /* @__PURE__ */ new Map();
    this._onDidChangeTreeData.fire();
  }
  getTreeItem(element) {
    return element;
  }
  getChildren(element) {
    if (!this.isProtecting) {
      const item = new GuardTreeItem("Protection is OFF (Click to Enable)", vscode3.TreeItemCollapsibleState.None);
      item.command = {
        command: "jguard.toggleProtection",
        title: "Enable Protection"
      };
      item.iconPath = new vscode3.ThemeIcon("shield");
      item.tooltip = "Click to create a checkpoint and enable AI Guard protection";
      return Promise.resolve([item]);
    }
    if (!element) {
      const children = [
        new GuardTreeItem("Status: PROTECTING", vscode3.TreeItemCollapsibleState.None)
      ];
      if (!this.changeSets || this.changeSets.size === 0) {
        children.push(
          new GuardTreeItem("No changes detected yet", vscode3.TreeItemCollapsibleState.None)
        );
        return Promise.resolve(children);
      }
      const isMultiRoot = this.changeSets.size > 1;
      if (isMultiRoot) {
        for (const [wsRoot2, cs] of this.changeSets.entries()) {
          const folderName = path6.basename(wsRoot2);
          const count = cs.changes.length;
          if (count > 0) {
            const title = this.isHidden ? `\u{1F4C1} ${folderName} \u2014 Hidden (${count})` : `\u{1F4C1} ${folderName} \u2014 Changes (${count})`;
            const item = new GuardTreeItem(title, vscode3.TreeItemCollapsibleState.Expanded);
            item._wsRoot = wsRoot2;
            children.push(item);
          }
        }
      } else {
        const [, cs] = [...this.changeSets.entries()][0];
        if (cs.changes.length > 0) {
          const title = this.isHidden ? `Changes Hidden (Showing Original)` : `Changes (${cs.changes.length})`;
          const item = new GuardTreeItem(title, vscode3.TreeItemCollapsibleState.Expanded);
          item._wsRoot = [...this.changeSets.keys()][0];
          children.push(item);
        } else {
          children.push(
            new GuardTreeItem("No changes detected yet", vscode3.TreeItemCollapsibleState.None)
          );
        }
      }
      return Promise.resolve(children);
    }
    const wsRoot = element._wsRoot;
    if (wsRoot && this.changeSets?.has(wsRoot)) {
      const cs = this.changeSets.get(wsRoot);
      return Promise.resolve(
        cs.changes.map((c) => {
          const decision = cs.decisions[c.relativePath] || "pending";
          const viewState = this.fileViewStates.get(c.relativePath) || "ai";
          const isBinary = false;
          return new GuardTreeItem(
            c.relativePath,
            vscode3.TreeItemCollapsibleState.None,
            c,
            decision,
            viewState,
            isBinary
          );
        })
      );
    }
    return Promise.resolve([]);
  }
};

// src/vscode/DiffProvider.ts
var DiffProvider = class {
  constructor(objectStore) {
    this.objectStore = objectStore;
  }
  static scheme = "jguard";
  async provideTextDocumentContent(uri) {
    const hash = uri.authority;
    if (!hash) {
      return "";
    }
    try {
      const content = await this.objectStore.read(hash);
      return new TextDecoder().decode(content);
    } catch (err) {
      console.error(`Failed to read object ${hash} from store`, err);
      return "Error: Could not load file content from JGuard checkpoint.";
    }
  }
};

// src/vscode/Commands.ts
var vscode6 = __toESM(require("vscode"));
var path12 = __toESM(require("path"));
var fs9 = __toESM(require("fs/promises"));

// src/core/ChangeDetector.ts
var path7 = __toESM(require("path"));
var ChangeDetector = class {
  /**
   * Compares the current workspace state against a checkpoint.
   * @param checkpoint The active checkpoint.
   * @param scanner The scanner used to get the current file states.
   * @param workspaceRoot Absolute path to the workspace root.
   */
  static async detectChanges(checkpoint, scanner, workspaceRoot, attributionEngine) {
    const currentPaths = await scanner.scan();
    const changes = [];
    const aiStateHashes = {};
    for (const [relPath, snapshot] of Object.entries(checkpoint.files)) {
      if (!currentPaths.has(relPath)) {
        changes.push({
          type: "deleted",
          relativePath: relPath,
          checkpointHash: snapshot.hash,
          attribution: attributionEngine?.getAttribution(path7.join(workspaceRoot, relPath))
        });
      } else {
        const current = currentPaths.get(relPath);
        if (current.mtime === snapshot.mtime && current.size === snapshot.size) {
          continue;
        }
        const absPath = path7.join(workspaceRoot, relPath);
        const currentHash = await Hasher.hashFile(absPath);
        if (currentHash !== snapshot.hash) {
          changes.push({
            type: "modified",
            relativePath: relPath,
            checkpointHash: snapshot.hash,
            currentHash,
            attribution: attributionEngine?.getAttribution(absPath)
          });
          aiStateHashes[relPath] = currentHash;
        }
      }
    }
    for (const [relPath, current] of currentPaths.entries()) {
      if (!checkpoint.files[relPath]) {
        const absPath = path7.join(workspaceRoot, relPath);
        const currentHash = await Hasher.hashFile(absPath);
        changes.push({
          type: "created",
          relativePath: relPath,
          currentHash,
          attribution: attributionEngine?.getAttribution(absPath)
        });
        aiStateHashes[relPath] = currentHash;
      }
    }
    const decisions = {};
    for (const change of changes) {
      decisions[change.relativePath] = "pending";
    }
    return {
      checkpointId: checkpoint.id,
      computedAt: Date.now(),
      changes,
      aiStateHashes,
      decisions
    };
  }
  /**
   * L4: Computes incremental O(k) updates to a ChangeSet for specific dirty paths.
   * @param checkpoint The active checkpoint.
   * @param workspaceRoot Absolute path to the workspace root.
   * @param dirtyPaths Array of relative paths that were modified.
   * @param existingChangeSet The previous ChangeSet to update.
   */
  static async detectDelta(checkpoint, workspaceRoot, dirtyPaths, existingChangeSet, attributionEngine) {
    const newChangeSet = {
      checkpointId: existingChangeSet.checkpointId,
      computedAt: Date.now(),
      changes: [...existingChangeSet.changes],
      aiStateHashes: { ...existingChangeSet.aiStateHashes },
      decisions: { ...existingChangeSet.decisions }
    };
    for (const relPath of dirtyPaths) {
      const absPath = path7.join(workspaceRoot, relPath);
      newChangeSet.changes = newChangeSet.changes.filter((c) => c.relativePath !== relPath);
      delete newChangeSet.aiStateHashes[relPath];
      let currentHash = null;
      let exists = false;
      try {
        currentHash = await Hasher.hashFile(absPath);
        exists = true;
      } catch (e) {
        if (e.code === "ENOENT") {
          exists = false;
        } else {
          throw e;
        }
      }
      const snapshot = checkpoint.files[relPath];
      if (snapshot) {
        if (!exists) {
          newChangeSet.changes.push({
            type: "deleted",
            relativePath: relPath,
            checkpointHash: snapshot.hash,
            attribution: attributionEngine?.getAttribution(absPath)
          });
          newChangeSet.decisions[relPath] = newChangeSet.decisions[relPath] ?? "pending";
        } else if (currentHash !== snapshot.hash) {
          newChangeSet.changes.push({
            type: "modified",
            relativePath: relPath,
            checkpointHash: snapshot.hash,
            currentHash,
            attribution: attributionEngine?.getAttribution(absPath)
          });
          newChangeSet.aiStateHashes[relPath] = currentHash;
          newChangeSet.decisions[relPath] = newChangeSet.decisions[relPath] ?? "pending";
        }
      } else {
        if (exists) {
          newChangeSet.changes.push({
            type: "created",
            relativePath: relPath,
            currentHash,
            attribution: attributionEngine?.getAttribution(absPath)
          });
          newChangeSet.aiStateHashes[relPath] = currentHash;
          newChangeSet.decisions[relPath] = newChangeSet.decisions[relPath] ?? "pending";
        }
      }
    }
    const currentChangePaths = new Set(newChangeSet.changes.map((c) => c.relativePath));
    for (const p of Object.keys(newChangeSet.decisions)) {
      if (!currentChangePaths.has(p)) {
        delete newChangeSet.decisions[p];
      }
    }
    return newChangeSet;
  }
};

// src/core/ConflictDetector.ts
var path8 = __toESM(require("path"));
var ConflictDetector = class {
  /**
   * Detects if any files modified by the AI were subsequently modified by the user
   * before the reject operation was triggered.
   * 
   * @param changeSet The computed changeset representing AI modifications.
   * @param scanner The file scanner to get current workspace state.
   * @param workspaceRoot Absolute path to the workspace root.
   */
  static async detect(changeSet, scanner, workspaceRoot) {
    const conflicts = [];
    const currentPaths = await scanner.scan();
    for (const change of changeSet.changes) {
      if (change.type === "modified" || change.type === "created") {
        const currentMeta = currentPaths.get(change.relativePath);
        if (!currentMeta) {
          continue;
        }
        const absPath = path8.join(workspaceRoot, change.relativePath);
        const currentHash = await Hasher.hashFile(absPath);
        const aiHash = changeSet.aiStateHashes[change.relativePath];
        if (currentHash !== aiHash && (change.type === "modified" ? currentHash !== change.checkpointHash : true)) {
          conflicts.push({
            relativePath: change.relativePath,
            reason: "user_modified_post_ai",
            currentHash,
            checkpointHash: change.type === "modified" ? change.checkpointHash : ""
          });
        }
      }
    }
    return conflicts;
  }
};

// src/core/RestorePlanner.ts
var path9 = __toESM(require("path"));
var RestorePlanner = class {
  /**
   * Generates a deterministic plan of restore operations to rollback the workspace.
   * 
   * @param checkpoint The checkpoint to restore to.
   * @param changeSet The computed changeset.
   * @param conflicts A list of unresolvable conflicts (files to SKIP).
   * @param workspaceRoot Absolute path to the workspace root.
   */
  static buildPlan(checkpoint, changeSet, conflicts, workspaceRoot) {
    const plan = { operations: [] };
    const conflictPaths = new Set(conflicts.map((c) => c.relativePath));
    for (const change of changeSet.changes) {
      if (conflictPaths.has(change.relativePath)) {
        continue;
      }
      const absPath = path9.join(workspaceRoot, change.relativePath);
      if (change.type === "modified") {
        plan.operations.push({
          type: "write",
          relativePath: change.relativePath,
          absolutePath: absPath,
          objectHash: change.checkpointHash
        });
      } else if (change.type === "created") {
        plan.operations.push({
          type: "delete",
          relativePath: change.relativePath,
          absolutePath: absPath,
          objectHash: null
        });
      } else if (change.type === "deleted") {
        plan.operations.push({
          type: "write",
          relativePath: change.relativePath,
          absolutePath: absPath,
          objectHash: change.checkpointHash
        });
      }
    }
    plan.operations.sort((a, b) => {
      if (a.type !== b.type) {
        return a.type === "delete" ? -1 : 1;
      }
      return a.relativePath.localeCompare(b.relativePath);
    });
    return plan;
  }
};

// src/core/SelectiveRestorePlanner.ts
var path10 = __toESM(require("path"));
var SelectiveRestorePlanner = class {
  /**
   * Generates a restore plan that only restores rejected files.
   * Accepted and pending files are left untouched.
   */
  static buildPlan(checkpoint, changeSet, conflicts, workspaceRoot) {
    const plan = { operations: [] };
    const conflictPaths = new Set(conflicts.map((c) => c.relativePath));
    const rejectedChanges = changeSet.changes.filter(
      (c) => changeSet.decisions[c.relativePath] === "rejected"
    );
    for (const change of rejectedChanges) {
      if (conflictPaths.has(change.relativePath)) {
        continue;
      }
      const absPath = path10.join(workspaceRoot, change.relativePath);
      if (change.type === "modified") {
        plan.operations.push({
          type: "write",
          relativePath: change.relativePath,
          absolutePath: absPath,
          objectHash: change.checkpointHash
        });
      } else if (change.type === "created") {
        plan.operations.push({
          type: "delete",
          relativePath: change.relativePath,
          absolutePath: absPath,
          objectHash: null
        });
      } else if (change.type === "deleted") {
        plan.operations.push({
          type: "write",
          relativePath: change.relativePath,
          absolutePath: absPath,
          objectHash: change.checkpointHash
        });
      }
    }
    plan.operations.sort((a, b) => {
      if (a.type !== b.type) {
        return a.type === "delete" ? -1 : 1;
      }
      return a.relativePath.localeCompare(b.relativePath);
    });
    return plan;
  }
  /**
   * L2/L3: Builds a single-file restore plan.
   * Used for per-file reject and per-file toggle.
   */
  static buildSingleFilePlan(change, objectHash, workspaceRoot) {
    const absPath = path10.join(workspaceRoot, change.relativePath);
    const plan = { operations: [] };
    if (change.type === "modified" || change.type === "deleted") {
      plan.operations.push({
        type: "write",
        relativePath: change.relativePath,
        absolutePath: absPath,
        objectHash
      });
    } else if (change.type === "created") {
      plan.operations.push({
        type: "delete",
        relativePath: change.relativePath,
        absolutePath: absPath,
        objectHash: null
      });
    }
    return plan;
  }
};

// src/vscode/BatchedWatcherQueue.ts
var vscode4 = __toESM(require("vscode"));
var BatchedWatcherQueue = class {
  pendingUris = /* @__PURE__ */ new Set();
  timer = null;
  delayMs;
  maxBatchSize;
  onFlush;
  /**
   * @param delayMs Time to wait for more events before flushing (sliding window)
   * @param maxBatchSize Maximum number of events before forcing a flush
   * @param onFlush Callback when the batch is ready
   */
  constructor(delayMs, maxBatchSize, onFlush) {
    this.delayMs = delayMs;
    this.maxBatchSize = maxBatchSize;
    this.onFlush = onFlush;
  }
  /**
   * Enqueue a file URI for processing.
   */
  enqueue(uri) {
    const key = uri.toString();
    if (!this.pendingUris.has(key)) {
      this.pendingUris.add(key);
    }
    if (this.pendingUris.size >= this.maxBatchSize) {
      this.flush();
      return;
    }
    if (this.timer) {
      clearTimeout(this.timer);
    }
    this.timer = setTimeout(() => this.flush(), this.delayMs);
  }
  /**
   * Immediately flush any pending URIs.
   */
  flush() {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    if (this.pendingUris.size === 0) {
      return;
    }
    const uris = Array.from(this.pendingUris).map((s) => vscode4.Uri.parse(s));
    this.pendingUris.clear();
    this.onFlush(uris);
  }
  dispose() {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    this.pendingUris.clear();
  }
};

// src/vscode/BranchWatcher.ts
var vscode5 = __toESM(require("vscode"));
var path11 = __toESM(require("path"));
var fs8 = __toESM(require("fs/promises"));
var BranchWatcher = class {
  headWatchers = /* @__PURE__ */ new Map();
  _onBranchChanged = new vscode5.EventEmitter();
  onBranchChanged = this._onBranchChanged.event;
  constructor() {
    this.setupWatchers();
    vscode5.workspace.onDidChangeWorkspaceFolders(() => {
      this.setupWatchers();
    });
  }
  async setupWatchers() {
    const folders = vscode5.workspace.workspaceFolders;
    if (!folders)
      return;
    for (const watcher of this.headWatchers.values()) {
      watcher.dispose();
    }
    this.headWatchers.clear();
    for (const folder of folders) {
      const gitHeadPath = path11.join(folder.uri.fsPath, ".git", "HEAD");
      try {
        await fs8.stat(gitHeadPath);
        const pattern = new vscode5.RelativePattern(folder, ".git/HEAD");
        const watcher = vscode5.workspace.createFileSystemWatcher(pattern, false, false, false);
        watcher.onDidChange(() => this._onBranchChanged.fire(folder.uri.fsPath));
        watcher.onDidCreate(() => this._onBranchChanged.fire(folder.uri.fsPath));
        this.headWatchers.set(folder.uri.fsPath, watcher);
      } catch (e) {
      }
    }
  }
  dispose() {
    for (const watcher of this.headWatchers.values()) {
      watcher.dispose();
    }
    this.headWatchers.clear();
    this._onBranchChanged.dispose();
  }
};

// src/vscode/Commands.ts
var Commands = class {
  constructor(context, checkpointService, restoreService, scanner, sidebar, statusBar2, objectStore, ignoreManager, attributionEngine) {
    this.context = context;
    this.checkpointService = checkpointService;
    this.restoreService = restoreService;
    this.scanner = scanner;
    this.sidebar = sidebar;
    this.statusBar = statusBar2;
    this.objectStore = objectStore;
    this.ignoreManager = ignoreManager;
    this.attributionEngine = attributionEngine;
    this.branchWatcher = new BranchWatcher();
    this.context.subscriptions.push(this.branchWatcher);
    this.context.subscriptions.push(
      this.branchWatcher.onBranchChanged(async (wsRoot) => {
        if (this.activeSession && this.activeSession.folderCheckpoints[wsRoot]) {
          vscode6.window.showWarningMessage("Git branch switch detected. Finalizing JGuard session to prevent conflicts.");
          await this.acceptAll();
        }
      })
    );
  }
  // L1: Session-based state (multi-root)
  activeSession = null;
  forwardSession = null;
  // Per-folder changesets (L1: one per workspace folder)
  changeSets = /* @__PURE__ */ new Map();
  // wsRoot → ChangeSet
  // L2: AI snapshot hashes for rejected files (so they can be toggled back)
  aiSnapshotHashes = /* @__PURE__ */ new Map();
  // relPath → hash in ObjectStore
  // L3: Per-file view state
  fileViewStates = /* @__PURE__ */ new Map();
  // relPath → 'ai' | 'original'
  // L7: Last finalized session ID for undo
  lastFinalizedSessionId = null;
  lastFinalizedAt = 0;
  // Bulk view state for backward-compat bulk toggle
  viewState = "ai";
  _onDidFinalizeSession = new vscode6.EventEmitter();
  onDidFinalizeSession = this._onDidFinalizeSession.event;
  getActiveSessionId() {
    return this.activeSession?.id;
  }
  branchWatcher;
  register() {
    this.context.subscriptions.push(
      vscode6.commands.registerCommand("jguard.toggleProtection", this.toggleProtection.bind(this)),
      vscode6.commands.registerCommand("jguard.toggleChanges", this.toggleChanges.bind(this)),
      vscode6.commands.registerCommand("jguard.openDiff", this.openDiff.bind(this)),
      vscode6.commands.registerCommand("jguard.acceptAll", this.acceptAll.bind(this)),
      vscode6.commands.registerCommand("jguard.rejectAll", this.rejectAll.bind(this)),
      vscode6.commands.registerCommand("jguard.refresh", this.refresh.bind(this)),
      // L2: Per-file accept/reject
      vscode6.commands.registerCommand("jguard.acceptFile", this.acceptFile.bind(this)),
      vscode6.commands.registerCommand("jguard.rejectFile", this.rejectFile.bind(this)),
      vscode6.commands.registerCommand("jguard.finalize", this.finalize.bind(this)),
      // L3: Per-file toggle
      vscode6.commands.registerCommand("jguard.toggleFile", this.toggleFile.bind(this))
    );
    const watcher = vscode6.workspace.createFileSystemWatcher("**/*");
    const watcherQueue = new BatchedWatcherQueue(200, 50, async (uris) => {
      if (this.activeSession) {
        await this.deltaRefresh(uris);
      }
    });
    const onDidChange = (uri) => {
      if (this.ignoreManager.isIgnored(uri.fsPath))
        return;
      this.attributionEngine.trackExternalChange(uri.fsPath);
      watcherQueue.enqueue(uri);
    };
    this.context.subscriptions.push(
      watcher.onDidChange(onDidChange),
      watcher.onDidCreate(onDidChange),
      watcher.onDidDelete(onDidChange),
      watcher,
      { dispose: () => watcherQueue.dispose() }
    );
  }
  /**
   * Provides a way to restore session state (used for crash recovery).
   */
  restoreSessionState(session) {
    this.activeSession = session;
    if (session.uiState) {
      this.fileViewStates = new Map(Object.entries(session.uiState.fileViewStates || {}));
      this.aiSnapshotHashes = new Map(Object.entries(session.uiState.aiSnapshotHashes || {}));
    }
  }
  async toggleProtection() {
    if (this.activeSession) {
      const action = await vscode6.window.showInformationMessage(
        "AI Guard is currently active. Do you want to Accept all changes or Reject all changes?",
        "Accept All",
        "Reject All",
        "Cancel"
      );
      if (action === "Accept All") {
        await this.acceptAll();
      } else if (action === "Reject All") {
        await this.rejectAll();
      }
      return;
    }
    const workspaceFolders = vscode6.workspace.workspaceFolders;
    if (!workspaceFolders || workspaceFolders.length === 0) {
      vscode6.window.showErrorMessage("JGuard requires an open workspace.");
      return;
    }
    await vscode6.commands.executeCommand("workbench.action.files.saveAll");
    vscode6.window.withProgress({
      location: vscode6.ProgressLocation.Notification,
      title: "AI Guard: Creating Checkpoint...",
      cancellable: false
    }, async (progress) => {
      try {
        const folderPaths = workspaceFolders.map((f) => f.uri.fsPath);
        this.activeSession = await this.checkpointService.createSession(
          "ws-id",
          folderPaths,
          (processed, total) => {
            const pct = Math.round(processed / total * 100);
            progress.report({
              message: `(${processed.toLocaleString()} / ${total.toLocaleString()} files)`,
              increment: pct
            });
          }
        );
        this.statusBar.setState("protecting");
        this.sidebar.refresh(null, true);
        const folderCount = Object.keys(this.activeSession.folderCheckpoints).length;
        const msg = folderCount > 1 ? `AI Guard: Checkpoint created across ${folderCount} workspace folders. You are now protected.` : "AI Guard: Workspace checkpoint created. You are now protected.";
        vscode6.window.showInformationMessage(msg);
      } catch (err) {
        vscode6.window.showErrorMessage(`Failed to create checkpoint: ${err.message}`);
      }
    });
  }
  async refresh() {
    if (!this.activeSession)
      return;
    const previousChangeSets = new Map(this.changeSets);
    this.changeSets.clear();
    let totalCount = 0;
    for (const [wsRoot, checkpoint] of Object.entries(this.activeSession.folderCheckpoints)) {
      const changeSet = await ChangeDetector.detectChanges(checkpoint, this.scanner, wsRoot, this.attributionEngine);
      const existingCs = previousChangeSets.get(wsRoot);
      const savedDecisions = this.activeSession.uiState?.decisions?.[wsRoot];
      for (const change of changeSet.changes) {
        if (existingCs && existingCs.decisions[change.relativePath] && existingCs.decisions[change.relativePath] !== "pending") {
          changeSet.decisions[change.relativePath] = existingCs.decisions[change.relativePath];
        } else if (savedDecisions && savedDecisions[change.relativePath] && savedDecisions[change.relativePath] !== "pending") {
          changeSet.decisions[change.relativePath] = savedDecisions[change.relativePath];
        }
      }
      if (existingCs) {
        for (const change of existingCs.changes) {
          if (!changeSet.changes.find((c) => c.relativePath === change.relativePath)) {
            const viewState = this.fileViewStates.get(change.relativePath);
            const decision = existingCs.decisions[change.relativePath];
            if (viewState === "original" || decision === "rejected") {
              changeSet.changes.push(change);
              if (existingCs.aiStateHashes[change.relativePath]) {
                changeSet.aiStateHashes[change.relativePath] = existingCs.aiStateHashes[change.relativePath];
              }
              changeSet.decisions[change.relativePath] = decision;
            }
          }
        }
      } else if (savedDecisions && this.activeSession.uiState?.aiSnapshotHashes) {
        for (const [relPath, decision] of Object.entries(savedDecisions)) {
          const viewState = this.fileViewStates.get(relPath);
          if (viewState === "original" || decision === "rejected") {
            if (!changeSet.changes.find((c) => c.relativePath === relPath)) {
              const snapshot = checkpoint.files[relPath];
              const aiHash = this.activeSession.uiState.aiSnapshotHashes[relPath];
              const changeType = snapshot ? aiHash ? "modified" : "deleted" : "created";
              changeSet.changes.push({
                type: changeType,
                relativePath: relPath,
                checkpointHash: snapshot?.hash,
                currentHash: aiHash
              });
              if (aiHash) {
                changeSet.aiStateHashes[relPath] = aiHash;
              }
              changeSet.decisions[relPath] = decision;
            }
          }
        }
      }
      this.changeSets.set(wsRoot, changeSet);
      totalCount += changeSet.changes.length;
    }
    if (totalCount > 0) {
      this.statusBar.setState("changes", totalCount);
    } else {
      this.statusBar.setState("protecting");
    }
    this.sidebar.refresh(this.changeSets, true, false, this.fileViewStates);
    await this.saveUIState();
  }
  /**
   * L4: Incremental refresh based on specific changed URIs.
   */
  async deltaRefresh(uris) {
    if (!this.activeSession)
      return;
    const changesByRoot = /* @__PURE__ */ new Map();
    for (const uri of uris) {
      if (uri.scheme !== "file")
        continue;
      const wsRoot = this.findWorkspaceRootForFileAbsolute(uri.fsPath);
      if (wsRoot) {
        const relPath = path12.relative(wsRoot, uri.fsPath).replace(/\\/g, "/");
        let list = changesByRoot.get(wsRoot);
        if (!list) {
          list = [];
          changesByRoot.set(wsRoot, list);
        }
        list.push(relPath);
      }
    }
    let totalCount = 0;
    for (const [wsRoot, dirtyPaths] of changesByRoot.entries()) {
      const checkpoint = this.activeSession.folderCheckpoints[wsRoot];
      const existingCs = this.changeSets.get(wsRoot);
      if (checkpoint && existingCs) {
        const newChangeSet = await ChangeDetector.detectDelta(checkpoint, wsRoot, dirtyPaths, existingCs, this.attributionEngine);
        for (const change of existingCs.changes) {
          if (!newChangeSet.changes.find((c) => c.relativePath === change.relativePath)) {
            const viewState = this.fileViewStates.get(change.relativePath);
            const decision = existingCs.decisions[change.relativePath];
            if (viewState === "original" || decision === "rejected") {
              newChangeSet.changes.push(change);
              if (existingCs.aiStateHashes[change.relativePath]) {
                newChangeSet.aiStateHashes[change.relativePath] = existingCs.aiStateHashes[change.relativePath];
              }
              newChangeSet.decisions[change.relativePath] = decision;
            }
          }
        }
        this.changeSets.set(wsRoot, newChangeSet);
      } else if (checkpoint && !existingCs) {
        const changeSet = await ChangeDetector.detectChanges(checkpoint, this.scanner, wsRoot, this.attributionEngine);
        this.changeSets.set(wsRoot, changeSet);
      }
    }
    for (const cs of this.changeSets.values()) {
      totalCount += cs.changes.length;
    }
    if (totalCount > 0) {
      this.statusBar.setState("changes", totalCount);
    } else {
      this.statusBar.setState("protecting");
    }
    this.sidebar.refresh(this.changeSets, true, false, this.fileViewStates);
    await this.saveUIState();
  }
  async openDiff(change) {
    if (!this.activeSession)
      return;
    const wsFolder = this.findWorkspaceRootForFile(change.relativePath);
    if (!wsFolder)
      return;
    const currentUri = vscode6.Uri.file(path12.join(wsFolder, change.relativePath));
    let originalUri;
    if (change.type === "created") {
      originalUri = vscode6.Uri.parse(`${DiffProvider.scheme}://empty/${change.relativePath}`);
    } else {
      const hash = change.type === "modified" ? change.checkpointHash : change.checkpointHash;
      originalUri = vscode6.Uri.parse(`${DiffProvider.scheme}://${hash}/${change.relativePath}`);
    }
    const checkpoint = this.activeSession.folderCheckpoints[wsFolder];
    const snapshot = checkpoint?.files[change.relativePath];
    if (snapshot?.isBinary) {
      if (this.isImageFile(change.relativePath)) {
        await this.openBinaryComparison(change, wsFolder);
      } else {
        vscode6.window.showInformationMessage(
          `Binary file changed: ${change.relativePath}
Original: ${snapshot.size} bytes (${snapshot.hash.slice(0, 8)}\u2026)
Current state differs`
        );
      }
      return;
    }
    const title = `${change.relativePath} (Checkpoint \u2194 Current)`;
    if (change.type === "deleted") {
      await vscode6.commands.executeCommand("vscode.diff", originalUri, vscode6.Uri.parse(`${DiffProvider.scheme}://empty/${change.relativePath}`), title);
    } else {
      await vscode6.commands.executeCommand("vscode.diff", originalUri, currentUri, title);
    }
  }
  async toggleChanges() {
    if (!this.activeSession) {
      vscode6.window.showInformationMessage("AI Guard is not active.");
      return;
    }
    await vscode6.commands.executeCommand("workbench.action.files.saveAll");
    vscode6.window.withProgress({
      location: vscode6.ProgressLocation.Notification,
      title: this.viewState === "ai" ? "AI Guard: Hiding Changes..." : "AI Guard: Applying Changes...",
      cancellable: false
    }, async () => {
      try {
        if (this.viewState === "ai") {
          this.forwardSession = await this.createForwardSession();
          const lockFile = path12.join(this.checkpointService.metadataStore.storageBaseDir, "jguard.lock");
          await fs9.writeFile(lockFile, this.activeSession.id, "utf-8");
          for (const [wsRoot, checkpoint] of Object.entries(this.activeSession.folderCheckpoints)) {
            const changeSet = await ChangeDetector.detectChanges(checkpoint, this.scanner, wsRoot, this.attributionEngine);
            const plan = RestorePlanner.buildPlan(checkpoint, changeSet, [], wsRoot);
            await this.restoreService.execute(plan);
          }
          this.viewState = "original";
          this.fileViewStates.clear();
          for (const cs of this.changeSets.values()) {
            for (const change of cs.changes) {
              this.fileViewStates.set(change.relativePath, "original");
            }
          }
          this.statusBar.setState("changes", this.getTotalChangeCount());
          this.sidebar.refresh(this.changeSets, true, true, this.fileViewStates);
          vscode6.window.showInformationMessage("AI Guard: Changes hidden (showing Original).");
        } else {
          if (!this.forwardSession)
            return;
          for (const [wsRoot, checkpoint] of Object.entries(this.forwardSession.folderCheckpoints)) {
            const forwardChangeSet = await ChangeDetector.detectChanges(checkpoint, this.scanner, wsRoot, this.attributionEngine);
            const plan = RestorePlanner.buildPlan(checkpoint, forwardChangeSet, [], wsRoot);
            await this.restoreService.execute(plan);
          }
          this.viewState = "ai";
          this.fileViewStates.clear();
          await this.refresh();
          vscode6.window.showInformationMessage("AI Guard: Changes applied (showing AI).");
        }
      } catch (err) {
        vscode6.window.showErrorMessage(`Toggle failed: ${err.message}`);
      }
    });
  }
  // ─── L2: Per-File Accept ─────────────────────────────────────────────
  async acceptFile(arg) {
    if (!this.activeSession)
      return;
    const change = arg.change ? arg.change : arg;
    const wsRoot = this.findWorkspaceRootForFile(change.relativePath);
    if (!wsRoot)
      return;
    const cs = this.changeSets.get(wsRoot);
    if (!cs)
      return;
    cs.decisions[change.relativePath] = "accepted";
    this.sidebar.refresh(this.changeSets, true, false, this.fileViewStates);
    vscode6.window.showInformationMessage(`\u2713 Accepted: ${change.relativePath}`);
    await this.saveUIState();
  }
  // ─── L2: Per-File Reject (Immediate + Auto-Snapshot) ─────────────────
  async rejectFile(arg) {
    if (!this.activeSession)
      return;
    const change = arg.change ? arg.change : arg;
    const wsRoot = this.findWorkspaceRootForFile(change.relativePath);
    if (!wsRoot)
      return;
    const cs = this.changeSets.get(wsRoot);
    const checkpoint = this.activeSession.folderCheckpoints[wsRoot];
    if (!cs || !checkpoint)
      return;
    await vscode6.commands.executeCommand("workbench.action.files.saveAll");
    try {
      const absPath = path12.join(wsRoot, change.relativePath);
      if (change.type !== "deleted") {
        const aiContent = await fs9.readFile(absPath);
        const aiHash = await this.objectStore.write(aiContent, absPath);
        this.aiSnapshotHashes.set(change.relativePath, aiHash);
      }
      if (change.type === "modified" || change.type === "deleted") {
        const plan = SelectiveRestorePlanner.buildSingleFilePlan(change, change.checkpointHash, wsRoot);
        await this.restoreService.execute(plan);
      } else if (change.type === "created") {
        const plan = SelectiveRestorePlanner.buildSingleFilePlan(change, null, wsRoot);
        await this.restoreService.execute(plan);
      }
      cs.decisions[change.relativePath] = "rejected";
      this.fileViewStates.set(change.relativePath, "original");
      this.sidebar.refresh(this.changeSets, true, false, this.fileViewStates);
      vscode6.window.showInformationMessage(`\u2717 Rejected: ${change.relativePath} (AI version saved \u2014 toggle back anytime)`);
      await this.saveUIState();
    } catch (err) {
      vscode6.window.showErrorMessage(`Failed to reject ${change.relativePath}: ${err.message}`);
    }
  }
  // ─── L3: Per-File Toggle ─────────────────────────────────────────────
  async toggleFile(arg) {
    if (!this.activeSession)
      return;
    const change = arg.change ? arg.change : arg;
    const wsRoot = this.findWorkspaceRootForFile(change.relativePath);
    if (!wsRoot)
      return;
    const checkpoint = this.activeSession.folderCheckpoints[wsRoot];
    if (!checkpoint)
      return;
    await vscode6.commands.executeCommand("workbench.action.files.saveAll");
    const currentState = this.fileViewStates.get(change.relativePath) || "ai";
    try {
      if (currentState === "ai") {
        const absPath = path12.join(wsRoot, change.relativePath);
        if (change.type !== "deleted") {
          const aiContent = await fs9.readFile(absPath);
          const aiHash = await this.objectStore.write(aiContent, absPath);
          this.aiSnapshotHashes.set(change.relativePath, aiHash);
        }
        if (change.type === "modified" || change.type === "deleted") {
          const plan = SelectiveRestorePlanner.buildSingleFilePlan(change, change.checkpointHash, wsRoot);
          await this.restoreService.execute(plan);
        } else if (change.type === "created") {
          const plan = SelectiveRestorePlanner.buildSingleFilePlan(change, null, wsRoot);
          await this.restoreService.execute(plan);
        }
        this.fileViewStates.set(change.relativePath, "original");
      } else {
        const aiHash = this.aiSnapshotHashes.get(change.relativePath);
        if (!aiHash && change.type !== "deleted") {
          vscode6.window.showWarningMessage(`No AI snapshot found for ${change.relativePath}.`);
          return;
        }
        if (change.type === "created" || change.type === "modified") {
          const plan = SelectiveRestorePlanner.buildSingleFilePlan(change, aiHash, wsRoot);
          await this.restoreService.execute(plan);
        } else if (change.type === "deleted") {
          const plan = SelectiveRestorePlanner.buildSingleFilePlan(change, null, wsRoot);
          await this.restoreService.execute(plan);
        }
        this.fileViewStates.set(change.relativePath, "ai");
      }
      this.sidebar.refresh(this.changeSets, true, false, this.fileViewStates);
      await this.saveUIState();
    } catch (err) {
      vscode6.window.showErrorMessage(`Toggle failed for ${change.relativePath}: ${err.message}`);
    }
  }
  // ─── L2: Finalize Session ────────────────────────────────────────────
  async finalize() {
    if (!this.activeSession)
      return;
    const pendingCount = this.countPendingDecisions();
    if (pendingCount > 0) {
      const action = await vscode6.window.showInformationMessage(
        `${pendingCount} file(s) have no decision yet. What should happen to them?`,
        "Accept Remaining",
        "Reject Remaining",
        "Cancel"
      );
      if (action === "Accept Remaining") {
        this.markAllPending("accepted");
      } else if (action === "Reject Remaining") {
        this.markAllPending("rejected");
        await this.executeSelectiveRestore();
      } else {
        return;
      }
    }
    await this.saveUIState();
    const session = this.activeSession;
    session.status = "accepted";
    session.finalizedAt = Date.now();
    for (const cp of Object.values(session.folderCheckpoints)) {
      cp.status = "accepted";
      cp.finalizedAt = session.finalizedAt;
      await this.checkpointService.updateCheckpoint(cp);
    }
    await this.checkpointService.updateSession(session);
    await this.cleanupSession();
    vscode6.window.showInformationMessage("AI Guard: Session finalized.");
  }
  // ─── Accept / Reject All ─────────────────────────────────────────────
  async acceptAll() {
    if (!this.activeSession)
      return;
    if (this.viewState === "original") {
      const choice = await vscode6.window.showWarningMessage(
        "You are currently viewing the Original state. Finalizing now will permanently discard the hidden AI changes. Continue?",
        "Discard AI Changes",
        "Cancel"
      );
      if (choice !== "Discard AI Changes")
        return;
    }
    this.markAllPending("accepted");
    await this.saveUIState();
    const session = this.activeSession;
    this.lastFinalizedSessionId = session.id;
    this.lastFinalizedAt = Date.now();
    session.status = "accepted";
    session.finalizedAt = this.lastFinalizedAt;
    for (const cp of Object.values(session.folderCheckpoints)) {
      cp.status = "accepted";
      cp.finalizedAt = this.lastFinalizedAt;
      await this.checkpointService.updateCheckpoint(cp);
    }
    await this.checkpointService.updateSession(session);
    await this.cleanupSession();
    const gracePeriodMin = vscode6.workspace.getConfiguration("jguard").get("undoGracePeriodMinutes", 5);
    vscode6.window.showInformationMessage(
      `AI Guard: Changes accepted. You can undo within ${gracePeriodMin} minutes.`,
      "Undo Accept"
    ).then(async (choice) => {
      if (choice === "Undo Accept" && this.lastFinalizedSessionId) {
        const elapsed = Date.now() - this.lastFinalizedAt;
        if (elapsed < gracePeriodMin * 60 * 1e3) {
          await this.undoAccept();
        } else {
          vscode6.window.showWarningMessage("Grace period expired. Cannot undo.");
        }
      }
    });
  }
  async rejectAll() {
    if (!this.activeSession)
      return;
    if (this.viewState === "original") {
      await this.cleanupSession();
      vscode6.window.showInformationMessage("AI Guard: Protection discarded. Original state kept.");
      return;
    }
    await vscode6.commands.executeCommand("workbench.action.files.saveAll");
    for (const [wsRoot, checkpoint] of Object.entries(this.activeSession.folderCheckpoints)) {
      const changeSet = await ChangeDetector.detectChanges(checkpoint, this.scanner, wsRoot, this.attributionEngine);
      const conflicts = await ConflictDetector.detect(changeSet, this.scanner, wsRoot);
      if (conflicts.length > 0) {
        this.statusBar.setState("conflict");
        const msg = `AI Guard: ${conflicts.length} conflict(s) detected in ${path12.basename(wsRoot)}. Conflicted files will be skipped.`;
        const choice = await vscode6.window.showWarningMessage(msg, "Proceed Anyway", "Cancel");
        if (choice !== "Proceed Anyway")
          return;
        await this.executeRestore(checkpoint, changeSet, conflicts, wsRoot);
      } else {
        await this.executeRestore(checkpoint, changeSet, [], wsRoot);
      }
    }
    this.markAllPending("rejected");
    await this.saveUIState();
    this.activeSession.status = "rejected";
    this.activeSession.finalizedAt = Date.now();
    await this.checkpointService.updateSession(this.activeSession);
    await this.cleanupSession();
    vscode6.window.showInformationMessage("AI Guard: Checkpoint discarded and safely reverted.");
  }
  // ─── L7: Undo Accept ────────────────────────────────────────────────
  async undoAccept() {
    if (!this.lastFinalizedSessionId)
      return;
    try {
      const session = await this.checkpointService.metadataStore.readSession(this.lastFinalizedSessionId);
      session.status = "active";
      for (const cp of Object.values(session.folderCheckpoints)) {
        cp.status = "active";
        cp.finalizedAt = void 0;
      }
      this.activeSession = session;
      this.lastFinalizedSessionId = null;
      this.lastFinalizedAt = 0;
      const lockFile = path12.join(this.checkpointService.metadataStore.storageBaseDir, "jguard.lock");
      await fs9.writeFile(lockFile, session.id, "utf-8");
      this.statusBar.setState("protecting");
      await this.refresh();
      vscode6.window.showInformationMessage("AI Guard: Accept undone. Protection resumed.");
    } catch (err) {
      vscode6.window.showErrorMessage(`Failed to undo accept: ${err.message}`);
    }
  }
  // ─── Internal Helpers ────────────────────────────────────────────────
  async saveUIState() {
    if (!this.activeSession)
      return;
    const decisions = {};
    for (const [wsRoot, cs] of this.changeSets.entries()) {
      decisions[wsRoot] = { ...cs.decisions };
    }
    this.activeSession.uiState = {
      decisions,
      fileViewStates: Object.fromEntries(this.fileViewStates),
      aiSnapshotHashes: Object.fromEntries(this.aiSnapshotHashes)
    };
    await this.checkpointService.updateSession(this.activeSession);
  }
  async executeRestore(cp, cs, conflicts, wsFolder) {
    this.statusBar.setState("restoring");
    const plan = RestorePlanner.buildPlan(cp, cs, conflicts, wsFolder);
    await this.restoreService.execute(plan);
  }
  async executeSelectiveRestore() {
    if (!this.activeSession)
      return;
    for (const [wsRoot, cs] of this.changeSets.entries()) {
      const checkpoint = this.activeSession.folderCheckpoints[wsRoot];
      if (!checkpoint)
        continue;
      const plan = SelectiveRestorePlanner.buildPlan(checkpoint, cs, [], wsRoot);
      if (plan.operations.length > 0) {
        this.statusBar.setState("restoring");
        await this.restoreService.execute(plan);
      }
    }
  }
  async cleanupSession() {
    this.activeSession = null;
    this.forwardSession = null;
    this.changeSets.clear();
    this.fileViewStates.clear();
    this.aiSnapshotHashes.clear();
    this.viewState = "ai";
    this.statusBar.setState("off");
    this.sidebar.refresh(null, false);
    await this.clearLockFile();
    this._onDidFinalizeSession.fire();
  }
  async clearLockFile() {
    const lockFile = path12.join(this.checkpointService.metadataStore.storageBaseDir, "jguard.lock");
    await fs9.unlink(lockFile).catch(() => {
    });
  }
  async createForwardSession() {
    const folders = vscode6.workspace.workspaceFolders;
    if (!folders)
      throw new Error("No workspace folders");
    const folderCheckpoints = {};
    for (const folder of folders) {
      const wsRoot = folder.uri.fsPath;
      const cp = await this.checkpointService.createCheckpoint(wsRoot);
      folderCheckpoints[wsRoot] = cp;
    }
    return {
      id: Date.now().toString(36) + Math.random().toString(36).substring(2),
      createdAt: Date.now(),
      folderCheckpoints,
      status: "active"
    };
  }
  /**
   * L1: Finds which workspace root owns a given relative path.
   */
  findWorkspaceRootForFile(relativePath) {
    for (const [wsRoot, cs] of this.changeSets.entries()) {
      if (cs.changes.some((c) => c.relativePath === relativePath)) {
        return wsRoot;
      }
    }
    const folders = vscode6.workspace.workspaceFolders;
    return folders && folders.length > 0 ? folders[0].uri.fsPath : null;
  }
  findWorkspaceRootForFileAbsolute(absolutePath) {
    const folders = vscode6.workspace.workspaceFolders;
    if (!folders)
      return null;
    let bestMatch = null;
    for (const folder of folders) {
      const root = folder.uri.fsPath;
      if (absolutePath.startsWith(root) && (!bestMatch || root.length > bestMatch.length)) {
        bestMatch = root;
      }
    }
    return bestMatch;
  }
  getTotalChangeCount() {
    let total = 0;
    for (const cs of this.changeSets.values()) {
      total += cs.changes.length;
    }
    return total;
  }
  countPendingDecisions() {
    let count = 0;
    for (const cs of this.changeSets.values()) {
      for (const decision of Object.values(cs.decisions)) {
        if (decision === "pending")
          count++;
      }
    }
    return count;
  }
  markAllPending(decision) {
    for (const cs of this.changeSets.values()) {
      for (const relPath of Object.keys(cs.decisions)) {
        if (cs.decisions[relPath] === "pending") {
          cs.decisions[relPath] = decision;
        }
      }
    }
  }
  // L6: Image file detection
  isImageFile(filePath) {
    const ext = path12.extname(filePath).toLowerCase();
    return [".png", ".jpg", ".jpeg", ".gif", ".svg", ".webp", ".ico", ".bmp"].includes(ext);
  }
  // L6: Open binary image comparison
  async openBinaryComparison(change, wsRoot) {
    try {
      const checkpoint = this.activeSession?.folderCheckpoints[wsRoot];
      if (!checkpoint)
        return;
      const snapshot = checkpoint.files[change.relativePath];
      if (!snapshot)
        return;
      const content = await this.objectStore.read(snapshot.hash);
      const tmpDir = path12.join(this.checkpointService.metadataStore.storageBaseDir, "tmp");
      await fs9.mkdir(tmpDir, { recursive: true });
      const tmpFile = path12.join(tmpDir, `checkpoint-${path12.basename(change.relativePath)}`);
      await fs9.writeFile(tmpFile, content);
      const originalUri = vscode6.Uri.file(tmpFile);
      const currentUri = vscode6.Uri.file(path12.join(wsRoot, change.relativePath));
      await vscode6.commands.executeCommand("vscode.open", originalUri, { viewColumn: vscode6.ViewColumn.One });
      await vscode6.commands.executeCommand("vscode.open", currentUri, { viewColumn: vscode6.ViewColumn.Two });
    } catch (err) {
      vscode6.window.showErrorMessage(`Failed to compare binary file: ${err.message}`);
    }
  }
};

// src/vscode/HistoryTreeProvider.ts
var vscode7 = __toESM(require("vscode"));
var path13 = __toESM(require("path"));
var HistorySessionTreeItem = class extends vscode7.TreeItem {
  constructor(label, session, collapsibleState) {
    super(label, collapsibleState);
    this.label = label;
    this.session = session;
    this.collapsibleState = collapsibleState;
    this.tooltip = `Session: ${session.id}
Status: ${session.status}`;
    if (session.status === "active") {
      this.iconPath = new vscode7.ThemeIcon("play-circle", new vscode7.ThemeColor("charts.blue"));
    } else if (session.status === "accepted") {
      this.iconPath = new vscode7.ThemeIcon("pass-filled", new vscode7.ThemeColor("charts.green"));
    } else if (session.status === "rejected") {
      this.iconPath = new vscode7.ThemeIcon("error", new vscode7.ThemeColor("charts.red"));
    } else {
      this.iconPath = new vscode7.ThemeIcon("history");
    }
    this.contextValue = "jguard.historyItem";
  }
};
var HistoryFileTreeItem = class extends vscode7.TreeItem {
  constructor(filePath, decision, wsRoot, origHash, aiHash) {
    super(filePath, vscode7.TreeItemCollapsibleState.None);
    this.filePath = filePath;
    this.decision = decision;
    this.wsRoot = wsRoot;
    this.origHash = origHash;
    this.aiHash = aiHash;
    this.description = decision;
    if (decision === "accepted") {
      this.iconPath = new vscode7.ThemeIcon("check", new vscode7.ThemeColor("charts.green"));
    } else if (decision === "rejected") {
      this.iconPath = new vscode7.ThemeIcon("close", new vscode7.ThemeColor("charts.red"));
    } else {
      this.iconPath = new vscode7.ThemeIcon("file");
    }
    this.tooltip = `${filePath} (${decision})
Click to view diff`;
    let originalUri;
    if (origHash) {
      originalUri = vscode7.Uri.parse(`${DiffProvider.scheme}://${origHash}/${path13.basename(filePath)}`);
    } else {
      originalUri = vscode7.Uri.parse(`${DiffProvider.scheme}://empty/${path13.basename(filePath)}`);
    }
    let rightUri;
    if (aiHash) {
      rightUri = vscode7.Uri.parse(`${DiffProvider.scheme}://${aiHash}/${path13.basename(filePath)}`);
    } else {
      rightUri = vscode7.Uri.file(path13.join(wsRoot, filePath));
    }
    this.command = {
      command: "vscode.diff",
      title: "Open History Diff",
      arguments: [originalUri, rightUri, `${path13.basename(filePath)} (Checkpoint \u2194 ${decision.toUpperCase()})`]
    };
    this.contextValue = "jguard.historyFileItem";
  }
};
var HistoryTreeProvider = class {
  constructor(metadataStore) {
    this.metadataStore = metadataStore;
  }
  _onDidChangeTreeData = new vscode7.EventEmitter();
  onDidChangeTreeData = this._onDidChangeTreeData.event;
  refresh() {
    this._onDidChangeTreeData.fire();
  }
  getTreeItem(element) {
    return element;
  }
  async getChildren(element) {
    if (element instanceof HistorySessionTreeItem) {
      const session = element.session;
      const fileItems = [];
      if (session.uiState?.decisions) {
        for (const [wsRoot, rootDecisions] of Object.entries(session.uiState.decisions)) {
          const cp = session.folderCheckpoints[wsRoot];
          for (const [filePath, decision] of Object.entries(rootDecisions)) {
            const origHash = cp?.files[filePath]?.hash || "";
            const aiHash = session.uiState.aiSnapshotHashes?.[filePath];
            fileItems.push(new HistoryFileTreeItem(filePath, decision, wsRoot, origHash, aiHash));
          }
        }
      }
      return fileItems;
    }
    if (element instanceof HistoryFileTreeItem) {
      return [];
    }
    try {
      const sessionIds = await this.metadataStore.listSessions();
      const sessions = [];
      for (const id of sessionIds) {
        try {
          const session = await this.metadataStore.readSession(id);
          sessions.push(session);
        } catch (e) {
          console.error(`Failed to read session ${id}`, e);
        }
      }
      sessions.sort((a, b) => b.createdAt - a.createdAt);
      return sessions.map((session) => {
        const date = new Date(session.createdAt);
        let decisionCount = 0;
        if (session.uiState?.decisions) {
          for (const rd of Object.values(session.uiState.decisions)) {
            decisionCount += Object.keys(rd).length;
          }
        }
        const countSuffix = decisionCount > 0 ? ` (${decisionCount} files)` : "";
        const label = `${date.toLocaleDateString()} ${date.toLocaleTimeString()} - ${session.status}${countSuffix}`;
        const hasChildren = decisionCount > 0;
        return new HistorySessionTreeItem(
          label,
          session,
          hasChildren ? vscode7.TreeItemCollapsibleState.Collapsed : vscode7.TreeItemCollapsibleState.None
        );
      });
    } catch (e) {
      console.error("Failed to load history", e);
      return [];
    }
  }
};

// src/vscode/CheckpointDetailWebview.ts
var vscode8 = __toESM(require("vscode"));
var path14 = __toESM(require("path"));
var CheckpointDetailWebview = class _CheckpointDetailWebview {
  static viewType = "jguard.checkpointDetail";
  static show(context, session) {
    const column = vscode8.window.activeTextEditor ? vscode8.window.activeTextEditor.viewColumn : vscode8.ViewColumn.One;
    const panel = vscode8.window.createWebviewPanel(
      _CheckpointDetailWebview.viewType,
      `Session: ${new Date(session.createdAt).toLocaleTimeString()}`,
      column || vscode8.ViewColumn.One,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
        localResourceRoots: [vscode8.Uri.joinPath(context.extensionUri, "media")]
      }
    );
    panel.webview.html = _CheckpointDetailWebview.getHtmlForWebview(panel.webview, session);
    panel.webview.onDidReceiveMessage(async (message) => {
      if (message.command === "openDiff") {
        const { wsRoot, filePath, originalHash, aiHash, decision } = message;
        try {
          let originalUri;
          if (originalHash && originalHash !== "undefined" && originalHash !== "") {
            originalUri = vscode8.Uri.parse(`${DiffProvider.scheme}://${originalHash}/${path14.basename(filePath)}`);
          } else {
            originalUri = vscode8.Uri.parse(`${DiffProvider.scheme}://empty/${path14.basename(filePath)}`);
          }
          let rightUri;
          if (aiHash && aiHash !== "undefined" && aiHash !== "") {
            rightUri = vscode8.Uri.parse(`${DiffProvider.scheme}://${aiHash}/${path14.basename(filePath)}`);
          } else {
            rightUri = vscode8.Uri.file(path14.join(wsRoot, filePath));
          }
          const title = `${path14.basename(filePath)} (Checkpoint \u2194 ${decision.toUpperCase()})`;
          await vscode8.commands.executeCommand("vscode.diff", originalUri, rightUri, title);
        } catch (err) {
          vscode8.window.showErrorMessage(`Failed to open diff for ${filePath}: ${err.message}`);
        }
      }
    });
  }
  static getHtmlForWebview(webview, session) {
    const date = new Date(session.createdAt);
    let totalFiles = 0;
    let accepted = 0;
    let rejected = 0;
    let pending = 0;
    for (const cp of Object.values(session.folderCheckpoints)) {
      totalFiles += Object.keys(cp.files).length;
    }
    if (session.uiState?.decisions) {
      for (const rootDecisions of Object.values(session.uiState.decisions)) {
        for (const decision of Object.values(rootDecisions)) {
          if (decision === "accepted")
            accepted++;
          else if (decision === "rejected")
            rejected++;
          else if (decision === "pending")
            pending++;
        }
      }
    }
    const duration = session.finalizedAt ? Math.round((session.finalizedAt - session.createdAt) / 1e3 / 60) + " minutes" : "Ongoing";
    return `
      <!DOCTYPE html>
      <html lang="en">
      <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Session Details</title>
          <style>
              body { 
                font-family: var(--vscode-font-family); 
                padding: 24px; 
                color: var(--vscode-foreground); 
                line-height: 1.5;
              }
              h1 { 
                border-bottom: 1px solid var(--vscode-panel-border); 
                padding-bottom: 12px; 
                margin-top: 0;
                display: flex;
                align-items: center;
                gap: 8px;
              }
              .session-meta {
                display: flex;
                gap: 24px;
                background-color: var(--vscode-editor-background);
                padding: 12px 16px;
                border: 1px solid var(--vscode-panel-border);
                border-radius: 6px;
                margin-bottom: 20px;
                font-size: 13px;
              }
              .meta-item {
                display: flex;
                flex-direction: column;
              }
              .meta-item strong {
                color: var(--vscode-descriptionForeground);
                font-size: 11px;
                text-transform: uppercase;
                letter-spacing: 0.5px;
              }
              .stat-container {
                display: flex;
                gap: 12px;
                margin-bottom: 24px;
              }
              .stat-box { 
                  flex: 1;
                  padding: 16px; 
                  background-color: var(--vscode-editor-background);
                  border: 1px solid var(--vscode-panel-border);
                  border-radius: 6px;
              }
              .stat-value { font-size: 28px; font-weight: bold; margin-bottom: 4px; }
              .stat-label { font-size: 11px; color: var(--vscode-descriptionForeground); text-transform: uppercase; font-weight: 600; }
              
              .decisions-section { margin-top: 24px; }
              .decisions-section h2 { font-size: 16px; margin-bottom: 12px; }
              .decisions-list { display: flex; flex-direction: column; gap: 8px; }
              
              .decision-item { 
                  display: flex;
                  align-items: center;
                  justify-content: space-between;
                  padding: 10px 14px; 
                  background-color: var(--vscode-editor-background);
                  border: 1px solid var(--vscode-panel-border); 
                  border-radius: 6px;
                  cursor: pointer;
                  transition: background-color 0.15s ease, border-color 0.15s ease;
              }
              .decision-item:hover {
                  background-color: var(--vscode-list-hoverBackground);
                  border-color: var(--vscode-focusBorder);
              }
              .decision-left {
                display: flex;
                align-items: center;
                gap: 10px;
                font-family: var(--vscode-editor-font-family);
                font-size: 13px;
              }
              .decision-badge {
                display: inline-flex;
                align-items: center;
                gap: 4px;
                font-size: 11px;
                font-weight: 600;
                padding: 2px 8px;
                border-radius: 12px;
                text-transform: uppercase;
              }
              .badge-accept { 
                color: var(--vscode-testing-iconPassed); 
                background-color: rgba(78, 201, 176, 0.15);
              }
              .badge-reject { 
                color: var(--vscode-testing-iconFailed); 
                background-color: rgba(241, 76, 76, 0.15);
              }
              .badge-pending { 
                color: var(--vscode-testing-iconQueued); 
                background-color: rgba(204, 204, 204, 0.15);
              }
              .diff-btn {
                font-size: 12px;
                color: var(--vscode-textLink-foreground);
                display: flex;
                align-items: center;
                gap: 4px;
              }
              .hint-text {
                font-size: 12px;
                color: var(--vscode-descriptionForeground);
                margin-top: 6px;
              }
          </style>
      </head>
      <body>
          <h1>\u{1F6E1}\uFE0F Session Details</h1>
          
          <div class="session-meta">
            <div class="meta-item">
              <strong>Session ID</strong>
              <span>${session.id}</span>
            </div>
            <div class="meta-item">
              <strong>Status</strong>
              <span style="font-weight: bold;">${session.status.toUpperCase()}</span>
            </div>
            <div class="meta-item">
              <strong>Started</strong>
              <span>${date.toLocaleDateString()} ${date.toLocaleTimeString()}</span>
            </div>
            <div class="meta-item">
              <strong>Duration</strong>
              <span>${duration}</span>
            </div>
          </div>
          
          <div class="stat-container">
              <div class="stat-box">
                  <div class="stat-value">${totalFiles}</div>
                  <div class="stat-label">Tracked Files</div>
              </div>
              <div class="stat-box">
                  <div class="stat-value" style="color: var(--vscode-testing-iconPassed);">${accepted}</div>
                  <div class="stat-label">Accepted Changes</div>
              </div>
              <div class="stat-box">
                  <div class="stat-value" style="color: var(--vscode-testing-iconFailed);">${rejected}</div>
                  <div class="stat-label">Rejected Changes</div>
              </div>
              <div class="stat-box">
                  <div class="stat-value" style="color: var(--vscode-testing-iconQueued);">${pending}</div>
                  <div class="stat-label">Pending Changes</div>
              </div>
          </div>
          
          <div class="decisions-section">
              <h2>File Decisions</h2>
              <div class="hint-text">Click any file below to inspect the diff comparison.</div>
              <div class="decisions-list" style="margin-top: 12px;">
                ${this.renderDecisions(session)}
              </div>
          </div>

          <script>
            const vscode = acquireVsCodeApi();
            function viewFileDiff(wsRoot, filePath, originalHash, aiHash, decision) {
              vscode.postMessage({
                command: 'openDiff',
                wsRoot: wsRoot,
                filePath: filePath,
                originalHash: originalHash,
                aiHash: aiHash,
                decision: decision
              });
            }
          </script>
      </body>
      </html>
    `;
  }
  static renderDecisions(session) {
    if (!session.uiState?.decisions || Object.keys(session.uiState.decisions).length === 0) {
      return '<p style="color: var(--vscode-descriptionForeground);">No file changes or decisions were recorded in this session.</p>';
    }
    let html = "";
    for (const [wsRoot, rootDecisions] of Object.entries(session.uiState.decisions)) {
      const checkpoint = session.folderCheckpoints[wsRoot];
      for (const [filePath, decision] of Object.entries(rootDecisions)) {
        let badgeClass = "";
        let icon = "";
        if (decision === "accepted") {
          badgeClass = "badge-accept";
          icon = "\u2713";
        } else if (decision === "rejected") {
          badgeClass = "badge-reject";
          icon = "\u2717";
        } else {
          badgeClass = "badge-pending";
          icon = "\u25CB";
        }
        const origHash = checkpoint?.files[filePath]?.hash || "";
        const aiHash = session.uiState?.aiSnapshotHashes?.[filePath] || "";
        html += `
          <div class="decision-item" onclick="viewFileDiff('${wsRoot.replace(/'/g, "\\'")}', '${filePath.replace(/'/g, "\\'")}', '${origHash}', '${aiHash}', '${decision}')">
            <div class="decision-left">
              <span class="decision-badge ${badgeClass}">${icon} ${decision}</span>
              <span><strong>${filePath}</strong></span>
            </div>
            <div class="diff-btn">
              <span>View Diff \u2197</span>
            </div>
          </div>
        `;
      }
    }
    return html;
  }
};

// src/vscode/CodeLensProvider.ts
var vscode9 = __toESM(require("vscode"));

// node_modules/diff/libesm/diff/base.js
var Diff = class {
  diff(oldStr, newStr, options = {}) {
    let callback;
    if (typeof options === "function") {
      callback = options;
      options = {};
    } else if ("callback" in options) {
      callback = options.callback;
    }
    const oldString = this.castInput(oldStr, options);
    const newString = this.castInput(newStr, options);
    const oldTokens = this.removeEmpty(this.tokenize(oldString, options));
    const newTokens = this.removeEmpty(this.tokenize(newString, options));
    return this.diffWithOptionsObj(oldTokens, newTokens, options, callback);
  }
  diffWithOptionsObj(oldTokens, newTokens, options, callback) {
    var _a;
    const done = (value) => {
      value = this.postProcess(value, options);
      if (callback) {
        setTimeout(function() {
          callback(value);
        }, 0);
        return void 0;
      } else {
        return value;
      }
    };
    const newLen = newTokens.length, oldLen = oldTokens.length;
    let editLength = 1;
    let maxEditLength = newLen + oldLen;
    if (options.maxEditLength != null) {
      maxEditLength = Math.min(maxEditLength, options.maxEditLength);
    }
    const maxExecutionTime = (_a = options.timeout) !== null && _a !== void 0 ? _a : Infinity;
    const abortAfterTimestamp = Date.now() + maxExecutionTime;
    const bestPath = [{ oldPos: -1, lastComponent: void 0 }];
    let newPos = this.extractCommon(bestPath[0], newTokens, oldTokens, 0, options);
    if (bestPath[0].oldPos + 1 >= oldLen && newPos + 1 >= newLen) {
      return done(this.buildValues(bestPath[0].lastComponent, newTokens, oldTokens));
    }
    let minDiagonalToConsider = -Infinity, maxDiagonalToConsider = Infinity;
    const execEditLength = () => {
      for (let diagonalPath = Math.max(minDiagonalToConsider, -editLength); diagonalPath <= Math.min(maxDiagonalToConsider, editLength); diagonalPath += 2) {
        let basePath;
        const removePath = bestPath[diagonalPath - 1], addPath = bestPath[diagonalPath + 1];
        if (removePath) {
          bestPath[diagonalPath - 1] = void 0;
        }
        let canAdd = false;
        if (addPath) {
          const addPathNewPos = addPath.oldPos - diagonalPath;
          canAdd = addPath && 0 <= addPathNewPos && addPathNewPos < newLen;
        }
        const canRemove = removePath && removePath.oldPos + 1 < oldLen;
        if (!canAdd && !canRemove) {
          bestPath[diagonalPath] = void 0;
          continue;
        }
        if (!canRemove || canAdd && removePath.oldPos < addPath.oldPos) {
          basePath = this.addToPath(addPath, true, false, 0, options);
        } else {
          basePath = this.addToPath(removePath, false, true, 1, options);
        }
        newPos = this.extractCommon(basePath, newTokens, oldTokens, diagonalPath, options);
        if (basePath.oldPos + 1 >= oldLen && newPos + 1 >= newLen) {
          return done(this.buildValues(basePath.lastComponent, newTokens, oldTokens)) || true;
        } else {
          bestPath[diagonalPath] = basePath;
          if (basePath.oldPos + 1 >= oldLen) {
            maxDiagonalToConsider = Math.min(maxDiagonalToConsider, diagonalPath - 1);
          }
          if (newPos + 1 >= newLen) {
            minDiagonalToConsider = Math.max(minDiagonalToConsider, diagonalPath + 1);
          }
        }
      }
      editLength++;
    };
    if (callback) {
      (function exec() {
        setTimeout(function() {
          if (editLength > maxEditLength || Date.now() > abortAfterTimestamp) {
            return callback(void 0);
          }
          if (!execEditLength()) {
            exec();
          }
        }, 0);
      })();
    } else {
      while (editLength <= maxEditLength && Date.now() <= abortAfterTimestamp) {
        const ret = execEditLength();
        if (ret) {
          return ret;
        }
      }
    }
  }
  addToPath(path19, added, removed, oldPosInc, options) {
    const last = path19.lastComponent;
    if (last && !options.oneChangePerToken && last.added === added && last.removed === removed) {
      return {
        oldPos: path19.oldPos + oldPosInc,
        lastComponent: { count: last.count + 1, added, removed, previousComponent: last.previousComponent }
      };
    } else {
      return {
        oldPos: path19.oldPos + oldPosInc,
        lastComponent: { count: 1, added, removed, previousComponent: last }
      };
    }
  }
  extractCommon(basePath, newTokens, oldTokens, diagonalPath, options) {
    const newLen = newTokens.length, oldLen = oldTokens.length;
    let oldPos = basePath.oldPos, newPos = oldPos - diagonalPath, commonCount = 0;
    while (newPos + 1 < newLen && oldPos + 1 < oldLen && this.equals(oldTokens[oldPos + 1], newTokens[newPos + 1], options)) {
      newPos++;
      oldPos++;
      commonCount++;
      if (options.oneChangePerToken) {
        basePath.lastComponent = { count: 1, previousComponent: basePath.lastComponent, added: false, removed: false };
      }
    }
    if (commonCount && !options.oneChangePerToken) {
      basePath.lastComponent = { count: commonCount, previousComponent: basePath.lastComponent, added: false, removed: false };
    }
    basePath.oldPos = oldPos;
    return newPos;
  }
  equals(left, right, options) {
    if (options.comparator) {
      return options.comparator(left, right);
    } else {
      return left === right || !!options.ignoreCase && left.toLowerCase() === right.toLowerCase();
    }
  }
  removeEmpty(array) {
    const ret = [];
    for (let i = 0; i < array.length; i++) {
      if (array[i]) {
        ret.push(array[i]);
      }
    }
    return ret;
  }
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  castInput(value, options) {
    return value;
  }
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  tokenize(value, options) {
    return Array.from(value);
  }
  join(chars) {
    return chars.join("");
  }
  postProcess(changeObjects, options) {
    return changeObjects;
  }
  get useLongestToken() {
    return false;
  }
  buildValues(lastComponent, newTokens, oldTokens) {
    const components = [];
    let nextComponent;
    while (lastComponent) {
      components.push(lastComponent);
      nextComponent = lastComponent.previousComponent;
      delete lastComponent.previousComponent;
      lastComponent = nextComponent;
    }
    components.reverse();
    const componentLen = components.length;
    let componentPos = 0, newPos = 0, oldPos = 0;
    for (; componentPos < componentLen; componentPos++) {
      const component = components[componentPos];
      if (!component.removed) {
        if (!component.added && this.useLongestToken) {
          let value = newTokens.slice(newPos, newPos + component.count);
          value = value.map(function(value2, i) {
            const oldValue = oldTokens[oldPos + i];
            return oldValue.length > value2.length ? oldValue : value2;
          });
          component.value = this.join(value);
        } else {
          component.value = this.join(newTokens.slice(newPos, newPos + component.count));
        }
        newPos += component.count;
        if (!component.added) {
          oldPos += component.count;
        }
      } else {
        component.value = this.join(oldTokens.slice(oldPos, oldPos + component.count));
        oldPos += component.count;
      }
    }
    return components;
  }
};

// node_modules/diff/libesm/diff/line.js
var LineDiff = class extends Diff {
  constructor() {
    super(...arguments);
    this.tokenize = tokenize;
  }
  equals(left, right, options) {
    if (options.ignoreWhitespace) {
      if (!options.newlineIsToken || !left.includes("\n")) {
        left = left.trim();
      }
      if (!options.newlineIsToken || !right.includes("\n")) {
        right = right.trim();
      }
    } else if (options.ignoreNewlineAtEof && !options.newlineIsToken) {
      if (left.endsWith("\n")) {
        left = left.slice(0, -1);
      }
      if (right.endsWith("\n")) {
        right = right.slice(0, -1);
      }
    }
    return super.equals(left, right, options);
  }
};
var lineDiff = new LineDiff();
function diffLines(oldStr, newStr, options) {
  return lineDiff.diff(oldStr, newStr, options);
}
function tokenize(value, options) {
  if (options.stripTrailingCr) {
    value = value.replace(/\r\n/g, "\n");
  }
  const retLines = [], linesAndNewlines = value.split(/(\n|\r\n)/);
  if (!linesAndNewlines[linesAndNewlines.length - 1]) {
    linesAndNewlines.pop();
  }
  for (let i = 0; i < linesAndNewlines.length; i++) {
    const line = linesAndNewlines[i];
    if (i % 2 && !options.newlineIsToken) {
      retLines[retLines.length - 1] += line;
    } else {
      retLines.push(line);
    }
  }
  return retLines;
}

// node_modules/diff/libesm/patch/parse.js
function parsePatch(uniDiff) {
  const diffstr = uniDiff.split(/\n/), list = [];
  let i = 0;
  function isGitDiffHeader(line) {
    return /^diff --git /.test(line);
  }
  function isDiffHeader(line) {
    return isGitDiffHeader(line) || /^Index:\s/.test(line) || /^diff(?: -r \w+)+\s/.test(line);
  }
  function isFileHeader(line) {
    return /^(---|\+\+\+)\s/.test(line);
  }
  function isHunkHeader(line) {
    return /^@@\s/.test(line);
  }
  function parseIndex() {
    var _a;
    const index = {};
    index.hunks = [];
    list.push(index);
    let seenDiffHeader = false;
    while (i < diffstr.length) {
      const line = diffstr[i];
      if (isFileHeader(line) || isHunkHeader(line)) {
        break;
      }
      if (isGitDiffHeader(line)) {
        if (seenDiffHeader) {
          return;
        }
        seenDiffHeader = true;
        index.isGit = true;
        const paths = parseGitDiffHeader(line);
        if (paths) {
          index.oldFileName = paths.oldFileName;
          index.newFileName = paths.newFileName;
        }
        i++;
        while (i < diffstr.length) {
          const extLine = diffstr[i];
          if (isFileHeader(extLine) || isHunkHeader(extLine) || isDiffHeader(extLine)) {
            break;
          }
          const renameFromMatch = /^rename from (.*)/.exec(extLine);
          if (renameFromMatch) {
            index.oldFileName = "a/" + unquoteIfQuoted(renameFromMatch[1]);
            index.isRename = true;
          }
          const renameToMatch = /^rename to (.*)/.exec(extLine);
          if (renameToMatch) {
            index.newFileName = "b/" + unquoteIfQuoted(renameToMatch[1]);
            index.isRename = true;
          }
          const copyFromMatch = /^copy from (.*)/.exec(extLine);
          if (copyFromMatch) {
            index.oldFileName = "a/" + unquoteIfQuoted(copyFromMatch[1]);
            index.isCopy = true;
          }
          const copyToMatch = /^copy to (.*)/.exec(extLine);
          if (copyToMatch) {
            index.newFileName = "b/" + unquoteIfQuoted(copyToMatch[1]);
            index.isCopy = true;
          }
          const newFileModeMatch = /^new file mode (\d+)/.exec(extLine);
          if (newFileModeMatch) {
            index.isCreate = true;
            index.newMode = newFileModeMatch[1];
          }
          const deletedFileModeMatch = /^deleted file mode (\d+)/.exec(extLine);
          if (deletedFileModeMatch) {
            index.isDelete = true;
            index.oldMode = deletedFileModeMatch[1];
          }
          const oldModeMatch = /^old mode (\d+)/.exec(extLine);
          if (oldModeMatch) {
            index.oldMode = oldModeMatch[1];
          }
          const newModeMatch = /^new mode (\d+)/.exec(extLine);
          if (newModeMatch) {
            index.newMode = newModeMatch[1];
          }
          if (/^Binary files /.test(extLine)) {
            index.isBinary = true;
          }
          i++;
        }
        continue;
      } else if (isDiffHeader(line)) {
        if (seenDiffHeader) {
          return;
        }
        seenDiffHeader = true;
        const headerMatch = /^(?:Index:|diff(?: -r \w+)+)\s+/.exec(line);
        if (headerMatch) {
          index.index = line.substring(headerMatch[0].length).trim();
        }
      }
      i++;
    }
    parseFileHeader(index);
    parseFileHeader(index);
    if (index.oldFileName === void 0 !== (index.newFileName === void 0)) {
      throw new Error("Missing " + (index.oldFileName !== void 0 ? '"+++ ..."' : '"--- ..."') + " file header for " + ((_a = index.oldFileName) !== null && _a !== void 0 ? _a : index.newFileName));
    }
    while (i < diffstr.length) {
      const line = diffstr[i];
      if (isDiffHeader(line) || isFileHeader(line) || /^===================================================================/.test(line)) {
        break;
      } else if (isHunkHeader(line)) {
        index.hunks.push(parseHunk());
      } else {
        i++;
      }
    }
  }
  function parseGitDiffHeader(line) {
    const rest = line.substring("diff --git ".length);
    if (rest.startsWith('"')) {
      const oldPath = parseQuotedFileName(rest);
      if (oldPath === null) {
        return null;
      }
      const afterOld = rest.substring(oldPath.rawLength + 1);
      let newFileName;
      if (afterOld.startsWith('"')) {
        const newPath = parseQuotedFileName(afterOld);
        if (newPath === null) {
          return null;
        }
        newFileName = newPath.fileName;
      } else {
        newFileName = afterOld;
      }
      return {
        oldFileName: oldPath.fileName,
        newFileName
      };
    }
    const quoteIdx = rest.indexOf('"');
    if (quoteIdx > 0) {
      const oldFileName = rest.substring(0, quoteIdx - 1);
      const newPath = parseQuotedFileName(rest.substring(quoteIdx));
      if (newPath === null) {
        return null;
      }
      return {
        oldFileName,
        newFileName: newPath.fileName
      };
    }
    if (rest.startsWith("a/")) {
      const splits = [];
      let idx = 0;
      while (true) {
        idx = rest.indexOf(" b/", idx + 1);
        if (idx === -1) {
          break;
        }
        splits.push(idx);
      }
      if (splits.length > 0) {
        const mid = splits[Math.floor(splits.length / 2)];
        return {
          oldFileName: rest.substring(0, mid),
          newFileName: rest.substring(mid + 1)
        };
      }
    }
    return null;
  }
  function unquoteIfQuoted(s) {
    if (s.startsWith('"')) {
      const parsed = parseQuotedFileName(s);
      if (parsed) {
        return parsed.fileName;
      }
    }
    return s;
  }
  function parseQuotedFileName(s) {
    if (!s.startsWith('"')) {
      return null;
    }
    let result = "";
    let j = 1;
    while (j < s.length) {
      if (s[j] === '"') {
        return { fileName: result, rawLength: j + 1 };
      }
      if (s[j] === "\\" && j + 1 < s.length) {
        j++;
        switch (s[j]) {
          case "a":
            result += "\x07";
            break;
          case "b":
            result += "\b";
            break;
          case "f":
            result += "\f";
            break;
          case "n":
            result += "\n";
            break;
          case "r":
            result += "\r";
            break;
          case "t":
            result += "	";
            break;
          case "v":
            result += "\v";
            break;
          case "\\":
            result += "\\";
            break;
          case '"':
            result += '"';
            break;
          case "0":
          case "1":
          case "2":
          case "3":
          case "4":
          case "5":
          case "6":
          case "7": {
            if (j + 2 >= s.length || s[j + 1] < "0" || s[j + 1] > "7" || s[j + 2] < "0" || s[j + 2] > "7") {
              return null;
            }
            const bytes = [parseInt(s.substring(j, j + 3), 8)];
            j += 3;
            while (s[j] === "\\" && s[j + 1] >= "0" && s[j + 1] <= "7") {
              if (j + 3 >= s.length || s[j + 2] < "0" || s[j + 2] > "7" || s[j + 3] < "0" || s[j + 3] > "7") {
                return null;
              }
              bytes.push(parseInt(s.substring(j + 1, j + 4), 8));
              j += 4;
            }
            result += new TextDecoder("utf-8").decode(new Uint8Array(bytes));
            continue;
          }
          default:
            return null;
        }
      } else {
        result += s[j];
      }
      j++;
    }
    return null;
  }
  function parseFileHeader(index) {
    const fileHeaderMatch = /^(---|\+\+\+)\s+/.exec(diffstr[i]);
    if (fileHeaderMatch) {
      const prefix = fileHeaderMatch[1], data = diffstr[i].substring(3).trim().split("	", 2), header = (data[1] || "").trim();
      let fileName = data[0];
      if (fileName.startsWith('"')) {
        fileName = unquoteIfQuoted(fileName);
      } else {
        fileName = fileName.replace(/\\\\/g, "\\");
      }
      if (prefix === "---") {
        index.oldFileName = fileName;
        index.oldHeader = header;
      } else {
        index.newFileName = fileName;
        index.newHeader = header;
      }
      i++;
    }
  }
  function parseHunk() {
    var _a;
    const chunkHeaderIndex = i, chunkHeaderLine = diffstr[i++], chunkHeader = chunkHeaderLine.split(/@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@/);
    const hunk = {
      oldStart: +chunkHeader[1],
      oldLines: typeof chunkHeader[2] === "undefined" ? 1 : +chunkHeader[2],
      newStart: +chunkHeader[3],
      newLines: typeof chunkHeader[4] === "undefined" ? 1 : +chunkHeader[4],
      lines: []
    };
    if (hunk.oldLines === 0) {
      hunk.oldStart += 1;
    }
    if (hunk.newLines === 0) {
      hunk.newStart += 1;
    }
    let addCount = 0, removeCount = 0;
    for (; i < diffstr.length && (removeCount < hunk.oldLines || addCount < hunk.newLines || ((_a = diffstr[i]) === null || _a === void 0 ? void 0 : _a.startsWith("\\"))); i++) {
      const operation = diffstr[i].length == 0 && i != diffstr.length - 1 ? " " : diffstr[i][0];
      if (operation === "+" || operation === "-" || operation === " " || operation === "\\") {
        hunk.lines.push(diffstr[i]);
        if (operation === "+") {
          addCount++;
        } else if (operation === "-") {
          removeCount++;
        } else if (operation === " ") {
          addCount++;
          removeCount++;
        }
      } else {
        throw new Error(`Hunk at line ${chunkHeaderIndex + 1} contained invalid line ${diffstr[i]}`);
      }
    }
    if (!addCount && hunk.newLines === 1) {
      hunk.newLines = 0;
    }
    if (!removeCount && hunk.oldLines === 1) {
      hunk.oldLines = 0;
    }
    if (addCount !== hunk.newLines) {
      throw new Error("Added line count did not match for hunk at line " + (chunkHeaderIndex + 1));
    }
    if (removeCount !== hunk.oldLines) {
      throw new Error("Removed line count did not match for hunk at line " + (chunkHeaderIndex + 1));
    }
    if (i < diffstr.length && diffstr[i] && /^[+ -]/.test(diffstr[i]) && !isFileHeader(diffstr[i])) {
      throw new Error("Hunk at line " + (chunkHeaderIndex + 1) + " has more lines than expected (expected " + hunk.oldLines + " old lines and " + hunk.newLines + " new lines)");
    }
    return hunk;
  }
  while (i < diffstr.length) {
    parseIndex();
  }
  return list;
}

// node_modules/diff/libesm/patch/create.js
function needsQuoting(s) {
  for (let i = 0; i < s.length; i++) {
    if (s[i] < " " || s[i] > "~" || s[i] === '"' || s[i] === "\\") {
      return true;
    }
  }
  return false;
}
function quoteFileNameIfNeeded(s) {
  if (!needsQuoting(s)) {
    return s;
  }
  let result = '"';
  const bytes = new TextEncoder().encode(s);
  let i = 0;
  while (i < bytes.length) {
    const b = bytes[i];
    if (b === 7) {
      result += "\\a";
    } else if (b === 8) {
      result += "\\b";
    } else if (b === 9) {
      result += "\\t";
    } else if (b === 10) {
      result += "\\n";
    } else if (b === 11) {
      result += "\\v";
    } else if (b === 12) {
      result += "\\f";
    } else if (b === 13) {
      result += "\\r";
    } else if (b === 34) {
      result += '\\"';
    } else if (b === 92) {
      result += "\\\\";
    } else if (b >= 32 && b <= 126) {
      result += String.fromCharCode(b);
    } else {
      result += "\\" + b.toString(8).padStart(3, "0");
    }
    i++;
  }
  result += '"';
  return result;
}
var INCLUDE_HEADERS = {
  includeIndex: true,
  includeUnderline: true,
  includeFileHeaders: true
};
function structuredPatch(oldFileName, newFileName, oldStr, newStr, oldHeader, newHeader, options) {
  let optionsObj;
  if (!options) {
    optionsObj = {};
  } else if (typeof options === "function") {
    optionsObj = { callback: options };
  } else {
    optionsObj = options;
  }
  if (typeof optionsObj.context === "undefined") {
    optionsObj.context = 4;
  }
  const context = optionsObj.context;
  if (optionsObj.newlineIsToken) {
    throw new Error("newlineIsToken may not be used with patch-generation functions, only with diffing functions");
  }
  if (!optionsObj.callback) {
    return diffLinesResultToPatch(diffLines(oldStr, newStr, optionsObj));
  } else {
    const { callback } = optionsObj;
    diffLines(oldStr, newStr, Object.assign(Object.assign({}, optionsObj), { callback: (diff) => {
      const patch = diffLinesResultToPatch(diff);
      callback(patch);
    } }));
  }
  function diffLinesResultToPatch(diff) {
    if (!diff) {
      return;
    }
    diff.push({ value: "", lines: [] });
    function contextLines(lines) {
      return lines.map(function(entry) {
        return " " + entry;
      });
    }
    const hunks = [];
    let oldRangeStart = 0, newRangeStart = 0, curRange = [], oldLine = 1, newLine = 1;
    for (let i = 0; i < diff.length; i++) {
      const current = diff[i], lines = current.lines || splitLines(current.value);
      current.lines = lines;
      if (current.added || current.removed) {
        if (!oldRangeStart) {
          const prev = diff[i - 1];
          oldRangeStart = oldLine;
          newRangeStart = newLine;
          if (prev) {
            curRange = context > 0 ? contextLines(prev.lines.slice(-context)) : [];
            oldRangeStart -= curRange.length;
            newRangeStart -= curRange.length;
          }
        }
        for (const line of lines) {
          curRange.push((current.added ? "+" : "-") + line);
        }
        if (current.added) {
          newLine += lines.length;
        } else {
          oldLine += lines.length;
        }
      } else {
        if (oldRangeStart) {
          if (lines.length <= context * 2 && i < diff.length - 2) {
            for (const line of contextLines(lines)) {
              curRange.push(line);
            }
          } else {
            const contextSize = Math.min(lines.length, context);
            for (const line of contextLines(lines.slice(0, contextSize))) {
              curRange.push(line);
            }
            const hunk = {
              oldStart: oldRangeStart,
              oldLines: oldLine - oldRangeStart + contextSize,
              newStart: newRangeStart,
              newLines: newLine - newRangeStart + contextSize,
              lines: curRange
            };
            hunks.push(hunk);
            oldRangeStart = 0;
            newRangeStart = 0;
            curRange = [];
          }
        }
        oldLine += lines.length;
        newLine += lines.length;
      }
    }
    for (const hunk of hunks) {
      for (let i = 0; i < hunk.lines.length; i++) {
        if (hunk.lines[i].endsWith("\n")) {
          hunk.lines[i] = hunk.lines[i].slice(0, -1);
        } else {
          hunk.lines.splice(i + 1, 0, "\\ No newline at end of file");
          i++;
        }
      }
    }
    return {
      oldFileName,
      newFileName,
      oldHeader,
      newHeader,
      hunks
    };
  }
}
function formatPatch(patch, headerOptions) {
  var _a, _b, _c, _d, _e, _f;
  if (!headerOptions) {
    headerOptions = INCLUDE_HEADERS;
  }
  if (Array.isArray(patch)) {
    if (patch.length > 1 && !headerOptions.includeFileHeaders && !patch.every((p) => p.isGit)) {
      throw new Error("Cannot omit file headers on a multi-file patch. (The result would be unparseable; how would a tool trying to apply the patch know which changes are to which file?)");
    }
    return patch.map((p) => formatPatch(p, headerOptions)).join("\n");
  }
  const ret = [];
  if (patch.isGit) {
    headerOptions = INCLUDE_HEADERS;
    if (!patch.oldFileName) {
      throw new Error("oldFileName must be specified for Git patches");
    }
    if (!patch.newFileName) {
      throw new Error("newFileName must be specified for Git patches");
    }
    let gitOldName = patch.oldFileName;
    let gitNewName = patch.newFileName;
    if (patch.isCreate && gitOldName === "/dev/null") {
      gitOldName = gitNewName.replace(/^b\//, "a/");
    } else if (patch.isDelete && gitNewName === "/dev/null") {
      gitNewName = gitOldName.replace(/^a\//, "b/");
    }
    ret.push("diff --git " + quoteFileNameIfNeeded(gitOldName) + " " + quoteFileNameIfNeeded(gitNewName));
    if (patch.isDelete) {
      ret.push("deleted file mode " + ((_a = patch.oldMode) !== null && _a !== void 0 ? _a : "100644"));
    }
    if (patch.isCreate) {
      ret.push("new file mode " + ((_b = patch.newMode) !== null && _b !== void 0 ? _b : "100644"));
    }
    if (patch.oldMode && patch.newMode && !patch.isDelete && !patch.isCreate) {
      ret.push("old mode " + patch.oldMode);
      ret.push("new mode " + patch.newMode);
    }
    if (patch.isRename) {
      ret.push("rename from " + quoteFileNameIfNeeded(((_c = patch.oldFileName) !== null && _c !== void 0 ? _c : "").replace(/^a\//, "")));
      ret.push("rename to " + quoteFileNameIfNeeded(((_d = patch.newFileName) !== null && _d !== void 0 ? _d : "").replace(/^b\//, "")));
    }
    if (patch.isCopy) {
      ret.push("copy from " + quoteFileNameIfNeeded(((_e = patch.oldFileName) !== null && _e !== void 0 ? _e : "").replace(/^a\//, "")));
      ret.push("copy to " + quoteFileNameIfNeeded(((_f = patch.newFileName) !== null && _f !== void 0 ? _f : "").replace(/^b\//, "")));
    }
  } else {
    if (headerOptions.includeIndex && patch.oldFileName == patch.newFileName && patch.oldFileName !== void 0) {
      ret.push("Index: " + patch.oldFileName);
    }
    if (headerOptions.includeUnderline) {
      ret.push("===================================================================");
    }
  }
  const hasHunks = patch.hunks.length > 0;
  if (headerOptions.includeFileHeaders && patch.oldFileName !== void 0 && patch.newFileName !== void 0 && (!patch.isGit || hasHunks)) {
    ret.push("--- " + quoteFileNameIfNeeded(patch.oldFileName) + (patch.oldHeader ? "	" + patch.oldHeader : ""));
    ret.push("+++ " + quoteFileNameIfNeeded(patch.newFileName) + (patch.newHeader ? "	" + patch.newHeader : ""));
  }
  for (let i = 0; i < patch.hunks.length; i++) {
    const hunk = patch.hunks[i];
    const oldStart = hunk.oldLines === 0 ? hunk.oldStart - 1 : hunk.oldStart;
    const newStart = hunk.newLines === 0 ? hunk.newStart - 1 : hunk.newStart;
    ret.push("@@ -" + oldStart + "," + hunk.oldLines + " +" + newStart + "," + hunk.newLines + " @@");
    for (const line of hunk.lines) {
      ret.push(line);
    }
  }
  return ret.join("\n") + "\n";
}
function createTwoFilesPatch(oldFileName, newFileName, oldStr, newStr, oldHeader, newHeader, options) {
  if (typeof options === "function") {
    options = { callback: options };
  }
  if (!(options === null || options === void 0 ? void 0 : options.callback)) {
    const patchObj = structuredPatch(oldFileName, newFileName, oldStr, newStr, oldHeader, newHeader, options);
    if (!patchObj) {
      return;
    }
    return formatPatch(patchObj, options === null || options === void 0 ? void 0 : options.headerOptions);
  } else {
    const { callback } = options;
    structuredPatch(oldFileName, newFileName, oldStr, newStr, oldHeader, newHeader, Object.assign(Object.assign({}, options), { callback: (patchObj) => {
      if (!patchObj) {
        callback(void 0);
      } else {
        callback(formatPatch(patchObj, options.headerOptions));
      }
    } }));
  }
}
function splitLines(text) {
  const hasTrailingNl = text.endsWith("\n");
  const result = text.split("\n").map((line) => line + "\n");
  if (hasTrailingNl) {
    result.pop();
  } else {
    result.push(result.pop().slice(0, -1));
  }
  return result;
}

// src/core/HunkDiffer.ts
var HunkDiffer = class {
  /**
   * Computes differences between old and new text and returns them as hunks.
   */
  static getHunks(oldText, newText, filePath) {
    const patchStr = createTwoFilesPatch(
      filePath,
      filePath,
      oldText,
      newText,
      "Original",
      "AI",
      { context: 3 }
    );
    const parsed = parsePatch(patchStr);
    if (!parsed || parsed.length === 0)
      return [];
    const patch = parsed[0];
    const hunks = [];
    if (!patch.hunks)
      return [];
    for (let i = 0; i < patch.hunks.length; i++) {
      const h = patch.hunks[i];
      hunks.push({
        header: `@@ -${h.oldStart},${h.oldLines} +${h.newStart},${h.newLines} @@`,
        lines: h.lines,
        oldStart: h.oldStart,
        oldLines: h.oldLines,
        newStart: h.newStart,
        newLines: h.newLines,
        id: `${filePath}-hunk-${i}`
      });
    }
    return hunks;
  }
};

// src/vscode/CodeLensProvider.ts
var JGuardCodeLensProvider = class {
  constructor(commands5, objectStore) {
    this.commands = commands5;
    this.objectStore = objectStore;
  }
  _onDidChangeCodeLenses = new vscode9.EventEmitter();
  onDidChangeCodeLenses = this._onDidChangeCodeLenses.event;
  refresh() {
    this._onDidChangeCodeLenses.fire();
  }
  async provideCodeLenses(document, token) {
    const activeSession = this.commands.activeSession;
    if (!activeSession)
      return [];
    const wsRoot = this.commands.findWorkspaceRootForFileAbsolute(document.uri.fsPath);
    if (!wsRoot)
      return [];
    const cs = this.commands.changeSets.get(wsRoot);
    if (!cs)
      return [];
    const relPath = vscode9.workspace.asRelativePath(document.uri, false);
    const change = cs.changes.find((c) => c.relativePath === relPath);
    if (!change || change.type !== "modified")
      return [];
    try {
      const originalBuffer = await this.objectStore.read(change.checkpointHash);
      const originalText = Buffer.from(originalBuffer).toString("utf-8");
      const currentText = document.getText();
      const hunks = HunkDiffer.getHunks(originalText, currentText, document.uri.fsPath);
      const lenses = [];
      for (const hunk of hunks) {
        const line = Math.max(0, hunk.newStart - 1);
        const range = new vscode9.Range(line, 0, line, 0);
        lenses.push(new vscode9.CodeLens(range, {
          title: "$(check) Accept Hunk",
          command: "jguard.acceptHunk",
          arguments: [document.uri, hunk]
        }));
        lenses.push(new vscode9.CodeLens(range, {
          title: "$(close) Reject Hunk",
          command: "jguard.rejectHunk",
          arguments: [document.uri, hunk]
        }));
      }
      return lenses;
    } catch (e) {
      return [];
    }
  }
};

// src/storage/StashStore.ts
var fs10 = __toESM(require("fs/promises"));
var path15 = __toESM(require("path"));
var StashStore = class {
  constructor(storageBaseDir) {
    this.storageBaseDir = storageBaseDir;
  }
  getStashesPath() {
    return path15.join(this.storageBaseDir, "stashes.json");
  }
  async initialize() {
    const p = this.getStashesPath();
    try {
      await fs10.access(p);
    } catch {
      await fs10.writeFile(p, "[]", "utf-8");
    }
  }
  async getStashes() {
    try {
      const content = await fs10.readFile(this.getStashesPath(), "utf-8");
      return JSON.parse(content);
    } catch {
      return [];
    }
  }
  async saveStash(stash) {
    const stashes = await this.getStashes();
    stashes.push(stash);
    await fs10.writeFile(this.getStashesPath(), JSON.stringify(stashes, null, 2), "utf-8");
  }
  async removeStash(id) {
    const stashes = await this.getStashes();
    const updated = stashes.filter((s) => s.id !== id);
    await fs10.writeFile(this.getStashesPath(), JSON.stringify(updated, null, 2), "utf-8");
  }
  async getStash(id) {
    const stashes = await this.getStashes();
    return stashes.find((s) => s.id === id);
  }
};

// src/application/StashService.ts
var path16 = __toESM(require("path"));
var StashService = class {
  constructor(stashStore, objectStore, restoreService) {
    this.stashStore = stashStore;
    this.objectStore = objectStore;
    this.restoreService = restoreService;
  }
  /**
   * Stashes the current file content (AI) and restores the original file content.
   */
  async stashChange(wsRoot, relativePath, originalHash, stashedHash) {
    if (!stashedHash && !originalHash) {
      throw new Error("Cannot stash a file with no changes.");
    }
    const id = `stash_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    const stash = {
      id,
      timestamp: Date.now(),
      relativePath,
      originalHash,
      stashedHash,
      workspaceRoot: wsRoot
    };
    await this.stashStore.saveStash(stash);
    const absolutePath = path16.join(wsRoot, relativePath);
    const plan = {
      operations: [
        originalHash ? { type: "write", relativePath, absolutePath, objectHash: originalHash } : { type: "delete", relativePath, absolutePath, objectHash: null }
      ]
    };
    await this.restoreService.execute(plan);
  }
  /**
   * Restores the stashed hash (AI) back into the physical file, removing the stash.
   */
  async popStash(stashId) {
    await this.applyStash(stashId);
    await this.stashStore.removeStash(stashId);
  }
  /**
   * Restores the stashed hash (AI) back into the physical file, keeping the stash.
   */
  async applyStash(stashId) {
    const stash = await this.stashStore.getStash(stashId);
    if (!stash) {
      throw new Error("Stash not found.");
    }
    const absolutePath = path16.join(stash.workspaceRoot, stash.relativePath);
    const plan = {
      operations: [
        stash.stashedHash ? { type: "write", relativePath: stash.relativePath, absolutePath, objectHash: stash.stashedHash } : { type: "delete", relativePath: stash.relativePath, absolutePath, objectHash: null }
      ]
    };
    await this.restoreService.execute(plan);
  }
  /**
   * Deletes the stash without applying it.
   */
  async dropStash(stashId) {
    await this.stashStore.removeStash(stashId);
  }
  async getStashes() {
    return this.stashStore.getStashes();
  }
};

// src/vscode/StashTreeProvider.ts
var vscode10 = __toESM(require("vscode"));
var StashedChangeTreeItem = class extends vscode10.TreeItem {
  constructor(stash) {
    super(stash.relativePath, vscode10.TreeItemCollapsibleState.None);
    this.stash = stash;
    this.contextValue = "jguard.stashedChangeItem";
    const date = new Date(stash.timestamp);
    this.description = date.toLocaleTimeString();
    this.tooltip = new vscode10.MarkdownString(
      `**${stash.relativePath}**

Stashed at: ${date.toLocaleString()}`
    );
    this.tooltip.isTrusted = true;
    this.iconPath = new vscode10.ThemeIcon("archive");
  }
};
var StashTreeProvider = class {
  constructor(stashService) {
    this.stashService = stashService;
  }
  _onDidChangeTreeData = new vscode10.EventEmitter();
  onDidChangeTreeData = this._onDidChangeTreeData.event;
  refresh() {
    this._onDidChangeTreeData.fire();
  }
  getTreeItem(element) {
    return element;
  }
  async getChildren(element) {
    if (element) {
      return [];
    }
    const stashes = await this.stashService.getStashes();
    stashes.sort((a, b) => b.timestamp - a.timestamp);
    return stashes.map((stash) => new StashedChangeTreeItem(stash));
  }
};

// src/core/AttributionEngine.ts
var vscode11 = __toESM(require("vscode"));
var AttributionEngine = class {
  attributions = /* @__PURE__ */ new Map();
  lastEditorChange = /* @__PURE__ */ new Map();
  streamingStats = /* @__PURE__ */ new Map();
  getAttribution(absPath) {
    return this.attributions.get(absPath);
  }
  clear() {
    this.attributions.clear();
    this.lastEditorChange.clear();
    this.streamingStats.clear();
  }
  async trackEditorChange(event) {
    if (event.document.uri.scheme !== "file")
      return;
    const absPath = event.document.uri.fsPath;
    this.lastEditorChange.set(absPath, Date.now());
    let totalAdded = 0;
    let isMassiveReplace = false;
    for (const change of event.contentChanges) {
      totalAdded += change.text.length;
      if (change.rangeLength > 100 && Math.abs(change.rangeLength - change.text.length) < 50) {
        isMassiveReplace = true;
      }
    }
    if (totalAdded === 0 && event.contentChanges.some((c) => c.rangeLength > 0)) {
      this.attributions.set(absPath, "human");
      return;
    }
    if (totalAdded > 50) {
      if (isMassiveReplace) {
        this.attributions.set(absPath, "human");
        return;
      }
      try {
        const clipboardText = await vscode11.env.clipboard.readText();
        if (event.contentChanges.some((c) => c.text === clipboardText || clipboardText.includes(c.text))) {
          this.attributions.set(absPath, "human");
          return;
        }
      } catch (e) {
      }
      this.attributions.set(absPath, "ai");
      return;
    }
    const now = Date.now();
    let stats = this.streamingStats.get(absPath);
    if (!stats || now - stats.startTime > 2e3) {
      stats = { charsAdded: 0, startTime: now };
    }
    stats.charsAdded += totalAdded;
    this.streamingStats.set(absPath, stats);
    if (stats.charsAdded > 100 && now - stats.startTime < 1e3) {
      this.attributions.set(absPath, "ai");
    } else {
      const current = this.attributions.get(absPath);
      if (current !== "ai") {
        this.attributions.set(absPath, "human");
      }
    }
  }
  trackExternalChange(absPath) {
    const lastChange = this.lastEditorChange.get(absPath);
    const now = Date.now();
    if (!lastChange || now - lastChange > 2e3) {
      this.attributions.set(absPath, "git");
    }
  }
};

// src/extension.ts
var path18 = __toESM(require("path"));
var fs12 = __toESM(require("fs/promises"));

// src/core/IgnoreManager.ts
var import_ignore = __toESM(require_ignore());
var path17 = __toESM(require("path"));
var fs11 = __toESM(require("fs/promises"));
var IgnoreManager = class {
  ig;
  workspaceRoot;
  constructor(workspaceRoot) {
    this.workspaceRoot = workspaceRoot;
    this.ig = (0, import_ignore.default)();
    this.ig.add([
      // JS / Node
      "node_modules",
      "dist",
      "build",
      "out",
      ".angular",
      ".next",
      ".nuxt",
      "coverage",
      ".turbo",
      // Java
      "target",
      ".gradle",
      // Python
      "__pycache__",
      "venv",
      ".venv",
      "env",
      ".pytest_cache",
      ".tox",
      // .NET
      "bin",
      "obj",
      ".vs",
      // System / General
      ".git",
      ".idea",
      ".DS_Store"
    ]);
  }
  /**
   * Initializes the manager by reading the .gitignore file if it exists.
   */
  async initialize() {
    const gitignorePath = path17.join(this.workspaceRoot, ".gitignore");
    try {
      const content = await fs11.readFile(gitignorePath, "utf8");
      this.ig.add(content);
      console.log("JGuard: Loaded .gitignore rules from", gitignorePath);
    } catch (err) {
      if (err.code !== "ENOENT") {
        console.error("JGuard: Failed to read .gitignore", err);
      }
    }
  }
  /**
   * Checks if an absolute file path should be ignored.
   * @param absolutePath The absolute path of the file/folder to check.
   */
  isIgnored(absolutePath) {
    if (!absolutePath.startsWith(this.workspaceRoot)) {
      return false;
    }
    const relativePath = path17.relative(this.workspaceRoot, absolutePath).replace(/\\/g, "/");
    if (relativePath === "") {
      return false;
    }
    return this.ig.ignores(relativePath);
  }
};

// src/extension.ts
var statusBar;
var commands4;
async function activate(context) {
  console.log("JGuard is now active.");
  const storageBaseDir = context.globalStorageUri.fsPath;
  const metadataStore = new MetadataStore(storageBaseDir);
  const objectStore = new ObjectStore(storageBaseDir);
  const stashStore = new StashStore(storageBaseDir);
  await metadataStore.initialize();
  await objectStore.initialize();
  await stashStore.initialize();
  let wsRoot = "";
  if (vscode12.workspace.workspaceFolders && vscode12.workspace.workspaceFolders.length > 0) {
    wsRoot = vscode12.workspace.workspaceFolders[0].uri.fsPath;
  }
  const ignoreManager = new IgnoreManager(wsRoot);
  await ignoreManager.initialize();
  const scanner = new WorkspaceScanner(ignoreManager);
  const checkpointService = new CheckpointService(metadataStore, objectStore, scanner, wsRoot);
  const restoreService = new RestoreService(objectStore);
  const stashService = new StashService(stashStore, objectStore, restoreService);
  const gcEnabled = vscode12.workspace.getConfiguration("jguard").get("enableGarbageCollection", true);
  checkpointService.setGCEnabled(gcEnabled);
  context.subscriptions.push(
    vscode12.workspace.onDidChangeConfiguration((e) => {
      if (e.affectsConfiguration("jguard.enableGarbageCollection")) {
        const enabled = vscode12.workspace.getConfiguration("jguard").get("enableGarbageCollection", true);
        checkpointService.setGCEnabled(enabled);
      }
    })
  );
  statusBar = new StatusBar();
  const sidebarProvider = new SidebarProvider();
  const historyProvider = new HistoryTreeProvider(metadataStore);
  const stashProvider = new StashTreeProvider(stashService);
  const diffProvider = new DiffProvider(objectStore);
  const attributionEngine = new AttributionEngine();
  context.subscriptions.push(
    vscode12.window.registerTreeDataProvider("jguardSidebar", sidebarProvider),
    vscode12.window.registerTreeDataProvider("jguardHistory", historyProvider),
    vscode12.window.registerTreeDataProvider("jguardStash", stashProvider),
    vscode12.workspace.onDidChangeTextDocument((e) => attributionEngine.trackEditorChange(e))
  );
  vscode12.workspace.registerTextDocumentContentProvider(DiffProvider.scheme, diffProvider);
  commands4 = new Commands(context, checkpointService, restoreService, scanner, sidebarProvider, statusBar, objectStore, ignoreManager, attributionEngine);
  commands4.register();
  const codeLensProvider = new JGuardCodeLensProvider(commands4, objectStore);
  vscode12.languages.registerCodeLensProvider({ scheme: "file" }, codeLensProvider);
  context.subscriptions.push(
    vscode12.commands.registerCommand("jguard.showHistoryDetails", (item) => {
      if (item && item.session) {
        CheckpointDetailWebview.show(context, item.session);
      }
    }),
    vscode12.commands.registerCommand("jguard.clearHistory", async () => {
      const choice = await vscode12.window.showWarningMessage(
        "Are you sure you want to bulk clear old sessions? (This will keep your 3 most recent sessions)",
        "Clear Old History",
        "Cancel"
      );
      if (choice === "Clear Old History") {
        try {
          await checkpointService.clearOldHistory(3);
          historyProvider.refresh();
          vscode12.window.showInformationMessage("JGuard: Old session history cleared successfully.");
        } catch (e) {
          vscode12.window.showErrorMessage(`Failed to clear history: ${e.message}`);
        }
      }
    }),
    vscode12.commands.registerCommand("jguard.deleteHistorySession", async (item) => {
      if (item && item.session) {
        if (commands4.getActiveSessionId() === item.session.id) {
          vscode12.window.showErrorMessage("You cannot delete the active session that you are currently protecting in your editor.");
          return;
        }
        const choice = await vscode12.window.showWarningMessage(
          "Are you sure you want to delete this specific session? This will permanently delete its checkpoint data.",
          "Delete Session",
          "Cancel"
        );
        if (choice === "Delete Session") {
          try {
            await checkpointService.deleteHistorySession(item.session.id);
            historyProvider.refresh();
            vscode12.window.showInformationMessage("JGuard: Session deleted successfully.");
          } catch (e) {
            vscode12.window.showErrorMessage(`Failed to delete session: ${e.message}`);
          }
        }
      }
    }),
    vscode12.commands.registerCommand("jguard.refreshHistory", () => {
      historyProvider.refresh();
    }),
    vscode12.commands.registerCommand("jguard.stashFile", async (item) => {
      if (item && item.change) {
        const change = item.change;
        const activeId = commands4.getActiveSessionId();
        if (!activeId)
          return;
        try {
          await stashService.stashChange(
            item.wsRoot || vscode12.workspace.workspaceFolders[0].uri.fsPath,
            change.relativePath,
            change.type === "created" ? null : change.checkpointHash,
            change.type === "deleted" ? null : change.currentHash
          );
          vscode12.commands.executeCommand("jguard.refresh");
          stashProvider.refresh();
          vscode12.window.showInformationMessage(`JGuard: Stashed ${change.relativePath}`);
        } catch (e) {
          vscode12.window.showErrorMessage(`Failed to stash: ${e.message}`);
        }
      }
    }),
    vscode12.commands.registerCommand("jguard.popStash", async (item) => {
      if (item && item.stash) {
        try {
          await stashService.popStash(item.stash.id);
          vscode12.commands.executeCommand("jguard.refresh");
          stashProvider.refresh();
          vscode12.window.showInformationMessage(`JGuard: Popped stash for ${item.stash.relativePath}`);
        } catch (e) {
          vscode12.window.showErrorMessage(`Failed to pop stash: ${e.message}`);
        }
      }
    }),
    vscode12.commands.registerCommand("jguard.applyStash", async (item) => {
      if (item && item.stash) {
        try {
          await stashService.applyStash(item.stash.id);
          vscode12.commands.executeCommand("jguard.refresh");
          vscode12.window.showInformationMessage(`JGuard: Applied stash for ${item.stash.relativePath}`);
        } catch (e) {
          vscode12.window.showErrorMessage(`Failed to apply stash: ${e.message}`);
        }
      }
    }),
    vscode12.commands.registerCommand("jguard.dropStash", async (item) => {
      if (item && item.stash) {
        try {
          await stashService.dropStash(item.stash.id);
          stashProvider.refresh();
          vscode12.window.showInformationMessage(`JGuard: Dropped stash for ${item.stash.relativePath}`);
        } catch (e) {
          vscode12.window.showErrorMessage(`Failed to drop stash: ${e.message}`);
        }
      }
    })
  );
  context.subscriptions.push(
    commands4.onDidFinalizeSession(() => {
      historyProvider.refresh();
    })
  );
  const lockFile = path18.join(storageBaseDir, "jguard.lock");
  try {
    const activeId = await fs12.readFile(lockFile, "utf-8");
    if (activeId) {
      vscode12.window.showWarningMessage(
        "AI Guard: Found an active checkpoint from a previous session. Do you want to resume protecting?",
        "Resume",
        "Discard"
      ).then(async (choice) => {
        if (choice === "Resume") {
          try {
            let session;
            try {
              session = await metadataStore.readSession(activeId.trim());
            } catch {
              const cp = await metadataStore.read(activeId.trim());
              const wsRoot2 = cp.workspaceRoot || (vscode12.workspace.workspaceFolders?.[0]?.uri.fsPath || "");
              session = {
                id: activeId.trim(),
                createdAt: cp.createdAt,
                folderCheckpoints: { [wsRoot2]: cp },
                status: "active"
              };
            }
            commands4.restoreSessionState(session);
            statusBar.setState("protecting");
            await commands4.refresh();
          } catch (e) {
            vscode12.window.showErrorMessage("Failed to resume checkpoint. It may be corrupted.");
            await fs12.unlink(lockFile).catch(() => {
            });
          }
        } else if (choice === "Discard") {
          await fs12.unlink(lockFile).catch(() => {
          });
        }
      });
    }
  } catch (e) {
  }
}
function deactivate() {
  if (statusBar)
    statusBar.dispose();
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  activate,
  deactivate
});
//# sourceMappingURL=extension.js.map
