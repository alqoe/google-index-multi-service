const fs = require("fs");
const request = require("request");
const requestPromise = require("request-promise");
const xml2js = require('xml2js');
const { google } = require("googleapis");

const parser = new xml2js.Parser();

// Ganti dengan URL sitemap index Anda
const sitemapIndexUrl = 'https://situskamu/sitemap.xml';

// Fungsi untuk mengambil dan memproses sitemap
async function fetchAndProcessSitemap(url) {
    console.log(`🔍 Fetching sitemap: ${url}`);
    try {
        const sitemap = await requestPromise(url);
        const result = await parser.parseStringPromise(sitemap);

        if (result.sitemapindex) {
            // Jika ini adalah sitemap index, ambil semua sitemap URL dan proses masing-masing
            const sitemapUrls = result.sitemapindex.sitemap.map(sitemapEntry => sitemapEntry.loc[0]);
            for (const sitemapUrl of sitemapUrls) {
                await fetchAndProcessSitemap(sitemapUrl);
            }
        } else if (result.urlset) {
            // Jika ini adalah sitemap biasa, ambil semua URL dan tambahkan ke urls.txt
            const urls = result.urlset.url.map(urlEntry => urlEntry.loc[0]);
            console.log(`📄 Found ${urls.length} URLs in sitemap: ${url}`);
            fs.appendFileSync('urls.txt', urls.join('\n') + '\n');
        }
    } catch (error) {
        console.error(`❌ Error fetching or parsing sitemap: ${url}`, error);
    }
}

// Mulai dengan mengambil dan memproses sitemap index
fetchAndProcessSitemap(sitemapIndexUrl)
    .then(() => {
        console.log('✅ Finished fetching and processing sitemaps.');
        processUrls();
    })
    .catch(error => console.error('❌ Error processing sitemap index:', error));

async function processUrls() {
    console.log('🚀 Starting URL processing...');

    // Buat file log jika belum ada
    if (!fs.existsSync('log_success.txt')) {
        fs.writeFileSync('log_success.txt', '');
    }
    if (!fs.existsSync('log_failure.txt')) {
        fs.writeFileSync('log_failure.txt', '');
    }

    let batch = fs.readFileSync("urls.txt").toString().split("\n");

    // Baca log_success.txt dan log_failure.txt dan ekstrak URL yang sudah di-log
    let loggedSuccessUrls = fs.readFileSync("log_success.txt", "utf-8").split('\n');
    let loggedFailureUrls = fs.readFileSync("log_failure.txt", "utf-8").split('\n');

    // Saring URL yang sudah di-log
    batch = batch.filter(url => !loggedSuccessUrls.includes(url) && !loggedFailureUrls.includes(url));

    // Batasi hingga 1000 URL
    batch = batch.slice(0, 1000);

    console.log(`📦 Processing ${batch.length} URLs...`);

    // Bagi URL menjadi 5 batch
    const batchSize = Math.ceil(batch.length / 5);
    const batches = [];
    for (let i = 0; i < 5; i++) {
        batches.push(batch.slice(i * batchSize, (i + 1) * batchSize));
    }

    const serviceAccountFiles = [
        "./service_account1.json",
        "./service_account2.json",
        "./service_account3.json",
        "./service_account4.json",
        "./service_account5.json"
    ];

    const operationType = process.argv[2] === "--delete" ? "URL_DELETED" : "URL_UPDATED";

    async function processBatch(batch, serviceAccountFile) {
        console.log(`🔄 Processing batch using ${serviceAccountFile}...`);
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
            const items = batch.map((line) => {
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
                auth: { bearer: tokens.access_token },
                multipart: items,
            };

            return new Promise((resolve, reject) => {
                request(options, (err, resp, body) => {
                    if (err) {
                        console.log(`❌ Error processing batch using ${serviceAccountFile}:`, err);
                        // Log semua URL yang gagal
                        batch.forEach(url => {
                            fs.appendFileSync('log_failure.txt', url + '\n');
                        });
                        reject(err);
                    } else {
                        console.log(`✅ Request completed for batch using ${serviceAccountFile} with status code: ${resp.statusCode}`);
                        if (resp.statusCode === 200) {
                            console.log(`✅ Batch processed successfully.`);
                            // Log semua URL yang berhasil
                            batch.forEach(url => {
                                fs.appendFileSync('log_success.txt', url + '\n');
                            });
                        } else if (resp.statusCode === 429) {
                            console.log(`⚠️ Quota limit reached for ${serviceAccountFile}.`);
                            // Log semua URL yang gagal
                            batch.forEach(url => {
                                fs.appendFileSync('log_failure.txt', url + '\n');
                            });
                        } else {
                            console.log(`❌ Unexpected status code: ${resp.statusCode}`);
                            // Log semua URL yang gagal
                            batch.forEach(url => {
                                fs.appendFileSync('log_failure.txt', url + '\n');
                            });
                        }
                        resolve();
                    }
                });
            });
        } catch (err) {
            console.log(`❌ Error processing batch using ${serviceAccountFile}:`, err);
            // Log semua URL yang gagal
            batch.forEach(url => {
                fs.appendFileSync('log_failure.txt', url + '\n');
            });
        }
    }

    // Proses setiap batch dengan API yang berbeda
    for (const [index, batch] of batches.entries()) {
        await processBatch(batch, serviceAccountFiles[index]);
    }
}