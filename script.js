const fs = require("fs");
// const request = require("request"); // Removed deprecated package
// const requestPromise = require("request-promise"); // Removed deprecated package
const axios = require("axios"); // Added axios
const xml2js = require("xml2js");
const {google} = require("googleapis");

const parser = new xml2js.Parser();

// Ganti dengan URL sitemap index Anda
const sitemapIndexUrl = "https://situskamu.com/sitemap.xml";

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
    const response = await axios.get(url);
    const sitemap = response.data;
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
  cleanupQuotaLogs(); // Add this line
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
    await processBatch(batchUrls, serviceAccountFiles[index], operationType);
    await delay(1000); // Add 1 second delay between batches
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
    if (tokens && tokens.access_token) {
      const DAILY_QUOTA_LIMIT = 200;

      // Get today's date in YYYY-MM-DD format
      const today = new Date().toISOString().split("T")[0];

      // Read the success log file
      const successLog = fs.existsSync("log_success.txt")
        ? fs.readFileSync("log_success.txt", "utf-8")
        : "";

      // Create or read the quota tracking file for this service account
      const quotaFile = `quota_${serviceAccountFile
        .replace("./", "")
        .replace(".json", "")}.txt`;
      if (!fs.existsSync(quotaFile)) {
        fs.writeFileSync(quotaFile, "");
      }

      const quotaLog = fs.readFileSync(quotaFile, "utf-8");
      const quotaEntries = quotaLog
        .split("\n")
        .filter(line => line.startsWith(today));
      const todayUsage = quotaEntries.length;

      const remainingQuota = Math.max(0, DAILY_QUOTA_LIMIT - todayUsage);
      console.log(
        `✅ Service account ${serviceAccountFile} validated. Remaining quota: ${remainingQuota} (Used today: ${todayUsage})`
      );
      return remainingQuota;
    } else {
      console.log(
        `❌ Service account ${serviceAccountFile} failed to authenticate`
      );
      return 0;
    }
  } catch (err) {
    console.error(`❌ Error authorizing ${serviceAccountFile}:`, err);
    return 0;
  }
}

// Add a helper function to track daily quota
function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Modify processBatch function to correctly format batch requests for Google's API
async function processBatch(batch, serviceAccountFile, operationType) {
  if (batch.length === 0) {
    console.log(`Skipping empty batch for ${serviceAccountFile}`);
    return;
  }

  // Process in chunks of up to 100 URLs
  const CHUNK_SIZE = 100;
  const chunks = [];
  for (let i = 0; i < batch.length; i += CHUNK_SIZE) {
    chunks.push(batch.slice(i, i + CHUNK_SIZE));
  }

  console.log(
    `🔄 Processing ${batch.length} URLs in ${chunks.length} chunks using ${serviceAccountFile}...`
  );

  for (const [index, chunk] of chunks.entries()) {
    console.log(
      `Processing chunk ${index + 1}/${chunks.length} (${chunk.length} URLs)`
    );

    try {
      const key = require(serviceAccountFile);
      const jwtClient = new google.auth.JWT(
        key.client_email,
        null,
        key.private_key,
        ["https://www.googleapis.com/auth/indexing"],
        null
      );

      const tokens = await jwtClient.authorize();

      // Prepare multipart body as per Google's batch API
      const boundary = "batch_boundary";
      const multipartBody =
        chunk
          .map((url, idx) => {
            return [
              `--${boundary}`,
              "Content-Type: application/http",
              `Content-ID: <item-${idx}>`,
              "",
              "POST /v3/urlNotifications:publish HTTP/1.1",
              "Content-Type: application/json",
              "",
              JSON.stringify({
                url: url,
                type: operationType,
              }),
            ].join("\n");
          })
          .join("\n") + `\n--${boundary}--`;

      const options = {
        method: "POST",
        url: "https://indexing.googleapis.com/batch",
        headers: {
          "Content-Type": `multipart/mixed; boundary=${boundary}`,
          Authorization: `Bearer ${tokens.access_token}`,
        },
        data: multipartBody,
      };

      const resp = await axios(options);

      console.log(
        `✅ Chunk ${index + 1} completed with status code: ${resp.status}`
      );
      if (resp.status === 200) {
        const timestamp = new Date().toISOString().split("T")[0];
        const quotaFile = `quota_${serviceAccountFile
          .replace("./", "")
          .replace(".json", "")}.txt`;

        chunk.forEach(url => {
          fs.appendFileSync(quotaFile, `${timestamp} ${url}\n`);
          fs.appendFileSync("log_success.txt", url + "\n");
        });

        console.log(`✅ Chunk ${index + 1} processed successfully`);
      } else if (resp.status === 429) {
        console.log(`⚠️ Quota limit reached in chunk ${index + 1}`);
        chunk.forEach(url => {
          fs.appendFileSync("log_failure.txt", url + "\n");
        });
      } else {
        console.log(`❌ Unexpected status code: ${resp.status}`);
        chunk.forEach(url => {
          fs.appendFileSync("log_failure.txt", url + "\n");
        });
      }

      // Add delay between chunks
      if (index < chunks.length - 1) {
        console.log("Waiting 1 second before next chunk...");
        await delay(1000);
      }
    } catch (err) {
      console.log(`❌ Error in chunk ${index + 1}:`, err);
      chunk.forEach(url => {
        fs.appendFileSync("log_failure.txt", url + "\n");
      });
    }
  }
}

// Add cleanup function to reset quota logs daily
function cleanupQuotaLogs() {
  const today = new Date().toISOString().split("T")[0];
  const files = fs.readdirSync(".");
  const quotaFiles = files.filter(
    f => f.startsWith("quota_") && f.endsWith(".txt")
  );

  quotaFiles.forEach(file => {
    const content = fs.readFileSync(file, "utf-8");
    const todayEntries = content
      .split("\n")
      .filter(line => line.startsWith(today))
      .join("\n");
    fs.writeFileSync(file, todayEntries);
  });
}
