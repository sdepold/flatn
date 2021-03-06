/*global process, require, module*/

import { exec } from "child_process";
import { join as j } from "path";
import { tmpdir } from "os";
import { resource } from "./deps/lively.resources.js";

function maybeFileResource(url) {
  if (typeof url === "string" && url.startsWith("/"))
      url = "file://" + url;
  return url.isResource ? url : resource(url);
}

async function npmSearchForVersions(packageNameAndRange) {
  // let packageNameAndRange = "lively.lang@~0.4"
  try {
    let [pname, range = "*"] = packageNameAndRange.split("@"),
        {name, version} = await resource(`http://registry.npmjs.org/${pname}/${range}`).readJson()
    return {name, version};
  } catch (err) {
    console.error(err);
    throw new Error(`Cannot find npm package for ${packageNameAndRange}`);
  }
}

async function npmDownloadArchive(packageNameAndRange, destinationDir) {
  destinationDir = maybeFileResource(destinationDir);
  let {version, name} = await npmSearchForVersions(packageNameAndRange),
      archive=`${name}-${version}.tgz`,
      archiveURL = `https://registry.npmjs.org/${name}/-/${archive}`
  console.log(`[flatn] downloading archive from npm for ${packageNameAndRange}: ${archiveURL}`);
  let downloadedArchive = destinationDir.join(archive);
  await resource(archiveURL).beBinary().copyTo(downloadedArchive);
  return {downloadedArchive, name, version};
}


// let {downloadedArchive} = await npmDownloadArchive("lively.lang@^0.3", "local://lively.node-packages-test/test-download/")
// let z = await untar(downloadedArchive, resource("file:///Users/robert/temp/"))
// let z = await untar(downloadedArchive, resource("local://lively.node-packages-test/test-download/"))
// await z.dirList()
// https://registry.npmjs.org/lively.lang/-/lively.lang-0.3.5.tgz

async function untar(downloadedArchive, targetDir, name) {
  // FIXME use tar module???

  if (!name) name = downloadedArchive.name().replace(/(\.tar|\.tar.tgz|.tgz)$/, "");
  downloadedArchive = maybeFileResource(downloadedArchive);
  targetDir = maybeFileResource(targetDir);

  let untarDir = resource(`file://${tmpdir()}/npm-helper-untar/`);
  await untarDir.ensureExistance();
  if (!downloadedArchive.url.startsWith("file://")) { // need to run exec
    let tmpDir = untarDir.join(downloadedArchive.name());
    await downloadedArchive.copyTo(tmpDir);
    downloadedArchive = tmpDir;
  }

  if (untarDir.join(name).exists())
    await untarDir.join(name).remove();

  // console.log(`[${name}] extracting ${downloadedArchive.path()} => ${targetDir.join(name).asDirectory().url}`);

  await x(`mkdir "${name}" && `
        + `tar xzf "${downloadedArchive.path()}" --strip-components 1 -C "${name}" && `
        + `rm "${downloadedArchive.path()}"`, {cwd: untarDir.path()});

  await targetDir.join(name).asDirectory().remove();
  await targetDir.join(name).asDirectory().ensureExistance();
  return untarDir.join(name).asDirectory().rename(targetDir.join(name).asDirectory());
}


// await gitClone("https://github.com/LivelyKernel/lively.morphic", "local://lively.node-packages-test/test-download/lively.morphic.test")

async function gitClone(gitURL, intoDir, branch = "master") {
  intoDir = maybeFileResource(intoDir).asDirectory();
  let name = intoDir.name(), tmp;
  if (!intoDir.url.startsWith("file://")) {
    tmp = resource(`file://${tmpdir()}/npm-helper-gitclone/`);
    await tmp.ensureExistance();
    if (tmp.join(name).exists()) await tmp.join(name).remove()
  } else {
    intoDir.parent().ensureExistance();
    if (intoDir.exists()) await intoDir.remove();
  }

  // console.log(`git clone -b "${branch}" "${gitURL}" "${name}"`)
  // console.log(tmp ? tmp.path() : intoDir.parent().path())

  let destPath = tmp ? tmp.path() : intoDir.parent().path();
  try {
    try {
      await x(`git clone --single-branch -b "${branch}" "${gitURL}" "${name}"`, {cwd: destPath});
    } catch (err) {
      // specific shas can't be cloned, so do it manually:
      await x(`git clone "${gitURL}" "${name}" && cd ${name} && git reset --hard "${branch}" `, {cwd: destPath});
    }
  } catch (err) {
    throw new Error(`git clone of ${gitURL} branch ${branch} into ${destPath} failed:\n${err}`);
  }
  
  if (tmp) await tmp.join(name + "/").rename(intoDir);
}



function x(cmd, opts = {}) {
  return new Promise((resolve, reject) => {
    let p = exec(cmd, opts, (code, stdout, stderr) =>
      code
        ? reject(new Error(`Command ${cmd} failed: ${code}\n${stdout}${stderr}`))
        : resolve(stdout));
    if (opts.verbose) {
      // p.stdout.on("data", d => console.log(d));
      // p.stderr.on("data", d => console.log(d));
      p.stdout.pipe(process.stdout);
      p.stderr.pipe(process.stderr);
    }
  });
}


const npmFallbackEnv = {
  npm_config_access: '',
  npm_config_also: '',
  npm_config_always_auth: '',
  npm_config_auth_type: 'legacy',
  npm_config_bin_links: 'true',
  npm_config_browser: '',
  npm_config_ca: '',
  npm_config_cache: j(process.env.HOME || "", '.npm'),
  npm_config_cache_lock_retries: '10',
  npm_config_cache_lock_stale: '60000',
  npm_config_cache_lock_wait: '10000',
  npm_config_cache_max: 'Infinity',
  npm_config_cache_min: '10',
  npm_config_cafile: '',
  npm_config_cert: '',
  npm_config_color: 'true',
  npm_config_depth: 'Infinity',
  npm_config_description: 'true',
  npm_config_dev: '',
  npm_config_dry_run: '',
  npm_config_engine_strict: '',
  npm_config_fetch_retries: '2',
  npm_config_fetch_retry_factor: '10',
  npm_config_fetch_retry_maxtimeout: '60000',
  npm_config_fetch_retry_mintimeout: '10000',
  npm_config_force: '',
  npm_config_git: 'git',
  npm_config_git_tag_version: 'true',
  npm_config_global: '',
  npm_config_global_style: '',

  npm_config_globalconfig: j(process.env.HOME || "", 'npmrc'),
  npm_config_globalignorefile: j(process.env.HOME || "", 'npmignore'),
  npm_config_group: '20',
  npm_config_ham_it_up: '',
  npm_config_heading: 'npm',
  npm_config_https_proxy: '',
  npm_config_if_present: '',
  npm_config_ignore_scripts: '',
  npm_config_init_author_email: '',
  npm_config_init_author_name: '',
  npm_config_init_author_url: '',
  npm_config_init_license: 'ISC',
  npm_config_init_module: j(process.env.HOME || "", '.npm-init.js'),
  npm_config_init_version: '1.0.0',
  npm_config_json: '',
  npm_config_key: '',
  npm_config_legacy_bundling: '',
  npm_config_link: '',
  npm_config_local_address: '',
  npm_config_loglevel: 'warn',
  npm_config_logs_max: '10',
  npm_config_long: '',
  npm_config_maxsockets: '50',
  npm_config_message: '%s',
  npm_config_metrics_registry: 'https://registry.npmjs.org/',
  npm_config_node_version: '7.7.4',
  npm_config_onload_script: '',
  npm_config_only: '',
  npm_config_optional: 'true',
  npm_config_parseable: '',
  npm_config_prefix: process.env.HOME || "",
  npm_config_production: '',
  npm_config_progress: 'true',
  npm_config_proprietary_attribs: 'true',
  npm_config_proxy: '',
  npm_config_rebuild_bundle: 'true',
  npm_config_registry: 'https://registry.npmjs.org/',
  npm_config_rollback: 'true',
  npm_config_save: '',
  npm_config_save_bundle: '',
  npm_config_save_dev: '',
  npm_config_save_exact: '',
  npm_config_save_optional: '',
  npm_config_save_prefix: '^',
  npm_config_scope: '',
  npm_config_scripts_prepend_node_path: 'warn-only',
  npm_config_searchexclude: '',
  npm_config_searchlimit: '20',
  npm_config_searchopts: '',
  npm_config_searchstaleness: '900',
  npm_config_send_metrics: '',
  npm_config_shell: 'bash',
  npm_config_shrinkwrap: 'true',
  npm_config_sign_git_tag: '',
  npm_config_sso_poll_frequency: '500',
  npm_config_sso_type: 'oauth',
  npm_config_strict_ssl: 'true',
  npm_config_tag: 'latest',
  npm_config_tag_version_prefix: 'v',
  npm_config_tmp: tmpdir(),
  npm_config_umask: '0022',
  npm_config_unicode: 'true',
  npm_config_unsafe_perm: 'true',
  npm_config_usage: '',
  npm_config_user: '501',
  npm_config_user_agent: 'npm/4.4.4 node/v7.7.4 darwin x64',
  npm_config_userconfig: j(process.env.HOME || "", '.npmrc'),
  npm_config_version: '',
  npm_config_versions: '',
  npm_config_viewer: 'man',
  npm_execpath: '/Users/robert/.nvm/versions/node/v7.7.4/lib/node_modules/npm/bin/npm-cli.js',
  npm_node_execpath: '/Users/robert/.nvm/versions/node/v7.7.4/bin/node'
}

function gitSpecFromVersion(version = "") {
  let gitMatch = version.match(/([^:]+):\/\/.*/),
      githubMatch = version.match(/([^\/]+)\/([^#]+).*/),
      gitRepoUrl = gitMatch ? version : githubMatch ? "https://github.com/" + version : null,
      [_, branch] = (gitRepoUrl && gitRepoUrl.match(/#([^#]*)$/) || []);
  if (gitRepoUrl && !branch) {
     branch = "master";
     gitRepoUrl += "#master";
  }
  return gitRepoUrl
    ? {branch, gitURL: gitRepoUrl, versionInFileName: gitRepoUrl.replace(/[:\/\+#]/g, "_")}
    : null;
}

export {
  gitClone,
  untar,
  npmDownloadArchive,
  npmSearchForVersions,
  x,
  npmFallbackEnv,
  gitSpecFromVersion
};
