#!/usr/bin/env bash

mkdir -p exports

scour --enable-comment-stripping --enable-id-stripping --no-line-breaks logo.inkscape.svg exports/logo.svg
xmlstarlet ed -P -L -N s=http://www.w3.org/2000/svg -d "//s:g[@display='none']" exports/logo.svg

inkscape -w 16 -h 16 -o exports/logo16.png logo.inkscape.svg
inkscape -w 32 -h 32 -o exports/logo32.png logo.inkscape.svg
inkscape -w 48 -h 48 -o exports/logo48.png logo.inkscape.svg

magick exports/logo16.png exports/logo32.png exports/logo48.png exports/favicon.ico