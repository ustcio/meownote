#!/usr/bin/env node
/**
 * Claude Website Resource Extractor
 * This script fetches and analyzes the Claude/Anthropic website structure
 */

const fs = require('fs');
const path = require('path');
const https = require('https');

// Configuration
const TARGET_URLS = [
  'https://www.anthropic.com',
  'https://www.anthropic.com/claude',
  'https://claude.ai',
];

const OUTPUT_DIR = path.join(__dirname, 'extracted-claude-website');

// Ensure output directory exists
if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

// Helper function to fetch URL
function fetchUrl(url) {
  return new Promise((resolve, reject) => {
    const options = {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
        'Accept-Encoding': 'gzip, deflate, br',
        'Connection': 'keep-alive',
      }
    };

    https.get(url, options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, data }));
    }).on('error', reject);
  });
}

// Extract resources from HTML
function extractResources(html, baseUrl) {
  const resources = {
    css: [],
    js: [],
    fonts: [],
    images: [],
    links: []
  };

  // Extract CSS files
  const cssRegex = /<link[^>]*rel=["']stylesheet["'][^>]*href=["']([^"']+)["'][^>]*>/gi;
  let match;
  while ((match = cssRegex.exec(html)) !== null) {
    resources.css.push({ url: new URL(match[1], baseUrl).href, original: match[1] });
  }

  // Extract inline CSS styles
  const styleRegex = /<style[^>]*>([\s\S]*?)<\/style>/gi;
  const inlineStyles = [];
  while ((match = styleRegex.exec(html)) !== null) {
    inlineStyles.push(match[1]);
  }
  resources.inlineStyles = inlineStyles;

  // Extract JavaScript files
  const jsRegex = /<script[^>]*src=["']([^"']+)["'][^>]*>/gi;
  while ((match = jsRegex.exec(html)) !== null) {
    resources.js.push({ url: new URL(match[1], baseUrl).href, original: match[1] });
  }

  // Extract inline scripts
  const scriptRegex = /<script[^>]*>([\s\S]*?)<\/script>/gi;
  const inlineScripts = [];
  while ((match = scriptRegex.exec(html)) !== null) {
    if (match[1].trim()) {
      inlineScripts.push(match[1]);
    }
  }
  resources.inlineScripts = inlineScripts;

  // Extract font references
  const fontRegex = /url\(["']?([^"')]+\.(?:woff2?|ttf|otf|eot))["']?\)/gi;
  while ((match = fontRegex.exec(html)) !== null) {
    resources.fonts.push({ url: new URL(match[1], baseUrl).href, original: match[1] });
  }

  // Extract Google Fonts or other font URLs
  const fontUrlRegex = /https?:\/\/[^\s"'<>]+\.(?:woff2?|ttf|otf|eot)/gi;
  while ((match = fontUrlRegex.exec(html)) !== null) {
    resources.fonts.push({ url: match[0], original: match[0] });
  }

  // Extract images
  const imgRegex = /<img[^>]*src=["']([^"']+)["'][^>]*>/gi;
  while ((match = imgRegex.exec(html)) !== null) {
    resources.images.push({ url: new URL(match[1], baseUrl).href, original: match[1] });
  }

  // Extract links
  const linkRegex = /<a[^>]*href=["']([^"']+)["'][^>]*>/gi;
  while ((match = linkRegex.exec(html)) !== null) {
    if (match[1].startsWith('http')) {
      resources.links.push(match[1]);
    }
  }

  return resources;
}

// Analyze CSS for design tokens
function analyzeCSS(css) {
  const analysis = {
    colors: new Set(),
    fonts: new Set(),
    fontSizes: new Set(),
    spacing: new Set(),
    breakpoints: new Set(),
    animations: new Set()
  };

  // Extract colors
  const colorRegex = /(?:color|background|background-color|border-color|fill|stroke)\s*:\s*(#[a-fA-F0-9]{3,8}|rgba?\([^)]+\)|hsla?\([^)]+\)|[a-zA-Z]+)/gi;
  let match;
  while ((match = colorRegex.exec(css)) !== null) {
    analysis.colors.add(match[1]);
  }

  // Extract CSS variables
  const cssVarRegex = /--[a-zA-Z0-9-_]+\s*:\s*([^;]+)/gi;
  while ((match = cssVarRegex.exec(css)) !== null) {
    const value = match[1].trim();
    if (value.match(/^#[a-fA-F0-9]{3,8}/)) {
      analysis.colors.add(value);
    }
  }

  // Extract font families
  const fontRegex = /font-family\s*:\s*([^;]+)/gi;
  while ((match = fontRegex.exec(css)) !== null) {
    analysis.fonts.add(match[1].trim());
  }

  // Extract font sizes
  const fontSizeRegex = /font-size\s*:\s*([^;]+)/gi;
  while ((match = fontSizeRegex.exec(css)) !== null) {
    analysis.fontSizes.add(match[1].trim());
  }

  // Extract spacing values
  const spacingRegex = /(?:margin|padding|gap|width|height|top|right|bottom|left)\s*:\s*([^;]+)/gi;
  while ((match = spacingRegex.exec(css)) !== null) {
    analysis.spacing.add(match[1].trim());
  }

  // Extract media queries
  const mediaRegex = /@media\s*\([^)]+\)/gi;
  while ((match = mediaRegex.exec(css)) !== null) {
    analysis.breakpoints.add(match[0]);
  }

  // Extract animations
  const animRegex = /(?:animation|transition)\s*:\s*([^;]+)/gi;
  while ((match = animRegex.exec(css)) !== null) {
    analysis.animations.add(match[1].trim());
  }

  return {
    colors: Array.from(analysis.colors),
    fonts: Array.from(analysis.fonts),
    fontSizes: Array.from(analysis.fontSizes),
    spacing: Array.from(analysis.spacing),
    breakpoints: Array.from(analysis.breakpoints),
    animations: Array.from(analysis.animations)
  };
}

// Main extraction function
async function extractWebsite() {
  const results = {
    timestamp: new Date().toISOString(),
    pages: []
  };

  for (const url of TARGET_URLS) {
    console.log(`Fetching: ${url}`);
    try {
      const response = await fetchUrl(url);
      
      if (response.status === 200) {
        // Save HTML
        const urlObj = new URL(url);
        const filename = `${urlObj.hostname.replace(/\./g, '-')}${urlObj.pathname.replace(/\//g, '-')}.html`;
        const filepath = path.join(OUTPUT_DIR, filename);
        fs.writeFileSync(filepath, response.data);
        console.log(`Saved HTML: ${filepath}`);

        // Extract resources
        const resources = extractResources(response.data, url);
        
        // Analyze inline styles
        let cssAnalysis = null;
        if (resources.inlineStyles.length > 0) {
          const combinedCSS = resources.inlineStyles.join('\n');
          cssAnalysis = analyzeCSS(combinedCSS);
        }

        results.pages.push({
          url,
          filename,
          status: response.status,
          resources,
          cssAnalysis
        });
      }
    } catch (error) {
      console.error(`Error fetching ${url}:`, error.message);
      results.pages.push({ url, error: error.message });
    }
  }

  // Save analysis results
  const analysisPath = path.join(OUTPUT_DIR, 'analysis.json');
  fs.writeFileSync(analysisPath, JSON.stringify(results, null, 2));
  console.log(`\nAnalysis saved to: ${analysisPath}`);

  return results;
}

// Run extraction
extractWebsite().then(results => {
  console.log('\n=== Extraction Complete ===');
  console.log(`Pages analyzed: ${results.pages.length}`);
  
  results.pages.forEach(page => {
    if (page.resources) {
      console.log(`\n${page.url}:`);
      console.log(`  CSS files: ${page.resources.css.length}`);
      console.log(`  JS files: ${page.resources.js.length}`);
      console.log(`  Fonts: ${page.resources.fonts.length}`);
      console.log(`  Images: ${page.resources.images.length}`);
      console.log(`  Inline styles: ${page.resources.inlineStyles?.length || 0}`);
      console.log(`  Inline scripts: ${page.resources.inlineScripts?.length || 0}`);
    }
  });
}).catch(console.error);
