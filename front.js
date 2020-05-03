// Prevent accidental refresh
window.onbeforeunload = function() {
    return "Are you sure you want to reload?"
}

// Dump comment (along with context) to page
function dumpComment(window, comment, path, sizeInLines, cursor, repoId, sourceId, commentLine, error) {
    console.log()
    console.log(window, comment, path, sizeInLines, cursor, repoId, sourceId, commentLine, error)
    document.getElementById("contextArea").value = window
}

// Start button action
function startFromNewPosition() {
    var repoURL = document.getElementById("inRepoURL").value
    if (repoURL === "") {
        alert("Repository URL must be specified.")
        return
    }
    var pathToDir = document.getElementById("inPathToDir").value
    var pathToFile = document.getElementById("inPathToFile").value

    document.getElementById("contextArea").value = "Loading content..."

    nextComment(
        {
            "url": repoURL,
            "exclusivePath": pathToDir,
            "continuePos": pathToFile
        },
        dumpComment
    )
}
/*
        {
            "url": "https://api.github.com/repos/torvalds/linux/contents/",
            "exclusivePath": "kernel/",
            //"continuePos": "kernel/bpf/bpf_lru_list.c:40"
            "continuePos": ""
        },
*/

// Next comment button action
function processCommentAndContinue() {
    nextComment(null, dumpComment)
}

// Skip comment button action
function skipCommentAndContinue() {
    nextComment(null, dumpComment)
}

// Save to file button action
function doNothing() {
    console.log("Not yet implemented")
}
