/*global require, module*/
import { join as j } from "path";
import { tmpdir } from "os";
import { gitClone, npmDownloadArchive, untar, gitSpecFromVersion } from "./util.js";
import { PackageSpec } from "./package-map.js";

import { resource } from "./deps/lively.resources.js"

export {
  packageDownload
}


function maybeFileResource(url) {
  if (typeof url === "string" && url.startsWith("/"))
      url = "file://" + url;
  return url.isResource ? url : resource(url);
}

function pathForNameAndVersion(nameAndVersion, destinationDir) {
  // pathForNameAndVersion("foo-bar@1.2.3", "file:///x/y")
  // pathForNameAndVersion("foo-bar@foo/bar", "file:///x/y")
  // pathForNameAndVersion("foo-bar@git+https://github.com/foo/bar#master", "file:///x/y")

  let [name, version] = nameAndVersion.split("@"),
      gitSpec = gitSpecFromVersion(version);

  // "git clone -b my-branch git@github.com:user/myproject.git"
  if (gitSpec) {
    let location = j(destinationDir, `${name}@${gitSpec.versionInFileName}`);
    return Object.assign({}, gitSpec, {location, name, version: gitSpec.gitURL});
  }

  return {location: j(destinationDir, nameAndVersion), name, version}
}


async function packageDownload(packageNameAndRange, destinationDir, attempt = 0) {
  // packageNameAndRange like "lively.modules@^0.7.45"
  // if no @ part than we assume @*

  try {

    destinationDir = maybeFileResource(destinationDir);

    if (!packageNameAndRange.includes("@")) {
      // any version
      packageNameAndRange += "@*";
    }

    // download package to tmp location
    let tmp = resource("file://" + tmpdir()).join("package_install_tmp/");
    await tmp.ensureExistance()

    let pathSpec = pathForNameAndVersion(packageNameAndRange, destinationDir.path()),
        downloadDir = pathSpec.gitURL
          ? await packageDownloadViaGit(pathSpec, tmp)
          : await packageDownloadViaNpm(packageNameAndRange, tmp);


    let packageJSON = downloadDir.join("package.json"), config;
    if (await packageJSON.exists()) {
      config = await downloadDir.join("package.json").readJson();
    } else {
      // FIXME, doesn't really work for git downloads...
      let [name, version] = downloadDir.name().split("@");
      config = {name, version};
    }

    let packageDir;
    if (pathSpec.gitURL) {
      packageDir = maybeFileResource(pathSpec.location).asDirectory();
    } else {
      let dirName = config.name + "@" + config.version;
      packageDir = destinationDir.join(dirName).asDirectory();
      pathSpec = Object.assign({}, pathSpec, {location: packageDir});
    }

    await downloadDir.rename(packageDir);

    let packageSpec = PackageSpec.fromDir(packageDir.path());
    packageSpec.writeLvInfo(Object.assign({build: false}, pathSpec));

    return packageSpec;

  } catch (err) {
    if (attempt >= 3) throw err;
    console.log(`[flatn] retrying download of ${packageNameAndRange}`);
    return packageDownload(packageNameAndRange, destinationDir, attempt+1)
  }
}


async function packageDownloadViaGit({gitURL: url, name, branch}, targetDir) {
  // packageNameAndRepo like "lively.modules@https://github.com/LivelyKernel/lively.modules"
  branch = branch || "master"
  url = url.replace(/#[^#]+$/, "");
  let dir = targetDir.join(name).asDirectory()
  await gitClone(url, dir, branch);
  return dir;
}

async function packageDownloadViaNpm(packageNameAndRange, targetDir) {
  // packageNameAndRange like "lively.modules@^0.7.45"
  // if no @ part than we assume @*
  let {
    downloadedArchive,
    name, version
  } = await npmDownloadArchive(packageNameAndRange, targetDir);
  return untar(downloadedArchive, targetDir, name);
}
