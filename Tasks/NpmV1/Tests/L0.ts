import * as assert from 'assert';
import * as fs from 'fs';
import * as path from 'path';
import * as Q from 'q';

import * as mockery from 'mockery';
import * as ttm from 'vsts-task-lib/mock-test';

import { NpmMockHelper } from './NpmMockHelper';

const BASIC_AUTH_PAT_PASSWD_REGEX = /\/\/.*\/:_password=.*/g;
const BEARER_AUTH_REGEX = /\/\/.*\/:_authToken=AUTHTOKEN.*/g;
const BASIC_AUTH_PAT_EML_REGEX = /\/\/.*\/:email=VssEmail.*/g;
const BASIC_AUTH_PAT_USERNAME_REGEX = /\/\/.*\/:username=VssToken.*/g;
const AWLAYS_AUTH_REGEX = /\/\/.*\/:always-auth=true.*/g;

describe('Npm Task', function () {
    before(() => {
        mockery.enable({
            useCleanCache: true,
            warnOnUnregistered: false
        } as mockery.MockeryEnableArgs);
    });

    after(() => {
        mockery.disable();
    });

    beforeEach(() => {
        mockery.resetCache();
    });

    afterEach(() => {
        mockery.deregisterAll();
    });

    // npm failure dumps log
    it('npm failure dumps debug log from npm cache', (done: MochaDone) => {
        this.timeout(3000);
        const debugLog = 'NPM_DEBUG_LOG';

        let tp = path.join(__dirname, 'npm-failureDumpsLog-cacheDir.js');
        let tr = new ttm.MockTestRunner(tp);

        tr.run();

        assert(tr.failed, 'task should have failed');
        assert(tr.stdOutContained(debugLog));

        done();
    });

    it('npm failure dumps debug log from working directory', (done: MochaDone) => {
        this.timeout(3000);
        const debugLog = 'NPM_DEBUG_LOG';

        let tp = path.join(__dirname, 'npm-failureDumpsLog-workingDir.js');
        let tr = new ttm.MockTestRunner(tp);

        tr.run();

        assert(tr.failed, 'task should have failed');
        assert(tr.stdOutContained(debugLog));

        done();
    });

    // custom
    it('custom command succeeds with single service endpoint', (done: MochaDone) => {
        this.timeout(1000);
        let tp = path.join(__dirname, 'custom-singleEndpoint.js');
        let tr = new ttm.MockTestRunner(tp);

        tr.run();

        assert(tr.stdOutContained('npm custom successful'), 'npm custom command should have run');
        assert(tr.stdOutContained('http://example.com/1/'), 'debug output should have contained endpoint');
        assert(tr.succeeded, 'task should have succeeded');

        done();
    });

    it('custom command should return npm version', (done: MochaDone) => {
        this.timeout(1000);
        let tp = path.join(__dirname, 'custom-version.js');
        let tr = new ttm.MockTestRunner(tp);

        tr.run();

        assert.equal(tr.invokedToolCount, 3, 'task should have run npm');
        assert(tr.succeeded, 'task should have succeeded');
        assert(tr.stdOutContained('; debug cli configs'), 'should have debug npm config output');
        assert(tr.stdOutContained('; cli configs') === false, 'should not have regular npm config output');

        done();
    });

    // show config
    it('should execute \'npm config list\' without debug switch', (done: MochaDone) => {
        this.timeout(1000);
        let tp = path.join(__dirname, 'config-noDebug.js');
        let tr = new ttm.MockTestRunner(tp);

        tr.run();

        assert.equal(tr.invokedToolCount, 3, 'task should have run npm');
        assert(tr.succeeded, 'task should have succeeded');
        assert(tr.stdOutContained('; cli configs'), 'should have regular npm config output');
        assert(tr.stdOutContained('; debug cli configs') === false, 'should not have debug npm config output');

        done();
    });

    // install command
    it('should fail when npm fails', (done: MochaDone) => {
        this.timeout(1000);
        let tp = path.join(__dirname, 'install-npmFailure.js');
        let tr = new ttm.MockTestRunner(tp);

        tr.run();

        assert(tr.failed, 'task should have failed');

        done();
    });

    it ('install using local feed', (done: MochaDone) => {
        this.timeout(1000);
        let tp = path.join(__dirname, 'install-feed.js');
        let tr = new ttm.MockTestRunner(tp);

        tr.run();

        assert.equal(tr.invokedToolCount, 3, 'task should have run npm');
        assert(tr.stdOutContained('npm install successful'), 'npm should have installed the package');
        assert(tr.stdOutContained('OverridingProjectNpmrc'), 'install from feed shoud override project .npmrc');
        assert(tr.stdOutContained('RestoringProjectNpmrc'), 'install from .npmrc shoud restore project .npmrc');
        assert(tr.succeeded, 'task should have succeeded');

        done();
    });

    it ('install using npmrc', (done: MochaDone) => {
        this.timeout(1000);
        let tp = path.join(__dirname, 'install-npmrc.js');
        let tr = new ttm.MockTestRunner(tp);

        tr.run();

        assert.equal(tr.invokedToolCount, 3, 'task should have run npm');
        assert(tr.stdOutContained('npm install successful'), 'npm should have installed the package');
        assert(!tr.stdOutContained('OverridingProjectNpmrc'), 'install from .npmrc shoud not override project .npmrc');
        assert(!tr.stdOutContained('RestoringProjectNpmrc'), 'install from .npmrc shoud not restore project .npmrc');
        assert(tr.succeeded, 'task should have succeeded');

        done();
    });

    it('install using multiple endpoints', (done: MochaDone) => {
        this.timeout(1000);
        let tp = path.join(__dirname, 'install-multipleEndpoints.js');
        let tr = new ttm.MockTestRunner(tp);

        tr.run();

        assert(tr.stdOutContained('npm install successful'), 'npm should have installed the package');
        assert(tr.stdOutContained('http://example.com/1/'), 'debug output should have contained endpoint');
        assert(tr.stdOutContained('http://example.com/2/'), 'debug output should have contained endpoint');
        assert(tr.succeeded, 'task should have succeeded');

        done();
    });

    // publish
    it ('publish using feed', (done: MochaDone) => {
        this.timeout(1000);
        let tp = path.join(__dirname, 'publish-feed.js');
        let tr = new ttm.MockTestRunner(tp);

        tr.run();

        assert.equal(tr.invokedToolCount, 3, 'task should have run npm');
        assert(tr.stdOutContained('npm publish successful'), 'npm should have installed the package');
        assert(tr.stdOutContained('OverridingProjectNpmrc'), 'publish should always ooverrideverride project .npmrc');
        assert(tr.stdOutContained('RestoringProjectNpmrc'), 'publish should always restore project .npmrc');
        assert(tr.succeeded, 'task should have succeeded');

        done();
    });

    it ('publish using external registry', (done: MochaDone) => {
        this.timeout(1000);
        let tp = path.join(__dirname, 'publish-external.js');
        let tr = new ttm.MockTestRunner(tp);

        tr.run();

        assert.equal(tr.invokedToolCount, 3, 'task should have run npm');
        assert(tr.stdOutContained('npm publish successful'), 'npm should have installed the package');
        assert(tr.succeeded, 'task should have succeeded');

        done();
    });

    // util
    it('gets npm registries', (done: MochaDone) => {
        let mockTask = {
            writeFile: (file: string, data: string | Buffer) => {
                // no-op
            }
        };
        mockery.registerMock('vsts-task-lib/task', mockTask);
        let npmrc = `registry=http://example.com
                     always-auth=true
                     @scoped:registry=http://scoped.com
                     //scoped.com/:_authToken=thisIsASecretToken
                     @scopedTwo:registry=http://scopedTwo.com
                     ; some comments
                     @scoped:always-auth=true
                     # more comments`;

        let mockFs = {
            readFileSync: (path: string) => npmrc
        };
        mockery.registerMock('fs', mockFs);

        let npmrcParser = require('npm-common/npmrcparser');
        let registries = npmrcParser.GetRegistries('');

        assert.equal(registries.length, 3);
        assert.equal(registries[0], 'http://example.com/');
        assert.equal(registries[1], 'http://scoped.com/');
        assert.equal(registries[2], 'http://scopedTwo.com/');

        done();
    });

    it('gets feed id from VSTS registry', (done: MochaDone) => {
        mockery.registerMock('vsts-task-lib/task', {});
        let util = require('npm-common/util');

        assert.equal(util.getFeedIdFromRegistry(
            'http://account.visualstudio.com/_packaging/feedId/npm/registry'),
            'feedId');
        assert.equal(util.getFeedIdFromRegistry(
            'http://account.visualstudio.com/_packaging/feedId/npm/registry/'),
            'feedId');
        assert.equal(util.getFeedIdFromRegistry(
            'http://TFSSERVER/_packaging/feedId/npm/registry'),
            'feedId');
        assert.equal(util.getFeedIdFromRegistry(
            'http://TFSSERVER:1234/_packaging/feedId/npm/registry'),
            'feedId');

        done();
    });

    it('gets correct packaging Url', () => {
        let mockTask = {
            getVariable: (v: string) => {
                if (v === 'System.TeamFoundationCollectionUri') {
                    return 'http://example.visualstudio.com';
                }
            },
            debug: (message: string) => {
                // no-op
            },
            loc: (key: string) => {
                // no-op
            }
        };
        mockery.registerMock('vsts-task-lib/task', mockTask);
        let util = require('npm-common/util');

        return util.getPackagingCollectionUrl().then(u => {
            assert.equal(u, 'http://example.pkgs.visualstudio.com/'.toLowerCase());

            mockTask.getVariable = (v: string) => 'http://TFSSERVER.com/';
            return util.getPackagingCollectionUrl().then(u => {
                assert.equal(u, 'http://TFSSERVER.com/'.toLowerCase());

                mockTask.getVariable = (v: string) => 'http://serverWithPort:1234';
                return util.getPackagingCollectionUrl().then(u => {
                    assert.equal(u, 'http://serverWithPort:1234/'.toLowerCase());

                    return;
                });
            });
        });
    });

    it('gets correct local registries', () => {
        let mockParser = {
            GetRegistries: (npmrc: string) => [
                'http://registry.com/npmRegistry/',
                'http://example.pkgs.visualstudio.com/npmRegistry/',
                'http://localTFSServer/npmRegistry/'
            ]
        };
        mockery.registerMock('./npmrcparser', mockParser);
        let mockTask = {
            getVariable: (v: string) => {
                if (v === 'System.TeamFoundationCollectionUri') {
                    return 'http://example.visualstudio.com';
                }
            },
            debug: (message: string) => {
                // no-op
            },
            loc: (key: string) => {
                // no-op
            }
        };
        mockery.registerMock('vsts-task-lib/task', mockTask);
        let util = require('npm-common/util');

        return util.getLocalRegistries('').then((registries: string[]) => {
            assert.equal(registries.length, 1);
            assert.equal(registries[0], 'http://example.pkgs.visualstudio.com/npmRegistry/');

            mockTask.getVariable = () => 'http://localTFSServer/';
            return util.getLocalRegistries('').then((registries: string[]) => {
                assert.equal(registries.length, 1);
                assert.equal(registries[0], 'http://localTFSServer/npmRegistry/');
            });
        });
    });

    it('does Basic auth for hosted when service endpoint auth is Token and endpoint is in the .visualstudio.com domain',
        (done: MochaDone) => {
        // Scenario: Cross account on visualstudio.com
        let mockTask = {
            getVariable: (v) => {
                if (v === 'System.TeamFoundationCollectionUri') {
                    return 'http://example.visualstudio.com';
                }
            },
            getEndpointAuthorization: (id, optional) => {
                return { scheme: 'Token', parameters: { 'apitoken': 'AUTHTOKEN' } };
            },
            getEndpointUrl: (id, optional) => {
                return 'http://serviceendpoint.visualstudio.com';
            }
        };
        mockery.registerMock('vsts-task-lib/task', mockTask);
        const npmregistry = require("npm-common/npmregistry");
        let registry = npmregistry.NpmRegistry.FromServiceEndpoint('endpointId');

        assert(registry.auth.match(BASIC_AUTH_PAT_PASSWD_REGEX), `Auth must contain a password. Auth is: (${registry.auth})`);
        assert(registry.auth.match(BASIC_AUTH_PAT_EML_REGEX), `Auth must contain a email. Auth is: (${registry.auth})`);
        assert(registry.auth.match(BASIC_AUTH_PAT_USERNAME_REGEX), `Auth must contain a email. Auth is: (${registry.auth})`);
        assert(registry.auth.match(AWLAYS_AUTH_REGEX), `Auth must contain always-auth. Auth is: (${registry.auth})`);

        done();
    });

    it('does Bearer auth for hosted when service endpoint auth is Token and endpoint is 3rd party', (done: MochaDone) => {
        // Scenario: User is connecting to a non-visualstudio.com registry
        let mockTask = {
            getVariable: (v) => {
                if (v === 'System.TeamFoundationCollectionUri') {
                    return 'http://example.visualstudio.com';
                }
            },
            getEndpointAuthorization: (id, optional) => {
                return { scheme: 'Token', parameters: { 'apitoken': 'AUTHTOKEN' } };
            },
            getEndpointUrl: (id, optional) => {
                return 'http://somepublicrepo.contoso.com:8080/some/random/path';
            }
        };
        mockery.registerMock('vsts-task-lib/task', mockTask);
        const npmregistry = require("npm-common/npmregistry");
        let registry = npmregistry.NpmRegistry.FromServiceEndpoint('endpointId');

        assert(registry.auth.match(BEARER_AUTH_REGEX), `Auth must contain _authToken. Auth is: (${registry.auth})`);
        assert(registry.auth.match(AWLAYS_AUTH_REGEX), `Auth must contain always-auth. Auth is: (${registry.auth})`);

        done();
    });

    it('does Basic auth for onprem when service endpoint auth is Token and the endpoint is in the same domain', (done: MochaDone) => {
        // Scenario: onprem server A registry/feed in to onprem server B within same domain
        let mockTask = {
            getVariable: (v) => {
                if (v === 'System.TeamFoundationCollectionUri') {
                    // Any collectionuri not ending in .visualstudio.com is onprem
                    return 'http://mytfsserver.example.com';
                }
            },
            getEndpointAuthorization: (id, optional) => {
                return { scheme: 'Token', parameters: { 'apitoken': 'AUTHTOKEN' } };
            },
            getEndpointUrl: (id, optional) => {
                return 'http://serviceendpoint.visualstudio.com';
            }
        };
        mockery.registerMock('vsts-task-lib/task', mockTask);
        const npmregistry = require("npm-common/npmregistry");
        let registry = npmregistry.NpmRegistry.FromServiceEndpoint('endpointId');

        assert(registry.auth.match(BASIC_AUTH_PAT_PASSWD_REGEX), `Auth must contain a password. Auth is: (${registry.auth})`);
        assert(registry.auth.match(BASIC_AUTH_PAT_EML_REGEX), `Auth must contain a email. Auth is: (${registry.auth})`);
        assert(registry.auth.match(BASIC_AUTH_PAT_USERNAME_REGEX), `Auth must contain a email. Auth is: (${registry.auth})`);
        assert(registry.auth.match(AWLAYS_AUTH_REGEX), `Auth must contain always-auth. Auth is: (${registry.auth})`);

        done();
    });

    it('does Bearer auth for onprem when service endpoint auth is Token and the endpoint is 3rd party', (done: MochaDone) => {
        // Scenario: Onprem connecting to a 3rd party registry.
        let mockTask = {
            getVariable: (v) => {
                if (v === 'System.TeamFoundationCollectionUri') {
                    return 'http://mytfsserver.example.com';
                }
            },
            getEndpointAuthorization: (id, optional) => {
                return { scheme: 'Token', parameters: { 'apitoken': 'AUTHTOKEN' } };
            },
            getEndpointUrl: (id, optional) => {
                return 'http://somepublicrepo.contoso.com:8080/some/random/path';
            }
        };
        mockery.registerMock('vsts-task-lib/task', mockTask);
        const npmregistry = require("npm-common/npmregistry");
        let registry = npmregistry.NpmRegistry.FromServiceEndpoint('endpointId');

        assert(registry.auth.match(BEARER_AUTH_REGEX), `Auth must contain _authToken. Auth is: (${registry.auth})`);
        assert(registry.auth.match(AWLAYS_AUTH_REGEX), `Auth must contain always-auth. Auth is: (${registry.auth})`);

        done();
    });

    it('does Bearer auth for onprem when service endpoint auth is Token and the endpoint is an IP addr', (done: MochaDone) => {
        // Scenario: Onprem and user supplied an IP for the endpoint.  We must assume that it  is a 3rd party repo
        // and, as such, will use bearer auth.
        let mockTask = {
            getVariable: (v) => {
                if (v === 'System.TeamFoundationCollectionUri') {
                    return 'http://mytfsserver.example.com';
                }
            },
            getEndpointAuthorization: (id, optional) => {
                return { scheme: 'Token', parameters: { 'apitoken': 'AUTHTOKEN' } };
            },
            getEndpointUrl: (id, optional) => {
                return 'http://10.10.10.10:8080/some/random/path';
            }
        };
        mockery.registerMock('vsts-task-lib/task', mockTask);
        const npmregistry = require("npm-common/npmregistry");
        let registry = npmregistry.NpmRegistry.FromServiceEndpoint('endpointId');

        assert(registry.auth.match(BEARER_AUTH_REGEX), `Auth must contain _authToken. Auth is: (${registry.auth})`);
        assert(registry.auth.match(AWLAYS_AUTH_REGEX), `Auth must contain always-auth. Auth is: (${registry.auth})`);

        done();
    });

    it('does Basic auth for onprem when service endpoint auth is Token and the TFS server and EP have the same IP', (done: MochaDone) => {
        // Scenario: Onprem and user supplied an IP for the endpoint and the TeamFoundationCollectionUri is a _matching_ IP
        let mockTask = {
            getVariable: (v) => {
                if (v === 'System.TeamFoundationCollectionUri') {
                    return 'http://10.10.10.10:8080/';
                }
            },
            getEndpointAuthorization: (id, optional) => {
                return { scheme: 'Token', parameters: { 'apitoken': 'AUTHTOKEN' } };
            },
            getEndpointUrl: (id, optional) => {
                return 'http://10.10.10.10:8080/some/random/path';
            }
        };
        mockery.registerMock('vsts-task-lib/task', mockTask);
        const npmregistry = require("npm-common/npmregistry");
        let registry = npmregistry.NpmRegistry.FromServiceEndpoint('endpointId');

        assert(registry.auth.match(BASIC_AUTH_PAT_PASSWD_REGEX), `Auth must contain a password. Auth is: (${registry.auth})`);
        assert(registry.auth.match(BASIC_AUTH_PAT_EML_REGEX), `Auth must contain a email. Auth is: (${registry.auth})`);
        assert(registry.auth.match(BASIC_AUTH_PAT_USERNAME_REGEX), `Auth must contain a email. Auth is: (${registry.auth})`);
        assert(registry.auth.match(AWLAYS_AUTH_REGEX), `Auth must contain always-auth. Auth is: (${registry.auth})`);

        done();
    });

    it('does Basic auth for onprem when service endpoint auth is Token and the TFS server and EP have the same IP', (done: MochaDone) => {
        // Scenario: Onprem and user supplied an IP for the endpoint and the TeamFoundationCollectionUri is a _matching_ IP
        let mockTask = {
            getVariable: (v) => {
                if (v === 'System.TeamFoundationCollectionUri') {
                    return 'http://mytfsserver.example.com';
                }
            },
            getEndpointAuthorization: (id, optional) => {
                return { scheme: 'UsernamePassword', parameters: { 'username': 'USERNAME', 'password': 'PASSWORD' } };
            },
            getEndpointUrl: (id, optional) => {
                return 'http://somepublicrepo.contoso.com:8080/some/random/path';
            }
        };
        mockery.registerMock('vsts-task-lib/task', mockTask);
        const npmregistry = require("npm-common/npmregistry");
        let registry = npmregistry.NpmRegistry.FromServiceEndpoint('endpointId');

        const BASIC_AUTH_PASSWD_REGEX = /\/\/.*\/:_password=PASSWORD.*/g;
        assert(registry.auth.match(BASIC_AUTH_PAT_PASSWD_REGEX), `Auth must contain a password. Auth is: (${registry.auth})`);
        const BASIC_AUTH_PAT_EML_REGEX = /\/\/.*\/:email=USERNAME.*/g;
        assert(registry.auth.match(BASIC_AUTH_PAT_EML_REGEX), `Auth must contain a email. Auth is: (${registry.auth})`);
        const BASIC_AUTH_PAT_USERNAME_REGEX = /\/\/.*\/:username=USERNAME.*/g;
        assert(registry.auth.match(BASIC_AUTH_PAT_USERNAME_REGEX), `Auth must contain a email. Auth is: (${registry.auth})`);
        assert(registry.auth.match(AWLAYS_AUTH_REGEX), `Auth must contain always-auth. Auth is: (${registry.auth})`);

        done();
    });

});
