import tl = require('vsts-task-lib/task');
import { AzureEndpoint } from 'azure-arm-rest/azureModels';
import {AzureAppService  } from 'azure-arm-rest/azure-arm-app-service';
import { AzureApplicationInsights } from 'azure-arm-rest/azure-arm-appinsights';
import { Kudu } from 'azure-arm-rest/azure-arm-app-service-kudu';
import { ApplicationInsightsWebTests } from 'azure-arm-rest/azure-arm-appinsights-webtests';
import { AzureAppServiceUtils } from './AzureAppServiceUtils';
import { AzureApplicationInsightsWebTestsUtils } from './AzureApplicationInsightsWebTestsUtils';

const APPLICATION_INSIGHTS_EXTENSION_NAME: string = "Microsoft.ApplicationInsights.AzureWebSites";

export async function enableContinuousMonitoring(endpoint: AzureEndpoint, appService: AzureAppService, appInsights: AzureApplicationInsights) {
    try {
        console.log(tl.loc('EnablingContinousMonitoring', appService.getName()));
        var appDetails = await appService.get();
        var appServiceUtils = new AzureAppServiceUtils(appService);
        var appInsightsResource = await appInsights.get();
        var appInsightsWebTests = new ApplicationInsightsWebTests(endpoint, appInsights.getResourceGroupName());
        var webDeployPublishingProfile = await appServiceUtils.getWebDeployPublishingProfile();
        var applicationUrl = webDeployPublishingProfile.destinationAppUrl;
        if(appDetails.kind.indexOf("linux") == -1) {
            var appKuduService: Kudu = await appServiceUtils.getKuduService();
            await appKuduService.installSiteExtension(APPLICATION_INSIGHTS_EXTENSION_NAME);
        }

        appInsightsResource.tags["hidden-link:" + appDetails.id] = "Resource";
        tl.debug('Link app insights with app service via tag');
        await appInsights.update(appInsightsResource);
        tl.debug('Link app service with app insights via instrumentation key');
        await appService.patchApplicationSettings({
            "APPINSIGHTS_INSTRUMENTATIONKEY": appInsightsResource.properties['InstrumentationKey']
        });

        try {
            tl.debug('Enable alwaysOn property for app service.');
            await appService.patchConfiguration({ "properties" :{"alwaysOn": true}});    
        }
        catch(error) {
            tl.warning(error);
        }
        
        try {
            tl.debug('add web test for app service - app insights');
            var appInsightsWebTestsUtils: AzureApplicationInsightsWebTestsUtils = new AzureApplicationInsightsWebTestsUtils(appInsightsWebTests);
            await appInsightsWebTestsUtils.addWebTest(appInsightsResource, applicationUrl);
        }
        catch(error) {
            tl.warning(error);
        }

        console.log(tl.loc("ContinousMonitoringEnabled", appService.getName()));
    }
    catch(error) {
        throw new Error(tl.loc('FailedToEnableContinuousMonitoring', error));
    }
}