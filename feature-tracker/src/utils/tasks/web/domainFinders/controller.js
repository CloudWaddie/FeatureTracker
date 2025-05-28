import fs from 'fs';
import { cwd } from "process";
import { getMiscData, updateMiscData, updateFeed } from '../../../db.js';
import logger from '../../../../lib/logger.js';

export default async function domainFinderController() {
    logger.info('Domain Finder Controller Running');
    const configPath = `${cwd()}/src/utils/tasks/web/domainFinders/config.txt`;
    let fileContent = '';
    try {
        fileContent = await fs.promises.readFile(configPath, 'utf8');
    } catch (error) {
        logger.error({ err: error, configPath }, `Error reading config file ${configPath}`);
        return 'Error reading config file';
    }

    const lines = fileContent.split("\n");
    const domainsToCheck = [];

    // --- Parsing logic ---
    for (const line of lines) {
        const trimmedLine = line.trim();
        if (trimmedLine === "" || trimmedLine.startsWith('#')) {
            continue;
        }
        // --- Add URLs to the domainsToCheck array ---
        if (trimmedLine.includes('.')) {
            domainsToCheck.push(trimmedLine);
        } else {
            logger.warn(`URL "${trimmedLine}" is not (likely to be) a valid URL in ${configPath}. Ignoring.`);
        }
    }
    // --- End of parsing logic ---

    // Shuffle the domainsToCheck array
    function shuffleArray(array) {
        for (let i = array.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [array[i], array[j]] = [array[j], array[i]];
        }
    }
    shuffleArray(domainsToCheck);

    if (domainsToCheck.length === 0) {
        logger.info('No domains found in config file to check.');
        return 'No domains to check';
    }

    for (const domain of domainsToCheck) {
        logger.info(`Checking domain: ${domain}`);
        // Get JSON data from https://crt.sh/json?q=
        const headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/58.0.3029.110 Safari/537.3'
        }
        const url = `https://crt.sh/json?q=${domain}`;
        let data = [];
        try {
            logger.info(`Fetching data from ${url}`);
            const response = await fetch(url, {
                method: 'GET',
                headers: headers,
                redirect: 'follow'
            });
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            data = await response.json();
            logger.info(`Successfully received data from ${url}. Data length: ${data.length}`);
        } catch (error) {
            logger.error({ err: error, url }, `Error fetching data from ${url}`);
            continue; // Skip to the next domain if fetch fails
        }

        if (!data || data.length === 0) {
            logger.warn({ domain }, `No certificate data found for the domain ${domain} on crt.sh`);
            // Consider if you want to continue or skip if no data is found
            continue;
        }

        let domainList = [];
        for (const item of data) {
            // Process name_value (Subject Alternative Names), which can contain multiple domains
            if (item.name_value) {
                // Split the name_value string by newline to get individual domain entries
                const names = item.name_value.split('\n');
                for (const name of names) {
                    const trimmedName = name.toLowerCase().trim();
                    // Only add if the individual name includes the target domain and is not empty
                    if (trimmedName.includes(domain) && trimmedName !== '') {
                        domainList.push(trimmedName);
                    }
                }
            }
            // Process common_name, which is usually a single domain
            if (item.common_name) {
                const trimmedCommonName = item.common_name.toLowerCase().trim();
                 // Only add if the common name includes the target domain and is not empty
                if (trimmedCommonName.includes(domain) && trimmedCommonName !== '') {
                    domainList.push(trimmedCommonName);
                }
            }
        }

        if (domainList.length === 0) {
            logger.warn({ domain }, `No relevant domains extracted from crt.sh data for ${domain}`);
            // Consider if you want to continue or skip if no relevant domains are found
             continue;
        }

        // Remove duplicates
        const uniqueDomainList = [...new Set(domainList)];

        // Get current data from the database
        let currentDomainList = [];
        let currentDataExists = false;
        try {
            logger.info(`Attempting to retrieve current data for domainFinder_${domain} from DB.`);
            const currentDataResult = (await getMiscData(`domainFinder_${domain}`));

            if (currentDataResult && currentDataResult.length > 0 && currentDataResult[0].value) {
                currentDataExists = true;
                try {
                    currentDomainList = JSON.parse(currentDataResult[0].value);
                     // Ensure parsed data is an array, default to empty array if not
                    if (!Array.isArray(currentDomainList)) {
                         logger.error({ domain }, `Data from DB for ${domain} is not an array after parsing.`);
                         currentDomainList = []; // Reset to empty array if parsing resulted in non-array
                         currentDataExists = false; // Treat as no valid current data
                    }
                } catch (e) {
                    logger.error({ err: e, domain }, `Error parsing current data from DB for ${domain}`);
                    // If parsing fails, currentDomainList remains [], and currentDataExists is false
                }
            } else {
                 logger.info(`No existing data found in DB for domainFinder_${domain}.`);
            }
        } catch (dbError) {
             logger.error({ err: dbError, domain }, `Error retrieving data from DB for ${domain}`);
             // If DB retrieval fails, currentDomainList remains [], and currentDataExists is false
        }

        // Check for differences
        const newDomains = uniqueDomainList.filter(item => !currentDomainList.includes(item));
        const removedDomains = currentDomainList.filter(item => !uniqueDomainList.includes(item));

        logger.info({ newDomains, domain }, `New domains detected for ${domain}`);
        logger.info({ removedDomains, domain }, `Removed domains detected for ${domain}`);

        // If there are new or removed domains, update the database and feed
        if (newDomains.length > 0 || removedDomains.length > 0 || !currentDataExists) {
             // We update if there are changes OR if there was no valid data previously
            logger.info(`Changes detected or no previous data for ${domain}. Updating DB and Feed.`);
            try {
                await updateMiscData(`domainFinder_${domain}`, JSON.stringify(uniqueDomainList));
                logger.info(`Successfully updated data in DB for ${domain}.`);

                const feedDetails = [];
                if (newDomains.length > 0) {
                    feedDetails.push(`New domains: ${newDomains.join(', ')}`);
                }
                 if (removedDomains.length > 0) {
                    feedDetails.push(`Removed domains: ${removedDomains.join(', ')}`);
                }
                 if (!currentDataExists && newDomains.length === uniqueDomainList.length) {
                     // Special case for the first run where all are new
                     feedDetails.push(`Initial scan found: ${uniqueDomainList.join(', ')}`);
                 } else if (!currentDataExists) {
                     // Should not happen if uniqueDomainList is populated, but for safety
                      feedDetails.push(`No previous data, saving current list.`);
                 }

                const feedData = {
                    type: `domainFinder`,
                    details: feedDetails.join('\n'), // Join details with newline
                    appId: `${domain}`,
                    date: new Date().toUTCString(),
                };
                await updateFeed(feedData);
                logger.info({ domain, details: feedData.details }, `Successfully updated feed for ${domain}.`);

            } catch (updateError) {
                 logger.error({ err: updateError, domain }, `Error updating DB or Feed for ${domain}`);
            }
        } else {
            logger.info(`No changes detected for ${domain}. No update needed.`);
        }
    }
    logger.info('Domain Finder Controller Finished');
    return 'Domain Finder Controller Finished';
}
