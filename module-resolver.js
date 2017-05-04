/*global require*/
"format cjs";

var path = require("path");
var fs = require("fs");
var Module = require("module");
var { x: execSync } = require("child_process");
var { buildPackageMap, findMatchingPackageSpec } = require("./index.js");

var originalResolve;
installResolver();

// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

function installResolver() {
  if (!originalResolve) originalResolve = Module._resolveFilename;
  Module._resolveFilename = function(request, parent, isMain) {

    try {
      let result = originalResolve.call(this, request, parent, isMain);
      // console.log(`${request} => ${result}`);
      return result;

    } catch (err) {
      let parentId = parent ? parent.filename || parent.id : "",
          // _ = console.log(`[_resolveFilename] searching for "${request}" from ${parentId}`),
          config = findPackageConfig(parentId),
          deps = config && depMap(config),
          basename = request.split("/")[0],
          flatPackageDirs = (process.env.FNP_PACKAGE_DIRS || "").split(":"),
          packageMap = buildPackageMap(flatPackageDirs),
          packageFound = findMatchingPackageSpec(basename, deps[basename], packageMap),
          resolved = packageFound && resolveFlatPackageToModule(packageFound, basename, request);

      if (resolved) return resolved;

      throw err;
    }
  }
}

function findPackageConfig(modulePath) {
  let dir = path.dirname(modulePath), config = null;
  while (true) {
    if (fs.existsSync(path.join(dir, "package.json"))) {
      config = JSON.parse(fs.readFileSync(path.join(dir, "package.json")));
      break;
    }
    let nextDir = path.dirname(dir);
    if (nextDir === dir) break;
    dir = nextDir;
  }
  return config;
}

function depMap(packageConfig) {
  return ["peerDependencies","dependencies","devDependencies", "optionalDependencies"]
    .reduce((deps, field) => {
       if (!packageConfig[field]) return deps;
      for (let name in packageConfig[field])
        Object.assign(deps, packageConfig[field]);
      return deps;
    }, {});
}

function resolveFlatPackageToModule(requesterPackage, basename, request) {
  // Given {name, version, path} from resolveFlatPackageToModule, will find the
  // full path to the module inside of the package, using the module request
  // let {config: {name, version}, location: pathToPackage} = requesterPackage
  let {config: {name, version}, location: pathToPackage} = requesterPackage
  let fullpath;
  if (basename === request) {
    let config = findPackageConfig(path.join(pathToPackage, "index.js"));
    if (!config || !config.main) fullpath = path.join(pathToPackage, "index.js");
    else fullpath = path.join(pathToPackage, config.main);
  } else fullpath = path.join(pathToPackage, request.slice(basename.length));
  if (fs.existsSync(fullpath)) return fullpath;
  if (fs.existsSync(fullpath + ".js")) return fullpath + ".js";
}
