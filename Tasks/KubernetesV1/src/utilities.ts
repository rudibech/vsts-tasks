"use strict";

var https   = require('https');
var fs      = require('fs');
import * as path from "path";
import * as tl from "vsts-task-lib/task";
import * as os from "os";
import * as util from "util";
import * as toolLib from 'vsts-task-tool-lib/tool';

import kubectlutility = require("utility-common/kubectlutility");
import downloadutility = require("utility-common/downloadutility");

export function getTempDirectory(): string {
    return tl.getVariable('agent.tempDirectory') || os.tmpdir();
}

export function getCurrentTime(): number {
    return new Date().getTime();
}

export function getNewUserDirPath(): string {
    var userDir = path.join(getTempDirectory(), "kubectlTask");
    ensureDirExists(userDir);

    userDir = path.join(userDir, getCurrentTime().toString());
    ensureDirExists(userDir);

    return userDir;
} 

function ensureDirExists(dirPath : string) : void
{
    if (!fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath);
    }
}

export async function getKubectlVersion(versionSpec: string, checkLatest: boolean) : Promise<string> {
    
    if(checkLatest) {
        return await kubectlutility.getStableKubectlVersion();
    }
    else if (versionSpec) {
        if(versionSpec === "1.7") {
            // Backward compat handle
            tl.warning(tl.loc("UsingLatestStableVersion"));
            return kubectlutility.getStableKubectlVersion();
        } 
        else {
            return sanitizeVersionString(versionSpec);
        } 
     }
 
     return kubectlutility.stableKubectlVersion;
 }

export async function downloadKubectl(version: string): Promise<string> {
    return await kubectlutility.downloadKubectl(version);
}

export function sanitizeVersionString(inputVersion: string) : string{
    var version = toolLib.cleanVersion(inputVersion);
    if(!version) {
        throw new Error(tl.loc("NotAValidSemverVersion"));
    }
    
    return "v"+version;
}

export function assertFileExists(path: string) {
    if(!fs.existsSync(path)) {
        tl.error(tl.loc('FileNotFoundException', path));
        throw new Error(tl.loc('FileNotFoundException', path));
    }
}