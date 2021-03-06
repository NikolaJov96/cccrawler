/*
Directory object structure:
Dir: {
  path: String,
  subDirs: [String],
  cFiles: [String],
  currSubDir: Dir
  selectedType: "none"|"dir"|"file"
  selectedId: Int
}
*/

// Regex for parsing the string describing the position in the specific file
var filePosReg = /^(.+)\/([^/]+\.c)\:([0-9]+)$/g;
// Target number of lines to give context to the comment
var targetWindowLines = 15;
// At which line of the context should comment begin
var targetCommentStartLine = 5;
// Print debug logs
var debug = true;

// GitHub API URL to the desired repo
var repoUrl = "";
// RepoID generated by hashing of the URL
var repoId = 0;
// Sub-dir to look inside
var exclusivePath = "";
// Stack of dir objects
var dirStack = null;
// Object representing a file, currently being parsed
var fle = null;

// Generate a simple, non-secure hash of a string
hashCode = function(str) {
  var hash = 0;
  if (str.length === 0) return hash;
  for (var i = 0; i < str.length; i++) {
      var char = str.charCodeAt(i);
      hash = Math.abs(((hash << 5) - hash) + char);
  }
  return hash.toString();
}

// Send a request to GitHub API, parse the response into JSON and forward it to the callback
getGitHubReq = function (url, callback) {

  if (debug) console.log();
  if (debug) console.log("getGitHubReq called");
  if (debug) console.log("url", url);

  xmlHttp = new XMLHttpRequest();
  xmlHttp.onreadystatechange = function () {
    if (xmlHttp.readyState == 4 && xmlHttp.status == 200) callback(JSON.parse(xmlHttp.responseText));
  }
  xmlHttp.open("GET", url, true);
  xmlHttp.send(null);
}

// Call getGitHubReq and parse it's output as a dir structure
getGitHubDir = function (url, pathName, callback) {

  if (debug) console.log();
  if (debug) console.log("getGitHubDir called");
  if (debug) console.log("url", url);
  if (debug) console.log("pathName", pathName);

  getGitHubReq(url, (res) => {

    if (debug) console.log();
    if (debug) console.log("getGitHubReq callback called");
    if (debug) console.log("res", res);

    // Define new dir object
    dir = {
      "path": pathName,
      "subDirs": [],
      "cFiles": [],
      "currSubDir": null,
      "selectedType": "none",
      "selectedId": 0
    };

    // Populate the sub-dir and C file lists
    res.forEach(element => {
      if (element.type === "dir") dir.subDirs.push(element.path)
      else if (element.type === "file" && element.name.endsWith('.c')) dir.cFiles.push(element.path)
    });

    callback(dir);
  })
}

// Call getGitHubReq and parse it's output as a C file
getGitHubFile = function (url, callback) {

  if (debug) console.log();
  if (debug) console.log("getGitHubFile called");
  if (debug) console.log("url", url);

  getGitHubReq(url, (res) => {

    if (debug) console.log();
    if (debug) console.log("getGitHubReq callback called");
    if (debug) console.log("res", res);

    // Decode base64 encoded C file content and add one new line to help out the parser
    // Also return HTML URL to the file on GitHub
    callback(atob(res.content) + '\n', res.html_url);
  })
}

// Make one step with the cursor and account for moving the context window
cursorStep = function () {

  if (fle.content.charAt(fle.cursor) === '\n') {
    // New line found, adjust the window accordingly
    fle.cursorLine += 1
    if (fle.windowStartLine + targetCommentStartLine === fle.cursorLine) {
      // Try to move window, if not constrained by the end of the file
      if (fle.windowEndLine < fle.sizeInLines) {
        while (fle.content.charAt(fle.windowStart) !== '\n') fle.windowStart += 1;
        fle.windowStart += 1;
        while (fle.content.charAt(fle.windowEnd) !== '\n') fle.windowEnd += 1;
        fle.windowEnd += 1;
        fle.windowStartLine += 1;
        fle.windowEndLine += 1;
      }
    }
  }
  fle.cursor += 1;

}

// Look for comments inside the currently opened file and request the new one to be opened when current one is done
findNextComment = function (mainCallback) {

  if (debug) console.log();
  if (debug) console.log("findNextComment called");

  // Check for different unexpected errors
  if (repoUrl.length === 0) mainCallback("", "", "", 0, 0, "", "", 0, "", "Repo URL not provided")
  else if (dirStack === null) mainCallback("", "", "", 0, 0, "", "", 0, "", "Directory stack not initialized")
  else if (dirStack.length === 0) mainCallback("", "", "", 0, 0, "", "", 0, "", "Directory stack empty")
  else if (fle === null) mainCallback("", "", "", 0, 0, "", "", 0, "", "File object not initialized")
  else if (fle.content.length === 0) mainCallback("", "", "", 0, 0, "", "", 0, "", "File content found empty")
  else {

    // General pipeline:
    // go through the file and try to find next comment
    // if there are none find next file
      // find next comment

    // Parser states: "init"|"line"|"block"
    parserState = "init";

    // Walk the cursor and the window until the next comment is found, or end of file reached
    while(parserState === "init" && fle.cursor + 1 < fle.content.length) {
      if (fle.content.substring(fle.cursor, fle.cursor + 2) === "//") {
        // Beginning of the line comment found
        parserState = "line";
        fle.cursor += 2;
      } else if (fle.content.substring(fle.cursor, fle.cursor + 2) === "/*") {
        // Beginning of the block comment found
        parserState = "block";
        fle.cursor += 2;
      } else {
        cursorStep()
      }
    }

    if (parserState === 'init') {
      // No comment found, request new file
      findNextFile(mainCallback, null);
    } else {

      // Store the comment context window and the comment line number
      // They will be modified in the following code
      contextWindow = fle.content.substring(fle.windowStart, fle.windowEnd);
      commentLine = fle.cursorLine;

      // Extract the comment body
      commentStart = fle.cursor;
      if (parserState == 'line') while (fle.content.charAt(fle.cursor) !== '\n') cursorStep()
      else while (fle.content.substring(fle.cursor, fle.cursor + 2) !== '*/') cursorStep()
      // After this, the cursor is pointing at the end of the analyzed comment

      // Call the main callback and report the found comment
      mainCallback(
        contextWindow,
        fle.content.substring(commentStart, fle.cursor),
        fle.path,
        fle.sizeInLines,
        fle.cursor,
        repoId,
        fle.sourceId,
        commentLine,
        fle.html_url,
        "");
    }
  }
}

// Start from the deepest opened dir and find the next C file
findNextFile = function (mainCallback, continueInfo) {

  if (debug) console.log();
  if (debug) console.log("findNextFile called");

  // Find the deepest opened dir
  currDir = dirStack;
  depth = 1;
  while (currDir.currSubDir !== null) {
    currDir = currDir.currSubDir;
    depth += 1;
  }
  if (debug) console.log("currDir", currDir.path)

  if (currDir.selectedType === "none") {
    // First access to the folder, access the dirs first
    currDir.selectedType = "dir";
    currDir.selectedId = -1;
  }

  if (currDir.selectedType === "dir") {
    currDir.selectedId += 1;
    if (currDir.selectedId >= currDir.subDirs.length) {
      // All sub-dirs exhausted, continue with files
      currDir.selectedType = "file";
      currDir.selectedId = -1;
    } else {
      // Open the next sub-dir (check if it is on the continue path)
      if (continueInfo === null || (continueInfo[1] + "/").startsWith(currDir.subDirs[currDir.selectedId] + "/")) {
        getGitHubDir(repoUrl + currDir.subDirs[currDir.selectedId], currDir.subDirs[currDir.selectedId], (dir) => {

          if (debug) console.log();
          if (debug) console.log("getGitHubDir callback called");
          if (debug) console.log("dir", dir);

          currDir.currSubDir = dir;

          findNextFile(mainCallback, continueInfo);
        })
      } else {
        // Continue dir provided, but not matched this time, try with the next sub-dir
        if (debug) console.log("Unsatisfactory continue sub-dir", currDir.subDirs[currDir.selectedId])
        findNextFile(mainCallback, continueInfo)
        return
      }
    }
  }

  if (currDir.selectedType === "file"){
    currDir.selectedId += 1;
    if (currDir.selectedId >= currDir.cFiles.length) {
      // All files exhausted, go back to the previous dir from the stack
      if (debug) console.log("going back")
      delDir = dirStack;
      if (dirStack.currSubDir === null) {
        // Trying to return from the root dir, all files in requested exclusive path are analyzed
        if (debug) console.log("whole search domain exhausted")
        if (continueInfo === null) mainCallback("", "", "", 0, 0, "", "", 0, "", "All comments in the requested exclusive path are analyzed")
        else mainCallback("", "", "", 0, 0, "", "", 0, "", "Requested continue position not found")
      } else {
        // Pop the current dir and recursively findNextFile in it's parent
        while (delDir.currSubDir.currSubDir !== null) delDir = delDir.currSubDir
        delDir.currSubDir = null;
        findNextFile(mainCallback, continueInfo);
      }
    } else {
      // Open the next file (check if it is the requested continue file)
      if (continueInfo === null || (
        currDir.path === continueInfo[1] && (
          currDir.cFiles[currDir.selectedId] === continueInfo[2] || currDir.cFiles[currDir.selectedId].endsWith("/" + continueInfo[2])
        )
      )) {
        getGitHubFile(repoUrl + currDir.cFiles[currDir.selectedId], (content, html_url) => {

          if (debug) console.log();
          if (debug) console.log("getGitHubFile callback called");

          // Initialize parser

          fle = {
            "path": currDir.cFiles[currDir.selectedId],
            "sourceId": hashCode(currDir.cFiles[currDir.selectedId]),
            "content": content,
            "sizeInLines": (content.split(/[\n]/g) || []).length,
            "html_url": html_url,
            "windowStart": 0,
            "windowStartLine": 1,
            "windowEnd": 0,
            "windowEndLine": 1,
            "cursor": 0,
            "cursorLine": 1
          }

          if (debug) console.log("content", fle.content.substring(0, 30));
          if (debug) console.log("sizeInLines", fle.sizeInLines);

          // Initialize the comment context window
          while (fle.windowEndLine < targetWindowLines && fle.windowEnd < fle.content.length) {
            if (fle.content[fle.windowEnd] == '\n') fle.windowEndLine += 1
            fle.windowEnd += 1;
          }
          if (debug) console.log("windowEnd", fle.windowEnd)
          if (debug) console.log("windowEndLine", fle.windowEndLine)

          // If continue info is provided, walk to the specified position inside the file
          if (continueInfo !== null) {
            targetCursor = parseInt(continueInfo[3]);
            if (debug) console.log("Stepping to the char", targetCursor)
            while (fle.cursor < targetCursor) cursorStep()
          }

          // Start looking for comments in the just initialized file
          findNextComment(mainCallback);
        })
      } else {
        // Continue info provided, but not matched this time, try with the next file
        if (debug) console.log("Unsatisfactory continue file", currDir.cFiles[currDir.selectedId])
        findNextFile(mainCallback, continueInfo)
      }
    }
  }
}

nextComment = function (initState, mainCallback) {

  if (debug) console.log();
  if (debug) console.log("nextComment called");
  if (debug) console.log("initState", initState);

  if (initState !== null) {
    // initState is not null, so reinitialize the whole crawler
    if (initState.repoAuthor.length === 0 || initState.repoName.length === 0) {
      mainCallback("", "", "", 0, 0, "", "", 0, "", "Invalid GitHub repo parameters")
      return
    }
    repoUrl = "https://api.github.com/repos/" + initState.repoAuthor + "/" + initState.repoName + "/contents/";
    repoId = hashCode(repoUrl);
    continueInfo = null
    if (initState.continuePos.length > 0) {
      continueInfo = filePosReg.exec(initState.continuePos)
      if (debug) console.log("Parsed continue position", continueInfo)
      if (continueInfo.length !== 4) {
        // Invalid input
        mainCallback("", "", "", 0, 0, "", "", 0, "", "Invalid continue position string")
        return
      }
    }

    // General pipeline:
    // get root dir (go directly to the requested exclusivePath)
      // find next file (with optional parameters of the specific continue position)
        // find next comment

    getGitHubDir(repoUrl + initState.exclusivePath, initState.exclusivePath, (dir) => {

      if (debug) console.log();
      if (debug) console.log("getGitHubDir callback called");
      if (debug) console.log("dir", dir);

      // Root dir found
      dirStack = dir;

      // Look for C files and comments
      findNextFile(mainCallback, continueInfo);
    })
  } else {
    // New init has not been passed, valid previously opened file expected to be found
    findNextComment(mainCallback, null);
  }
}
