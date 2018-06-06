import path = require('path');
import tl = require('vsts-task-lib/task');

var repoRoot: string = tl.getVariable('System.DefaultWorkingDirectory');

var rootFolderOrFile: string = makeAbsolute(path.normalize(tl.getPathInput('rootFolderOrFile', true, false).trim()));
var includeRootFolder: boolean = tl.getBoolInput('includeRootFolder', true);
var archiveType: string = tl.getInput('archiveType', true);
var archiveFile: string = path.normalize(tl.getPathInput('archiveFile', true, false).trim());
var replaceExistingArchive: boolean = tl.getBoolInput('replaceExistingArchive', true);

tl.debug('repoRoot: ' + repoRoot);

var win = tl.osType().match(/^Win/);
tl.debug('win: ' + win);

// archivers
var xpTarLocation: string;
var xpZipLocation: string;
// 7zip
var xpSevenZipLocation: string;
var winSevenZipLocation: string = path.join(__dirname, '7zip/7z.exe');

function getSevenZipLocation(): string {
    if (win) {
        return winSevenZipLocation;
    } else {
        if (typeof xpTarLocation == "undefined") {
            xpSevenZipLocation = tl.which('7z', true);
        }
        return xpSevenZipLocation;
    }
}

function findFiles(): string[] {
    if (includeRootFolder) {
        return [path.basename(rootFolderOrFile)];
    } else {
        var fullPaths: string[] = tl.ls('-A', [rootFolderOrFile]);
        var baseNames: string[] = [];
        for (var i = 0; i < fullPaths.length; i++) {
            baseNames[i] = path.basename(fullPaths[i]);
        }
        return baseNames;
    }
}

function makeAbsolute(normalizedPath: string): string {
    tl.debug('makeAbsolute:' + normalizedPath);

    var result = normalizedPath;
    if (!path.isAbsolute(normalizedPath)) {
        result = path.join(repoRoot, normalizedPath);
        tl.debug('Relative file path: ' + normalizedPath + ' resolving to: ' + result);
    }
    return result;
}

function getOptions() {
    var dirName: string;
    if (includeRootFolder) {
        dirName = path.dirname(rootFolderOrFile);
        tl.debug("cwd (include root folder)= " + dirName);
        return { cwd: dirName };
    } else {
        var stats: tl.FsStats = tl.stats(rootFolderOrFile);
        if (stats.isFile()) {
            dirName = path.dirname(rootFolderOrFile);
        } else {
            dirName = rootFolderOrFile;
        }
        tl.debug("cwd (exclude root folder)= " + dirName);
        return { cwd: dirName };
    }
}

function sevenZipArchive(archive: string, compression: string, files: string[]) {
    tl.debug('Creating archive with 7-zip: ' + archive);
    var sevenZip = tl.createToolRunner(getSevenZipLocation());
    sevenZip.arg('a');
    sevenZip.arg('-t' + compression);
    sevenZip.arg(archive);
    for (var i = 0; i < files.length; i++) {
        sevenZip.arg(files[i]);
    }
    return handleExecResult(sevenZip.execSync(getOptions()), archive);
}

// linux & mac only
function zipArchive(archive: string, files: string[]) {
    tl.debug('Creating archive with zip: ' + archive);
    if (typeof xpZipLocation == "undefined") {
        xpZipLocation = tl.which('zip', true);
    }
    var zip = tl.createToolRunner(xpZipLocation);
    zip.arg('-r');
    zip.arg(archive);
    for (var i = 0; i < files.length; i++) {
        zip.arg(files[i]);
        console.log(tl.loc('Filename', files[i]));
    }
    return handleExecResult(zip.execSync(getOptions()), archive);
}

// linux & mac only
function tarArchive(archive: string, compression: string, files: string[]) {
    tl.debug('Creating archive with tar: ' + archive + ' using compression: ' + compression);
    if (typeof xpTarLocation == "undefined") {
        xpTarLocation = tl.which('tar', true);
    }
    var tar = tl.createToolRunner(xpTarLocation);
    if (tl.exist(archive)) {
        tar.arg('-r'); // append files to existing tar
    } else {
        tar.arg('-c'); // create new tar otherwise
    }
    if (compression) {
        tar.arg('--' + compression);
    }
    tar.arg('-f');
    tar.arg(archive);
    for (var i = 0; i < files.length; i++) {
        tar.arg(files[i]);
    }
    return handleExecResult(tar.execSync(getOptions()), archive);
}

function handleExecResult(execResult, archive) {
    if (execResult.code != tl.TaskResult.Succeeded) {
        tl.debug('execResult: ' + JSON.stringify(execResult));
        failTask(tl.loc('ArchiveCreationFailedWithError', archive, execResult.code, execResult.stdout, execResult.stderr, execResult.error));
    }
}

function failTask(message: string) {
    throw new FailTaskError(message);
}

export class FailTaskError extends Error {
}

/**
 * Windows only
 * standard gnu-tar extension formats with recognized auto compression formats
 * https://www.gnu.org/software/tar/manual/html_section/tar_69.html
 *   
 * Computes the name of the tar to use inside a compressed tar.
 * E.g. foo.tar.gz is expected to have foo.tar inside
 */
function computeTarName(archiveName: string): string {

    var lowerArchiveName = archiveName.toLowerCase();

    //standard full extensions
    //                     gzip        xz        bzip2
    var fullExtensions = ['.tar.gz', '.tar.xz', '.tar.bz2'];
    for (var i = 0; i < fullExtensions.length; i++) {
        if (lowerArchiveName.endsWith(fullExtensions[i])) {
            return archiveName.substring(0, archiveName.lastIndexOf('.'));
        }
    }

    //standard abbreviated extensions
    //                 gzip    gzip    bzip2   bzip2   bzip2   xz
    var extensions = ['.tgz', '.taz', '.tz2', 'tbz2', '.tbz', '.txz'];
    for (var i = 0; i < extensions.length; i++) {
        if (lowerArchiveName.endsWith(extensions[i])) {
            return archiveName.substring(0, archiveName.lastIndexOf('.')) + '.tar';
        }
    }

    // if 7zip falls down here, or if a .tz2 file is encountered, there is occasionally strange
    // behavior resulting in archives that are correct but are renamed
    // e.g. test.tz2 has test inside of it instead of test.tar (7z decides to rename it)
    // e.g. test_tgz has an outer name of test_tgz.gz (7z decides to add the .gz to it).

    //non standard name

    //foo.tar.anything --> foo.tar
    if (lowerArchiveName.lastIndexOf('.tar.') > 0) {
        return archiveName.substring(0, lowerArchiveName.lastIndexOf('.tar.') + 4);
    }
    // foo.anything --> foo.tar
    else if (lowerArchiveName.lastIndexOf('.') > 0) {
        return archiveName.substring(0, lowerArchiveName.lastIndexOf('.')) + '.tar';
    }
    // foo --> foo.tar
    return lowerArchiveName + '.tar';
}

function createArchive(files: string[]) {

    if (win) { // windows only
        if (archiveType == "default" || archiveType == "zip") { //default is zip format
            sevenZipArchive(archiveFile, "zip", files);
        } else if (archiveType == "tar") {
            var tarCompression: string = tl.getInput('tarCompression', true);
            if (tarCompression == "none") {
                sevenZipArchive(archiveFile, archiveType, files);
            } else {
                var tarFile = computeTarName(archiveFile);
                var tarExists = tl.exist(tarFile);
                try {
                    if (tarExists) {
                        console.log(tl.loc('TarExists', tarFile));
                    }

                    // this file could already exist, but not checking because by default files will be added to it
                    // create the tar file
                    sevenZipArchive(tarFile, archiveType, files);
                    // compress the tar file
                    var sevenZipCompressionFlag = tarCompression;
                    if (tarCompression == 'gz') {
                        sevenZipCompressionFlag = 'gzip';
                    } else if (tarCompression == 'bz2') {
                        sevenZipCompressionFlag = 'bzip2';
                    }
                    sevenZipArchive(archiveFile, sevenZipCompressionFlag, [tarFile]);
                } finally {
                    // delete the tar file if we created it.
                    if (!tarExists) {
                        tl.rmRF(tarFile);
                    }
                }
            }
        } else {
            sevenZipArchive(archiveFile, archiveType, files);
        }
    } else { // not windows
        if (archiveType == "default" || archiveType == "zip") { //default is zip format
            zipArchive(archiveFile, files);
        } else if (archiveType == "tar") {
            var tarCompression: string = tl.getInput('tarCompression', true);
            var tarCompressionFlag;
            if (tarCompression == "none") {
                tarCompressionFlag = null;
            } else if (tarCompression == "gz") {
                tarCompressionFlag = "gz";
            } else if (tarCompression == "bz2") {
                tarCompressionFlag = "bzip2";
            } else if (tarCompression == "xz") {
                tarCompressionFlag = "xz";
            }
            tarArchive(archiveFile, tarCompressionFlag, files);
        } else {
            sevenZipArchive(archiveFile, archiveType, files);
        }
    }
}

function doWork() {
    try {
        tl.setResourcePath(path.join( __dirname, 'task.json'));
        // Find matching archive files
        var files: string[] = findFiles();
        tl.debug('Found: ' + files.length + ' files to archive:');
        for (var i = 0; i < files.length; i++) {
            tl.debug(files[i]);
        }

        // replaceExistingArchive before creation?
        if (tl.exist(archiveFile)) {
            if (replaceExistingArchive) {
                try {
                    var stats: tl.FsStats = tl.stats(archiveFile);
                    if (stats.isFile()) {
                        console.log(tl.loc('RemoveBeforeCreation', archiveFile));
                    } else {
                        failTask(tl.loc('ArchiveFileExistsButNotAFile', archiveFile));
                    }
                } catch (e) {
                    failTask(tl.loc('FailedArchiveFile', archiveFile, e));
                }
            } else {
                console.log(tl.loc('AlreadyExists', archiveFile));
            }
        }

        //ensure output folder exists
        var destinationFolder = path.dirname(archiveFile);
        tl.debug("Checking for archive destination folder:" + destinationFolder);
        if (!tl.exist(destinationFolder)) {
            tl.debug("Destination folder does not exist, creating:" + destinationFolder);
            tl.mkdirP(destinationFolder);
        }

        createArchive(files);

        tl.setResult(tl.TaskResult.Succeeded, 'Successfully created archive: ' + archiveFile);
    } catch (e) {
        tl.debug(e.message);
        tl._writeError(e);
        tl.setResult(tl.TaskResult.Failed, e.message);
    }
}

doWork();