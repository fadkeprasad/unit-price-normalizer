<p align="center">
  <img src="assets/unit-price-normalizer-icon.png" width="160" alt="Unit Price Normalizer icon">
</p>

# Unit Price Normalizer

A lightweight Chrome extension that adds a consistent **price per gram** or **price per milliliter** beside products on shopping result pages.

Everything runs locally in your browser. There is no account, server, tracking, or Chrome Web Store purchase.

## Install from this folder

1. Open `chrome://extensions` in Chrome.
2. Turn on **Developer mode**.
3. Click **Load unpacked**.
4. Select this project folder.
5. Open an Amazon, Walmart, or other retail search page.

The extension looks for a displayed product price and package size in each card. It recognizes grams, kilograms, ounces, pounds, milliliters, liters, fluid ounces, pints, quarts, gallons, and common multipack formats.

Use the toolbar popup to turn normalization on or off, choose precision, highlight the lowest comparable price, or rescan a page.

## Install from GitHub

1. On the repository page, select **Code → Download ZIP**.
2. Unzip the downloaded file somewhere permanent.
3. Open `chrome://extensions` and enable **Developer mode**.
4. Select **Load unpacked** and choose the unzipped folder.

Chrome does not automatically update manually installed extensions. After downloading a newer version, replace the files and click the extension's **Reload** button on `chrome://extensions`.

## Publish this repository on GitHub

Create an empty GitHub repository, then run these commands from this project directory:

```sh
git add .
git commit -m "Initial release"
git remote add origin https://github.com/YOUR_USERNAME/unit-price-normalizer.git
git push -u origin main
```

No Chrome Web Store developer account or fee is required for this distribution method.

## Test

```sh
node --test
```

`demo.html` contains a small product grid for a quick manual check after loading the extension.

## Limitations

- Product cards must show both a price and a package size.
- Plain `oz` is treated as weight; liquid ounces should be labeled `fl oz`.
- Count-only products cannot be converted to grams or milliliters without a per-item size.
- Retailers change their markup periodically. The generic selectors cover common layouts, but site-specific updates may occasionally be needed.

## License

MIT
