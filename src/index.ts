import debug from "debug";
import { sequence_id } from "./config";
import { windows } from "@crawlora/browser";
import { Page } from "puppeteer-extra-plugin/dist/puppeteer";

export default async function ({
  searches,
}: {
  searches: string;
}) {
  const formedData = searches.trim().split("\n").map(v => v.trim())

  await windows(formedData, async (companyUrl, { page, wait, output, debug }) => {
    try {
      debug(`Navigating to: ${companyUrl}`);
      await navigateWithRetry(companyUrl, page, wait, debug);

      await wait(2);
      debug(`Scraping data for: ${companyUrl}`);

      const companyDetails = await getCompanyDetails(page, wait);

      debug(`Start submit data for: ${companyUrl}`);

      await wait(2)

      await output.create({
        sequence_id,
        sequence_output: {
          Name: companyDetails.name,
          Industry: companyDetails.industry,
          TagLine: companyDetails.tagLine,
          Followers: companyDetails.followers,
          EmployeeCount: companyDetails.employeeCount,
          Description: companyDetails.description,
          Website: companyDetails.website,
          CompanySize: companyDetails.companySize,
          Headquarters: companyDetails.headquarters,
          OrganizationType: companyDetails.organizationType,
          Founded: companyDetails.founded,
          Specialties: companyDetails.specialties,
          Locations: companyDetails.locations,
        },
      });

      debug(`Data submitted successfully for: ${companyUrl}`);

    } catch (error) {
      const e = error as Error
      debug(error)
      throw new Error(e.message);
    }
  })

}

async function navigateWithRetry(url: string, page: Page, wait: any, debug: debug.Debugger) {
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      await page.goto(url, { waitUntil: 'networkidle2', timeout: 60000 });
      return true;
    } catch (error) {
      const e = error as Error;
      debug(`Attempt ${attempt} failed for ${url}:`, e.message);
      if (attempt === 3) {
        throw new Error(`Failed to navigate to ${url} after ${3} attempts`);
      }
      await wait(2);
    }
  }
}

async function getCompanyDetails(page: any, wait: any) {
  return await page.evaluate(() => {
    const getText = (selector: string) =>
      document.querySelector(selector)?.textContent?.trim() ?? 'N/A';

    const followersText = getText('h3.top-card-layout__first-subline').match(/(\d[\d,]*) followers/);
    const employeeCountMatch = getText('p.face-pile__text').match(/(\d[\d,]*) employees/);

    const locations: Record<string, boolean | string>[] = [];
    document.querySelectorAll('ul.show-more-less__list li.mb-3').forEach((item) => {
      const isPrimary = item.querySelector('.tag-sm')?.textContent?.includes('Primary') || false;
      const addressLines = Array.from(item.querySelectorAll('p')).map((p) => p?.textContent?.trim());
      const address = addressLines.join(', ');
      locations.push({ address, isPrimary });
    });

    const locationsString = locations
      .map(loc => `${loc.address}${loc.isPrimary ? ' (Primary)' : ''}`)
      .join('; ');


    return {
      name: getText('h1'),
      industry: getText('[data-test-id="about-us__industry"] dd'),
      tagLine: getText('.top-card-layout__second-subline span'),
      followers: followersText ? parseInt(followersText[1].replace(/,/g, '')) : 0,
      employeeCount: employeeCountMatch ? parseInt(employeeCountMatch[1].replace(/,/g, '')) : 0,
      description: getText('p[data-test-id="about-us__description"]').replace(/\n+/g, ' ').replace(/\s{2,}/g, ' ').trim(),
      website: getText('[data-test-id="about-us__website"] a') || 'N/A',
      companySize: getText('[data-test-id="about-us__size"] dd'),
      headquarters: getText('[data-test-id="about-us__headquarters"] dd'),
      organizationType: getText(
        '[data-test-id="about-us__organizationType"] dd'
      ),
      founded: getText('[data-test-id="about-us__foundedOn"] dd'),
      specialties: getText('[data-test-id="about-us__specialties"] dd'),
      locations: locationsString,
    };
  });
}

