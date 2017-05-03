const {buildPackageMap, getInstalledPackage} = require("./index.js");
const { depGraph, buildStages } = require("./dependencies.js");
const {BuildProcess} = require("./build.js");


(async () => {
  let pMap = await buildPackageMap(["/Users/robert/.central-node-packages"]);
  let found = await getInstalledPackage("pouchdb", null, pMap);
  console.log(found);

  await depGraph(found, pMap);
  // let stages = await buildStages(p, pMap)
  // let build = new BuildProcess(stages, pMap);
  // await build.run()
})();
