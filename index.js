const puppeteer = require('puppeteer');
const ProxyChain = require('proxy-chain');
const fs = require('fs');

(async () => {
    const proxyHost = 'your-host';
    const proxyPort = 'your-port';
    const proxyUsername = 'your-username';
    const proxyPassword = 'your-password';

    // Full proxy URL with authentication
    const proxyUrl = `http://${proxyUsername}:${proxyPassword}@${proxyHost}:${proxyPort}`;

    // An anonymized proxy URL 
    const anonymizedProxyUrl = await ProxyChain.anonymizeProxy(proxyUrl);

    // Retry logic
    const maxRetries = 20; 
    const maxScrolls = 50;

    // Launch Puppeteer with the anonymized proxy
    const browser = await puppeteer.launch({
        headless: true,
        args: [`--proxy-server=${anonymizedProxyUrl}`], 
    });

    const page = await browser.newPage();

    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36');

    async function tryPageGoto(url) {
        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            try {
                console.log(`Attempting to access page (Attempt ${attempt} of ${maxRetries})`);
                await page.goto(url, { waitUntil: 'networkidle2', timeout: 120000 });

                console.log('Page loaded successfully!');
                return; // Exit the retry loop if successful

            } catch (error) {
                console.error(`Error on attempt ${attempt}: ${error.message}`);
                if (attempt === maxRetries) {
                    console.error('Max retries reached. Exiting...');
                } else {
                    console.log('Retrying...');
                }
            }
        }
    }

    async function scrollAndLoad(page) {
        let previousHeight;
        let scrollAttempts = 0;

        while (scrollAttempts < maxScrolls) {
            previousHeight = await page.evaluate('document.body.scrollHeight');
            await page.evaluate('window.scrollTo(0, document.body.scrollHeight)');

            console.log(`Scrolled to bottom - Attempt ${scrollAttempts + 1}`);
            
            // Wait longer for the content to load since the page is large
            await new Promise(resolve => setTimeout(resolve, 4000)); 

            let currentHeight = await page.evaluate('document.body.scrollHeight');

            if (currentHeight === previousHeight) {
                console.log('No more content to load, stopping scroll');
                break; // Break the loop when no new content is loaded
            }

            scrollAttempts++;
        }

        console.log('Finished scrolling.');
    }

    try {
        await tryPageGoto('https://www.pullandbear.com/ba/muskarci/odjeca-n6289?celement=1030615335');

        await scrollAndLoad(page);

        const products = await page.evaluate(() => {
            const productElements = document.querySelectorAll('legacy-product');

            const productDetails = Array.from(productElements).map(productElement => {
                // Extracting product URL
                const productUrl = productElement.querySelector('a.carousel-item-container')?.href || 'N/A';

                // Extracting product name
                const productName = productElement.querySelector('.name > span')?.innerText || 'N/A';

                // Extracting product price
                const productPrice = productElement.querySelector('.product-price--price')?.innerText || 'N/A';

                // Extracting product image URL
                let productImageUrl = productElement.querySelector('img.image-responsive')?.getAttribute('src') || 
                                      productElement.querySelector('img.image-responsive')?.getAttribute('data-src') || 'N/A';

                return {
                    productUrl,
                    productName,
                    productPrice,
                    productImageUrl,
                };
            });

            return productDetails;
        });

        fs.writeFileSync('products.json', JSON.stringify(products, null, 2), 'utf-8');
        console.log('Product details saved to products.json');

    } catch (error) {
        console.error('Navigation or extraction failed:', error);
    } finally {
        // Close the browser
        await browser.close();

        // Close the anonymized proxy connection
        await ProxyChain.closeAnonymizedProxy(anonymizedProxyUrl);
    }
})();