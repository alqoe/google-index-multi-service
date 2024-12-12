const fs = require("fs");
const request = require("request");
const requestPromise = require("request-promise");
const xml2js = require("xml2js");
const {google} = require("googleapis");

const parser = new xml2js.Parser();

// Ganti dengan URL sitemap index Anda
const sitemapIndexUrl = "https://situskamu/sitemap.xml";

// Function to read existing URLs
function getExistingUrls() {
  try {
    if (fs.existsSync("urls.txt")) {
      return new Set(
        fs.readFileSync("urls.txt", "utf-8").split("\n").filter(Boolean)
      );
    }
  } catch (error) {
    console.error("Error reading existing URLs:", error);
  }
  return new Set();
}

// Fungsi untuk mengambil dan memproses sitemap
async function fetchAndProcessSitemap(url, existingUrls, spinner) {
  try {
    const sitemap = await requestPromise(url);
    const result = await parser.parseStringPromise(sitemap);

    if (result.sitemapindex) {
      const sitemapUrls = result.sitemapindex.sitemap.map(
        sitemapEntry => sitemapEntry.loc[0]
      );
      for (const sitemapUrl of sitemapUrls) {
        spinner.text = `Fetching sitemap: ${sitemapUrl}`;
        await fetchAndProcessSitemap(sitemapUrl, existingUrls, spinner);
      }
    } else if (result.urlset) {
      const newUrls = result.urlset.url
        .map(urlEntry => urlEntry.loc[0])
        .filter(url => !existingUrls.has(url));

      if (newUrls.length > 0) {
        spinner.text = `Found ${newUrls.length} new URLs`;
        fs.appendFileSync("urls.txt", newUrls.join("\n") + "\n");
        newUrls.forEach(url => existingUrls.add(url));
      }
    }
  } catch (error) {
    spinner.fail(`Error fetching sitemap: ${url}`);
    console.error(error);
  }
}

// Replace the execution part with this
const existingUrls = getExistingUrls();
(async () => {
  const ora = (await import("ora")).default;
  const spinner = ora("Starting sitemap fetch...").start();
  spinner.text = `Found ${existingUrls.size} existing URLs in urls.txt`;

  fetchAndProcessSitemap(sitemapIndexUrl, existingUrls, spinner)
    .then(() => {
      spinner.succeed("Finished fetching and processing sitemaps");
      processUrls();
    })
    .catch(error => {
      spinner.fail("Error processing sitemap index");
      console.error(error);
    });
})();

async function processUrls() {
  console.log("🚀 Starting URL processing...");

  // Buat file log jika belum ada
  if (!fs.existsSync("log_success.txt")) {
    fs.writeFileSync("log_success.txt", "");
  }
  if (!fs.existsSync("log_failure.txt")) {
    fs.writeFileSync("log_failure.txt", "");
  }

  let batch = fs.readFileSync("urls.txt").toString().split("\n");

  // Baca log_success.txt dan log_failure.txt dan ekstrak URL yang sudah di-log
  let loggedSuccessUrls = fs
    .readFileSync("log_success.txt", "utf-8")
    .split("\n");
  let loggedFailureUrls = fs
    .readFileSync("log_failure.txt", "utf-8")
    .split("\n");

  // Saring URL yang sudah di-log
  batch = batch.filter(
    url => !loggedSuccessUrls.includes(url) && !loggedFailureUrls.includes(url)
  );

  const serviceAccountFiles = [
    "./service_account1.json",
    "./service_account2.json",
    "./service_account3.json",
    "./service_account4.json",
    "./service_account5.json",
  ];

  const operationType =
    process.argv[2] === "--delete" ? "URL_DELETED" : "URL_UPDATED";

  // Check actual quota for all service accounts
  const quotaPromises = serviceAccountFiles.map(file => checkGoogleQuota(file));
  const quotas = await Promise.all(quotaPromises);
  const totalQuota = quotas.reduce((sum, quota) => sum + quota, 0);

  console.log(
    `📊 Total available quota across all service accounts: ${totalQuota}`
  );

  // Limit batch to total available quota
  batch = batch.slice(0, totalQuota);
  console.log(`📦 Processing ${batch.length} URLs...`);

  // Create batches based on available quotas
  const batches = [];
  let currentIndex = 0;

  for (let i = 0; i < serviceAccountFiles.length; i++) {
    if (quotas[i] > 0) {
      batches.push(batch.slice(currentIndex, currentIndex + quotas[i]));
      currentIndex += quotas[i];
    } else {
      batches.push([]);
    }
  }

  // Proses setiap batch dengan API yang berbeda
  for (const [index, batchUrls] of batches.entries()) {
    await processBatch(batchUrls, serviceAccountFiles[index]);
  }
}

// Add this function to check actual quota from Google API
async function checkGoogleQuota(serviceAccountFile) {
  const key = require(serviceAccountFile);
  const jwtClient = new google.auth.JWT(
    key.client_email,
    null,
    key.private_key,
    ["https://www.googleapis.com/auth/indexing"],
    null
  );

  try {
    const tokens = await jwtClient.authorize();
    const options = {
      url: "https://indexing.googleapis.com/v3/urlNotifications/metadata",
      method: "GET",
      headers: {
        Authorization: `Bearer ${tokens.access_token}`,
      },
    };

    return new Promise((resolve, reject) => {
      request(options, (err, resp, body) => {
        if (err) {
          console.error(`Error checking quota for ${serviceAccountFile}:`, err);
          resolve(0);
        } else {
          try {
            const data = JSON.parse(body);
            // Google returns quota per day in the response
            const remainingQuota = data.hasOwnProperty("queryQuotaPerDay")
              ? data.queryQuotaPerDay.remaining
              : 0;
            console.log(
              `📊 Remaining quota for ${serviceAccountFile}: ${remainingQuota}`
            );
            resolve(remainingQuota);
          } catch (parseErr) {
            console.error(
              `Error parsing quota response for ${serviceAccountFile}:`,
              parseErr
            );
            resolve(0);
          }
        }
      });
    });
  } catch (err) {
    console.error(`Error authorizing for ${serviceAccountFile}:`, err);
    return 0;
  }
}

// Modify processBatch function to remove local quota checking
async function processBatch(batch, serviceAccountFile) {
  if (batch.length === 0) {
    console.log(`Skipping empty batch for ${serviceAccountFile}`);
    return;
  }

  console.log(`🔄 Processing batch using ${serviceAccountFile}...`);

  // Remove old quota checking code and continue with JWT auth and request
  const key = require(serviceAccountFile);
  const jwtClient = new google.auth.JWT(
    key.client_email,
    null,
    key.private_key,
    ["https://www.googleapis.com/auth/indexing"],
    null
  );

  try {
    const tokens = await jwtClient.authorize();
    const items = limitedBatch.map(line => {
      return {
        "Content-Type": "application/http",
        "Content-ID": "",
        body:
          "POST /v3/urlNotifications:publish HTTP/1.1\n" +
          "Content-Type: application/json\n\n" +
          JSON.stringify({
            url: line,
            type: operationType,
          }),
      };
    });

    const options = {
      url: "https://indexing.googleapis.com/batch",
      method: "POST",
      headers: {
        "Content-Type": "multipart/mixed",
      },
      auth: {bearer: tokens.access_token},
      multipart: items,
    };

    return new Promise((resolve, reject) => {
      request(options, (err, resp, body) => {
        if (err) {
          console.log(
            `❌ Error processing batch using ${serviceAccountFile}:`,
            err
          );
          // Log semua URL yang gagal
          limitedBatch.forEach(url => {
            fs.appendFileSync("log_failure.txt", url + "\n");
          });
          reject(err);
        } else {
          console.log(
            `✅ Request completed for batch using ${serviceAccountFile} with status code: ${resp.statusCode}`
          );
          if (resp.statusCode === 200) {
            console.log(`✅ Batch processed successfully.`);
            limitedBatch.forEach(url => {
              fs.appendFileSync("log_success.txt", url + "\n");
            });
          } else if (resp.statusCode === 429) {
            console.log(`⚠️ Quota limit reached for ${serviceAccountFile}.`);
            // Log semua URL yang gagal
            limitedBatch.forEach(url => {
              fs.appendFileSync("log_failure.txt", url + "\n");
            });
          } else {
            console.log(`❌ Unexpected status code: ${resp.statusCode}`);
            // Log semua URL yang gagal
            limitedBatch.forEach(url => {
              fs.appendFileSync("log_failure.txt", url + "\n");
            });
          }
          resolve();
        }
      });
    });
  } catch (err) {
    console.log(`❌ Error processing batch using ${serviceAccountFile}:`, err);
    // Log semua URL yang gagal
    limitedBatch.forEach(url => {
      fs.appendFileSync("log_failure.txt", url + "\n");
    });
  }
}
