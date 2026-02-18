#!/bin/bash

# Font Download Script for Meow Note
# Using CDN mirrors accessible in China

FONTS_DIR="public/fonts"
mkdir -p "$FONTS_DIR"

echo "Downloading fonts from CDN mirrors..."

# Try multiple CDN sources for fonts
# Using jsDelivr and cdnjs as fallbacks

# Limelight font
echo "Downloading Limelight..."
curl -L --connect-timeout 10 "https://cdn.jsdelivr.net/npm/@fontsource/limelight@5.0.8/files/limelight-latin-400-normal.woff2" -o "$FONTS_DIR/Limelight-Regular.woff2" || \
curl -L --connect-timeout 10 "https://cdnjs.cloudflare.com/ajax/libs/fontsource/limelight/5.0.8/files/limelight-latin-400-normal.woff2" -o "$FONTS_DIR/Limelight-Regular.woff2"

# Poppins fonts from jsDelivr
echo "Downloading Poppins Regular..."
curl -L --connect-timeout 10 "https://cdn.jsdelivr.net/npm/@fontsource/poppins@5.1.0/files/poppins-latin-400-normal.woff2" -o "$FONTS_DIR/poppins-v20-latin-regular.woff2" || \
curl -L --connect-timeout 10 "https://unpkg.com/@fontsource/poppins@5.1.0/files/poppins-latin-400-normal.woff2" -o "$FONTS_DIR/poppins-v20-latin-regular.woff2"

echo "Downloading Poppins Medium..."
curl -L --connect-timeout 10 "https://cdn.jsdelivr.net/npm/@fontsource/poppins@5.1.0/files/poppins-latin-500-normal.woff2" -o "$FONTS_DIR/poppins-v20-latin-500.woff2" || \
curl -L --connect-timeout 10 "https://unpkg.com/@fontsource/poppins@5.1.0/files/poppins-latin-500-normal.woff2" -o "$FONTS_DIR/poppins-v20-latin-500.woff2"

echo "Downloading Poppins SemiBold..."
curl -L --connect-timeout 10 "https://cdn.jsdelivr.net/npm/@fontsource/poppins@5.1.0/files/poppins-latin-600-normal.woff2" -o "$FONTS_DIR/poppins-v20-latin-600.woff2" || \
curl -L --connect-timeout 10 "https://unpkg.com/@fontsource/poppins@5.1.0/files/poppins-latin-600-normal.woff2" -o "$FONTS_DIR/poppins-v20-latin-600.woff2"

echo "Downloading Poppins Bold..."
curl -L --connect-timeout 10 "https://cdn.jsdelivr.net/npm/@fontsource/poppins@5.1.0/files/poppins-latin-700-normal.woff2" -o "$FONTS_DIR/poppins-v20-latin-700.woff2" || \
curl -L --connect-timeout 10 "https://unpkg.com/@fontsource/poppins@5.1.0/files/poppins-latin-700-normal.woff2" -o "$FONTS_DIR/poppins-v20-latin-700.woff2"

echo ""
echo "Verifying downloads..."
for file in "$FONTS_DIR"/*.woff2; do
  if [ -f "$file" ]; then
    type=$(file -b "$file")
    size=$(stat -f%z "$file" 2>/dev/null || stat -c%s "$file" 2>/dev/null)
    echo "$(basename "$file"): $type (size: $size bytes)"
  fi
done

echo ""
echo "Done!"
