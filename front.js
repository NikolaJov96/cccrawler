/*
CommentBuffer: [{
    natLangId: String
    progLang: String
    repoId: String
    sourceId: String
    commentId: String
    comment: String
    label: String
}]
*/

/*
SourceBuffer: [{
    repoId: String
    sourceId: String
    linesInFile: String
    sourceUrl: String
}]
*/

var commentBuffer = [];
var sourceBuffer = [];
var commentData = null;
var oldResume = "";

var natLangId = "EN";
var progLang = "C";

// Prevent accidental refresh
window.onbeforeunload = function() {
    return "Are you sure you want to reload?";
}

// Dump comment (along with context) to page
function dumpComment(window, comment, path, sizeInLines, cursor, repoId, sourceId, commentLine, htmlUrl, error) {
    console.log();
    console.log(window, comment, path, sizeInLines, cursor, repoId, sourceId, commentLine, htmlUrl, error);

    // Set the continuation path
    if (commentData === null) oldResume = path + ":" + 0
    else oldResume = commentData.path + ":" + commentData.cursor

    commentData = {
        "window": window, 
        "comment": comment,
        "path": path, 
        "sizeInLines": sizeInLines,
        "cursor": cursor, 
        "repoId": repoId, 
        "sourceId": sourceId, 
        "commentLine": commentLine, 
        "htmlUrl": htmlUrl,
        "error": error
    };

    if (error.length > 0) {
        document.getElementById("code").innerHTML = "";
        document.getElementById("comment").value = error;
    } else {
        document.getElementById("code").innerHTML = hljs.highlight("c", window).value;
        document.getElementById("comment").value = comment;
        document.getElementById("fileUrl").href = htmlUrl + "#L" + commentLine;
    }
    document.getElementById("labeledCounter").innerHTML = "Comments labeled in this session: " + commentBuffer.length;
}

// Start button action
function startFromNewPosition() {
    var repoAuthor = document.getElementById("inRepoUsername").value;
    if (repoAuthor === "") {
        alert("Repository author must be specified.");
        return;
    }
    var repoName = document.getElementById("inRepoName").value;
    if (repoName === "") {
        alert("Repository name must be specified.");
        return;
    }
    var pathToDir = document.getElementById("inPathToDir").value;
    var pathToFile = document.getElementById("inPathToFile").value;

    document.getElementById("code").innerHTML = "Loading content...";

    document.getElementById("setupDiv").style.display = "none";
    document.getElementById("runningDiv").style.display = "block";

    commentBuffer = [];
    sourceBuffer = [];
    commentData = null;
    oldResume = "";

    nextComment(
        {
            "repoAuthor": repoAuthor,
            "repoName": repoName,
            "exclusivePath": pathToDir,
            "continuePos": pathToFile
        },
        dumpComment
    );
}

// Next comment button action
function processCommentAndContinue() {

    var labels = document.getElementById("labels");
    var selectedLabel = labels.options[labels.selectedIndex].value;

    commentBuffer.push({
        "natLangId": natLangId,
        "progLang": progLang,
        "repoId": commentData.repoId,
        "sourceId": commentData.sourceId,
        "commentId": hashCode(commentData.repoId + commentData.sourceId + commentData.cursor.toString()),
        "comment": commentData.comment.split("\n").join("/n"),
        "label": selectedLabel
    });

    source = {
        "repoId": commentData.repoId,
        "sourceId": commentData.sourceId,
        "linesInFile": commentData.sizeInLines.toString(),
        "sourceUrl": commentData.htmlUrl
    };
    if (sourceBuffer.every((elem) => { return elem.repoId !== source.repoId || elem.sourceId !== source.sourceId })) {
        sourceBuffer.push(source);
    }
    
    nextComment(null, dumpComment);
}

// Skip comment button action
function skipCommentAndContinue() {
    nextComment(null, dumpComment);
}

// Save to file button action
function finishLabeling() {
    document.getElementById("runningDiv").style.display = "none";
    document.getElementById("dumpDiv").style.display = "block";

    document.getElementById("resumePath").innerHTML = oldResume;
}

// Go back to labeling after "finish labeling" has been clicked
function continueLabeling() {
    document.getElementById("runningDiv").style.display = "block";
    document.getElementById("dumpDiv").style.display = "none";
}

// Copy contents of the tab separated file with comments to clipboard
function copyTabComments() {
    text = "";
    commentBuffer.forEach((elem) => {
        text += elem.natLangId + "\t" +
            elem.progLang + "\t" + 
            elem.repoId + "\t" + 
            elem.sourceId + "\t" + 
            elem.commentId + "\t" + 
            elem.comment + "\t" + 
            elem.label + "\n"
    });
    textArea = document.getElementById("copyText");
    textArea.value = text;
    textArea.focus();
    textArea.select();
}

// Copy contents of the tab separated file with sources to clipboard
function copyTabSources() {
    text = "";
    sourceBuffer.forEach((elem) => {
        text += 
            elem.repoId + "\t" +
            elem.sourceId + "\t" +
            elem.linesInFile + "\t" +
            elem.sourceUrl + "\n"
    });
    textArea = document.getElementById("copyText");
    textArea.value = text;
    textArea.focus();
    textArea.select();
}

// Copy contents of the comma separated file with comments to clipboard (for WEKA)
function copyCommaComments() {
    text = "";
    commentBuffer.forEach((elem) => { 
        comment = elem.comment
        comment = comment.split("'").join("\\'")
        comment = comment.split("\"").join("\\\"")
        comment = "'" + comment + "'"
        text += comment + "," + elem.label + "\n" 
    });
    textArea = document.getElementById("copyText");
    textArea.value = text;
    textArea.focus();
    textArea.select();
}
