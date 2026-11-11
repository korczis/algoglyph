// p5.js assembled from the modules the plates use, instead of the full build (`import 'p5'`),
// which also bundles the friendly-error system with its translations, the DOM helpers, data
// utilities and p5.strands. `accessibility` stays: shape drawing calls into it
// (_addAccsOutput). Only src/core/stage.ts imports this.
import p5 from 'p5/core';
import accessibility from 'p5/accessibility';
import color from 'p5/color';
import events from 'p5/events';
import image from 'p5/image';
import io from 'p5/io';
import math from 'p5/math';
import shape from 'p5/shape';
import type from 'p5/type';
import webgl from 'p5/webgl';

for (const module of [shape, accessibility, color, events, image, io, math, webgl, type]) {
  module(p5);
}

export default p5;
