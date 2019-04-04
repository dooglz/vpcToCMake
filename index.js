let fs = require('fs');
let path = require("path");

var walkSync = function (dir, fl, d) {
  const files = fs.readdirSync(dir);
  let fileList = fl || [];
  let depth = d || 0;
  files.forEach(function (file) {
    if (file.startsWith('.')) {
      return;
    }
    if (fs.statSync(dir + file).isDirectory()) {
      fileList = walkSync(dir + file + path.sep, fileList, depth++);
    }
    else {
      fileList.push({ f: dir + file, d: depth });
    }
  });
  return fileList;
};

class VPC_O {
  constructor() {
    this.f = "";
    this.includes = [];
    this.macros = {};
    this.reqMacros = [];
    this.configs = [];
    this.project = {};
  }
}

//Babbys first Parser
async function Parse(VPC_FILE) {
  console.info("parsing", VPC_FILE.f);
  //tabs->spaces, remove leading, trailing & double spaces, join backslash newlines, split lines.
  const fileContents = fs.readFileSync(VPC_FILE.f, 'utf8')
    .replace(/\t/gm, ' ').replace(/ +/gm, ' ').replace(/^ /gm, '').replace(/\\\r?\n/g, '').replace(/ $/gm, '')
    .split(/\r?\n/).filter((lne) => !lne.startsWith("//") && lne !== "");

  let vpco = new VPC_O();

  let scope = 0;
  var stack = [];

  let getStackTop = (stack) => stack[stack.length - 1];
  let getStackTopS = (stack) => { let a = getStackTop(stack); if (!a) { 
    throw ("Stack Empty!"); 
  } return a; };
  let startsWithAny = (e,list)=>list.find((i)=>e.startsWith(i));
  let trimKey = (key)=>key.startsWith('$')? key.substr(1) :key;


  const configGroups = ["$general", "$compiler", "$linker"];
  const configCompilerFlags = ["$additionalincludedirectories", "$preprocessordefinitions", "$preprocessordefinitions", "$preprocessordefinitions", "$preprocessordefinitions", "$create/useprecompiledheader", "$create/usepchthroughfile", "$precompiledheaderfile "];
  const configLinkerFlags = ["$systemlibraries", "$systemframeworks", "$systemlibraries	", "$ignoreimportlibrary","$additionaldependencies", "$additionaldependencies "];
  const configGeneralFlags = ["$outputdirectory", "$intermediatedirectory"];

  //Some things may open scope after, or may not. 
  //Setting this to true indicates that if the next token isn't a scope operator, to remove the thing at the top of the stack.
  let possibleScope = false;

  fileContents.forEach((v, i) => {
    v = v.toLowerCase().replace(/"/gm, '');
    if(possibleScope && v !== '{'){
      stack.pop();
    }
    possibleScope = false;
    if (v === '{') { scope++; }
    else if (v === '}') {
      scope--;
      stack.pop();
    }else if (v.startsWith("$macro ")) {
      let mkro = v.split(' ');
      if (vpco.macros[mkro[1]] !== undefined) {
        console.error ("Macro Redefinition! " + mkro[1] + ":", mkro[2] + ", "+ vpco.macros[mkro[1]]);
      }
      vpco.macros[mkro[1]] = mkro[2];
    }else if (v.startsWith("$macrorequired ")) {
      let mkro = v.split(' ');
      vpco.reqMacros.push(mkro[1]);
    } else if (v.startsWith("$include")) {
      let inc = v.split(' ');
      vpco.includes.push(inc[1]);
    //----------------------------------------------
    } else if (v.startsWith("$configuration")) {
      //Config
      //Configs can be attached to any file, or be global.
      let parent = getStackTop(stack) ||  vpco;
      let config = {};
      if (parent.configs === undefined){
        parent.configs = [];
      }
      parent.configs.push(config);
      stack.push(config);
      //todo: parse config extra info
    } else if (startsWithAny(v,configGroups)) {
      //Config Subgroup
      //Either General, Compiler, or linker
      const a = startsWithAny(v,configGroups);
      const cfg = getStackTopS(stack);
      let cfg_flag = {};
      cfg[trimKey(a)] = cfg_flag;
      stack.push(cfg_flag);
    } else if (startsWithAny(v,configGeneralFlags)) {
      //Config->General flags
      let a = startsWithAny(v,configGeneralFlags);
      let cfg_general = getStackTopS(stack);
      cfg_general[trimKey(a)] = v.split(' ').slice(1);
    } else if (startsWithAny(v,configLinkerFlags)) {
      //Config->Linker flags
      let a = startsWithAny(v,configLinkerFlags);
      let cfg_linker= getStackTopS(stack);
      cfg_linker[trimKey(a)] = v.split(' ').slice(1);
    } else if (startsWithAny(v,configCompilerFlags)) {
      //Config->Compiler flags
      let a = startsWithAny(v,configCompilerFlags);
      let cfg_compiler = getStackTopS(stack);
      cfg_compiler[trimKey(a)] = v.split(' ').slice(1);
      //----------------------------------------------
    } else if (v.startsWith("$project")) {
      let proj = {folders:[],files:[]};
      vpco.project = proj;
      stack.push(proj);
    } else if (v.startsWith("$folder")) {
      let folder = {folders:[],files:[],libs:[],impLibs:[], data:v.split(' ').slice(1)};
      let project = getStackTopS(stack);
      project.folders.push(folder);
      stack.push(folder);
    } else if (v.startsWith("$file")) {
      let file = {data:v.split(' ').slice(1)};
      let folder = getStackTopS(stack);
      folder.files.push(file);
      stack.push(file);
      possibleScope = true;
    } else if (v.startsWith("$lib")) {
      let lib = {data:v.split(' ').slice(1)};
      let folder = getStackTopS(stack);
      folder.libs.push(lib);
      stack.push(lib);
      possibleScope = true;
    } else if (v.startsWith("$implib")) {
      let impLib = {data:v.split(' ').slice(1)};
      let folder = getStackTopS(stack);
      folder.impLibs.push(impLib);
      stack.push(impLib);
      possibleScope = true;
    } else {
      console.info("Unknown keyword", v);
    }
  });

  if (scope != 0 && stack.length != 0) {
    throw ("Scope error!");
  }



  return (vpco);
}



async function Main() {
  const ROOT_DIR = path.resolve(process.argv[2]) + path.sep;

  if (!fs.statSync(ROOT_DIR).isDirectory()) {
    console.error("Invalid Dir");
    return -1;
  }

  console.log("Scanning", ROOT_DIR);
  const FILE_LIST = walkSync(ROOT_DIR);
  const VPC_FILE_LIST = FILE_LIST.filter((v) => v.f.toLowerCase().endsWith(".vpc"));
  console.info("Found VPC Files:", VPC_FILE_LIST.length, "out of total files:", FILE_LIST.length);


  /*
    VPC_FILE_LIST.forEach((v) => {
      promises.push(
        new Promise(
          (resolve) => { resolve(Parse(v)); }
        )
      )
    });
  */
  let vpos = await Promise.all(VPC_FILE_LIST.map(Parse));

  console.info("Done 1", vpos);
  //Promise.all(promises).then((arr) => console.info("Done ", arr));

}




Main();