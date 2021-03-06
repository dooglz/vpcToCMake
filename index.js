let fs = require('fs');
let path = require("path");

//simple non-pop() pop.
const getStackTop = (stack) => stack[stack.length - 1];
//As above but with empty throw
const getStackTopS = (stack) => {
  const a = getStackTop(stack);
  if (!a) {
    throw ("Stack Empty!");
  } return a;
};

//Starts with anything from this array
const startsWithAny = (e, list) => list.find((i) => e.toLowerCase().startsWith(i.toLowerCase()));
//Starts with anything from any of these array
const startsWithAnyAny = (e, lists) => {
  for (list of lists) {
    let a = startsWithAny(e, list);
    if (a) { return a; }
  }
  return undefined;
}

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
    this.reqMacros = {};
    this.configs = [];
    this.project = {};
    this.others = [];
  }
}

let MissingkeywordMap = {};

//Babbys first Parser
async function Parse(VPC_FILE) {
  console.info("parsing", VPC_FILE.f);

  const fileContents_raw = fs.readFileSync(VPC_FILE.f, 'utf8');
  let fileContents = fileContents_raw
  //Node bug, doesn't strip utf8-bom sometimes.
  if (fileContents.charCodeAt(0) === 0xFEFF) {
    fileContents = fileContents.substr(1);
  }
  //tabs->spaces, remove leading, trailing & double spaces, join backslash newlines, split lines.
  fileContents = fileContents.replace(/\t/gm, ' ').replace(/ +/gm, ' ').replace(/^ /gm, '').replace(/\\\r?\n/g, '').replace(/ $/gm, '')
    .split(/\r?\n/).filter((lne) => !lne.startsWith("//") && lne !== "");

  let vpco = new VPC_O();
  vpco.f = VPC_FILE.f;

  let scope = 0;
  var stack = [];

  //Helpers -------------------------
  //For trimming "$This fromRestOfString", empty string if no space
  const sliceFirst = (s) => s.indexOf(' ') === -1 ? "" : s.substr(s.indexOf(' ') + 1);
  //Trims Dollar Sign if it's there.
  const trimKey = (key) => key.startsWith('$') ? key.substr(1) : key;

  //-----------------

  const custombuildstepFlags = ["$description", "$commandline", "$outputs"];
  const configGroups = ["$general", "$compiler", "$linker", "$librarian", "$custombuildstep", "$prebuildevent", "$prelinkevent", "$postbuildevent", "$debugging", "$manifesttool", "$xmldocumentgenerator", "$browseinformation", "$resources"];
  //
  const configPreBuildeventFlags = ["$CommandLine", "$Description", "$ExcludedFromBuild"];
  const configPreLinkeventFlags = ["$CommandLine", "$Description", "$ExcludedFromBuild"];
  const configPostBuildeventFlags = ["$CommandLine", "$Description", "$ExcludedFromBuild"];
  const configManifesttoolFlags = ["$SuppressStartupBanner", "$VerboseOutput", "$AssemblyIdentity", "$UseUNICODEResponseFiles", "$UseFAT32WorkAround", "$AdditionalManifestFiles", "$InputResourceManifests", "$EmbedManifest", "$OutputManifestFile", "$ManifestResourceFile", "$GenerateCatalogFiles", "$DependencyInformationFile", "$TypeLibraryFile", "$RegistrarScriptFile", "$ComponentFileName", "$ReplacementsFile", "$UpdateFileHashes", "$UpdateFileHashesSearchPath", "$AdditionalOptions"];
  const configResourcesFlags = ["$PreprocessorDefinitions", "$Culture", "$AdditionalIncludeDirectories", "$IgnoreStandardIncludePath", "$ShowProgress", "$ResourceFileName", "$AdditionalOptions"];
  const configXmldocumentgeneratorFlags = ["$SuppressStartupBanner", "$ValidateIntelliSense", "$AdditionalDocumentFiles", "$OutputDocumentFile", "$DocumentLibraryDependencies", "$UseUNICODEResponseFiles"];
  const configCompilerFlags = ["$MultiProcessorCompilation", "$AdditionalIncludeDirectories", "$Resolve#UsingReferences", "$DebugInformationFormat", "$SuppressStartupBanner", "$WarningLevel", "$Detect64bitPortabilityIssues", "$TreatWarningsAsErrors", "$UseUNICODEResponseFiles", "$Optimization", "$InlineFunctionExpansion", "$EnableIntrinsicFunctions", "$FavorSizeOrSpeed", "$OmitFramePointers", "$EnableFiberSafeOptimizations", "$WholeProgramOptimization", "$PreprocessorDefinitions", "$PreprocessorDefinitions", "$IgnoreStandardIncludePath", "$GeneratePreprocessedFile", "$KeepComments", "$EnableStringPooling", "$EnableMinimalRebuild", "$EnableC++Exceptions", "$SmallerTypeCheck", "$BasicRuntimeChecks", "$RuntimeLibrary", "$StructMemberAlignment", "$BufferSecurityCheck", "$EnableFunctionLevelLinking", "$EnableEnhancedInstructionSet", "$FloatingPointModel", "$EnableFloatingPointExceptions", "$DisableLanguageExtensions", "$DefaultCharUnsigned", "$TreatWCHAR_TAsBuiltInType", "$ForceConformanceInForLoopScope", "$EnableRunTimeTypeInfo", "$OpenMPSupport", "$Create/UsePrecompiledHeader", "$Create/UsePCHThroughFile", "$PrecompiledHeaderFile", "$ExpandAttributedSource", "$AssemblerOutput", "$ASMListLocation", "$ObjectFileName", "$ProgramDatabaseFileName", "$GenerateXMLDocumentationFiles", "$XMLDocumentationFileName", "$EnableBrowseInformation", "$BrowseFile", "$CallingConvention", "$CompileAs", "$DisableSpecificWarnings", "$ForceIncludes", "$Force#Using", "$ShowIncludes", "$UndefinePreprocessorDefinitions", "$UndefineAllPreprocessorDefinitions", "$UseFullPaths", "$OmitDefaultLibraryNames", "$ErrorReporting", "$AdditionalOptions", "$optimizerlevel", "$SymbolVisibility", "$gcc_extracompilerflags"];
  const configBrowseInformationFlags = ["$outputfile", "$AdditionalDependencies", "$AdditionalLibraryDirectories", "$SuppressStartupBanner", "$ModuleDefinitionFileName", "$IgnoreAllDefaultLibraries", "$IgnoreSpecificLibrary", "$ExportNamedFunctions", "$ForceSymbolReferences", "$UseUNICODEResponseFiles", "$LinkLibraryDependencies", "$AdditionalOptions"];
  const configLibrarianFlags = ["$outputfile"];
  const configLinkerFlags = ["$OutputFile", "$ShowProgress", "$Version", "$EnableIncrementalLinking", "$SuppressStartupBanner", "$IgnoreImportLibrary", "$RegisterOutput", "$AdditionalLibraryDirectories", "$LinkLibraryDependencies", "$UseLibraryDependencyInputs", "$UseUNICODEResponseFiles", "$AdditionalDependencies", "$IgnoreAllDefaultLibraries", "$IgnoreSpecificLibrary", "$ModuleDefinitionFile", "$AddModuleToAssembly", "$EmbedManagedResourceFile", "$ForceSymbolReferences", "$DelayLoadedDLLs", "$AssemblyLinkResource", "$GenerateManifest", "$ManifestFile", "$AdditionalManifestDependencies", "$AllowIsolation", "$UACExecutionLevel", "$GenerateDebugInfo", "$GenerateProgramDatabaseFile", "$StripPrivateSymbols", "$MapExports", "$DebuggableAssembly", "$SubSystem", "$HeapReserveSize", "$HeapCommitSize", "$StackReserveSize", "$StackCommitSize", "$EnableLargeAddresses", "$TerminalServer", "$SwapRunFromCD", "$SwapRunFromNetwork", "$Driver", "$RandomizedBaseAddress", "$RandomizedBaseAddress", "$References", "$EnableCOMDATFolding", "$EnableCOMDATFolding", "$OptimizeForWindows98", "$FunctionOrder", "$ProfileGuidedDatabase", "$LinkTimeCodeGeneration", "$MIDLCommands", "$IgnoreEmbeddedIDL", "$MergeIDLBaseFileName", "$TypeLibrary", "$TypeLibResourceID", "$EntryPoint", "$NoEntryPoint", "$SetChecksum", "$BaseAddress", "$FixedBaseAddress", "$TurnOffAssemblyGeneration", "$DelayLoadedDLL", "$ImportLibrary", "$MergeSections", "$TargetMachine", "$Profile", "$CLRThreadAttribute", "$CLRImageType", "$KeyFile", "$KeyContainer", "$DelaySign", "$ErrorReporting", "$CLRUnmanagedCodeCheck", "$ImageHasSafeExceptionHandlers", "$AdditionalOptions", "$SystemLibraries", "$SystemFrameworks", "$GCC_ExtraLinkerFlags"];
  const configGeneralFlags = ["$TargetExtension", "$TargetName", "$outputdirectory", "$intermediatedirectory", "$ExtensionsToDeleteOnClean", "$BuildLogFile", "$InheritedProjectPropertySheets", "$ConfigurationType", "$UseOfMFC", "$UseOfATL", "$MinimizeCRTUseInATL", "$CharacterSet", "$CommonLanguageRuntimeSupport", "$WholeProgramOptimization", "$PlatformToolset", "$ExecutableDirectories", "$GameOutputFile"];
  const configDebuggingFlags = ["$Command", "$CommandArguments", "$WorkingDirectory", "$Attach", "$DebuggerType", "$Environment", "$MergeEnvironment", "$SQLDebugging"];
  const configChildren = [custombuildstepFlags, configCompilerFlags, configLibrarianFlags, configLinkerFlags, configGeneralFlags, configDebuggingFlags, configPreBuildeventFlags, configPreLinkeventFlags, configPostBuildeventFlags, configManifesttoolFlags, configResourcesFlags, configXmldocumentgeneratorFlags, configBrowseInformationFlags,];

  //Some things may open scope after, or may not. 
  //Setting this to true indicates that if the next token isn't a scope operator, to remove the thing at the top of the stack.
  let possibleScope = false;
  //When in this mode, things aren't prefixed wit '$'.
  let LoadAddressMacroMode = false;

  fileContents.forEach((v, i) => {
    v = v.toLowerCase().replace(/"/gm, '');
    if (possibleScope && v !== '{') {
      stack.pop();
    }
    possibleScope = false;
    if (v.startsWith('{')) { scope++; }
    else if (v.startsWith('}')) {
      scope--;
      stack.pop();
      if (LoadAddressMacroMode) {
        LoadAddressMacroMode = false;
      }
    } else if (LoadAddressMacroMode) {
      let LoadAddressMacro = getStackTopS(stack);
      LoadAddressMacro.push(v.split(' '));
    } else if (!v.startsWith('$') && !v.startsWith('-$')) {
      throw ("Unexpected Flag: " + v);
    } else if (v.startsWith("$macro ")) {
      let mkro = v.split(' ');
      if (vpco.macros[mkro[1]] !== undefined) {
        console.error("Macro Redefinition! " + mkro[1] + ":", mkro[2] + ", " + vpco.macros[mkro[1]]);
      }
      vpco.macros[mkro[1]] = mkro[2];
    } else if (v.startsWith("$macrorequired ")) {
      let mkro = v.split(' ');
      vpco.reqMacros[mkro[1]] = { req: true, val: null };
    } else if (v.startsWith("$macrorequiredallowempty")) {
      let mkro = v.split(' ');
      vpco.reqMacros[mkro[1]] = { req: false, val: null };
    } else if (v.startsWith("$ignoreredundancywarning")) {
      let inc = v.split(' ').slice(1);
      vpco.others.push({ flag: "IgnoreRedundancyWarning", val: inc });
    } else if (v.startsWith("$include")) {
      let inc = v.split(' ');
      vpco.includes.push(inc[1]);
      //----------------------------------------------

    } else if (v.startsWith("$configuration")) {
      //Config
      //Configs can be attached to any file, or be global.
      let parent = getStackTop(stack) || vpco;
      let config = { val: sliceFirst(v) };
      if (parent.configs === undefined) {
        parent.configs = [];
      }
      parent.configs.push(config);
      stack.push(config);
    } else if (startsWithAny(v, configGroups)) {
      //Config Subgroup
      const a = startsWithAny(v, configGroups);
      if (v.startsWith("$custombuildstep") && getStackTop(stack) === undefined) {
        //console.info("Rare Floating Build Step");
        let FloatingBuildStep = { data: sliceFirst(v) }
        vpco.others.push({ flag: "custombuildstep", val: FloatingBuildStep });
        stack.push(FloatingBuildStep);
      } else {
        const cfg = getStackTopS(stack);
        let cfg_flag = { val: sliceFirst(v) };
        cfg[trimKey(a)] = cfg[trimKey(a)] || [];
        cfg[trimKey(a)].push(cfg_flag);
        stack.push(cfg_flag);
      }
    } else if (startsWithAnyAny(v, configChildren)) {
      let a = startsWithAnyAny(v, configChildren)
      let cfg_child = getStackTopS(stack);
      cfg_child[trimKey(a)] = cfg_child[trimKey(a)] || [];
      cfg_child[trimKey(a)].push(sliceFirst(v));
      //----------------------------------------------
    } else if (v.startsWith("$project")) {
      let proj = { folders: [], files: [], shaders: [], data: sliceFirst(v) };
      vpco.project = proj;
      stack.push(proj);
    } else if (v.startsWith("$folder")) {
      let folder = { folders: [], dynamicFiles: [], files: [], libs: [], impLibs: [], extLibs: [], excludes: [], data: sliceFirst(v) };
      let project = getStackTopS(stack);
      project.folders.push(folder);
      stack.push(folder);
    } else if (v.startsWith("$shader")) {
      let shader = sliceFirst(v)
      let project = getStackTopS(stack);
      project.shaders.push(shader);
    } else if (v.startsWith("$file")) {
      let file = { data: sliceFirst(v) };
      let folder = getStackTopS(stack);
      folder.files.push(file);
      stack.push(file);
      possibleScope = true;
    } else if (v.startsWith("$dynamicfile")) {
      let dynFile = { data: sliceFirst(v) };
      let folder = getStackTopS(stack);
      folder.dynamicFiles.push(dynFile);
    } else if (v.startsWith("$lib ")) {
      let lib = { data: sliceFirst(v) };
      let folder = getStackTopS(stack);
      folder.libs.push(lib);
    } else if (v.startsWith("$libexternal")) {
      let libext = { data: sliceFirst(v) };
      let folder = getStackTopS(stack);
      folder.extLibs.push(libext);
    } else if (v.startsWith("$implib")) {
      let impLib = { data: sliceFirst(v) };
      let folder = getStackTopS(stack);
      folder.impLibs.push(impLib);
    } else if (v.startsWith("-$")) {
      let exclude = { data: sliceFirst(v) };
      let folder = getStackTopS(stack);
      folder.excludes.push(exclude);
      //----------------------------------------------
    } else if (v.startsWith("$additionaloptions")) {
      //This can appear anywhere, hopefully not floating.
      let adnopt = { data: sliceFirst(v) };
      let folder = getStackTopS(stack);
      folder["additionaloptions"] = adnopt;
    } else if (v.startsWith("$loadaddressmacroauto")) {
      LoadAddressMacroMode = true;
      let AddressMacros = [];
      stack.push(AddressMacros);
      vpco.others.push({ flag: "LoadAddressMacroAuto", val: AddressMacros });
    } else if (v.startsWith("$loadaddressmacro")) {
      LoadAddressMacroMode = true;
      let AddressMacros = [];
      stack.push(AddressMacros);
      vpco.others.push({ flag: "LoadAddressMacro", val: AddressMacros });
    } else {
      console.warn("Unknown keyword", v, "Line: approx:", i);
      const key = sliceFirst(v);
      MissingkeywordMap[key] = MissingkeywordMap[key] || 0;
      MissingkeywordMap[key]++;
    }
  });

  if (scope != 0 && stack.length != 0) {
    throw ("Scope error!");
  }


  return (vpco);
}


function Link(VPCOs) {
  //Suppress warnings for:
  let missingVPCOs = [
    "source_ppu_prx_ps3_base.vpc",
    "source_lib_x360_base.vpc",
    "source_ppu_lib_ps3_base.vpc", "source_xex_x360_base.vpc", "source_dll_x360_base.vpc", "source_replay.vpc", "source_ppu_elf_ps3_base.vpc"];

  const findV = (fn) => VPCOs.find((v) => v.f == fn);
  const deMacro = (vcpo, str) => {
    for (m in vcpo.macros) {
      str = str.replace('$' + m, vcpo.macros[m]);
    }
    return str;
  };
  //Assume only vpc's with $Project "Something" are Targets
  let targets = VPCOs.filter((vpco) => {
    return vpco.project && vpco.project.data !== "";
  });

  console.log(targets.length, "Targets Found");


  let getIncludes = (VPCO, parentChain) => {
    parentChain = parentChain || [];
    return VPCO.includes.map((i) => {
      let di = deMacro(VPCO, i);
      let dip = path.resolve(path.dirname(VPCO.f), di);
      let ivpco = findV(dip);

      if (missingVPCOs.find((v) => v === path.basename(di))) {
        return { resolvedPath: dip, data: undefined, rawPath: i };
      }

      if (!ivpco) {
        //Try resolving macros by looking up the parent chain.
        let macroContext = { macros: {} }
        for (let idx = parentChain.length; idx >= 1; idx--) {
          const p = parentChain[idx - 1];
          for (m in p.macros) {
            if (macroContext.macros[m] !== undefined && macroContext.macros[m] !== p.macros[m]) {
              console.warn("Macro redefinition in include chain:", m, "-", macroContext.macros[m], "-", p.macros[m]);
            }
            macroContext.macros[m] = p.macros[m];
          }
          //attempt resolve
          di = deMacro(macroContext, i);
          dip = path.resolve(path.dirname(VPCO.f), di);
          ivpco = findV(dip);
          VPCO.macroChain = macroContext;
          if (ivpco) {
            //  console.log("YAY!", idx, path.basename(dip));
            break;
          }
        }
      }
      if (!ivpco) {
        //try hack
        let findThisFolder = path.basename(path.dirname(di));
        let anotherFileHere = VPCOs.find((v) => path.basename(path.dirname(v.f)) == findThisFolder);

        if (anotherFileHere) {
          let newpath = path.dirname(anotherFileHere.f);
          //But is the file here?
          if (findV(newpath + path.sep + path.basename(di))) {
            dip = newpath + path.sep + path.basename(di);
            ivpco = findV(dip);
            //console.warn("Using search hack to locate ", di, newpath);
          }
        }
      }

      if (ivpco) {
        parentChain.push(VPCO);
        //console.log("Including ", path.basename(dip));
        //console.log(" ".repeat(parentChain.length)+"including",path.basename(dip));
        //  console.log("Including ", path.basename(dip), "#", parentChain.reduce((p, c, i) => p + "\n" + " ".repeat(i) + "-> " + path.basename(c.f), ""));
        ivpco.includesVCPO = ivpco.includesVCPO || [];
        //recurse down
        ivpco.includesVCPO = getIncludes(ivpco, parentChain);
        return { resolvedPath: dip, data: ivpco, rawPath: i };
      } else {
        console.warn("Can't find include " + dip + "\n RawString:" + i + "\n From File " + VPCO.f);
        return { resolvedPath: dip, data: undefined, rawPath: i };;
      }
    }

    );
  }

  //Will recurse down B, merging into A. B tree shouldn't change.
  let DeepMerge = (a, b) => {
    if (!b) {
      a.includesVCPO.forEach(ip => {
        if (ip.data === undefined) { return; }
        DeepMerge(a, ip.data);
      });
    } else {
      b.includesVCPO.forEach(ip => {
        if (ip.data === undefined) { return; }
        DeepMerge2(a, ip.data);
      });
    }
  }

  function GetMeANewOfThisType(a) {
    if (typeof (a) === 'object') {
      if (Array.isArray(a)) {
        return [];
      } else {
        return {};
      }
    }
    return 0;
  }
  function DeepMerge2(a, b) {
    if (typeof (b) === 'object') {
      if (Array.isArray(b)) {
        return a.concat(b.map((v) => DeepMerge2(GetMeANewOfThisType(v), v)));
      } else {
        for (let key in b) {
          if (a[key] === undefined) {
            a[key] = GetMeANewOfThisType(b[key]);
          }else if(typeof a[key] !== 'object'){
            //Already existing primative, skip
            if(a[key] !== b[key] && key !== 'f' && key !== 'data'){
              console.warn("include flag overwrite: ", key,"-", a[key], b[key]);
            }
            continue;
          }
          a[key] = DeepMerge2(a[key], b[key]);
        }
        return a;
      }
    }
    return b;
  };

  //Link Includes
  targets.forEach((t) => {
    try {
      t.includesVCPO = getIncludes(t);
      console.log("---\nLink done for ", t.f);
      DeepMerge(t);
      console.log("---\nMErge done for ", t.f);
    } catch (error) {
      console.warn("Link error", t.f);
      console.warn(error);
    }
  });
  console.log("Link done");


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

  let vpos = await Promise.all(VPC_FILE_LIST.map(Parse));

  //console.log(JSON.stringify(vpos));
  console.info("Parsing Done, Files:", vpos.length);
  if (Object.keys(MissingkeywordMap).length !== 0 || MissingkeywordMap.constructor !== Object) {
    let keysSorted = Object.keys(MissingkeywordMap).sort(function (a, b) { return MissingkeywordMap[b] - MissingkeywordMap[a] })
    let unkowncnt = Object.keys(MissingkeywordMap).reduce((prev, curr, i) => { return prev + MissingkeywordMap[curr] }, 0);
    console.log("Unknown Count", unkowncnt, " Unique:", Object.keys(MissingkeywordMap).length);
    for (let index = 0; index < keysSorted.length; index++) {
      console.log(keysSorted[index], MissingkeywordMap[keysSorted[index]]);
    }
  }

  Link(vpos);
}




Main();